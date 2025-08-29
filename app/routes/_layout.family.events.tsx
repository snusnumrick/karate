import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, Form } from "@remix-run/react";
import { getSupabaseServerClient, getSupabaseAdminClient } from "~/utils/supabase.server";
import { requireUserId } from "~/utils/auth.server";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Calendar, Clock, MapPin, DollarSign, Users, AlertCircle, CreditCard } from "lucide-react";
import { formatDate } from "~/utils/misc";
import type { Database } from "~/types/database.types";


type EventWithStudents = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  registration_fee: number | null;
  status: string;
  event_type: {
    id: string;
    name: string;
    color_class: string;
    border_class: string | null;
    dark_mode_class: string | null;
  } | null;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    registration_status: 'confirmed' | 'pending' | 'waitlist' | 'cancelled' | 'not_registered';
    payment_required: boolean;
    payment_status: 'pending' | 'succeeded' | 'failed' | null;
    registration_id: string | null;
    payment_id: string | null;
  }[];
};

type LoaderData = {
  events: EventWithStudents[];
  familyName: string | null;
  pendingPaymentTotal: number;
};

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const { supabaseServer } = getSupabaseServerClient(request);
  
  const formData = await request.formData();
  const paymentCount = parseInt(formData.get("paymentCount") as string || "1");
  
  // Collect all payment IDs
  const paymentIds: string[] = [];
  for (let i = 0; i < paymentCount; i++) {
    const fieldName = i === 0 ? "paymentId" : `paymentId${i}`;
    const paymentId = formData.get(fieldName) as string;
    if (paymentId) {
      paymentIds.push(paymentId);
    }
  }
  
  if (paymentIds.length === 0) {
    return json({ error: "At least one payment ID is required" }, { status: 400 });
  }
  
  // Get user's family ID
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', userId)
    .single();

  if (!profile?.family_id) {
    return json({ error: "Family not found" }, { status: 404 });
  }
  
  // Verify all payments belong to the user's family
  const { data: payments, error } = await supabaseServer
    .from('payments')
    .select('id, family_id, total_amount')
    .in('id', paymentIds)
    .eq('family_id', profile.family_id);
    
  if (error || !payments || payments.length !== paymentIds.length) {
    return json({ error: "One or more payments not found" }, { status: 404 });
  }
  
  // If only one payment, redirect to single payment page
  if (paymentIds.length === 1) {
    return redirect(`/pay/${paymentIds[0]}`);
  }
  
  // For multiple payments, create a combined payment record
  const totalAmount = payments.reduce((sum, payment) => sum + payment.total_amount, 0);
  
  // Create a combined payment record using admin client to bypass RLS
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: combinedPayment, error: createError } = await supabaseAdmin
    .from('payments')
    .insert({
      family_id: profile.family_id,
      total_amount: totalAmount,
      subtotal_amount: totalAmount, // Assuming no additional taxes for combined payments
      status: 'pending' as Database['public']['Enums']['payment_status'],
      type: 'event_registration' as Database['public']['Enums']['payment_type_enum'],
      payment_date: new Date().toISOString(),
      notes: `Combined payment for ${paymentIds.length} event registrations: ${paymentIds.join(', ')}`
    })
    .select('id')
    .single();
    
  if (createError || !combinedPayment) {
    console.error('Error creating combined payment:', createError);
    return json({ error: "Failed to create combined payment" }, { status: 500 });
  }
  
  // Update original payments to reference the combined payment
  const { error: updateError } = await supabaseServer
    .from('payments')
    .update({ 
      status: 'failed',
      notes: `Combined into payment ${combinedPayment.id}`,
      order_id: combinedPayment.id
    })
    .in('id', paymentIds);

  if (updateError) {
    console.error('Error updating original payments:', updateError);
    return json({ error: "Failed to update original payments" }, { status: 500 });
  }
  
  // Update event registrations to link to the new combined payment
  const { error: registrationUpdateError } = await supabaseAdmin
    .from('event_registrations')
    .update({ payment_id: combinedPayment.id })
    .in('payment_id', paymentIds);
    
  if (registrationUpdateError) {
    console.error('Error updating event registrations with combined payment ID:', registrationUpdateError);
    return json({ error: "Failed to update event registrations" }, { status: 500 });
  }
  
  // Redirect to the combined payment page
  return redirect(`/pay/${combinedPayment.id}`);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const { supabaseServer } = getSupabaseServerClient(request);

  // Get user's family ID
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', userId)
    .single();

  if (!profile?.family_id) {
    throw new Response("Family not found", { status: 404 });
  }

  // Get family name
  const { data: family } = await supabaseServer
    .from('families')
    .select('name')
    .eq('id', profile.family_id)
    .single();

  // Get all family students
  const { data: students } = await supabaseServer
    .from('students')
    .select('id, first_name, last_name')
    .eq('family_id', profile.family_id);

  // Get events that have registrations from this family
  const { data: eventsWithRegistrations } = await supabaseServer
    .from('events')
    .select(`
      id,
      title,
      description,
      start_date,
      end_date,
      start_time,
      end_time,
      location,
      registration_fee,
      status,
      event_type:event_types (
        id,
        name,
        color_class,
        border_class,
        dark_mode_class
      ),
      event_registrations!inner (
        id,
        student_id,
        registration_status,
        payment_required,
        payment_amount,
        payment_id,
        payment:payments (
          id,
          status,
          total_amount
        )
      )
    `)
    .eq('event_registrations.family_id', profile.family_id)
    .order('start_date', { ascending: true });

  if (!eventsWithRegistrations || !students) {
    throw new Response("Failed to load data", { status: 500 });
  }

  // Group events with student registration status
  const events: EventWithStudents[] = eventsWithRegistrations.map((event) => {
    const eventStudents = students.map((student) => {
      const registration = event.event_registrations.find((reg) => reg.student_id === student.id);
      
      return {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        registration_status: (registration?.registration_status || 'not_registered') as EventWithStudents['students'][number]['registration_status'],
        payment_required: registration?.payment_required || false,
        payment_status: registration?.payment?.status || null,
        registration_id: registration?.id || null,
        payment_id: registration?.payment_id || null
      };
    });

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date,
      start_time: event.start_time,
      end_time: event.end_time,
      location: event.location,
      registration_fee: event.registration_fee,
      status: event.status,
      event_type: event.event_type,
      students: eventStudents
    };
  });

  // Calculate pending payment total from actual payment records
  const pendingPaymentIds: string[] = [];
  events.forEach(event => {
    event.students.forEach(student => {
      if (student.payment_required && student.payment_status === 'pending' && student.payment_id) {
        pendingPaymentIds.push(student.payment_id);
      }
    });
  });
  
  let pendingPaymentTotal = 0;
  if (pendingPaymentIds.length > 0) {
    const { data: pendingPayments } = await supabaseServer
      .from('payments')
      .select('total_amount')
      .in('id', pendingPaymentIds)
      .eq('status', 'pending');
    
    pendingPaymentTotal = pendingPayments?.reduce((sum, payment) => sum + payment.total_amount, 0) || 0;
  }

  return json({
    events,
    familyName: family?.name || null,
    pendingPaymentTotal
  });
}

export default function FamilyEventsPage() {
  const { events, familyName, pendingPaymentTotal } = useLoaderData<LoaderData>();

  // Get events with pending payments
  const eventsWithPendingPayments = events.filter(event => 
    event.students.some(student => 
      student.payment_required && student.payment_status === 'pending'
    )
  );

  const getStatusBadge = (student: EventWithStudents['students'][0]) => {
    if (student.payment_required && student.payment_status === 'pending') {
      return <Badge variant="destructive">Payment Required</Badge>;
    }
    if (student.payment_status === 'succeeded') {
      return <Badge variant="default">Paid</Badge>;
    }
    if (student.payment_status === 'failed') {
      return <Badge variant="destructive">Payment Failed</Badge>;
    }
    return <Badge variant="secondary">{student.registration_status}</Badge>;
  };

  const EventCard = ({ event }: { event: EventWithStudents }) => {
    // Define helper functions inline to avoid import issues
    const formatEventTypeName = (eventType: string): string => {
      const formatMap: Record<string, string> = {
        competition: "Competition",
        seminar: "Seminar",
        testing: "Testing",
        tournament: "Tournament",
        workshop: "Workshop",
        social_event: "Social Event",
        fundraiser: "Fundraiser",
        other: "Other",
        "belt exam": "Belt Exam"
      };
      return formatMap[eventType] || eventType;
    };
    
    // Use dynamic color from event_types table instead of hardcoded colors
    const eventTypeColor = event.event_type?.color_class 
      ? event.event_type.color_class
      : 'bg-gray-100 text-gray-800';
    
    // Use border_class directly from database with thick left border and dark mode support
    const getBorderClass = (borderClass: string | null | undefined, darkModeClass: string | null | undefined): string => {
      if (!borderClass) return 'border-l-[6px] border-gray-500 dark:border-gray-400';
      
      // Extract the border color from light mode class (e.g., 'border-red-200' -> 'red-200')
      const lightColorMatch = borderClass.match(/border-(.+)/);
      let lightBorderClass = 'border-gray-500';
      
      if (lightColorMatch) {
        lightBorderClass = `border-${lightColorMatch[1]}`;
      }
      
      // Extract dark mode border color if available
      let darkBorderClass = 'dark:border-gray-400';
      if (darkModeClass) {
        // Look for border color in dark mode class (e.g., 'bg-red-900 text-red-200' -> use red-700 for border)
        const darkColorMatch = darkModeClass.match(/(?:bg|text|border)-(\w+)-/);
        if (darkColorMatch) {
          const colorName = darkColorMatch[1];
          darkBorderClass = `dark:border-${colorName}-700`;
        }
      }
      
      return `border-l-[6px] ${lightBorderClass} ${darkBorderClass}`;
    };
    
    // Get registered students
    const registeredStudents = event.students.filter(student => 
      student.registration_status !== 'not_registered'
    );
    
    // Get all students with pending payments for payment button
    const studentsWithPendingPayments = registeredStudents.filter(student => 
      student.payment_required && student.payment_status === 'pending'
    );
    
    // Get first student with pending payment for backward compatibility
    const firstPendingPayment = studentsWithPendingPayments[0];
    
    return (
      <Card className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200 dark:border-gray-700 ${getBorderClass(event.event_type?.border_class, event.event_type?.dark_mode_class)}`}>
        {/* Header Section */}
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <div className="flex items-start gap-3 mb-3">
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                  {event.title}
                </CardTitle>
                {firstPendingPayment && (
                  <Badge variant="destructive">Payment Required</Badge>
                )}
              </div>
              {event.event_type && (
                <Badge className={`${eventTypeColor} text-xs font-medium px-2 py-1 rounded`}>
                  {formatEventTypeName(event.event_type.name)}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3 pt-0">
          {/* Date and Time */}
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-gray-500" />
            <div>
              <div className="text-sm text-gray-900 dark:text-white">
                {formatDate(event.start_date, { formatString: 'EEEE, MMMM d, yyyy' })}
              </div>
              {event.end_date && event.end_date !== event.start_date && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  to {formatDate(event.end_date, { formatString: 'MMMM d, yyyy' })}
                </div>
              )}
            </div>
          </div>

          {event.start_time && (
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-900 dark:text-white">
                {event.start_time}
                {event.end_time && ` - ${event.end_time}`}
              </span>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-900 dark:text-white">{event.location}</span>
            </div>
          )}

          {/* Registration Fee */}
           {event.registration_fee && event.registration_fee > 0 && (
             <div className="flex items-center gap-3">
               <DollarSign className="h-4 w-4 text-gray-500" />
               <span className="text-sm text-gray-900 dark:text-white">
                 Registration Fee: ${event.registration_fee}
               </span>
             </div>
           )}

          {/* Family Students */}
           <div className="space-y-3">
             <div className="flex items-center gap-3">
               <Users className="h-4 w-4 text-gray-500" />
               <span className="text-sm font-medium text-gray-900 dark:text-white">
                 Family Students
               </span>
             </div>
             <div className="ml-7 space-y-2">
               {event.students.map((student) => {
                 const getStudentButton = () => {
                   if (student.registration_status === 'confirmed') {
                     return (
                       <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                         Confirmed
                       </Badge>
                     );
                   }
                   if (student.payment_required && student.payment_status === 'pending') {
                     return (
                       <Form method="post" className="inline">
                         <input type="hidden" name="paymentId" value={student.payment_id || ''} />
                         <Button type="submit" size="sm" variant="destructive" className="h-6 px-2 text-xs">
                           Pay
                         </Button>
                       </Form>
                     );
                   }
                   if (student.registration_status === 'not_registered') {
                     return (
                       <Button 
                         size="sm" 
                         variant="outline" 
                         className="h-6 px-2 text-xs"
                         asChild
                       >
                         <Link to={`/events/${event.id}/register`}>
                           Register
                         </Link>
                       </Button>
                     );
                   }
                   return getStatusBadge(student);
                 };

                 return (
                   <div key={student.id} className="flex items-center justify-between py-1">
                     <span className="text-sm text-gray-900 dark:text-white">
                       {student.first_name} {student.last_name}
                     </span>
                     {getStudentButton()}
                   </div>
                 );
               })}
             </div>
           </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
            <Button asChild variant="outline" size="sm">
              <Link to={`/events/${event.id}`}>
                View Details
              </Link>
            </Button>
            
            {studentsWithPendingPayments.length > 0 && (
              <Form method="post">
                {studentsWithPendingPayments.map((student, index) => (
                  <input 
                    key={student.id} 
                    type="hidden" 
                    name={`paymentId${index > 0 ? index : ''}`} 
                    value={student.payment_id || ''} 
                  />
                ))}
                <input type="hidden" name="paymentCount" value={studentsWithPendingPayments.length} />
                <Button type="submit" size="sm">
                  <CreditCard className="h-4 w-4 mr-1" />
                  Pay Now {studentsWithPendingPayments.length > 1 ? `(${studentsWithPendingPayments.length} students)` : ''}
                </Button>
              </Form>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="page-styles">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <AppBreadcrumb items={breadcrumbPatterns.familyEvents()} />
        </div>

        {/* Page Header */}
        <div className="family-page-header-section-styles">
          <h1 className="page-header-styles">Event Registrations</h1>
          <p className="page-subheader-styles">
            {familyName ? `${familyName} Family Events` : 'View and manage your family\'s event registrations'}
          </p>
        </div>

        {/* Pending Payments Alert */}
        {pendingPaymentTotal > 0 && (
          <div className="mb-8">
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                    <div>
                      <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                        Pending Payments
                      </h3>
                      <p className="text-yellow-700 dark:text-yellow-300">
                        You have ${(pendingPaymentTotal / 100).toFixed(2)} in pending payments
                      </p>
                    </div>
                  </div>
                  {eventsWithPendingPayments.length > 0 && (() => {
                    // Collect all pending payment IDs from all events and students
                    const allPendingPaymentIds: string[] = [];
                    events.forEach(event => {
                      event.students.forEach(student => {
                        if (student.payment_required && student.payment_status === 'pending' && student.payment_id) {
                          allPendingPaymentIds.push(student.payment_id);
                        }
                      });
                    });
                    
                    return (
                      <Form method="post">
                        {allPendingPaymentIds.map((paymentId, index) => (
                          <input 
                            key={paymentId} 
                            type="hidden" 
                            name={`paymentId${index > 0 ? index : ''}`} 
                            value={paymentId} 
                          />
                        ))}
                        <input type="hidden" name="paymentCount" value={allPendingPaymentIds.length} />
                        <Button type="submit" variant="outline" className="border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-600 dark:text-yellow-400 dark:hover:bg-yellow-900/30">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Pay Now {allPendingPaymentIds.length > 1 ? `(${allPendingPaymentIds.length} payments)` : ''}
                        </Button>
                      </Form>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Event Registrations Content */}
        <div className="form-container-styles p-8 backdrop-blur-lg">
          {events.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Event Registrations
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                You haven&apos;t registered for any events yet.
              </p>
              <Button asChild>
                <Link to="/family/calendar">
                  Browse Events
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Events with Pending Payments */}
              {eventsWithPendingPayments.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Events with Pending Payments ({eventsWithPendingPayments.length})
                  </h2>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {eventsWithPendingPayments.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              )}

              {/* All Events */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  All Registered Events ({events.length})
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {events.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}