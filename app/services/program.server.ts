import { getSupabaseAdminClient } from '~/utils/supabase.server';
import {
  Program,
  CreateProgramData,
  UpdateProgramData,
} from '~/types/multi-class';
import { toCents, fromCents } from '~/utils/money';

/**
 * Create a new program
 */
export async function createProgram(
  programData: CreateProgramData,
  supabase = getSupabaseAdminClient()
): Promise<Program> {
  const programInsert = {
    name: programData.name,
    description: programData.description,
    duration_minutes: programData.duration_minutes,
    // Capacity constraints
    max_capacity: programData.max_capacity,
    // Frequency constraints
    sessions_per_week: programData.sessions_per_week,
    min_sessions_per_week: programData.min_sessions_per_week,
    max_sessions_per_week: programData.max_sessions_per_week,
    // Belt requirements
    min_belt_rank: programData.min_belt_rank,
    max_belt_rank: programData.max_belt_rank,
    belt_rank_required: programData.belt_rank_required ?? false,
    // Prerequisite programs
    prerequisite_programs: programData.prerequisite_programs,
    // Age and demographic constraints
    min_age: programData.min_age,
    max_age: programData.max_age,
    gender_restriction: programData.gender_restriction,
    special_needs_support: programData.special_needs_support,
    // Pricing structure - convert Money to cents for storage
    monthly_fee_cents: programData.monthly_fee ? toCents(programData.monthly_fee) : null,
    registration_fee_cents: programData.registration_fee ? toCents(programData.registration_fee) : null,
    yearly_fee_cents: programData.yearly_fee ? toCents(programData.yearly_fee) : null,
    individual_session_fee_cents: programData.individual_session_fee ? toCents(programData.individual_session_fee) : null,
    // System fields
    is_active: programData.is_active ?? true,
  };

  // Supabase generated types are incomplete and missing required fields like 'name'
  // This is a known limitation with Supabase's type generation - regenerating types may help
  const { data, error } = await supabase
    .from('programs')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(programInsert as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create program: ${error.message}`);
  }

  return {
    ...data,
    description: data.description || undefined,
    duration_minutes: data.duration_minutes || undefined,
    max_capacity: data.max_capacity || undefined,
    sessions_per_week: data.sessions_per_week || undefined,
    min_sessions_per_week: data.min_sessions_per_week || undefined,
    max_sessions_per_week: data.max_sessions_per_week || undefined,
    min_belt_rank: data.min_belt_rank || undefined,
    max_belt_rank: data.max_belt_rank || undefined,
    belt_rank_required: data.belt_rank_required || undefined,
    prerequisite_programs: data.prerequisite_programs || undefined,
    min_age: data.min_age || undefined,
    max_age: data.max_age || undefined,
    gender_restriction: (data.gender_restriction as 'male' | 'female' | 'none') || undefined,
    special_needs_support: data.special_needs_support || undefined,
    // Seminar-specific fields
    ability_category: data.ability_category || undefined,
    delivery_format: data.delivery_format || undefined,
    slug: data.slug || undefined,
    // Convert cents back to Money objects
    monthly_fee: data.monthly_fee_cents != null ? fromCents(data.monthly_fee_cents) : undefined,
    registration_fee: data.registration_fee_cents != null ? fromCents(data.registration_fee_cents) : undefined,
    yearly_fee: data.yearly_fee_cents != null ? fromCents(data.yearly_fee_cents) : undefined,
    individual_session_fee: data.individual_session_fee_cents != null ? fromCents(data.individual_session_fee_cents) : undefined,
    single_purchase_price_cents: data.single_purchase_price_cents ?? undefined,
  };
}

/**
 * Update an existing program
 */
export async function updateProgram(
  id: string,
  updates: Partial<UpdateProgramData>,
  supabase = getSupabaseAdminClient()
): Promise<Program> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Only include fields that are provided
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.duration_minutes !== undefined) updateData.duration_minutes = updates.duration_minutes;
  // Capacity constraints
  if (updates.max_capacity !== undefined) updateData.max_capacity = updates.max_capacity;
  // Frequency constraints
  if (updates.sessions_per_week !== undefined) updateData.sessions_per_week = updates.sessions_per_week;
  if (updates.min_sessions_per_week !== undefined) updateData.min_sessions_per_week = updates.min_sessions_per_week;
  if (updates.max_sessions_per_week !== undefined) updateData.max_sessions_per_week = updates.max_sessions_per_week;
  // Belt requirements
  if (updates.min_belt_rank !== undefined) updateData.min_belt_rank = updates.min_belt_rank;
  if (updates.max_belt_rank !== undefined) updateData.max_belt_rank = updates.max_belt_rank;
  if (updates.belt_rank_required !== undefined) updateData.belt_rank_required = updates.belt_rank_required;
  // Prerequisite programs
  if (updates.prerequisite_programs !== undefined) updateData.prerequisite_programs = updates.prerequisite_programs;
  // Age and demographic constraints
  if (updates.min_age !== undefined) updateData.min_age = updates.min_age;
  if (updates.max_age !== undefined) updateData.max_age = updates.max_age;
  if (updates.gender_restriction !== undefined) updateData.gender_restriction = updates.gender_restriction;
  if (updates.special_needs_support !== undefined) updateData.special_needs_support = updates.special_needs_support;
  // Pricing structure - convert Money to cents
  if (updates.monthly_fee !== undefined) updateData.monthly_fee_cents = updates.monthly_fee ? toCents(updates.monthly_fee) : null;
  if (updates.registration_fee !== undefined) updateData.registration_fee_cents = updates.registration_fee ? toCents(updates.registration_fee) : null;
  if (updates.yearly_fee !== undefined) updateData.yearly_fee_cents = updates.yearly_fee ? toCents(updates.yearly_fee) : null;
  if (updates.individual_session_fee !== undefined) updateData.individual_session_fee_cents = updates.individual_session_fee ? toCents(updates.individual_session_fee) : null;
  // System fields
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

  return {
    ...data,
    description: data.description || undefined,
    duration_minutes: data.duration_minutes || undefined,
    max_capacity: data.max_capacity || undefined,
    sessions_per_week: data.sessions_per_week || undefined,
    min_sessions_per_week: data.min_sessions_per_week || undefined,
    max_sessions_per_week: data.max_sessions_per_week || undefined,
    min_belt_rank: data.min_belt_rank || undefined,
    max_belt_rank: data.max_belt_rank || undefined,
    belt_rank_required: data.belt_rank_required || undefined,
    prerequisite_programs: data.prerequisite_programs || undefined,
    min_age: data.min_age || undefined,
    max_age: data.max_age || undefined,
    gender_restriction: (data.gender_restriction as 'male' | 'female' | 'none') || undefined,
    special_needs_support: data.special_needs_support || undefined,
    // Seminar-specific fields
    ability_category: data.ability_category || undefined,
    delivery_format: data.delivery_format || undefined,
    slug: data.slug || undefined,
    // Convert cents back to Money objects
    monthly_fee: data.monthly_fee_cents != null ? fromCents(data.monthly_fee_cents) : undefined,
    registration_fee: data.registration_fee_cents != null ? fromCents(data.registration_fee_cents) : undefined,
    yearly_fee: data.yearly_fee_cents != null ? fromCents(data.yearly_fee_cents) : undefined,
    individual_session_fee: data.individual_session_fee_cents != null ? fromCents(data.individual_session_fee_cents) : undefined,
    single_purchase_price_cents: data.single_purchase_price_cents ?? undefined,
  };
}



/**
 * Get all programs with optional filtering
 */
export async function getPrograms(
  filters: {
    is_active?: boolean;
    search?: string;
    engagement_type?: 'program' | 'seminar';
    ability_category?: 'able' | 'adaptive';
    delivery_format?: 'group' | 'private' | 'competition_individual' | 'competition_team' | 'introductory';
    audience_scope?: 'youth' | 'adults' | 'mixed';
  } = {},
  supabase = getSupabaseAdminClient()
): Promise<Program[]> {
  let query = supabase.from('programs').select('*');

  // Apply filters
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters.engagement_type) {
    query = query.eq('engagement_type', filters.engagement_type);
  }

  if (filters.ability_category) {
    query = query.eq('ability_category', filters.ability_category);
  }

  if (filters.delivery_format) {
    query = query.eq('delivery_format', filters.delivery_format);
  }

  if (filters.audience_scope) {
    query = query.eq('audience_scope', filters.audience_scope);
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  query = query.order('name');

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch programs: ${error.message}`);
  }

  return (data || []).map(program => ({
    ...program,
    description: program.description || undefined,
    duration_minutes: program.duration_minutes || undefined,
    max_capacity: program.max_capacity || undefined,
    sessions_per_week: program.sessions_per_week || undefined,
    min_sessions_per_week: program.min_sessions_per_week || undefined,
    max_sessions_per_week: program.max_sessions_per_week || undefined,
    min_belt_rank: program.min_belt_rank || undefined,
    max_belt_rank: program.max_belt_rank || undefined,
    belt_rank_required: program.belt_rank_required || undefined,
    prerequisite_programs: program.prerequisite_programs || undefined,
    min_age: program.min_age || undefined,
    max_age: program.max_age || undefined,
    gender_restriction: (program.gender_restriction as 'male' | 'female' | 'none') || undefined,
    special_needs_support: program.special_needs_support || undefined,
    // Convert cents back to Money objects
    monthly_fee: program.monthly_fee_cents != null ? fromCents(program.monthly_fee_cents) : undefined,
    registration_fee: program.registration_fee_cents != null ? fromCents(program.registration_fee_cents) : undefined,
    yearly_fee: program.yearly_fee_cents != null ? fromCents(program.yearly_fee_cents) : undefined,
    individual_session_fee: program.individual_session_fee_cents != null ? fromCents(program.individual_session_fee_cents) : undefined,
  }));
}

/**
 * Get a single program by ID
 */
export async function getProgramById(
  id: string,
  supabase = getSupabaseAdminClient()
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

  return {
    ...data,
    description: data.description || undefined,
    duration_minutes: data.duration_minutes || undefined,
    max_capacity: data.max_capacity || undefined,
    sessions_per_week: data.sessions_per_week || undefined,
    min_sessions_per_week: data.min_sessions_per_week || undefined,
    max_sessions_per_week: data.max_sessions_per_week || undefined,
    min_belt_rank: data.min_belt_rank || undefined,
    max_belt_rank: data.max_belt_rank || undefined,
    belt_rank_required: data.belt_rank_required || undefined,
    prerequisite_programs: data.prerequisite_programs || undefined,
    min_age: data.min_age || undefined,
    max_age: data.max_age || undefined,
    gender_restriction: (data.gender_restriction as 'male' | 'female' | 'none') || undefined,
    special_needs_support: data.special_needs_support || undefined,
    // Seminar-specific fields
    ability_category: data.ability_category || undefined,
    delivery_format: data.delivery_format || undefined,
    slug: data.slug || undefined,
    // Convert cents back to Money objects
    monthly_fee: data.monthly_fee_cents != null ? fromCents(data.monthly_fee_cents) : undefined,
    registration_fee: data.registration_fee_cents != null ? fromCents(data.registration_fee_cents) : undefined,
    yearly_fee: data.yearly_fee_cents != null ? fromCents(data.yearly_fee_cents) : undefined,
    individual_session_fee: data.individual_session_fee_cents != null ? fromCents(data.individual_session_fee_cents) : undefined,
    single_purchase_price_cents: data.single_purchase_price_cents ?? undefined,
  };
}

/**
 * Get programs with basic statistics (class count, enrollments)
 */
export async function getProgramsWithStats(
  filters: { is_active?: boolean; search?: string } = {},
  supabase = getSupabaseAdminClient()
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
  return (data || []).map(program => ({
    ...program,
    description: program.description || undefined,
    duration_minutes: program.duration_minutes || undefined,
    max_capacity: program.max_capacity || undefined,
    sessions_per_week: program.sessions_per_week || undefined,
    min_sessions_per_week: program.min_sessions_per_week || undefined,
    max_sessions_per_week: program.max_sessions_per_week || undefined,
    min_belt_rank: program.min_belt_rank || undefined,
    max_belt_rank: program.max_belt_rank || undefined,
    belt_rank_required: program.belt_rank_required || undefined,
    prerequisite_programs: program.prerequisite_programs || undefined,
    min_age: program.min_age || undefined,
    max_age: program.max_age || undefined,
    gender_restriction: (program.gender_restriction as 'male' | 'female' | 'none') || undefined,
    special_needs_support: program.special_needs_support || undefined,
    // Convert cents back to Money objects
    monthly_fee: program.monthly_fee_cents != null ? fromCents(program.monthly_fee_cents) : undefined,
    registration_fee: program.registration_fee_cents != null ? fromCents(program.registration_fee_cents) : undefined,
    yearly_fee: program.yearly_fee_cents != null ? fromCents(program.yearly_fee_cents) : undefined,
    individual_session_fee: program.individual_session_fee_cents != null ? fromCents(program.individual_session_fee_cents) : undefined,
  }));
}

/**
 * Get overall program statistics
 */
export async function getProgramStats(
  supabase = getSupabaseAdminClient()
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
 * Check if a student can enroll in a program using database function
 */
export async function checkProgramEligibility(
  programId: string,
  studentId: string,
  supabase = getSupabaseAdminClient()
): Promise<{ eligible: boolean; reasons: string[] }> {
  try {
    // Use the database function for comprehensive eligibility checking
    // Note: The function returns a simple boolean, not an object
    const { data, error } = await supabase
      .rpc('check_program_eligibility', {
        student_id_param: studentId,
        program_id_param: programId
      });

    if (error) {
      console.error('Error checking program eligibility:', error);
      return { eligible: false, reasons: ['Error checking eligibility'] };
    }

    console.log('check_program_eligibility result:', programId, studentId, data);

    // The database function returns a simple boolean
    const isEligible = Boolean(data);
    
    if (isEligible) {
      return { eligible: true, reasons: [] };
    } else {
      // Since the DB function doesn't provide specific reasons, we return a generic message
      return { eligible: false, reasons: ['Student does not meet program requirements'] };
    }
  } catch (error) {
    console.error('Exception in checkProgramEligibility:', error);
    return { eligible: false, reasons: ['System error checking eligibility'] };
  }
}

/**
 * Get programs suitable for a specific student based on eligibility
 */
export async function getProgramsForStudent(
  studentId: string,
  supabase = getSupabaseAdminClient()
): Promise<Program[]> {
  // Get all active programs
  const allPrograms = await getPrograms({ is_active: true }, supabase);

  // Filter programs based on student eligibility
  const eligiblePrograms: Program[] = [];

  for (const program of allPrograms) {
    const eligibilityCheck = await checkProgramEligibility(
      program.id,
      studentId,
      supabase
    );

    if (eligibilityCheck.eligible) {
      eligiblePrograms.push(program);
    }
  }

  return eligiblePrograms;
}

/**
 * Get seminar templates (programs with engagement_type='seminar')
 */
export async function getSeminars(
  filters: {
    is_active?: boolean;
    search?: string;
    ability_category?: 'able' | 'adaptive';
    delivery_format?: 'group' | 'private' | 'competition_individual' | 'competition_team' | 'introductory';
    audience_scope?: 'youth' | 'adults' | 'mixed';
  } = {},
  supabase = getSupabaseAdminClient()
): Promise<Program[]> {
  return getPrograms({ ...filters, engagement_type: 'seminar' }, supabase);
}

/**
 * Get a seminar with its series and ordered sessions
 */
export async function getSeminarWithSeries(
  seminarId: string,
  supabase = getSupabaseAdminClient()
) {
  const { data, error } = await supabase
    .from('programs')
    .select(`
      *,
      classes (
        id,
        name,
        description,
        series_label,
        series_start_on,
        series_end_on,
        sessions_per_week_override,
        session_duration_minutes,
        series_session_quota,
        allow_self_enrollment,
        min_capacity,
        max_capacity,
        on_demand,
        is_active,
        class_sessions (
          id,
          session_date,
          start_time,
          end_time,
          sequence_number,
          status
        )
      )
    `)
    .eq('id', seminarId)
    .eq('engagement_type', 'seminar')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch seminar with series: ${error.message}`);
  }

  // Sort class_sessions by sequence_number or session_date
  if (data.classes) {
    data.classes = data.classes.map((cls) => ({
      ...cls,
      class_sessions: (cls.class_sessions || []).sort((a, b) => {
        if (a.sequence_number !== null && b.sequence_number !== null && a.sequence_number !== undefined && b.sequence_number !== undefined) {
          return a.sequence_number - b.sequence_number;
        }
        return new Date(a.session_date).getTime() - new Date(b.session_date).getTime();
      }),
    })) as typeof data.classes;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as any;
}

/**
 * Get program by slug
 */
export async function getProgramBySlug(
  slug: string,
  supabase = getSupabaseAdminClient()
): Promise<Program | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch program: ${error.message}`);
  }

  return {
    ...data,
    description: data.description || undefined,
    duration_minutes: data.duration_minutes || undefined,
    max_capacity: data.max_capacity || undefined,
    sessions_per_week: data.sessions_per_week || undefined,
    min_sessions_per_week: data.min_sessions_per_week || undefined,
    max_sessions_per_week: data.max_sessions_per_week || undefined,
    min_belt_rank: data.min_belt_rank || undefined,
    max_belt_rank: data.max_belt_rank || undefined,
    belt_rank_required: data.belt_rank_required || undefined,
    prerequisite_programs: data.prerequisite_programs || undefined,
    min_age: data.min_age || undefined,
    max_age: data.max_age || undefined,
    gender_restriction: (data.gender_restriction as 'male' | 'female' | 'none') || undefined,
    special_needs_support: data.special_needs_support || undefined,
    // Seminar-specific fields
    ability_category: data.ability_category || undefined,
    delivery_format: data.delivery_format || undefined,
    slug: data.slug || undefined,
    // Convert cents back to Money objects
    monthly_fee: data.monthly_fee_cents != null ? fromCents(data.monthly_fee_cents) : undefined,
    registration_fee: data.registration_fee_cents != null ? fromCents(data.registration_fee_cents) : undefined,
    yearly_fee: data.yearly_fee_cents != null ? fromCents(data.yearly_fee_cents) : undefined,
    individual_session_fee: data.individual_session_fee_cents != null ? fromCents(data.individual_session_fee_cents) : undefined,
    single_purchase_price_cents: data.single_purchase_price_cents ?? undefined,
  };
}