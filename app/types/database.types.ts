export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          class_date: string
          id: string
          notes: string | null
          present: boolean
          student_id: string
        }
        Insert: {
          class_date: string
          id?: string
          notes?: string | null
          present: boolean
          student_id: string
        }
        Update: {
          class_date?: string
          id?: string
          notes?: string | null
          present?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rule_discount_templates: {
        Row: {
          automation_rule_id: string
          created_at: string
          discount_template_id: string
          id: string
          sequence_order: number
        }
        Insert: {
          automation_rule_id: string
          created_at?: string
          discount_template_id: string
          id?: string
          sequence_order?: number
        }
        Update: {
          automation_rule_id?: string
          created_at?: string
          discount_template_id?: string
          id?: string
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_rule_discount_templates_automation_rule_id_fkey"
            columns: ["automation_rule_id"]
            isOneToOne: false
            referencedRelation: "discount_automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rule_discount_templates_discount_template_id_fkey"
            columns: ["discount_template_id"]
            isOneToOne: false
            referencedRelation: "discount_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      belt_awards: {
        Row: {
          awarded_date: string
          description: string | null
          id: string
          student_id: string
          type: Database["public"]["Enums"]["belt_rank_enum"]
        }
        Insert: {
          awarded_date: string
          description?: string | null
          id?: string
          student_id: string
          type: Database["public"]["Enums"]["belt_rank_enum"]
        }
        Update: {
          awarded_date?: string
          description?: string | null
          id?: string
          student_id?: string
          type?: Database["public"]["Enums"]["belt_rank_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "achievements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          id: string
          start_time: string
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          id?: string
          start_time: string
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          id?: string
          start_time?: string
        }
        Relationships: []
      }
      class_sessions: {
        Row: {
          class_id: string
          created_at: string
          end_time: string
          id: string
          instructor_id: string | null
          notes: string | null
          session_date: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          end_time: string
          id?: string
          instructor_id?: string | null
          notes?: string | null
          session_date: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          end_time?: string
          id?: string
          instructor_id?: string | null
          notes?: string | null
          session_date?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          instructor_id: string | null
          is_active: boolean
          max_capacity: number | null
          name: string
          program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          max_capacity?: number | null
          name: string
          program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          max_capacity?: number | null
          name?: string
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      discount_assignments: {
        Row: {
          assigned_at: string
          automation_rule_id: string
          discount_code_id: string
          discount_event_id: string
          expires_at: string | null
          family_id: string | null
          id: string
          student_id: string | null
        }
        Insert: {
          assigned_at?: string
          automation_rule_id: string
          discount_code_id: string
          discount_event_id: string
          expires_at?: string | null
          family_id?: string | null
          id?: string
          student_id?: string | null
        }
        Update: {
          assigned_at?: string
          automation_rule_id?: string
          discount_code_id?: string
          discount_event_id?: string
          expires_at?: string | null
          family_id?: string | null
          id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_assignments_automation_rule_id_fkey"
            columns: ["automation_rule_id"]
            isOneToOne: false
            referencedRelation: "discount_automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_assignments_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_assignments_discount_event_id_fkey"
            columns: ["discount_event_id"]
            isOneToOne: false
            referencedRelation: "discount_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_assignments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_automation_rules: {
        Row: {
          applicable_programs: string[] | null
          conditions: Json | null
          created_at: string
          description: string | null
          discount_template_id: string
          event_type: Database["public"]["Enums"]["discount_event_type"]
          id: string
          is_active: boolean
          max_uses_per_student: number | null
          name: string
          updated_at: string
          uses_multiple_templates: boolean
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_programs?: string[] | null
          conditions?: Json | null
          created_at?: string
          description?: string | null
          discount_template_id: string
          event_type: Database["public"]["Enums"]["discount_event_type"]
          id?: string
          is_active?: boolean
          max_uses_per_student?: number | null
          name: string
          updated_at?: string
          uses_multiple_templates?: boolean
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_programs?: string[] | null
          conditions?: Json | null
          created_at?: string
          description?: string | null
          discount_template_id?: string
          event_type?: Database["public"]["Enums"]["discount_event_type"]
          id?: string
          is_active?: boolean
          max_uses_per_student?: number | null
          name?: string
          updated_at?: string
          uses_multiple_templates?: boolean
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_automation_rules_discount_template_id_fkey"
            columns: ["discount_template_id"]
            isOneToOne: false
            referencedRelation: "discount_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_code_usage: {
        Row: {
          discount_amount: number
          discount_code_id: string
          family_id: string
          final_amount: number
          id: string
          original_amount: number
          payment_id: string
          student_id: string | null
          used_at: string
        }
        Insert: {
          discount_amount: number
          discount_code_id: string
          family_id: string
          final_amount: number
          id?: string
          original_amount: number
          payment_id: string
          student_id?: string | null
          used_at?: string
        }
        Update: {
          discount_amount?: number
          discount_code_id?: string
          family_id?: string
          final_amount?: number
          id?: string
          original_amount?: number
          payment_id?: string
          student_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_usage_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_usage_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_usage_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_usage_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          applicable_to: Database["public"]["Enums"]["payment_type_enum"][]
          code: string
          created_at: string
          created_automatically: boolean
          created_by: string | null
          current_uses: number
          description: string | null
          discount_type: string
          discount_value: number
          family_id: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          name: string
          scope: string
          student_id: string | null
          updated_at: string
          usage_type: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          applicable_to: Database["public"]["Enums"]["payment_type_enum"][]
          code: string
          created_at?: string
          created_automatically?: boolean
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_type: string
          discount_value: number
          family_id?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name: string
          scope: string
          student_id?: string | null
          updated_at?: string
          usage_type: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          applicable_to?: Database["public"]["Enums"]["payment_type_enum"][]
          code?: string
          created_at?: string
          created_automatically?: boolean
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          family_id?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name?: string
          scope?: string
          student_id?: string | null
          updated_at?: string
          usage_type?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_codes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: Database["public"]["Enums"]["discount_event_type"]
          family_id: string | null
          id: string
          processed_at: string | null
          student_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: Database["public"]["Enums"]["discount_event_type"]
          family_id?: string | null
          id?: string
          processed_at?: string | null
          student_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: Database["public"]["Enums"]["discount_event_type"]
          family_id?: string | null
          id?: string
          processed_at?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_templates: {
        Row: {
          applicable_to: Database["public"]["Enums"]["payment_type_enum"][]
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          name: string
          scope: string
          updated_at: string
          usage_type: string
        }
        Insert: {
          applicable_to: Database["public"]["Enums"]["payment_type_enum"][]
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name: string
          scope: string
          updated_at?: string
          usage_type: string
        }
        Update: {
          applicable_to?: Database["public"]["Enums"]["payment_type_enum"][]
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name?: string
          scope?: string
          updated_at?: string
          usage_type?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          class_id: string
          completed_at: string | null
          created_at: string
          dropped_at: string | null
          enrolled_at: string
          id: string
          notes: string | null
          program_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          completed_at?: string | null
          created_at?: string
          dropped_at?: string | null
          enrolled_at?: string
          id?: string
          notes?: string | null
          program_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          completed_at?: string | null
          created_at?: string
          dropped_at?: string | null
          enrolled_at?: string
          id?: string
          notes?: string | null
          program_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          address: string
          city: string
          created_at: string | null
          email: string
          emergency_contact: string | null
          health_info: string | null
          id: string
          name: string
          notes: string | null
          postal_code: string
          primary_phone: string
          province: string
          referral_name: string | null
          referral_source: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string | null
          email: string
          emergency_contact?: string | null
          health_info?: string | null
          id?: string
          name: string
          notes?: string | null
          postal_code: string
          primary_phone: string
          province: string
          referral_name?: string | null
          referral_source?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string | null
          email?: string
          emergency_contact?: string | null
          health_info?: string | null
          id?: string
          name?: string
          notes?: string | null
          postal_code?: string
          primary_phone?: string
          province?: string
          referral_name?: string | null
          referral_source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      guardians: {
        Row: {
          cell_phone: string
          email: string
          employer: string | null
          employer_notes: string | null
          employer_phone: string | null
          family_id: string
          first_name: string
          home_phone: string | null
          id: string
          last_name: string
          relationship: string
          work_phone: string | null
        }
        Insert: {
          cell_phone: string
          email: string
          employer?: string | null
          employer_notes?: string | null
          employer_phone?: string | null
          family_id: string
          first_name: string
          home_phone?: string | null
          id?: string
          last_name: string
          relationship: string
          work_phone?: string | null
        }
        Update: {
          cell_phone?: string
          email?: string
          employer?: string | null
          employer_notes?: string | null
          employer_phone?: string | null
          family_id?: string
          first_name?: string
          home_phone?: string | null
          id?: string
          last_name?: string
          relationship?: string
          work_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardians_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      one_on_one_session_usage: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          recorded_by: string | null
          session_purchase_id: string
          student_id: string
          usage_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          session_purchase_id: string
          student_id: string
          usage_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          session_purchase_id?: string
          student_id?: string
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_on_one_session_usage_session_purchase_id_fkey"
            columns: ["session_purchase_id"]
            isOneToOne: false
            referencedRelation: "one_on_one_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_session_usage_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      one_on_one_sessions: {
        Row: {
          created_at: string
          family_id: string
          id: string
          payment_id: string
          purchase_date: string
          quantity_purchased: number
          quantity_remaining: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          payment_id: string
          purchase_date?: string
          quantity_purchased: number
          quantity_remaining: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          payment_id?: string
          purchase_date?: string
          quantity_purchased?: number
          quantity_remaining?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_on_one_sessions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_sessions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price_per_item_cents: number
          product_variant_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price_per_item_cents: number
          product_variant_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price_per_item_cents?: number
          product_variant_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          family_id: string
          id: string
          order_date: string
          pickup_notes: string | null
          status: Database["public"]["Enums"]["order_status"]
          student_id: string | null
          total_amount_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          order_date?: string
          pickup_notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          student_id?: string | null
          total_amount_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          order_date?: string
          pickup_notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          student_id?: string | null
          total_amount_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_students: {
        Row: {
          id: string
          payment_id: string
          student_id: string
        }
        Insert: {
          id?: string
          payment_id: string
          student_id: string
        }
        Update: {
          id?: string
          payment_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_students_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_taxes: {
        Row: {
          created_at: string
          id: string
          payment_id: string
          tax_amount: number
          tax_description_snapshot: string | null
          tax_name_snapshot: string
          tax_rate_id: string
          tax_rate_snapshot: number
        }
        Insert: {
          created_at?: string
          id?: string
          payment_id: string
          tax_amount: number
          tax_description_snapshot?: string | null
          tax_name_snapshot: string
          tax_rate_id: string
          tax_rate_snapshot: number
        }
        Update: {
          created_at?: string
          id?: string
          payment_id?: string
          tax_amount?: number
          tax_description_snapshot?: string | null
          tax_name_snapshot?: string
          tax_rate_id?: string
          tax_rate_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_taxes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_taxes_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          card_last4: string | null
          created_at: string | null
          discount_amount: number | null
          discount_code_id: string | null
          family_id: string
          id: string
          notes: string | null
          order_id: string | null
          payment_date: string | null
          payment_method: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal_amount: number
          total_amount: number
          type: Database["public"]["Enums"]["payment_type_enum"]
          updated_at: string | null
        }
        Insert: {
          card_last4?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_code_id?: string | null
          family_id: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_amount: number
          total_amount: number
          type?: Database["public"]["Enums"]["payment_type_enum"]
          updated_at?: string | null
        }
        Update: {
          card_last4?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_code_id?: string | null
          family_id?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_amount?: number
          total_amount?: number
          type?: Database["public"]["Enums"]["payment_type_enum"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_agreements: {
        Row: {
          attire_agreement: boolean
          code_of_conduct: boolean
          family_id: string
          full_name: string
          id: string
          liability_release: boolean
          payment_policy: boolean
          photo_release: boolean
          signature_date: string
        }
        Insert: {
          attire_agreement: boolean
          code_of_conduct: boolean
          family_id: string
          full_name: string
          id?: string
          liability_release: boolean
          payment_policy: boolean
          photo_release: boolean
          signature_date?: string
        }
        Update: {
          attire_agreement?: boolean
          code_of_conduct?: boolean
          family_id?: string
          full_name?: string
          id?: string
          liability_release?: boolean
          payment_policy?: boolean
          photo_release?: boolean
          signature_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_agreements_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          price_in_cents: number
          product_id: string
          size: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          price_in_cents: number
          product_id: string
          size: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          price_in_cents?: number
          product_id?: string
          size?: string
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          email: string
          family_id: string | null
          first_name: string | null
          id: string
          last_name: string | null
          role: string
        }
        Insert: {
          email: string
          family_id?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          role?: string
        }
        Update: {
          email?: string
          family_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          gender_restriction: string | null
          id: string
          individual_session_fee: number | null
          is_active: boolean
          max_age: number | null
          min_age: number | null
          monthly_fee: number | null
          name: string
          registration_fee: number | null
          special_needs_support: boolean | null
          updated_at: string
          yearly_fee: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          gender_restriction?: string | null
          id?: string
          individual_session_fee?: number | null
          is_active?: boolean
          max_age?: number | null
          min_age?: number | null
          monthly_fee?: number | null
          name: string
          registration_fee?: number | null
          special_needs_support?: boolean | null
          updated_at?: string
          yearly_fee?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          gender_restriction?: string | null
          id?: string
          individual_session_fee?: number | null
          is_active?: boolean
          max_age?: number | null
          min_age?: number | null
          monthly_fee?: number | null
          name?: string
          registration_fee?: number | null
          special_needs_support?: boolean | null
          updated_at?: string
          yearly_fee?: number | null
        }
        Relationships: []
      }
      students: {
        Row: {
          allergies: string | null
          birth_date: string
          cell_phone: string | null
          email: string | null
          family_id: string
          first_name: string
          gender: string
          grade_level: string | null
          id: string
          immunization_notes: string | null
          immunizations_up_to_date: string | null
          last_name: string
          medications: string | null
          school: string
          special_needs: string | null
          t_shirt_size: string
        }
        Insert: {
          allergies?: string | null
          birth_date: string
          cell_phone?: string | null
          email?: string | null
          family_id: string
          first_name: string
          gender: string
          grade_level?: string | null
          id?: string
          immunization_notes?: string | null
          immunizations_up_to_date?: string | null
          last_name: string
          medications?: string | null
          school: string
          special_needs?: string | null
          t_shirt_size: string
        }
        Update: {
          allergies?: string | null
          birth_date?: string
          cell_phone?: string | null
          email?: string | null
          family_id?: string
          first_name?: string
          gender?: string
          grade_level?: string | null
          id?: string
          immunization_notes?: string | null
          immunizations_up_to_date?: string | null
          last_name?: string
          medications?: string | null
          school?: string
          special_needs?: string | null
          t_shirt_size?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          rate: number
          region: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          rate: number
          region?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rate?: number
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      waiver_signatures: {
        Row: {
          agreement_version: string
          id: string
          signature_data: string
          signed_at: string
          user_id: string
          waiver_id: string
        }
        Insert: {
          agreement_version: string
          id?: string
          signature_data: string
          signed_at?: string
          user_id: string
          waiver_id: string
        }
        Update: {
          agreement_version?: string
          id?: string
          signature_data?: string
          signed_at?: string
          user_id?: string
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiver_signatures_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      waivers: {
        Row: {
          content: string
          description: string
          id: string
          required: boolean
          title: string
        }
        Insert: {
          content: string
          description: string
          id?: string
          required?: boolean
          title: string
        }
        Update: {
          content?: string
          description?: string
          id?: string
          required?: boolean
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      family_one_on_one_balance: {
        Row: {
          family_id: string | null
          total_remaining_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "one_on_one_sessions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      complete_new_user_registration: {
        Args: {
          p_user_id: string
          p_family_name: string
          p_address: string
          p_city: string
          p_province: string
          p_postal_code: string
          p_primary_phone: string
          p_user_email: string
          p_referral_source?: string
          p_referral_name?: string
          p_emergency_contact?: string
          p_health_info?: string
          p_contact1_first_name?: string
          p_contact1_last_name?: string
          p_contact1_type?: string
          p_contact1_home_phone?: string
          p_contact1_work_phone?: string
          p_contact1_cell_phone?: string
        }
        Returns: string
      }
      count_successful_student_payments: {
        Args: { p_student_id: string }
        Returns: number
      }
      create_admin_initiated_conversation: {
        Args: {
          p_sender_id: string
          p_target_family_id: string
          p_subject: string
          p_message_body: string
        }
        Returns: string
      }
      create_new_conversation: {
        Args:
          | {
              p_sender_id: string
              p_recipient_id: string
              p_subject: string
              p_content: string
            }
          | { p_sender_id: string; p_subject: string; p_content: string }
        Returns: string
      }
      decrement_variant_stock: {
        Args: { variant_id: string; decrement_quantity: number }
        Returns: undefined
      }
      execute_admin_query: {
        Args: { query_text: string }
        Returns: Json
      }
      execute_explain_query: {
        Args: { query_text: string }
        Returns: Json
      }
      generate_class_sessions: {
        Args: { p_class_id: string; p_start_date: string; p_end_date: string }
        Returns: number
      }
      get_admin_conversation_summaries: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          subject: string
          last_message_at: string
          participant_display_names: string
          is_unread_by_admin: boolean
        }[]
      }
      get_family_conversation_summaries: {
        Args: { p_user_id: string }
        Returns: {
          id: string
          subject: string
          last_message_at: string
          participant_display_names: string
          unread_count: number
        }[]
      }
      get_family_one_on_one_balance: {
        Args: { p_family_id: string }
        Returns: number
      }
      increment_discount_code_usage: {
        Args: { p_discount_code_id: string }
        Returns: undefined
      }
      mark_conversation_as_read: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      validate_discount_code: {
        Args: {
          p_code: string
          p_family_id: string
          p_student_id?: string
          p_subtotal_amount?: number
          p_applicable_to?: Database["public"]["Enums"]["payment_type_enum"]
        }
        Returns: {
          is_valid: boolean
          discount_code_id: string
          discount_amount: number
          error_message: string
        }[]
      }
    }
    Enums: {
      belt_rank_enum:
        | "white"
        | "yellow"
        | "orange"
        | "green"
        | "blue"
        | "purple"
        | "red"
        | "brown"
        | "black"
      day_of_week:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      discount_event_type:
        | "student_enrollment"
        | "first_payment"
        | "belt_promotion"
        | "attendance_milestone"
        | "family_referral"
        | "birthday"
        | "seasonal_promotion"
      enrollment_status:
        | "active"
        | "inactive"
        | "completed"
        | "dropped"
        | "waitlist"
      order_status:
        | "pending_payment"
        | "paid_pending_pickup"
        | "completed"
        | "cancelled"
      payment_status: "pending" | "succeeded" | "failed"
      payment_type_enum:
        | "monthly_group"
        | "yearly_group"
        | "individual_session"
        | "other"
        | "store_purchase"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      belt_rank_enum: [
        "white",
        "yellow",
        "orange",
        "green",
        "blue",
        "purple",
        "red",
        "brown",
        "black",
      ],
      day_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      discount_event_type: [
        "student_enrollment",
        "first_payment",
        "belt_promotion",
        "attendance_milestone",
        "family_referral",
        "birthday",
        "seasonal_promotion",
      ],
      enrollment_status: [
        "active",
        "inactive",
        "completed",
        "dropped",
        "waitlist",
      ],
      order_status: [
        "pending_payment",
        "paid_pending_pickup",
        "completed",
        "cancelled",
      ],
      payment_status: ["pending", "succeeded", "failed"],
      payment_type_enum: [
        "monthly_group",
        "yearly_group",
        "individual_session",
        "other",
        "store_purchase",
      ],
    },
  },
} as const
