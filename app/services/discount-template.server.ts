import type {
  DiscountTemplate,
  CreateDiscountTemplateData,
  UpdateDiscountTemplateData,
  CreateDiscountFromTemplateData,
  DiscountCode,
  DiscountType,
  UsageType,
  DiscountScope
} from '~/types/discount';
import { DiscountService } from './discount.server';
import { getSupabaseAdminClient } from '~/utils/supabase.server';
import type { Database } from '~/types/database.types';
import {fromCents, fromDollars, toCents, toDollars, type Money} from '~/utils/money';

let supabase: ReturnType<typeof getSupabaseAdminClient> | null = null;

function getSupabase() {
  if (!supabase) {
    supabase = getSupabaseAdminClient();
  }
  return supabase;
}

type DiscountTemplateRow = Database['public']['Tables']['discount_templates']['Row'] & {
  discount_value_cents?: number | null;
};

const toTemplateFixedAmountMoney = (value: Money | number): Money => {
  if (typeof value === 'number') {
    return fromDollars(value);
  }
  return value;
};

const buildTemplateDiscountValueWrite = (discountType: DiscountType, discountValue: Money | number) => {
  if (discountType === 'fixed_amount') {
    const moneyValue = toTemplateFixedAmountMoney(discountValue);
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

const normalizeDiscountTemplateRow = (row: DiscountTemplateRow): DiscountTemplate => {
  const discountType = row.discount_type as DiscountType;
  const fixedAmountCents = row.discount_value_cents ?? (discountType === 'fixed_amount'
    ? Math.round((row.discount_value ?? 0) * 100)
    : 0);

  return {
    ...row,
    discount_value: discountType === 'fixed_amount'
      ? fromCents(fixedAmountCents)
      : row.discount_value ?? 0,
    description: row.description ?? undefined,
    max_uses: row.max_uses ?? undefined,
    created_by: row.created_by ?? undefined,
    discount_type: discountType,
    usage_type: row.usage_type as UsageType,
    scope: row.scope as DiscountScope
  };
};

export class DiscountTemplateService {
  static async getAllTemplates(): Promise<DiscountTemplate[]> {
    const { data, error } = await getSupabase()
      .from('discount_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch discount templates: ${error.message}`);
    }

    return (data || []).map(normalizeDiscountTemplateRow);
  }

  static async getActiveTemplates(): Promise<DiscountTemplate[]> {
    const { data, error } = await getSupabase()
      .from('discount_templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active discount templates: ${error.message}`);
    }

    return (data || []).map(normalizeDiscountTemplateRow);
  }

  static async getTemplateById(id: string): Promise<DiscountTemplate | null> {
    const { data, error } = await getSupabase()
      .from('discount_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch discount template: ${error.message}`);
    }

    return normalizeDiscountTemplateRow(data);
  }

  static async createTemplate(
    templateData: CreateDiscountTemplateData,
    createdBy?: string
  ): Promise<DiscountTemplate> {
    const { discount_value, ...restData } = templateData;
    const valueWrite = buildTemplateDiscountValueWrite(templateData.discount_type, discount_value);

    const { data, error } = await getSupabase()
      .from('discount_templates')
      .insert({
        ...restData,
        ...valueWrite,
        created_by: createdBy
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create discount template: ${error.message}`);
    }

    return normalizeDiscountTemplateRow(data);
  }

  static async updateTemplate(
    id: string,
    updates: UpdateDiscountTemplateData
  ): Promise<DiscountTemplate> {
    const { discount_value, discount_type, ...restUpdates } = updates;
    const updateData: Record<string, unknown> = { ...restUpdates };
    let effectiveType = discount_type;

    if (discount_type !== undefined) {
      updateData.discount_type = discount_type;
    }

    if (discount_value !== undefined) {
      if (!effectiveType) {
        const existing = await this.getTemplateById(id);
        if (!existing) {
          throw new Error('Discount template not found');
        }
        effectiveType = existing.discount_type;
      }

      if (!effectiveType) {
        throw new Error('Discount type is required when updating discount value');
      }

      Object.assign(updateData, buildTemplateDiscountValueWrite(effectiveType, discount_value));
    }
    
    const { data, error } = await getSupabase()
      .from('discount_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update discount template: ${error.message}`);
    }

    return normalizeDiscountTemplateRow(data);
  }

  static async deleteTemplate(id: string): Promise<void> {
    const { error } = await getSupabase()
      .from('discount_templates')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete discount template: ${error.message}`);
    }
  }

  static async createDiscountFromTemplate(
    templateData: CreateDiscountFromTemplateData,
    createdBy?: string
  ): Promise<DiscountCode> {
    // First, get the template
    const template = await this.getTemplateById(templateData.template_id);
    if (!template) {
      throw new Error('Template not found');
    }

    // Validate association constraints based on template scope
    if (template.scope === 'per_family' && !templateData.family_id) {
      throw new Error('family_id is required when template scope is per_family');
    }
    if (template.scope === 'per_student' && !templateData.student_id) {
      throw new Error('student_id is required when template scope is per_student');
    }
    if (templateData.family_id && templateData.student_id) {
      throw new Error('Cannot specify both family_id and student_id');
    }

    // Generate code if not provided
    let code = templateData.code;
    if (!code) {
      code = await DiscountService.generateUniqueCode('TMPL', 6);
    }

    // Create discount code from template
    const discountCodeData = {
      code,
      name: templateData.name || template.name,
      description: template.description,
      discount_type: template.discount_type,
      discount_value: template.discount_value,
      usage_type: template.usage_type,
      max_uses: template.max_uses,
      applicable_to: template.applicable_to,
      scope: template.scope,
      family_id: templateData.family_id,
      student_id: templateData.student_id,
      valid_from: templateData.valid_from,
      valid_until: templateData.valid_until
    };

    return await DiscountService.createDiscountCode(discountCodeData, createdBy);
  }
}

// Export individual functions for easier importing
export const getAllDiscountTemplates = DiscountTemplateService.getAllTemplates;
export const getDiscountTemplateById = DiscountTemplateService.getTemplateById;
export const updateDiscountTemplate = DiscountTemplateService.updateTemplate;
export const deleteDiscountTemplate = DiscountTemplateService.deleteTemplate;
