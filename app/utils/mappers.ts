import type { Database } from '~/types/supabase';
import type { Family, Guardian, Student, Payment, WaiverSignature } from '~/types/models';

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
    gradeLevel: row.grade_level,
    specialNeeds: row.special_needs || undefined,
    allergies: row.allergies || undefined,
    medications: row.medications || undefined,
    immunizationsUpToDate: row.immunizations_up_to_date,
    immunizationNotes: row.immunization_notes || undefined,
    beltRank: row.belt_rank,
    familyId: row.family_id,
    // Relationships are loaded separately
    achievements: [],
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
    immunizations_up_to_date: student.immunizationsUpToDate,
    immunization_notes: student.immunizationNotes,
    belt_rank: student.beltRank,
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
    homePhone: row.home_phone,
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
    primaryPhone: row.phone,
    email: row.email,
    referralSource: row.referral_source || undefined,
    referralName: row.referral_name || undefined,
    guardians: [],
    students: []
  };
}

// Example usage in components:
// When loading data:
// const { data } = await supabase.from('students').select('*');
// const students = data?.map(mapStudentFromSupabase) || [];

// When saving data:
// const dbStudent = mapStudentToSupabase(student);
// await supabase.from('students').upsert(dbStudent);
