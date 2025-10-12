import { getSupabaseAdminClient } from '~/utils/supabase.server';
import type {
  ClassEnrollment,
  CreateEnrollmentData,
  UpdateEnrollmentData,
  EnrollmentFilters,
  EnrollmentValidation,
  EnrollmentStats,
  BulkEnrollmentData
} from '~/types/multi-class';
import { checkScheduleConflicts } from './class.server';
import { checkProgramEligibility } from './program.server';
import { recordStudentEnrollmentEvent } from '~/utils/auto-discount-events.server';
import { mapEnrollmentClassNullToUndefined } from '~/utils/mappers';
import { fromCents } from '~/utils/money';

/**
 * Enroll a student in a class with validation
 */
export async function enrollStudent(
  enrollmentData: CreateEnrollmentData,
  supabase = getSupabaseAdminClient()
): Promise<ClassEnrollment> {
  // Check if student has an existing enrollment for this class
  const { data: existingEnrollment } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('class_id', enrollmentData.class_id)
    .eq('student_id', enrollmentData.student_id)
    .single();

  // If student has a dropped or completed enrollment, update it instead of creating new one
  if (existingEnrollment && ['dropped', 'completed'].includes(existingEnrollment.status)) {
    // Validate enrollment first
    const validation = await validateEnrollment(
      enrollmentData.class_id,
      enrollmentData.student_id,
      supabase
    );

    if (!validation.is_valid) {
      throw new Error(`Enrollment validation failed: ${validation.errors.join(', ')}`);
    }

    // Check for schedule conflicts
    const { hasConflicts, conflicts } = await checkScheduleConflicts(
      enrollmentData.student_id,
      enrollmentData.class_id,
      supabase
    );

    if (hasConflicts) {
      const conflictMessages = conflicts.map(c => 
        `Conflicts with ${c.conflicting_class_name} on ${(c.conflict_days as string[]).join(', ')}`
      );
      throw new Error(`Schedule conflicts detected: ${conflictMessages.join('; ')}`);
    }

    // Determine enrollment status based on capacity
    let enrollmentStatus = enrollmentData.status || 'active';
    if (!validation.capacity_available && enrollmentStatus === 'active') {
      enrollmentStatus = 'waitlist';
    }

    // Update existing enrollment
     const reEnrollmentNote = enrollmentData.notes 
       ? `Re-enrolled: ${enrollmentData.notes}` 
       : 'Re-enrolled';
     
     const { data, error } = await supabase
       .from('enrollments')
       .update({
         status: enrollmentStatus,
         notes: reEnrollmentNote,
         enrolled_at: new Date().toISOString(),
         updated_at: new Date().toISOString(),
         completed_at: null,
         dropped_at: null,
       })
      .eq('id', existingEnrollment.id)
      .select(`
        *,
        class:classes(
          *,
          program:programs(*)
        ),
        student:students(
          id,
          first_name,
          last_name,
          birth_date,
          family_id
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to re-enroll student: ${error.message}`);
    }

    // If enrolled as active, check if we can promote anyone from waitlist
    if (enrollmentStatus === 'active') {
      await processWaitlist(enrollmentData.class_id, supabase);
    }

    // Record student enrollment event for automatic discount processing
    if (data.student?.id && data.student?.family_id) {
      await recordStudentEnrollmentEvent(data.student.id, data.student.family_id);
    }

    return {
    ...data,
    completed_at: data.completed_at ?? undefined,
    dropped_at: data.dropped_at ?? undefined,
    notes: data.notes ?? undefined,
    class: mapEnrollmentClassNullToUndefined(data.class),
    student: data.student ? {
      ...data.student,
      birth_date: data.student.birth_date ?? '',
    } : data.student,
  };
  }

  // For new enrollments or existing active/waitlist enrollments, proceed with validation
  const validation = await validateEnrollment(
    enrollmentData.class_id,
    enrollmentData.student_id,
    supabase
  );

  if (!validation.is_valid) {
    throw new Error(`Enrollment validation failed: ${validation.errors.join(', ')}`);
  }

  // Check for schedule conflicts
  const { hasConflicts, conflicts } = await checkScheduleConflicts(
    enrollmentData.student_id,
    enrollmentData.class_id,
    supabase
  );

  if (hasConflicts) {
    const conflictMessages = conflicts.map(c => 
      `Conflicts with ${c.conflicting_class_name} on ${(c.conflict_days as string[]).join(', ')}`
    );
    throw new Error(`Schedule conflicts detected: ${conflictMessages.join('; ')}`);
  }

  // Determine enrollment status based on capacity
  let enrollmentStatus = enrollmentData.status || 'active';
  if (!validation.capacity_available && enrollmentStatus === 'active') {
    enrollmentStatus = 'waitlist';
  }

  const { data, error } = await supabase
    .from('enrollments')
    .insert({
      class_id: enrollmentData.class_id,
      student_id: enrollmentData.student_id,
      program_id: enrollmentData.program_id,
      status: enrollmentStatus,
      notes: enrollmentData.notes,
    })
    .select(`
      *,
      class:classes(
        *,
        program:programs(*)
      ),
      student:students(
        id,
        first_name,
        last_name,
        birth_date,
        family_id
      )
    `)
    .single();

  if (error) {
    throw new Error(`Failed to enroll student: ${error.message}`);
  }

  // If enrolled as active, check if we can promote anyone from waitlist
  if (enrollmentStatus === 'active') {
    await processWaitlist(enrollmentData.class_id, supabase);
  }

  // Record student enrollment event for automatic discount processing
  if (data.student?.id && data.student?.family_id) {
    await recordStudentEnrollmentEvent(data.student.id, data.student.family_id);
  }

  return {
    ...data,
    completed_at: data.completed_at || undefined,
    dropped_at: data.dropped_at || undefined,
    notes: data.notes || undefined,
    student: data.student ? {
      ...data.student,
      birth_date: data.student.birth_date || '',
    } : undefined,
    class: {
      ...data.class,
      description: data.class.description || undefined,
      max_capacity: data.class.max_capacity || undefined,
      instructor_id: data.class.instructor_id || undefined,
      program: {
           ...data.class.program,
            description: data.class.program.description || undefined,
            max_capacity: data.class.program.max_capacity || undefined,
            belt_rank_required: data.class.program.belt_rank_required || false,
            gender_restriction: (data.class.program.gender_restriction as 'male' | 'female' | 'none') || undefined,
            individual_session_fee: data.class.program.individual_session_fee_cents != null ? fromCents(data.class.program.individual_session_fee_cents) : undefined,
            yearly_fee: data.class.program.yearly_fee_cents != null ? fromCents(data.class.program.yearly_fee_cents) : undefined,
            min_sessions_per_week: data.class.program.min_sessions_per_week || undefined,
            max_sessions_per_week: data.class.program.max_sessions_per_week || undefined,
            monthly_fee: data.class.program.monthly_fee_cents != null ? fromCents(data.class.program.monthly_fee_cents) : undefined,
            registration_fee: data.class.program.registration_fee_cents != null ? fromCents(data.class.program.registration_fee_cents) : undefined,
            min_belt_rank: data.class.program.min_belt_rank || undefined,
            max_belt_rank: data.class.program.max_belt_rank || undefined,
            sessions_per_week: data.class.program.sessions_per_week || undefined,
            min_age: data.class.program.min_age || undefined,
            max_age: data.class.program.max_age || undefined,
            special_needs_support: data.class.program.special_needs_support || undefined,
            prerequisite_programs: data.class.program.prerequisite_programs || undefined,
            duration_minutes: data.class.program.duration_minutes || undefined
         }
    }
  };
}

/**
 * Update an enrollment
 */
export async function updateEnrollment(
  id: string,
  updates: Partial<UpdateEnrollmentData>,
  supabase = getSupabaseAdminClient()
): Promise<ClassEnrollment> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Only include fields that are provided
  if (updates.status !== undefined) updateData.status = updates.status;
  // payment_id field removed as it doesn't exist in enrollments table
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  console.log('updateEnrollment', updateData);

  const { data, error } = await supabase
    .from('enrollments')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      class:classes(
        *,
        program:programs(*)
      ),
      student:students(
        id,
        first_name,
        last_name,
        birth_date,
        family_id
      )
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update enrollment: ${error.message}`);
  }

  // If status changed to dropped or completed, process waitlist
  if (updates.status && ['dropped', 'completed'].includes(updates.status)) {
    await processWaitlist(data.class_id, supabase);
  }

  return {
    ...data,
    completed_at: data.completed_at || undefined,
    dropped_at: data.dropped_at || undefined,
    notes: data.notes || undefined,
    student: data.student ? {
      ...data.student,
      birth_date: data.student.birth_date || '',
    } : undefined,
    class: {
      ...data.class,
      description: data.class.description || undefined,
      max_capacity: data.class.max_capacity || undefined,
      instructor_id: data.class.instructor_id || undefined,
      program: {
        ...data.class.program,
        description: data.class.program.description || undefined,
        max_capacity: data.class.program.max_capacity || undefined,
        belt_rank_required: data.class.program.belt_rank_required || false,
        gender_restriction: (data.class.program.gender_restriction as 'male' | 'female' | 'none') || undefined,
         individual_session_fee: data.class.program.individual_session_fee_cents != null ? fromCents(data.class.program.individual_session_fee_cents) : undefined,
         yearly_fee: data.class.program.yearly_fee_cents != null ? fromCents(data.class.program.yearly_fee_cents) : undefined,
         min_sessions_per_week: data.class.program.min_sessions_per_week || undefined,
         max_sessions_per_week: data.class.program.max_sessions_per_week || undefined,
         monthly_fee: data.class.program.monthly_fee_cents != null ? fromCents(data.class.program.monthly_fee_cents) : undefined,
         registration_fee: data.class.program.registration_fee_cents != null ? fromCents(data.class.program.registration_fee_cents) : undefined,
         min_belt_rank: data.class.program.min_belt_rank || undefined,
         max_belt_rank: data.class.program.max_belt_rank || undefined,
         sessions_per_week: data.class.program.sessions_per_week || undefined,
         min_age: data.class.program.min_age || undefined,
         max_age: data.class.program.max_age || undefined,
         special_needs_support: data.class.program.special_needs_support || undefined,
         prerequisite_programs: data.class.program.prerequisite_programs || undefined,
         duration_minutes: data.class.program.duration_minutes || undefined,
        ability_category: data.class.program.ability_category ?? undefined,
        audience_scope: data.class.program.audience_scope ?? 'youth',
        engagement_type: data.class.program.engagement_type ?? 'program',
        min_capacity: data.class.program.min_capacity ?? undefined,
        single_purchase_price: data.class.program.single_purchase_price_cents != null ? fromCents(data.class.program.single_purchase_price_cents) : undefined,
        subscription_monthly_price: data.class.program.subscription_monthly_price_cents != null ? fromCents(data.class.program.subscription_monthly_price_cents) : undefined,
        subscription_yearly_price: data.class.program.subscription_yearly_price_cents != null ? fromCents(data.class.program.subscription_yearly_price_cents) : undefined,
      }
    }
  };
}

/**
 * Drop a student from a class
 */
export async function dropStudent(
  enrollmentId: string,
  reason?: string,
  supabase = getSupabaseAdminClient()
): Promise<void> {
  const notes = reason ? `Dropped: ${reason}` : 'Dropped';
  
  const { data, error } = await supabase
    .from('enrollments')
    .update({ 
      status: 'dropped', 
      notes,
      updated_at: new Date().toISOString() 
    })
    .eq('id', enrollmentId)
    .select('class_id')
    .single();

  if (error) {
    throw new Error(`Failed to drop student: ${error.message}`);
  }

  // Process waitlist to see if anyone can be promoted
  if (data) {
    await processWaitlist(data.class_id, supabase);
  }
}

/**
 * Get enrollments with optional filtering
 */
export async function getEnrollments(
  filters: EnrollmentFilters = {},
  supabase = getSupabaseAdminClient()
): Promise<ClassEnrollment[]> {
  let query = supabase
    .from('enrollments')
    .select(`
      *,
      class:classes(
        *,
        program:programs(*)
      ),
      student:students(
        id,
        first_name,
        last_name,
        birth_date,
        family_id
      )
    `);

  // Apply filters
  if (filters.class_id) {
    query = query.eq('class_id', filters.class_id);
  }

  if (filters.student_id) {
    query = query.eq('student_id', filters.student_id);
  }

  if (filters.family_id) {
    query = query.eq('student.family_id', filters.family_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.enrollment_date_from) {
    query = query.gte('enrolled_at', filters.enrollment_date_from);
  }

  if (filters.enrollment_date_to) {
    query = query.lte('enrolled_at', filters.enrollment_date_to);
  }

  query = query.order('enrolled_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch enrollments: ${error.message}`);
  }

  return (data || []).map(enrollment => ({
    ...enrollment,
    completed_at: enrollment.completed_at ?? undefined,
    dropped_at: enrollment.dropped_at ?? undefined,
    notes: enrollment.notes ?? undefined,
    class: mapEnrollmentClassNullToUndefined(enrollment.class),
    student: enrollment.student ? {
      ...enrollment.student,
      birth_date: enrollment.student.birth_date ?? '',
    } : enrollment.student,
  }));
}


/**
 * Get enrollments by class ID
 */
export async function getEnrollmentsByClass(
  classId: string,
  supabase = getSupabaseAdminClient()
): Promise<ClassEnrollment[]> {
  return getEnrollments({ class_id: classId }, supabase);
}

/**
 * Get enrollments by student ID
 */
export async function getEnrollmentsByStudent(
  studentId: string,
  supabase = getSupabaseAdminClient()
): Promise<ClassEnrollment[]> {
  return getEnrollments({ student_id: studentId }, supabase);
}

/**
 * Get enrollments by family ID
 */
export async function getEnrollmentsByFamily(
  familyId: string,
  supabase = getSupabaseAdminClient()
): Promise<ClassEnrollment[]> {
  return getEnrollments({ family_id: familyId }, supabase);
}

/**
 * Validate enrollment eligibility
 */
export async function validateEnrollment(
  classId: string,
  studentId: string,
  supabase = getSupabaseAdminClient()
): Promise<EnrollmentValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let capacityAvailable = false;
  let meetsEligibility = false;
  let ageAppropriate = false;
  let beltRequirementsMet = false;

  try {
    // Get class and program details
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select(`
        *,
        program:programs(*)
      `)
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      errors.push('Class not found');
      return {
        is_valid: false,
        errors,
        warnings,
        capacity_available: false,
        meets_eligibility: false,
        age_appropriate: false,
        belt_requirements_met: false,
      };
    }

    // Check if class is active
    if (!classData.is_active) {
      errors.push('Class is not active');
    }

    // Check capacity
    const { count: enrollmentCount } = await supabase
    .from('enrollments')
    .select('id', { count: 'exact' })
    .eq('class_id', classId)
    .in('status', ['active', 'trial']);

    const currentEnrollment = enrollmentCount || 0;
    const maxCapacity = classData.max_capacity || 0;
    
    capacityAvailable = maxCapacity === 0 || currentEnrollment < maxCapacity;
    
    if (!capacityAvailable) {
      warnings.push(`Class is at capacity (${currentEnrollment}/${maxCapacity})`);
    }

    // Check if student is already enrolled
    const { data: existingEnrollment } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('class_id', classId)
      .eq('student_id', studentId)
      .single();

    if (existingEnrollment) {
      if (existingEnrollment.status === 'active') {
        errors.push('Student is already enrolled in this class');
      } else if (existingEnrollment.status === 'waitlist') {
        errors.push('Student is already on the waitlist for this class');
      } else if (existingEnrollment.status === 'trial') {
        errors.push('Student is already enrolled in this class as a trial');
      }
      // Note: dropped and completed enrollments are allowed to be re-enrolled
    }

    // Check program eligibility using comprehensive database function
    if (classData.program) {
      const eligibilityCheck = await checkProgramEligibility(
        classData.program.id,
        studentId,
        supabase
      );
      
      meetsEligibility = eligibilityCheck.eligible;
      if (!meetsEligibility) {
        // Handle cases where reasons might not be an array or might be undefined
        if (Array.isArray(eligibilityCheck.reasons)) {
          errors.push(...eligibilityCheck.reasons);
        } else if (eligibilityCheck.reasons) {
          errors.push(String(eligibilityCheck.reasons));
        } else {
          errors.push('Student does not meet program eligibility requirements');
        }
      }

      // The checkProgramEligibility function now handles all validation:
      // - Age requirements (min_age, max_age)
      // - Belt rank requirements (min_belt_rank, max_belt_rank, belt_rank_required)
      // - Prerequisite programs (prerequisite_programs)
      // So we can set these flags based on the comprehensive check
      ageAppropriate = eligibilityCheck.eligible;
      beltRequirementsMet = eligibilityCheck.eligible;
    }

    // Check for schedule conflicts
    const { hasConflicts, conflicts } = await checkScheduleConflicts(
      studentId,
      classId,
      supabase
    );

    if (hasConflicts) {
      const conflictMessages = conflicts.map(c => 
        `Schedule conflict with ${c.conflicting_class_name}`
      );
      errors.push(...conflictMessages);
    }

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const isValid = errors.length === 0;

  return {
    is_valid: isValid,
    errors,
    warnings,
    capacity_available: capacityAvailable,
    meets_eligibility: meetsEligibility,
    age_appropriate: ageAppropriate,
    belt_requirements_met: beltRequirementsMet,
  };
}

/**
 * Process waitlist - promote students when spots become available
 */
export async function processWaitlist(
  classId: string,
  supabase = getSupabaseAdminClient()
): Promise<number> {
  // Get class capacity info
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select(`
      max_capacity,
      program:programs(name)
    `)
    .eq('id', classId)
    .single();

  if (classError || !classData) {
    throw new Error('Failed to get class information');
  }

  // Get current active enrollment count
  const { count: enrollmentCount } = await supabase
    .from('enrollments')
    .select('id', { count: 'exact' })
    .eq('class_id', classId)
    .in('status', ['active', 'trial']);

  const currentEnrollment = enrollmentCount || 0;
  const maxCapacity = classData.max_capacity || 0;
  const availableSpots = maxCapacity > 0 ? Math.max(0, maxCapacity - currentEnrollment) : 0;

  if (availableSpots === 0) {
    return 0; // No spots available
  }

  // Get waitlisted students in order of enrollment
  const { data: waitlistStudents, error: waitlistError } = await supabase
    .from('enrollments')
    .select('id, student_id, enrolled_at')
    .eq('class_id', classId)
    .eq('status', 'waitlist')
    .order('enrolled_at')
    .limit(availableSpots);

  if (waitlistError) {
    throw new Error(`Failed to get waitlist: ${waitlistError.message}`);
  }

  if (!waitlistStudents || waitlistStudents.length === 0) {
    return 0; // No one on waitlist
  }

  let promoted = 0;

  // Promote students from waitlist
  for (const enrollment of waitlistStudents) {
    // Re-validate enrollment (in case circumstances changed)
    const validation = await validateEnrollment(
      classId,
      enrollment.student_id,
      supabase
    );

    if (validation.capacity_available && validation.meets_eligibility) {
      const { error: updateError } = await supabase
        .from('enrollments')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString(),
          notes: 'Promoted from waitlist'
        })
        .eq('id', enrollment.id);

      if (!updateError) {
        promoted++;
      }
    }
  }

  return promoted;
}

/**
 * Bulk enroll multiple students
 */
export async function bulkEnrollStudents(
  data: BulkEnrollmentData,
  supabase = getSupabaseAdminClient()
): Promise<{ successful: ClassEnrollment[]; failed: { studentId: string; error: string }[] }> {
  const successful: ClassEnrollment[] = [];
  const failed: { studentId: string; error: string }[] = [];

  // Get class data to find program_id
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('program_id')
    .eq('id', data.class_id)
    .single();

  if (classError || !classData) {
    throw new Error(`Failed to get class information: ${classError?.message}`);
  }

  for (const studentId of data.student_ids) {
    try {
      const enrollment = await enrollStudent({
        class_id: data.class_id,
        student_id: studentId,
        program_id: classData.program_id,
        status: data.enrollment_type,
        notes: data.notes,
      }, supabase);
      
      successful.push(enrollment);
    } catch (error) {
      failed.push({
        studentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { successful, failed };
}

/**
 * Get enrollment statistics for a class
 */
export async function getEnrollmentStats(
  classId: string,
  supabase = getSupabaseAdminClient()
): Promise<EnrollmentStats> {
  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select('status')
    .eq('class_id', classId);

  if (error) {
    throw new Error(`Failed to get enrollment stats: ${error.message}`);
  }

  const stats = {
    total_enrolled: enrollments?.length || 0,
    active_enrollments: enrollments?.filter((e: { status: string }) => ['active', 'trial'].includes(e.status)).length || 0,
    waitlist_count: enrollments?.filter((e: { status: string }) => e.status === 'waitlist').length || 0,
    completion_rate: 0,
    average_attendance: 0,
  };

  // Calculate completion rate
  const completed = enrollments?.filter((e: { status: string }) => e.status === 'completed').length || 0;
  const totalFinished = completed + (enrollments?.filter((e: { status: string }) => e.status === 'dropped').length || 0);
  if (totalFinished > 0) {
    stats.completion_rate = (completed / totalFinished) * 100;
  }

  // TODO: Calculate average attendance when attendance system is integrated
  // This would require joining with attendance records

  return stats;
}

/**
 * Get a single enrollment by ID
 */
export async function getEnrollmentById(
  id: string,
  supabase = getSupabaseAdminClient()
): Promise<ClassEnrollment | null> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      class:classes(
        *,
        program:programs(*)
      ),
      student:students(
        id,
        first_name,
        last_name,
        birth_date,
        family_id
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch enrollment: ${error.message}`);
  }

  return {
    ...data,
    completed_at: data.completed_at || undefined,
    dropped_at: data.dropped_at || undefined,
    notes: data.notes || undefined,
    student: data.student ? {
      ...data.student,
      birth_date: data.student.birth_date || '',
    } : undefined,
    class: {
      ...data.class,
      description: data.class.description || undefined,
      max_capacity: data.class.max_capacity || undefined,
      instructor_id: data.class.instructor_id || undefined,
      program: {
        ...data.class.program,
        description: data.class.program.description || undefined,
        max_capacity: data.class.program.max_capacity || undefined,
        belt_rank_required: data.class.program.belt_rank_required || false,
        gender_restriction: (data.class.program.gender_restriction as 'male' | 'female' | 'none') || undefined,
        individual_session_fee: data.class.program.individual_session_fee_cents != null ? fromCents(data.class.program.individual_session_fee_cents) : undefined,
        yearly_fee: data.class.program.yearly_fee_cents != null ? fromCents(data.class.program.yearly_fee_cents) : undefined,
        min_sessions_per_week: data.class.program.min_sessions_per_week || undefined,
        max_sessions_per_week: data.class.program.max_sessions_per_week || undefined,
        monthly_fee: data.class.program.monthly_fee_cents != null ? fromCents(data.class.program.monthly_fee_cents) : undefined,
        registration_fee: data.class.program.registration_fee_cents != null ? fromCents(data.class.program.registration_fee_cents) : undefined,
        min_belt_rank: data.class.program.min_belt_rank || undefined,
        max_belt_rank: data.class.program.max_belt_rank || undefined,
        sessions_per_week: data.class.program.sessions_per_week || undefined,
        min_age: data.class.program.min_age || undefined,
        max_age: data.class.program.max_age || undefined,
        special_needs_support: data.class.program.special_needs_support || undefined,
        prerequisite_programs: data.class.program.prerequisite_programs || undefined,
        duration_minutes: data.class.program.duration_minutes || undefined,
        ability_category: data.class.program.ability_category ?? undefined,
        audience_scope: data.class.program.audience_scope ?? 'youth',
        engagement_type: data.class.program.engagement_type ?? 'program',
        min_capacity: data.class.program.min_capacity ?? undefined,
        single_purchase_price: data.class.program.single_purchase_price_cents != null ? fromCents(data.class.program.single_purchase_price_cents) : undefined,
        subscription_monthly_price: data.class.program.subscription_monthly_price_cents != null ? fromCents(data.class.program.subscription_monthly_price_cents) : undefined,
        subscription_yearly_price: data.class.program.subscription_yearly_price_cents != null ? fromCents(data.class.program.subscription_yearly_price_cents) : undefined,
      }
    }
  };
}
