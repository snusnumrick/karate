import { getSupabaseAdminClient } from '~/utils/supabase.server';
import {
  Program,
  CreateProgramData,
  UpdateProgramData,
} from '~/types/multi-class';
import { toCents } from '~/utils/money';
import { mapProgramFromRow } from '~/utils/mappers';

const PROGRAM_SELECT_COLUMNS = `
  id,
  name,
  description,
  duration_minutes,
  engagement_type,
  ability_category,
  delivery_format,
  seminar_type,
  audience_scope,
  slug,
  min_capacity,
  max_capacity,
  sessions_per_week,
  min_sessions_per_week,
  max_sessions_per_week,
  min_belt_rank,
  max_belt_rank,
  belt_rank_required,
  prerequisite_programs,
  min_age,
  max_age,
  gender_restriction,
  special_needs_support,
  monthly_fee,
  monthly_fee_cents,
  registration_fee,
  registration_fee_cents,
  yearly_fee,
  yearly_fee_cents,
  individual_session_fee,
  individual_session_fee_cents,
  single_purchase_price_cents,
  subscription_monthly_price_cents,
  subscription_yearly_price_cents,
  required_waiver_id,
  is_active,
  created_at,
  updated_at
`;

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
    seminar_type: programData.seminar_type ?? null,
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

  return mapProgramFromRow(data);
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
  if (updates.seminar_type !== undefined) updateData.seminar_type = updates.seminar_type ?? null;
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

  return mapProgramFromRow(data);
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
  let query = supabase.from('programs').select();

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

  return (data || []).map(mapProgramFromRow);
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
    .select()
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch program: ${error.message}`);
  }

  return mapProgramFromRow(data);
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
  return (data || []).map(mapProgramFromRow);
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
 * Get public-facing adult (and mixed) programs for curriculum browsing.
 */
export async function getAdultPrograms(
  supabase = getSupabaseAdminClient(),
  engagementType?: 'program' | 'seminar'
): Promise<Program[]> {
  let query = supabase
    .from('programs')
    .select(PROGRAM_SELECT_COLUMNS)
    .eq('is_active', true)
    .in('audience_scope', ['adults', 'mixed'])
    .order('name');

  if (engagementType) {
    query = query.eq('engagement_type', engagementType);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch adult programs: ${error.message}`);
  }

  return (data || []).map(mapProgramFromRow);
}

/**
 * Get seminar templates (programs with engagement_type='seminar')
 */
export async function getSeminars(
  filters: {
    is_active?: boolean;
    search?: string;
    ability_category?: 'able' | 'adaptive';
    seminar_type?: 'introductory' | 'intermediate' | 'advanced';
    audience_scope?: 'youth' | 'adults' | 'mixed';
  } = {},
  supabase = getSupabaseAdminClient()
): Promise<Program[]> {
  let query = supabase.from('programs').select(PROGRAM_SELECT_COLUMNS).eq('engagement_type', 'seminar');

  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }
  if (filters.ability_category) {
    query = query.eq('ability_category', filters.ability_category);
  }
  if (filters.seminar_type) {
    query = query.eq('seminar_type', filters.seminar_type);
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
    throw new Error(`Failed to fetch seminars: ${error.message}`);
  }

  return (data || []).map(mapProgramFromRow);
}

export type UpcomingPublicSeminar = Program & {
  nextClass: {
    id: string;
    series_label: string | null;
    series_start_on: string;
    series_end_on: string | null;
    registration_status: string;
    allow_self_enrollment: boolean;
    effective_price_cents: number | null;
  };
};

/**
 * Get active seminars that have upcoming runs, matching the criteria shown
 * on the public /curriculum page (active seminars with active upcoming classes).
 */
export async function getUpcomingPublicSeminars(
  supabase = getSupabaseAdminClient()
): Promise<UpcomingPublicSeminar[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('programs')
    .select(`
      ${PROGRAM_SELECT_COLUMNS},
      classes (
        id,
        series_label,
        series_start_on,
        series_end_on,
        registration_status,
        price_override_cents,
        registration_fee_override_cents,
        allow_self_enrollment,
        is_active
      )
    `)
    .eq('engagement_type', 'seminar')
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to fetch upcoming public seminars: ${error.message}`);
  }

  const results: UpcomingPublicSeminar[] = [];

  for (const row of data || []) {
    const upcomingClasses = (row.classes || [])
      .filter(
        (cls) =>
          cls.is_active &&
          cls.series_start_on != null &&
          cls.series_start_on >= today
      )
      .sort((a, b) => a.series_start_on!.localeCompare(b.series_start_on!));

    if (upcomingClasses.length === 0) continue;

    const nextClass = upcomingClasses[0];
    const effectivePriceCents =
      nextClass.price_override_cents ??
      row.single_purchase_price_cents ??
      row.registration_fee_cents ??
      null;
    results.push({
      ...mapProgramFromRow(row),
      nextClass: {
        id: nextClass.id,
        series_label: nextClass.series_label ?? null,
        series_start_on: nextClass.series_start_on!,
        series_end_on: nextClass.series_end_on ?? null,
        registration_status: nextClass.registration_status,
        allow_self_enrollment: nextClass.allow_self_enrollment ?? false,
        effective_price_cents: effectivePriceCents,
      },
    });
  }

  results.sort((a, b) => a.nextClass.series_start_on.localeCompare(b.nextClass.series_start_on));
  return results.slice(0, 6);
}

/**
 * Get a seminar with its series and ordered sessions.
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
        topic,
        series_label,
        series_status,
        registration_status,
        series_start_on,
        series_end_on,
        sessions_per_week_override,
        session_duration_minutes,
        series_session_quota,
        price_override_cents,
        registration_fee_override_cents,
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
      return null;
    }
    throw new Error(`Failed to fetch seminar with series: ${error.message}`);
  }

  const seminar = mapProgramFromRow(data);

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
      topic: cls.topic ?? undefined,
      series_label: cls.series_label ?? undefined,
      series_status: cls.series_status ?? 'tentative',
      registration_status: cls.registration_status ?? 'closed',
      series_start_on: cls.series_start_on ?? undefined,
      series_end_on: cls.series_end_on ?? undefined,
      sessions_per_week_override: cls.sessions_per_week_override ?? undefined,
      session_duration_minutes: cls.session_duration_minutes ?? undefined,
      series_session_quota: cls.series_session_quota ?? undefined,
      price_override_cents: cls.price_override_cents ?? undefined,
      registration_fee_override_cents: cls.registration_fee_override_cents ?? undefined,
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
    .select(PROGRAM_SELECT_COLUMNS)
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch program by slug: ${error.message}`);
  }

  return mapProgramFromRow(data);
}
