import { getSupabaseAdminClient } from '~/utils/supabase.server';

type AttendanceRecord = {
  id?: string;
  student_id: string;
  class_session_id: string;
  status: 'present' | 'absent' | 'excused' | 'late';
  notes?: string;
};

type AttendanceWithStudent = AttendanceRecord & {
  students: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

type AttendanceWithSession = AttendanceRecord & {
  class_sessions: {
    id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    class_id: string;
    classes: {
      name: string;
      program_id: string;
      programs: {
        name: string;
      } | null;
    } | null;
  } | null;
};

/**
 * Get attendance records for a specific class session
 */
export async function getAttendanceBySession(
  sessionId: string,
  supabase = getSupabaseAdminClient()
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('class_session_id', sessionId);

  if (error) {
    console.error('Error fetching attendance by session:', error);
    throw new Error(`Failed to fetch attendance: ${error.message}`);
  }

  return data.map(record => ({
    id: record.id,
    student_id: record.student_id,
    class_session_id: record.class_session_id!,
    status: record.status as 'present' | 'absent' | 'excused' | 'late',
    notes: record.notes || undefined
  }));
}

/**
 * Get attendance records for a student within a date range
 */
export async function getAttendanceByStudent(
  studentId: string,
  startDate?: string,
  endDate?: string,
  supabase = getSupabaseAdminClient()
): Promise<AttendanceWithSession[]> {
  let query = supabase
    .from('attendance')
    .select(`
      *,
      class_sessions (
        id,
        session_date,
        start_time,
        end_time,
        class_id,
        classes (
          name,
          program_id,
          programs (
            name
          )
        )
      )
    `)
    .eq('student_id', studentId)
    .not('class_session_id', 'is', null);

  if (startDate && endDate) {
    query = query
      .gte('class_sessions.session_date', startDate)
      .lte('class_sessions.session_date', endDate);
  }

  const { data, error } = await query.order('class_sessions.session_date', { ascending: false });

  if (error) {
    console.error('Error fetching attendance by student:', error);
    throw new Error(`Failed to fetch attendance: ${error.message}`);
  }

  return data.map(record => ({
    id: record.id,
    student_id: record.student_id,
    class_session_id: record.class_session_id!,
    status: record.status as 'present' | 'absent' | 'excused' | 'late',
    notes: record.notes || undefined,
    class_sessions: record.class_sessions
  }));
}

/**
 * Get attendance records for a date range with student and session details
 */
export async function getAttendanceByDateRange(
  startDate: string,
  endDate: string,
  supabase = getSupabaseAdminClient()
): Promise<AttendanceWithStudent[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      *,
      students (
        id,
        first_name,
        last_name
      ),
      class_sessions (
        session_date
      )
    `)
    .not('class_session_id', 'is', null)
    .gte('class_sessions.session_date', startDate)
    .lte('class_sessions.session_date', endDate)
    .order('class_sessions.session_date', { ascending: false });

  if (error) {
    console.error('Error fetching attendance by date range:', error);
    throw new Error(`Failed to fetch attendance: ${error.message}`);
  }

  return data.map(record => ({
    id: record.id,
    student_id: record.student_id,
    class_session_id: record.class_session_id!,
    status: record.status as 'present' | 'absent' | 'excused' | 'late',
    notes: record.notes || undefined,
    students: record.students
  }));
}

/**
 * Record attendance for multiple students in a session
 */
export async function recordSessionAttendance(
  sessionId: string,
  attendanceRecords: Omit<AttendanceRecord, 'class_session_id'>[],
  supabase = getSupabaseAdminClient()
): Promise<AttendanceRecord[]> {
  // First, delete existing attendance records for this session
  const { error: deleteError } = await supabase
    .from('attendance')
    .delete()
    .eq('class_session_id', sessionId);

  if (deleteError) {
    console.error('Error deleting existing attendance:', deleteError);
    throw new Error(`Failed to delete existing attendance: ${deleteError.message}`);
  }

  // Then insert new attendance records with required fields
  const recordsToInsert = attendanceRecords.map(record => ({
    student_id: record.student_id,
    class_session_id: sessionId,
    status: record.status,
    notes: record.notes || null
  }));

  const { data, error } = await supabase
    .from('attendance')
    .insert(recordsToInsert)
    .select();

  if (error) {
    console.error('Error inserting attendance records:', error);
    throw new Error(`Failed to record attendance: ${error.message}`);
  }

  return data.map(record => ({
    id: record.id,
    student_id: record.student_id,
    class_session_id: record.class_session_id!,
    status: record.status as 'present' | 'absent' | 'excused' | 'late',
    notes: record.notes || undefined
  }));
}

/**
 * Get attendance statistics for a student
 */
export async function getStudentAttendanceStats(
  studentId: string,
  startDate?: string,
  endDate?: string,
  supabase = getSupabaseAdminClient()
): Promise<{
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  lateCount: number;
  attendanceRate: number;
}> {
  let query = supabase
    .from('attendance')
    .select(`
      status,
      class_sessions (
        session_date
      )
    `)
    .eq('student_id', studentId)
    .not('class_session_id', 'is', null);

  if (startDate && endDate) {
    query = query
      .gte('class_sessions.session_date', startDate)
      .lte('class_sessions.session_date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching attendance stats:', error);
    throw new Error(`Failed to fetch attendance stats: ${error.message}`);
  }

  const totalSessions = data.length;
  const presentCount = data.filter(record => record.status === 'present').length;
  const absentCount = data.filter(record => record.status === 'absent').length;
  const excusedCount = data.filter(record => record.status === 'excused').length;
  const lateCount = data.filter(record => record.status === 'late').length;
  const attendanceRate = totalSessions > 0 ? (presentCount + lateCount) / totalSessions : 0;

  return {
    totalSessions,
    presentCount,
    absentCount,
    excusedCount,
    lateCount,
    attendanceRate
  };
}

/**
 * Get attendance summary for a class session
 */
export async function getSessionAttendanceSummary(
  sessionId: string,
  supabase = getSupabaseAdminClient()
): Promise<{
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  lateCount: number;
  attendanceRate: number;
}> {
  const { data, error } = await supabase
    .from('attendance')
    .select('status')
    .eq('class_session_id', sessionId);

  if (error) {
    console.error('Error fetching session attendance summary:', error);
    throw new Error(`Failed to fetch session attendance summary: ${error.message}`);
  }

  const totalStudents = data.length;
  const presentCount = data.filter(record => record.status === 'present').length;
  const absentCount = data.filter(record => record.status === 'absent').length;
  const excusedCount = data.filter(record => record.status === 'excused').length;
  const lateCount = data.filter(record => record.status === 'late').length;
  const attendanceRate = totalStudents > 0 ? (presentCount + lateCount) / totalStudents : 0;

  return {
    totalStudents,
    presentCount,
    absentCount,
    excusedCount,
    lateCount,
    attendanceRate
  };
}

/**
 * Delete attendance record
 */
export async function deleteAttendanceRecord(
  attendanceId: string,
  supabase = getSupabaseAdminClient()
): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', attendanceId);

  if (error) {
    console.error('Error deleting attendance record:', error);
    throw new Error(`Failed to delete attendance record: ${error.message}`);
  }
}

/**
 * Check if a session has any attendance records
 */
export async function hasAttendanceRecords(
  sessionId: string,
  supabase = getSupabaseAdminClient()
): Promise<boolean> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id')
    .eq('class_session_id', sessionId)
    .limit(1);

  if (error) {
    console.error('Error checking attendance records:', error);
    return false;
  }

  return data.length > 0;
}