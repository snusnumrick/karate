import { json, type LoaderFunctionArgs } from '@vercel/remix';
import { Link, useLoaderData } from '@remix-run/react';
import { addDays, format, isAfter } from 'date-fns';
import type { UserRole } from '~/types/auth';
import {
  getInstructorSessionsWithDetails,
  serializeInstructorSessionSummary,
  resolveInstructorPortalContext,
} from '~/services/instructor.server';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import type { InstructorRouteHandle } from '~/routes/instructor';
import { formatDate, getCurrentDateTimeInTimezone } from '~/utils/misc';

interface StudentSummary {
  studentId: string;
  fullName: string;
  eligibilityReason?: string;
  isEligible: boolean;
  upcomingSessions: number;
  lastSession: string | null;
}

interface StudentsLoaderData {
  role: UserRole;
  students: StudentSummary[];
}

export const handle: InstructorRouteHandle = {
  breadcrumb: () => [{ label: 'Students', href: '/instructor/students' }],
};

/**
 * Parse a local datetime string (YYYY-MM-DDTHH:mm:ss) as a local Date
 * This avoids timezone conversion issues
 */
function parseLocalDateTime(dateTimeString: string): Date {
  const [datePart, timePart] = dateTimeString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds = 0] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const context = await resolveInstructorPortalContext(request);
  const { role, viewInstructorId, supabaseAdmin, headers } = context;

  const today = getCurrentDateTimeInTimezone();
  const startDate = format(addDays(today, -90), 'yyyy-MM-dd');
  const endDate = format(addDays(today, 30), 'yyyy-MM-dd');

  const sessions = await getInstructorSessionsWithDetails({
    instructorId: viewInstructorId,
    startDate,
    endDate,
    supabaseAdmin,
  });

  const serialized = sessions.map(serializeInstructorSessionSummary);
  const studentMap = new Map<string, StudentSummary>();

  for (const session of serialized) {
    const sessionStart = session.start ? parseLocalDateTime(session.start) : null;
    const isPastOrCompleted = session.status === 'completed' || (sessionStart && !isAfter(sessionStart, today));

    for (const entry of session.roster) {
      const prior = studentMap.get(entry.studentId);
      const isEligible = entry.eligibility?.eligible ?? false;
      const eligibilityReason = entry.eligibility?.reason;
      const upcomingSessions = (prior?.upcomingSessions ?? 0) + (sessionStart && isAfter(sessionStart, today) ? 1 : 0);
      const fullName = entry.fullName;

      // Only update lastSession if:
      // 1. Session is in the past or completed
      // 2. Student actually attended (present or late)
      // 3. We have a complete datetime (not just date)
      const studentAttended = entry.attendanceStatus === 'present' || entry.attendanceStatus === 'late';
      const hasCompleteDateTime = session.start !== null;
      const shouldUpdateLastSession = isPastOrCompleted && studentAttended && hasCompleteDateTime;
      const lastSessionIso = shouldUpdateLastSession ? session.start : null;

      studentMap.set(entry.studentId, {
        studentId: entry.studentId,
        fullName,
        eligibilityReason,
        isEligible,
        upcomingSessions,
        lastSession: pickMoreRecent(prior?.lastSession ?? null, lastSessionIso),
      });
    }
  }

  const students = Array.from(studentMap.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));

  return json<StudentsLoaderData>({ role, students }, { headers });
}

export default function InstructorStudentsPage() {
  const data = useLoaderData<StudentsLoaderData>();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="instructor-page-header-styles">Enrolled Students</h1>
        <p className="instructor-subheader-styles">Snapshot of students tied to upcoming sessions for quick eligibility checks.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> {data.students.length} students
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.students.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Eligibility</TableHead>
                  <TableHead className="text-right">Upcoming sessions</TableHead>
                  <TableHead className="text-right">Last class</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.students.map((student) => (
                  <TableRow key={student.studentId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{student.fullName}</span>
                        <Link to={`/instructor/attendance?studentId=${student.studentId}`} className="text-xs text-primary hover:underline">
                          View attendance
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.isEligible ? (
                        <Badge variant="outline" className="flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" /> {student.eligibilityReason ?? 'In good standing'}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" /> {student.eligibilityReason ?? 'Needs attention'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{student.upcomingSessions}</TableCell>
                    <TableCell className="text-right">{student.lastSession ? formatDate(student.lastSession, { type: 'datetime' }) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="instructor-empty-state-styles py-12">
      <Users className="h-8 w-8" />
      <p>No active students found for this instructor window.</p>
    </div>
  );
}

function pickMoreRecent(existing: string | null, candidate: string | null): string | null {
  if (!candidate) return existing;
  if (!existing) return candidate;
  const existingDate = parseLocalDateTime(existing);
  const candidateDate = parseLocalDateTime(candidate);
  return candidateDate > existingDate ? candidate : existing;
}
