import type { Database } from './database.types';

export type DiscountType = 'fixed_amount' | 'percentage';
export type UsageType = 'one_time' | 'ongoing';
export type PaymentTypeEnum = Database['public']['Enums']['payment_type_enum'];
export type ApplicableTo = PaymentTypeEnum[];
export type DiscountScope = 'per_student' | 'per_family';

export interface DiscountCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  
  // Discount Type
  discount_type: DiscountType;
  discount_value: number; // In dollars for fixed_amount, percentage for percentage
  
  // Usage Restrictions
  usage_type: UsageType;
  max_uses?: number; // null = unlimited
  current_uses: number;
  
  // Applicability
  applicable_to: ApplicableTo;
  scope: DiscountScope;
  
  // Association (must be either family or student, not both)
  family_id?: string;
  student_id?: string;
  
  // Validity
  is_active: boolean;
  valid_from: string; // ISO timestamp
  valid_until?: string; // ISO timestamp
  
  // Creation tracking
  created_by?: string; // user id
  created_automatically: boolean;
  
  // Timestamps
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface DiscountCodeUsage {
  id: string;
  discount_code_id: string;
  payment_id: string;
  family_id: string;
  student_id: string | null; // null for family-wide discounts
  
  // Applied discount details (snapshot)
  discount_amount: number; // in cents
  original_amount: number; // in cents
  final_amount: number; // in cents
  
  used_at: string; // ISO timestamp
  discount_codes?: DiscountCode;
}

export interface DiscountValidationResult {
  is_valid: boolean;
  discount_code_id?: string;
  code?: string;
  discount_amount: number; // in cents
  error_message?: string;
}

export interface CreateDiscountCodeData {
  code: string;
  name: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  usage_type: UsageType;
  max_uses?: number;
  applicable_to: ApplicableTo;
  scope: DiscountScope;
  family_id?: string; // Required when scope is 'per_family'
  student_id?: string; // Required when scope is 'per_student'
  valid_from?: string; // ISO timestamp, defaults to now
  valid_until?: string; // ISO timestamp
}

export interface UpdateDiscountCodeData {
  code?: string;
  name?: string;
  description?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  usage_type?: UsageType;
  max_uses?: number;
  applicable_to?: ApplicableTo;
  scope?: DiscountScope;
  family_id?: string;
  student_id?: string;
  is_active?: boolean;
  valid_from?: string;
  valid_until?: string;
}

export interface ApplyDiscountRequest {
  code: string;
  family_id: string;
  student_id?: string;
  subtotal_amount: number; // in cents
  applicable_to: PaymentTypeEnum; // Single value for database function
}

export interface DiscountCodeWithUsage extends DiscountCode {
  usage_count?: number;
  recent_usage?: DiscountCodeUsage[];
  families?: {
    id: string;
    name: string;
  } | null;
  students?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  creator?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
  } | null;
}

// Discount Template Types
export interface DiscountTemplate {
  id: string;
  name: string;
  description?: string;
  
  // Template fields (same as discount code but without specific associations)
  discount_type: DiscountType;
  discount_value: number;
  usage_type: UsageType;
  max_uses?: number;
  applicable_to: ApplicableTo;
  scope: DiscountScope;
  
  // Template-specific fields
  is_active: boolean;
  
  // Creation tracking
  created_by?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CreateDiscountTemplateData {
  name: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  usage_type: UsageType;
  max_uses?: number;
  applicable_to: ApplicableTo;
  scope: DiscountScope;
}

export interface UpdateDiscountTemplateData {
  name?: string;
  description?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  usage_type?: UsageType;
  max_uses?: number;
  applicable_to?: ApplicableTo;
  scope?: DiscountScope;
  is_active?: boolean;
}

export interface CreateDiscountFromTemplateData {
  template_id: string;
  code?: string; // If not provided, will be auto-generated
  name?: string; // If not provided, will use template name
  family_id?: string;
  student_id?: string;
  valid_from?: string;
  valid_until?: string;
}