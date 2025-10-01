import { json, type LoaderFunctionArgs } from '@vercel/remix';
import { Form, Link, useLoaderData, useSearchParams, useSubmit } from '@remix-run/react';
import { addDays, format, parseISO } from 'date-fns';
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
    rangeLabel: `${format(today, 'MMM d')} – ${format(addDays(today, 14), 'MMM d')}`,
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
        label: format(parseISO(date), 'EEEE, MMMM d'),
        sessions: sessions.sort((left, right) => {
          if (!left.start || !right.start) return 0;
          return parseISO(left.start).getTime() - parseISO(right.start).getTime();
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
          <h1 className="text-3xl font-bold tracking-tight">Upcoming Sessions</h1>
          <p className="text-muted-foreground">Classes scheduled over the next two weeks · {data.rangeLabel}</p>
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
              <h2 className="text-xl font-semibold">{group.label}</h2>
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
  return (
    <Card className={highlighted ? 'border-primary shadow-lg shadow-primary/10' : undefined}>
      <CardHeader className="flex flex-col gap-1">
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{session.className}</span>
          <Badge variant="secondary">Roster · {session.roster.length}</Badge>
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
  const base = 'inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-foreground';
  const variantClass = variant === 'warn'
    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
    : variant === 'info'
      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-300'
      : 'bg-primary/10 text-primary';

  return (
    <span className={`${base} ${variantClass}`}>
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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-10 text-center text-muted-foreground">
      <Icon className="h-8 w-8 mb-3" />
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  );
}

function formatSessionTimeRange(start: string | null, end: string | null): string {
  if (!start) return 'Time TBD';
  const startDate = parseISO(start);
  const endDate = end ? parseISO(end) : null;

  const dayPart = format(startDate, 'EEE MMM d');
  const startPart = format(startDate, 'h:mm a');

  if (!endDate) {
    return `${dayPart} · ${startPart}`;
  }

  const sameDay = startDate.toDateString() === endDate.toDateString();
  const endPart = format(endDate, sameDay ? 'h:mm a' : 'EEE MMM d h:mm a');

  return `${dayPart} · ${startPart} – ${endPart}`;
}
