/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
import { type SupabaseClient } from '@supabase/supabase-js';

// Extend the SupabaseClient interface to include the global property
import type { Database } from './database.types';

declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    global: {
      headers: Record<string, string>;
    };
  }
}

// Extended database types for missing tables
export interface ExtendedDatabase extends Database {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      discount_codes: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          discount_type: 'fixed_amount' | 'percentage';
          discount_value: number;
          usage_type: 'one_time' | 'ongoing';
          max_uses: number | null;
          current_uses: number;
          applicable_to: Database['public']['Enums']['payment_type_enum'][];
          scope: 'per_student' | 'per_family';
          is_active: boolean;
          valid_from: string;
          valid_until: string | null;
          created_by: string | null;
          created_automatically: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          discount_type: 'fixed_amount' | 'percentage';
          discount_value: number;
          usage_type: 'one_time' | 'ongoing';
          max_uses?: number | null;
          current_uses?: number;
          applicable_to: Database['public']['Enums']['payment_type_enum'][];
          scope: 'per_student' | 'per_family';
          is_active?: boolean;
          valid_from?: string;
          valid_until?: string | null;
          created_by?: string | null;
          created_automatically?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          discount_type?: 'fixed_amount' | 'percentage';
          discount_value?: number;
          usage_type?: 'one_time' | 'ongoing';
          max_uses?: number | null;
          current_uses?: number;
          applicable_to?: Database['public']['Enums']['payment_type_enum'][];
          scope?: 'per_student' | 'per_family';
          is_active?: boolean;
          valid_from?: string;
          valid_until?: string | null;
          created_by?: string | null;
          created_automatically?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discount_codes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      discount_code_usage: {
        Row: {
          id: string;
          discount_code_id: string;
          payment_id: string;
          family_id: string;
          student_id: string | null;
          discount_amount: number;
          original_amount: number;
          final_amount: number;
          used_at: string;
        };
        Insert: {
          id?: string;
          discount_code_id: string;
          payment_id: string;
          family_id: string;
          student_id?: string | null;
          discount_amount: number;
          original_amount: number;
          final_amount: number;
          used_at?: string;
        };
        Update: {
          id?: string;
          discount_code_id?: string;
          payment_id?: string;
          family_id?: string;
          student_id?: string | null;
          discount_amount?: number;
          original_amount?: number;
          final_amount?: number;
          used_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discount_code_usage_discount_code_id_fkey";
            columns: ["discount_code_id"];
            isOneToOne: false;
            referencedRelation: "discount_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discount_code_usage_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discount_code_usage_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discount_code_usage_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
    };
  };
}

// Type for Supabase client with extended database
export type ExtendedSupabaseClient = import('@supabase/supabase-js').SupabaseClient<ExtendedDatabase>;