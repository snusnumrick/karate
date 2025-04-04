export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          home_phone: string
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
          home_phone: string
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
          home_phone?: string
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
      payments: {
        Row: {
          amount: number
          family_id: string
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_session_id: string | null
          type: Database["public"]["Enums"]["payment_type_enum"]
        }
        Insert: {
          amount: number
          family_id: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_session_id?: string | null
          type?: Database["public"]["Enums"]["payment_type_enum"]
        }
        Update: {
          amount?: number
          family_id?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_session_id?: string | null
          type?: Database["public"]["Enums"]["payment_type_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
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
      profiles: {
        Row: {
          email: string
          family_id: string | null
          id: string
          role: string
        }
        Insert: {
          email: string
          family_id?: string | null
          id: string
          role?: string
        }
        Update: {
          email?: string
          family_id?: string | null
          id?: string
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
      count_successful_student_payments: {
        Args: {
          p_student_id: string
        }
        Returns: number
      }
      get_family_one_on_one_balance: {
        Args: {
          p_family_id: string
        }
        Returns: number
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
      payment_status: "pending" | "succeeded" | "failed"
      payment_type_enum:
        | "monthly_group"
        | "yearly_group"
        | "individual_session"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
