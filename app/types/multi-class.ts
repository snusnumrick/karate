// Multi-Class System TypeScript Types
// This file defines all the types and interfaces for the program and class management system

import { Money } from "~/utils/money";

export interface ClassSchedule {
  id: string;
  class_id: string;
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface Program {
  id: string;
  name: string;
  description?: string;
  duration_minutes?: number;
  // Capacity constraints
  max_capacity?: number;
  // Frequency constraints
  sessions_per_week?: number;
  min_sessions_per_week?: number;
  max_sessions_per_week?: number;
  // Belt requirements
  min_belt_rank?: 'white' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'brown' | 'black';
  max_belt_rank?: 'white' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'brown' | 'black';
  belt_rank_required?: boolean;
  // Prerequisite programs
  prerequisite_programs?: string[];
  // Age and demographic constraints
  min_age?: number;
  max_age?: number;
  gender_restriction?: 'male' | 'female' | 'none';
  special_needs_support?: boolean;
  // Pricing structure
  monthly_fee?: Money;
  registration_fee?: Money;
  yearly_fee?: Money;
  individual_session_fee?: Money;
  // System fields
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  program_id: string;
  name: string;
  description?: string;
  max_capacity?: number;
  instructor_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  program?: Program; // Optional program reference
  instructor?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface ClassEnrollment {
  id: string;
  class_id: string;
  student_id: string;
  program_id: string;
  status: 'active' | 'inactive' | 'dropped' | 'completed' | 'waitlist' | 'trial';
  enrolled_at: string;
  completed_at?: string;
  dropped_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Relations
  class?: Class;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
    birth_date: string;
    family_id: string;
  };
}


export interface ClassSession {
  id: string;
  class_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  instructor_id?: string;
  created_at: string;
  updated_at: string;
  // Relations
  class?: Class;
  attendance?: {
    student_id: string;
    status: 'present' | 'absent' | 'late';
  }[];
}

export interface ClassMessageRecipient {
  id: string;
  conversation_id: string;
  family_id: string;
  student_id?: string;
  class_id: string;
  created_at: string;
}

// Form types for creating/updating
export interface CreateProgramData {
  name: string;
  description?: string;
  duration_minutes?: number;
  // Capacity constraints
  max_capacity?: number;
  // Frequency constraints
  sessions_per_week?: number;
  min_sessions_per_week?: number;
  max_sessions_per_week?: number;
  // Belt requirements
  min_belt_rank?: 'white' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'brown' | 'black';
  max_belt_rank?: 'white' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'brown' | 'black';
  belt_rank_required?: boolean;
  // Prerequisite programs
  prerequisite_programs?: string[];
  // Age and demographic constraints
  min_age?: number;
  max_age?: number;
  gender_restriction?: 'male' | 'female' | 'none';
  special_needs_support?: boolean;
  // Pricing structure
  monthly_fee?: Money;
  registration_fee?: Money;
  yearly_fee?: Money;
  individual_session_fee?: Money;
  // System fields
  is_active?: boolean;
}

export interface UpdateProgramData extends Partial<CreateProgramData> {
  id: string;
}

export interface CreateClassData {
  program_id: string; // Required
  name: string;
  description?: string;
  max_capacity?: number;
  instructor_id?: string;
  is_active?: boolean;
}

export interface UpdateClassData extends Partial<CreateClassData> {
  id: string;
}

export interface CreateEnrollmentData {
  class_id: string;
  student_id: string;
  program_id: string;
  status?: 'active' | 'waitlist' | 'trial';
  notes?: string;
}

export interface UpdateEnrollmentData {
  id: string;
  class_id?: string;
  student_id?: string;
  status?: 'active' | 'inactive' | 'dropped' | 'completed' | 'waitlist' | 'trial';
  notes?: string;
}

export interface CreateSessionData {
  class_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export interface UpdateSessionData extends Partial<CreateSessionData> {
  id: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  instructor_id?: string;
}

// Query filters and options
export interface ProgramFilters {
  is_active?: boolean;
  search?: string;
}

export interface ClassFilters {
  program_id?: string;
  instructor_id?: string;
  is_active?: boolean;
  search?: string;
}

export interface EnrollmentFilters {
  class_id?: string;
  student_id?: string;
  family_id?: string;
  status?: 'active' | 'inactive' | 'dropped' | 'completed' | 'waitlist' | 'trial';
  enrollment_date_from?: string;
  enrollment_date_to?: string;
}

export interface SessionFilters {
  session_id?: string;
  class_id?: string;
  session_date_from?: string;
  session_date_to?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  instructor_id?: string;
}

// Calendar and scheduling types
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'class' | 'session';
  class_id: string;
  session_id?: string;
  enrollment_count: number;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface WeeklySchedule {
  [key: string]: CalendarEvent[]; // key is day of week (monday, tuesday, etc.)
}

// Enrollment statistics and analytics
export interface EnrollmentStats {
  total_enrolled: number;
  active_enrollments: number;
  waitlist_count: number;
  completion_rate: number;
  average_attendance: number;
}

export interface ProgramStats {
  total_programs: number;
  active_programs: number;
  total_classes: number;
  total_enrollments: number;
  revenue_by_program: {
    program_id: string;
    program_name: string;
    monthly_revenue: number;
    enrollment_count: number;
  }[];
}

// Messaging types for class announcements
export interface ClassAnnouncementData {
  class_id: string;
  subject: string;
  content: string;
  send_to_all?: boolean;
  specific_students?: string[];
}

// Validation and business rule types
export interface EnrollmentValidation {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  capacity_available: boolean;
  meets_eligibility: boolean;
  age_appropriate: boolean;
  belt_requirements_met: boolean;
}

export interface ScheduleConflict {
  student_id: string;
  student_name: string;
  conflicting_class_id: string;
  conflicting_class_name: string;
  conflict_days: string[];
  conflict_times: {
    start: string;
    end: string;
  };
}

// Payment integration types
export interface ClassPaymentData {
  program_id: string;
  class_id: string;
  student_id: string;
  enrollment_type: 'full_session' | 'monthly' | 'drop_in';
  discount_codes?: string[];
  amount: Money;
  registration_fee?: Money;
  family_discount_applied?: Money;
}

// Bulk operations
export interface BulkEnrollmentData {
  class_id: string;
  student_ids: string[];
  enrollment_type: 'active' | 'waitlist';
  payment_method?: 'immediate' | 'deferred';
  notes?: string;
}

export interface BulkSessionGeneration {
  class_id: string;
  start_date: string;
  end_date: string;
  exclude_dates?: string[]; // holidays, breaks
  override_instructor?: string;
}

// Export utility types
export type ProgramWithStats = Program & {
  class_count: number;
  total_enrollments: number;
  active_enrollments: number;
  monthly_revenue: number;
};

export type ClassWithDetails = Class & {
  program: Program;
  enrollment_count: number;
  next_session?: ClassSession;
  recent_sessions: ClassSession[];
  next_scheduled_time: string | null;
};

export type StudentWithEnrollments = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  family_id: string;
  enrollments: (ClassEnrollment & {
    class: Class & { program: Program };
  })[];
};

export type FamilyWithClassEnrollments = {
  id: string;
  name: string;
  email: string;
  students: StudentWithEnrollments[];
  total_monthly_fees: Money;
  active_class_count: number;
};
