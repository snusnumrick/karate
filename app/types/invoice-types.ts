import { Database } from './database.types';

// Base invoice type from database
type BaseInvoice = Database['public']['Tables']['invoices']['Row'];

// Invoice type with calculated fields marked as readonly
export type Invoice = Omit<BaseInvoice, 
  'amount_paid' | 'amount_paid_cents' | 'amount_due' | 'amount_due_cents' |
  'subtotal' | 'subtotal_cents' | 'tax_amount' | 'tax_amount_cents' |
  'discount_amount' | 'discount_amount_cents' | 'total_amount' | 'total_amount_cents'
> & {
  // Calculated fields - readonly (managed by database triggers)
  readonly amount_paid: number;
  readonly amount_paid_cents: number;
  readonly amount_due: number;
  readonly amount_due_cents: number;
  readonly subtotal: number;
  readonly subtotal_cents: number;
  readonly tax_amount: number;
  readonly tax_amount_cents: number;
  readonly discount_amount: number;
  readonly discount_amount_cents: number;
  readonly total_amount: number;
  readonly total_amount_cents: number;
};

// Insert type - excludes calculated fields entirely
export type InvoiceInsert = Omit<Database['public']['Tables']['invoices']['Insert'],
  'amount_paid' | 'amount_paid_cents' | 'amount_due' | 'amount_due_cents' |
  'subtotal' | 'subtotal_cents' | 'tax_amount' | 'tax_amount_cents' |
  'discount_amount' | 'discount_amount_cents' | 'total_amount' | 'total_amount_cents'
>;

// Update type - excludes calculated fields entirely
export type InvoiceUpdate = Omit<Database['public']['Tables']['invoices']['Update'],
  'amount_paid' | 'amount_paid_cents' | 'amount_due' | 'amount_due_cents' |
  'subtotal' | 'subtotal_cents' | 'tax_amount' | 'tax_amount_cents' |
  'discount_amount' | 'discount_amount_cents' | 'total_amount' | 'total_amount_cents'
>;

// Invoice payment types (already updated in database.types.ts)
export type InvoicePayment = Database['public']['Tables']['invoice_payments']['Row'];
export type InvoicePaymentInsert = Database['public']['Tables']['invoice_payments']['Insert'];
export type InvoicePaymentUpdate = Database['public']['Tables']['invoice_payments']['Update'];