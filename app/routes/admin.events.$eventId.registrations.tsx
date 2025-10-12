import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { AppBreadcrumb } from "~/components/AppBreadcrumb";
import { Users, DollarSign, FileText, ArrowLeft } from "lucide-react";
import type { Database } from "~/types/database.types";
import {fromCents, formatMoney} from "~/utils/money";
import { getCurrentDateTimeInTimezone } from "~/utils/misc";

type Event = Database['public']['Tables']['events']['Row'];
type EventRegistration = Database['public']['Tables']['event_registrations']['Row'] & {
  students: {
    id: string;
    first_name: string;
    last_name: string;
    birth_date: string | null;
  };
  families: {
    id: string;
    name: string;
  };
};

type LoaderData = {
  event: Event;
  registrations: EventRegistration[];
  totalRegistrations: number;
  confirmedRegistrations: number;
  totalRevenueCents: number;
};

export async function loader({ params}: LoaderFunctionArgs) {
  const { eventId } = params;
  
  if (!eventId) {
    throw new Response("Event ID is required", { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  // Get event details
  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    throw new Response("Event not found", { status: 404 });
  }

  // Get registrations with student and family details
  const { data: registrations, error: registrationsError } = await supabaseAdmin
    .from('event_registrations')
    .select(`
      *,
      students (
        id,
        first_name,
        last_name,
        birth_date
      ),
      families (
        id,
        name
      )
    `)
    .eq('event_id', eventId)
    .order('registered_at', { ascending: false });

  if (registrationsError) {
    console.error('Error fetching registrations:', registrationsError);
    throw new Response("Failed to load registrations", { status: 500 });
  }

  const totalRegistrations = registrations?.length || 0;
  const confirmedRegistrations = registrations?.filter(reg => reg.registration_status === 'confirmed').length || 0;
  const totalRevenueCents = registrations?.reduce((sum: number, reg) => {
    if (reg.registration_status === 'confirmed') {
      return sum + (reg.payment_amount_cents ?? 0);
    }
    return sum;
  }, 0) ?? 0;

  return json({
    event,
    registrations: registrations || [],
    totalRegistrations,
    confirmedRegistrations,
    totalRevenueCents,
  });
}

function getStatusBadgeVariant(status: string | null) {
  switch (status) {
    case 'confirmed':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}



function formatDate(dateString: string | null) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function calculateAge(birthDate: string | null) {
  if (!birthDate) return 'N/A';
  const today = getCurrentDateTimeInTimezone();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

export default function EventRegistrationsPage() {
  const { event, registrations, totalRegistrations, confirmedRegistrations, totalRevenueCents } = useLoaderData<LoaderData>();

  const breadcrumbItems = [
    { label: 'Admin', href: '/admin' },
    { label: 'Events', href: '/admin/events' },
    { label: event.title, href: `/admin/events/${event.id}/edit` },
    { label: 'Registrations' },
  ];

  return (
    <div className="container mx-auto py-6">
      <AppBreadcrumb items={breadcrumbItems} />
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Registrations</h1>
          <p className="text-muted-foreground mt-2">
            Manage registrations for {event.title}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/admin/events/${event.id}/edit`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Event
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRegistrations}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Registrations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{confirmedRegistrations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalRegistrations - confirmedRegistrations} pending/cancelled
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue (Confirmed)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(fromCents(totalRevenueCents))}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From confirmed payments only
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Registrations List */}
      <Card>
        <CardHeader>
          <CardTitle>Registrations</CardTitle>
          <CardDescription>
            All registrations for this event
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registrations.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No registrations</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No one has registered for this event yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {registrations.map((registration) => (
                <div
                  key={registration.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-semibold">
                          {registration.students.first_name} {registration.students.last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Age: {calculateAge(registration.students.birth_date)} • 
                          Family: {registration.families.name}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Registered: {formatDate(registration.registered_at)}</span>
                      {registration.payment_amount_cents != null && (
                        <span>Amount: {formatMoney(fromCents(registration.payment_amount_cents))}</span>
                      )}
                      {registration.emergency_contact && (
                        <span>Emergency: {registration.emergency_contact}</span>
                      )}
                    </div>
                    
                    {registration.notes && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">
                          <FileText className="inline h-3 w-3 mr-1" />
                          {registration.notes}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(registration.registration_status)}>
                      {registration.registration_status || 'pending'}
                    </Badge>
                    
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/admin/families/${registration.family_id}`}>
                        View Family
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
