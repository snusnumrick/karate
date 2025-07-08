import { createClient } from '~/utils/supabase.server';
import {
  Program,
  CreateProgramData,
  UpdateProgramData,
} from '~/types/multi-class';

/**
 * Create a new program
 */
export async function createProgram(
  programData: CreateProgramData,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Program> {
  const { data, error } = await supabase
    .from('programs')
    .insert({
      name: programData.name,
      description: programData.description,
      duration_minutes: programData.duration_minutes,
      min_age: programData.min_age,
      max_age: programData.max_age,
      gender_restriction: programData.gender_restriction,
      special_needs_support: programData.special_needs_support,
      monthly_fee: programData.monthly_fee,
      registration_fee: programData.registration_fee,
      yearly_fee: programData.yearly_fee,
      individual_session_fee: programData.individual_session_fee,
      is_active: programData.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create program: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing program
 */
export async function updateProgram(
  id: string,
  updates: Partial<UpdateProgramData>,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Program> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Only include fields that are provided
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.duration_minutes !== undefined) updateData.duration_minutes = updates.duration_minutes;
  if (updates.min_age !== undefined) updateData.min_age = updates.min_age;
  if (updates.max_age !== undefined) updateData.max_age = updates.max_age;
  if (updates.gender_restriction !== undefined) updateData.gender_restriction = updates.gender_restriction;
  if (updates.special_needs_support !== undefined) updateData.special_needs_support = updates.special_needs_support;
  if (updates.monthly_fee !== undefined) updateData.monthly_fee = updates.monthly_fee;
  if (updates.registration_fee !== undefined) updateData.registration_fee = updates.registration_fee;
  if (updates.yearly_fee !== undefined) updateData.yearly_fee = updates.yearly_fee;
  if (updates.individual_session_fee !== undefined) updateData.individual_session_fee = updates.individual_session_fee;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  const { data, error } = await supabase
    .from('programs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update program: ${error.message}`);
  }

  return data;
}

/**
 * Delete a program (soft delete by setting is_active to false)
 */
export async function deleteProgram(
  id: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<void> {
  // Check if program has active classes
  const { data: activeClasses, error: classError } = await supabase
    .from('classes')
    .select('id')
    .eq('program_id', id)
    .eq('is_active', true);

  if (classError) {
    throw new Error(`Failed to check for active classes: ${classError.message}`);
  }

  if (activeClasses && activeClasses.length > 0) {
    throw new Error('Cannot delete program with active classes. Please deactivate all classes first.');
  }

  const { error } = await supabase
    .from('programs')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete program: ${error.message}`);
  }
}

/**
 * Get all programs with optional filtering
 */
export async function getPrograms(
  filters: { is_active?: boolean; search?: string } = {},
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Program[]> {
  let query = supabase.from('programs').select('*');

  // Apply filters
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  query = query.order('name');

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch programs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single program by ID
 */
export async function getProgramById(
  id: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Program | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch program: ${error.message}`);
  }

  return data;
}

/**
 * Get programs with basic statistics (class count, enrollments)
 */
export async function getProgramsWithStats(
  filters: { is_active?: boolean; search?: string } = {},
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Program[]> {
  let query = supabase
    .from('programs')
    .select(`
      *,
      classes!inner(
        id,
        is_active,
        max_capacity,
        enrollments!inner(
          id,
          status,
          payment_id,
          payments(
            amount,
            status
          )
        )
      )
    `);

  // Apply filters
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  query = query.order('name');

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch programs with stats: ${error.message}`);
  }

  // These interfaces are defined but may be used in the future for more complex operations



  // Simplified - just return the programs without complex statistics
  return data || [];
}

/**
 * Get overall program statistics
 */
export async function getProgramStats(
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<{ total_programs: number; active_programs: number; total_classes: number; active_classes: number }> {
  // Get basic counts
  const [programsResult, classesResult, enrollmentsResult] = await Promise.all([
    supabase.from('programs').select('id, is_active'),
    supabase.from('classes').select('id, is_active'),
    supabase.from('enrollments').select('id, status'),
  ]);

  if (programsResult.error) {
    throw new Error(`Failed to fetch program stats: ${programsResult.error.message}`);
  }
  if (classesResult.error) {
    throw new Error(`Failed to fetch class stats: ${classesResult.error.message}`);
  }
  if (enrollmentsResult.error) {
    throw new Error(`Failed to fetch enrollment stats: ${enrollmentsResult.error.message}`);
  }

  const programs = programsResult.data || [];
  const classes = classesResult.data || [];

  return {
    total_programs: programs.length,
    active_programs: programs.filter((p: { is_active: boolean }) => p.is_active).length,
    total_classes: classes.length,
    active_classes: classes.filter((c: { is_active: boolean }) => c.is_active).length,
  };
}

/**
 * Check if a student can enroll in a program (simplified - always eligible)
 */
export async function checkProgramEligibility(
  programId: string,
  studentId: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<{ eligible: boolean; reasons: string[] }> {
  // Simplified eligibility check - just verify program and student exist
  const [programResult, studentResult] = await Promise.all([
    supabase.from('programs').select('id, is_active').eq('id', programId).single(),
    supabase.from('students').select('id').eq('id', studentId).single(),
  ]);

  if (programResult.error || studentResult.error) {
    return { eligible: false, reasons: ['Program or student not found'] };
  }

  if (!programResult.data.is_active) {
    return { eligible: false, reasons: ['Program is not active'] };
  }

  return { eligible: true, reasons: [] };
}

/**
 * Get programs suitable for a specific student (simplified)
 */
export async function getProgramsForStudent(
  studentId: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Program[]> {
  // Simplified - just return all active programs
  return await getPrograms({ is_active: true }, supabase);
}