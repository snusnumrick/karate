import { Database } from './database.types';
import type { Money } from '../utils/money';

// Override database types to return Money objects for monetary fields
export type DatabaseWithMoney = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: {

      
      // Override discount_codes table
      discount_codes: Omit<Database['public']['Tables']['discount_codes'], 'Row' | 'Insert' | 'Update'> & {
        Row: Omit<Database['public']['Tables']['discount_codes']['Row'], 'discount_value_cents'> & {
          discount_value_cents: Money;
        };
        Insert: Omit<Database['public']['Tables']['discount_codes']['Insert'], 'discount_value_cents'> & {
          discount_value_cents?: Money;
        };
        Update: Omit<Database['public']['Tables']['discount_codes']['Update'], 'discount_value_cents'> & {
          discount_value_cents?: Money;
        };
      };
      
      // Override event_registrations table
      event_registrations: Omit<Database['public']['Tables']['event_registrations'], 'Row' | 'Insert' | 'Update'> & {
        Row: Omit<Database['public']['Tables']['event_registrations']['Row'], 'payment_amount_cents'> & {
          payment_amount_cents: Money | null;
        };
        Insert: Omit<Database['public']['Tables']['event_registrations']['Insert'], 'payment_amount_cents'> & {
          payment_amount_cents?: Money | null;
        };
        Update: Omit<Database['public']['Tables']['event_registrations']['Update'], 'payment_amount_cents'> & {
          payment_amount_cents?: Money | null;
        };
      };
      
      // Override events table
      events: Omit<Database['public']['Tables']['events'], 'Row' | 'Insert' | 'Update'> & {
        Row: Omit<Database['public']['Tables']['events']['Row'], 'late_registration_fee' | 'registration_fee'> & {
          late_registration_fee: Money | null;
          registration_fee: Money | null;
        };
        Insert: Omit<Database['public']['Tables']['events']['Insert'], 'late_registration_fee' | 'registration_fee'> & {
          late_registration_fee?: Money | null;
          registration_fee?: Money | null;
        };
        Update: Omit<Database['public']['Tables']['events']['Update'], 'late_registration_fee' | 'registration_fee'> & {
          late_registration_fee?: Money | null;
          registration_fee?: Money | null;
        };
      };
      
      // Override invoice_line_items table
      invoice_line_items: Omit<Database['public']['Tables']['invoice_line_items'], 'Row' | 'Insert' | 'Update'> & {
        Row: Omit<Database['public']['Tables']['invoice_line_items']['Row'], 'discount_amount' | 'line_total' | 'tax_amount' | 'unit_price'> & {
          discount_amount: Money | null;
          line_total: Money;
          tax_amount: Money | null;
          unit_price: Money;
        };
        Insert: Omit<Database['public']['Tables']['invoice_line_items']['Insert'], 'discount_amount' | 'line_total' | 'tax_amount' | 'unit_price'> & {
          discount_amount?: Money | null;
          line_total: Money;
          tax_amount?: Money | null;
          unit_price: Money;
        };
        Update: Omit<Database['public']['Tables']['invoice_line_items']['Update'], 'discount_amount' | 'line_total' | 'tax_amount' | 'unit_price'> & {
          discount_amount?: Money | null;
          line_total?: Money;
          tax_amount?: Money | null;
          unit_price?: Money;
        };
      };
      
      // Override invoice_payments table
      invoice_payments: Omit<Database['public']['Tables']['invoice_payments'], 'Row' | 'Insert' | 'Update'> & {
        Row: Omit<Database['public']['Tables']['invoice_payments']['Row'], 'amount'> & {
          amount: Money;
        };
        Insert: Omit<Database['public']['Tables']['invoice_payments']['Insert'], 'amount'> & {
          amount: Money;
        };
        Update: Omit<Database['public']['Tables']['invoice_payments']['Update'], 'amount'> & {
          amount?: Money;
        };
      };
      
      // Override invoices table
      invoices: Omit<Database['public']['Tables']['invoices'], 'Row' | 'Insert' | 'Update'> & {
        Row: Omit<Database['public']['Tables']['invoices']['Row'], 'amount_due' | 'amount_paid' | 'discount_amount' | 'subtotal' | 'tax_amount' | 'total_amount'> & {
          amount_due: Money;
          amount_paid: Money;
          discount_amount: Money;
          subtotal: Money;
          tax_amount: Money;
          total_amount: Money;
        };
        Insert: Omit<Database['public']['Tables']['invoices']['Insert'], 'amount_due' | 'amount_paid' | 'discount_amount' | 'subtotal' | 'tax_amount' | 'total_amount'> & {
          amount_due?: Money;
          amount_paid?: Money;
          discount_amount?: Money;
          subtotal?: Money;
          tax_amount?: Money;
          total_amount?: Money;
        };
        Update: Omit<Database['public']['Tables']['invoices']['Update'], 'amount_due' | 'amount_paid' | 'discount_amount' | 'subtotal' | 'tax_amount' | 'total_amount'> & {
          amount_due?: Money;
          amount_paid?: Money;
          discount_amount?: Money;
          subtotal?: Money;
          tax_amount?: Money;
          total_amount?: Money;
        };
      };
      
      // Override order_items table
      order_items: Omit<Database['public']['Tables']['order_items'], 'Row' | 'Insert' | 'Update'> & {
        Row: Omit<Database['public']['Tables']['order_items']['Row'], 'price_per_item_cents'> & {
          price_per_item_cents: Money;
        };
        Insert: Omit<Database['public']['Tables']['order_items']['Insert'], 'price_per_item_cents'> & {
          price_per_item_cents: Money;
        };
        Update: Omit<Database['public']['Tables']['order_items']['Update'], 'price_per_item_cents'> & {
          price_per_item_cents?: Money;
        };
      };
      
      // Override orders table
      orders: Omit<Database['public']['Tables']['orders'], 'Row' | 'Insert' | 'Update'> & {
        Row: Omit<Database['public']['Tables']['orders']['Row'], 'total_amount_cents'> & {
          total_amount_cents: Money;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Insert'], 'total_amount_cents'> & {
          total_amount_cents: Money;
        };
        Update: Omit<Database['public']['Tables']['orders']['Update'], 'total_amount_cents'> & {
          total_amount_cents?: Money;
        };
      };
      
      // Override payments table
      payments: Omit<Database['public']['Tables']['payments'], 'Row' | 'Insert' | 'Update'> & {
        Row: Omit<Database['public']['Tables']['payments']['Row'], 'discount_amount' | 'subtotal_amount' | 'total_amount'> & {
          discount_amount: Money | null;
          subtotal_amount: Money;
          total_amount: Money;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Insert'], 'discount_amount' | 'subtotal_amount' | 'total_amount'> & {
          discount_amount?: Money | null;
          subtotal_amount: Money;
          total_amount: Money;
        };
        Update: Omit<Database['public']['Tables']['payments']['Update'], 'discount_amount' | 'subtotal_amount' | 'total_amount'> & {
          discount_amount?: Money | null;
          subtotal_amount?: Money;
          total_amount?: Money;
        };
      };
      
      // Override products table
      products: Omit<Database['public']['Tables']['products'], 'Row' | 'Insert' | 'Update'> & {
        Row: Omit<Database['public']['Tables']['products']['Row'], 'price_in_cents'> & {
          price_in_cents: Money;
        };
        Insert: Omit<Database['public']['Tables']['products']['Insert'], 'price_in_cents'> & {
          price_in_cents: Money;
        };
        Update: Omit<Database['public']['Tables']['products']['Update'], 'price_in_cents'> & {
          price_in_cents?: Money;
        };
      };
      
      // Override programs table
      programs: Omit<Database['public']['Tables']['programs'], 'Row' | 'Insert' | 'Update'> & {
        Row: Omit<Database['public']['Tables']['programs']['Row'], 'individual_session_fee' | 'monthly_fee' | 'registration_fee' | 'yearly_fee'> & {
          individual_session_fee: Money | null;
          monthly_fee: Money | null;
          registration_fee: Money | null;
          yearly_fee: Money | null;
        };
        Insert: Omit<Database['public']['Tables']['programs']['Insert'], 'individual_session_fee' | 'monthly_fee' | 'registration_fee' | 'yearly_fee'> & {
          individual_session_fee?: Money | null;
          monthly_fee?: Money | null;
          registration_fee?: Money | null;
          yearly_fee?: Money | null;
        };
        Update: Omit<Database['public']['Tables']['programs']['Update'], 'individual_session_fee' | 'monthly_fee' | 'registration_fee' | 'yearly_fee'> & {
          individual_session_fee?: Money | null;
          monthly_fee?: Money | null;
          registration_fee?: Money | null;
          yearly_fee?: Money | null;
        };
      };
      
      // Keep all other tables as-is
     } & Omit<Database['public']['Tables'], 
        'discount_codes' | 'event_registrations' | 'events' | 'invoice_line_items' | 
        'invoice_payments' | 'invoices' | 'order_items' | 'orders' | 'payments' | 
        'products' | 'programs'
      >;
  };
};

// Helper types for easier usage
export type TablesWithMoney<T extends keyof DatabaseWithMoney['public']['Tables']> = 
  DatabaseWithMoney['public']['Tables'][T]['Row'];

export type TablesInsertWithMoney<T extends keyof DatabaseWithMoney['public']['Tables']> = 
  DatabaseWithMoney['public']['Tables'][T]['Insert'];

export type TablesUpdateWithMoney<T extends keyof DatabaseWithMoney['public']['Tables']> = 
  DatabaseWithMoney['public']['Tables'][T]['Update'];