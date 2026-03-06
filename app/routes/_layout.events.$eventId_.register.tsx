import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData, useRouteError, Link } from '@remix-run/react';
import { AppBreadcrumb, breadcrumbPatterns } from '~/components/AppBreadcrumb';
import { EventService, type EventWithEventType } from '~/services/event.server';
import { siteConfig } from '~/config/site';
import { Button } from '~/components/ui/button';
import {Card, CardContent} from '~/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { EventRegistrationForm } from '~/components/EventRegistrationForm';
import { getSupabaseServerClient, getSupabaseAdminClient } from '~/utils/supabase.server';
import type { Database, TablesInsert } from '~/types/database.types';
import { Calendar, Clock, MapPin, DollarSign, ExternalLink } from 'lucide-react';
import { formatDate } from '~/utils/misc';
import { calculateTaxesForPayment } from '~/services/tax-rates.server';
import { multiplyMoney, type Money, addMoney, isPositive, toCents, formatMoney, serializeMoney, deserializeMoney, type MoneyJSON } from '~/utils/money';
import { moneyFromRow } from '~/utils/database-money';
import { sendEmail } from '~/utils/email.server';
import { deleteIncompleteRegistration } from '~/services/incomplete-registration.server';
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
type RegistrationStudentInput = {
  existingStudentId?: string;
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  school?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  allergies?: string;
  medicalConditions?: string;
};

type RegistrationPayload = {
  students?: RegistrationStudentInput[];
  registerSelf?: boolean;
  selfParticipant?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  selfParticipantStudentId?: string;
  parentPhone?: string;
};

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
    const registrationData = JSON.parse(formData.get("registrationData") as string || '{}') as RegistrationPayload;
    const students: RegistrationStudentInput[] = Array.isArray(registrationData.students) ? registrationData.students : [];
    const registerSelf = Boolean(registrationData.registerSelf);
    const selfParticipant = registrationData.selfParticipant;
    let selfParticipantStudentId = registrationData.selfParticipantStudentId;

    // Get user session
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
      const currentUrl = new URL(request.url);
      const redirectTo = `${currentUrl.pathname}${currentUrl.search}`;
      return redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
    }

    const { data: eventDetails_db, error: eventDetailsError } = await supabaseServer
      .from('events')
      .select('registration_fee, registration_fee_cents, allow_self_participants')
      .eq('id', eventId)
      .single();

    if (eventDetailsError || !eventDetails_db) {
      console.error('Error fetching event details for registration:', eventDetailsError);
      return json({ error: 'Failed to load event details' }, { status: 500 });
    }

    if (registerSelf && !eventDetails_db.allow_self_participants) {
      return json({ error: 'This event does not allow self registration' }, { status: 400 });
    }

    const registrationFee: Money = moneyFromRow(
      'events',
      'registration_fee',
      eventDetails_db as unknown as Record<string, unknown>
    );
    const paymentRequired = isPositive(registrationFee);

    // For authenticated users, get their family ID
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('family_id, first_name, last_name, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile for event registration:', profileError);
      return json({ error: 'Failed to load profile information' }, { status: 500 });
    }

    let familyId = profile?.family_id ?? null;

    if (registerSelf && !selfParticipantStudentId) {
      const fallbackName = profile?.email?.split('@')[0] || user.email?.split('@')[0] || 'Participant';
      const participantFirstName = selfParticipant?.firstName?.trim() || profile?.first_name?.trim() || fallbackName;
      const participantLastName = selfParticipant?.lastName?.trim() || profile?.last_name?.trim() || 'Registrant';

      try {
        const selfRegistrant = await createSelfRegistrant(
          {
            profileId: user.id,
            firstName: participantFirstName,
            lastName: participantLastName,
            email: selfParticipant?.email?.trim() || profile?.email || user.email || '',
            phone: registrationData.parentPhone || '',
          },
          supabaseAdmin
        );

        familyId = selfRegistrant.family.id;
        selfParticipantStudentId = selfRegistrant.student.id;
      } catch (error) {
        console.error('Error creating self-registrant for event registration:', error);
        return json({ error: 'Unable to prepare self registration account' }, { status: 500 });
      }
    } else if (registerSelf && selfParticipantStudentId && !familyId) {
      const { data: existingSelfStudent } = await supabaseServer
        .from('students')
        .select('family_id')
        .eq('id', selfParticipantStudentId)
        .single();

      if (existingSelfStudent?.family_id) {
        familyId = existingSelfStudent.family_id;
      }
    }

    if (!familyId) {
      return json({ error: 'Family profile is incomplete. Please contact support.' }, { status: 400 });
    }
    const familyIdStr = familyId;

    // Create student records for guest users or use existing for authenticated users
    const studentIdsByIndex: Array<string | null> = Array(students.length).fill(null);
    const emergencyContacts: Map<string, string> = new Map(); // studentId -> emergency contact JSON

    const existingStudents = students
      .map((student, index) => ({
        student,
        index,
        studentId: student.existingStudentId || student.id,
      }))
      .filter((entry): entry is { student: (typeof students)[number]; index: number; studentId: string } => Boolean(entry.studentId));

    const newStudents = students
      .map((student, index) => ({ student, index }))
      .filter(({ student }) => !student.existingStudentId && !student.id);

    // Batch-read existing student phone data for conditional emergency phone updates.
    const existingStudentIds = existingStudents.map((entry) => entry.studentId);
    const existingStudentsById = new Map<string, { cell_phone: string | null }>();
    if (existingStudentIds.length > 0) {
      const { data: existingStudentRows, error: existingStudentsError } = await supabaseServer
        .from('students')
        .select('id, cell_phone')
        .in('id', existingStudentIds);

      if (existingStudentsError) {
        console.error('Error fetching existing students for event registration updates:', existingStudentsError);
      }

      (existingStudentRows || []).forEach((row) => {
        existingStudentsById.set(row.id, { cell_phone: row.cell_phone });
      });
    }

    // Build and apply student medical/contact updates in parallel.
    const updateOperations = existingStudents.reduce<Array<PromiseLike<{ error: unknown }>>>((operations, { student, studentId, index }) => {
        studentIdsByIndex[index] = studentId;

        const emergencyContactData = JSON.stringify({
          name: student.emergencyContactName,
          phone: student.emergencyContactPhone,
          relation: student.emergencyContactRelation
        });
        emergencyContacts.set(studentId, emergencyContactData);

        const studentUpdates: Partial<Database['public']['Tables']['students']['Update']> = {};

        if (student.allergies) {
          studentUpdates.allergies = student.allergies;
        }

        if (student.medicalConditions) {
          studentUpdates.medications = student.medicalConditions;
        }

        const existingStudent = existingStudentsById.get(studentId);
        if (existingStudent && !existingStudent.cell_phone && student.emergencyContactPhone) {
          studentUpdates.cell_phone = student.emergencyContactPhone;
        }

        if (Object.keys(studentUpdates).length === 0) {
          return operations;
        }

        operations.push(
          supabaseServer
            .from('students')
            .update(studentUpdates)
            .eq('id', studentId)
            .then(({ error }) => ({ error })),
        );

        return operations;
      }, []);

    if (updateOperations.length > 0) {
      const updateResults = await Promise.all(updateOperations);
      updateResults.forEach(({ error: updateError }) => {
        if (updateError) {
          console.error('Error updating student medical info:', updateError);
        }
      });
    }

    // Batch-create new students in one insert call.
    if (newStudents.length > 0) {
      const newStudentRows: StudentInsert[] = newStudents.map(({ student }) => ({
        family_id: familyIdStr,
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
      }));

      const { data: insertedStudents, error: insertStudentsError } = await supabaseServer
        .from('students')
        .insert(newStudentRows)
        .select('id');

      if (insertStudentsError || !insertedStudents || insertedStudents.length !== newStudents.length) {
        console.error('Error creating student records:', insertStudentsError);
        return json({ error: 'Failed to create student record' }, { status: 500 });
      }

      insertedStudents.forEach((newStudent, insertIndex) => {
        const { student, index } = newStudents[insertIndex];
        studentIdsByIndex[index] = newStudent.id;

        const emergencyContactData = JSON.stringify({
          name: student.emergencyContactName,
          phone: student.emergencyContactPhone,
          relation: student.emergencyContactRelation
        });
        emergencyContacts.set(newStudent.id, emergencyContactData);
      });
    }

    const studentIds = studentIdsByIndex.filter((id): id is string => Boolean(id));
    const registrationParticipants: Array<{ studentId: string; participantProfileId?: string }> = studentIds.map((studentId) => ({ studentId }));
    const studentIdsForPayment = [...studentIds];

    if (registerSelf) {
      if (!selfParticipantStudentId) {
        return json({ error: 'Unable to resolve participant record for self registration' }, { status: 500 });
      }

      if (!studentIdsForPayment.includes(selfParticipantStudentId)) {
        studentIdsForPayment.push(selfParticipantStudentId);
      }

      registrationParticipants.push({
        studentId: selfParticipantStudentId,
        participantProfileId: user.id,
      });
    }

    // Validate waiver signatures if event has required waivers
    const { data: requiredWaivers } = await supabaseServer
      .from('event_waivers')
      .select('waiver_id')
      .eq('event_id', eventId)
      .eq('is_required', true);

    if (requiredWaivers && requiredWaivers.length > 0) {
      // Check that all required waivers are signed and cover all students being registered
      const waiverIds = requiredWaivers.map(w => w.waiver_id);

      const { data: signatures } = await supabaseServer
        .from('waiver_signatures')
        .select('waiver_id, student_ids')
        .eq('user_id', user.id)
        .in('waiver_id', waiverIds);

      if (!signatures || signatures.length !== waiverIds.length) {
        console.error('Not all required waivers are signed');
        return redirect(`/events/${eventId}/register/students?error=waivers_not_signed`);
      }

      // Verify all students being registered are covered by at least one waiver
      const allStudentsCovered = studentIdsForPayment.every(studentId =>
        signatures.some(sig => sig.student_ids && sig.student_ids.includes(studentId))
      );

      if (!allStudentsCovered) {
        console.error('Not all students are covered by waivers');
        return redirect(`/events/${eventId}/register/students?error=waiver_mismatch`);
      }
    }

    // Check for existing registrations before creating new ones
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

    // Create event registrations with emergency contact data
    const registrations = registrationParticipants.map((participant) => ({
      event_id: eventId,
      student_id: participant.studentId,
      participant_profile_id: participant.participantProfileId || null,
      family_id: familyIdStr,
      registration_status: paymentRequired ? 'pending' as Database['public']['Enums']['registration_status_enum'] : 'confirmed' as Database['public']['Enums']['registration_status_enum'],
      emergency_contact: emergencyContacts.get(participant.studentId) || null,
    }));

    const { data: createdRegistrations_db, error: registrationError } = await supabaseAdmin
      .from('event_registrations')
      .insert(registrations)
      .select('id');

    if (registrationError) {
      console.error('Error creating registrations:', registrationError);
      return json({ error: 'Failed to create event registrations' }, { status: 500 });
    }

    const registrationId = createdRegistrations_db?.[0]?.id;
    const createdRegistrationIds = (createdRegistrations_db || []).map(reg => reg.id);

    // Send confirmation email
    try {
      // Get event details
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('title, description, start_date, end_date, location')
        .eq('id', eventId)
        .single();

      // Get student details
      const { data: registeredStudents } = await supabaseAdmin
        .from('students')
        .select('first_name, last_name')
        .in('id', studentIdsForPayment);

      // Get family details
      const { data: family } = await supabaseAdmin
        .from('families')
        .select('name, email')
        .eq('id', familyIdStr)
        .single();

      if (family?.email && event && registeredStudents) {
        const studentNames = registeredStudents.map(s => `${s.first_name} ${s.last_name}`).join(', ');
        const eventDate = event.start_date ? formatDate(event.start_date, { formatString: 'EEEE, MMMM d, yyyy' }) : 'TBA';
        const eventTime = event.start_date ? formatDate(event.start_date, { formatString: 'h:mm a' }) : '';

        await sendEmail({
          to: family.email,
          subject: `Event Registration Confirmation - ${event.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #166534;">Registration Confirmed!</h2>

              <p>Dear ${family.name},</p>

              <p>Thank you for registering for <strong>${event.title}</strong>. Your registration has been confirmed.</p>

              <div style="background-color: #f0fdf4; border-left: 4px solid #166534; padding: 16px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #166534;">Event Details</h3>
                <p style="margin: 8px 0;"><strong>Event:</strong> ${event.title}</p>
                <p style="margin: 8px 0;"><strong>Date:</strong> ${eventDate}${eventTime ? ` at ${eventTime}` : ''}</p>
                ${event.location ? `<p style="margin: 8px 0;"><strong>Location:</strong> ${event.location}</p>` : ''}
                ${event.description ? `<p style="margin: 8px 0;"><strong>Description:</strong> ${event.description}</p>` : ''}
              </div>

              <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1e40af;">Registration Information</h3>
                <p style="margin: 8px 0;"><strong>Students Registered:</strong> ${studentNames}</p>
                <p style="margin: 8px 0;"><strong>Registration ID:</strong> ${registrationId}</p>
                ${paymentRequired ? `<p style="margin: 8px 0;"><strong>Registration Fee:</strong> ${formatMoney(registrationFee)} per student</p>` : ''}
                ${paymentRequired ? `<p style="margin: 8px 0; color: #d97706;"><strong>Payment Status:</strong> Pending - Please complete payment to confirm your registration</p>` : '<p style="margin: 8px 0; color: #16a34a;"><strong>Status:</strong> Confirmed</p>'}
              </div>

              ${paymentRequired ? `
                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0;"><strong>⚠️ Action Required:</strong> Please complete your payment to finalize your registration.</p>
                </div>
              ` : ''}

              <p>If you have any questions or need to make changes to your registration, please don't hesitate to contact us.</p>

              <p>We look forward to seeing you at ${event.title}!</p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />

              <p style="font-size: 12px; color: #6b7280;">
                ${siteConfig.name}<br>
                ${siteConfig.contact.email}<br>
                ${siteConfig.contact.phone}
              </p>
            </div>
          `
        });

        console.log(`[event-registration] Confirmation email sent to ${family.email}`);
      }
    } catch (emailError) {
      // Don't fail registration if email fails
      console.error('[event-registration] Failed to send confirmation email:', emailError);
    }

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
          family_id: familyIdStr,
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
        registrationIds: createdRegistrationIds,
        registrationFee
      });

      if (createdRegistrationIds.length === 0) {
        console.error('No registrations were created before payment linking');
        return json({ error: 'Failed to link payment - no registrations found to update' }, { status: 500 });
      }

      const { data: updateResult, error: linkError } = await supabaseAdmin
        .from('event_registrations')
        .update({
          payment_id: paymentRecord.id,
          payment_amount_cents: toCents(registrationFee), // Payment amount in cents
          payment_required: true
        })
        .in('id', createdRegistrationIds)
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

      // Delete incomplete registration record (payment pending, user will complete on /pay page)
      await deleteIncompleteRegistration(supabaseServer, familyIdStr, eventId);

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
      const { error: updateError } = await supabaseAdmin
        .from('event_registrations')
        .update({
          payment_amount_cents: 0,
          payment_required: false
        })
        .in('id', createdRegistrationIds);

      if (updateError) {
        console.error('Error updating free event registrations:', updateError);
        return json({ error: 'Failed to update registrations' }, { status: 500 });
      }

      // Delete incomplete registration record (registration complete for free event)
      await deleteIncompleteRegistration(supabaseServer, familyIdStr, eventId);

      // Free event - registration is complete
      return json({
        success: true,
        paymentRequired: false,
        registrationId,
        message: 'Registration completed successfully!',
        familyId: familyIdStr,
        studentIds: studentIdsForPayment
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

  // Check if event has required waivers
  const { data: eventWaivers } = await supabaseServer
    .from('event_waivers')
    .select(`
      waiver_id,
      waivers(
        id,
        title,
        content
      )
    `)
    .eq('event_id', eventId)
    .eq('is_required', true);

  const requiredWaivers = (eventWaivers || [])
    .map((entry) => (Array.isArray(entry.waivers) ? entry.waivers[0] : entry.waivers))
    .filter(Boolean);
  const hasRequiredWaivers = requiredWaivers.length > 0;
  const selfRegistrationAllowed = Boolean(event.allow_self_participants);

  // Get studentIds from URL (if coming from waiver flow)
  const url = new URL(request.url);
  const studentIdsParam = url.searchParams.get('studentIds');

  // Preserve existing waiver-flow gating for non-self flows.
  if (hasRequiredWaivers && !studentIdsParam && !selfRegistrationAllowed) {
    throw redirect(`/events/${eventId}/register/students`);
  }

  // If studentIds provided, validate waiver coverage
  if (hasRequiredWaivers && studentIdsParam) {
    const studentIds = studentIdsParam.split(',');

    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    if (!profile?.family_id) {
      throw new Response('Family profile not found', { status: 404 });
    }

    const { data: signatures } = await supabaseServer
      .from('waiver_signatures')
      .select('student_ids, waiver_id')
      .eq('user_id', user.id)
      .in('waiver_id', requiredWaivers.map((waiver) => waiver.id));

    const allStudentsCovered = studentIds.every(studentId =>
      signatures?.some(sig => sig.student_ids && sig.student_ids.includes(studentId))
    );

    if (!allStudentsCovered) {
      throw redirect(`/events/${eventId}/register/students?error=waivers_not_signed`);
    }
  }

  let familyData = undefined;
  let isAuthenticated = false;
  let hasExistingStudents = false;
  let profileInfo: { firstName: string; lastName: string; email: string } | undefined;
  let existingSelfStudentId: string | undefined;
  let familyType: Database['public']['Tables']['families']['Row']['family_type'] | undefined;

  if (user) {
    isAuthenticated = true;

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
            .filter(student => !registeredStudentIds.has(student.id) && student.birth_date)
            .map(student => ({
              id: student.id,
              firstName: student.first_name,
              lastName: student.last_name,
              dateOfBirth: student.birth_date!,
              beltRank: 'White'
            }))
        };
      }
    }

    if (selfRegistrationAllowed) {
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

  // Check existing waiver signatures for status display in self flows.
  let signedWaiverIds: string[] = [];
  if (user && requiredWaivers.length > 0) {
    const { data: signatures } = await supabaseServer
      .from('waiver_signatures')
      .select('waiver_id')
      .eq('user_id', user.id)
      .in('waiver_id', requiredWaivers.map((waiver) => waiver.id));

    signedWaiverIds = signatures?.map((s) => s.waiver_id) || [];
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
  const addStudentUrl = `/family/add-student?returnTo=${encodeURIComponent(redirectTo)}`;
  const requiresStudentProfile = !hasExistingStudents && !selfRegistrationAllowed;

  // Get preselected student IDs from URL (from waiver flow)
  const preSelectedStudentIds = studentIdsParam ? studentIdsParam.split(',') : undefined;

  return json({
    event: serializedEvent,
    isAuthenticated,
    familyData,
    requiredWaivers,
    signedWaiverIds,
    selfRegistrationAllowed,
    profileInfo,
    existingSelfStudentId,
    familyType,
    requiresStudentProfile,
    addStudentUrl,
    preSelectedStudentIds
  });
}

export default function EventRegistration() {
  const {
    event: serializedEvent,
    isAuthenticated,
    familyData,
    requiredWaivers,
    signedWaiverIds,
    selfRegistrationAllowed,
    profileInfo,
    existingSelfStudentId,
    familyType,
    requiresStudentProfile,
    addStudentUrl,
    preSelectedStudentIds,
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
        {/* Breadcrumb Navigation */}
        <div className="mb-8">
          <AppBreadcrumb items={breadcrumbPatterns.eventRegister(event.title, event.id)} />
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
                    {isPositive(event.registration_fee) && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">{formatMoney(event.registration_fee, { trimTrailingZeros: true })}</span>
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
                  preSelectedStudentIds={preSelectedStudentIds}
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

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-semibold text-red-600">Something went wrong</h2>
      <p className="text-gray-600 mt-2">Please refresh the page or contact support.</p>
      {error instanceof Error ? (
        <p className="text-sm text-gray-500 mt-4">{error.message}</p>
      ) : null}
    </div>
  );
}
