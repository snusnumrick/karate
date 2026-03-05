import type {
    ApplicableTo,
    ApplyDiscountRequest,
    CreateDiscountCodeData,
    DiscountCode,
    DiscountCodeUsage,
    DiscountCodeWithUsage,
    DiscountScope,
    DiscountType,
    DiscountValidationResult,
    UpdateDiscountCodeData,
    UsageType
} from '~/types/discount';
import type { Database } from '~/types/database.types';
import type {ExtendedSupabaseClient} from '~/types/supabase-extensions';
import {getSupabaseAdminClient} from '~/utils/supabase.server';
import { getCurrentDateTimeInTimezone } from '~/utils/misc';
import { moneyFromRow } from '~/services/database-money.server';
import {fromCents, fromDollars, type Money, toCents, toDollars} from '~/utils/money';
import { createNotFoundError, createPersistenceError, createValidationError } from '~/utils/service-errors.server';

type DiscountUsageRowWithCode = Database['public']['Tables']['discount_code_usage']['Row'] & {
    discount_codes?: Database['public']['Tables']['discount_codes']['Row'] | null;
};
type DiscountCodeRow = Database['public']['Tables']['discount_codes']['Row'];
type DiscountCodeUsageRow = Database['public']['Tables']['discount_code_usage']['Row'];

const toFixedAmountMoney = (value: Money | number): Money => {
    if (typeof value === 'number') {
        return fromDollars(value);
    }
    return value;
};

const buildDiscountValueWrite = (discountType: DiscountType, discountValue: Money | number) => {
    if (discountType === 'fixed_amount') {
        const moneyValue = toFixedAmountMoney(discountValue);
        return {
            discount_value: toDollars(moneyValue),
            discount_value_cents: toCents(moneyValue)
        };
    }

    return {
        discount_value: discountValue as number,
        discount_value_cents: 0
    };
};

const normalizeDiscountCodeRow = (row: DiscountCodeRow): DiscountCode => {
    const discountType = row.discount_type as DiscountType;
    const fixedAmountCents = row.discount_value_cents ?? (discountType === 'fixed_amount'
        ? Math.round((row.discount_value ?? 0) * 100)
        : 0);

    return {
        ...row,
        description: row.description ?? undefined,
        max_uses: row.max_uses ?? undefined,
        valid_until: row.valid_until ?? undefined,
        created_by: row.created_by ?? undefined,
        family_id: row.family_id ?? undefined,
        student_id: row.student_id ?? undefined,
        discount_type: discountType,
        usage_type: row.usage_type as UsageType,
        applicable_to: row.applicable_to as ApplicableTo,
        scope: row.scope as DiscountScope,
        discount_value: discountType === 'fixed_amount'
            ? fromCents(fixedAmountCents)
            : row.discount_value ?? 0
    };
};

const normalizeDiscountUsageJoin = (
    joinedDiscount: DiscountUsageRowWithCode['discount_codes'] | null | undefined
) => {
    if (!joinedDiscount) return undefined;

    // docs/MONETARY_STORAGE.md: prefer *_cents for fixed amounts while leaving percentage values numeric
    return normalizeDiscountCodeRow(joinedDiscount as DiscountCodeRow);
};

const mapDiscountUsageRows = (rawUsage: unknown[]): DiscountCodeUsage[] => {
    const usageRows = rawUsage.filter((usage): usage is DiscountUsageRowWithCode => {
        return typeof usage === 'object' && usage !== null && 'discount_code_id' in usage;
    });

    return usageRows.map((usageRow) => ({
        ...usageRow,
        discount_amount: moneyFromRow('discount_code_usage', 'discount_amount', usageRow),
        original_amount: moneyFromRow('discount_code_usage', 'original_amount', usageRow),
        final_amount: moneyFromRow('discount_code_usage', 'final_amount', usageRow),
        discount_codes: normalizeDiscountUsageJoin(usageRow.discount_codes)
    }) as DiscountCodeUsage);
};

const fetchDiscountUsageByScope = async (
    supabase: ExtendedSupabaseClient,
    scopeField: 'family_id' | 'student_id',
    scopeId: string,
    scopeLabel: 'family' | 'student'
): Promise<DiscountCodeUsage[]> => {
    const {data, error} = await supabase
        .from('discount_code_usage')
        .select(`
        *,
        discount_codes(*)
      `)
        .eq(scopeField, scopeId)
        .order('used_at', {ascending: false});

    if (error) {
        console.error(`Error fetching ${scopeLabel} discount usage:`, error);
        throw createPersistenceError(`Failed to fetch ${scopeLabel} discount usage`);
    }

    const rawUsage = Array.isArray(data) ? (data as unknown[]) : [];
    return mapDiscountUsageRows(rawUsage);
};

// Compatibility shim: prefer the exported function-first API below for new callers.
export class DiscountService {
    private static getSupabase() {
        return getSupabaseAdminClient();
    }

    /**
     * Get all active discount codes (for users)
     */
    static async getActiveDiscountCodes(): Promise<DiscountCode[]> {
        const now = getCurrentDateTimeInTimezone().toISOString();
        const {data, error} = await this.getSupabase()
            .from('discount_codes')
            .select()
            .eq('is_active', true)
            .lte('valid_from', now)
            .or('valid_until.is.null,valid_until.gte.' + now)
            .order('created_at', {ascending: false});

        if (error) {
            throw createPersistenceError(`Failed to fetch active discount codes: ${error.message}`);
        }

        // Map null to undefined for optional properties
        return (data || []).map(normalizeDiscountCodeRow);
    }

    /**
     * Get all discount codes (for admin)
     */
    static async getAllDiscountCodes(): Promise<DiscountCodeWithUsage[]> {
        const supabase = this.getSupabase();

        // First get all discount codes with family and student data
        const {data: codes_db, error: codesError} = await supabase
            .from('discount_codes')
            .select(`
        *,
        families(id, name),
        students(id, first_name, last_name)
      `)
            .order('created_at', {ascending: false});

        if (codesError) {
            throw createPersistenceError(`Failed to fetch discount codes: ${codesError.message}`);
        }

        if (!codes_db || codes_db.length === 0) {
            return [];
        }

        // Get creator information for codes that have created_by
        const creatorIds = [...new Set(codes_db
            .filter((code) => code.created_by)
            .map((code) => code.created_by)
            .filter((id): id is string => id !== null && id !== undefined))];

        const codeIds = codes_db.map((code) => code.id);

        let creators: Array<{ id: string; email: string; first_name: string | null; last_name: string | null }> = [];
        let usageData_db: DiscountCodeUsageRow[] = [];

        if (creatorIds.length > 0) {
            const [
                {data: creatorData, error: creatorError},
                {data: usageData, error: usageError}
            ] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, email, first_name, last_name')
                    .in('id', creatorIds),
                supabase
                    .from('discount_code_usage')
                    .select(`
         id,
         discount_code_id,
         payment_id,
         family_id,
         student_id,
         discount_amount,
         original_amount,
         final_amount,
         used_at
       `)
                    .in('discount_code_id', codeIds)
                    .order('used_at', {ascending: false})
            ]);

            if (creatorError) {
                throw createPersistenceError(`Failed to fetch creator profiles: ${creatorError.message}`);
            }
            if (usageError) {
                throw createPersistenceError(`Failed to fetch discount usage: ${usageError.message}`);
            }

            creators = creatorData || [];
            usageData_db = usageData || [];
        } else {
            const {data: usageData, error: usageError} = await supabase
                .from('discount_code_usage')
                .select(`
         id,
         discount_code_id,
         payment_id,
         family_id,
         student_id,
         discount_amount,
         original_amount,
         final_amount,
         used_at
       `)
                .in('discount_code_id', codeIds)
                .order('used_at', {ascending: false});

            if (usageError) {
                throw createPersistenceError(`Failed to fetch discount usage: ${usageError.message}`);
            }
            usageData_db = usageData || [];
        }

        const creatorsById = new Map(creators.map((creator) => [creator.id, creator]));

        // Map creators onto codes
        const codesWithCreators = codes_db.map((code_db) => {
            const normalized = normalizeDiscountCodeRow(code_db);
            const creator = code_db.created_by ? creatorsById.get(code_db.created_by) : undefined;
            return {
                ...normalized,
                families: code_db.families ?? null,
                students: code_db.students ?? null,
                creator: creator ? {
                    ...creator,
                    full_name: (() => {
                        const firstName = creator.first_name || '';
                        const lastName = creator.last_name || '';
                        const fullName = `${firstName} ${lastName}`.trim();
                        return fullName || creator.email;
                    })()
                } : null
            };
        });

        const usageByCode = new Map<string, DiscountCodeUsageRow[]>();
        for (const usage of usageData_db) {
            const existing = usageByCode.get(usage.discount_code_id) ?? [];
            existing.push(usage);
            usageByCode.set(usage.discount_code_id, existing);
        }

        // Combine the data
        return codesWithCreators.map((code) => {
            const codeUsage_db = usageByCode.get(code.id) ?? [];
            return {
                ...code,
                usage_count: codeUsage_db.length,
                recent_usage: codeUsage_db.slice(0, 5).map(usageRow => ({
                    ...usageRow,
                    discount_amount: moneyFromRow('discount_code_usage', 'discount_amount', usageRow),
                    original_amount: moneyFromRow('discount_code_usage', 'original_amount', usageRow),
                    final_amount: moneyFromRow('discount_code_usage', 'final_amount', usageRow)
                }))
            };
        });
    }

    /**
     * Get discount code by ID
     */
    static async getDiscountCodeById(id: string): Promise<DiscountCode | null> {
        const {data, error} = await this.getSupabase()
            .from('discount_codes')
            .select()
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw createPersistenceError(`Failed to fetch discount code: ${error.message}`);
        }

        return normalizeDiscountCodeRow(data);
    }

    /**
     * Get discount code by code string
     */
    static async getDiscountCodeByCode(code: string): Promise<DiscountCode | null> {
        const {data, error} = await this.getSupabase()
            .from('discount_codes')
            .select()
            .eq('code', code)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw createPersistenceError(`Failed to fetch discount code: ${error.message}`);
        }

        return normalizeDiscountCodeRow(data);
    }

    /**
     * Create a new discount code
     */
    static async createDiscountCode(
        discountData: CreateDiscountCodeData,
        createdBy?: string
    ): Promise<DiscountCode> {
        // Validate association constraints
        if (discountData.scope === 'per_family' && !discountData.family_id) {
            throw createValidationError('family_id is required when scope is per_family');
        }
        if (discountData.scope === 'per_student' && !discountData.student_id) {
            throw createValidationError('student_id is required when scope is per_student');
        }
        if (discountData.family_id && discountData.student_id) {
            throw createValidationError('Cannot specify both family_id and student_id');
        }
        if (!discountData.family_id && !discountData.student_id) {
            throw createValidationError('Must specify either family_id or student_id');
        }

        const {discount_value, valid_from, ...restData} = discountData;
        const valueWrite = buildDiscountValueWrite(discountData.discount_type, discount_value);

        const {data, error} = await this.getSupabase()
            .from('discount_codes')
            .insert({
                ...restData,
                ...valueWrite,
                created_by: createdBy,
                created_automatically: !createdBy, // If no creator, it's automatic
                valid_from: valid_from || getCurrentDateTimeInTimezone().toISOString()
            })
            .select()
            .single();

        if (error) {
            throw createPersistenceError(`Failed to create discount code: ${error.message}`);
        }

        return normalizeDiscountCodeRow(data);
    }

    /**
     * Update a discount code
     */
    static async updateDiscountCode(
        id: string,
        updates: UpdateDiscountCodeData
    ): Promise<DiscountCode> {
        const { discount_value, discount_type, ...restUpdates } = updates;
        const updateData: Record<string, unknown> = { ...restUpdates };
        let effectiveType = discount_type;

        if (discount_type !== undefined) {
            updateData.discount_type = discount_type;
        }

        if (discount_value !== undefined) {
            if (!effectiveType) {
                const existing = await this.getDiscountCodeById(id);
                if (!existing) {
                    throw createNotFoundError('Discount code not found');
                }
                effectiveType = existing.discount_type;
            }

            if (!effectiveType) {
                throw createValidationError('Discount type is required when updating discount value');
            }

            Object.assign(updateData, buildDiscountValueWrite(effectiveType, discount_value));
        }

        const {data, error} = await this.getSupabase()
            .from('discount_codes')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw createPersistenceError(`Failed to update discount code: ${error.message}`);
        }

        return normalizeDiscountCodeRow(data);
    }

    /**
     * Deactivate a discount code
     */
    static async deactivateDiscountCode(id: string): Promise<void> {
        const {error} = await this.getSupabase()
            .from('discount_codes')
            .update({is_active: false})
            .eq('id', id);

        if (error) {
            throw createPersistenceError(`Failed to deactivate discount code: ${error.message}`);
        }
    }

    /**
     * Activate a discount code
     */
    static async activateDiscountCode(id: string): Promise<void> {
        const {error} = await this.getSupabase()
            .from('discount_codes')
            .update({is_active: true})
            .eq('id', id);

        if (error) {
            throw createPersistenceError(`Failed to activate discount code: ${error.message}`);
        }
    }

    /**
     * Delete a discount code (hard delete)
     */
    static async deleteDiscountCode(id: string): Promise<void> {
        const {error} = await this.getSupabase()
            .from('discount_codes')
            .delete()
            .eq('id', id);

        if (error) {
            throw createPersistenceError(`Failed to delete discount code: ${error.message}`);
        }
    }

    /**
     * Validate a discount code
     */
    static async validateDiscountCode(
        request: ApplyDiscountRequest
    ): Promise<DiscountValidationResult> {
        const {data, error} = await this.getSupabase()
            .rpc('validate_discount_code', {
                p_code: request.code,
                p_family_id: request.family_id,
                p_student_id: request.student_id ?? undefined,
                p_subtotal_amount: toCents(request.subtotal_amount),
                p_applicable_to: request.applicable_to
            });

        if (error) {
            throw createPersistenceError(`Failed to validate discount code: ${error.message}`);
        }

        const result = data[0] || {is_valid: false, discount_amount: 0, error_message: 'Unknown error'};

        // Create a properly typed result object
        const validationResult: DiscountValidationResult = {
            is_valid: result.is_valid,
            discount_amount: fromCents(result.discount_amount),
            discount_code_id: result.discount_code_id ?? undefined,
            error_message: result.error_message ?? undefined,
        };

        // Add the original code to the result for display purposes
        if (result.is_valid) {
            validationResult.code = request.code;

            // Fetch the discount name for display purposes
            const {data: discountData} = await this.getSupabase()
                .from('discount_codes')
                .select('name')
                .eq('code', request.code)
                .single();

            if (discountData) {
                validationResult.name = discountData.name;
            }
        }

        return validationResult;
    }

    /**
     * Apply a discount code to a payment
     */
    static async applyDiscountCode(
        discountCodeId: string,
        paymentId: string,
        familyId: string,
        discountAmount: Money,
        studentId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Get the discount code details
            const {data: discountCode, error: fetchError} = await this.getSupabase()
                .from('discount_codes')
                .select()
                .eq('id', discountCodeId)
                .single();

            if (fetchError || !discountCode) {
                return {success: false, error: 'Discount code not found'};
            }

            // Record the usage
            const {error: usageError} = await (this.getSupabase() as ExtendedSupabaseClient)
                .from('discount_code_usage')
                .insert({
                    discount_code_id: discountCodeId,
                    payment_id: paymentId,
                    family_id: familyId,
                    student_id: studentId || null,
                    discount_amount: toCents(discountAmount),
                    original_amount: 0, // Will be updated when payment is processed
                    final_amount: 0, // Will be updated when payment is processed
                    used_at: new Date().toISOString()
                });

            if (usageError) {
                console.error('Error recording discount usage:', usageError);
                return {success: false, error: 'Failed to record discount usage'};
            }

            // Increment the usage count
            const {error: incrementError} = await this.getSupabase().rpc(
                'increment_discount_code_usage',
                {p_discount_code_id: discountCodeId}
            );

            if (incrementError) {
                console.error('Error incrementing discount usage:', incrementError);
                return {success: false, error: 'Failed to update discount usage count'};
            }

            return {success: true};
        } catch (error) {
            console.error('Error applying discount code:', error);
            return {success: false, error: 'Internal server error'};
        }
    }

    /**
     * Get discount usage history for a family
     */
    static async getFamilyDiscountUsage(familyId: string): Promise<DiscountCodeUsage[]> {
        return fetchDiscountUsageByScope(
            this.getSupabase() as ExtendedSupabaseClient,
            'family_id',
            familyId,
            'family'
        );
    }

    /**
     * Get discount usage history for a student
     */
    static async getStudentDiscountUsage(studentId: string): Promise<DiscountCodeUsage[]> {
        return fetchDiscountUsageByScope(
            this.getSupabase() as ExtendedSupabaseClient,
            'student_id',
            studentId,
            'student'
        );
    }

    /**
     * Generate a unique discount code
     */
    static async generateUniqueCode(prefix: string = '', length: number = 8): Promise<string> {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            let code = prefix;
            for (let i = 0; i < length; i++) {
                code += characters.charAt(Math.floor(Math.random() * characters.length));
            }

            // Check if code already exists
            const {error} = await this.getSupabase()
                .from('discount_codes')
                .select('id')
                .eq('code', code)
                .single();

            if (error && error.code === 'PGRST116') {
                // Code doesn't exist, we can use it
                return code;
            }

            attempts++;
        }

        throw createPersistenceError('Failed to generate unique discount code after multiple attempts');
    }

    /**
     * Create automatic discount codes (for system use)
     */
    static async createAutomaticDiscountCode(
        name: string,
        discountType: 'fixed_amount' | 'percentage',
        discountValue: Money,
        applicableTo: ApplicableTo = ['monthly_group', 'yearly_group'],
        scope: 'per_student' | 'per_family' = 'per_family',
        validUntil?: string
    ): Promise<DiscountCode> {
        const code = await this.generateUniqueCode('AUTO', 6);

        return this.createDiscountCode({
            code,
            name,
            description: `Automatically generated discount: ${name}`,
            discount_type: discountType,
            discount_value: discountValue,
            usage_type: 'one_time',
            applicable_to: applicableTo,
            scope,
            valid_until: validUntil
        });
    }
}

export async function getActiveDiscountCodes() {
    return DiscountService.getActiveDiscountCodes();
}

export async function getAllDiscountCodes() {
    return DiscountService.getAllDiscountCodes();
}

export async function getDiscountCodeById(id: string) {
    return DiscountService.getDiscountCodeById(id);
}

export async function getDiscountCodeByCode(code: string) {
    return DiscountService.getDiscountCodeByCode(code);
}

export async function createDiscountCode(discountData: CreateDiscountCodeData, createdBy?: string) {
    return DiscountService.createDiscountCode(discountData, createdBy);
}

export async function updateDiscountCode(id: string, updates: UpdateDiscountCodeData) {
    return DiscountService.updateDiscountCode(id, updates);
}

export async function deactivateDiscountCode(id: string) {
    return DiscountService.deactivateDiscountCode(id);
}

export async function activateDiscountCode(id: string) {
    return DiscountService.activateDiscountCode(id);
}

export async function deleteDiscountCode(id: string) {
    return DiscountService.deleteDiscountCode(id);
}

export async function validateDiscountCode(request: ApplyDiscountRequest) {
    return DiscountService.validateDiscountCode(request);
}

export async function applyDiscountCode(
    discountCodeId: string,
    paymentId: string,
    familyId: string,
    discountAmount: Money,
    studentId?: string
) {
    return DiscountService.applyDiscountCode(discountCodeId, paymentId, familyId, discountAmount, studentId);
}

export async function getFamilyDiscountUsage(familyId: string) {
    return DiscountService.getFamilyDiscountUsage(familyId);
}

export async function getStudentDiscountUsage(studentId: string) {
    return DiscountService.getStudentDiscountUsage(studentId);
}

export async function generateUniqueCode(prefix?: string, length?: number) {
    return DiscountService.generateUniqueCode(prefix, length);
}

export async function createAutomaticDiscountCode(
    name: string,
    discountType: 'fixed_amount' | 'percentage',
    discountValue: Money,
    applicableTo?: ApplicableTo,
    scope?: 'per_student' | 'per_family',
    validUntil?: string
) {
    return DiscountService.createAutomaticDiscountCode(
        name,
        discountType,
        discountValue,
        applicableTo,
        scope,
        validUntil
    );
}

export const discountService = {
    getActiveDiscountCodes,
    getAllDiscountCodes,
    getDiscountCodeById,
    getDiscountCodeByCode,
    createDiscountCode,
    updateDiscountCode,
    deactivateDiscountCode,
    activateDiscountCode,
    deleteDiscountCode,
    validateDiscountCode,
    applyDiscountCode,
    getFamilyDiscountUsage,
    getStudentDiscountUsage,
    generateUniqueCode,
    createAutomaticDiscountCode,
};
