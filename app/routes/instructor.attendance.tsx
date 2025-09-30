import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@vercel/remix';
import { Form, useFetcher, useLoaderData, useSearchParams, useSubmit } from '@remix-run/react';
import { addDays, addMinutes, format, isAfter, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { UserRole } from '~/types/auth';
import {
  getInstructorSessionsWithDetails,
  resolveInstructorPortalContext,
  serializeInstructorSessionSummary,
  type InstructorSessionPayload,
} from '~/services/instructor.server';
import { recordSessionAttendance } from '~/services/attendance.server';
import { getCSRFToken, validateCSRF } from '~/utils/csrf.server';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { AlertTriangle, CheckCircle2, Clock, RotateCcw, Users } from 'lucide-react';
import { cn } from '~/lib/utils';

const LATE_THRESHOLD_MINUTES = 15;

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'unmarked';

type SessionOption = {
  id: string;
  label: string;
};

interface LoaderData {
  role: UserRole;
  session: InstructorSessionPayload | null;
  sessionOptions: SessionOption[];
  csrfToken: string;
}

interface ActionResponse {
  success: boolean;
  session?: InstructorSessionPayload;
  error?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const context = await resolveInstructorPortalContext(request);
  const { role, viewInstructorId, supabaseAdmin, headers, searchParams } = context;
  const requestedSessionId = searchParams.get('sessionId');

  const today = new Date();
  let startDate = format(today, 'yyyy-MM-dd');
  let endDate = format(addDays(today, 1), 'yyyy-MM-dd');

  if (requestedSessionId) {
    const { data: sessionRecords, error } = await supabaseAdmin
      .from('class_sessions')
      .select('id, session_date, instructor_id, class:classes(instructor_id)')
      .eq('id', requestedSessionId)
      .limit(1);

    if (error) {
      throw json({ error: 'Failed to load session' }, { status: 500, headers });
    }

    const record = sessionRecords?.[0];
    if (!record) {
      throw json({ error: 'Session not found' }, { status: 404, headers });
    }

    const sessionInstructor = record.instructor_id ?? record.class?.instructor_id ?? null;
    if (role !== 'admin' && sessionInstructor && sessionInstructor !== context.userId) {
      throw json({ error: 'You do not have access to this session' }, { status: 403, headers });
    }

    startDate = record.session_date;
    endDate = record.session_date;
  }

  const summaries = await getInstructorSessionsWithDetails({
    instructorId: viewInstructorId,
    startDate,
    endDate,
    supabaseAdmin,
  });

  const serialized = summaries.map(serializeInstructorSessionSummary);
  const sessionOptions: SessionOption[] = serialized.map((session) => ({
    id: session.id,
    label: buildSessionOptionLabel(session),
  }));

  let session: InstructorSessionPayload | null = null;

  if (requestedSessionId) {
    session = serialized.find((item) => item.id === requestedSessionId) ?? null;
  } else if (serialized.length > 0) {
    session = findCurrentOrNextSession(serialized) ?? serialized[0];
  }

  const csrfToken = await getCSRFToken(request);

  return json<LoaderData>({
    role,
    session,
    sessionOptions,
    csrfToken,
  }, { headers });
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  const context = await resolveInstructorPortalContext(request);
  const { role, viewInstructorId, supabaseAdmin, headers, userId } = context;

  const formData = await request.formData();
  const sessionId = formData.get('sessionId');
  const payload = formData.get('payload');

  if (!sessionId || typeof sessionId !== 'string') {
    return json<ActionResponse>({ success: false, error: 'Missing sessionId' }, { status: 400, headers });
  }

  if (!payload || typeof payload !== 'string') {
    return json<ActionResponse>({ success: false, error: 'Missing payload' }, { status: 400, headers });
  }

  const { data: sessionRecords, error: fetchError } = await supabaseAdmin
    .from('class_sessions')
    .select('id, session_date, instructor_id, class:classes(instructor_id)')
    .eq('id', sessionId)
    .limit(1);

  if (fetchError) {
    return json<ActionResponse>({ success: false, error: 'Failed to load session' }, { status: 500, headers });
  }

  const record = sessionRecords?.[0];
  if (!record) {
    return json<ActionResponse>({ success: false, error: 'Session not found' }, { status: 404, headers });
  }

  const sessionInstructor = record.instructor_id ?? record.class?.instructor_id ?? null;
  if (role !== 'admin' && sessionInstructor && sessionInstructor !== userId) {
    return json<ActionResponse>({ success: false, error: 'You do not have access to this session' }, { status: 403, headers });
  }

  let parsed: Record<string, AttendanceStatus>;
  try {
    parsed = JSON.parse(payload) as Record<string, AttendanceStatus>;
  } catch {
    return json<ActionResponse>({ success: false, error: 'Invalid payload' }, { status: 400, headers });
  }

  const records = Object.entries(parsed)
    .filter(([, status]) => status !== 'unmarked')
    .map(([studentId, status]) => ({
      student_id: studentId,
      status: status as Exclude<AttendanceStatus, 'unmarked'>,
      notes: undefined,
    }));

  try {
    await recordSessionAttendance(sessionId, records, supabaseAdmin, userId);
  } catch (error) {
    console.error('Failed to record attendance', error);
    return json<ActionResponse>({ success: false, error: 'Failed to record attendance' }, { status: 500, headers });
  }

  const summaries = await getInstructorSessionsWithDetails({
    instructorId: viewInstructorId,
    startDate: record.session_date,
    endDate: record.session_date,
    supabaseAdmin,
  });

  const updated = summaries.find((summary) => summary.session.id === sessionId);
  if (!updated) {
    return json<ActionResponse>({ success: true }, { headers });
  }

  return json<ActionResponse>({ success: true, session: serializeInstructorSessionSummary(updated) }, { headers });
}

export default function InstructorAttendancePage() {
  const data = useLoaderData<LoaderData>();
  const fetcher = useFetcher<ActionResponse>();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();

  const session = data.session;
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>(() => buildStatusMap(session));
  const [autoLateFlags, setAutoLateFlags] = useState<Record<string, boolean>>({});
  const baselineRef = useRef(statusMap);

  useEffect(() => {
    if (session) {
      const initial = buildStatusMap(session);
      setStatusMap(initial);
      baselineRef.current = initial;
      setAutoLateFlags({});
    }
  }, [session]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success && fetcher.data.session) {
      const updated = buildStatusMap(fetcher.data.session);
      setStatusMap(updated);
      baselineRef.current = updated;
      setAutoLateFlags({});
    }
  }, [fetcher.state, fetcher.data]);

  const isSubmitting = fetcher.state !== 'idle';
  const isDirty = useMemo(() => hasDifferences(baselineRef.current, statusMap), [statusMap]);
  const counts = useMemo(() => buildCounts(statusMap), [statusMap]);

  if (!session) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">No upcoming sessions available to record right now.</p>
        </header>
        <EmptyState />
      </div>
    );
  }

  const lateThreshold = session.start ? addMinutes(parseISO(session.start), LATE_THRESHOLD_MINUTES) : null;

  const selectedSessionId = searchParams.get('sessionId') ?? session.id;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Record Attendance</h1>
          <p className="text-muted-foreground">Tap a student to set their status. Designed for tablet use.</p>
        </div>

        {data.sessionOptions.length > 0 && (
          <Form method="get" className="flex items-center gap-2">
            <label htmlFor="sessionId" className="text-sm font-medium text-muted-foreground">
              Session
            </label>
            <select
              id="sessionId"
              name="sessionId"
              defaultValue={selectedSessionId}
              onChange={(event) => {
                const form = event.currentTarget.form;
                if (form) {
                  submit(form);
                }
              }}
              className="border border-border bg-background text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {data.sessionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Form>
        )}
      </header>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl">{session.className}</CardTitle>
            <p className="text-muted-foreground">{formatSessionTimeRange(session.start, session.end)}</p>
            {session.programName && <p className="text-sm text-muted-foreground">{session.programName}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <SummaryPill icon={CheckCircle2} label="Present" value={counts.present} variant="success" />
            <SummaryPill icon={Clock} label="Late" value={counts.late} variant="warn" />
            <SummaryPill icon={AlertTriangle} label="Absent" value={counts.absent} variant="destructive" />
            <SummaryPill icon={Users} label="Unmarked" value={counts.unmarked} variant="info" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => handleMarkAll(session, 'present', { enforceLate: true, lateThreshold, statusMap, setStatusMap, setAutoLateFlags })}
            >
              Mark all present
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => handleReset(setStatusMap, setAutoLateFlags, baselineRef)}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reset changes
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {session.roster.map((entry) => (
              <StudentCard
                key={entry.studentId}
                entry={entry}
                status={statusMap[entry.studentId] ?? 'unmarked'}
                isAutoLate={autoLateFlags[entry.studentId] ?? false}
                lateThreshold={lateThreshold}
                onCycle={() => handleCycle(entry.studentId, lateThreshold, statusMap, setStatusMap, setAutoLateFlags)}
                onSet={(status, options) => handleSetStatus(entry.studentId, status, {
                  enforceLate: options?.enforceLate ?? false,
                  lateThreshold,
                  setStatusMap,
                  setAutoLateFlags,
                })}
              />
            ))}
          </div>

          <fetcher.Form method="post" className="flex flex-col gap-3">
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="payload" value={JSON.stringify(statusMap)} />
            <input type="hidden" name="_csrf" value={data.csrfToken} />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!isDirty || isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save attendance'}
              </Button>
              {!isDirty && !isSubmitting && <span className="text-sm text-muted-foreground">All changes saved.</span>}
              {isDirty && !isSubmitting && <span className="text-sm text-amber-600">Unsaved changes.</span>}
            </div>

            {fetcher.data?.error && (
              <p className="text-sm text-red-500">{fetcher.data.error}</p>
            )}
          </fetcher.Form>
        </CardContent>
      </Card>
    </div>
  );
}

function buildStatusMap(session?: InstructorSessionPayload | null): Record<string, AttendanceStatus> {
  if (!session) return {};
  const map: Record<string, AttendanceStatus> = {};
  for (const entry of session.roster) {
    map[entry.studentId] = entry.attendanceStatus;
  }
  return map;
}

function hasDifferences(a: Record<string, AttendanceStatus>, b: Record<string, AttendanceStatus>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? 'unmarked') !== (b[key] ?? 'unmarked')) {
      return true;
    }
  }
  return false;
}

function buildCounts(map: Record<string, AttendanceStatus>) {
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;
  let unmarked = 0;

  for (const status of Object.values(map)) {
    switch (status) {
      case 'present':
        present += 1;
        break;
      case 'late':
        late += 1;
        break;
      case 'absent':
        absent += 1;
        break;
      case 'excused':
        excused += 1;
        break;
      default:
        unmarked += 1;
    }
  }

  return { present, late, absent, excused, unmarked };
}

function handleMarkAll(
  session: InstructorSessionPayload,
  status: AttendanceStatus,
  {
    enforceLate,
    lateThreshold,
    statusMap,
    setStatusMap,
    setAutoLateFlags,
  }: {
    enforceLate: boolean;
    lateThreshold: Date | null;
    statusMap: Record<string, AttendanceStatus>;
    setStatusMap: React.Dispatch<React.SetStateAction<Record<string, AttendanceStatus>>>;
    setAutoLateFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  },
) {
  const updates: Record<string, AttendanceStatus> = { ...statusMap };
  const newAutoLate: Record<string, boolean> = {};

  for (const entry of session.roster) {
    const next = resolveStatus(status, {
      enforceLate,
      lateThreshold,
    });
    updates[entry.studentId] = next.status;
    newAutoLate[entry.studentId] = !!next.autoLate;
  }

  setStatusMap(updates);
  setAutoLateFlags(newAutoLate);
}

function handleReset(
  setStatusMap: React.Dispatch<React.SetStateAction<Record<string, AttendanceStatus>>>,
  setAutoLateFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  baselineRef: React.MutableRefObject<Record<string, AttendanceStatus>>,
) {
  setStatusMap(baselineRef.current);
  setAutoLateFlags({});
}

function handleCycle(
  studentId: string,
  lateThreshold: Date | null,
  statusMap: Record<string, AttendanceStatus>,
  setStatusMap: React.Dispatch<React.SetStateAction<Record<string, AttendanceStatus>>>,
  setAutoLateFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
  const order: AttendanceStatus[] = ['unmarked', 'present', 'late', 'absent', 'excused'];
  const current = statusMap[studentId] ?? 'unmarked';
  const index = order.indexOf(current);
  const nextStatus = order[(index + 1) % order.length];

  const resolved = resolveStatus(nextStatus, { enforceLate: true, lateThreshold });

  setStatusMap((prev) => ({ ...prev, [studentId]: resolved.status }));
  if (resolved.autoLate) {
    setAutoLateFlags((prev) => ({ ...prev, [studentId]: true }));
  } else if (resolved.clearedAutoLate) {
    setAutoLateFlags((prev) => ({ ...prev, [studentId]: false }));
  }
}

function handleSetStatus(
  studentId: string,
  status: AttendanceStatus,
  {
    enforceLate,
    lateThreshold,
    setStatusMap,
    setAutoLateFlags,
  }: {
    enforceLate: boolean;
    lateThreshold: Date | null;
    setStatusMap: React.Dispatch<React.SetStateAction<Record<string, AttendanceStatus>>>;
    setAutoLateFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  }
) {
  const resolved = resolveStatus(status, { enforceLate, lateThreshold });
  setStatusMap((prev) => ({ ...prev, [studentId]: resolved.status }));
  if (resolved.autoLate || resolved.clearedAutoLate) {
    setAutoLateFlags((prev) => ({ ...prev, [studentId]: resolved.autoLate ? true : false }));
  }
}

type ResolveStatusOptions = {
  enforceLate: boolean;
  lateThreshold: Date | null;
};

function resolveStatus(status: AttendanceStatus, { enforceLate, lateThreshold }: ResolveStatusOptions) {
  if (status === 'present' && enforceLate && lateThreshold && isAfter(new Date(), lateThreshold)) {
    return { status: 'late' as AttendanceStatus, autoLate: true };
  }

  if (status === 'present') {
    return { status: 'present' as AttendanceStatus, clearedAutoLate: true };
  }

  if (status === 'unmarked') {
    return { status: 'unmarked' as AttendanceStatus, clearedAutoLate: true };
  }

  return { status };
}

function StudentCard({
  entry,
  status,
  isAutoLate,
  lateThreshold,
  onCycle,
  onSet,
}: {
  entry: InstructorSessionPayload['roster'][number];
  status: AttendanceStatus;
  isAutoLate: boolean;
  lateThreshold: Date | null;
  onCycle: () => void;
  onSet: (status: AttendanceStatus, options?: { enforceLate?: boolean }) => void;
}) {
  const statusInfo = getStatusInfo(status);

  return (
    <div
      className={cn(
        'rounded-xl border p-4 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-primary',
        statusInfo.containerClass,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-foreground">{entry.fullName}</p>
          {entry.eligibility && !entry.eligibility.eligible && (
            <p className="text-sm text-amber-600">Eligibility: {entry.eligibility.reason}</p>
          )}
        </div>
        <Badge variant={statusInfo.badgeVariant}>{statusInfo.label}</Badge>
      </div>

      {isAutoLate && (
        <p className="mt-2 text-xs text-amber-600">
          Auto-marked late (after start). Override below if needed.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatusButton
          label="Present"
          active={status === 'present'}
          onClick={() => onSet('present', { enforceLate: !isAutoLate })}
        />
        <StatusButton
          label="Late"
          active={status === 'late'}
          variant="warn"
          onClick={() => onSet('late')}
        />
        <StatusButton
          label="Absent"
          active={status === 'absent'}
          variant="destructive"
          onClick={() => onSet('absent')}
        />
        <StatusButton
          label="Excused"
          active={status === 'excused'}
          variant="info"
          onClick={() => onSet('excused')}
        />
        <StatusButton
          label="Unmark"
          active={status === 'unmarked'}
          variant="ghost"
          onClick={() => onSet('unmarked')}
        />
      </div>

      <Button type="button" variant="ghost" size="sm" className="mt-3 text-xs" onClick={onCycle}>
        Cycle status
      </Button>

      {lateThreshold && (
        <p className="mt-2 text-xs text-muted-foreground">
          Late after {format(lateThreshold, 'h:mm a')} ({LATE_THRESHOLD_MINUTES}m)
        </p>
      )}
    </div>
  );
}

function StatusButton({
  label,
  active,
  onClick,
  variant = 'default',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  variant?: 'default' | 'warn' | 'destructive' | 'info' | 'ghost';
}) {
  const base = 'w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors';
  const variants: Record<typeof variant, string> = {
    default: active ? 'bg-emerald-500 text-white border-transparent' : 'border-border bg-background hover:bg-emerald-500/10',
    warn: active ? 'bg-amber-500 text-white border-transparent' : 'border-border bg-background hover:bg-amber-500/10',
    destructive: active ? 'bg-red-500 text-white border-transparent' : 'border-border bg-background hover:bg-red-500/10',
    info: active ? 'bg-sky-500 text-white border-transparent' : 'border-border bg-background hover:bg-sky-500/10',
    ghost: active ? 'bg-muted text-foreground border-muted' : 'border-border bg-background hover:bg-muted/50',
  };

  return (
    <button type="button" onClick={onClick} className={cn(base, variants[variant])}>
      {label}
    </button>
  );
}

function SummaryPill({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  variant: 'success' | 'warn' | 'destructive' | 'info';
}) {
  const variantStyles: Record<typeof variant, string> = {
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    destructive: 'bg-red-500/10 text-red-600 dark:text-red-300',
    info: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
  };

  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm', variantStyles[variant])}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center text-muted-foreground">
      <Users className="h-8 w-8" />
      <p className="text-lg font-semibold text-foreground">No sessions available</p>
      <p className="text-sm">Once a session is scheduled for today, it will appear here for quick attendance.</p>
    </div>
  );
}

function getStatusInfo(status: AttendanceStatus) {
  switch (status) {
    case 'present':
      return { label: 'Present', badgeVariant: 'outline' as const, containerClass: 'border-emerald-500/50 bg-emerald-500/5' };
    case 'late':
      return { label: 'Late', badgeVariant: 'secondary' as const, containerClass: 'border-amber-500/50 bg-amber-500/5' };
    case 'absent':
      return { label: 'Absent', badgeVariant: 'destructive' as const, containerClass: 'border-red-500/50 bg-red-500/5' };
    case 'excused':
      return { label: 'Excused', badgeVariant: 'secondary' as const, containerClass: 'border-sky-500/50 bg-sky-500/5' };
    default:
      return { label: 'Unmarked', badgeVariant: 'outline' as const, containerClass: 'border-border bg-background' };
  }
}

function buildSessionOptionLabel(session: InstructorSessionPayload): string {
  const timeRange = formatSessionTimeRange(session.start, session.end);
  return `${timeRange} · ${session.className}`;
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

function findCurrentOrNextSession(sessions: InstructorSessionPayload[]): InstructorSessionPayload | null {
  const now = new Date();
  const sorted = [...sessions].sort((a, b) => {
    if (!a.start || !b.start) return 0;
    return parseISO(a.start).getTime() - parseISO(b.start).getTime();
  });

  for (const session of sorted) {
    if (!session.start) continue;
    const startDate = parseISO(session.start);
    if (isAfter(startDate, now) || Math.abs(startDate.getTime() - now.getTime()) <= 60 * 60 * 1000) {
      return session;
    }
  }

  return sorted[0] ?? null;
}
