import { createClient } from '~/utils/supabase.server';
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

/**
 * Enroll a student in a class with validation
 */
export async function enrollStudent(
  enrollmentData: CreateEnrollmentData,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassEnrollment> {
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
        id,
        name,
        program:programs(name)
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

  return data;
}

/**
 * Update an enrollment
 */
export async function updateEnrollment(
  id: string,
  updates: Partial<UpdateEnrollmentData>,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassEnrollment> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Only include fields that are provided
  if (updates.status !== undefined) updateData.status = updates.status;
  // payment_id field removed as it doesn't exist in enrollments table
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const { data, error } = await supabase
    .from('enrollments')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      class:classes(
        id,
        name,
        program:programs(name)
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

  return data;
}

/**
 * Drop a student from a class
 */
export async function dropStudent(
  enrollmentId: string,
  reason?: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
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
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassEnrollment[]> {
  let query = supabase
    .from('enrollments')
    .select(`
      *,
      class:classes(
        id,
        name,
        program:programs(name)
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

  return data || [];
}


/**
 * Get enrollments by class ID
 */
export async function getEnrollmentsByClass(
  classId: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassEnrollment[]> {
  return getEnrollments({ class_id: classId }, supabase);
}

/**
 * Get enrollments by student ID
 */
export async function getEnrollmentsByStudent(
  studentId: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassEnrollment[]> {
  return getEnrollments({ student_id: studentId }, supabase);
}

/**
 * Get enrollments by family ID
 */
export async function getEnrollmentsByFamily(
  familyId: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassEnrollment[]> {
  return getEnrollments({ family_id: familyId }, supabase);
}

/**
 * Validate enrollment eligibility
 */
export async function validateEnrollment(
  classId: string,
  studentId: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
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
      .eq('status', 'active');

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
      }
    }

    // Check program eligibility
    if (classData.program) {
      const eligibilityCheck = await checkProgramEligibility(
        classData.program.id,
        studentId,
        supabase
      );
      
      meetsEligibility = eligibilityCheck.eligible;
      if (!meetsEligibility) {
        errors.push(...eligibilityCheck.reasons);
      }

      // More detailed checks
      const { data: student } = await supabase
        .from('students')
        .select('birth_date')
        .eq('id', studentId)
        .single();

      if (student) {
        // Age check
        const birthDate = new Date(student.birth_date);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;

        // Age check
        if (classData.program.min_age !== null || classData.program.max_age !== null) {
          if (classData.program.min_age !== null && actualAge < classData.program.min_age) {
            errors.push(`Student is too young (${actualAge} years old, minimum ${classData.program.min_age})`);
            ageAppropriate = false;
          } else if (classData.program.max_age !== null && actualAge > classData.program.max_age) {
            errors.push(`Student is too old (${actualAge} years old, maximum ${classData.program.max_age})`);
            ageAppropriate = false;
          } else {
            ageAppropriate = true;
          }
        } else {
          ageAppropriate = true;
        }

        // Belt requirements (placeholder - implement when belt system is ready)
        beltRequirementsMet = true; // Default to true for now
      }
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
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
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
    .eq('status', 'active');

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
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
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
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
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
    active_enrollments: enrollments?.filter((e: { status: string }) => e.status === 'active').length || 0,
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
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassEnrollment | null> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      class:classes(
        id,
        name,
        program:programs(name)
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

  return data;
}
