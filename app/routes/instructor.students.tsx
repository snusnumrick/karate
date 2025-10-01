import { json, type LoaderFunctionArgs } from '@vercel/remix';
import { Link, useLoaderData } from '@remix-run/react';
import { addDays, format, isAfter, parseISO } from 'date-fns';
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

export async function loader({ request }: LoaderFunctionArgs) {
  const context = await resolveInstructorPortalContext(request);
  const { role, viewInstructorId, supabaseAdmin, headers } = context;

  const today = new Date();
  const startDate = format(addDays(today, -7), 'yyyy-MM-dd');
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
    const sessionStart = session.start ? parseISO(session.start) : null;
    for (const entry of session.roster) {
      const prior = studentMap.get(entry.studentId);
      const isEligible = entry.eligibility?.eligible ?? false;
      const eligibilityReason = entry.eligibility?.reason;
      const upcomingSessions = (prior?.upcomingSessions ?? 0) + (sessionStart && isAfter(sessionStart, today) ? 1 : 0);
      const fullName = entry.fullName;
      const lastSessionIso = session.start ?? session.sessionDate;

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
        <h1 className="text-3xl font-bold tracking-tight">Enrolled Students</h1>
        <p className="text-muted-foreground">Snapshot of students tied to upcoming sessions for quick eligibility checks.</p>
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
                    <TableCell className="text-right">{student.lastSession ? format(parseISO(student.lastSession), 'MMM d, h:mm a') : '—'}</TableCell>
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
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
      <Users className="h-8 w-8" />
      <p>No active students found for this instructor window.</p>
    </div>
  );
}

function pickMoreRecent(existing: string | null, candidate: string | null): string | null {
  if (!candidate) return existing;
  if (!existing) return candidate;
  const existingDate = parseISO(existing);
  const candidateDate = parseISO(candidate);
  return candidateDate > existingDate ? candidate : existing;
}
