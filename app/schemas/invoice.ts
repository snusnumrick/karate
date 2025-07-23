import { z } from 'zod';

// Enum schemas
export const InvoiceStatusSchema = z.enum(['draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled']);

export const InvoicePaymentMethodSchema = z.enum(['cash', 'check', 'bank_transfer', 'credit_card', 'ach', 'other']);

export const InvoiceItemTypeSchema = z.enum(['class_enrollment', 'individual_session', 'product', 'fee', 'discount', 'other']);

export const EntityTypeSchema = z.enum(['family', 'school', 'government', 'corporate', 'other']);

export const PaymentTermsSchema = z.enum(['Due on Receipt', 'Net 15', 'Net 30', 'Net 60', 'Net 90']);

// Base schemas
export const InvoiceEntitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(255),
  entity_type: EntityTypeSchema,
  contact_person: z.string().max(255).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address_line1: z.string().max(255).optional(),
  address_line2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(2).default('US'),
  tax_id: z.string().max(50).optional(),
  payment_terms: PaymentTermsSchema.default('Net 30'),
  credit_limit: z.number().min(0).optional(),
  is_active: z.boolean().default(true),
  notes: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const InvoiceLineItemSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  item_type: InvoiceItemTypeSchema,
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unit_price: z.number().min(0, 'Unit price must be non-negative'),
  line_total: z.number(),
  tax_rate: z.number().min(0).max(1).default(0),
  tax_amount: z.number().min(0).default(0),
  discount_rate: z.number().min(0).max(1).default(0),
  discount_amount: z.number().min(0).default(0),
  enrollment_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  service_period_start: z.string().optional(),
  service_period_end: z.string().optional(),
  sort_order: z.number().default(0),
  created_at: z.string(),
});

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  invoice_number: z.string().min(1),
  entity_id: z.string().uuid(),
  family_id: z.string().uuid().optional(),
  status: InvoiceStatusSchema.default('draft'),
  issue_date: z.string(),
  due_date: z.string(),
  service_period_start: z.string().optional(),
  service_period_end: z.string().optional(),
  subtotal: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  discount_amount: z.number().min(0).default(0),
  total_amount: z.number().min(0).default(0),
  amount_paid: z.number().min(0).default(0),
  amount_due: z.number().default(0),
  currency: z.string().length(3).default('USD'),
  notes: z.string().optional(),
  terms: z.string().optional(),
  footer_text: z.string().optional(),
  sent_at: z.string().optional(),
  viewed_at: z.string().optional(),
  paid_at: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const InvoicePaymentSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  payment_method: InvoicePaymentMethodSchema,
  amount: z.number().min(0.01, 'Payment amount must be greater than 0'),
  payment_date: z.string(),
  reference_number: z.string().max(100).optional(),
  notes: z.string().optional(),
  stripe_payment_intent_id: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Create/Update schemas (without generated fields)
export const CreateInvoiceEntitySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  entity_type: EntityTypeSchema,
  contact_person: z.string().max(255).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address_line1: z.string().max(255).optional(),
  address_line2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(2).default('US'),
  tax_id: z.string().max(50).optional(),
  payment_terms: PaymentTermsSchema.default('Net 30'),
  credit_limit: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const UpdateInvoiceEntitySchema = CreateInvoiceEntitySchema.partial().extend({
  id: z.string().uuid(),
});

export const CreateInvoiceLineItemSchema = z.object({
  item_type: InvoiceItemTypeSchema,
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unit_price: z.number().min(0, 'Unit price must be non-negative'),
  tax_rate: z.number().min(0).max(1).default(0),
  discount_rate: z.number().min(0).max(1).default(0),
  enrollment_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  service_period_start: z.string().optional(),
  service_period_end: z.string().optional(),
  sort_order: z.number().default(0),
}).refine((data) => {
  // Validate service period dates if both are provided
  if (data.service_period_start && data.service_period_end) {
    return new Date(data.service_period_start) <= new Date(data.service_period_end);
  }
  return true;
}, {
  message: 'Service period start date must be before or equal to end date',
  path: ['service_period_end'],
});

export const CreateInvoiceSchema = z.object({
  entity_id: z.string().uuid(),
  family_id: z.string().uuid().optional(),
  issue_date: z.string(),
  due_date: z.string(),
  service_period_start: z.string().optional(),
  service_period_end: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  footer_text: z.string().optional(),
  line_items: z.array(CreateInvoiceLineItemSchema).min(1, 'At least one line item is required'),
}).refine((data) => {
  // Validate that due date is after issue date
  return new Date(data.due_date) >= new Date(data.issue_date);
}, {
  message: 'Due date must be on or after issue date',
  path: ['due_date'],
}).refine((data) => {
  // Validate service period dates if both are provided
  if (data.service_period_start && data.service_period_end) {
    return new Date(data.service_period_start) <= new Date(data.service_period_end);
  }
  return true;
}, {
  message: 'Service period start date must be before or equal to end date',
  path: ['service_period_end'],
});

export const UpdateInvoiceSchema = z.object({
  id: z.string().uuid(),
  entity_id: z.string().uuid().optional(),
  family_id: z.string().uuid().optional(),
  status: InvoiceStatusSchema.optional(),
  issue_date: z.string().optional(),
  due_date: z.string().optional(),
  service_period_start: z.string().optional(),
  service_period_end: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  footer_text: z.string().optional(),
});

export const CreateInvoicePaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  payment_method: InvoicePaymentMethodSchema,
  amount: z.number().min(0.01, 'Payment amount must be greater than 0'),
  payment_date: z.string(),
  reference_number: z.string().max(100).optional(),
  notes: z.string().optional(),
  stripe_payment_intent_id: z.string().optional(),
});

// Filter schemas
export const InvoiceFiltersSchema = z.object({
  status: z.array(InvoiceStatusSchema).optional(),
  entity_id: z.string().uuid().optional(),
  family_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  amount_min: z.number().min(0).optional(),
  amount_max: z.number().min(0).optional(),
  search: z.string().optional(),
});

export const InvoiceEntityFiltersSchema = z.object({
  entity_type: z.array(EntityTypeSchema).optional(),
  is_active: z.boolean().optional(),
  search: z.string().optional(),
});

// Bulk operation schemas
export const BulkUpdateInvoiceStatusSchema = z.object({
  invoice_ids: z.array(z.string().uuid()).min(1, 'At least one invoice must be selected'),
  status: InvoiceStatusSchema,
  notes: z.string().optional(),
});

export const BulkDeleteInvoicesSchema = z.object({
  invoice_ids: z.array(z.string().uuid()).min(1, 'At least one invoice must be selected'),
});

// Template schemas
export const InvoiceLineItemTemplateSchema = z.object({
  item_type: InvoiceItemTypeSchema,
  description: z.string().min(1, 'Description is required'),
  unit_price: z.number().min(0, 'Unit price must be non-negative'),
  tax_rate: z.number().min(0).max(1).default(0),
  sort_order: z.number().default(0),
});

export const InvoiceTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  default_terms: z.string().optional(),
  default_footer: z.string().optional(),
  line_item_templates: z.array(InvoiceLineItemTemplateSchema),
});

// Export type inference helpers
export type CreateInvoiceEntityInput = z.infer<typeof CreateInvoiceEntitySchema>;
export type UpdateInvoiceEntityInput = z.infer<typeof UpdateInvoiceEntitySchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;
export type CreateInvoiceLineItemInput = z.infer<typeof CreateInvoiceLineItemSchema>;
export type CreateInvoicePaymentInput = z.infer<typeof CreateInvoicePaymentSchema>;
export type InvoiceFiltersInput = z.infer<typeof InvoiceFiltersSchema>;
export type InvoiceEntityFiltersInput = z.infer<typeof InvoiceEntityFiltersSchema>;
export type BulkUpdateInvoiceStatusInput = z.infer<typeof BulkUpdateInvoiceStatusSchema>;
export type InvoiceTemplateInput = z.infer<typeof InvoiceTemplateSchema>;