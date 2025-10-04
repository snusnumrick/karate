import { getSupabaseAdminClient } from '~/utils/supabase.server';
import type { Database } from '~/types/database.types';

type Family = Database['public']['Tables']['families']['Row'];
type Student = Database['public']['Tables']['students']['Row'];

interface SelfRegistrantData {
  profileId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emergencyContact?: string;
}

interface SelfRegistrant {
  family: Family;
  student: Student;
}

/**
 * Create a self-registrant family and adult student record
 * This is used when an adult signs up for a seminar or event without a family
 */
export async function createSelfRegistrant(
  data: SelfRegistrantData,
  supabase = getSupabaseAdminClient()
): Promise<SelfRegistrant> {
  // Check if profile already has a self family
  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('family_id, families(family_type)')
    .eq('id', data.profileId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    throw new Error(`Failed to check existing profile: ${profileError.message}`);
  }

  // If profile already has a self family, return it
  if (existingProfile?.family_id && existingProfile.families?.family_type === 'self') {
    const { data: existingFamily, error: familyError } = await supabase
      .from('families')
      .select('*')
      .eq('id', existingProfile.family_id)
      .single();

    if (familyError) {
      throw new Error(`Failed to fetch existing family: ${familyError.message}`);
    }

    const { data: existingStudent, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('family_id', existingProfile.family_id)
      .eq('profile_id', data.profileId)
      .eq('is_adult', true)
      .single();

    if (studentError) {
      throw new Error(`Failed to fetch existing student: ${studentError.message}`);
    }

    return {
      family: existingFamily,
      student: existingStudent,
    };
  }

  // Create new self family
  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({
      name: `${data.firstName} ${data.lastName}`,
      family_type: 'self',
      email: data.email,
      primary_phone: data.phone,
      emergency_contact: data.emergencyContact || null,
      // Optional fields for self-registrants
      address: null,
      city: null,
      province: null,
      postal_code: null,
    })
    .select()
    .single();

  if (familyError) {
    throw new Error(`Failed to create family: ${familyError.message}`);
  }

  // Create adult student record
  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({
      family_id: family.id,
      profile_id: data.profileId,
      is_adult: true,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      cell_phone: data.phone,
      // Required fields set to sensible defaults for adults
      gender: 'prefer_not_to_say',
      // Optional fields for adults
      birth_date: null,
      school: null,
      grade_level: null,
      t_shirt_size: null,
    })
    .select()
    .single();

  if (studentError) {
    // Rollback family creation if student creation fails
    await supabase.from('families').delete().eq('id', family.id);
    throw new Error(`Failed to create student: ${studentError.message}`);
  }

  // Update profile with family_id
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ family_id: family.id })
    .eq('id', data.profileId);

  if (updateError) {
    console.error('Failed to update profile with family_id:', updateError);
    // Don't throw here, as family and student are already created
  }

  return {
    family,
    student,
  };
}

/**
 * Get self-registrant by profile ID
 */
export async function getSelfRegistrantByProfileId(
  profileId: string,
  supabase = getSupabaseAdminClient()
): Promise<SelfRegistrant | null> {
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*, families(*)')
    .eq('profile_id', profileId)
    .eq('is_adult', true)
    .single();

  if (studentError) {
    if (studentError.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch self-registrant: ${studentError.message}`);
  }

  if (!student.families) {
    throw new Error('Student family not found');
  }

  return {
    family: student.families as Family,
    student: student as Student,
  };
}

/**
 * Check if a profile is a self-registrant
 */
export async function isSelfRegistrant(
  profileId: string,
  supabase = getSupabaseAdminClient()
): Promise<boolean> {
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', profileId)
    .eq('is_adult', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return false; // Not found
    }
    throw new Error(`Failed to check self-registrant status: ${error.message}`);
  }

  return !!data;
}

/**
 * Get all self-registrants (for admin purposes)
 */
export async function getAllSelfRegistrants(
  supabase = getSupabaseAdminClient()
): Promise<Array<{ family: Family; student: Student }>> {
  const { data, error } = await supabase
    .from('students')
    .select('*, families(*)')
    .eq('is_adult', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch self-registrants: ${error.message}`);
  }

  return (data || []).map((student) => ({
    family: student.families as Family,
    student: student as Student,
  }));
}

/**
 * Update self-registrant contact information
 */
export async function updateSelfRegistrant(
  profileId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    emergencyContact?: string;
  },
  supabase = getSupabaseAdminClient()
): Promise<SelfRegistrant> {
  // Get existing self-registrant
  const existing = await getSelfRegistrantByProfileId(profileId, supabase);
  if (!existing) {
    throw new Error('Self-registrant not found');
  }

  // Update student
  const studentUpdates: Record<string, unknown> = {};
  if (updates.firstName) studentUpdates.first_name = updates.firstName;
  if (updates.lastName) studentUpdates.last_name = updates.lastName;
  if (updates.email) studentUpdates.email = updates.email;
  if (updates.phone) studentUpdates.cell_phone = updates.phone;

  if (Object.keys(studentUpdates).length > 0) {
    const { error: studentError } = await supabase
      .from('students')
      .update(studentUpdates)
      .eq('id', existing.student.id);

    if (studentError) {
      throw new Error(`Failed to update student: ${studentError.message}`);
    }
  }

  // Update family
  const familyUpdates: Record<string, unknown> = {};
  if (updates.firstName || updates.lastName) {
    const firstName = updates.firstName || existing.student.first_name;
    const lastName = updates.lastName || existing.student.last_name;
    familyUpdates.name = `${firstName} ${lastName}`;
  }
  if (updates.email) familyUpdates.email = updates.email;
  if (updates.phone) familyUpdates.primary_phone = updates.phone;
  if (updates.emergencyContact !== undefined) {
    familyUpdates.emergency_contact = updates.emergencyContact;
  }

  if (Object.keys(familyUpdates).length > 0) {
    const { error: familyError } = await supabase
      .from('families')
      .update(familyUpdates)
      .eq('id', existing.family.id);

    if (familyError) {
      throw new Error(`Failed to update family: ${familyError.message}`);
    }
  }

  // Return updated self-registrant
  return getSelfRegistrantByProfileId(profileId, supabase).then((result) => {
    if (!result) {
      throw new Error('Failed to fetch updated self-registrant');
    }
    return result;
  });
}
