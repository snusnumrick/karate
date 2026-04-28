import { json, type LoaderFunctionArgs, type SerializeFrom } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import type { ReactNode } from "react";
import { getOptionalUser } from "~/utils/auth.server";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { getProgramBySlug, getSeminarWithSeries } from "~/services/program.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Calendar, Clock, Users } from "lucide-react";
import { formatMoney, fromCents, toCents } from "~/utils/money";
import { formatDate } from "~/utils/misc";
import {
  getSeminarRegistrationSummary,
  getSeminarSeriesRegistrationAvailability,
} from "~/utils/seminar-registration";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const { supabaseServer, user, response: { headers } } = await getOptionalUser(request);

  // Try to get program by slug first
  const program = await getProgramBySlug(slug, supabaseServer);

  // If not found by slug, try by ID
  let seminarData;
  if (!program) {
    seminarData = await getSeminarWithSeries(slug, supabaseServer);
    if (!seminarData) {
      throw new Response("Seminar not found", { status: 404 });
    }
  } else {
    seminarData = await getSeminarWithSeries(program.id, supabaseServer);
  }

  if (!seminarData || seminarData.engagement_type !== 'seminar') {
    throw new Response("Seminar not found", { status: 404 });
  }

  const classIds = (seminarData?.classes ?? []).map((c) => c.id);
  const enrollmentCountByClassId: Record<string, number> = {};
  if (classIds.length > 0) {
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: counts } = await supabaseAdmin
      .from('enrollments')
      .select('class_id')
      .in('class_id', classIds)
      .in('status', ['active', 'trial', 'pending_payment']);
    for (const row of counts ?? []) {
      enrollmentCountByClassId[row.class_id] = (enrollmentCountByClassId[row.class_id] ?? 0) + 1;
    }
  }

  const seminar = seminarData
    ? serializeSeminarForClient(seminarData, enrollmentCountByClassId)
    : null;

  return json({ seminar, user }, { headers });
}

export default function SeminarDetail() {
  const { seminar: seminarJson, user } = useLoaderData<typeof loader>();
  const seminar = seminarJson ? deserializeSeminarForClient(seminarJson) : null;

  if (!seminar) {
    return (
      <div className="min-h-screen page-background-styles py-12 text-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="page-card-styles text-center">
            <h1 className="page-header-styles mb-4">Seminar not found</h1>
            <p className="page-subheader-styles">
              This seminar may have moved or is no longer available.
            </p>
            <div className="mt-8">
              <Button asChild>
                <Link to="/curriculum">Back to Curriculum</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value?: number | null) =>
    value != null ? formatMoney(fromCents(value), { showCurrency: true, trimTrailingZeros: true }) : null;

  const defaultSeminarPrice = formatCurrency(seminar.single_purchase_price_cents ?? seminar.registration_fee_cents);
  const activeSeriesCount = seminar.classes?.filter((series) => series.is_active).length ?? 0;
  const firstUpcomingSeries = seminar.classes?.find((series) => series.series_start_on && series.series_end_on);

  return (
    <div className="min-h-screen page-background-styles py-12 text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          to="/curriculum"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Curriculum
        </Link>

        <section className="page-card-styles mb-8">
          <div className="grid gap-8 lg:grid-cols-[1.45fr,0.95fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-green-600 dark:text-green-400">
                Seminar Pathway
              </p>
              <h1 className="page-header-styles mt-3 mb-4">{seminar.name}</h1>
              <p className="text-lg leading-relaxed text-gray-600 dark:text-gray-300">
                {seminar.description || "Explore the next seminar series, review the schedule, and choose the run that fits your family best."}
              </p>

              <div className="flex flex-wrap gap-3 mt-6">
                {seminar.ability_category && (
                  <Badge variant="outline" className="text-sm border-green-200 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-300">
                    {toTitleCase(seminar.ability_category)}
                  </Badge>
                )}
                {seminar.seminar_type && (
                  <Badge variant="secondary" className="text-sm">
                    {toTitleCase(seminar.seminar_type)}
                  </Badge>
                )}
                {seminar.audience_scope && (
                  <Badge className="text-sm bg-gray-900 text-white hover:bg-gray-900 dark:bg-white dark:text-gray-900">
                    {formatAudienceScope(seminar.audience_scope)}
                  </Badge>
                )}
                {seminar.min_capacity != null && (
                  <Badge variant="outline" className="text-sm">
                    Minimum {seminar.min_capacity} participants
                  </Badge>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-green-200/70 bg-gradient-to-br from-green-50 to-amber-50 p-6 shadow-sm dark:border-green-500/20 dark:from-green-950/30 dark:to-gray-900">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-700 dark:text-green-300">
                At a Glance
              </p>
              <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
                {defaultSeminarPrice || "Contact us"}
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Default seminar rate
              </p>

              <dl className="mt-6 space-y-4 text-sm">
                <div className="flex items-start justify-between gap-4 border-t border-green-200/80 pt-4 dark:border-green-500/20">
                  <dt className="text-gray-600 dark:text-gray-400">Available runs</dt>
                  <dd className="font-semibold text-gray-900 dark:text-white">{activeSeriesCount}</dd>
                </div>
                {firstUpcomingSeries?.series_start_on && firstUpcomingSeries?.series_end_on && (
                  <div className="flex items-start justify-between gap-4 border-t border-green-200/80 pt-4 dark:border-green-500/20">
                    <dt className="text-gray-600 dark:text-gray-400">Next window</dt>
                    <dd className="text-right font-semibold text-gray-900 dark:text-white">
                      {formatDateRange(firstUpcomingSeries.series_start_on, firstUpcomingSeries.series_end_on)}
                    </dd>
                  </div>
                )}
                <div className="flex items-start justify-between gap-4 border-t border-green-200/80 pt-4 dark:border-green-500/20">
                  <dt className="text-gray-600 dark:text-gray-400">Registration</dt>
                  <dd className="text-right font-semibold text-gray-900 dark:text-white">
                    {getSeminarRegistrationSummary(seminar.classes)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mt-8">
            {seminar.duration_minutes && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-800/70">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Session duration</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">{seminar.duration_minutes} min</p>
                  </div>
                </div>
              </div>
            )}

            {seminar.min_age !== undefined && seminar.max_age !== undefined && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-800/70">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Age range</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">{seminar.min_age}-{seminar.max_age} years</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-800/70">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Series cadence</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {seminar.classes && seminar.classes.length > 0 ? `${seminar.classes.length} scheduled run${seminar.classes.length === 1 ? '' : 's'}` : 'Check back soon'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {seminar.classes && seminar.classes.length > 0 ? (
          <section>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Available Series
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mx-auto">
                Choose the seminar run that matches your timing, schedule, and registration needs.
              </p>
            </div>

            <div className="grid gap-6">
              {seminar.classes.map((series) => {
                const registrationAvailability = getSeminarSeriesRegistrationAvailability(series);
                const registerHref = `/curriculum/seminars/${seminar.slug || seminar.id}/register?seriesId=${series.id}`;
                const waitlistHref = `${registerHref}&waitlist=true`;
                const loginRegisterHref = `/login?redirectTo=${encodeURIComponent(registerHref)}`;
                const loginWaitlistHref = `/login?redirectTo=${encodeURIComponent(waitlistHref)}`;

                return (
                  <div key={series.id} className="page-card-styles">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                      {series.topic && (
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-600 dark:text-green-400 mb-2">
                          Topic
                        </p>
                      )}
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {series.topic || series.name || 'Seminar Series'}
                      </h3>
                      {series.name && series.topic && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{series.name}</p>
                      )}
                      {series.description && (
                        <p className="text-base leading-relaxed text-gray-600 dark:text-gray-300 mt-4">
                          {series.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getSeriesStatusVariant(series)}>
                        {formatSeriesStatus(series.series_status)}
                      </Badge>
                      {series.max_capacity != null && series.enrollment_count >= series.max_capacity ? (
                        <Badge variant="destructive">Full</Badge>
                      ) : (
                        <Badge variant={getRegistrationStatusVariant(registrationAvailability.displayStatus)}>
                          {formatRegistrationStatus(registrationAvailability.displayStatus)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {(series.price_override_cents != null || seminar.single_purchase_price_cents != null || seminar.registration_fee_cents != null) && (
                    <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50/90 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Series price</span>
                        <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                          {formatCurrency(series.price_override_cents ?? seminar.single_purchase_price_cents ?? seminar.registration_fee_cents)}
                        </span>
                      </div>
                      {series.price_override_cents != null && defaultSeminarPrice && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Customized for this run. Default rate: {defaultSeminarPrice}.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mt-6">
                    {series.series_start_on && series.series_end_on && (
                      <SeriesMeta label="Dates" icon={<Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />}>
                        {formatDateRange(series.series_start_on, series.series_end_on)}
                      </SeriesMeta>
                    )}
                    {series.series_session_quota && (
                      <SeriesMeta label="Sessions" icon={<Users className="h-4 w-4 text-green-600 dark:text-green-400" />}>
                        {series.series_session_quota} sessions
                      </SeriesMeta>
                    )}
                    {(series.min_capacity != null || series.max_capacity != null) && (
                      <SeriesMeta label="Capacity" icon={<Users className="h-4 w-4 text-green-600 dark:text-green-400" />}>
                        {formatCapacity(series.min_capacity, series.max_capacity)}
                      </SeriesMeta>
                    )}
                    {(series.session_duration_minutes || series.sessions_per_week_override) && (
                      <SeriesMeta label="Format" icon={<Clock className="h-4 w-4 text-green-600 dark:text-green-400" />}>
                        {[
                          series.session_duration_minutes ? `${series.session_duration_minutes} min sessions` : null,
                          series.sessions_per_week_override ? `${series.sessions_per_week_override}x weekly` : null,
                        ].filter(Boolean).join(' · ')}
                      </SeriesMeta>
                    )}
                  </div>

                  {series.class_sessions && series.class_sessions.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-3">
                        Session Schedule
                      </h4>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {series.class_sessions.slice(0, 6).map((session, idx: number) => (
                          <div key={session.id} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                Session {session.sequence_number ?? idx + 1}
                              </span>
                              <span className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                {formatSeriesStatus(session.status)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                              {formatSingleDate(session.session_date)}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {formatTimeRange(session.start_time, session.end_time)}
                            </p>
                          </div>
                        ))}
                      </div>
                      {series.class_sessions.length > 6 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                          Plus {series.class_sessions.length - 6} more scheduled sessions.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {registrationAvailability.message}
                    </div>

                    {registrationAvailability.canJoinWaitlist ? (
                      user ? (
                        <Button asChild variant="outline">
                          <Link to={waitlistHref}>Join Waitlist</Link>
                        </Button>
                      ) : (
                        <Button asChild variant="outline">
                          <Link to={loginWaitlistHref}>Sign In to Join Waitlist</Link>
                        </Button>
                      )
                    ) : registrationAvailability.canRegister ? (
                      user ? (
                        <Button asChild>
                          <Link to={registerHref}>Register Now</Link>
                        </Button>
                      ) : (
                        <Button asChild>
                          <Link to={loginRegisterHref}>Sign In to Register</Link>
                        </Button>
                      )
                    ) : (
                      <div className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        Registration unavailable online
                      </div>
                    )}
                  </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="page-card-styles text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No series scheduled yet</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Check back later for upcoming seminar dates and registration windows.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SeriesMeta({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/70">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{children}</p>
    </div>
  );
}

function serializeSeminarForClient(
  seminar: NonNullable<Awaited<ReturnType<typeof getSeminarWithSeries>>>,
  enrollmentCountByClassId: Record<string, number> = {}
) {
  const {
    monthly_fee,
    registration_fee,
    yearly_fee,
    individual_session_fee,
    single_purchase_price,
    subscription_monthly_price,
    subscription_yearly_price,
    classes = [],
    description = null,
    ...rest
  } = seminar;

  return {
    ...rest,
    description,
    monthly_fee_cents: monthly_fee ? toCents(monthly_fee) : null,
    registration_fee_cents: registration_fee ? toCents(registration_fee) : null,
    yearly_fee_cents: yearly_fee ? toCents(yearly_fee) : null,
    individual_session_fee_cents: individual_session_fee ? toCents(individual_session_fee) : null,
    single_purchase_price_cents: single_purchase_price ? toCents(single_purchase_price) : null,
    subscription_monthly_price_cents: subscription_monthly_price ? toCents(subscription_monthly_price) : null,
    subscription_yearly_price_cents: subscription_yearly_price ? toCents(subscription_yearly_price) : null,
    classes: classes
      .filter((cls) => cls.is_active !== false)
      .map((cls) => ({
        ...cls,
        description: cls.description ?? null,
        enrollment_count: enrollmentCountByClassId[cls.id] ?? 0,
        class_sessions: (cls.class_sessions || []).map((session) => ({
          ...session,
          sequence_number: session.sequence_number ?? null,
        })),
      })),
  };
}

type SerializedSeminar = ReturnType<typeof serializeSeminarForClient>;
type SerializedSeries = SerializedSeminar['classes'][number];

type LoaderSeminar = NonNullable<SerializeFrom<typeof loader>['seminar']>;

function deserializeSeminarForClient(seminar: LoaderSeminar): SerializedSeminar {
  return {
    ...seminar,
    description: seminar.description ?? null,
    classes: (seminar.classes ?? []).map((cls) => ({
      ...cls,
      description: cls.description ?? null,
      class_sessions: (cls.class_sessions ?? []).map((session) => ({
        ...session,
        sequence_number: session.sequence_number ?? null,
      })),
    })),
  } as SerializedSeminar;
}

function formatSeriesStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'tentative': 'Tentative',
    'confirmed': 'Confirmed',
    'cancelled': 'Cancelled',
    'in_progress': 'In Progress',
    'completed': 'Completed',
  };
  return statusMap[status] || status;
}

function formatRegistrationStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'open': 'Registration Open',
    'closed': 'Registration Closed',
    'waitlisted': 'Waitlist Available',
    'unavailable': 'Online Registration Unavailable',
  };
  return statusMap[status] || status;
}

function getSeriesStatusVariant(series: SerializedSeries): 'default' | 'secondary' | 'destructive' | 'outline' {
  const status = series.series_status || 'tentative';
  if (status === 'cancelled') return 'destructive';
  if (status === 'completed') return 'secondary';
  if (status === 'confirmed' || status === 'in_progress') return 'default';
  return 'outline';
}

function getRegistrationStatusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'open') return 'default';
  if (status === 'waitlisted') return 'outline';
  return 'secondary';
}

function toTitleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatAudienceScope(scope: string) {
  if (scope === 'youth') return 'Youth';
  if (scope === 'adults') return 'Adults';
  if (scope === 'mixed') return 'Mixed Ages';
  return toTitleCase(scope);
}

function formatSingleDate(value: string) {
  return formatDate(value, { formatString: 'MMM d, yyyy' });
}

function formatDateRange(start: string, end: string) {
  return `${formatSingleDate(start)} - ${formatSingleDate(end)}`;
}

function formatTimeRange(start: string | null, end: string | null) {
  if (!start || !end) {
    return 'Time to be announced';
  }

  const normalize = (value: string) => (value.length === 5 ? `${value}:00` : value);

  return `${new Date(`2000-01-01T${normalize(start)}`).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })} - ${new Date(`2000-01-01T${normalize(end)}`).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function formatCapacity(minCapacity?: number | null, maxCapacity?: number | null) {
  if (minCapacity != null && maxCapacity != null) {
    return `${minCapacity}-${maxCapacity} participants`;
  }

  if (minCapacity != null) {
    return `Minimum ${minCapacity} participants`;
  }

  if (maxCapacity != null) {
    return `Up to ${maxCapacity} participants`;
  }

  return 'Flexible';
}
