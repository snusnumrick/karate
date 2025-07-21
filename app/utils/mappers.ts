import type {Database} from '~/types/database.types';
import type {AttendanceRecord, Family, Guardian, Payment, Student, Waiver, WaiverSignature} from '~/types/models';
import {PaymentStatus} from "~/types/models"; // Import the enum


// Convert database student row to Student type
export function mapStudentFromSupabase(row: Database['public']['Tables']['students']['Row']): Student {
    return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        gender: row.gender,
        birthDate: row.birth_date,
        cellPhone: row.cell_phone || undefined,
        email: row.email || undefined,
        tShirtSize: row.t_shirt_size,
        school: row.school,
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
        t_shirt_size: student.tShirtSize,
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
        address: row.address,
        city: row.city,
        province: row.province,
        postalCode: row.postal_code,
        primaryPhone: row.primary_phone,
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
        // Use new amount fields, provide defaults if null
        subtotalAmount: row.subtotal_amount ?? 0, // Default to 0 if null, though DB should be NOT NULL
        // taxAmount removed - tax details are in payment_taxes relation
        totalAmount: row.total_amount ?? 0,
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
        // Use new amount fields
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
