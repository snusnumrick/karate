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
import type {ExtendedSupabaseClient} from '~/types/supabase-extensions';
import {getSupabaseAdminClient} from '~/utils/supabase.server';
import {fromCents, fromDollars, type Money, toCents, toDollars} from '~/utils/money';

// Interface for raw discount usage data from database

export class DiscountService {
    private static getSupabase() {
        return getSupabaseAdminClient();
    }

    /**
     * Get all active discount codes (for users)
     */
    static async getActiveDiscountCodes(): Promise<DiscountCode[]> {
        const {data, error} = await this.getSupabase()
            .from('discount_codes')
            .select('*')
            .eq('is_active', true)
            .lte('valid_from', new Date().toISOString())
            .or('valid_until.is.null,valid_until.gte.' + new Date().toISOString())
            .order('created_at', {ascending: false});

        if (error) {
            throw new Error(`Failed to fetch active discount codes: ${error.message}`);
        }

        // Map null to undefined for optional properties
        return (data || []).map(item => ({
            ...item,
            description: item.description ?? undefined,
            max_uses: item.max_uses ?? undefined,
            valid_until: item.valid_until ?? undefined,
            created_by: item.created_by ?? undefined,
            family_id: item.family_id ?? undefined,
            student_id: item.student_id ?? undefined,
            discount_type: item.discount_type as DiscountType,
            usage_type: item.usage_type as UsageType,
            applicable_to: item.applicable_to as ApplicableTo,
            scope: item.scope as DiscountScope,
            discount_value: item.discount_type === "fixed_amount" ? fromDollars(item.discount_value) : item.discount_value,
        }));
    }

    /**
     * Get all discount codes (for admin)
     */
    static async getAllDiscountCodes(): Promise<DiscountCodeWithUsage[]> {
        // First get all discount codes with family and student data
        const {data: codes_db, error: codesError} = await this.getSupabase()
            .from('discount_codes')
            .select(`
        *,
        families(id, name),
        students(id, first_name, last_name)
      `)
            .order('created_at', {ascending: false});

        if (codesError) {
            throw new Error(`Failed to fetch discount codes: ${codesError.message}`);
        }

        if (!codes_db || codes_db.length === 0) {
            return [];
        }

        // Get creator information for codes that have created_by
        const creatorIds = codes_db
            .filter((code) => code.created_by)
            .map((code) => code.created_by)
            .filter((id): id is string => id !== null && id !== undefined);

        let creators: Array<{ id: string; email: string; first_name: string | null; last_name: string | null }> = [];
        if (creatorIds.length > 0) {
            const {data: creatorData, error: creatorError} = await this.getSupabase()
                .from('profiles')
                .select('id, email, first_name, last_name')
                .in('id', creatorIds);

            if (creatorError) {
                throw new Error(`Failed to fetch creator profiles: ${creatorError.message}`);
            }
            creators = creatorData || [];
        }

        // Map creators to codes
        const codesWithCreators = codes_db.map((code_db) => {
            const creator = creators.find(c => c.id === code_db.created_by);
            return {
                ...code_db,
                discount_value: (code_db.discount_type as DiscountType) === 'fixed_amount'
                    ? fromDollars(code_db.discount_value || 0)
                    : (code_db.discount_value || 0),
                description: code_db.description ?? undefined,
                max_uses: code_db.max_uses ?? undefined,
                valid_until: code_db.valid_until ?? undefined,
                created_by: code_db.created_by ?? undefined,
                family_id: code_db.family_id ?? undefined,
                student_id: code_db.student_id ?? undefined,
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

        // Get usage data for all codes
        const {data: usageData_db, error: usageError} = await this.getSupabase()
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
            .in('discount_code_id', codesWithCreators.map((code) => code.id))
            .order('used_at', {ascending: false});

        if (usageError) {
            throw new Error(`Failed to fetch discount usage: ${usageError.message}`);
        }

        // Combine the data
        return codesWithCreators.map((code) => {
            const codeUsage_db = (usageData_db || []).filter((usage) => usage.discount_code_id === code.id);
            return {
                ...code,
                discount_type: code.discount_type as DiscountType,
                usage_type: code.usage_type as UsageType,
                scope: code.scope as DiscountScope,
                usage_count: codeUsage_db.length,
                recent_usage: codeUsage_db.slice(0, 5).map(usage_db => ({
                    ...usage_db,
                    discount_amount: fromCents(usage_db.discount_amount as number),
                    original_amount: fromCents(usage_db.original_amount as number),
                    final_amount: fromCents(usage_db.final_amount)
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
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw new Error(`Failed to fetch discount code: ${error.message}`);
        }

        // Map null to undefined for optional properties
        return {
            ...data,
            description: data.description ?? undefined,
            max_uses: data.max_uses ?? undefined,
            valid_until: data.valid_until ?? undefined,
            created_by: data.created_by ?? undefined,
            family_id: data.family_id ?? undefined,
            student_id: data.student_id ?? undefined,
            discount_type: data.discount_type as DiscountType,
            discount_value: (data.discount_type as DiscountType) === 'fixed_amount'
                ? fromDollars(data.discount_value)
                : data.discount_value,
            usage_type: data.usage_type as UsageType,
            applicable_to: data.applicable_to as ApplicableTo,
            scope: data.scope as DiscountScope,
        };
    }

    /**
     * Get discount code by code string
     */
    static async getDiscountCodeByCode(code: string): Promise<DiscountCode | null> {
        const {data, error} = await this.getSupabase()
            .from('discount_codes')
            .select('*')
            .eq('code', code)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw new Error(`Failed to fetch discount code: ${error.message}`);
        }

        // Map null to undefined for optional properties
        return {
            ...data,
            description: data.description ?? undefined,
            max_uses: data.max_uses ?? undefined,
            valid_until: data.valid_until ?? undefined,
            created_by: data.created_by ?? undefined,
            family_id: data.family_id ?? undefined,
            student_id: data.student_id ?? undefined,
            discount_type: data.discount_type as DiscountType,
            usage_type: data.usage_type as UsageType,
            applicable_to: data.applicable_to as ApplicableTo,
            scope: data.scope as DiscountScope,
            discount_value: (data.discount_type as DiscountType) === 'fixed_amount'
                ? fromDollars(data.discount_value)
                : data.discount_value,
        };
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
            throw new Error('family_id is required when scope is per_family');
        }
        if (discountData.scope === 'per_student' && !discountData.student_id) {
            throw new Error('student_id is required when scope is per_student');
        }
        if (discountData.family_id && discountData.student_id) {
            throw new Error('Cannot specify both family_id and student_id');
        }
        if (!discountData.family_id && !discountData.student_id) {
            throw new Error('Must specify either family_id or student_id');
        }

        const {data, error} = await this.getSupabase()
            .from('discount_codes')
            .insert({
                ...discountData,
                discount_value: discountData.discount_type === 'fixed_amount' 
                    ? toDollars(discountData.discount_value as Money)
                    : discountData.discount_value as number,
                created_by: createdBy,
                created_automatically: !createdBy, // If no creator, it's automatic
                valid_from: discountData.valid_from || new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create discount code: ${error.message}`);
        }

        // Map null to undefined for optional properties
        return {
            ...data,
            description: data.description ?? undefined,
            max_uses: data.max_uses ?? undefined,
            valid_until: data.valid_until ?? undefined,
            created_by: data.created_by ?? undefined,
            family_id: data.family_id ?? undefined,
            student_id: data.student_id ?? undefined,
            discount_type: data.discount_type as DiscountType,
            usage_type: data.usage_type as UsageType,
            applicable_to: data.applicable_to as ApplicableTo,
            scope: data.scope as DiscountScope,
            discount_value: (data.discount_type as DiscountType) === 'fixed_amount' 
                ? fromDollars(data.discount_value)
                : data.discount_value,
        };
    }

    /**
     * Update a discount code
     */
    static async updateDiscountCode(
        id: string,
        updates: UpdateDiscountCodeData
    ): Promise<DiscountCode> {
        const { discount_value, ...restUpdates } = updates;
        const updateData = {
            ...restUpdates,
            ...(discount_value !== undefined && {
                discount_value: updates.discount_type === 'fixed_amount' 
                    ? toDollars(discount_value as Money)
                    : discount_value as number
            })
        };
        
        const {data, error} = await this.getSupabase()
            .from('discount_codes')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update discount code: ${error.message}`);
        }

        // Map null to undefined for optional properties
        return {
            ...data,
            description: data.description ?? undefined,
            max_uses: data.max_uses ?? undefined,
            valid_until: data.valid_until ?? undefined,
            created_by: data.created_by ?? undefined,
            family_id: data.family_id ?? undefined,
            student_id: data.student_id ?? undefined,
            discount_type: data.discount_type as DiscountType,
            discount_value: data.discount_type === 'fixed_amount' 
                ? fromDollars(data.discount_value)
                : data.discount_value, // Convert from cents to Money only for fixed amounts
            usage_type: data.usage_type as UsageType,
            applicable_to: data.applicable_to as ApplicableTo,
            scope: data.scope as DiscountScope,
        };
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
            throw new Error(`Failed to deactivate discount code: ${error.message}`);
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
            throw new Error(`Failed to activate discount code: ${error.message}`);
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
            throw new Error(`Failed to delete discount code: ${error.message}`);
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
            throw new Error(`Failed to validate discount code: ${error.message}`);
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
                .select('*')
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
        const {data, error} = await (this.getSupabase() as ExtendedSupabaseClient)
            .from('discount_code_usage')
            .select(`
        *,
        discount_codes(
          code,
          name,
          discount_type,
          discount_value
        )
      `)
            .eq('family_id', familyId)
            .order('used_at', {ascending: false});

        if (error) {
            console.error('Error fetching family discount usage:', error);
            throw new Error('Failed to fetch family discount usage');
        }

        return (data || []).map((usage_db: Record<string, unknown>) => {
            const dc = usage_db.discount_codes as { discount_value: number; discount_type?: string } | undefined;
            return {
                ...usage_db,
                discount_amount: fromCents(usage_db.discount_amount as number),
                original_amount: fromCents(usage_db.original_amount as number),
                final_amount: fromCents(usage_db.final_amount as number),
                discount_codes: dc ? {
                    ...(usage_db.discount_codes as Record<string, unknown>),
                    discount_value: dc.discount_type === 'fixed_amount'
                        ? fromDollars(dc.discount_value)
                        : dc.discount_value
                } : undefined
            } as unknown as DiscountCodeUsage;
        }) as DiscountCodeUsage[];
    }

    /**
     * Get discount usage history for a student
     */
    static async getStudentDiscountUsage(studentId: string): Promise<DiscountCodeUsage[]> {
        const {data, error} = await (this.getSupabase() as ExtendedSupabaseClient)
            .from('discount_code_usage')
            .select(`
        *,
        discount_codes(
          code,
          name,
          discount_type,
          discount_value
        )
      `)
            .eq('student_id', studentId)
            .order('used_at', {ascending: false});

        if (error) {
            console.error('Error fetching student discount usage:', error);
            throw new Error('Failed to fetch student discount usage');
        }

        return (data || []).map((usage_db: Record<string, unknown>) => {
            const dc = usage_db.discount_codes as { discount_value: number; discount_type?: string } | undefined;
            return {
                ...usage_db,
                discount_amount: fromCents(usage_db.discount_amount as number),
                original_amount: fromCents(usage_db.original_amount as number),
                final_amount: fromCents(usage_db.final_amount as number),
                discount_codes: dc ? {
                    ...(usage_db.discount_codes as Record<string, unknown>),
                    discount_value: dc.discount_type === 'fixed_amount'
                        ? fromDollars(dc.discount_value)
                        : dc.discount_value
                } : undefined
            } as unknown as DiscountCodeUsage;
        }) as DiscountCodeUsage[];
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

        throw new Error('Failed to generate unique discount code after multiple attempts');
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
