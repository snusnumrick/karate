import { SupabaseClient } from '@supabase/supabase-js';
import type { InvoiceTemplate, CreateInvoiceLineItemData } from '~/types/invoice';

export interface DatabaseInvoiceTemplate {
  id: string;
  name: string;
  description: string | null;
  category: 'enrollment' | 'fees' | 'products' | 'custom';
  is_active: boolean;
  is_system_template: boolean;
  created_by: string | null;
  default_terms: string | null;
  default_notes: string | null;
  default_footer: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseInvoiceTemplateLineItem {
  id: string;
  template_id: string;
  item_type: 'class_enrollment' | 'individual_session' | 'product' | 'fee' | 'discount' | 'other';
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_rate: number;
  service_period_start: string | null;
  service_period_end: string | null;
  sort_order: number;
  created_at: string;
}

export class InvoiceTemplateService {
  constructor(private supabase: SupabaseClient) {}

  async getAllTemplates(): Promise<InvoiceTemplate[]> {
    const { data: templates, error: templatesError } = await this.supabase
      .from('invoice_templates')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (templatesError) {
      throw new Error(`Failed to fetch templates: ${templatesError.message}`);
    }

    if (!templates || templates.length === 0) {
      return [];
    }

    const { data: lineItems, error: lineItemsError } = await this.supabase
      .from('invoice_template_line_items')
      .select('*')
      .in('template_id', templates.map(t => t.id))
      .order('sort_order', { ascending: true });

    if (lineItemsError) {
      throw new Error(`Failed to fetch template line items: ${lineItemsError.message}`);
    }

    return templates.map(template => this.mapToInvoiceTemplate(template, lineItems || []));
  }

  async getTemplateById(id: string): Promise<InvoiceTemplate | null> {
    const { data: template, error: templateError } = await this.supabase
      .from('invoice_templates')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      return null;
    }

    const { data: lineItems, error: lineItemsError } = await this.supabase
      .from('invoice_template_line_items')
      .select('*')
      .eq('template_id', id)
      .order('sort_order', { ascending: true });

    if (lineItemsError) {
      throw new Error(`Failed to fetch template line items: ${lineItemsError.message}`);
    }

    return this.mapToInvoiceTemplate(template, lineItems || []);
  }

  async getTemplatesByCategory(category: InvoiceTemplate['category']): Promise<InvoiceTemplate[]> {
    const { data: templates, error: templatesError } = await this.supabase
      .from('invoice_templates')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (templatesError) {
      throw new Error(`Failed to fetch templates by category: ${templatesError.message}`);
    }

    if (!templates || templates.length === 0) {
      return [];
    }

    const { data: lineItems, error: lineItemsError } = await this.supabase
      .from('invoice_template_line_items')
      .select('*')
      .in('template_id', templates.map(t => t.id))
      .order('sort_order', { ascending: true });

    if (lineItemsError) {
      throw new Error(`Failed to fetch template line items: ${lineItemsError.message}`);
    }

    return templates.map(template => this.mapToInvoiceTemplate(template, lineItems || []));
  }

  async searchTemplates(query: string): Promise<InvoiceTemplate[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    
    const { data: templates, error: templatesError } = await this.supabase
      .from('invoice_templates')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
      .order('name', { ascending: true });

    if (templatesError) {
      throw new Error(`Failed to search templates: ${templatesError.message}`);
    }

    if (!templates || templates.length === 0) {
      return [];
    }

    const { data: lineItems, error: lineItemsError } = await this.supabase
      .from('invoice_template_line_items')
      .select('*')
      .in('template_id', templates.map(t => t.id))
      .order('sort_order', { ascending: true });

    if (lineItemsError) {
      throw new Error(`Failed to fetch template line items: ${lineItemsError.message}`);
    }

    return templates.map(template => this.mapToInvoiceTemplate(template, lineItems || []));
  }

  async createTemplate(
    templateData: Omit<DatabaseInvoiceTemplate, 'id' | 'created_at' | 'updated_at'>,
    lineItems: Omit<DatabaseInvoiceTemplateLineItem, 'id' | 'template_id' | 'created_at'>[]
  ): Promise<InvoiceTemplate> {
    const { data: template, error: templateError } = await this.supabase
      .from('invoice_templates')
      .insert(templateData)
      .select()
      .single();

    if (templateError || !template) {
      throw new Error(`Failed to create template: ${templateError?.message}`);
    }

    if (lineItems.length > 0) {
      const lineItemsWithTemplateId = lineItems.map(item => ({
        ...item,
        template_id: template.id
      }));

      const { error: lineItemsError } = await this.supabase
        .from('invoice_template_line_items')
        .insert(lineItemsWithTemplateId);

      if (lineItemsError) {
        // Rollback template creation
        await this.supabase.from('invoice_templates').delete().eq('id', template.id);
        throw new Error(`Failed to create template line items: ${lineItemsError.message}`);
      }
    }

    // Fetch the complete template with line items
    const createdTemplate = await this.getTemplateById(template.id);
    if (!createdTemplate) {
      throw new Error('Failed to fetch created template');
    }

    return createdTemplate;
  }

  async updateTemplate(
    id: string,
    templateData: Partial<Omit<DatabaseInvoiceTemplate, 'id' | 'created_at' | 'updated_at'>>,
    lineItems?: Omit<DatabaseInvoiceTemplateLineItem, 'id' | 'template_id' | 'created_at'>[]
  ): Promise<InvoiceTemplate> {
    const { data: template, error: templateError } = await this.supabase
      .from('invoice_templates')
      .update(templateData)
      .eq('id', id)
      .select()
      .single();

    if (templateError || !template) {
      throw new Error(`Failed to update template: ${templateError?.message}`);
    }

    if (lineItems) {
      // Delete existing line items
      const { error: deleteError } = await this.supabase
        .from('invoice_template_line_items')
        .delete()
        .eq('template_id', id);

      if (deleteError) {
        throw new Error(`Failed to delete existing line items: ${deleteError.message}`);
      }

      // Insert new line items
      if (lineItems.length > 0) {
        const lineItemsWithTemplateId = lineItems.map(item => ({
          ...item,
          template_id: id
        }));

        const { error: insertError } = await this.supabase
          .from('invoice_template_line_items')
          .insert(lineItemsWithTemplateId);

        if (insertError) {
          throw new Error(`Failed to insert new line items: ${insertError.message}`);
        }
      }
    }

    // Fetch the updated template with line items
    const updatedTemplate = await this.getTemplateById(id);
    if (!updatedTemplate) {
      throw new Error('Failed to fetch updated template');
    }

    return updatedTemplate;
  }

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('invoice_templates')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  private mapToInvoiceTemplate(
    dbTemplate: DatabaseInvoiceTemplate,
    allLineItems: DatabaseInvoiceTemplateLineItem[]
  ): InvoiceTemplate {
    const templateLineItems = allLineItems
      .filter(item => item.template_id === dbTemplate.id)
      .map(item => this.mapToCreateInvoiceLineItemData(item));

    return {
      id: dbTemplate.id,
      name: dbTemplate.name,
      description: dbTemplate.description || '',
      category: dbTemplate.category,
      lineItems: templateLineItems,
      defaultTerms: dbTemplate.default_terms || undefined,
      defaultNotes: dbTemplate.default_notes || undefined,
      defaultFooter: dbTemplate.default_footer || undefined,
    };
  }

  private mapToCreateInvoiceLineItemData(
    dbLineItem: DatabaseInvoiceTemplateLineItem
  ): CreateInvoiceLineItemData {
    return {
      item_type: dbLineItem.item_type,
      description: dbLineItem.description,
      quantity: dbLineItem.quantity,
      unit_price: dbLineItem.unit_price,
      tax_rate: dbLineItem.tax_rate,
      discount_rate: dbLineItem.discount_rate,
      service_period_start: dbLineItem.service_period_start || undefined,
      service_period_end: dbLineItem.service_period_end || undefined,
      sort_order: dbLineItem.sort_order
    };
  }
}

export function getTemplateCategories(): Array<{ value: InvoiceTemplate['category']; label: string }> {
  return [
    { value: 'enrollment', label: 'Class Enrollments' },
    { value: 'fees', label: 'Fees & Testing' },
    { value: 'products', label: 'Products & Equipment' },
    { value: 'custom', label: 'Custom Templates' }
  ];
}