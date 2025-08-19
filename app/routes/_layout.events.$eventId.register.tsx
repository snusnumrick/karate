import { json, type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { EventService } from '~/services/event.server';
import { siteConfig } from '~/config/site';
import { Button } from '~/components/ui/button';
import {Card, CardContent} from '~/components/ui/card';
import { EventRegistrationForm } from '~/components/EventRegistrationForm';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import type { Database, Tables, TablesInsert } from '~/types/database.types';
import { Calendar, Clock, MapPin, DollarSign, ArrowLeft, ExternalLink } from 'lucide-react';

// Extended Event type for registration with additional properties
type EventWithRegistrationInfo = Tables<'events'> & {
  fee: number;
  allow_registration: boolean;
};

type StudentInsert = TablesInsert<'students'>;

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const eventId = params.eventId;
  if (!eventId) {
    throw new Response("Event ID is required", { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "register") {
    return handleEventRegistration(formData, eventId, request);
  }

  if (intent === "payment") {
    return handlePayment(formData, eventId, request);
  }

  throw new Response("Invalid intent", { status: 400 });
};

async function handleEventRegistration(formData: FormData, eventId: string, request: Request) {
  const { supabaseServer } = getSupabaseServerClient(request);
  
  try {
    // Parse registration data
    const registrationData = JSON.parse(formData.get("registrationData") as string);
    const { parentInfo, students } = registrationData;

    // Get user session
    const { data: { user } } = await supabaseServer.auth.getUser();

    let familyId = null;
    
    if (user) {
      // For authenticated users, get their family ID
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();
      familyId = profile?.family_id;
    } else {
      // For guest users, create a new family
      const { data: newFamily, error: familyError } = await supabaseServer
        .from('families')
        .insert({
          name: `${parentInfo.firstName} ${parentInfo.lastName}`,
          email: parentInfo.email,
          primary_phone: parentInfo.phone,
          address: parentInfo.address || '',
          city: parentInfo.city || '',
          postal_code: parentInfo.postalCode || '',
          province: parentInfo.province || '',
           emergency_contact: parentInfo.emergencyContactName,
        })
        .select('id')
        .single();

      if (familyError) {
        console.error('Error creating family:', familyError);
        return json({ error: 'Failed to create family record' }, { status: 500 });
      }

      familyId = newFamily.id;
    }

    // Ensure we have a valid family ID
    if (!familyId) {
      return json({ error: 'Failed to determine family ID' }, { status: 500 });
    }

    // Create student records for guest users or use existing for authenticated users
    const studentIds = [];
    
    for (const student of students) {
      if (student.existingStudentId) {
        // Use existing student
        studentIds.push(student.existingStudentId);
      } else {
        // Create new student
        const studentData: StudentInsert = {
            family_id: familyId,
            first_name: student.firstName,
            last_name: student.lastName,
            birth_date: student.dateOfBirth,
            gender: student.gender || 'other',
            school: student.school || 'Not specified',
            cell_phone: student.emergencyContactPhone || null,
            t_shirt_size: 'AM' as Database['public']['Enums']['t_shirt_size_enum'],
            allergies: student.allergies || null,
            medications: student.medicalConditions || null,
            email: student.emergencyContactName || null
          };

        const { data: newStudent, error: studentError } = await supabaseServer
          .from('students')
          .insert(studentData)
          .select('id')
          .single();

        if (studentError) {
          console.error('Error creating student:', studentError);
          return json({ error: 'Failed to create student record' }, { status: 500 });
        }

        studentIds.push(newStudent.id);
      }
    }

    // Create event registrations
    const registrations = studentIds.map(studentId => ({
      event_id: eventId,
      student_id: studentId,
       family_id: familyId || '',
       registration_status: 'pending' as Database['public']['Enums']['registration_status_enum'],
       payment_status: 'pending' as Database['public']['Enums']['payment_status'],
    }));

    const { error: registrationError } = await supabaseServer
      .from('event_registrations')
      .insert(registrations);

    if (registrationError) {
      console.error('Error creating registrations:', registrationError);
      return json({ error: 'Failed to create event registrations' }, { status: 500 });
    }

    return json({ 
      success: true, 
      message: 'Registration submitted successfully',
      familyId,
      studentIds 
    });

  } catch (error) {
    console.error('Registration error:', error);
    return json({ error: 'Failed to process registration' }, { status: 500 });
  }
}

async function handlePayment(formData: FormData, eventId: string, request: Request) {
  // This would integrate with your existing payment processing logic
  // For now, we'll just mark the registrations as paid
  const { supabaseServer } = getSupabaseServerClient(request);
  
  try {
    const familyId = formData.get("familyId") as string;
    const studentIds = JSON.parse(formData.get("studentIds") as string);

    // Update payment status for all registrations
    const { error } = await supabaseServer
      .from('event_registrations')
      .update({ 
        payment_status: 'succeeded' as Database['public']['Enums']['payment_status'],
         registration_status: 'confirmed' as Database['public']['Enums']['registration_status_enum']
      })
      .eq('event_id', eventId)
      .eq('family_id', familyId)
      .in('student_id', studentIds);

    if (error) {
      console.error('Error updating payment status:', error);
      return json({ error: 'Failed to process payment' }, { status: 500 });
    }

    return json({ success: true, message: 'Payment processed successfully' });

  } catch (error) {
    console.error('Payment error:', error);
    return json({ error: 'Failed to process payment' }, { status: 500 });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.event) {
    return [
      { title: "Event Registration | " + siteConfig.name },
      { name: "description", content: "Register for this event." },
    ];
  }

  const { event } = data;
  const title = `Register for ${event.title} | ${siteConfig.name}`;

  return [
    { title },
    { name: "description", content: `Register for ${event.title} at ${siteConfig.name}` },
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { eventId } = params;
  
  if (!eventId) {
    throw new Response("Event ID is required", { status: 400 });
  }

  const event = await EventService.getEventById(eventId);
  
  if (!event) {
    throw new Response("Event not found", { status: 404 });
  }

  // Check authentication and get family data
  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();
  
  let familyData = undefined;
  let isAuthenticated = false;

  if (user) {
    isAuthenticated = true;
    
    // Get user profile to find family_id
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    if (profile?.family_id) {
      // Get family information
      const { data: family } = await supabaseServer
        .from('families')
        .select(`
          id,
          name,
          email,
          primary_phone
        `)
        .eq('id', profile.family_id)
        .single();

      // Get students in the family
      const { data: students } = await supabaseServer
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          birth_date
        `)
        .eq('family_id', profile.family_id);

      if (family) {
        const [firstName, ...lastNameParts] = (family.name || '').split(' ');
        familyData = {
          familyId: family.id,
          parentFirstName: firstName || '',
          parentLastName: lastNameParts.join(' ') || '',
          parentEmail: family.email || user.email || '',
          parentPhone: family.primary_phone || '',
          students: (students || []).map(student => ({
            id: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            dateOfBirth: student.birth_date,
            beltRank: 'White'
          }))
        };
      }
    }
  }

  // Add missing properties to event object
  const eventWithProperties: EventWithRegistrationInfo = {
    ...event,
    fee: event.registration_fee || 0,
    allow_registration: event.status === 'registration_open'
  };

  return json({ event: eventWithProperties, isAuthenticated, familyData });
}

export default function EventRegistration() {
  const { event, isAuthenticated, familyData } = useLoaderData<typeof loader>();

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return null;
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen page-background-styles py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button and Breadcrumb Navigation */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link to={`/events/${event.id}`} className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Event Details
            </Link>
          </Button>
          
          <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <Link to="/" className="hover:text-green-600 dark:hover:text-green-400">Home</Link>
            <span>/</span>
            <Link to={`/events/${event.id}`} className="hover:text-green-600 dark:hover:text-green-400">Event Details</Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">Registration</span>
          </nav>
        </div>

        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="page-header-styles text-3xl font-extrabold sm:text-4xl mb-4">
            Event Registration
          </h1>
          <p className="page-subheader-styles mt-3 max-w-2xl mx-auto text-xl">
            Complete your registration for {event.title}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Event Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="form-container-styles">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-600 rounded-lg">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="form-header-styles text-xl font-semibold">Event Details</h2>
                </div>
                
                <div className="form-card-styles p-4 rounded-lg border-l-4 border-green-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{event.title}</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(event.start_date)}</span>
                    </div>
                    {(event.start_time || event.end_time) && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Clock className="h-4 w-4" />
                        <span>
                          {formatTime(event.start_time)}
                          {event.end_time && ` - ${formatTime(event.end_time)}`}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location_name || event.location || siteConfig.name}</span>
                    </div>
                    {event.registration_fee && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">${event.registration_fee}</span>
                      </div>
                    )}
                    {event.fee && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">${event.fee}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Registration Content */}
          <div className="lg:col-span-2">
            <Card className="form-container-styles">
              <CardContent className="p-8">

                {/* Registration Form */}
                <EventRegistrationForm 
                  event={event}
                  isAuthenticated={isAuthenticated}
                  familyData={familyData}
                />

                {/* External Registration Link - Only show if no internal registration */}
                {event.external_url && !event.allow_registration && (
                  <div className="form-card-styles p-6 rounded-lg border-l-4 border-green-600 mt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                        <ExternalLink className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="form-header-styles text-lg font-semibold">External Registration Available</h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      You can register for this event through our external registration system.
                    </p>
                    <Button asChild className="w-full sm:w-auto">
                      <a
                        href={event.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2"
                      >
                        Register Now
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}