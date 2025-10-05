import { differenceInMinutes, format, parseISO } from 'date-fns';
import { redirect } from '@vercel/remix';
import { getSupabaseAdminClient, getSupabaseServerClient, getUserRole, checkStudentEligibility } from '~/utils/supabase.server';
import { isAdminRole, isInstructorRole, type UserRole } from '~/types/auth';
import type { ClassEnrollment, ClassSession } from '~/types/multi-class';
import type { EligibilityStatus } from '~/types/payment';
import { getClassSessions } from './class.server';
import { getEnrollmentsByClass } from './enrollment.server';
import { getAttendanceForSessions, type AttendanceRecord } from './attendance.server';

export interface InstructorSessionSummary {
  session: ClassSession;
  roster: ClassEnrollment[];
  attendance: AttendanceRecord[];
  attendanceSummary: AttendanceSummary;
  eligibilitySummary: SessionEligibilitySummary;
  startDateTime: Date | null;
  endDateTime: Date | null;
}

export interface AttendanceSummary {
  present: number;
  late: number;
  absent: number;
  excused: number;
  unmarked: number;
}

export interface SessionEligibilitySummary {
  total: number;
  flagged: number;
  flaggedStudents: FlaggedStudent[];
  byStudent: Record<string, EligibilityStatus>;
}

export interface FlaggedStudent {
  studentId: string;
  fullName: string;
  eligibility: EligibilityStatus;
}

export interface InstructorSessionRosterEntry {
  studentId: string;
  fullName: string;
  attendanceStatus: AttendanceRecord['status'] | 'unmarked';
  eligibility?: EligibilityStatus;
}

export interface InstructorSessionPayload {
  id: string;
  classId: string;
  className: string;
  programName: string | null;
  programDescription: string | null;
  sessionDate: string;
  start: string | null;
  end: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  attendanceSummary: AttendanceSummary;
  eligibilitySummary: {
    total: number;
    flagged: number;
    flaggedStudents: FlaggedStudent[];
  };
  roster: InstructorSessionRosterEntry[];
}

export interface InstructorOption {
  id: string;
  fullName: string;
  role: UserRole;
}

export interface InstructorPortalContext {
  role: UserRole;
  viewInstructorId: string | null;
  supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>;
  instructorOptions: InstructorOption[];
  headers: Record<string, string>;
  userId: string;
  searchParams: URLSearchParams;
}

export interface InstructorSessionOptions {
  instructorId?: string | null;
  startDate: string;
  endDate: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdminClient>;
}

export async function resolveInstructorPortalContext(request: Request): Promise<InstructorPortalContext> {
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();
  const headers = Object.fromEntries(response.headers);

  if (!user) {
    throw redirect('/login?redirectTo=/instructor', { headers });
  }

  const role = await getUserRole(user.id);

  if (!role || (!isInstructorRole(role) && !isAdminRole(role))) {
    throw redirect('/', { headers });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const url = new URL(request.url);
  const selectedInstructor = url.searchParams.get('instructorId');

  const viewInstructorId = isAdminRole(role)
    ? selectedInstructor && selectedInstructor !== 'all'
      ? selectedInstructor
      : null
    : user.id;

  let instructorOptions: InstructorOption[] = [];
  if (isAdminRole(role)) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .in('role', ['instructor', 'admin']);

    if (!error && data) {
      instructorOptions = data
        .map((profile) => ({
          id: profile.id,
          fullName: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email,
          role: profile.role as UserRole,
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
  }

  return {
    role,
    viewInstructorId,
    supabaseAdmin,
    instructorOptions,
    headers,
    userId: user.id,
    searchParams: url.searchParams,
  };
}

export async function getInstructorSessionsWithDetails({
  instructorId,
  startDate,
  endDate,
  supabaseAdmin,
}: InstructorSessionOptions): Promise<InstructorSessionSummary[]> {
  const supabase = supabaseAdmin ?? getSupabaseAdminClient();
  const sessions = await getClassSessions(
    {
      session_date_from: startDate,
      session_date_to: endDate,
    },
    supabase,
  );

  const relevantSessions = typeof instructorId === 'string' && instructorId.length > 0
    ? sessions.filter((session) => {
        const assignedInstructor = session.instructor_id ?? session.class?.instructor_id ?? null;
        if (!assignedInstructor) return true;
        return assignedInstructor === instructorId;
      })
    : sessions;

  if (relevantSessions.length === 0) {
    return [];
  }

  const classIds = Array.from(
    new Set(
      relevantSessions
        .map((session) => session.class_id)
        .filter((classId): classId is string => typeof classId === 'string')
    )
  );

  const enrollmentsByClass = new Map<string, ClassEnrollment[]>();

  await Promise.all(
    classIds.map(async (classId) => {
      const enrollments = await getEnrollmentsByClass(classId, supabase);
      const filtered = enrollments.filter((enrollment) =>
        enrollment.status === 'active' || enrollment.status === 'trial'
      );
      enrollmentsByClass.set(classId, filtered);
    })
  );

  const sessionIds = relevantSessions.map((session) => session.id);
  const attendanceMap = await getAttendanceForSessions(sessionIds, supabase);

  const uniqueStudentIds = new Set<string>();
  for (const roster of enrollmentsByClass.values()) {
    for (const enrollment of roster) {
      uniqueStudentIds.add(enrollment.student_id);
    }
  }

  const eligibilityCache = new Map<string, EligibilityStatus>();
  for (const studentId of uniqueStudentIds) {
    const eligibility = await checkStudentEligibility(studentId, supabase);
    eligibilityCache.set(studentId, eligibility);
  }

  return relevantSessions.map((session) => {
    const roster = enrollmentsByClass.get(session.class_id) ?? [];
    const attendance = attendanceMap[session.id] ?? [];
    const attendanceSummary = summarizeAttendance(roster, attendance);
    const eligibilitySummary = summarizeEligibility(roster, eligibilityCache);
    const startDateTime = combineDateAndTime(session.session_date, session.start_time);
    const endDateTime = combineDateAndTime(session.session_date, session.end_time);

    return {
      session,
      roster,
      attendance,
      attendanceSummary,
      eligibilitySummary,
      startDateTime,
      endDateTime,
    };
  });
}

function summarizeAttendance(roster: ClassEnrollment[], attendance: AttendanceRecord[]): AttendanceSummary {
  const present = attendance.filter((record) => record.status === 'present').length;
  const late = attendance.filter((record) => record.status === 'late').length;
  const excused = attendance.filter((record) => record.status === 'excused').length;
  const absent = attendance.filter((record) => record.status === 'absent').length;
  const recordedIds = new Set(attendance.map((record) => record.student_id));
  const unmarked = roster.filter((enrollment) => !recordedIds.has(enrollment.student_id)).length;

  return { present, late, excused, absent, unmarked };
}

function summarizeEligibility(
  roster: ClassEnrollment[],
  eligibilityCache: Map<string, EligibilityStatus>,
): SessionEligibilitySummary {
  const flaggedStudents: FlaggedStudent[] = [];
  const byStudent: Record<string, EligibilityStatus> = {};

  for (const enrollment of roster) {
    const eligibility = eligibilityCache.get(enrollment.student_id);
    if (!eligibility) continue;

    byStudent[enrollment.student_id] = eligibility;

    if (!eligibility.eligible) {
      const fullName = [enrollment.student?.first_name, enrollment.student?.last_name]
        .filter(Boolean)
        .join(' ') || 'Unknown Student';

      flaggedStudents.push({
        studentId: enrollment.student_id,
        fullName,
        eligibility,
      });
    }
  }

  return {
    total: roster.length,
    flagged: flaggedStudents.length,
    flaggedStudents,
    byStudent,
  };
}

function combineDateAndTime(date: string, time?: string | null): Date | null {
  if (!date || !time) {
    return null;
  }

  const isoString = `${date}T${time}`;
  try {
    return parseISO(isoString);
  } catch {
    return null;
  }
}

export function formatSessionTimeRange(start: Date | null, end: Date | null): string {
  if (!start) return 'Time TBD';

  if (!end) {
    return format(start, 'h:mm a');
  }

  const sameDay = start.toDateString() === end.toDateString();
  const dayPart = format(start, 'EEE MMM d');
  const startPart = format(start, 'h:mm a');
  const endPart = format(end, sameDay ? 'h:mm a' : 'EEE MMM d h:mm a');

  return `${dayPart} · ${startPart} – ${endPart}`;
}

export function calculateSessionDurationMinutes(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  return differenceInMinutes(end, start);
}

export function serializeInstructorSessionSummary(summary: InstructorSessionSummary): InstructorSessionPayload {
  const attendanceByStudent = new Map(summary.attendance.map((record) => [record.student_id, record]));

  const roster: InstructorSessionRosterEntry[] = summary.roster.map((enrollment) => {
    const attendance = attendanceByStudent.get(enrollment.student_id);
    const fullName = [enrollment.student?.first_name, enrollment.student?.last_name]
      .filter(Boolean)
      .join(' ') || 'Unnamed Student';

    return {
      studentId: enrollment.student_id,
      fullName,
      attendanceStatus: attendance?.status ?? 'unmarked',
      eligibility: summary.eligibilitySummary.byStudent[enrollment.student_id],
    };
  });

  return {
    id: summary.session.id,
    classId: summary.session.class_id,
    className: summary.session.class?.name ?? 'Class Session',
    programName: summary.session.class?.program?.name ?? null,
    programDescription: summary.session.class?.program?.description ?? null,
    sessionDate: summary.session.session_date,
    start: summary.startDateTime ? summary.startDateTime.toISOString() : null,
    end: summary.endDateTime ? summary.endDateTime.toISOString() : null,
    status: summary.session.status,
    notes: summary.session.notes ?? null,
    attendanceSummary: summary.attendanceSummary,
    eligibilitySummary: {
      total: summary.eligibilitySummary.total,
      flagged: summary.eligibilitySummary.flagged,
      flaggedStudents: summary.eligibilitySummary.flaggedStudents,
    },
    roster,
  };
}
