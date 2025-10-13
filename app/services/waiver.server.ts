import { getSupabaseAdminClient } from '~/utils/supabase.server';
import type { Database } from '~/types/database.types';

type WaiverRow = Database['public']['Tables']['waivers']['Row'];
type ProgramWaiverRow = Database['public']['Tables']['program_waivers']['Row'];

export interface WaiverRequirement {
  waiver_id: string;
  waiver_title: string;
  waiver_description: string;
  is_required: boolean;
  required_for_trial?: boolean;
  required_for_full_enrollment?: boolean;
}

export interface FamilyWaiverStatus {
  is_complete: boolean;
  completed_at: string | null;
  missing_waivers: WaiverRow[];
  signed_waivers: WaiverRow[];
}

export interface ProgramWaiverStatus {
  is_complete: boolean;
  missing_waivers: WaiverRequirement[];
  signed_waiver_ids: string[];
}

/**
 * Check if a family has completed all registration waivers
 */
export async function getFamilyRegistrationWaiverStatus(
  familyId: string,
  supabase = getSupabaseAdminClient()
): Promise<FamilyWaiverStatus> {
  // Get the primary user ID for this family
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('family_id', familyId)
    .limit(1)
    .single();

  if (!profile) {
    return {
      is_complete: false,
      completed_at: null,
      missing_waivers: [],
      signed_waivers: [],
    };
  }

  // Get all registration waivers
  const { data: registrationWaivers, error: waiversError } = await supabase
    .from('waivers')
    .select('*')
    .eq('required_for_registration', true);

  if (waiversError || !registrationWaivers) {
    throw new Error(`Failed to fetch registration waivers: ${waiversError?.message}`);
  }

  // Get which waivers this user has signed
  const { data: signatures } = await supabase
    .from('waiver_signatures')
    .select('waiver_id, signed_at')
    .eq('user_id', profile.id);

  const signedWaiverIds = new Set(signatures?.map(s => s.waiver_id) || []);

  const missingWaivers = registrationWaivers.filter(w => !signedWaiverIds.has(w.id));
  const signedWaivers = registrationWaivers.filter(w => signedWaiverIds.has(w.id));
  const isComplete = missingWaivers.length === 0 && registrationWaivers.length > 0;

  // Get completion timestamp (latest signature date)
  const completedAt = isComplete && signatures && signatures.length > 0
    ? signatures.reduce((latest, sig) =>
        sig.signed_at > latest ? sig.signed_at : latest,
        signatures[0].signed_at
      )
    : null;

  return {
    is_complete: isComplete,
    completed_at: completedAt,
    missing_waivers: missingWaivers,
    signed_waivers: signedWaivers,
  };
}

/**
 * Get program-specific waiver requirements for a user
 */
export async function getProgramWaiverStatus(
  userId: string,
  programId: string,
  enrollmentType: 'trial' | 'active' | 'pending_waivers' = 'active',
  supabase = getSupabaseAdminClient()
): Promise<ProgramWaiverStatus> {
  // Get program waivers with full waiver details
  const { data: programWaivers, error: pwError } = await supabase
    .from('program_waivers')
    .select(`
      *,
      waivers (
        id,
        title,
        description,
        content,
        required
      )
    `)
    .eq('program_id', programId)
    .eq('is_required', true);

  if (pwError) {
    throw new Error(`Failed to fetch program waivers: ${pwError.message}`);
  }

  if (!programWaivers || programWaivers.length === 0) {
    // No waivers required for this program
    return {
      is_complete: true,
      missing_waivers: [],
      signed_waiver_ids: [],
    };
  }

  // Filter based on enrollment type
  const relevantWaivers = programWaivers.filter(pw => {
    if (enrollmentType === 'trial') {
      return pw.required_for_trial;
    }
    return pw.required_for_full_enrollment;
  });

  if (relevantWaivers.length === 0) {
    return {
      is_complete: true,
      missing_waivers: [],
      signed_waiver_ids: [],
    };
  }

  // Get user's signed waivers
  const { data: signatures } = await supabase
    .from('waiver_signatures')
    .select('waiver_id')
    .eq('user_id', userId);

  const signedWaiverIds = signatures?.map(s => s.waiver_id) || [];
  const signedWaiverIdsSet = new Set(signedWaiverIds);

  // Determine missing waivers
  const missingWaivers: WaiverRequirement[] = relevantWaivers
    .filter(pw => !signedWaiverIdsSet.has(pw.waiver_id))
    .map(pw => {
      const waiver = pw.waivers as WaiverRow | WaiverRow[] | null;
      const waiverData = Array.isArray(waiver) ? waiver[0] : waiver;

      return {
        waiver_id: pw.waiver_id,
        waiver_title: waiverData?.title || 'Unknown',
        waiver_description: waiverData?.description || '',
        is_required: pw.is_required ?? true,
        required_for_trial: pw.required_for_trial ?? false,
        required_for_full_enrollment: pw.required_for_full_enrollment ?? true,
      };
    });

  return {
    is_complete: missingWaivers.length === 0,
    missing_waivers: missingWaivers,
    signed_waiver_ids: signedWaiverIds,
  };
}

/**
 * Get all required waivers for a program (for display purposes)
 */
export async function getProgramRequiredWaivers(
  programId: string,
  enrollmentType?: 'trial' | 'active',
  supabase = getSupabaseAdminClient()
): Promise<WaiverRequirement[]> {
  const { data: programWaivers, error } = await supabase
    .from('program_waivers')
    .select(`
      *,
      waivers (
        id,
        title,
        description
      )
    `)
    .eq('program_id', programId)
    .eq('is_required', true);

  if (error) {
    throw new Error(`Failed to fetch program waivers: ${error.message}`);
  }

  if (!programWaivers) {
    return [];
  }

  // Filter by enrollment type if specified
  let filtered = programWaivers;
  if (enrollmentType === 'trial') {
    filtered = programWaivers.filter(pw => pw.required_for_trial);
  } else if (enrollmentType === 'active') {
    filtered = programWaivers.filter(pw => pw.required_for_full_enrollment);
  }

  return filtered.map(pw => {
    const waiver = pw.waivers as WaiverRow | WaiverRow[] | null;
    const waiverData = Array.isArray(waiver) ? waiver[0] : waiver;

    return {
      waiver_id: pw.waiver_id,
      waiver_title: waiverData?.title || 'Unknown',
      waiver_description: waiverData?.description || '',
      is_required: pw.is_required ?? true,
      required_for_trial: pw.required_for_trial ?? false,
      required_for_full_enrollment: pw.required_for_full_enrollment ?? true,
    };
  });
}

/**
 * Add a waiver requirement to a program
 */
export async function addProgramWaiver(
  programId: string,
  waiverId: string,
  options: {
    is_required?: boolean;
    required_for_trial?: boolean;
    required_for_full_enrollment?: boolean;
  } = {},
  supabase = getSupabaseAdminClient()
): Promise<ProgramWaiverRow> {
  const { data, error } = await supabase
    .from('program_waivers')
    .insert({
      program_id: programId,
      waiver_id: waiverId,
      is_required: options.is_required ?? true,
      required_for_trial: options.required_for_trial ?? false,
      required_for_full_enrollment: options.required_for_full_enrollment ?? true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add program waiver: ${error.message}`);
  }

  return data;
}

/**
 * Remove a waiver requirement from a program
 */
export async function removeProgramWaiver(
  programId: string,
  waiverId: string,
  supabase = getSupabaseAdminClient()
): Promise<void> {
  const { error } = await supabase
    .from('program_waivers')
    .delete()
    .eq('program_id', programId)
    .eq('waiver_id', waiverId);

  if (error) {
    throw new Error(`Failed to remove program waiver: ${error.message}`);
  }
}

/**
 * Update program waiver settings
 */
export async function updateProgramWaiver(
  programId: string,
  waiverId: string,
  updates: {
    is_required?: boolean;
    required_for_trial?: boolean;
    required_for_full_enrollment?: boolean;
  },
  supabase = getSupabaseAdminClient()
): Promise<ProgramWaiverRow> {
  const { data, error } = await supabase
    .from('program_waivers')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('program_id', programId)
    .eq('waiver_id', waiverId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update program waiver: ${error.message}`);
  }

  return data;
}

/**
 * Get all enrollments pending waivers for a family
 */
export async function getPendingWaiverEnrollments(
  familyId: string,
  supabase = getSupabaseAdminClient()
) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      student:students!inner(
        id,
        first_name,
        last_name,
        family_id
      ),
      program:programs!inner(
        id,
        name,
        description
      ),
      class:classes!inner(
        id,
        name
      )
    `)
    .eq('status', 'pending_waivers')
    .eq('student.family_id', familyId);

  if (error) {
    throw new Error(`Failed to fetch pending waiver enrollments: ${error.message}`);
  }

  return data || [];
}

/**
 * Check if user needs to sign registration waivers (convenience function)
 */
export async function userNeedsRegistrationWaivers(
  userId: string,
  supabase = getSupabaseAdminClient()
): Promise<boolean> {
  // Get user's family
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', userId)
    .single();

  if (!profile?.family_id) {
    return true; // No family, needs waivers
  }

  const status = await getFamilyRegistrationWaiverStatus(profile.family_id, supabase);
  return !status.is_complete;
}
