import { createClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database.types';
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

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export class DiscountTemplateService {
  static async getAllTemplates(): Promise<DiscountTemplate[]> {
    const { data, error } = await supabase
      .from('discount_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch discount templates: ${error.message}`);
    }

    return (data || []).map(template => ({
      ...template,
      description: template.description ?? undefined,
      max_uses: template.max_uses ?? undefined,
      created_by: template.created_by ?? undefined,
      discount_type: template.discount_type as DiscountType,
      usage_type: template.usage_type as UsageType,
      scope: template.scope as DiscountScope
    }));
  }

  static async getActiveTemplates(): Promise<DiscountTemplate[]> {
    const { data, error } = await supabase
      .from('discount_templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active discount templates: ${error.message}`);
    }

    return (data || []).map(template => ({
      ...template,
      description: template.description ?? undefined,
      max_uses: template.max_uses ?? undefined,
      created_by: template.created_by ?? undefined,
      discount_type: template.discount_type as DiscountType,
      usage_type: template.usage_type as UsageType,
      scope: template.scope as DiscountScope
    }));
  }

  static async getTemplateById(id: string): Promise<DiscountTemplate | null> {
    const { data, error } = await supabase
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

    return {
      ...data,
      description: data.description ?? undefined,
      max_uses: data.max_uses ?? undefined,
      created_by: data.created_by ?? undefined,
      discount_type: data.discount_type as DiscountType,
      usage_type: data.usage_type as UsageType,
      scope: data.scope as DiscountScope
    };
  }

  static async createTemplate(
    templateData: CreateDiscountTemplateData,
    createdBy?: string
  ): Promise<DiscountTemplate> {
    const { data, error } = await supabase
      .from('discount_templates')
      .insert({
        ...templateData,
        created_by: createdBy
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create discount template: ${error.message}`);
    }

    return {
      ...data,
      description: data.description ?? undefined,
      max_uses: data.max_uses ?? undefined,
      created_by: data.created_by ?? undefined,
      discount_type: data.discount_type as DiscountType,
      usage_type: data.usage_type as UsageType,
      scope: data.scope as DiscountScope
    };
  }

  static async updateTemplate(
    id: string,
    updates: UpdateDiscountTemplateData
  ): Promise<DiscountTemplate> {
    const { data, error } = await supabase
      .from('discount_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update discount template: ${error.message}`);
    }

    return {
      ...data,
      description: data.description ?? undefined,
      max_uses: data.max_uses ?? undefined,
      created_by: data.created_by ?? undefined,
      discount_type: data.discount_type as DiscountType,
      usage_type: data.usage_type as UsageType,
      scope: data.scope as DiscountScope
    };
  }

  static async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase
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