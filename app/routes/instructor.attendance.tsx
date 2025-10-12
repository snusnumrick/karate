import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@vercel/remix';
import { Form, Link, useFetcher, useLoaderData, useSearchParams, useSubmit } from '@remix-run/react';
import { addDays, addMinutes, format, isAfter, subDays } from 'date-fns';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { UserRole } from '~/types/auth';
import {
  getInstructorSessionsWithDetails,
  resolveInstructorPortalContext,
  serializeInstructorSessionSummary,
  type InstructorSessionPayload,
} from '~/services/instructor.server';
import { recordSessionAttendance } from '~/services/attendance.server';
import { updateClassSession } from '~/services/class.server';
import { validateCSRF } from '~/utils/csrf.server';
import { AuthenticityTokenInput } from 'remix-utils/csrf/react';
import { formatDate, getTodayLocalDateString, getCurrentDateTimeInTimezone } from '~/utils/misc';
import { parseLocalDate } from '~/components/calendar/utils';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Textarea } from '~/components/ui/textarea';
import { Label } from '~/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle2, Clock, RotateCcw, Users } from 'lucide-react';
import { cn } from '~/lib/utils';
import type { InstructorRouteHandle } from '~/routes/instructor';
import type { BreadcrumbItem } from '~/components/AppBreadcrumb';

const LATE_THRESHOLD_MINUTES = 15;

export const handle: InstructorRouteHandle = {
  breadcrumb: (data) => {
    const loaderData = data as LoaderData | undefined;
    const items: BreadcrumbItem[] = [{ label: 'Schedule', href: '/instructor/sessions' }];
    if (loaderData?.session?.className) {
      items.push({ label: loaderData.session.className, current: true });
    }
    return items;
  },
};

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'unmarked';

type SessionOption = {
  id: string;
  label: string;
};

interface LoaderData {
  role: UserRole;
  session: InstructorSessionPayload | null;
  sessionOptions: SessionOption[];
  viewMode: 'record' | 'roster';
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
  const modeParam = searchParams.get('mode') === 'roster' ? 'roster' : 'record';

  const today = getTodayLocalDateString();
  // Always show sessions from 7 days ago to tomorrow
  const startDate = format(subDays(parseLocalDate(today), 7), 'yyyy-MM-dd');
  const endDate = format(addDays(parseLocalDate(today), 1), 'yyyy-MM-dd');
  const filterByStatus = true;

  // Validate access to requested session if specified
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
  }

  const summaries = await getInstructorSessionsWithDetails({
    instructorId: viewInstructorId,
    startDate,
    endDate,
    supabaseAdmin,
  });

  let serialized = summaries.map(serializeInstructorSessionSummary);

  // Filter out completed and cancelled sessions
  if (filterByStatus) {
    serialized = serialized.filter((session) =>
      session.status !== 'completed' && session.status !== 'cancelled'
    );
  }

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

  return json<LoaderData>({
    role,
    session,
    sessionOptions,
    viewMode: modeParam,
  }, { headers });
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  const context = await resolveInstructorPortalContext(request);
  const { role, viewInstructorId, supabaseAdmin, headers, userId } = context;

  const formData = await request.formData();
  const intent = formData.get('intent');
  const sessionId = formData.get('sessionId');

  if (!sessionId || typeof sessionId !== 'string') {
    return json<ActionResponse>({ success: false, error: 'Missing sessionId' }, { status: 400, headers });
  }

  // Handle complete session intent
  if (intent === 'complete_session') {
    const { data: sessionRecords, error: fetchError } = await supabaseAdmin
      .from('class_sessions')
      .select('id, session_date, instructor_id, status, class:classes(instructor_id)')
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

    try {
      await updateClassSession(sessionId, { status: 'completed' }, supabaseAdmin);
    } catch (error) {
      console.error('Failed to complete session', error);
      return json<ActionResponse>({ success: false, error: 'Failed to complete session' }, { status: 500, headers });
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

  const payload = formData.get('payload');
  const notesPayload = formData.get('notesPayload');
  const baselineRaw = formData.get('baseline');

  if (!payload || typeof payload !== 'string') {
    return json<ActionResponse>({ success: false, error: 'Missing payload' }, { status: 400, headers });
  }

  let baseline: Record<string, AttendanceStatus> = {};
  if (baselineRaw && typeof baselineRaw === 'string') {
    try {
      baseline = JSON.parse(baselineRaw) as Record<string, AttendanceStatus>;
    } catch (error) {
      console.warn('Instructor attendance action: failed to parse baseline payload', error);
    }
  }

  let notes: Record<string, string> = {};
  if (notesPayload && typeof notesPayload === 'string') {
    try {
      notes = JSON.parse(notesPayload) as Record<string, string>;
    } catch (error) {
      console.warn('Instructor attendance action: failed to parse notes payload', error);
    }
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

  // Get baseline notes from the formData for comparison
  const baselineNotesRaw = formData.get('baselineNotes');
  let baselineNotes: Record<string, string> = {};
  if (baselineNotesRaw && typeof baselineNotesRaw === 'string') {
    try {
      baselineNotes = JSON.parse(baselineNotesRaw) as Record<string, string>;
    } catch (error) {
      console.warn('Instructor attendance action: failed to parse baseline notes', error);
    }
  }

  const records = Object.entries(parsed)
    .filter(([studentId, status]) => {
      // Skip unmarked students - they have no attendance to record
      if (status === 'unmarked') return false;

      const initialStatus = baseline[studentId] ?? 'unmarked';
      const initialNotes = baselineNotes[studentId] ?? '';
      const currentNotes = notes[studentId] ?? '';

      // Include if status changed from baseline
      const statusChanged = status !== initialStatus;
      // Include if notes changed from baseline (and student has a valid status)
      const notesChanged = currentNotes !== initialNotes;

      // Include if there's any change
      return statusChanged || notesChanged;
    })
    .map(([studentId, status]) => ({
      student_id: studentId,
      status: status as Exclude<AttendanceStatus, 'unmarked'>,
      notes: notes[studentId] || undefined,
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
  const viewMode = data.viewMode;
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>(() => buildStatusMap(session, viewMode));
  const [notesMap, setNotesMap] = useState<Record<string, string>>(() => buildNotesMap(session));
  const [autoLateFlags, setAutoLateFlags] = useState<Record<string, boolean>>({});
  const baselineRef = useRef(statusMap);
  const baselineNotesRef = useRef(notesMap);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);

  useEffect(() => {
    if (session) {
      const initial = buildStatusMap(session, viewMode);
      const initialNotes = buildNotesMap(session);
      setStatusMap(initial);
      setNotesMap(initialNotes);
      baselineRef.current = initial;
      baselineNotesRef.current = initialNotes;
      setAutoLateFlags({});
    }
  }, [session, viewMode]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success && fetcher.data.session) {
      const updated = buildStatusMap(fetcher.data.session, viewMode);
      const updatedNotes = buildNotesMap(fetcher.data.session);
      setStatusMap(updated);
      setNotesMap(updatedNotes);
      baselineRef.current = updated;
      baselineNotesRef.current = updatedNotes;
      setAutoLateFlags({});
    }
  }, [fetcher.state, fetcher.data, viewMode]);

  const isSubmitting = fetcher.state !== 'idle';
  const isDirty = useMemo(() =>
    hasDifferences(baselineRef.current, statusMap) || hasNotesDifferences(baselineNotesRef.current, notesMap, statusMap),
    [statusMap, notesMap]
  );
  const counts = useMemo(() => buildCounts(statusMap), [statusMap]);

  const headerTitle = viewMode === 'roster' ? 'Class Roster' : 'Record Attendance';
  const headerDescription = viewMode === 'roster'
    ? 'Instructor tools for reviewing eligibility and capturing attendance details.'
    : 'Tap a student name to check in; tap again to mark them absent. Border colors display the current status at a glance.';

  if (!session) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{headerTitle}</h1>
          <p className="text-muted-foreground">No upcoming sessions available to record right now.</p>
        </header>
        <EmptyState />
      </div>
    );
  }

  const lateThreshold = session.start ? addMinutes(parseLocalDateTime(session.start), LATE_THRESHOLD_MINUTES) : null;

  const selectedSessionId = searchParams.get('sessionId') ?? session.id;
  const buildModeLink = (mode: 'record' | 'roster') => {
    const params = new URLSearchParams();
    params.set('sessionId', selectedSessionId);
    if (mode === 'roster') {
      params.set('mode', 'roster');
    }
    return `/instructor/attendance${params.size > 0 ? `?${params.toString()}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="instructor-page-header-styles">{headerTitle}</h1>
          <p className="instructor-subheader-styles max-w-2xl">{headerDescription}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center justify-end gap-2">
            <Button variant={viewMode === 'record' ? 'default' : 'outline'} size="sm" asChild>
              <Link to={buildModeLink('record')}>Record</Link>
            </Button>
            <Button variant={viewMode === 'roster' ? 'default' : 'outline'} size="sm" asChild>
              <Link to={buildModeLink('roster')}>Roster</Link>
            </Button>
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
              {viewMode === 'roster' && <input type="hidden" name="mode" value="roster" />}
            </Form>
          )}
        </div>
      </header>

      <Card className={cn(
        session.status === 'completed' && 'bg-muted/30 opacity-75',
        session.status === 'cancelled' && 'bg-muted/50 opacity-60'
      )}>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-2xl">{session.className}</CardTitle>
              {session.status === 'completed' && (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Completed
                </Badge>
              )}
              {session.status === 'cancelled' && (
                <Badge variant="destructive">Cancelled</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{formatSessionTimeRange(session.start, session.end)}</p>
            {session.programName && <p className="text-sm text-muted-foreground">{session.programName}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <SummaryPill icon={CheckCircle2} label="Present" value={counts.present} variant="success" />
            <SummaryPill icon={Clock} label="Late" value={counts.late} variant="warn" />
            <SummaryPill icon={AlertTriangle} label="Absent" value={counts.absent} variant="destructive" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {viewMode === 'roster' ? (
            <>
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
                    notes={notesMap[entry.studentId] ?? ''}
                    isAutoLate={autoLateFlags[entry.studentId] ?? false}
                    lateThreshold={lateThreshold}
                    onCycle={() => handleCycle(entry.studentId, lateThreshold, statusMap, setStatusMap, setAutoLateFlags)}
                    onSet={(status, options) => handleSetStatus(entry.studentId, status, {
                      enforceLate: options?.enforceLate ?? false,
                      lateThreshold,
                      setStatusMap,
                      setAutoLateFlags,
                    })}
                    onNotesChange={(notes) => setNotesMap((prev) => ({ ...prev, [entry.studentId]: notes }))}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <CheckInLegend />
              <CheckInGrid
                session={session}
                statusMap={statusMap}
                autoLateFlags={autoLateFlags}
                onToggle={(studentId) => {
                  const current = statusMap[studentId] ?? 'unmarked';
                  if (current === 'present' || current === 'late') {
                    handleSetStatus(studentId, 'absent', {
                      enforceLate: false,
                      lateThreshold,
                      setStatusMap,
                      setAutoLateFlags,
                    });
                  } else {
                    handleSetStatus(studentId, 'present', {
                      enforceLate: true,
                      lateThreshold,
                      setStatusMap,
                      setAutoLateFlags,
                    });
                  }
                }}
              />
            </>
          )}

          <fetcher.Form method="post" className="flex flex-col gap-3">
            <AuthenticityTokenInput />
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="payload" value={JSON.stringify(statusMap)} />
            <input type="hidden" name="notesPayload" value={JSON.stringify(notesMap)} />
            <input type="hidden" name="baseline" value={JSON.stringify(baselineRef.current)} />
            <input type="hidden" name="baselineNotes" value={JSON.stringify(baselineNotesRef.current)} />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!isDirty || isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save attendance'}
              </Button>
              {viewMode === 'roster' && session.status === 'scheduled' && (
                <Button
                  type="button"
                  variant="default"
                  disabled={isDirty || isSubmitting}
                  onClick={() => setIsCompleteDialogOpen(true)}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Complete Session
                </Button>
              )}
              {!isDirty && !isSubmitting && <span className="text-sm text-muted-foreground">All changes saved.</span>}
              {isDirty && !isSubmitting && <span className="text-sm text-amber-600">Unsaved changes.</span>}
            </div>

            {fetcher.data?.error && (
              <p className="text-sm text-red-500">{fetcher.data.error}</p>
            )}
          </fetcher.Form>
        </CardContent>
      </Card>

      {/* Complete Session Confirmation Dialog */}
      <AlertDialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the session as completed. You can still edit attendance records after completion, but the session status will indicate it has finished.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <fetcher.Form method="post" onSubmit={() => setIsCompleteDialogOpen(false)}>
              <AuthenticityTokenInput />
              <input type="hidden" name="intent" value="complete_session" />
              <input type="hidden" name="sessionId" value={session.id} />
              <AlertDialogAction
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? 'Completing…' : 'Complete Session'}
              </AlertDialogAction>
            </fetcher.Form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function buildStatusMap(
  session: InstructorSessionPayload | null | undefined,
  viewMode: 'record' | 'roster',
): Record<string, AttendanceStatus> {
  if (!session) return {};
  const map: Record<string, AttendanceStatus> = {};
  for (const entry of session.roster) {
    const current = entry.attendanceStatus;
    if (viewMode === 'record' && current === 'unmarked') {
      map[entry.studentId] = 'absent';
    } else {
      map[entry.studentId] = current;
    }
  }
  return map;
}

function buildNotesMap(
  session: InstructorSessionPayload | null | undefined,
): Record<string, string> {
  if (!session) return {};
  const map: Record<string, string> = {};
  for (const entry of session.roster) {
    if (entry.attendanceNotes) {
      map[entry.studentId] = entry.attendanceNotes;
    }
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

function hasNotesDifferences(
  a: Record<string, string>,
  b: Record<string, string>,
  statusMap: Record<string, AttendanceStatus>
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    // Only count notes changes for students with a valid attendance status
    const status = statusMap[key] ?? 'unmarked';
    if (status === 'unmarked') continue;

    if ((a[key] ?? '') !== (b[key] ?? '')) {
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
  if (status === 'present' && enforceLate && lateThreshold && isAfter(getCurrentDateTimeInTimezone(), lateThreshold)) {
    return { status: 'late' as AttendanceStatus, autoLate: true };
  }

  if (status === 'present') {
    return { status: 'present' as AttendanceStatus, clearedAutoLate: true };
  }

  if (status === 'unmarked') {
    return { status: 'unmarked' as AttendanceStatus, clearedAutoLate: true };
  }

  if (status === 'absent' || status === 'excused') {
    return { status: status as AttendanceStatus, clearedAutoLate: true };
  }

  return { status };
}

function CheckInLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <LegendSwatch label="Present" className="attendance-present-border attendance-present-bg" />
      <LegendSwatch label="Late" className="attendance-late-border attendance-late-bg" />
      <LegendSwatch label="Absent" className="attendance-absent-border attendance-absent-bg" />
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-3 rounded-full attendance-eligibility-border attendance-eligibility-ring" />
        Eligibility review needed
      </span>
    </div>
  );
}

function LegendSwatch({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('h-3 w-3 rounded-full border-2', className)} />
      {label}
    </span>
  );
}

function CheckInGrid({
  session,
  statusMap,
  autoLateFlags,
  onToggle,
}: {
  session: InstructorSessionPayload;
  statusMap: Record<string, AttendanceStatus>;
  autoLateFlags: Record<string, boolean>;
  onToggle: (studentId: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {session.roster.map((entry) => {
        const status = statusMap[entry.studentId] ?? 'unmarked';
        const eligible = entry.eligibility?.eligible ?? true;
        const statusLabel = getStatusInfo(status).label;
        return (
          <button
            key={entry.studentId}
            type="button"
            onClick={() => onToggle(entry.studentId)}
            aria-pressed={status === 'present' || status === 'late'}
            className={cn(
              'relative flex h-28 flex-col items-center justify-center rounded-xl border-2 p-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900',
              getCheckInTileClass(status),
              !eligible && 'attendance-eligibility-ring',
            )}
          >
            <span className="text-base font-semibold text-foreground">{entry.fullName}</span>
            {!eligible && (
              <span className="mt-1 text-[0.625rem] font-semibold uppercase tracking-wide attendance-eligibility-text">
                Eligibility hold
              </span>
            )}
            <span className={cn('mt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide', getCheckInStatusTextColor(status))}>
              {statusLabel}
              {status === 'late' && autoLateFlags[entry.studentId] && (
                <span className="inline-flex items-center gap-1 text-[0.7rem] attendance-late-text">
                  <Clock className="h-3 w-3" /> auto
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function getCheckInTileClass(status: AttendanceStatus) {
  const classes: Record<AttendanceStatus, string> = {
    present: 'attendance-present-tile',
    late: 'attendance-late-tile',
    absent: 'attendance-absent-tile',
    excused: 'attendance-excused-tile',
    unmarked: 'border-border bg-background',
  };
  return classes[status];
}

function getCheckInStatusTextColor(status: AttendanceStatus) {
  switch (status) {
    case 'present':
      return 'attendance-present-text';
    case 'late':
      return 'attendance-late-text';
    case 'absent':
      return 'attendance-absent-text';
    case 'excused':
      return 'attendance-excused-text';
    default:
      return 'text-muted-foreground';
  }
}

function StudentCard({
  entry,
  status,
  notes,
  isAutoLate,
  lateThreshold,
  onCycle,
  onSet,
  onNotesChange,
}: {
  entry: InstructorSessionPayload['roster'][number];
  status: AttendanceStatus;
  notes: string;
  isAutoLate: boolean;
  lateThreshold: Date | null;
  onCycle: () => void;
  onSet: (status: AttendanceStatus, options?: { enforceLate?: boolean }) => void;
  onNotesChange: (notes: string) => void;
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
            <p className="text-sm attendance-eligibility-text">Eligibility: {entry.eligibility.reason}</p>
          )}
        </div>
        <Badge variant={statusInfo.badgeVariant}>{statusInfo.label}</Badge>
      </div>

      {isAutoLate && (
        <p className="mt-2 text-xs attendance-late-text">
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

      <div className="mt-4">
        <Label htmlFor={`notes-${entry.studentId}`} className="text-sm mb-2 block">
          Notes (Optional)
        </Label>
        <Textarea
          id={`notes-${entry.studentId}`}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          placeholder="e.g., Left early, arrived late, makeup class"
          className="input-custom-styles"
        />
      </div>

      <Button type="button" variant="ghost" size="sm" className="mt-3 text-xs" onClick={onCycle}>
        Cycle status
      </Button>

      {lateThreshold && (
        <p className="mt-2 text-xs text-muted-foreground">
          Late after {formatDate(lateThreshold, { formatString: 'h:mm a' })} ({LATE_THRESHOLD_MINUTES}m)
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
    default: active ? 'attendance-button-present-active' : 'border-border bg-background attendance-button-present-hover',
    warn: active ? 'attendance-button-late-active' : 'border-border bg-background attendance-button-late-hover',
    destructive: active ? 'attendance-button-absent-active' : 'border-border bg-background attendance-button-absent-hover',
    info: active ? 'attendance-button-excused-active' : 'border-border bg-background attendance-button-excused-hover',
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
    success: 'instructor-badge-success-styles',
    warn: 'instructor-badge-warn-styles',
    destructive: 'instructor-badge-error-styles',
    info: 'instructor-badge-info-styles',
  };

  return (
    <span className={cn('instructor-stat-pill-styles', variantStyles[variant])}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="instructor-empty-state-styles">
      <Users className="h-8 w-8" />
      <p className="text-lg font-semibold text-foreground">No sessions available</p>
      <p className="text-sm">Once a session is scheduled for today, it will appear here for quick attendance.</p>
    </div>
  );
}

function getStatusInfo(status: AttendanceStatus) {
  switch (status) {
    case 'present':
      return { label: 'Present', badgeVariant: 'outline' as const, containerClass: 'attendance-present-border attendance-present-bg' };
    case 'late':
      return { label: 'Late', badgeVariant: 'secondary' as const, containerClass: 'attendance-late-border attendance-late-bg' };
    case 'absent':
      return { label: 'Absent', badgeVariant: 'secondary' as const, containerClass: 'attendance-absent-border attendance-absent-bg' };
    case 'excused':
      return { label: 'Excused', badgeVariant: 'secondary' as const, containerClass: 'attendance-excused-border attendance-excused-bg' };
    default:
      return { label: 'Unmarked', badgeVariant: 'outline' as const, containerClass: 'border-border bg-background' };
  }
}

function buildSessionOptionLabel(session: InstructorSessionPayload): string {
  const timeRange = formatSessionTimeRange(session.start, session.end);
  return `${timeRange} · ${session.className}`;
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

function findCurrentOrNextSession(sessions: InstructorSessionPayload[]): InstructorSessionPayload | null {
  const now = getCurrentDateTimeInTimezone();
  const sorted = [...sessions].sort((a, b) => {
    if (!a.start || !b.start) return 0;
    return parseLocalDateTime(a.start).getTime() - parseLocalDateTime(b.start).getTime();
  });

  for (const session of sorted) {
    if (!session.start) continue;
    const startDate = parseLocalDateTime(session.start);
    if (isAfter(startDate, now) || Math.abs(startDate.getTime() - now.getTime()) <= 60 * 60 * 1000) {
      return session;
    }
  }

  return sorted[0] ?? null;
}
