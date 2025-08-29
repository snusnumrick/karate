import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { EventService } from '~/services/event.server';
import { siteConfig } from '~/config/site';
import { Button } from '~/components/ui/button';
import {Card, CardContent} from '~/components/ui/card';
import { EventRegistrationForm } from '~/components/EventRegistrationForm';
import { getSupabaseServerClient, getSupabaseAdminClient } from '~/utils/supabase.server';
import type { Database, Tables, TablesInsert } from '~/types/database.types';
import { Calendar, Clock, MapPin, DollarSign, ExternalLink } from 'lucide-react';
import { formatDate } from '~/utils/misc';
import { calculateTaxesForPayment } from '~/services/tax-rates.server';

// Extended Event type for registration with additional properties
type EventWithRegistrationInfo = Tables<'events'> & {
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
  console.log("intent", intent);

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
  const supabaseAdmin = getSupabaseAdminClient();
  
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
      if (student.existingStudentId || student.id) {
        // Use existing student
        studentIds.push(student.existingStudentId || student.id);
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

    // Check for existing registrations before creating new ones
    const { data: existingRegistrations } = await supabaseServer
      .from('event_registrations')
      .select('student_id')
      .eq('event_id', eventId)
      .in('student_id', studentIds);

    if (existingRegistrations && existingRegistrations.length > 0) {
      const alreadyRegisteredIds = existingRegistrations.map(reg => reg.student_id);
      return json({ 
        error: 'One or more students are already registered for this event',
        alreadyRegistered: alreadyRegisteredIds
      }, { status: 400 });
    }

    // Get event details to check registration fee
    const { data: eventDetails } = await supabaseServer
      .from('events')
      .select('registration_fee')
      .eq('id', eventId)
      .single();

    const registrationFee = eventDetails?.registration_fee || 0;
    const paymentRequired = registrationFee > 0;

    // Create event registrations
    const registrations = studentIds.map(studentId => ({
      event_id: eventId,
      student_id: studentId,
       family_id: familyId || '',
       registration_status: paymentRequired ? 'pending' as Database['public']['Enums']['registration_status_enum'] : 'confirmed' as Database['public']['Enums']['registration_status_enum'],
    }));

    const { data: createdRegistrations, error: registrationError } = await supabaseServer
      .from('event_registrations')
      .insert(registrations)
      .select('id');

    if (registrationError) {
      console.error('Error creating registrations:', registrationError);
      return json({ error: 'Failed to create event registrations' }, { status: 500 });
    }

    const registrationId = createdRegistrations?.[0]?.id;

    if (paymentRequired) {
      // Create payment record for paid events using admin client
      // Convert dollar amounts to cents for payment processing
      const subtotalInCents = Math.round(registrationFee * studentIds.length * 100);
      
      // Calculate taxes for the payment
      const taxCalculation = await calculateTaxesForPayment({
        subtotalAmount: subtotalInCents,
        paymentType: 'event_registration',
        studentIds
      });
      
      const totalInCents = subtotalInCents + taxCalculation.totalTaxAmount;
      
      const { data: paymentRecord, error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert({
          family_id: familyId,
          subtotal_amount: subtotalInCents,
          total_amount: totalInCents,
          type: 'event_registration',
          status: 'pending'
        })
        .select('id')
        .single();

      if (paymentError) {
        console.error('Error creating payment record:', paymentError);
        return json({ error: 'Failed to create payment record' }, { status: 500 });
      }

      // Create payment_taxes records
      if (taxCalculation.paymentTaxes.length > 0) {
        const paymentTaxes = taxCalculation.paymentTaxes.map(tax => ({
          payment_id: paymentRecord.id,
          tax_rate_id: tax.tax_rate_id,
          tax_amount: tax.tax_amount,
          tax_name_snapshot: tax.tax_name_snapshot,
          tax_rate_snapshot: tax.tax_rate_snapshot
        }));

        const { error: taxError } = await supabaseAdmin
          .from('payment_taxes')
          .insert(paymentTaxes);

        if (taxError) {
          console.error('Error creating payment taxes:', taxError);
          // Don't fail the entire process for tax record creation errors
        }
      }

      // Link payment to registrations
      console.log('Linking payment to registrations:', {
        paymentId: paymentRecord.id,
        eventId,
        familyId,
        studentIds,
        registrationFee
      });
      
      // Small delay to ensure registrations are committed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { data: updateResult, error: linkError } = await supabaseAdmin
        .from('event_registrations')
        .update({
          payment_id: paymentRecord.id,
          payment_amount: Math.round(registrationFee * 100), // Convert to cents
          payment_required: true
        })
        .eq('event_id', eventId)
        .eq('family_id', familyId)
        .in('student_id', studentIds)
        .select('id, payment_id');

      if (linkError) {
        console.error('Error linking payment to registrations:', linkError);
        return json({ error: 'Failed to link payment to registrations' }, { status: 500 });
      }
      
      console.log('Payment linking result:', updateResult);
      
      if (!updateResult || updateResult.length === 0) {
        console.error('No registrations were updated with payment_id');
        return json({ error: 'Failed to link payment - no registrations found to update' }, { status: 500 });
      }

      return json({ 
        success: true,
        paymentRequired: true,
        registrationId,
        paymentId: paymentRecord.id,
        familyId,
        studentIds,
        taxes: taxCalculation.paymentTaxes.map(tax => ({
          taxName: tax.tax_name_snapshot,
          taxAmount: tax.tax_amount,
          taxRate: tax.tax_rate_snapshot
        })),
        totalTaxAmount: taxCalculation.totalTaxAmount
      });
    } else {
      // Free event - update registrations with payment info
      const { error: updateError } = await supabaseServer
        .from('event_registrations')
        .update({
          payment_amount: 0,
          payment_required: false
        })
        .eq('event_id', eventId)
        .eq('family_id', familyId)
        .in('student_id', studentIds);

      if (updateError) {
        console.error('Error updating free event registrations:', updateError);
        return json({ error: 'Failed to update registrations' }, { status: 500 });
      }

      // Free event - registration is complete
      return json({ 
        success: true,
        paymentRequired: false,
        registrationId,
        message: 'Registration completed successfully!',
        familyId,
        studentIds 
      });
    }

  } catch (error) {
    console.error('Registration error:', error);
    return json({ error: 'Failed to process registration' }, { status: 500 });
  }
}

async function handlePayment(formData: FormData, eventId: string, request: Request) {
  const { supabaseServer } = getSupabaseServerClient(request);

  try {
    const familyId = formData.get("familyId") as string;
    const studentIdsRaw = formData.get("studentIds") as string;
    
    console.log('handlePayment called with:', { eventId, familyId, studentIdsRaw });
    
    if (!familyId || !studentIdsRaw) {
      console.error('Missing required form data:', { familyId, studentIdsRaw });
      return json({ error: 'Missing required registration data' }, { status: 400 });
    }
    
    const studentIds = JSON.parse(studentIdsRaw);

    // Find existing payment record linked to these registrations
    const { data: existingRegistrations, error: registrationError } = await supabaseServer
      .from('event_registrations')
      .select('payment_id')
      .eq('event_id', eventId)
      .eq('family_id', familyId)
      .in('student_id', studentIds)
      .not('payment_id', 'is', null)
      .limit(1);

    if (registrationError) {
      console.error('Database error finding existing payment record:', registrationError);
      return json({ error: 'Database error occurred while finding payment record' }, { status: 500 });
    }

    if (!existingRegistrations || existingRegistrations.length === 0) {
      console.log('No existing registrations found for:', { eventId, familyId, studentIds });
      return json({ error: 'No registrations found. Please complete registration first.' }, { status: 404 });
    }

    if (!existingRegistrations[0]?.payment_id) {
      console.log('Registration found but no payment_id:', existingRegistrations[0]);
      return json({ error: 'No payment record linked to this registration' }, { status: 404 });
    }

    const paymentId = existingRegistrations[0].payment_id;
    console.log(`Using existing payment record: ${paymentId}. Redirecting to Stripe payment page.`);
    
    // Redirect to Stripe payment page using existing payment record
    return redirect(`/pay/${paymentId}`);

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

  // Check authentication first to determine event visibility access
  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();
  const isLoggedIn = !!user;

  const event = await EventService.getEventById(eventId, isLoggedIn);
  
  if (!event) {
    throw new Response("Event not found", { status: 404 });
  }

  // Get family data
  
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

      // Get already registered students for this event
      const { data: registeredStudents } = await supabaseServer
        .from('event_registrations')
        .select('student_id')
        .eq('event_id', eventId)
        .eq('family_id', profile.family_id);

      const registeredStudentIds = new Set(
        (registeredStudents || []).map(reg => reg.student_id)
      );

      if (family) {
        const [firstName, ...lastNameParts] = (family.name || '').split(' ');
        familyData = {
          familyId: family.id,
          parentFirstName: firstName || '',
          parentLastName: lastNameParts.join(' ') || '',
          parentEmail: family.email || user.email || '',
          parentPhone: family.primary_phone || '',
          students: (students || [])
            .filter(student => !registeredStudentIds.has(student.id))
            .map(student => ({
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
    allow_registration: event.status === 'registration_open'
  };

  return json({ event: eventWithProperties, isAuthenticated, familyData });
}

export default function EventRegistration() {
  const { event, isAuthenticated, familyData } = useLoaderData<typeof loader>();

  const handleRegistrationSuccess = () => {
    // Reload the page to show updated student list
    window.location.reload();
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
                      <span>{formatDate(event.start_date, { formatString: 'EEEE, MMMM d, yyyy' })}</span>
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
                  onSuccess={handleRegistrationSuccess}
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