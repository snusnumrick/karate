export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          class_session_id: string | null
          id: string
          marked_by: string | null
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status_enum"]
          student_id: string
        }
        Insert: {
          class_session_id?: string | null
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status_enum"]
          student_id: string
        }
        Update: {
          class_session_id?: string | null
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status_enum"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_backup: {
        Row: {
          class_date: string | null
          id: string | null
          notes: string | null
          present: boolean | null
          student_id: string | null
        }
        Insert: {
          class_date?: string | null
          id?: string | null
          notes?: string | null
          present?: boolean | null
          student_id?: string | null
        }
        Update: {
          class_date?: string | null
          id?: string | null
          notes?: string | null
          present?: boolean | null
          student_id?: string | null
        }
        Relationships: []
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
          sequence_number: number | null
          session_date: string
          start_time: string
          status: Database["public"]["Enums"]["class_session_status_enum"]
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          end_time: string
          id?: string
          instructor_id?: string | null
          notes?: string | null
          sequence_number?: number | null
          session_date: string
          start_time: string
          status?: Database["public"]["Enums"]["class_session_status_enum"]
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          end_time?: string
          id?: string
          instructor_id?: string | null
          notes?: string | null
          sequence_number?: number | null
          session_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["class_session_status_enum"]
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
          allow_self_enrollment: boolean
          created_at: string
          description: string | null
          id: string
          instructor_id: string | null
          is_active: boolean
          max_capacity: number | null
          min_capacity: number | null
          name: string
          on_demand: boolean
          price_override_cents: number | null
          program_id: string
          registration_fee_override_cents: number | null
          registration_status: Database["public"]["Enums"]["registration_status"]
          series_end_on: string | null
          series_label: string | null
          series_session_quota: number | null
          series_start_on: string | null
          series_status: Database["public"]["Enums"]["series_status"]
          session_duration_minutes: number | null
          sessions_per_week_override: number | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          allow_self_enrollment?: boolean
          created_at?: string
          description?: string | null
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          max_capacity?: number | null
          min_capacity?: number | null
          name: string
          on_demand?: boolean
          price_override_cents?: number | null
          program_id: string
          registration_fee_override_cents?: number | null
          registration_status?: Database["public"]["Enums"]["registration_status"]
          series_end_on?: string | null
          series_label?: string | null
          series_session_quota?: number | null
          series_start_on?: string | null
          series_status?: Database["public"]["Enums"]["series_status"]
          session_duration_minutes?: number | null
          sessions_per_week_override?: number | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          allow_self_enrollment?: boolean
          created_at?: string
          description?: string | null
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          max_capacity?: number | null
          min_capacity?: number | null
          name?: string
          on_demand?: boolean
          price_override_cents?: number | null
          program_id?: string
          registration_fee_override_cents?: number | null
          registration_status?: Database["public"]["Enums"]["registration_status"]
          series_end_on?: string | null
          series_label?: string | null
          series_session_quota?: number | null
          series_start_on?: string | null
          series_status?: Database["public"]["Enums"]["series_status"]
          session_duration_minutes?: number | null
          sessions_per_week_override?: number | null
          topic?: string | null
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
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_with_belt_info"
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
          discount_type: Database["public"]["Enums"]["discount_type_enum"]
          discount_value: number
          discount_value_cents: number
          family_id: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          name: string
          scope: Database["public"]["Enums"]["discount_scope_enum"]
          student_id: string | null
          updated_at: string
          usage_type: Database["public"]["Enums"]["discount_usage_type_enum"]
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
          discount_type: Database["public"]["Enums"]["discount_type_enum"]
          discount_value: number
          discount_value_cents?: number
          family_id?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name: string
          scope: Database["public"]["Enums"]["discount_scope_enum"]
          student_id?: string | null
          updated_at?: string
          usage_type: Database["public"]["Enums"]["discount_usage_type_enum"]
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
          discount_type?: Database["public"]["Enums"]["discount_type_enum"]
          discount_value?: number
          discount_value_cents?: number
          family_id?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name?: string
          scope?: Database["public"]["Enums"]["discount_scope_enum"]
          student_id?: string | null
          updated_at?: string
          usage_type?: Database["public"]["Enums"]["discount_usage_type_enum"]
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          discount_type: Database["public"]["Enums"]["discount_type_enum"]
          discount_value: number
          discount_value_cents: number
          id: string
          is_active: boolean
          max_uses: number | null
          name: string
          scope: Database["public"]["Enums"]["discount_scope_enum"]
          updated_at: string
          usage_type: Database["public"]["Enums"]["discount_usage_type_enum"]
        }
        Insert: {
          applicable_to: Database["public"]["Enums"]["payment_type_enum"][]
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type: Database["public"]["Enums"]["discount_type_enum"]
          discount_value: number
          discount_value_cents?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name: string
          scope: Database["public"]["Enums"]["discount_scope_enum"]
          updated_at?: string
          usage_type: Database["public"]["Enums"]["discount_usage_type_enum"]
        }
        Update: {
          applicable_to?: Database["public"]["Enums"]["payment_type_enum"][]
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type_enum"]
          discount_value?: number
          discount_value_cents?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name?: string
          scope?: Database["public"]["Enums"]["discount_scope_enum"]
          updated_at?: string
          usage_type?: Database["public"]["Enums"]["discount_usage_type_enum"]
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
          paid_until: string | null
          program_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          updated_at: string
          waivers_completed_at: string | null
        }
        Insert: {
          class_id: string
          completed_at?: string | null
          created_at?: string
          dropped_at?: string | null
          enrolled_at?: string
          id?: string
          notes?: string | null
          paid_until?: string | null
          program_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          updated_at?: string
          waivers_completed_at?: string | null
        }
        Update: {
          class_id?: string
          completed_at?: string | null
          created_at?: string
          dropped_at?: string | null
          enrolled_at?: string
          id?: string
          notes?: string | null
          paid_until?: string | null
          program_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
          updated_at?: string
          waivers_completed_at?: string | null
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
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_with_belt_info"
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
      event_registrations: {
        Row: {
          emergency_contact: string | null
          event_id: string
          family_id: string
          id: string
          notes: string | null
          participant_profile_id: string | null
          payment_amount_cents: number | null
          payment_id: string | null
          payment_required: boolean | null
          registered_at: string | null
          registration_status:
            | Database["public"]["Enums"]["registration_status_enum"]
            | null
          student_id: string
          waiver_status: Database["public"]["Enums"]["waiver_status"]
        }
        Insert: {
          emergency_contact?: string | null
          event_id: string
          family_id: string
          id?: string
          notes?: string | null
          participant_profile_id?: string | null
          payment_amount_cents?: number | null
          payment_id?: string | null
          payment_required?: boolean | null
          registered_at?: string | null
          registration_status?:
            | Database["public"]["Enums"]["registration_status_enum"]
            | null
          student_id: string
          waiver_status?: Database["public"]["Enums"]["waiver_status"]
        }
        Update: {
          emergency_contact?: string | null
          event_id?: string
          family_id?: string
          id?: string
          notes?: string | null
          participant_profile_id?: string | null
          payment_amount_cents?: number | null
          payment_id?: string | null
          payment_required?: boolean | null
          registered_at?: string | null
          registration_status?:
            | Database["public"]["Enums"]["registration_status_enum"]
            | null
          student_id?: string
          waiver_status?: Database["public"]["Enums"]["waiver_status"]
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_participant_profile_id_fkey"
            columns: ["participant_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          border_class: string | null
          color_class: string
          created_at: string | null
          dark_mode_class: string | null
          description: string | null
          display_name: string
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          border_class?: string | null
          color_class: string
          created_at?: string | null
          dark_mode_class?: string | null
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          border_class?: string | null
          color_class?: string
          created_at?: string | null
          dark_mode_class?: string | null
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      event_waivers: {
        Row: {
          event_id: string
          id: string
          is_required: boolean | null
          waiver_id: string
        }
        Insert: {
          event_id: string
          id?: string
          is_required?: boolean | null
          waiver_id: string
        }
        Update: {
          event_id?: string
          id?: string
          is_required?: boolean | null
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_waivers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waivers_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          allow_self_participants: boolean
          country: string | null
          created_at: string | null
          created_by: string
          description: string | null
          end_date: string | null
          end_time: string | null
          event_type_id: string
          external_url: string | null
          id: string
          instructor_id: string | null
          is_public: boolean | null
          late_registration_fee: number | null
          late_registration_fee_cents: number | null
          locality: string | null
          location: string | null
          location_name: string | null
          max_age: number | null
          max_belt_rank: Database["public"]["Enums"]["belt_rank_enum"] | null
          max_participants: number | null
          min_age: number | null
          min_belt_rank: Database["public"]["Enums"]["belt_rank_enum"] | null
          min_capacity: number | null
          notes: string | null
          postal_code: string | null
          region: string | null
          registration_deadline: string | null
          registration_fee: number | null
          registration_fee_cents: number
          required_waiver_ids: string[] | null
          requires_equipment: string[] | null
          requires_waiver: boolean | null
          slot_one_end: string | null
          slot_one_start: string | null
          slot_two_end: string | null
          slot_two_start: string | null
          start_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["event_status_enum"]
          street_address: string | null
          timezone: string | null
          title: string
          updated_at: string | null
          visibility: Database["public"]["Enums"]["event_visibility_enum"]
        }
        Insert: {
          address?: string | null
          allow_self_participants?: boolean
          country?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type_id?: string
          external_url?: string | null
          id?: string
          instructor_id?: string | null
          is_public?: boolean | null
          late_registration_fee?: number | null
          late_registration_fee_cents?: number | null
          locality?: string | null
          location?: string | null
          location_name?: string | null
          max_age?: number | null
          max_belt_rank?: Database["public"]["Enums"]["belt_rank_enum"] | null
          max_participants?: number | null
          min_age?: number | null
          min_belt_rank?: Database["public"]["Enums"]["belt_rank_enum"] | null
          min_capacity?: number | null
          notes?: string | null
          postal_code?: string | null
          region?: string | null
          registration_deadline?: string | null
          registration_fee?: number | null
          registration_fee_cents?: number
          required_waiver_ids?: string[] | null
          requires_equipment?: string[] | null
          requires_waiver?: boolean | null
          slot_one_end?: string | null
          slot_one_start?: string | null
          slot_two_end?: string | null
          slot_two_start?: string | null
          start_date: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status_enum"]
          street_address?: string | null
          timezone?: string | null
          title: string
          updated_at?: string | null
          visibility?: Database["public"]["Enums"]["event_visibility_enum"]
        }
        Update: {
          address?: string | null
          allow_self_participants?: boolean
          country?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type_id?: string
          external_url?: string | null
          id?: string
          instructor_id?: string | null
          is_public?: boolean | null
          late_registration_fee?: number | null
          late_registration_fee_cents?: number | null
          locality?: string | null
          location?: string | null
          location_name?: string | null
          max_age?: number | null
          max_belt_rank?: Database["public"]["Enums"]["belt_rank_enum"] | null
          max_participants?: number | null
          min_age?: number | null
          min_belt_rank?: Database["public"]["Enums"]["belt_rank_enum"] | null
          min_capacity?: number | null
          notes?: string | null
          postal_code?: string | null
          region?: string | null
          registration_deadline?: string | null
          registration_fee?: number | null
          registration_fee_cents?: number
          required_waiver_ids?: string[] | null
          requires_equipment?: string[] | null
          requires_waiver?: boolean | null
          slot_one_end?: string | null
          slot_one_start?: string | null
          slot_two_end?: string | null
          slot_two_start?: string | null
          start_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status_enum"]
          street_address?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string | null
          visibility?: Database["public"]["Enums"]["event_visibility_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_events_event_type_id"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          email: string
          emergency_contact: string | null
          family_type: Database["public"]["Enums"]["family_type"]
          health_info: string | null
          id: string
          name: string
          notes: string | null
          postal_code: string | null
          primary_phone: string
          province: string | null
          referral_name: string | null
          referral_source: string | null
          registration_waivers_complete: boolean | null
          registration_waivers_completed_at: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email: string
          emergency_contact?: string | null
          family_type?: Database["public"]["Enums"]["family_type"]
          health_info?: string | null
          id?: string
          name: string
          notes?: string | null
          postal_code?: string | null
          primary_phone: string
          province?: string | null
          referral_name?: string | null
          referral_source?: string | null
          registration_waivers_complete?: boolean | null
          registration_waivers_completed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string
          emergency_contact?: string | null
          family_type?: Database["public"]["Enums"]["family_type"]
          health_info?: string | null
          id?: string
          name?: string
          notes?: string | null
          postal_code?: string | null
          primary_phone?: string
          province?: string | null
          referral_name?: string | null
          referral_source?: string | null
          registration_waivers_complete?: boolean | null
          registration_waivers_completed_at?: string | null
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
      incomplete_event_registrations: {
        Row: {
          created_at: string
          current_step: Database["public"]["Enums"]["registration_step"]
          dismissed_at: string | null
          event_id: string
          expires_at: string
          family_id: string
          id: string
          metadata: Json | null
          selected_student_ids: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: Database["public"]["Enums"]["registration_step"]
          dismissed_at?: string | null
          event_id: string
          expires_at?: string
          family_id: string
          id?: string
          metadata?: Json | null
          selected_student_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: Database["public"]["Enums"]["registration_step"]
          dismissed_at?: string | null
          event_id?: string
          expires_at?: string
          family_id?: string
          id?: string
          metadata?: Json | null
          selected_student_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomplete_event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomplete_event_registrations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_entities: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          credit_limit: number | null
          credit_limit_cents: number | null
          email: string | null
          entity_type: Database["public"]["Enums"]["entity_type_enum"]
          family_id: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          credit_limit_cents?: number | null
          email?: string | null
          entity_type: Database["public"]["Enums"]["entity_type_enum"]
          family_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          credit_limit_cents?: number | null
          email?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type_enum"]
          family_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_entities_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_item_taxes: {
        Row: {
          created_at: string | null
          id: string
          invoice_line_item_id: string
          tax_amount: number
          tax_amount_cents: number
          tax_description_snapshot: string | null
          tax_name_snapshot: string
          tax_rate_id: string
          tax_rate_snapshot: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_line_item_id: string
          tax_amount?: number
          tax_amount_cents?: number
          tax_description_snapshot?: string | null
          tax_name_snapshot: string
          tax_rate_id: string
          tax_rate_snapshot: number
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_line_item_id?: string
          tax_amount?: number
          tax_amount_cents?: number
          tax_description_snapshot?: string | null
          tax_name_snapshot?: string
          tax_rate_id?: string
          tax_rate_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_item_taxes_invoice_line_item_id_fkey"
            columns: ["invoice_line_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_line_item_tax_breakdown"
            referencedColumns: ["line_item_id"]
          },
          {
            foreignKeyName: "invoice_line_item_taxes_invoice_line_item_id_fkey"
            columns: ["invoice_line_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_item_taxes_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string | null
          description: string
          discount_amount: number | null
          discount_amount_cents: number | null
          discount_rate: number | null
          enrollment_id: string | null
          id: string
          invoice_id: string
          item_type: Database["public"]["Enums"]["invoice_item_type"]
          line_total: number
          line_total_cents: number
          product_id: string | null
          quantity: number
          service_period_end: string | null
          service_period_start: string | null
          sort_order: number | null
          tax_amount: number | null
          tax_amount_cents: number | null
          tax_rate: number | null
          unit_price: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string | null
          description: string
          discount_amount?: number | null
          discount_amount_cents?: number | null
          discount_rate?: number | null
          enrollment_id?: string | null
          id?: string
          invoice_id: string
          item_type: Database["public"]["Enums"]["invoice_item_type"]
          line_total: number
          line_total_cents: number
          product_id?: string | null
          quantity?: number
          service_period_end?: string | null
          service_period_start?: string | null
          sort_order?: number | null
          tax_amount?: number | null
          tax_amount_cents?: number | null
          tax_rate?: number | null
          unit_price: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string | null
          description?: string
          discount_amount?: number | null
          discount_amount_cents?: number | null
          discount_rate?: number | null
          enrollment_id?: string | null
          id?: string
          invoice_id?: string
          item_type?: Database["public"]["Enums"]["invoice_item_type"]
          line_total?: number
          line_total_cents?: number
          product_id?: string | null
          quantity?: number
          service_period_end?: string | null
          service_period_start?: string | null
          sort_order?: number | null
          tax_amount?: number | null
          tax_amount_cents?: number | null
          tax_rate?: number | null
          unit_price?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollment_waiver_status"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "invoice_line_items_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "pending_waiver_enrollments"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount_cents: number
          created_at: string | null
          currency: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["invoice_payment_method"]
          receipt_url: string | null
          reference_number: string | null
          stripe_payment_intent_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          currency?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method: Database["public"]["Enums"]["invoice_payment_method"]
          receipt_url?: string | null
          reference_number?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          currency?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["invoice_payment_method"]
          receipt_url?: string | null
          reference_number?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          invoice_id: string
          new_status: Database["public"]["Enums"]["invoice_status"]
          notes: string | null
          old_status: Database["public"]["Enums"]["invoice_status"] | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          invoice_id: string
          new_status: Database["public"]["Enums"]["invoice_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["invoice_status"] | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string
          new_status?: Database["public"]["Enums"]["invoice_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["invoice_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_status_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_template_line_items: {
        Row: {
          created_at: string | null
          description: string
          discount_rate: number | null
          id: string
          item_type: Database["public"]["Enums"]["invoice_item_type"]
          quantity: number | null
          service_period_end: string | null
          service_period_start: string | null
          sort_order: number | null
          tax_rate: number | null
          template_id: string
          unit_price: number | null
          unit_price_cents: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          discount_rate?: number | null
          id?: string
          item_type: Database["public"]["Enums"]["invoice_item_type"]
          quantity?: number | null
          service_period_end?: string | null
          service_period_start?: string | null
          sort_order?: number | null
          tax_rate?: number | null
          template_id: string
          unit_price?: number | null
          unit_price_cents?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          discount_rate?: number | null
          id?: string
          item_type?: Database["public"]["Enums"]["invoice_item_type"]
          quantity?: number | null
          service_period_end?: string | null
          service_period_start?: string | null
          sort_order?: number | null
          tax_rate?: number | null
          template_id?: string
          unit_price?: number | null
          unit_price_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_template_line_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          default_footer: string | null
          default_notes: string | null
          default_terms: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system_template: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          default_footer?: string | null
          default_notes?: string | null
          default_terms?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system_template?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          default_footer?: string | null
          default_notes?: string | null
          default_terms?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system_template?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_due_cents: number
          amount_paid: number
          amount_paid_cents: number
          created_at: string | null
          currency: string | null
          discount_amount: number
          discount_amount_cents: number
          due_date: string
          entity_id: string
          family_id: string | null
          footer_text: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          paid_at: string | null
          sent_at: string | null
          service_period_end: string | null
          service_period_start: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number
          subtotal_cents: number
          tax_amount: number
          tax_amount_cents: number
          terms: string | null
          total_amount: number
          total_amount_cents: number
          updated_at: string | null
          viewed_at: string | null
        }
        Insert: {
          amount_due?: number
          amount_due_cents?: number
          amount_paid?: number
          amount_paid_cents?: number
          created_at?: string | null
          currency?: string | null
          discount_amount?: number
          discount_amount_cents?: number
          due_date: string
          entity_id: string
          family_id?: string | null
          footer_text?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number
          subtotal_cents?: number
          tax_amount?: number
          tax_amount_cents?: number
          terms?: string | null
          total_amount?: number
          total_amount_cents?: number
          updated_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          amount_due?: number
          amount_due_cents?: number
          amount_paid?: number
          amount_paid_cents?: number
          created_at?: string | null
          currency?: string | null
          discount_amount?: number
          discount_amount_cents?: number
          due_date?: string
          entity_id?: string
          family_id?: string | null
          footer_text?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number
          subtotal_cents?: number
          tax_amount?: number
          tax_amount_cents?: number
          terms?: string | null
          total_amount?: number
          total_amount_cents?: number
          updated_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "invoice_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_family_id_fkey"
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
          payment_intent_id: string | null
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
          payment_intent_id?: string | null
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
          payment_intent_id?: string | null
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
          role: Database["public"]["Enums"]["profile_role"]
        }
        Insert: {
          email: string
          family_id?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
        }
        Update: {
          email?: string
          family_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
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
      program_waivers: {
        Row: {
          created_at: string | null
          id: string
          is_required: boolean | null
          program_id: string
          required_for_full_enrollment: boolean | null
          required_for_trial: boolean | null
          updated_at: string | null
          waiver_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          program_id: string
          required_for_full_enrollment?: boolean | null
          required_for_trial?: boolean | null
          updated_at?: string | null
          waiver_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          program_id?: string
          required_for_full_enrollment?: boolean | null
          required_for_trial?: boolean | null
          updated_at?: string | null
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_waivers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_waivers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_with_belt_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_waivers_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          ability_category:
            | Database["public"]["Enums"]["ability_category"]
            | null
          audience_scope: Database["public"]["Enums"]["audience_scope"]
          belt_rank_required: boolean | null
          created_at: string
          delivery_format: Database["public"]["Enums"]["delivery_format"] | null
          description: string | null
          duration_minutes: number
          engagement_type: Database["public"]["Enums"]["engagement_type"]
          gender_restriction: string | null
          id: string
          individual_session_fee: number | null
          individual_session_fee_cents: number
          is_active: boolean
          max_age: number | null
          max_belt_rank: Database["public"]["Enums"]["belt_rank_enum"] | null
          max_capacity: number | null
          max_sessions_per_week: number | null
          min_age: number | null
          min_belt_rank: Database["public"]["Enums"]["belt_rank_enum"] | null
          min_capacity: number | null
          min_sessions_per_week: number | null
          monthly_fee: number | null
          monthly_fee_cents: number
          name: string
          prerequisite_programs: string[] | null
          registration_fee: number | null
          registration_fee_cents: number
          required_waiver_id: string | null
          seminar_type: Database["public"]["Enums"]["seminar_type"] | null
          sessions_per_week: number
          single_purchase_price_cents: number | null
          slug: string | null
          special_needs_support: boolean | null
          subscription_monthly_price_cents: number | null
          subscription_yearly_price_cents: number | null
          updated_at: string
          yearly_fee: number | null
          yearly_fee_cents: number
        }
        Insert: {
          ability_category?:
            | Database["public"]["Enums"]["ability_category"]
            | null
          audience_scope?: Database["public"]["Enums"]["audience_scope"]
          belt_rank_required?: boolean | null
          created_at?: string
          delivery_format?:
            | Database["public"]["Enums"]["delivery_format"]
            | null
          description?: string | null
          duration_minutes?: number
          engagement_type?: Database["public"]["Enums"]["engagement_type"]
          gender_restriction?: string | null
          id?: string
          individual_session_fee?: number | null
          individual_session_fee_cents?: number
          is_active?: boolean
          max_age?: number | null
          max_belt_rank?: Database["public"]["Enums"]["belt_rank_enum"] | null
          max_capacity?: number | null
          max_sessions_per_week?: number | null
          min_age?: number | null
          min_belt_rank?: Database["public"]["Enums"]["belt_rank_enum"] | null
          min_capacity?: number | null
          min_sessions_per_week?: number | null
          monthly_fee?: number | null
          monthly_fee_cents?: number
          name: string
          prerequisite_programs?: string[] | null
          registration_fee?: number | null
          registration_fee_cents?: number
          required_waiver_id?: string | null
          seminar_type?: Database["public"]["Enums"]["seminar_type"] | null
          sessions_per_week?: number
          single_purchase_price_cents?: number | null
          slug?: string | null
          special_needs_support?: boolean | null
          subscription_monthly_price_cents?: number | null
          subscription_yearly_price_cents?: number | null
          updated_at?: string
          yearly_fee?: number | null
          yearly_fee_cents?: number
        }
        Update: {
          ability_category?:
            | Database["public"]["Enums"]["ability_category"]
            | null
          audience_scope?: Database["public"]["Enums"]["audience_scope"]
          belt_rank_required?: boolean | null
          created_at?: string
          delivery_format?:
            | Database["public"]["Enums"]["delivery_format"]
            | null
          description?: string | null
          duration_minutes?: number
          engagement_type?: Database["public"]["Enums"]["engagement_type"]
          gender_restriction?: string | null
          id?: string
          individual_session_fee?: number | null
          individual_session_fee_cents?: number
          is_active?: boolean
          max_age?: number | null
          max_belt_rank?: Database["public"]["Enums"]["belt_rank_enum"] | null
          max_capacity?: number | null
          max_sessions_per_week?: number | null
          min_age?: number | null
          min_belt_rank?: Database["public"]["Enums"]["belt_rank_enum"] | null
          min_capacity?: number | null
          min_sessions_per_week?: number | null
          monthly_fee?: number | null
          monthly_fee_cents?: number
          name?: string
          prerequisite_programs?: string[] | null
          registration_fee?: number | null
          registration_fee_cents?: number
          required_waiver_id?: string | null
          seminar_type?: Database["public"]["Enums"]["seminar_type"] | null
          sessions_per_week?: number
          single_purchase_price_cents?: number | null
          slug?: string | null
          special_needs_support?: boolean | null
          subscription_monthly_price_cents?: number | null
          subscription_yearly_price_cents?: number | null
          updated_at?: string
          yearly_fee?: number | null
          yearly_fee_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "programs_required_waiver_id_fkey"
            columns: ["required_waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: number
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: number
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: number
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          allergies: string | null
          birth_date: string | null
          cell_phone: string | null
          email: string | null
          family_id: string
          first_name: string
          gender: string
          grade_level: string | null
          height: number | null
          id: string
          immunization_notes: string | null
          immunizations_up_to_date: string | null
          is_adult: boolean
          last_name: string
          medications: string | null
          profile_id: string | null
          school: string | null
          special_needs: string | null
          t_shirt_size: Database["public"]["Enums"]["t_shirt_size_enum"] | null
        }
        Insert: {
          allergies?: string | null
          birth_date?: string | null
          cell_phone?: string | null
          email?: string | null
          family_id: string
          first_name: string
          gender: string
          grade_level?: string | null
          height?: number | null
          id?: string
          immunization_notes?: string | null
          immunizations_up_to_date?: string | null
          is_adult?: boolean
          last_name: string
          medications?: string | null
          profile_id?: string | null
          school?: string | null
          special_needs?: string | null
          t_shirt_size?: Database["public"]["Enums"]["t_shirt_size_enum"] | null
        }
        Update: {
          allergies?: string | null
          birth_date?: string | null
          cell_phone?: string | null
          email?: string | null
          family_id?: string
          first_name?: string
          gender?: string
          grade_level?: string | null
          height?: number | null
          id?: string
          immunization_notes?: string | null
          immunizations_up_to_date?: string | null
          is_adult?: boolean
          last_name?: string
          medications?: string | null
          profile_id?: string | null
          school?: string | null
          special_needs?: string | null
          t_shirt_size?: Database["public"]["Enums"]["t_shirt_size_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          pdf_storage_path: string | null
          signature_data: string
          signed_at: string
          student_ids: string[]
          user_id: string
          waiver_id: string
        }
        Insert: {
          agreement_version: string
          id?: string
          pdf_storage_path?: string | null
          signature_data: string
          signed_at?: string
          student_ids?: string[]
          user_id: string
          waiver_id: string
        }
        Update: {
          agreement_version?: string
          id?: string
          pdf_storage_path?: string | null
          signature_data?: string
          signed_at?: string
          student_ids?: string[]
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
          required_for_registration: boolean | null
          required_for_trial: boolean | null
          title: string
        }
        Insert: {
          content: string
          description: string
          id?: string
          required?: boolean
          required_for_registration?: boolean | null
          required_for_trial?: boolean | null
          title: string
        }
        Update: {
          content?: string
          description?: string
          id?: string
          required?: boolean
          required_for_registration?: boolean | null
          required_for_trial?: boolean | null
          title?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          error_details: Json | null
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          parsed_metadata: Json | null
          payment_id: string | null
          processed_at: string | null
          processing_duration_ms: number | null
          provider: string
          raw_payload: Json
          raw_type: string | null
          received_at: string
          request_id: string | null
          retry_count: number | null
          signature_verified: boolean | null
          source_ip: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          parsed_metadata?: Json | null
          payment_id?: string | null
          processed_at?: string | null
          processing_duration_ms?: number | null
          provider: string
          raw_payload: Json
          raw_type?: string | null
          received_at?: string
          request_id?: string | null
          retry_count?: number | null
          signature_verified?: boolean | null
          source_ip?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          parsed_metadata?: Json | null
          payment_id?: string | null
          processed_at?: string | null
          processing_duration_ms?: number | null
          provider?: string
          raw_payload?: Json
          raw_type?: string | null
          received_at?: string
          request_id?: string | null
          retry_count?: number | null
          signature_verified?: boolean | null
          source_ip?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      enrollment_waiver_status: {
        Row: {
          enrollment_id: string | null
          family_id: string | null
          program_id: string | null
          program_name: string | null
          required_waiver_id: string | null
          required_waiver_name: string | null
          signed_at: string | null
          signed_by_user_id: string | null
          student_id: string | null
          student_name: string | null
          waiver_signed: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_with_belt_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_required_waiver_id_fkey"
            columns: ["required_waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
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
      invoice_line_item_tax_breakdown: {
        Row: {
          invoice_id: string | null
          line_item_description: string | null
          line_item_id: string | null
          line_total: number | null
          quantity: number | null
          tax_details: Json | null
          total_tax_amount: number | null
          unit_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_waiver_enrollments: {
        Row: {
          enrollment_id: string | null
          family_email: string | null
          family_id: string | null
          family_name: string | null
          program_id: string | null
          program_name: string | null
          required_waiver_id: string | null
          required_waiver_name: string | null
          student_id: string | null
          student_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_with_belt_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_required_waiver_id_fkey"
            columns: ["required_waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      programs_with_belt_info: {
        Row: {
          belt_rank_required: boolean | null
          belt_requirement_display: string | null
          capacity_display: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          frequency_display: string | null
          gender_restriction: string | null
          id: string | null
          individual_session_fee: number | null
          is_active: boolean | null
          max_age: number | null
          max_belt_rank: Database["public"]["Enums"]["belt_rank_enum"] | null
          max_capacity: number | null
          max_sessions_per_week: number | null
          min_age: number | null
          min_belt_rank: Database["public"]["Enums"]["belt_rank_enum"] | null
          min_sessions_per_week: number | null
          monthly_fee: number | null
          name: string | null
          prerequisite_programs: string[] | null
          registration_fee: number | null
          sessions_per_week: number | null
          special_needs_support: boolean | null
          updated_at: string | null
          yearly_fee: number | null
        }
        Insert: {
          belt_rank_required?: boolean | null
          belt_requirement_display?: never
          capacity_display?: never
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          frequency_display?: never
          gender_restriction?: string | null
          id?: string | null
          individual_session_fee?: number | null
          is_active?: boolean | null
          max_age?: number | null
          max_belt_rank?: Database["public"]["Enums"]["belt_rank_enum"] | null
          max_capacity?: number | null
          max_sessions_per_week?: number | null
          min_age?: number | null
          min_belt_rank?: Database["public"]["Enums"]["belt_rank_enum"] | null
          min_sessions_per_week?: number | null
          monthly_fee?: number | null
          name?: string | null
          prerequisite_programs?: string[] | null
          registration_fee?: number | null
          sessions_per_week?: number | null
          special_needs_support?: boolean | null
          updated_at?: string | null
          yearly_fee?: number | null
        }
        Update: {
          belt_rank_required?: boolean | null
          belt_requirement_display?: never
          capacity_display?: never
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          frequency_display?: never
          gender_restriction?: string | null
          id?: string | null
          individual_session_fee?: number | null
          is_active?: boolean | null
          max_age?: number | null
          max_belt_rank?: Database["public"]["Enums"]["belt_rank_enum"] | null
          max_capacity?: number | null
          max_sessions_per_week?: number | null
          min_age?: number | null
          min_belt_rank?: Database["public"]["Enums"]["belt_rank_enum"] | null
          min_sessions_per_week?: number | null
          monthly_fee?: number | null
          name?: string | null
          prerequisite_programs?: string[] | null
          registration_fee?: number | null
          sessions_per_week?: number | null
          special_needs_support?: boolean | null
          updated_at?: string | null
          yearly_fee?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      belt_rank_ordinal: {
        Args: { rank: Database["public"]["Enums"]["belt_rank_enum"] }
        Returns: number
      }
      build_address_from_structured_fields: {
        Args: {
          p_country: string
          p_locality: string
          p_postal_code: string
          p_region: string
          p_street_address: string
        }
        Returns: string
      }
      check_class_eligibility: {
        Args: { class_id_param: string; student_id_param: string }
        Returns: boolean
      }
      check_event_registration_eligibility: {
        Args: { p_event_id: string; p_student_id: string }
        Returns: Json
      }
      check_family_registration_waivers: {
        Args: { p_family_id: string }
        Returns: boolean
      }
      check_program_eligibility: {
        Args: { program_id_param: string; student_id_param: string }
        Returns: boolean
      }
      check_program_waivers_complete: {
        Args: {
          p_enrollment_type?: string
          p_program_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      cleanup_expired_incomplete_registrations: {
        Args: never
        Returns: undefined
      }
      complete_new_user_registration: {
        Args: {
          p_address?: string
          p_city?: string
          p_contact1_cell_phone?: string
          p_contact1_first_name?: string
          p_contact1_home_phone?: string
          p_contact1_last_name?: string
          p_contact1_type?: string
          p_contact1_work_phone?: string
          p_emergency_contact?: string
          p_family_name: string
          p_health_info?: string
          p_postal_code: string
          p_primary_phone: string
          p_province?: string
          p_referral_name?: string
          p_referral_source?: string
          p_user_email: string
          p_user_id: string
        }
        Returns: string
      }
      count_successful_student_payments: {
        Args: { p_student_id: string }
        Returns: number
      }
      create_admin_initiated_conversation: {
        Args: {
          p_message_body: string
          p_sender_id: string
          p_subject: string
          p_target_family_id: string
        }
        Returns: Json
      }
      create_new_conversation:
        | {
            Args: {
              p_content: string
              p_recipient_id: string
              p_sender_id: string
              p_subject: string
            }
            Returns: string
          }
        | {
            Args: { p_content: string; p_sender_id: string; p_subject: string }
            Returns: string
          }
      decrement_variant_stock: {
        Args: { decrement_quantity: number; variant_id: string }
        Returns: undefined
      }
      execute_admin_query: { Args: { query_text: string }; Returns: Json }
      execute_explain_query: { Args: { query_text: string }; Returns: Json }
      generate_class_sessions: {
        Args: { p_class_id: string; p_end_date: string; p_start_date: string }
        Returns: number
      }
      generate_invoice_number: { Args: never; Returns: string }
      get_admin_conversation_summaries: {
        Args: never
        Returns: {
          id: string
          is_unread_by_admin: boolean
          last_message_at: string
          participant_display_names: string
          subject: string
        }[]
      }
      get_belt_rank_order: {
        Args: { belt_rank: Database["public"]["Enums"]["belt_rank_enum"] }
        Returns: number
      }
      get_family_conversation_summaries: {
        Args: { p_user_id: string }
        Returns: {
          id: string
          last_message_at: string
          participant_display_names: string
          subject: string
          unread_count: number
        }[]
      }
      get_family_one_on_one_balance: {
        Args: { p_family_id: string }
        Returns: number
      }
      get_main_page_schedule_summary: {
        Args: never
        Returns: {
          age_range: string
          days: string
          duration: string
          max_age: number
          max_students: number
          min_age: number
          time_range: string
        }[]
      }
      get_missing_program_waivers: {
        Args: {
          p_enrollment_type?: string
          p_program_id: string
          p_user_id: string
        }
        Returns: {
          waiver_description: string
          waiver_id: string
          waiver_title: string
        }[]
      }
      get_other_event_type_id: { Args: never; Returns: string }
      get_program_statistics: {
        Args: never
        Returns: {
          avg_sessions_per_week: number
          group_programs: number
          open_programs: number
          private_programs: number
          programs_with_belt_requirements: number
          total_programs: number
        }[]
      }
      get_student_current_belt_rank: {
        Args: { student_id_param: string }
        Returns: Database["public"]["Enums"]["belt_rank_enum"]
      }
      get_student_eligible_programs: {
        Args: { student_id_param: string }
        Returns: {
          belt_requirement_display: string
          capacity_display: string
          description: string
          eligibility_reason: string
          frequency_display: string
          individual_session_fee: number
          is_eligible: boolean
          monthly_fee: number
          program_id: string
          program_name: string
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["profile_role"]
      }
      has_student_signed_waiver: {
        Args: { p_student_id: string; p_waiver_id: string }
        Returns: boolean
      }
      increment_discount_code_usage: {
        Args: { p_discount_code_id: string }
        Returns: undefined
      }
      mark_conversation_as_read: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      parse_address_to_structured_fields: {
        Args: { p_address: string }
        Returns: Record<string, unknown>
      }
      recalc_invoice_totals: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      refresh_enrollment_waiver_status_proc: { Args: never; Returns: undefined }
      validate_discount_code: {
        Args: {
          p_applicable_to?: Database["public"]["Enums"]["payment_type_enum"]
          p_code: string
          p_family_id: string
          p_student_id?: string
          p_subtotal_amount?: number
        }
        Returns: {
          discount_amount: number
          discount_code_id: string
          error_message: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      ability_category: "able" | "adaptive"
      attendance_status_enum: "present" | "absent" | "excused" | "late"
      audience_scope: "youth" | "adults" | "mixed"
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
      class_session_status_enum:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
      day_of_week:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      delivery_format:
        | "group"
        | "private"
        | "competition_individual"
        | "competition_team"
        | "introductory"
      discount_event_type:
        | "student_enrollment"
        | "first_payment"
        | "belt_promotion"
        | "attendance_milestone"
        | "family_referral"
        | "birthday"
        | "seasonal_promotion"
      discount_scope_enum: "per_student" | "per_family"
      discount_type_enum: "fixed_amount" | "percentage"
      discount_usage_type_enum: "one_time" | "ongoing"
      eligibility_reason_enum:
        | "eligible"
        | "event_not_found"
        | "student_not_found"
        | "registration_not_open"
        | "registration_deadline_passed"
        | "already_registered"
        | "event_full"
        | "student_too_young"
        | "student_too_old"
        | "student_belt_rank_too_low"
        | "student_belt_rank_too_high"
      engagement_type: "program" | "seminar"
      enrollment_status:
        | "active"
        | "inactive"
        | "completed"
        | "dropped"
        | "waitlist"
        | "trial"
        | "pending_waivers"
      entity_type_enum:
        | "family"
        | "school"
        | "government"
        | "corporate"
        | "other"
      event_status_enum:
        | "draft"
        | "published"
        | "registration_open"
        | "registration_closed"
        | "in_progress"
        | "completed"
        | "cancelled"
      event_visibility_enum: "public" | "limited" | "internal"
      family_type: "household" | "self" | "organization"
      invoice_item_type:
        | "class_enrollment"
        | "individual_session"
        | "product"
        | "fee"
        | "discount"
        | "other"
      invoice_payment_method:
        | "cash"
        | "check"
        | "bank_transfer"
        | "credit_card"
        | "ach"
        | "other"
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "paid"
        | "partially_paid"
        | "overdue"
        | "cancelled"
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
        | "event_registration"
      profile_role: "user" | "instructor" | "admin"
      registration_status: "open" | "closed" | "waitlisted"
      registration_status_enum:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "waitlist"
      registration_step: "student_selection" | "waiver_signing" | "payment"
      seminar_type: "introductory" | "intermediate" | "advanced"
      series_status:
        | "tentative"
        | "confirmed"
        | "cancelled"
        | "in_progress"
        | "completed"
      t_shirt_size_enum:
        | "YXXS"
        | "YXS"
        | "YS"
        | "YM"
        | "YL"
        | "YXL"
        | "AS"
        | "AM"
        | "AL"
        | "AXL"
        | "A2XL"
      waiver_status: "not_required" | "pending" | "signed" | "expired"
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
      ability_category: ["able", "adaptive"],
      attendance_status_enum: ["present", "absent", "excused", "late"],
      audience_scope: ["youth", "adults", "mixed"],
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
      class_session_status_enum: [
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
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
      delivery_format: [
        "group",
        "private",
        "competition_individual",
        "competition_team",
        "introductory",
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
      discount_scope_enum: ["per_student", "per_family"],
      discount_type_enum: ["fixed_amount", "percentage"],
      discount_usage_type_enum: ["one_time", "ongoing"],
      eligibility_reason_enum: [
        "eligible",
        "event_not_found",
        "student_not_found",
        "registration_not_open",
        "registration_deadline_passed",
        "already_registered",
        "event_full",
        "student_too_young",
        "student_too_old",
        "student_belt_rank_too_low",
        "student_belt_rank_too_high",
      ],
      engagement_type: ["program", "seminar"],
      enrollment_status: [
        "active",
        "inactive",
        "completed",
        "dropped",
        "waitlist",
        "trial",
        "pending_waivers",
      ],
      entity_type_enum: [
        "family",
        "school",
        "government",
        "corporate",
        "other",
      ],
      event_status_enum: [
        "draft",
        "published",
        "registration_open",
        "registration_closed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      event_visibility_enum: ["public", "limited", "internal"],
      family_type: ["household", "self", "organization"],
      invoice_item_type: [
        "class_enrollment",
        "individual_session",
        "product",
        "fee",
        "discount",
        "other",
      ],
      invoice_payment_method: [
        "cash",
        "check",
        "bank_transfer",
        "credit_card",
        "ach",
        "other",
      ],
      invoice_status: [
        "draft",
        "sent",
        "viewed",
        "paid",
        "partially_paid",
        "overdue",
        "cancelled",
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
        "event_registration",
      ],
      profile_role: ["user", "instructor", "admin"],
      registration_status: ["open", "closed", "waitlisted"],
      registration_status_enum: [
        "pending",
        "confirmed",
        "cancelled",
        "waitlist",
      ],
      registration_step: ["student_selection", "waiver_signing", "payment"],
      seminar_type: ["introductory", "intermediate", "advanced"],
      series_status: [
        "tentative",
        "confirmed",
        "cancelled",
        "in_progress",
        "completed",
      ],
      t_shirt_size_enum: [
        "YXXS",
        "YXS",
        "YS",
        "YM",
        "YL",
        "YXL",
        "AS",
        "AM",
        "AL",
        "AXL",
        "A2XL",
      ],
      waiver_status: ["not_required", "pending", "signed", "expired"],
    },
  },
} as const
