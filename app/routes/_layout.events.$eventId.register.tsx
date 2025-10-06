import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { EventService, type EventWithEventType } from '~/services/event.server';
import { siteConfig } from '~/config/site';
import { Button } from '~/components/ui/button';
import {Card, CardContent} from '~/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { EventRegistrationForm } from '~/components/EventRegistrationForm';
import { getSupabaseServerClient, getSupabaseAdminClient } from '~/utils/supabase.server';
import type { Database, TablesInsert } from '~/types/database.types';
import { Calendar, Clock, MapPin, DollarSign, ExternalLink } from 'lucide-react';
import { formatDate, formatTime } from '~/utils/misc';
import { calculateTaxesForPayment } from '~/services/tax-rates.server';
import { multiplyMoney, type Money, addMoney, isPositive, toCents, ZERO_MONEY, formatMoney, serializeMoney, deserializeMoney, type MoneyJSON } from '~/utils/money';
import { moneyFromRow } from '~/utils/database-money';
import { createSelfRegistrant } from '~/services/self-registration.server';

// Extended Event type for registration with additional properties
type EventWithRegistrationInfo = EventWithEventType & {
  allow_registration: boolean;
};

type SerializedEventWithRegistrationInfo = Omit<EventWithRegistrationInfo, 'registration_fee' | 'late_registration_fee'> & {
  registration_fee: MoneyJSON;
  late_registration_fee: MoneyJSON;
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
    const registrationData = JSON.parse(formData.get("registrationData") as string || '{}');
    const students: Array<Record<string, unknown>> = Array.isArray(registrationData.students) ? registrationData.students : [];
    const registerSelf: boolean = Boolean(registrationData.registerSelf);
    const selfParticipant: { firstName?: string; lastName?: string; email?: string } | undefined = registrationData.selfParticipant;
    let selfParticipantStudentId: string | undefined = registrationData.selfParticipantStudentId || undefined;

    // Get user session
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
      const currentUrl = new URL(request.url);
      const redirectTo = `${currentUrl.pathname}${currentUrl.search}`;
      return redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
    }

    // Check waiver requirements for authenticated users
    if (user) {
      // Get event's required waiver IDs
      const { data: eventWaiverIds, error: eventWaiversError } = await supabaseServer
        .from('event_waivers')
        .select('waiver_id')
        .eq('event_id', eventId);

      if (eventWaiversError) {
        console.error('Error fetching event waivers:', eventWaiversError);
        return json({ error: 'Failed to check waiver requirements' }, { status: 500 });
      }

      if (eventWaiverIds && eventWaiverIds.length > 0) {
        const requiredWaiverIds = eventWaiverIds.map(ew => ew.waiver_id);
        
        // Check which waivers the user has signed
        const { data: signedWaivers } = await supabaseServer
          .from('waiver_signatures')
          .select('waiver_id')
          .eq('user_id', user.id)
          .in('waiver_id', requiredWaiverIds);

        const signedWaiverIds = signedWaivers?.map(sw => sw.waiver_id) || [];
        const missingWaiverIds = requiredWaiverIds.filter(id => !signedWaiverIds.includes(id));

        if (missingWaiverIds.length > 0) {
          // Get waiver details for missing waivers
          const { data: missingWaiverDetails } = await supabaseServer
            .from('waivers')
            .select('id, title')
            .in('id', missingWaiverIds);
          
          return json({ 
            error: 'Required waivers must be signed before registration',
            missingWaivers: missingWaiverDetails || [],
            waiverValidationFailed: true
          }, { status: 400 });
        }
      }
    }

    // For authenticated users, get their family information
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('family_id, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile for event registration:', profileError);
      return json({ error: 'Failed to load profile information' }, { status: 500 });
    }

    let familyId: string | null = profile?.family_id || null;

    // Use the self-registration service for consistent family creation/reuse
    if (registerSelf && !selfParticipantStudentId) {
      const participantFirstName = selfParticipant?.firstName || profile?.first_name || user.user_metadata?.first_name || 'Self';
      const participantLastName = selfParticipant?.lastName || profile?.last_name || user.user_metadata?.last_name || 'Participant';
      const primaryPhone = typeof registrationData.parentPhone === 'string' ? registrationData.parentPhone : '';

      try {
        const selfRegistrant = await createSelfRegistrant({
          profileId: user.id,
          firstName: participantFirstName,
          lastName: participantLastName,
          email: selfParticipant?.email ?? user.email ?? '',
          phone: primaryPhone,
        }, supabaseAdmin);

        familyId = selfRegistrant.family.id;
        selfParticipantStudentId = selfRegistrant.student.id;
      } catch (error) {
        console.error('Error creating self-registrant:', error);
        return json({ error: 'Unable to prepare account for registration' }, { status: 500 });
      }
    } else if (registerSelf && selfParticipantStudentId) {
      // If we already have a self participant student ID, get their family
      if (!familyId) {
        const { data: existingStudent } = await supabaseServer
          .from('students')
          .select('family_id')
          .eq('id', selfParticipantStudentId)
          .single();

        if (existingStudent?.family_id) {
          familyId = existingStudent.family_id;
        }
      }
    }

    if (!familyId) {
      return json({ error: 'Family profile is incomplete. Please contact support.' }, { status: 400 });
    }

    const familyIdStr = familyId as string;

    const registrationParticipants: Array<{ studentId: string; participantProfileId?: string }> = [];
    const studentIdsForPayment: string[] = [];

    for (const student of students) {
      const existingStudentId = (student.id || student.existingStudentId) as string | undefined;

      if (student.isExistingStudent && existingStudentId) {
        registrationParticipants.push({ studentId: existingStudentId });
        studentIdsForPayment.push(existingStudentId);
        continue;
      }

      const firstName = student.firstName as string | undefined;
      const lastName = student.lastName as string | undefined;

      if (!firstName || !lastName) {
        console.warn('Skipping student without required name fields');
        continue;
      }

      const studentData: StudentInsert = {
        family_id: familyIdStr,
        first_name: firstName,
        last_name: lastName,
        birth_date: (student.dateOfBirth as string | undefined) || null,
        gender: (student.gender as string | undefined) || 'other',
        school: (student.school as string | undefined) || null,
        cell_phone: (student.emergencyContactPhone as string | undefined) || null,
        t_shirt_size: 'AM' as Database['public']['Enums']['t_shirt_size_enum'],
        allergies: (student.allergies as string | undefined) || null,
        medications: (student.medicalConditions as string | undefined) || null,
        email: null,
      };

      const { data: newStudent, error: studentError } = await supabaseServer
        .from('students')
        .insert(studentData)
        .select('id')
        .single();

      if (studentError || !newStudent) {
        console.error('Error creating student:', studentError);
        return json({ error: 'Failed to create student record' }, { status: 500 });
      }

      registrationParticipants.push({ studentId: newStudent.id });
      studentIdsForPayment.push(newStudent.id);
    }

    if (registerSelf) {
      if (!familyId) {
        return json({ error: 'Unable to determine account family for self registration.' }, { status: 400 });
      }

      if (!selfParticipantStudentId) {
        return json({ error: 'Unable to create participant record for self registration' }, { status: 500 });
      }

      studentIdsForPayment.push(selfParticipantStudentId);

      registrationParticipants.push({
        studentId: selfParticipantStudentId,
        participantProfileId: user.id,
      });
    }

    if (studentIdsForPayment.length > 0) {
      const { data: existingRegistrations } = await supabaseServer
        .from('event_registrations')
        .select('student_id')
        .eq('event_id', eventId)
        .in('student_id', studentIdsForPayment);

      if (existingRegistrations && existingRegistrations.length > 0) {
        const alreadyRegisteredIds = existingRegistrations.map(reg => reg.student_id);
        return json({ 
          error: 'One or more students are already registered for this event',
          alreadyRegistered: alreadyRegisteredIds
        }, { status: 400 });
      }
    }

    if (registerSelf) {
      const { data: existingSelfRegistration } = await supabaseServer
        .from('event_registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('participant_profile_id', user.id)
        .maybeSingle();

      if (existingSelfRegistration) {
        return json({ error: 'You are already registered for this event' }, { status: 400 });
      }
    }

    // Get event details to check registration fee
    const { data: eventDetails_db } = await supabaseServer
      .from('events')
      .select('registration_fee, registration_fee_cents')
      .eq('id', eventId)
      .single();

    const registrationFee: Money = eventDetails_db
      ? moneyFromRow('events', 'registration_fee', eventDetails_db as unknown as Record<string, unknown>)
      : ZERO_MONEY;
    const paymentRequired = isPositive(registrationFee);

    const registrations = registrationParticipants.map((participant) => ({
      event_id: eventId,
      student_id: participant.studentId ?? null,
      participant_profile_id: participant.participantProfileId ?? null,
      family_id: familyId,
      registration_status: (paymentRequired
        ? 'pending'
        : 'confirmed') as Database['public']['Enums']['registration_status_enum'],
    }));

    // Use admin client to bypass RLS for newly created families
    // (RLS check may not see the just-updated profile.family_id due to transaction isolation)
    const { data: createdRegistrations_db, error: registrationError } = await supabaseAdmin
      .from('event_registrations')
      .insert(registrations)
      .select('id');

    if (registrationError) {
      console.error('Error creating registrations:', registrationError);
      return json({ error: 'Failed to create event registrations' }, { status: 500 });
    }

    const registrationId = createdRegistrations_db?.[0]?.id;
    const registrationIds = (createdRegistrations_db || []).map((row) => row.id);

    if (paymentRequired) {
      // Create payment record for paid events using admin client
      const subtotal = multiplyMoney(registrationFee, registrationParticipants.length);
      
      // Calculate taxes for the payment
      const taxCalculation = await calculateTaxesForPayment({
        subtotalAmount: subtotal,
        paymentType: 'event_registration',
        studentIds: studentIdsForPayment
      });
      
      const total = addMoney(subtotal, taxCalculation.totalTaxAmount);
      
      const { data: paymentRecord, error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert({
          family_id: familyId,
          subtotal_amount: toCents(subtotal),
          total_amount: toCents(total),
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
        const paymentTaxes_db1 = taxCalculation.paymentTaxes.map(tax => ({
          payment_id: paymentRecord.id,
          tax_rate_id: tax.tax_rate_id,
          tax_amount: toCents(tax.tax_amount),
          tax_name_snapshot: tax.tax_name_snapshot,
          tax_rate_snapshot: tax.tax_rate_snapshot
        }));

        const { error: taxError } = await supabaseAdmin
          .from('payment_taxes')
          .insert(paymentTaxes_db1);

        if (taxError) {
          console.error('Error creating payment taxes:', taxError);
          // Don't fail the entire process for tax record creation errors
        }
      }

      // Link payment to registrations
      console.log('Linking payment to registrations:', {
        paymentId: paymentRecord.id,
        eventId,
        familyId: familyIdStr,
        studentIds: studentIdsForPayment,
        registrationFee
      });
      
      // Small delay to ensure registrations are committed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let updateResult = null;
      let linkError = null;
      if (registrationIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from('event_registrations')
          .update({
            payment_id: paymentRecord.id,
            payment_amount_cents: toCents(registrationFee), // Store in cents
            payment_required: true
          })
          .eq('event_id', eventId)
        .eq('family_id', familyIdStr)
          .in('id', registrationIds)
          .select('id, payment_id');
        updateResult = data;
        linkError = error;
      }

      if (registrationIds.length > 0) {
        if (linkError) {
          console.error('Error linking payment to registrations:', linkError);
          return json({ error: 'Failed to link payment to registrations' }, { status: 500 });
        }
        
        console.log('Payment linking result:', updateResult);
        
        if (!updateResult || updateResult.length === 0) {
          console.error('No registrations were updated with payment_id');
          return json({ error: 'Failed to link payment - no registrations found to update' }, { status: 500 });
        }
      }

      return json({ 
        success: true,
        paymentRequired: true,
        registrationId,
        paymentId: paymentRecord.id,
        familyId: familyIdStr,
        studentIds: studentIdsForPayment,
        taxes: taxCalculation.paymentTaxes.map(tax => ({
          taxName: tax.tax_name_snapshot,
          taxAmount: tax.tax_amount,
          taxRate: tax.tax_rate_snapshot
        })),
        totalTaxAmount: taxCalculation.totalTaxAmount
      });
    } else {
      // Free event - update registrations with payment info
      if (registrationIds.length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('event_registrations')
          .update({
            payment_amount_cents: 0,
            payment_required: false
          })
          .eq('event_id', eventId)
        .eq('family_id', familyIdStr)
          .in('id', registrationIds);

        if (updateError) {
          console.error('Error updating free event registrations:', updateError);
          return json({ error: 'Failed to update registrations' }, { status: 500 });
        }
      }


      // Free event - registration is complete
      return json({ 
        success: true,
        paymentRequired: false,
        registrationId,
        message: 'Registration completed successfully!',
        familyId: familyIdStr,
        studentIds: studentIdsForPayment,
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
    console.log(`Using existing payment record: ${paymentId}. Redirecting to Provider payment page.`);
    
    // Redirect to payment page using existing payment record
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

  if (!isLoggedIn) {
    const currentUrl = new URL(request.url);
    const redirectTo = `${currentUrl.pathname}${currentUrl.search}`;
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const event = await EventService.getEventById(eventId, isLoggedIn);
  
  if (!event) {
    throw new Response("Event not found", { status: 404 });
  }

  const selfRegistrationAllowed = Boolean(event.allow_self_participants);

  // Get required waivers for this event
  const { data: eventWaivers } = await supabaseServer
    .from('event_waivers')
    .select(`
      waiver_id,
      is_required,
      waivers (
        id,
        title,
        content
      )
    `)
    .eq('event_id', eventId)
    .eq('is_required', true);

  const requiredWaivers = eventWaivers?.map(ew => ew.waivers).filter(Boolean) || [];

  // Get family data
  
  let familyData = undefined;
  let isAuthenticated = false;
  let hasExistingStudents = false;
  let profileInfo: { firstName: string; lastName: string; email: string } | undefined;
  let existingSelfStudentId: string | undefined;
  let familyType: Database['public']['Tables']['families']['Row']['family_type'] | undefined;

  if (user) {
    isAuthenticated = true;

    // Get user profile to find family_id
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('family_id, first_name, last_name')
      .eq('id', user.id)
      .single();

    profileInfo = {
      firstName: profile?.first_name || user.user_metadata?.first_name || '',
      lastName: profile?.last_name || user.user_metadata?.last_name || '',
      email: user.email || '',
    };

    if (profile?.family_id) {
      // Get family information
      const { data: family } = await supabaseServer
        .from('families')
        .select(`
          id,
          name,
          email,
          primary_phone,
          family_type
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

      hasExistingStudents = Array.isArray(students) && students.length > 0;

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
        familyType = family.family_type ?? undefined;
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
    } else if (selfRegistrationAllowed) {
      const { data: selfStudent } = await supabaseServer
        .from('students')
        .select('id')
        .eq('profile_id', user.id)
        .eq('is_adult', true)
        .maybeSingle();

      if (selfStudent) {
        existingSelfStudentId = selfStudent.id;
      }
    }
  }

  // Check for existing waiver signatures if user is authenticated
  let signedWaiverIds: string[] = [];
  if (user && requiredWaivers.length > 0) {
    const { data: signatures } = await supabaseServer
      .from('waiver_signatures')
      .select('waiver_id')
      .eq('user_id', user.id)
      .in('waiver_id', requiredWaivers.map(w => w.id));
    
    signedWaiverIds = signatures?.map(s => s.waiver_id) || [];
  }

  // Add missing properties to event object
  const eventWithProperties: EventWithRegistrationInfo = {
    ...event,
    allow_registration: event.status === 'registration_open'
  };

  const serializedEvent: SerializedEventWithRegistrationInfo = {
    ...eventWithProperties,
    registration_fee: serializeMoney(eventWithProperties.registration_fee),
    late_registration_fee: serializeMoney(eventWithProperties.late_registration_fee),
  };

  const requestUrl = new URL(request.url);
  const redirectTo = `${requestUrl.pathname}${requestUrl.search}`;
  const addStudentUrl = `/family/add-student?redirectTo=${encodeURIComponent(redirectTo)}`;
  const requiresStudentProfile = !hasExistingStudents && !selfRegistrationAllowed;

  return json({ 
    event: serializedEvent, 
    isAuthenticated, 
    familyData,
    requiredWaivers,
    signedWaiverIds,
    requiresStudentProfile,
    addStudentUrl,
    selfRegistrationAllowed,
    profileInfo,
    existingSelfStudentId,
    familyType
  });
}

export default function EventRegistration() {
  const {
    event: serializedEvent,
    isAuthenticated,
    familyData,
    requiredWaivers,
    signedWaiverIds,
    requiresStudentProfile,
    addStudentUrl,
    selfRegistrationAllowed,
    profileInfo,
    existingSelfStudentId,
    familyType,
  } = useLoaderData<typeof loader>();
  const event: EventWithRegistrationInfo = {
    ...serializedEvent,
    registration_fee: deserializeMoney(serializedEvent.registration_fee),
    late_registration_fee: deserializeMoney(serializedEvent.late_registration_fee),
  };

  const handleRegistrationSuccess = () => {
    // Reload the page to show updated student list
    window.location.reload();
  };



  // formatTime is now imported from ~/utils/misc
  const formatTimeOrNull = (time: string | null) => {
    const formatted = formatTime(time);
    return formatted || null;
  };

  const slotTimeRanges = [
    [event.slot_one_start, event.slot_one_end],
    [event.slot_two_start, event.slot_two_end],
  ].filter(([start, end]) => start || end) as Array<[string | null, string | null]>;

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
                          {formatTimeOrNull(event.start_time)}
                          {event.end_time && ` - ${formatTimeOrNull(event.end_time)}`}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location_name || event.location || siteConfig.name}</span>
                    </div>
                    {isPositive(event.registration_fee) && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">{formatMoney(event.registration_fee, { trimTrailingZeros: true })}</span>
                      </div>
                    )}
                    {slotTimeRanges.length > 0 && (
                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mt-2">
                        <p className="font-medium">Additional Time Slots</p>
                        <ul className="space-y-1">
                          {slotTimeRanges.map(([start, end], index) => (
                            <li key={index}>
                              {start ? formatTimeOrNull(start) : 'TBD'}
                              {end ? ` - ${formatTimeOrNull(end)}` : ''}
                            </li>
                          ))}
                        </ul>
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
                {requiresStudentProfile && (
                  <Alert className="mb-6">
                    <AlertTitle className="text-lg font-semibold">Add students before registering</AlertTitle>
                    <AlertDescription className="mt-2 text-sm text-muted-foreground">
                      You’ll need at least one student on your family profile to complete event registration. Add a student now and we’ll bring you right back to this page.
                    </AlertDescription>
                    <div className="mt-4">
                      <Button asChild variant="secondary">
                        <Link to={addStudentUrl}>Add a student</Link>
                      </Button>
                    </div>
                  </Alert>
                )}

                {/* Registration Form */}
                <EventRegistrationForm 
                  event={event}
                  isAuthenticated={isAuthenticated}
                  familyData={familyData}
                  requiredWaivers={requiredWaivers}
                  signedWaiverIds={signedWaiverIds}
                  selfRegistrationAllowed={selfRegistrationAllowed}
                  profileInfo={profileInfo}
                  existingSelfStudentId={existingSelfStudentId}
                  familyType={familyType}
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
