import { json, type LoaderFunctionArgs } from '@vercel/remix';
import { Form, Link, useLoaderData, useSearchParams, useSubmit } from '@remix-run/react';
import { addDays, format } from 'date-fns';
import { formatDate } from '~/utils/misc';
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
import { CalendarDays, Users, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '~/lib/utils';
import type { InstructorRouteHandle } from '~/routes/instructor';

interface SessionsLoaderData {
  role: UserRole;
  viewInstructorId: string | null;
  instructorOptions: InstructorOption[];
  sessions: InstructorSessionPayload[];
  focus: string | null;
  rangeLabel: string;
}

export const handle: InstructorRouteHandle = {
  breadcrumb: () => [{ label: 'Schedule', href: '/instructor/sessions' }],
};

export async function loader({ request }: LoaderFunctionArgs) {
  const context = await resolveInstructorPortalContext(request);
  const { role, viewInstructorId, supabaseAdmin, instructorOptions, headers, searchParams } = context;

  const today = new Date();
  const startDate = format(today, 'yyyy-MM-dd');
  const endDate = format(addDays(today, 14), 'yyyy-MM-dd');

  const sessions = await getInstructorSessionsWithDetails({
    instructorId: viewInstructorId,
    startDate,
    endDate,
    supabaseAdmin,
  });

  const serialized = sessions.map(serializeInstructorSessionSummary);
  const focus = searchParams.get('focus');

  return json<SessionsLoaderData>({
    role,
    viewInstructorId,
    instructorOptions,
    sessions: serialized,
    focus,
    rangeLabel: `${formatDate(today, { formatString: 'MMM d' })} – ${formatDate(addDays(today, 14), { formatString: 'MMM d' })}`,
  }, { headers });
}

export default function InstructorSessionsPage() {
  const data = useLoaderData<SessionsLoaderData>();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const isAdmin = data.role === 'admin';

  const groupedSessions = useMemo(() => {
    const groups = new Map<string, InstructorSessionPayload[]>();
    for (const session of data.sessions) {
      const existing = groups.get(session.sessionDate) ?? [];
      existing.push(session);
      groups.set(session.sessionDate, existing);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sessions]) => ({
        date,
        label: formatDate(date, { formatString: 'EEEE, MMMM d' }),
        sessions: sessions.sort((left, right) => {
          if (!left.start || !right.start) return 0;
          return parseLocalDateTime(left.start).getTime() - parseLocalDateTime(right.start).getTime();
        }),
      }));
  }, [data.sessions]);

  const selectedInstructorId = useMemo(() => {
    if (!isAdmin) return data.viewInstructorId ?? '';
    return searchParams.get('instructorId') ?? (data.viewInstructorId ?? 'all');
  }, [isAdmin, searchParams, data.viewInstructorId]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="instructor-page-header-styles">Upcoming Sessions</h1>
          <p className="instructor-subheader-styles">Classes scheduled over the next two weeks · {data.rangeLabel}</p>
        </div>

        {isAdmin && data.instructorOptions.length > 0 && (
          <Form method="get" className="flex items-center gap-2">
            <label htmlFor="instructorId" className="text-sm font-medium text-muted-foreground">
              Instructor
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

      {groupedSessions.length === 0 ? (
        <EmptyState
          title="No sessions scheduled"
          description="There are no upcoming classes in this window."
          icon={CalendarDays}
        />
      ) : (
        <div className="space-y-6">
          {groupedSessions.map((group) => (
            <section key={group.date} className="space-y-4">
              <h2 className="instructor-section-header-styles">{group.label}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {group.sessions.map((session) => (
                  <SessionSummaryCard
                    key={session.id}
                    session={session}
                    highlighted={data.focus === session.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionSummaryCard({
  session,
  highlighted,
}: {
  session: InstructorSessionPayload;
  highlighted: boolean;
}) {
  const isCompleted = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';

  return (
    <Card className={cn(
      highlighted && 'border-primary shadow-lg shadow-primary/10',
      isCompleted && 'bg-muted/30 opacity-75',
      isCancelled && 'bg-muted/50 opacity-60'
    )}>
      <CardHeader className="flex flex-col gap-1">
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{session.className}</span>
          <div className="flex items-center gap-2">
            {session.status === 'completed' && (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">Completed</Badge>
            )}
            {session.status === 'cancelled' && (
              <Badge variant="destructive">Cancelled</Badge>
            )}
            <Badge variant="secondary">Roster · {session.roster.length}</Badge>
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{formatSessionTimeRange(session.start, session.end)}</p>
        {session.programName && <p className="text-sm text-muted-foreground">{session.programName}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <MetricPill icon={Users} label="Present" value={session.attendanceSummary.present} />
          <MetricPill icon={Clock} label="Late" value={session.attendanceSummary.late} />
          <MetricPill icon={AlertTriangle} label="Flags" value={session.eligibilitySummary.flagged} variant="warn" />
          <MetricPill icon={CalendarDays} label="Unmarked" value={session.attendanceSummary.unmarked} variant="info" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/instructor/attendance?sessionId=${session.id}`}>Record attendance</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/instructor/attendance?sessionId=${session.id}&mode=roster`}>Open roster</Link>
          </Button>
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
  value: number;
  variant?: 'default' | 'warn' | 'info';
}) {
  const variantClass = variant === 'warn'
    ? 'instructor-badge-warn-styles'
    : variant === 'info'
      ? 'instructor-badge-info-styles'
      : 'bg-primary/10 text-primary';

  return (
    <span className={`instructor-stat-pill-styles ${variantClass}`}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
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
