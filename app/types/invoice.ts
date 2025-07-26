// Invoice System Type Definitions

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';

export type InvoicePaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'credit_card' | 'ach' | 'other';

export type InvoiceItemType = 'class_enrollment' | 'individual_session' | 'product' | 'fee' | 'discount' | 'other';

export type EntityType = 'family' | 'school' | 'government' | 'corporate' | 'other';

export type PaymentTerms = 'Due on Receipt' | 'Net 15' | 'Net 30' | 'Net 60' | 'Net 90';

export interface InvoiceEntity {
  id: string;
  name: string;
  entity_type: EntityType;
  contact_person?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
  tax_id?: string;
  payment_terms: PaymentTerms;
  credit_limit?: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  entity_id: string;
  family_id?: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  service_period_start?: string;
  service_period_end?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  notes?: string;
  terms?: string;
  footer_text?: string;
  sent_at?: string;
  viewed_at?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  item_type: InvoiceItemType;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_rate: number;
  tax_amount: number;
  discount_rate: number;
  discount_amount: number;
  enrollment_id?: string;
  product_id?: string;
  service_period_start?: string;
  service_period_end?: string;
  sort_order: number;
  created_at: string;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  payment_method: InvoicePaymentMethod;
  amount: number;
  payment_date: string;
  reference_number?: string;
  notes?: string;
  stripe_payment_intent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceStatusHistory {
  id: string;
  invoice_id: string;
  old_status?: InvoiceStatus;
  new_status: InvoiceStatus;
  changed_by?: string;
  notes?: string;
  created_at: string;
}

// Extended types with relationships
export interface InvoiceWithDetails extends Invoice {
  entity: InvoiceEntity;
  line_items: InvoiceLineItem[];
  payments: InvoicePayment[];
  status_history: InvoiceStatusHistory[];
  family?: {
    id: string;
    name: string;
  };
}

export interface InvoiceEntityWithStats extends InvoiceEntity {
  total_invoices: number;
  total_amount: number;
  outstanding_amount: number;
  last_invoice_date?: string;
}

// Form types for creating/editing
export interface CreateInvoiceEntityData {
  name: string;
  entity_type: EntityType;
  contact_person?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  tax_id?: string;
  payment_terms?: PaymentTerms;
  credit_limit?: number;
  notes?: string;
}

export interface CreateInvoiceData {
  entity_id: string;
  family_id?: string;
  issue_date: string;
  due_date: string;
  service_period_start?: string;
  service_period_end?: string;
  notes?: string;
  terms?: string;
  footer_text?: string;
  line_items: CreateInvoiceLineItemData[];
}


/**
 * Represents the data structure for creating an invoice line item.
 *
 * This interface defines the properties needed to define a line item in an invoice, including details
 * such as item type, description, quantity, pricing, and optional attributes related to tax, discounts,
 * product or enrollment associations, service periods, and sort order.
 *
 * Properties:
 * - item_type: Specifies the type of the invoice item (e.g., product, service, fee).
 * - description: Provides a description of the line item.
 * - quantity: Indicates the quantity of the item.
 * - unit_price: Specifies the price per unit for the item.
 * - tax_rate: (Optional) The applicable tax rate for the item, represented as a percentage.
 * - discount_rate: (Optional) The applicable discount rate for the item, represented as a percentage.
 * - enrollment_id: (Optional) Links the line item to a specific enrollment, if applicable.
 * - product_id: (Optional) Identifies the associated product, if applicable.
 * - service_period_start: (Optional) Indicates the start date of the service period for the item, in ISO 8601 format.
 * - service_period_end: (Optional) Indicates the end date of the service period for the item, in ISO 8601 format.
 * - sort_order: (Optional) Defines the sort order of the item in the invoice, to control the display sequence.
 */
export interface CreateInvoiceLineItemData {
  item_type: InvoiceItemType;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  discount_rate?: number;
  enrollment_id?: string;
  product_id?: string;
  service_period_start?: string;
  service_period_end?: string;
  sort_order?: number;
}

export interface CreateInvoicePaymentData {
  invoice_id: string;
  payment_method: InvoicePaymentMethod;
  amount: number;
  payment_date: string;
  reference_number?: string;
  notes?: string;
  stripe_payment_intent_id?: string;
}

// Filter and search types
export interface InvoiceFilters {
  status?: InvoiceStatus[];
  entity_id?: string;
  family_id?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  search?: string;
}

export interface InvoiceEntityFilters {
  entity_type?: EntityType[];
  is_active?: boolean;
  search?: string;
}

// Calculation helpers
export interface InvoiceCalculations {
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
}

export interface LineItemCalculations {
  line_total: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
}

// Template types
export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  category: 'enrollment' | 'fees' | 'products' | 'custom';
  lineItems: CreateInvoiceLineItemData[];
  defaultTerms?: string;
  defaultNotes?: string;
  defaultFooter?: string;
}

export interface InvoiceLineItemTemplate {
  item_type: InvoiceItemType;
  description: string;
  unit_price: number;
  tax_rate?: number;
  sort_order: number;
}

// Error types
export interface InvoiceError {
  field?: string;
  message: string;
  code?: string;
}

export interface InvoiceValidationResult {
  isValid: boolean;
  errors: InvoiceError[];
}