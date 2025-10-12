import type {Database} from '~/types/database.types';
import type {AttendanceRecord, Family, Guardian, Payment, Student, Waiver, WaiverSignature} from '~/types/models';
import { centsFromRow } from "~/utils/database-money";
import { fromCents } from "~/utils/money";
import type {Program, Class, ClassSession} from '~/types/multi-class';
import {PaymentStatus} from "~/types/models"; // Import the enum

// Utility function to convert null values to undefined in an object
export function nullToUndefined<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: T[K] extends null ? undefined : T[K] } {
  const result = {} as { [K in keyof T]: T[K] extends null ? undefined : T[K] };
  for (const [key, value] of Object.entries(obj)) {
    (result as Record<string, unknown>)[key] = value === null ? undefined : value;
  }
  return result;
}

// Utility function to map program object with null-to-undefined conversion
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapProgramNullToUndefined(program: any): Program {
  const mapped = nullToUndefined(program) as Program;
  return {
    ...mapped,
    engagement_type: mapped.engagement_type ?? 'program',
    audience_scope: mapped.audience_scope ?? 'youth',
    min_capacity: mapped.min_capacity ?? undefined,
    monthly_fee: program.monthly_fee_cents != null ? fromCents(program.monthly_fee_cents) : mapped.monthly_fee,
    registration_fee: program.registration_fee_cents != null ? fromCents(program.registration_fee_cents) : mapped.registration_fee,
    yearly_fee: program.yearly_fee_cents != null ? fromCents(program.yearly_fee_cents) : mapped.yearly_fee,
    individual_session_fee: program.individual_session_fee_cents != null ? fromCents(program.individual_session_fee_cents) : mapped.individual_session_fee,
    single_purchase_price: program.single_purchase_price_cents != null ? fromCents(program.single_purchase_price_cents) : mapped.single_purchase_price,
    subscription_monthly_price: program.subscription_monthly_price_cents != null ? fromCents(program.subscription_monthly_price_cents) : mapped.subscription_monthly_price,
    subscription_yearly_price: program.subscription_yearly_price_cents != null ? fromCents(program.subscription_yearly_price_cents) : mapped.subscription_yearly_price,
  };
}

// Utility function to map instructor object with null-to-undefined conversion
export function mapInstructorNullToUndefined(instructor: { id: string; first_name: string | null; last_name: string | null; email: string }) {
  return {
    id: instructor.id,
    first_name: instructor.first_name ?? '',
    last_name: instructor.last_name ?? '',
    email: instructor.email,
  };
}

// Utility function to map session object with null-to-undefined conversion
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSessionNullToUndefined(session: any): ClassSession {
  const mapped = nullToUndefined(session);
  return {
    ...mapped,
    status: session.status as 'completed' | 'cancelled' | 'scheduled'
  } as ClassSession;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapClassNullToUndefined(classObj: any): Class & { program: Program } {
  const mappedClass = nullToUndefined(classObj);
  return {
    ...mappedClass,
    program: mapProgramNullToUndefined(classObj.program)
  } as Class & { program: Program };
}

export function mapEnrollmentProgramNullToUndefined(program: Program) {
  return {
    ...program,
    description: program.description ?? undefined,
    max_capacity: program.max_capacity ?? undefined,
    min_capacity: program.min_capacity ?? undefined,
    belt_rank_required: program.belt_rank_required ?? false,
    gender_restriction: (program.gender_restriction as 'male' | 'female' | 'none') ?? undefined,
    individual_session_fee: program.individual_session_fee ?? undefined,
    yearly_fee: program.yearly_fee ?? undefined,
    min_sessions_per_week: program.min_sessions_per_week ?? undefined,
    max_sessions_per_week: program.max_sessions_per_week ?? undefined,
    monthly_fee: program.monthly_fee ?? undefined,
    registration_fee: program.registration_fee ?? undefined,
    single_purchase_price: program.single_purchase_price ?? undefined,
    subscription_monthly_price: program.subscription_monthly_price ?? undefined,
    subscription_yearly_price: program.subscription_yearly_price ?? undefined,
    min_belt_rank: program.min_belt_rank ?? undefined,
    max_belt_rank: program.max_belt_rank ?? undefined,
    sessions_per_week: program.sessions_per_week ?? undefined,
    min_age: program.min_age ?? undefined,
    max_age: program.max_age ?? undefined,
    special_needs_support: program.special_needs_support ?? undefined,
    prerequisite_programs: program.prerequisite_programs ?? undefined,
    duration_minutes: program.duration_minutes ?? undefined,
    ability_category: program.ability_category ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapEnrollmentClassNullToUndefined(classObj: any): Class & { program: Program } {
  const mappedClass = nullToUndefined(classObj);
  return {
    ...mappedClass,
    program: mapEnrollmentProgramNullToUndefined(classObj.program)
  } as Class & { program: Program };
}


// Convert database student row to Student type
export function mapStudentFromSupabase(row: Database['public']['Tables']['students']['Row']): Student {
    return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        gender: row.gender,
        birthDate: row.birth_date || '', // Handle null birth_date
        cellPhone: row.cell_phone || undefined,
        email: row.email || undefined,
        tShirtSize: row.t_shirt_size || '', // Handle null t_shirt_size
        school: row.school || '', // Handle null school
        gradeLevel: row.grade_level || '',
        specialNeeds: row.special_needs || undefined,
        allergies: row.allergies || undefined,
        medications: row.medications || undefined,
        immunizationsUpToDate: row.immunizations_up_to_date === 'true',
        immunizationNotes: row.immunization_notes || undefined,
        // beltRank removed
        familyId: row.family_id,
        // Relationships are loaded separately
        achievements: [], // Consider renaming to beltAwards if Achievement type is updated/removed
        attendanceRecords: []
    };
}

// Convert Student type to database insert/update shape
export function mapStudentToSupabase(student: Student): Database['public']['Tables']['students']['Insert'] {
    return {
        id: student.id,
        first_name: student.firstName,
        last_name: student.lastName,
        gender: student.gender,
        birth_date: student.birthDate,
        cell_phone: student.cellPhone,
        email: student.email,
        t_shirt_size: student.tShirtSize as Database['public']['Enums']['t_shirt_size_enum'],
        school: student.school,
        grade_level: student.gradeLevel,
        special_needs: student.specialNeeds,
        allergies: student.allergies,
        medications: student.medications,
        immunizations_up_to_date: student.immunizationsUpToDate ? 'true' : 'false',
        immunization_notes: student.immunizationNotes,
        // belt_rank removed
        family_id: student.familyId // Assuming familyId exists on Student
    };
}

// Similar mappings for other types
export function mapGuardianFromSupabase(row: Database['public']['Tables']['guardians']['Row']): Guardian {
    return {
        id: row.id,
        firstName: row.first_name || '', // Split name if needed
        lastName: row.last_name || '',
        relationship: row.relationship,
        homePhone: row.home_phone || '',
        workPhone: row.work_phone || undefined,
        cellPhone: row.cell_phone,
        email: row.email,
        employer: row.employer || undefined,
        employerPhone: row.employer_phone || undefined,
        employerNotes: row.employer_notes || undefined
    };
}

export function mapFamilyFromSupabase(row: Database['public']['Tables']['families']['Row']): Family {
    return {
        id: row.id,
        name: row.name,
        address: row.address || '', // Handle null address
        city: row.city || '', // Handle null city
        province: row.province || '', // Handle null province
        postalCode: row.postal_code || '', // Handle null postal_code
        primaryPhone: row.primary_phone || '', // Handle null primary_phone
        email: row.email,
        referralSource: row.referral_source || undefined,
        referralName: row.referral_name || undefined,
        guardians: [],
        students: []
    };
}

export function mapFamilyToSupabase(family: Family): Database['public']['Tables']['families']['Insert'] {
    return {
        id: family.id,
        name: family.name,
        address: family.address,
        city: family.city,
        province: family.province,
        postal_code: family.postalCode,
        primary_phone: family.primaryPhone,
        email: family.email,
        referral_source: family.referralSource,
        referral_name: family.referralName
    };
}

export function mapGuardianToSupabase(guardian: Guardian & {
    familyId: string
}): Database['public']['Tables']['guardians']['Insert'] {
    return {
        id: guardian.id,
        first_name: guardian.firstName,
        last_name: guardian.lastName,
        relationship: guardian.relationship,
        home_phone: guardian.homePhone,
        cell_phone: guardian.cellPhone,
        work_phone: guardian.workPhone,
        email: guardian.email,
        employer: guardian.employer,
        employer_phone: guardian.employerPhone,
        employer_notes: guardian.employerNotes,
        family_id: guardian.familyId
    };
}

// Payment mappers
export function mapPaymentFromSupabase(row: Database['public']['Tables']['payments']['Row'], studentIds: string[] = []): Payment {
    return {
        id: row.id,
        familyId: row.family_id,
        // Normalize to cents via centralized rules
        subtotalAmount: centsFromRow('payments', 'subtotal_amount', row as unknown as Record<string, unknown>),
        // taxAmount removed - tax details are in payment_taxes relation
        totalAmount: centsFromRow('payments', 'total_amount', row as unknown as Record<string, unknown>),
        paymentDate: row.payment_date ?? undefined, // Convert null to undefined to match Payment type
        paymentMethod: row.payment_method ?? undefined, // Convert null to undefined to match Payment type
        status: row.status as PaymentStatus,
        studentIds: studentIds
    };
}

export function mapPaymentToSupabase(payment: Payment): Database['public']['Tables']['payments']['Insert'] {
    // Ensure required fields for Insert are present
    // Removed taxAmount check
    if (payment.subtotalAmount === undefined || payment.totalAmount === undefined) {
        throw new Error("Cannot map Payment to Supabase Insert: Missing required amount fields (subtotalAmount, totalAmount).");
    }
    return {
        // id: payment.id, // ID is usually generated by DB on insert, so omit it
        family_id: payment.familyId,
        // Store cents in numeric columns per schema
        subtotal_amount: payment.subtotalAmount,
        // tax_amount removed
        total_amount: payment.totalAmount,
        payment_date: payment.paymentDate,
        payment_method: payment.paymentMethod,
        status: payment.status
    };
}

// Attendance mappers
export function mapAttendanceFromSupabase(row: Database['public']['Tables']['attendance']['Row']): AttendanceRecord {
    if (!row.class_session_id) {
        throw new Error("Class session ID is missing for an attendance record.");
    }
    return {
        id: row.id,
        studentId: row.student_id,
        classSessionId: row.class_session_id,
        status: row.status as 'present' | 'absent' | 'excused' | 'late',
        notes: row.notes || undefined,
        // Note: class_date and present fields are derived from class_sessions and status
        classDate: '', // This should be populated from class_sessions.session_date
        present: row.status === 'present' || row.status === 'late'
    };
}

export function mapAttendanceToSupabase(record: Omit<AttendanceRecord, 'id'>): Database['public']['Tables']['attendance']['Insert'] {
    return {
        student_id: record.studentId,
        class_session_id: record.classSessionId,
        status: record.status,
        notes: record.notes
        // Note: class_date and present are not stored in the current attendance table
    };
}

// Waiver mappers
export function mapWaiverFromSupabase(row: Database['public']['Tables']['waivers']['Row']): Waiver {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        content: row.content,
        required: row.required
    };
}

export function mapWaiverToSupabase(waiver: Waiver): Database['public']['Tables']['waivers']['Insert'] {
    return {
        id: waiver.id,
        title: waiver.title,
        description: waiver.description,
        content: waiver.content,
        required: waiver.required
    };
}

// Waiver signature mappers
export function mapWaiverSignatureFromSupabase(row: Database['public']['Tables']['waiver_signatures']['Row']): WaiverSignature {
    return {
        id: row.id,
        waiverId: row.waiver_id,
        userId: row.user_id,
        signatureData: row.signature_data,
        signedAt: row.signed_at
    };
}

export function mapWaiverSignatureToSupabase(signature: WaiverSignature): Database['public']['Tables']['waiver_signatures']['Insert'] {
    return {
        id: signature.id,
        waiver_id: signature.waiverId,
        user_id: signature.userId,
        agreement_version: signature.waiverId, // Use waiverId as the version identifier
        signature_data: signature.signatureData,
        signed_at: signature.signedAt
    };
}

// Example usage in components:
// When loading data:
// const { data } = await supabase.from('students').select('*');
// const students = data?.map(mapStudentFromSupabase) || [];

// When saving data:
// const dbStudent = mapStudentToSupabase(student);
// await supabase.from('students').upsert(dbStudent);
