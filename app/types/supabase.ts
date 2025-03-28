export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      achievements: {
        Row: {
          awarded_date: string
          description: string
          id: string
          student_id: string
          type: string
        }
        Insert: {
          awarded_date: string
          description: string
          id?: string
          student_id: string
          type: string
        }
        Update: {
          awarded_date?: string
          description?: string
          id?: string
          student_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          }
        ]
      }
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
          }
        ]
      }
      families: {
        Row: {
          address: string
          city: string
          created_at: string
          email: string
          id: string
          name: string
          primary_phone: string
          postal_code: string
          province: string
          referral_source: string | null
          emergency_contact: string | null
          health_info: string | null
          updated_at: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          email: string
          id?: string
          name: string
          primary_phone: string
          postal_code: string
          province: string
          referral_source?: string | null
          emergency_contact?: string | null
          health_info?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          primary_phone?: string
          postal_code?: string
          province?: string
          referral_source?: string | null
          emergency_contact?: string | null
          health_info?: string | null
          updated_at?: string
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
          }
        ]
      }
      payments: {
        Row: {
          amount: number
          family_id: string
          id: string
          payment_date: string
          payment_method: string
          status: 'pending' | 'completed' | 'failed'
        }
        Insert: {
          amount: number
          family_id: string
          id?: string
          payment_date: string
          payment_method: string
          status: 'pending' | 'completed' | 'failed'
        }
        Update: {
          amount?: number
          family_id?: string
          id?: string
          payment_date?: string
          payment_method?: string
          status?: 'pending' | 'completed' | 'failed'
        }
        Relationships: [
          {
            foreignKeyName: "payments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          }
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
          }
        ]
      }
      profiles: {
        Row: {
          email: string
          family_id: string | null
          id: string
          role: 'user' | 'admin' | 'instructor'
        }
        Insert: {
          email: string
          family_id?: string | null
          id: string
          role?: 'user' | 'admin' | 'instructor'
        }
        Update: {
          email?: string
          family_id?: string | null
          id?: string
          role?: 'user' | 'admin' | 'instructor'
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      students: {
        Row: {
          allergies: string | null
          belt_rank: string
          birth_date: string
          cell_phone: string | null
          email: string | null
          family_id: string
          first_name: string
          gender: string
          grade_level: string
          id: string
          immunization_notes: string | null
          immunizations_up_to_date: boolean
          last_name: string
          medications: string | null
          school: string
          special_needs: string | null
          t_shirt_size: string
        }
        Insert: {
          allergies?: string | null
          belt_rank?: string
          birth_date: string
          cell_phone?: string | null
          email?: string | null
          family_id: string
          first_name: string
          gender: string
          grade_level: string
          id?: string
          immunization_notes?: string | null
          immunizations_up_to_date?: boolean
          last_name: string
          medications?: string | null
          school: string
          special_needs?: string | null
          t_shirt_size: string
        }
        Update: {
          allergies?: string | null
          belt_rank?: string
          birth_date?: string
          cell_phone?: string | null
          email?: string | null
          family_id?: string
          first_name?: string
          gender?: string
          grade_level?: string
          id?: string
          immunization_notes?: string | null
          immunizations_up_to_date?: boolean
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
          }
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
      waiver_signatures: {
        Row: {
          id: string
          signature_data: string
          signed_at: string
          user_id: string
          waiver_id: string
        }
        Insert: {
          id?: string
          signature_data: string
          signed_at: string
          user_id: string
          waiver_id: string
        }
        Update: {
          id?: string
          signature_data?: string
          signed_at?: string
          user_id?: string
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiver_signatures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiver_signatures_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          }
        ]
      }
      checkout_sessions: {
        Row: {
          id: string
          user_id: string
          payment_id: string | null
          session_id: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          payment_id?: string | null
          session_id: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          payment_id?: string | null
          session_id?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
