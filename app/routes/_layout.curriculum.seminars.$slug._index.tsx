import { json, type LoaderFunctionArgs, type SerializeFrom } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { getProgramBySlug, getSeminarWithSeries } from "~/services/program.server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Calendar, Clock, Users } from "lucide-react";
import { formatMoney, fromCents, toCents } from "~/utils/money";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { slug } = params;
  console.log('[Seminar Detail] Loading seminar with slug:', slug);

  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();

  // Try to get program by slug first
  const program = await getProgramBySlug(slug, supabaseServer);
  console.log('[Seminar Detail] Program by slug:', program ? program.id : 'not found');

  // If not found by slug, try by ID
  let seminarData;
  if (!program) {
    seminarData = await getSeminarWithSeries(slug, supabaseServer);
    console.log('[Seminar Detail] Seminar by ID:', seminarData ? seminarData.id : 'not found');
    if (!seminarData) {
      throw new Response("Seminar not found", { status: 404 });
    }
  } else {
    seminarData = await getSeminarWithSeries(program.id, supabaseServer);
    console.log('[Seminar Detail] Seminar from program:', seminarData ? seminarData.id : 'not found');
  }

  const seminar = seminarData
    ? serializeSeminarForClient(seminarData)
    : null;

  return json({ seminar, user });
}

export default function SeminarDetail() {
  const { seminar: seminarJson, user } = useLoaderData<typeof loader>();
  const seminar = seminarJson ? deserializeSeminarForClient(seminarJson) : null;

  if (!seminar) {
    return <div>Seminar not found</div>;
  }

  const formatCurrency = (value?: number | null) =>
    value != null ? formatMoney(fromCents(value), { showCurrency: true }) : null;

  const defaultSeminarPrice = formatCurrency(seminar.single_purchase_price_cents);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        to="/curriculum"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        ← Back to Curriculum
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">{seminar.name}</h1>
            <div className="flex gap-2 flex-wrap">
              {seminar.ability_category && (
                <Badge variant="outline" className="text-sm">
                  {seminar.ability_category}
                </Badge>
              )}
              {seminar.seminar_type && (
                <Badge variant="secondary" className="text-sm">
                  {seminar.seminar_type.charAt(0).toUpperCase() + seminar.seminar_type.slice(1)}
                </Badge>
              )}
              {seminar.audience_scope && (
                <Badge className="text-sm">
                  {seminar.audience_scope}
                </Badge>
              )}
              {seminar.min_capacity != null && (
                <Badge variant="outline" className="text-sm">
                  Min {seminar.min_capacity} participants
                </Badge>
              )}
            </div>
          </div>
        </div>
        {seminar.description && (
          <p className="text-lg text-muted-foreground">{seminar.description}</p>
        )}
      </div>

      {/* Seminar Details */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {seminar.duration_minutes && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="text-xl font-semibold">{seminar.duration_minutes} min</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {seminar.min_age !== undefined && seminar.max_age !== undefined && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Age Range</p>
                  <p className="text-xl font-semibold">{seminar.min_age}-{seminar.max_age} years</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {defaultSeminarPrice && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 text-primary flex items-center justify-center text-2xl">$</div>
                <div>
                  <p className="text-sm text-muted-foreground">Default Price</p>
                  <p className="text-xl font-semibold">{defaultSeminarPrice}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Series */}
      {seminar.classes && seminar.classes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Available Series</h2>
          <div className="grid gap-4">
            {seminar.classes.map((series) => (
              <Card key={series.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      {series.topic && (
                        <p className="text-sm text-muted-foreground mb-1">Topic</p>
                      )}
                      <CardTitle>
                        {series.topic || series.series_label || series.name || 'Seminar Series'}
                      </CardTitle>
                      {series.series_label && series.topic && (
                        <p className="text-sm text-muted-foreground mt-1">{series.series_label}</p>
                      )}
                      {series.description && (
                        <CardDescription className="mt-2">
                          {series.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getSeriesStatusVariant(series)}>
                        {formatSeriesStatus(series.series_status)}
                      </Badge>
                      <Badge variant={getRegistrationStatusVariant(series)}>
                        {formatRegistrationStatus(series.registration_status)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Series Pricing */}
                  {(series.price_override_cents != null || seminar.single_purchase_price_cents != null) && (
                    <div className="mb-4 p-3 bg-primary/5 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Price:</span>
                        <span className="text-lg font-semibold">
                          {formatCurrency(series.price_override_cents ?? seminar.single_purchase_price_cents)}
                        </span>
                      </div>
                      {series.price_override_cents != null && series.price_override_cents !== seminar.single_purchase_price_cents && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Series-specific pricing (default: {formatCurrency(seminar.single_purchase_price_cents)})
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {series.series_start_on && series.series_end_on && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {new Date(series.series_start_on).toLocaleDateString()} -{' '}
                          {new Date(series.series_end_on).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {series.series_session_quota && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{series.series_session_quota} sessions</span>
                      </div>
                    )}
                    {series.min_capacity != null && series.max_capacity != null && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Capacity: {series.min_capacity}-{series.max_capacity} participants
                        </span>
                      </div>
                    )}
                    {series.min_capacity != null && series.max_capacity == null && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Minimum {series.min_capacity} participants</span>
                      </div>
                    )}
                    {series.session_duration_minutes && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{series.session_duration_minutes} minute sessions</span>
                      </div>
                    )}
                    {series.sessions_per_week_override && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{series.sessions_per_week_override} sessions per week</span>
                      </div>
                    )}
                    {series.allow_self_enrollment && (
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-300">
                        <Users className="h-4 w-4" />
                        <span>Self-registration enabled</span>
                      </div>
                    )}
                    {series.on_demand && (
                      <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-300">
                        <Clock className="h-4 w-4" />
                        <span>On-demand access available</span>
                      </div>
                    )}
                  </div>

                  {/* Sessions */}
                  {series.class_sessions && series.class_sessions.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold mb-2">Sessions Schedule:</h4>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {series.class_sessions.slice(0, 10).map((session, idx: number) => (
                          <div key={session.id} className="text-sm flex items-center gap-2 text-muted-foreground">
                            <span className="font-medium w-6">{(session.sequence_number ?? idx + 1)}.</span>
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(session.session_date).toLocaleDateString()}</span>
                            <Clock className="h-3 w-3 ml-2" />
                            <span>
                              {session.start_time} - {session.end_time}
                            </span>
                          </div>
                        ))}
                        {series.class_sessions.length > 10 && (
                          <p className="text-sm text-muted-foreground italic">
                            ...and {series.class_sessions.length - 10} more sessions
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {series.is_active && series.allow_self_enrollment && (
                    <div className="flex gap-2">
                      {user ? (
                        <Button asChild>
                          <Link to={`/curriculum/seminars/${seminar.slug || seminar.id}/register?seriesId=${series.id}`}>
                            Register Now
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild>
                          <Link to={`/login?redirectTo=${encodeURIComponent(`/curriculum/seminars/${seminar.slug || seminar.id}/register?seriesId=${series.id}`)}`}>
                            Sign In to Register
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                  {(!series.allow_self_enrollment || !series.is_active) && (
                    <div className="bg-muted p-3 rounded-md text-sm">
                      <p className="text-muted-foreground">
                        Contact us to register for this seminar series
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {(!seminar.classes || seminar.classes.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No series scheduled at this time. Check back later for upcoming sessions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function serializeSeminarForClient(seminar: NonNullable<Awaited<ReturnType<typeof getSeminarWithSeries>>>) {
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
    classes: classes.map((cls) => ({
      ...cls,
      description: cls.description ?? null,
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

function getRegistrationStatusVariant(series: SerializedSeries): 'default' | 'secondary' | 'outline' {
  const status = series.registration_status || 'closed';
  if (status === 'open') return 'default';
  if (status === 'waitlisted') return 'outline';
  return 'secondary';
}
