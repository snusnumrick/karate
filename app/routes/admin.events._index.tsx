import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from "@remix-run/node";
import { Link, useLoaderData, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { getSupabaseServerClient, getSupabaseAdminClient, isUserAdmin } from "~/utils/supabase.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "~/components/ui/alert-dialog";
import { Calendar, Plus, Users, DollarSign, MapPin, Clock, Filter, Trash2, ExternalLink } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { format, parseISO } from "date-fns";
import type { Database } from "~/types/database.types";
import { getEventTypeOptions } from "~/utils/event-helpers.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import {moneyFromRow} from "~/utils/database-money";
import { addMoney, multiplyMoney, ZERO_MONEY, type Money, type MoneyJSON, formatMoney, serializeMoney, deserializeMoney } from "~/utils/money";
import { formatTime } from "~/utils/misc";


type Event = {
  id: string;
  title: string;
  description: string | null;
  event_type_id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  max_participants: number | null;
  registration_fee: number;
  registration_deadline: string | null;
  instructor_id: string | null;
  created_at: string;
  instructor?: {
    first_name: string;
    last_name: string;
  } | null;
  _count?: {
    registrations: number;
  };
};

type LoaderData = {
  events: Event[];
  stats: {
    totalEvents: number;
    upcomingEvents: number;
    totalRegistrations: number;
    totalRevenue: MoneyJSON;
  };
  filters: {
    status?: string;
    type?: string;
    search?: string;
  };
  eventTypeOptions: { value: string; label: string; }[];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return redirect("/login?redirectTo=/admin/events", { headers });
  }

  if (!isUserAdmin(user.id)) {
    return redirect("/", { headers });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const typeFilter = url.searchParams.get('type');
  const searchFilter = url.searchParams.get('search');

  const supabaseAdmin = getSupabaseAdminClient();

  try {
    // Build query with filters
    let eventsQuery = supabaseAdmin
      .from('events')
      .select(`
        id,
        title,
        description,
        event_type_id,
        status,
        start_date,
        end_date,
        start_time,
        end_time,
        location,
        max_participants,
        registration_fee,
        registration_fee_cents,
        registration_deadline,
        instructor_id,
        created_at,
        instructor:profiles!events_instructor_id_fkey (
          first_name,
          last_name
        )
      `)
      .order('start_date', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      eventsQuery = eventsQuery.eq('status', statusFilter as Database["public"]["Enums"]["event_status_enum"]);
    }

    if (typeFilter && typeFilter !== 'all') {
      eventsQuery = eventsQuery.eq('event_type_id', typeFilter);
    }

    if (searchFilter) {
      eventsQuery = eventsQuery.ilike('title', `%${searchFilter}%`);
    }

    const { data: eventsData, error: eventsError } = await eventsQuery;
    if (eventsError) throw eventsError;

    // Get registration counts for each event
    const eventIds = eventsData?.map(e => e.id) || [];
    const { data: registrationCounts } = await supabaseServer
      .from('event_registrations')
      .select('event_id')
      .in('event_id', eventIds)
      .eq('registration_status', 'confirmed');

    // Count registrations per event
    const registrationCountMap = new Map();
    registrationCounts?.forEach(reg => {
      const count = registrationCountMap.get(reg.event_id) || 0;
      registrationCountMap.set(reg.event_id, count + 1);
    });

    // Add registration counts to events
    const events = eventsData?.map(event => ({
      ...event,
      _count: {
        registrations: registrationCountMap.get(event.id) || 0
      }
    })) || [];

    // Calculate stats
    const totalEvents = events.length;
    const upcomingEvents = events.filter(e => 
      new Date(e.start_date) >= new Date() && 
      e.status !== 'cancelled'
    ).length;
    const totalRegistrations = Array.from(registrationCountMap.values()).reduce((sum, count) => sum + count, 0);
    const totalRevenue: Money = events.reduce((sum, event) =>
      addMoney(sum,
          multiplyMoney(
              moneyFromRow('events','registration_fee', event as unknown as Record<string, unknown>),
              (registrationCountMap.get(event.id) || 0)
          )), ZERO_MONEY);

    // Get event type options
    const eventTypeOptions = await getEventTypeOptions(request);

    return json({
      events,
      stats: {
        totalEvents,
        upcomingEvents,
        totalRegistrations,
        totalRevenue: serializeMoney(totalRevenue)
      },
      filters: {
        status: statusFilter,
        type: typeFilter,
        search: searchFilter
      },
      eventTypeOptions
    }, { headers });

  } catch (error) {
    console.error("Error loading events:", error);
    throw new Response("Failed to load events", { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return redirect("/login", { headers });
  }

  await csrf.validate(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const eventId = formData.get("eventId") as string;
    
    try {
      // Use service role client to bypass RLS for admin operations
      const supabaseAdmin = getSupabaseAdminClient();

      const { error } = await supabaseAdmin
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      return json({ success: true }, { headers });
    } catch (error) {
      console.error("Error deleting event:", error);
      return json({ error: "Failed to delete event" }, { status: 500, headers });
    }
  }

  return json({ error: "Invalid action" }, { status: 400, headers });
}

export default function AdminEventsIndex() {
  const { events, stats, filters, eventTypeOptions } = useLoaderData<LoaderData>();
  const navigation = useNavigation();
  const [searchTerm, setSearchTerm] = useState(filters.search || "");
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  const copyPublicUrl = async (eventId: string) => {
    const url = new URL(window.location.href);
    const publicUrl = `${url.protocol}//${url.host}/events/${eventId}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

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

  const getEventTypeBadge = (type: string) => {
    const option = eventTypeOptions.find(opt => opt.value === type);
    return <Badge className="bg-blue-100 text-blue-800">{option?.label || type}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'MMM d, yyyy');
  };

  // formatTime is now imported from ~/utils/misc

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AppBreadcrumb items={breadcrumbPatterns.adminEvents()} />
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Events Management</h1>
          <p className="text-muted-foreground">Manage competitions, seminars, and special events</p>
        </div>
        <Button asChild>
          <Link to="/admin/events/new">
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Total Events</h3>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{stats.totalEvents}</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Upcoming Events</h3>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{stats.upcomingEvents}</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Total Registrations</h3>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{stats.totalRegistrations}</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Total Revenue</h3>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{formatMoney(deserializeMoney(stats.totalRevenue), { showCurrency: true })}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </h2>
        <Form method="get" className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium mb-1">Search</label>
            <Input
              id="search"
              name="search"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-custom-styles"
              tabIndex={1}
            />
          </div>
          
          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-1">Status</label>
            <Select name="status" defaultValue={filters.status || "all"}>
              <SelectTrigger className="w-48 input-custom-styles" tabIndex={2}>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="registration_open">Registration Open</SelectItem>
                <SelectItem value="registration_closed">Registration Closed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label htmlFor="type" className="block text-sm font-medium mb-1">Type</label>
            <Select name="type" defaultValue={filters.type || "all"}>
              <SelectTrigger className="w-48 input-custom-styles" tabIndex={3}>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {eventTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button type="submit" disabled={navigation.state === "submitting"} tabIndex={4}>
            Apply Filters
          </Button>
        </Form>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No events found</h3>
              <p className="text-muted-foreground mb-4">
                {filters.search || filters.status || filters.type 
                  ? "Try adjusting your filters or search terms."
                  : "Get started by creating your first event."
                }
              </p>
              <Button asChild>
                <Link to="/admin/events/new">Create Event</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          events.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">
                        <Link 
                          to={`/admin/events/${event.id}/edit`}
                          className="hover:underline"
                        >
                          {event.title}
                        </Link>
                      </CardTitle>
                      {getStatusBadge(event.status)}
                      {getEventTypeBadge(event.event_type_id)}
                    </div>
                    {event.description && (
                      <p className="text-muted-foreground">{event.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyPublicUrl(event.id)}
                      title="Copy public URL"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/admin/events/${event.id}/edit`}>Edit</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/admin/events/${event.id}/registrations`}>
                        Registrations ({event._count?.registrations || 0})
                      </Link>
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        setDeleteEventId(event.id);
                        setEventToDelete(event);
                      }}
                      disabled={navigation.state === "submitting"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {formatDate(event.start_date)}
                      {event.end_date && event.end_date !== event.start_date && 
                        ` - ${formatDate(event.end_date)}`
                      }
                    </span>
                  </div>
                  
                  {event.start_time && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {formatTime(event.start_time)}
                        {event.end_time && ` - ${formatTime(event.end_time)}`}
                      </span>
                    </div>
                  )}
                  
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{event.location}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {event._count?.registrations || 0}
                      {event.max_participants && ` / ${event.max_participants}`} registered
                    </span>
                  </div>
                </div>
                
                {event.registration_fee > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span>Registration Fee: ${event.registration_fee}</span>
                  </div>
                )}
                
                {event.instructor && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Instructor: {event.instructor.first_name} {event.instructor.last_name}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEventId} onOpenChange={(open) => !open && setDeleteEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event
              <span className="font-semibold"> {eventToDelete?.title}</span> and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={navigation.state === "submitting"}>Cancel</AlertDialogCancel>
            {deleteEventId && (
             <Form method="post" onSubmit={() => setDeleteEventId(null)}>
               <AuthenticityTokenInput />
               <input type="hidden" name="intent" value="delete" />
               <input type="hidden" name="eventId" value={deleteEventId} />
                 <AlertDialogAction
                   type="submit"
                   disabled={navigation.state === "submitting"}
                   className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                 >
                   {navigation.state === "submitting" ? 'Deleting...' : 'Delete Event'}
                 </AlertDialogAction>
               </Form>
             )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
