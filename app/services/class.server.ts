import { createClient } from '~/utils/supabase.server';
import { siteConfig } from '~/config/site';
import type {
  Class,
  CreateClassData,
  UpdateClassData,
  ClassFilters,
  ClassWithDetails,
  ClassSession,
  CreateSessionData,
  UpdateSessionData,
  SessionFilters,
  BulkSessionGeneration,
  CalendarEvent,
  WeeklySchedule
} from '~/types/multi-class';
import { formatLocalDate, getTodayLocalDateString } from '~/components/calendar/utils';

/**
 * Get all instructors (profiles with instructor role)
 */
export async function getInstructors(
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Array<{ id: string; first_name: string; last_name: string; email: string }>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('role', 'instructor')
    .order('first_name');

  if (error) {
    throw new Error(`Failed to fetch instructors: ${error.message}`);
  }

  return data || [];
}

/**
 * Create a class schedule entry
 */
export async function createClassSchedule(
  classId: string,
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  startTime: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<void> {
  const { error } = await supabase
    .from('class_schedules')
    .insert({
      class_id: classId,
      day_of_week: dayOfWeek,
      start_time: startTime
    });

  if (error) {
    throw new Error(`Failed to create class schedule: ${error.message}`);
  }
}

/**
 * Get class schedules by class ID
 */
export async function getClassSchedules(
  classId: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Array<{ id: string; day_of_week: string; start_time: string }>> {
  const { data, error } = await supabase
    .from('class_schedules')
    .select('*')
    .eq('class_id', classId)
    .order('day_of_week');

  if (error) {
    throw new Error(`Failed to fetch class schedules: ${error.message}`);
  }

  return data || [];
}

/**
 * Update class schedules (replace all schedules for a class)
 */
export async function updateClassSchedules(
  classId: string,
  schedules: Array<{ day_of_week: string; start_time: string }>,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<void> {
  // Delete existing schedules
  const { error: deleteError } = await supabase
    .from('class_schedules')
    .delete()
    .eq('class_id', classId);

  if (deleteError) {
    throw new Error(`Failed to delete existing schedules: ${deleteError.message}`);
  }

  // Insert new schedules
  if (schedules.length > 0) {
    const { error: insertError } = await supabase
      .from('class_schedules')
      .insert(
        schedules.map(schedule => ({
          class_id: classId,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time
        }))
      );

    if (insertError) {
      throw new Error(`Failed to create new schedules: ${insertError.message}`);
    }
  }
}

/**
 * Delete a specific class schedule
 */
export async function deleteClassSchedule(
  scheduleId: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<void> {
  const { error } = await supabase
    .from('class_schedules')
    .delete()
    .eq('id', scheduleId);

  if (error) {
    throw new Error(`Failed to delete class schedule: ${error.message}`);
  }
}

/**
 * Create a new class
 */
export async function createClass(
  classData: CreateClassData,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassWithDetails> {
  // First create the class
  const { data: newClass, error: classError } = await supabase
    .from('classes')
    .insert({
      program_id: classData.program_id,
      name: classData.name,
      description: classData.description,
      max_capacity: classData.max_capacity,
      instructor_id: classData.instructor_id,
      is_active: classData.is_active ?? true,
    })
    .select(`
      *,
      program:programs(*)
    `)
    .single();

  if (classError) {
    throw new Error(`Failed to create class: ${classError.message}`);
  }

  // Schedules are no longer part of the simplified schema

  // Return the class with schedules
  const result = await getClassById(newClass.id, supabase);
  if (!result) {
    throw new Error('Failed to retrieve created class');
  }
  return result;
}

/**
 * Update an existing class
 */
export async function updateClass(
  id: string,
  updates: Partial<UpdateClassData>,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassWithDetails> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Only include fields that are provided
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.max_capacity !== undefined) updateData.max_capacity = updates.max_capacity;
  if (updates.instructor_id !== undefined) updateData.instructor_id = updates.instructor_id;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

  const { error } = await supabase
    .from('classes')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      program:programs(*)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to update class: ${error.message}`);
  }

  // Schedules are no longer part of the simplified schema

  const result = await getClassById(id, supabase);
  if (!result) {
    throw new Error('Failed to retrieve updated class');
  }
  return result;
}

/**
 * Delete a class (soft delete by setting is_active to false)
 */
export async function deleteClass(
  id: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<void> {
  // Check if class has active enrollments
  const { data: activeEnrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id')
    .eq('class_id', id)
    .eq('status', 'active');

  if (enrollmentError) {
    throw new Error(`Failed to check for active enrollments: ${enrollmentError.message}`);
  }

  if (activeEnrollments && activeEnrollments.length > 0) {
    throw new Error('Cannot delete class with active enrollments. Please drop all students first.');
  }

  const { error } = await supabase
    .from('classes')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete class: ${error.message}`);
  }
}

/**
 * Get all classes with optional filtering
 */
export async function getClasses(
  filters: ClassFilters = {},
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Class[]> {
  let query = supabase
    .from('classes')
    .select(`
      *,
      program:programs(*),
      instructor:profiles(id, first_name, last_name, email)
    `);

  // Apply filters
  if (filters.program_id) {
    query = query.eq('program_id', filters.program_id);
  }

  if (filters.instructor_id) {
    query = query.eq('instructor_id', filters.instructor_id);
  }

  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }



  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch classes: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single class by ID with full details
 */
export async function getClassById(
  id: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassWithDetails | null> {
  const { data, error } = await supabase
    .from('classes')
    .select(`
      *,
      program:programs(*),
      instructor:profiles(id, first_name, last_name, email)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch class: ${error.message}`);
  }

  // Get additional details
  const [sessionsResult, enrollmentsResult, schedulesResult] = await Promise.all([
    supabase
      .from('class_sessions')
      .select('*')
      .eq('class_id', id)
      .order('session_date', { ascending: false })
      .limit(5),
    supabase
      .from('enrollments')
      .select('id')
      .eq('class_id', id)
      .eq('status', 'active'),
    supabase
      .from('class_schedules')
      .select('*')
      .eq('class_id', id)
      .order('day_of_week', { ascending: true })
  ]);

  const sessions = sessionsResult.data || [];
  const enrollments = enrollmentsResult.data || [];
  const schedules = schedulesResult.data || [];

  // Find next upcoming session
  const today = getTodayLocalDateString();
  const { data: nextSession } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('class_id', id)
    .gte('session_date', today)
    .eq('status', 'scheduled')
    .order('session_date')
    .limit(1)
    .single();

  // If no actual session found, calculate next occurrence from schedule
  let nextScheduledTime = null;
  if (!nextSession && schedules.length > 0) {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Map day_of_week enum to JavaScript day numbers
    const dayMap: { [key: string]: number } = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    let earliestSchedule = null;
    let earliestDaysFromNow = 8; // More than a week
    
    // Check all schedules and find the earliest upcoming one
    for (const schedule of schedules) {
      const scheduleDay = dayMap[schedule.day_of_week];
      
      // Calculate days from now to this schedule
      let daysFromNow = (scheduleDay - currentDay + 7) % 7;
      
      // If it's today (daysFromNow === 0), check if the time hasn't passed yet
      if (daysFromNow === 0) {
        const [hours, minutes] = schedule.start_time.split(':').map(Number);
        const scheduleTime = new Date(now);
        scheduleTime.setHours(hours, minutes, 0, 0);
        
        if (scheduleTime <= now) {
          // Time has passed today, so next occurrence is next week
          daysFromNow = 7;
        }
      }
      
      // If this schedule is earlier than our current earliest, update it
      if (daysFromNow < earliestDaysFromNow) {
        earliestDaysFromNow = daysFromNow;
        earliestSchedule = schedule;
      }
    }
    
    if (earliestSchedule) {
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + earliestDaysFromNow);
      
      nextScheduledTime = {
        session_date: formatLocalDate(nextDate),
        start_time: earliestSchedule.start_time,
        end_time: earliestSchedule.start_time, // We don't have end_time in schedule, so use start_time
        status: 'scheduled'
      };
    }
  }

  return {
    ...data,
    enrollment_count: enrollments.length,
    next_session: nextSession || nextScheduledTime || undefined,
    recent_sessions: sessions,
  };
}

/**
 * Get classes by program ID
 */
export async function getClassesByProgram(
  programId: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<Class[]> {
  return getClasses({ program_id: programId, is_active: true }, supabase);
}

/**
 * Generate class sessions based on schedule
 */
export async function generateClassSessions(
  data: BulkSessionGeneration,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<number> {
  const { data: result, error } = await supabase
    .rpc('generate_class_sessions', {
      p_class_id: data.class_id,
      p_start_date: data.start_date,
      p_end_date: data.end_date,
    });

  if (error) {
    throw new Error(`Failed to generate sessions: ${error.message}`);
  }

  // Remove sessions for excluded dates
  if (data.exclude_dates && data.exclude_dates.length > 0) {
    const { error: deleteError } = await supabase
      .from('class_sessions')
      .delete()
      .eq('class_id', data.class_id)
      .in('session_date', data.exclude_dates);

    if (deleteError) {
      throw new Error(`Failed to exclude dates: ${deleteError.message}`);
    }
  }

  return result || 0;
}

/**
 * Create a single class session
 */
export async function createClassSession(
  sessionData: CreateSessionData,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassSession> {
  const { data, error } = await supabase
    .from('class_sessions')
    .insert({
      class_id: sessionData.class_id,
      session_date: sessionData.session_date,
      start_time: sessionData.start_time,
      end_time: sessionData.end_time,

      notes: sessionData.notes,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return data;
}

/**
 * Update a class session
 */
export async function updateClassSession(
  id: string,
  updates: Partial<UpdateSessionData>,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassSession> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Only include fields that are provided
  if (updates.session_date !== undefined) updateData.session_date = updates.session_date;
  if (updates.start_time !== undefined) updateData.start_time = updates.start_time;
  if (updates.end_time !== undefined) updateData.end_time = updates.end_time;

  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.status !== undefined) updateData.status = updates.status;

  const { data, error } = await supabase
    .from('class_sessions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }

  return data;
}

/**
 * Delete a class session
 */
export async function deleteClassSession(
  id: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<void> {
  // Check if session has attendance records
  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .select('id')
    .eq('class_session_id', id);

  if (attendanceError) {
    throw new Error(`Failed to check attendance: ${attendanceError.message}`);
  }

  if (attendance && attendance.length > 0) {
    throw new Error('Cannot delete session with attendance records. Please remove attendance first.');
  }

  const { error } = await supabase
    .from('class_sessions')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete session: ${error.message}`);
  }
}

/**
 * Bulk delete class sessions by date range and optional filters
 */
export async function bulkDeleteClassSessions(
  filters: {
    date_from: string;
    date_to: string;
    class_id?: string;
    status?: 'scheduled' | 'completed' | 'cancelled';
  },
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<{ deletedCount: number; skippedCount: number; errors: string[] }> {
  // First, get all sessions that match the criteria
  let query = supabase
    .from('class_sessions')
    .select('id')
    .gte('session_date', filters.date_from)
    .lte('session_date', filters.date_to);

  if (filters.class_id) {
    query = query.eq('class_id', filters.class_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data: sessions, error: fetchError } = await query;

  if (fetchError) {
    throw new Error(`Failed to fetch sessions for bulk delete: ${fetchError.message}`);
  }

  if (!sessions || sessions.length === 0) {
    return { deletedCount: 0, skippedCount: 0, errors: [] };
  }

  const sessionIds = sessions.map(s => s.id);
  
  // Check which sessions have attendance records
  const { data: attendanceRecords, error: attendanceError } = await supabase
    .from('attendance')
    .select('class_session_id')
    .in('class_session_id', sessionIds);

  if (attendanceError) {
    throw new Error(`Failed to check attendance records: ${attendanceError.message}`);
  }

  const sessionsWithAttendance = new Set(
    attendanceRecords?.map(a => a.class_session_id) || []
  );

  const sessionsToDelete = sessionIds.filter(id => !sessionsWithAttendance.has(id));
  const sessionsToSkip = sessionIds.filter(id => sessionsWithAttendance.has(id));

  let deletedCount = 0;
  const errors: string[] = [];

  // Delete sessions in batches to avoid overwhelming the database
  const batchSize = 50;
  for (let i = 0; i < sessionsToDelete.length; i += batchSize) {
    const batch = sessionsToDelete.slice(i, i + batchSize);
    
    const { error: deleteError } = await supabase
      .from('class_sessions')
      .delete()
      .in('id', batch);

    if (deleteError) {
      errors.push(`Failed to delete batch ${Math.floor(i / batchSize) + 1}: ${deleteError.message}`);
    } else {
      deletedCount += batch.length;
    }
  }

  return {
    deletedCount,
    skippedCount: sessionsToSkip.length,
    errors
  };
}

/**
 * Get class sessions with optional filtering
 */
export async function getClassSessions(
  filters: SessionFilters = {},
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<ClassSession[]> {
  let query = supabase
    .from('class_sessions')
    .select(`
      *,
      class:classes(id, name, program:programs(name))
    `);

  // Apply filters
  if (filters.class_id) {
    query = query.eq('class_id', filters.class_id);
  }



  if (filters.session_date_from) {
    query = query.gte('session_date', filters.session_date_from);
  }

  if (filters.session_date_to) {
    query = query.lte('session_date', filters.session_date_to);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  query = query.order('session_date', { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return data || [];
}

/**
 * Get calendar events for classes and sessions
 */
export async function getCalendarEvents(
  startDate: string,
  endDate: string,
  classIds?: string[],
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<CalendarEvent[]> {
  let query = supabase
    .from('class_sessions')
    .select(`
      *,
      class:classes(
        id,
        name,
        max_capacity,
        program:programs(name)
      )
    `)
    .gte('session_date', startDate)
    .lte('session_date', endDate);

  if (classIds && classIds.length > 0) {
    query = query.in('class_id', classIds);
  }

  query = query.order('session_date');

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch calendar events: ${error.message}`);
  }

  interface SessionWithRelations {
    id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    class_id: string;
    status: string;
    class?: {
      id: string;
      name: string;
      max_capacity: number;
      program?: {
        name: string;
      };
    };
    instructor?: {
      first_name: string;
      last_name: string;
    };
  }

  return (data || []).map((session: SessionWithRelations) => {
    // Parse date string as local date to avoid timezone issues
    const [year, month, day] = session.session_date.split('-').map(Number);
    const startDateTime = new Date(year, month - 1, day);
    const endDateTime = new Date(year, month - 1, day);
    
    // Parse time strings and set hours/minutes
    if (session.start_time) {
      const [startHour, startMinute] = session.start_time.split(':').map(Number);
      startDateTime.setHours(startHour, startMinute, 0, 0);
    }
    
    if (session.end_time) {
      const [endHour, endMinute] = session.end_time.split(':').map(Number);
      endDateTime.setHours(endHour, endMinute, 0, 0);
    }
    
    return {
      id: session.id,
      title: session.class?.name || 'Class Session',
      start: startDateTime,
      end: endDateTime,
      type: 'session' as const,
      class_id: session.class_id,
      session_id: session.id,
      enrollment_count: 0, // TODO: Calculate actual enrollment count if needed
      status: session.status as 'scheduled' | 'completed' | 'cancelled',
    };
  });
}

/**
 * Get weekly schedule for classes
 */
export async function getWeeklySchedule(
  weekStartDate: string,
  classIds?: string[],
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<WeeklySchedule> {
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  
  const events = await getCalendarEvents(
    weekStartDate,
    formatLocalDate(weekEndDate),
    classIds,
    supabase
  );

  const schedule: WeeklySchedule = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };

  events.forEach(event => {
    const dayName = event.start.toLocaleDateString(siteConfig.localization.locale, { weekday: 'long' }).toLowerCase() as keyof WeeklySchedule;
    if (schedule[dayName]) {
      schedule[dayName].push(event);
    }
  });

  // Sort events by start time for each day
  Object.keys(schedule).forEach(day => {
    const dayKey = day as keyof WeeklySchedule;
    schedule[dayKey].sort((a, b) => a.start.getTime() - b.start.getTime());
  });

  return schedule;
}

/**
 * Check for schedule conflicts when enrolling a student
 */
export async function checkScheduleConflicts(
  studentId: string,
  newClassId: string,
  supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
): Promise<{ hasConflicts: boolean; conflicts: Record<string, unknown>[] }> {
  // Get student's current active enrollments
  const { data: currentEnrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select(`
      class_id,
      class:classes(
        id,
        name
      )
    `)
    .eq('student_id', studentId)
    .eq('status', 'active');

  if (enrollmentError) {
    throw new Error(`Failed to check current enrollments: ${enrollmentError.message}`);
  }

  if (!currentEnrollments || currentEnrollments.length === 0) {
    return { hasConflicts: false, conflicts: [] };
  }

  // Get schedules for all current classes
  const currentClassIds = currentEnrollments.map(e => e.class_id);
  const { data: currentSchedules, error: currentScheduleError } = await supabase
    .from('class_schedules')
    .select('*')
    .in('class_id', currentClassIds);

  if (currentScheduleError) {
    throw new Error(`Failed to fetch current class schedules: ${currentScheduleError.message}`);
  }

  // Get new class schedules
  const { data: newClassSchedules, error: scheduleError } = await supabase
    .from('class_schedules')
    .select('*')
    .eq('class_id', newClassId);

  if (scheduleError) {
    throw new Error(`Failed to fetch new class schedules: ${scheduleError.message}`);
  }

  const conflicts: Record<string, unknown>[] = [];

  // Check for conflicts between existing and new schedules
  currentSchedules?.forEach(existingSchedule => {
    const enrollment = currentEnrollments.find(e => e.class_id === existingSchedule.class_id);
    if (!enrollment) return;

    newClassSchedules?.forEach(newSchedule => {
      // Check for day conflicts
      if (existingSchedule.day_of_week === newSchedule.day_of_week) {
        // For time overlap, we need to assume a duration since class_schedules only has start_time
        // Let's assume 1 hour duration for now, or we could add end_time to the schema
        const existingStart = new Date(`2000-01-01T${existingSchedule.start_time}`);
        const existingEnd = new Date(existingStart.getTime() + 60 * 60 * 1000); // Add 1 hour
        const newStart = new Date(`2000-01-01T${newSchedule.start_time}`);
        const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000); // Add 1 hour

        const hasTimeOverlap = (
          (newStart >= existingStart && newStart < existingEnd) ||
          (newEnd > existingStart && newEnd <= existingEnd) ||
          (newStart <= existingStart && newEnd >= existingEnd)
        );

        if (hasTimeOverlap) {
           conflicts.push({
             student_id: studentId,
             conflicting_class_id: enrollment.class_id,
             conflicting_class_name: (enrollment.class as { name?: string })?.name || 'Unknown Class',
             conflict_days: [existingSchedule.day_of_week],
             conflict_times: {
               existing_start: existingSchedule.start_time,
               new_start: newSchedule.start_time,
             },
           });
         }
      }
    });
  });

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}