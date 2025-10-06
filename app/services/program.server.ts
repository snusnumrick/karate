import { getSupabaseAdminClient } from '~/utils/supabase.server';
import type { Database } from '~/types/database.types';
import {
  Program,
  CreateProgramData,
  UpdateProgramData,
} from '~/types/multi-class';
import { toCents, fromCents } from '~/utils/money';

type ProgramRow = Database['public']['Tables']['programs']['Row'];

function mapProgramRow(row: ProgramRow): Program {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    duration_minutes: row.duration_minutes ?? undefined,
    engagement_type: row.engagement_type ?? 'program',
    ability_category: row.ability_category ?? undefined,
    delivery_format: row.delivery_format ?? undefined,
    audience_scope: row.audience_scope ?? 'youth',
    slug: row.slug ?? undefined,
    min_capacity: row.min_capacity ?? undefined,
    max_capacity: row.max_capacity ?? undefined,
    sessions_per_week: row.sessions_per_week ?? undefined,
    min_sessions_per_week: row.min_sessions_per_week ?? undefined,
    max_sessions_per_week: row.max_sessions_per_week ?? undefined,
    min_belt_rank: row.min_belt_rank ?? undefined,
    max_belt_rank: row.max_belt_rank ?? undefined,
    belt_rank_required: row.belt_rank_required ?? false,
    prerequisite_programs: row.prerequisite_programs ?? undefined,
    min_age: row.min_age ?? undefined,
    max_age: row.max_age ?? undefined,
    gender_restriction: (row.gender_restriction as 'male' | 'female' | 'none') ?? undefined,
    special_needs_support: row.special_needs_support ?? undefined,
    monthly_fee: row.monthly_fee_cents != null ? fromCents(row.monthly_fee_cents) : undefined,
    registration_fee: row.registration_fee_cents != null ? fromCents(row.registration_fee_cents) : undefined,
    yearly_fee: row.yearly_fee_cents != null ? fromCents(row.yearly_fee_cents) : undefined,
    individual_session_fee: row.individual_session_fee_cents != null ? fromCents(row.individual_session_fee_cents) : undefined,
    single_purchase_price: row.single_purchase_price_cents != null ? fromCents(row.single_purchase_price_cents) : undefined,
    subscription_monthly_price: row.subscription_monthly_price_cents != null ? fromCents(row.subscription_monthly_price_cents) : undefined,
    subscription_yearly_price: row.subscription_yearly_price_cents != null ? fromCents(row.subscription_yearly_price_cents) : undefined,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

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
    engagement_type: programData.engagement_type ?? 'program',
    ability_category: programData.ability_category ?? null,
    delivery_format: programData.delivery_format ?? null,
    audience_scope: programData.audience_scope ?? 'youth',
    slug: programData.slug ?? null,
    // Capacity constraints
    min_capacity: programData.min_capacity ?? null,
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
    single_purchase_price_cents: programData.single_purchase_price ? toCents(programData.single_purchase_price) : null,
    subscription_monthly_price_cents: programData.subscription_monthly_price ? toCents(programData.subscription_monthly_price) : null,
    subscription_yearly_price_cents: programData.subscription_yearly_price ? toCents(programData.subscription_yearly_price) : null,
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

  return mapProgramRow(data as ProgramRow);
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
  if (updates.engagement_type !== undefined) updateData.engagement_type = updates.engagement_type;
  if (updates.ability_category !== undefined) updateData.ability_category = updates.ability_category ?? null;
  if (updates.delivery_format !== undefined) updateData.delivery_format = updates.delivery_format ?? null;
  if (updates.audience_scope !== undefined) updateData.audience_scope = updates.audience_scope;
  if (updates.slug !== undefined) updateData.slug = updates.slug || null;
  // Capacity constraints
  if (updates.min_capacity !== undefined) updateData.min_capacity = updates.min_capacity;
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
  if (updates.single_purchase_price !== undefined) updateData.single_purchase_price_cents = updates.single_purchase_price ? toCents(updates.single_purchase_price) : null;
  if (updates.subscription_monthly_price !== undefined) updateData.subscription_monthly_price_cents = updates.subscription_monthly_price ? toCents(updates.subscription_monthly_price) : null;
  if (updates.subscription_yearly_price !== undefined) updateData.subscription_yearly_price_cents = updates.subscription_yearly_price ? toCents(updates.subscription_yearly_price) : null;
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

  return mapProgramRow(data as ProgramRow);
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

  return (data || []).map(row => mapProgramRow(row as ProgramRow));
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
    engagement_type: data.engagement_type,
    ability_category: data.ability_category || undefined,
    delivery_format: data.delivery_format || undefined,
    audience_scope: data.audience_scope ?? 'youth',
    slug: data.slug || undefined,
    min_capacity: data.min_capacity ?? undefined,
    // Convert cents back to Money objects
    monthly_fee: data.monthly_fee_cents != null ? fromCents(data.monthly_fee_cents) : undefined,
    registration_fee: data.registration_fee_cents != null ? fromCents(data.registration_fee_cents) : undefined,
    yearly_fee: data.yearly_fee_cents != null ? fromCents(data.yearly_fee_cents) : undefined,
    individual_session_fee: data.individual_session_fee_cents != null ? fromCents(data.individual_session_fee_cents) : undefined,
    single_purchase_price: data.single_purchase_price_cents != null ? fromCents(data.single_purchase_price_cents) : undefined,
    subscription_monthly_price: data.subscription_monthly_price_cents != null ? fromCents(data.subscription_monthly_price_cents) : undefined,
    subscription_yearly_price: data.subscription_yearly_price_cents != null ? fromCents(data.subscription_yearly_price_cents) : undefined,
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
  return (data || []).map(row => mapProgramRow(row as ProgramRow));
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

  const seminar = mapProgramRow(data as ProgramRow);

  const classes = (data.classes || []).map((cls) => {
    const sortedSessions = (cls.class_sessions || []).sort((a, b) => {
      if (
        a.sequence_number !== null &&
        b.sequence_number !== null &&
        a.sequence_number !== undefined &&
        b.sequence_number !== undefined
      ) {
        return a.sequence_number - b.sequence_number;
      }
      return new Date(a.session_date).getTime() - new Date(b.session_date).getTime();
    });

    return {
      ...cls,
      description: cls.description ?? undefined,
      series_label: cls.series_label ?? undefined,
      series_start_on: cls.series_start_on ?? undefined,
      series_end_on: cls.series_end_on ?? undefined,
      sessions_per_week_override: cls.sessions_per_week_override ?? undefined,
      session_duration_minutes: cls.session_duration_minutes ?? undefined,
      series_session_quota: cls.series_session_quota ?? undefined,
      min_capacity: cls.min_capacity ?? undefined,
      max_capacity: cls.max_capacity ?? undefined,
      allow_self_enrollment: cls.allow_self_enrollment ?? false,
      on_demand: cls.on_demand ?? false,
      class_sessions: sortedSessions.map((session) => ({
        ...session,
        sequence_number: session.sequence_number ?? undefined,
      })),
    };
  });

  return {
    ...seminar,
    classes,
  };
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

  return mapProgramRow(data as ProgramRow);
}
