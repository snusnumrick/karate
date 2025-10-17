import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { Calendar, MapPin, Users, DollarSign, FileText, Clock, ExternalLink, Edit, ListChecks } from "lucide-react";
import { formatDate } from "~/utils/misc";
import { format, parseISO } from "date-fns";
import type { Database } from "~/types/database.types";
import { getEventTypeOptions } from "~/utils/event-helpers.server";

type Event = Database['public']['Tables']['events']['Row'];

type Instructor = {
  id: string;
  first_name: string;
  last_name: string;
};

type Waiver = {
  id: string;
  title: string;
  description: string | null;
};

type LoaderData = {
  event: Event & { instructor?: Instructor };
  waivers: Waiver[];
  registrationCount: number;
  eventTypeLabel: string;
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { eventId } = params;

  if (!eventId) {
    throw new Response("Event ID is required", { status: 400 });
  }

  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return redirect("/login?redirectTo=/admin/events", { headers });
  }

  // Check if user is admin
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return redirect("/", { headers });
  }

  try {
    // Fetch the event with instructor info
    const { data: event, error: eventError } = await supabaseServer
      .from('events')
      .select(`
        *,
        instructor:profiles!events_instructor_id_fkey (
          id,
          first_name,
          last_name
        )
      `)
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      console.error('Error fetching event by ID:', eventError);
      throw new Response("Event not found", { status: 404 });
    }

    // Fetch waivers for this event
    const { data: eventWaivers } = await supabaseServer
      .from('event_waivers')
      .select(`
        waiver_id,
        waivers (
          id,
          title,
          description
        )
      `)
      .eq('event_id', eventId);

    const waivers = eventWaivers?.map(ew => ew.waivers).filter(Boolean) as Waiver[] || [];

    // Get registration count
    const { count: registrationCount } = await supabaseServer
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('registration_status', 'confirmed');

    // Get event type label
    const eventTypeOptions = await getEventTypeOptions(request);
    const eventTypeLabel = eventTypeOptions.find(opt => opt.value === event.event_type_id)?.label || event.event_type_id;

    return json({
      event,
      waivers,
      registrationCount: registrationCount || 0,
      eventTypeLabel
    }, { headers });
  } catch (error) {
    console.error('Error in loader:', error);
    throw new Response("Internal Server Error", { status: 500 });
  }
}

export default function EventDetail() {
  const { event, waivers, registrationCount, eventTypeLabel } = useLoaderData<LoaderData>();

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: "secondary" as const, label: "Draft" },
      published: { variant: "default" as const, label: "Published" },
      registration_open: { variant: "default" as const, label: "Registration Open" },
      registration_closed: { variant: "outline" as const, label: "Registration Closed" },
      in_progress: { variant: "default" as const, label: "In Progress" },
      completed: { variant: "secondary" as const, label: "Completed" },
      cancelled: { variant: "destructive" as const, label: "Cancelled" }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatEventDate = (dateString: string) => {
    return formatDate(dateString, { formatString: 'EEEE, MMMM d, yyyy' });
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '';
    return format(parseISO(`2000-01-01T${timeString}`), 'h:mm a');
  };

  const capacityPercentage = event.max_participants
    ? Math.round((registrationCount / event.max_participants) * 100)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AppBreadcrumb items={breadcrumbPatterns.adminEventDetail(event.id, event.title)} />

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            {getStatusBadge(event.status)}
            <Badge className="bg-blue-100 text-blue-800">{eventTypeLabel}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/admin/events/${event.id}/registrations`}>
              <ListChecks className="w-4 h-4 mr-2" />
              Registrations ({registrationCount})
            </Link>
          </Button>
          <Button asChild>
            <Link to={`/admin/events/${event.id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Event
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {event.description && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Date & Time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Date & Time
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Start Date</div>
                <div className="text-lg">{formatEventDate(event.start_date)}</div>
              </div>
              {event.end_date && event.end_date !== event.start_date && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">End Date</div>
                  <div className="text-lg">{formatEventDate(event.end_date)}</div>
                </div>
              )}
              {event.start_time && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Time</div>
                  <div className="flex items-center gap-2 text-lg">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {formatTime(event.start_time)}
                    {event.end_time && ` - ${formatTime(event.end_time)}`}
                  </div>
                </div>
              )}
              {event.registration_deadline && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Registration Deadline</div>
                  <div className="text-lg">{formatEventDate(event.registration_deadline)}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location */}
          {(event.location || event.address) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {event.location && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Venue</div>
                    <div className="text-lg">{event.location}</div>
                  </div>
                )}
                {event.address && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Address</div>
                    <div className="whitespace-pre-wrap">{event.address}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Waivers */}
          {waivers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Required Waivers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {waivers.map((waiver) => (
                    <div key={waiver.id} className="p-3 border rounded-md bg-muted">
                      <div className="font-medium">{waiver.title}</div>
                      {waiver.description && (
                        <p className="text-sm text-muted-foreground mt-1">{waiver.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Registration Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Registration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Registered</div>
                <div className="text-3xl font-bold">{registrationCount}</div>
                {event.max_participants && (
                  <>
                    <div className="text-sm text-muted-foreground">of {event.max_participants} max</div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          capacityPercentage >= 90 ? 'bg-destructive' :
                          capacityPercentage >= 70 ? 'bg-yellow-500' :
                          'bg-primary'
                        }`}
                        style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
              {event.registration_fee && event.registration_fee > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Registration Fee</div>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    <DollarSign className="w-5 h-5" />
                    {event.registration_fee.toFixed(2)}
                  </div>
                </div>
              )}
              <Button className="w-full" asChild>
                <Link to={`/admin/events/${event.id}/registrations`}>
                  View All Registrations
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Event Details */}
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {event.instructor && (
                <div>
                  <div className="font-medium text-muted-foreground">Instructor</div>
                  <div>{event.instructor.first_name} {event.instructor.last_name}</div>
                </div>
              )}
              <div>
                <div className="font-medium text-muted-foreground">Visibility</div>
                <div className="capitalize">{event.visibility}</div>
              </div>
              {event.external_url && (
                <div>
                  <div className="font-medium text-muted-foreground">External Link</div>
                  <a
                    href={event.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View Link
                  </a>
                </div>
              )}
              <div>
                <div className="font-medium text-muted-foreground">Created</div>
                <div>{formatDate(event.created_at, { formatString: 'PPP' })}</div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Last Updated</div>
                <div>{formatDate(event.updated_at, { formatString: 'PPP' })}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
