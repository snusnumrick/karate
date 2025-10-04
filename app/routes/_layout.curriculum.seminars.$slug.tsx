import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { getProgramBySlug, getSeminarWithSeries } from "~/services/program.server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Calendar, Clock, Users } from "lucide-react";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { slug } = params;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();

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

  return json({ seminar: seminarData, user });
}

export default function SeminarDetail() {
  const { seminar, user } = useLoaderData<typeof loader>();

  if (!seminar) {
    return <div>Seminar not found</div>;
  }

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
              {seminar.delivery_format && (
                <Badge variant="secondary" className="text-sm">
                  {seminar.delivery_format.replace(/_/g, ' ')}
                </Badge>
              )}
              {seminar.audience_scope && (
                <Badge className="text-sm">
                  {seminar.audience_scope}
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

        {seminar.single_purchase_price_cents && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 text-primary flex items-center justify-center text-2xl">$</div>
                <div>
                  <p className="text-sm text-muted-foreground">Price</p>
                  <p className="text-xl font-semibold">
                    ${(seminar.single_purchase_price_cents / 100).toFixed(2)}
                  </p>
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
            {seminar.classes.map((series: {
              id: string;
              name: string;
              series_label?: string | null;
              description?: string | null;
              is_active: boolean;
              series_start_on?: string | null;
              series_end_on?: string | null;
              series_session_quota?: number;
              min_capacity?: number;
              max_capacity?: number;
              allow_self_enrollment: boolean;
              class_sessions?: Array<{
                id: string;
                session_date: string;
                start_time: string;
                end_time: string;
                sequence_number?: number | null;
              }>;
            }) => (
              <Card key={series.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>
                        {series.series_label || series.name || 'Seminar Series'}
                      </CardTitle>
                      {series.description && (
                        <CardDescription className="mt-2">
                          {series.description}
                        </CardDescription>
                      )}
                    </div>
                    {series.is_active ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
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
                    {series.min_capacity !== null && series.max_capacity !== null && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Capacity: {series.min_capacity}-{series.max_capacity} participants
                        </span>
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
                            <span className="font-medium w-6">{idx + 1}.</span>
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
                      <Button asChild className="flex-1">
                        {user ? (
                          <Link to={`/curriculum/seminars/${seminar.slug || seminar.id}/register?seriesId=${series.id}`}>
                            Register Now
                          </Link>
                        ) : (
                          <Link to={`/login?redirectTo=/curriculum/seminars/${seminar.slug || seminar.id}/register?seriesId=${series.id}`}>
                            Sign In to Register
                          </Link>
                        )}
                      </Button>
                    </div>
                  )}
                  {series.is_active && !series.allow_self_enrollment && (
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
