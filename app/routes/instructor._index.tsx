import { json, type LoaderFunctionArgs } from '@vercel/remix';
import { Form, Link, useLoaderData, useNavigate, useSearchParams, useSubmit } from '@remix-run/react';
import { addDays, format } from 'date-fns';
import { useMemo, type ComponentType } from 'react';
import type { UserRole } from '~/types/auth';
import {
  getInstructorSessionsWithDetails,
  serializeInstructorSessionSummary,
  resolveInstructorPortalContext,
  type InstructorSessionPayload,
  type InstructorOption,
} from '~/services/instructor.server';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { AlertTriangle, CalendarDays, ChevronRight, Clock, Users } from 'lucide-react';
import type { InstructorRouteHandle } from '~/routes/instructor';
import { formatDate } from '~/utils/misc';

type SerializableSession = InstructorSessionPayload;

interface DashboardMetrics {
  totalSessions: number;
  totalStudents: number;
  pendingAttendance: number;
  flaggedStudents: number;
}

interface DashboardLoaderData {
  role: UserRole;
  viewInstructorId: string | null;
  instructorOptions: InstructorOption[];
  todayLabel: string;
  upcomingLabel: string;
  metrics: DashboardMetrics;
  todaySessions: SerializableSession[];
  upcomingSessions: SerializableSession[];
  nextSession: SerializableSession | null;
}

export const handle: InstructorRouteHandle = {
  breadcrumb: () => [{ label: 'Dashboard', href: '/instructor' }],
};

export async function loader({ request }: LoaderFunctionArgs) {
  const {
    role,
    viewInstructorId,
    supabaseAdmin,
    instructorOptions,
    headers,
  } = await resolveInstructorPortalContext(request);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const upcomingStart = format(addDays(today, 1), 'yyyy-MM-dd');
  const upcomingEnd = format(addDays(today, 7), 'yyyy-MM-dd');

  const [todaySummaries, upcomingSummaries] = await Promise.all([
    getInstructorSessionsWithDetails({
      instructorId: viewInstructorId,
      startDate: todayStr,
      endDate: todayStr,
      supabaseAdmin,
    }),
    getInstructorSessionsWithDetails({
      instructorId: viewInstructorId,
      startDate: upcomingStart,
      endDate: upcomingEnd,
      supabaseAdmin,
    }),
  ]);

  const todaySessions = todaySummaries.map(serializeInstructorSessionSummary);
  const upcomingSessions = upcomingSummaries.map(serializeInstructorSessionSummary);

  const metrics: DashboardMetrics = {
    totalSessions: todaySessions.length,
    totalStudents: todaySessions.reduce((acc, session) => acc + session.roster.length, 0),
    pendingAttendance: todaySessions.reduce((acc, session) => acc + session.attendanceSummary.unmarked, 0),
    flaggedStudents: todaySessions.reduce((acc, session) => acc + session.eligibilitySummary.flagged, 0),
  };

  const chronologicalSessions = [...todaySummaries, ...upcomingSummaries]
    .filter((summary) => summary.startDateTime)
    .sort((a, b) => (a.startDateTime && b.startDateTime ? a.startDateTime.getTime() - b.startDateTime.getTime() : 0));

  const now = new Date();
  const nextSummary = chronologicalSessions.find((summary) => summary.startDateTime && summary.startDateTime >= now);
  const nextSession = nextSummary ? serializeInstructorSessionSummary(nextSummary) : null;

  return json<DashboardLoaderData>({
    role,
    viewInstructorId,
    instructorOptions,
    todayLabel: formatDate(today, { formatString: 'EEEE, MMMM d' }),
    upcomingLabel: `${formatDate(addDays(today, 1), { formatString: 'MMM d' })} – ${formatDate(addDays(today, 7), { formatString: 'MMM d' })}`,
    metrics,
    todaySessions,
    upcomingSessions,
    nextSession,
  }, { headers });
}

export default function InstructorDashboard() {
  const data = useLoaderData<DashboardLoaderData>();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAdmin = data.role === 'admin';
  const nextSession = data.nextSession;

  const selectedInstructorId = useMemo(() => {
    if (!isAdmin) return data.viewInstructorId ?? '';
    return searchParams.get('instructorId') ?? (data.viewInstructorId ?? 'all');
  }, [isAdmin, searchParams, data.viewInstructorId]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="instructor-page-header-styles">Instructor Dashboard</h1>
<p className="instructor-subheader-styles">Stay on top of today&apos;s classes, attendance, and eligibility in one place.</p>
        </div>

        {isAdmin && data.instructorOptions.length > 0 && (
          <Form method="get" className="flex items-center gap-2">
            <label htmlFor="instructorId" className="text-sm font-medium text-muted-foreground">
              Viewing schedule for
            </label>
            <select
              id="instructorId"
              name="instructorId"
              defaultValue={selectedInstructorId}
              onChange={(event) => {
                const form = event.currentTarget.form;
                if (form) {
                  submit(form);
                }
              }}
              className="border border-border bg-background text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All instructors</option>
              {data.instructorOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.fullName} {option.role === 'admin' ? '(Admin)' : ''}
                </option>
              ))}
            </select>
          </Form>
        )}
      </header>

      {nextSession && (
        <Card className="border-primary/40 bg-primary/5 dark:bg-primary/10">
          <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-primary">
              <CalendarDays className="h-5 w-5" />
              Next session
            </CardTitle>
            <span className="text-sm text-primary/80">
              {formatSessionTimeRange(nextSession.start, nextSession.end)}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">{nextSession.className}</h2>
              {nextSession.programName && (
                <p className="text-sm text-muted-foreground">{nextSession.programName}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <MetricPill icon={Users} label="Roster" value={`${nextSession.roster.length} students`} />
              <MetricPill
                icon={AlertTriangle}
                label="Eligibility flags"
                value={`${nextSession.eligibilitySummary.flagged}`}
                variant={nextSession.eligibilitySummary.flagged > 0 ? 'warn' : 'ok'}
              />
              <Button variant="outline" size="sm" onClick={() => navigate(`/instructor/sessions?focus=${nextSession.id}`)}>
                View details <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="instructor-section-header-styles">Today · {data.todayLabel}</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <DashboardMetricCard icon={CalendarDays} title="Sessions" value={data.metrics.totalSessions} accent="bg-blue-500" />
          <DashboardMetricCard icon={Users} title="Students" value={data.metrics.totalStudents} accent="bg-emerald-500" />
          <DashboardMetricCard icon={Clock} title="Attendance pending" value={data.metrics.pendingAttendance} accent="bg-amber-500" />
          <DashboardMetricCard icon={AlertTriangle} title="Eligibility flags" value={data.metrics.flaggedStudents} accent="bg-red-500" />
        </div>

        <div className="mt-6 space-y-4">
          {data.todaySessions.length === 0 ? (
            <EmptyState title="No sessions scheduled" description="You have no classes assigned today." icon={CalendarDays} />
          ) : (
            data.todaySessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="instructor-section-header-styles">Upcoming · {data.upcomingLabel}</h2>
        {data.upcomingSessions.length === 0 ? (
          <EmptyState title="Nothing on the horizon" description="No upcoming sessions in the next week." icon={CalendarDays} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.upcomingSessions.map((session) => (
              <SessionCompactCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DashboardMetricCard({
  icon: Icon,
  title,
  value,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: number | string;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-6">
        <div className={`h-12 w-12 rounded-full ${accent} bg-opacity-10 flex items-center justify-center`}> 
          <Icon className="h-6 w-6 text-foreground" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
  variant = 'default',
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  variant?: 'default' | 'warn' | 'ok';
}) {
  const variantClass = variant === 'warn'
    ? 'instructor-badge-warn-styles'
    : variant === 'ok'
      ? 'instructor-badge-success-styles'
      : 'bg-primary/10 text-primary';

  return (
    <span className={`instructor-stat-pill-styles ${variantClass}`}>
      <Icon className="h-4 w-4" />
      <span className="font-medium">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function SessionCard({ session }: { session: SerializableSession }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>{session.className}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {formatSessionTimeRange(session.start, session.end)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">Roster · {session.roster.length}</Badge>
          <Badge variant={session.eligibilitySummary.flagged > 0 ? 'destructive' : 'secondary'}>
            {session.eligibilitySummary.flagged} flagged
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {session.programDescription && (
          <p className="text-sm text-muted-foreground line-clamp-2">{session.programDescription}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-4">
          <AttendanceChip label="Present" value={session.attendanceSummary.present} variant="success" />
          <AttendanceChip label="Late" value={session.attendanceSummary.late} variant="warn" />
          <AttendanceChip label="Absent" value={session.attendanceSummary.absent} variant="destructive" />
          <AttendanceChip label="Unmarked" value={session.attendanceSummary.unmarked} variant="info" />
        </div>

        {session.eligibilitySummary.flaggedStudents.length > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Students needing attention
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {session.eligibilitySummary.flaggedStudents.map((student) => (
                <li key={student.studentId} className="flex items-center justify-between">
                  <span>{student.fullName}</span>
                  <span className="text-muted-foreground">{student.eligibility.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {session.roster.map((entry) => (
            <Badge key={entry.studentId} variant="outline" className="flex items-center gap-2">
              <span>{entry.fullName}</span>
              <AttendanceStatusDot status={entry.attendanceStatus} />
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/instructor/attendance?sessionId=${session.id}`}>Record attendance</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/instructor/sessions?focus=${session.id}`}>View session details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionCompactCard({ session }: { session: SerializableSession }) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{formatSessionTimeRange(session.start, session.end)}</p>
            <h3 className="text-lg font-semibold mt-1">{session.className}</h3>
            {session.programName && <p className="text-sm text-muted-foreground">{session.programName}</p>}
          </div>
          <Badge variant="secondary">Roster · {session.roster.length}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function AttendanceChip({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: 'success' | 'warn' | 'destructive' | 'info';
}) {
  const variantStyles: Record<typeof variant, string> = {
    success: 'instructor-badge-success-styles',
    warn: 'instructor-badge-warn-styles',
    destructive: 'instructor-badge-error-styles',
    info: 'instructor-badge-info-styles',
  };

  return (
    <div className={`rounded-md px-3 py-2 text-sm ${variantStyles[variant]}`}>
      <p className="font-medium">{label}</p>
      <p>{value}</p>
    </div>
  );
}

type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late' | 'unmarked';

function AttendanceStatusDot({ status }: { status: AttendanceStatus }) {
  const colors: Record<AttendanceStatus, string> = {
    present: 'bg-emerald-500',
    late: 'bg-amber-500',
    excused: 'bg-sky-500',
    absent: 'bg-red-500',
    unmarked: 'bg-zinc-400',
  };

  return <span className={`h-2.5 w-2.5 rounded-full ${colors[status]}`} aria-hidden="true" />;
}

function EmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="instructor-empty-state-styles">
      <Icon className="h-8 w-8 mb-3" />
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  );
}

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

function formatSessionTimeRange(start: string | null, end: string | null): string {
  if (!start) return 'Time TBD';
  const startDate = parseLocalDateTime(start);
  const endDate = end ? parseLocalDateTime(end) : null;

  const dayPart = formatDate(startDate, { formatString: 'EEE MMM d' });
  const startPart = formatDate(startDate, { formatString: 'h:mm a' });

  if (!endDate) {
    return `${dayPart} · ${startPart}`;
  }

  const sameDay = startDate.toDateString() === endDate.toDateString();
  const endPart = formatDate(endDate, { formatString: sameDay ? 'h:mm a' : 'EEE MMM d h:mm a' });

  return `${dayPart} · ${startPart} – ${endPart}`;
}
