import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useActionData, Form, Link, useNavigation } from '@remix-run/react';
import { getOptionalUser } from '~/utils/auth.server';
import { getSupabaseAdminClient } from '~/utils/supabase.server';
import { getProgramBySlug, getSeminarWithSeries } from '~/services/program.server';
import { createSelfRegistrant, getSelfRegistrantByProfileId } from '~/services/self-registration.server';
import { EnrollmentValidationError, enrollStudent } from '~/services/enrollment.server';
import { isServiceError } from '~/utils/service-errors.server';
import { getFamilyRegistrationWaiverStatus } from '~/services/waiver.server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Separator } from '~/components/ui/separator';
import { AlertCircle, ArrowLeft, Calendar, Clock, Users, CheckCircle, UserPlus } from 'lucide-react';
import { calculateTaxesForPayment } from '~/services/tax-rates.server';
import { addMoney, isPositive, toCents, ZERO_MONEY, fromCents } from '~/utils/money';
import { formatDate } from '~/utils/misc';
import {
  buildEnrollmentPendingPaymentNotes,
  buildSeminarPaymentMarker,
  buildSeminarPaymentNotes,
  extractSeminarPendingPaymentId,
} from '~/utils/seminar-payment-notes';
import { getSeminarSeriesRegistrationAvailability } from '~/utils/seminar-registration';
import { useState, type ReactNode } from 'react';

export {
  buildEnrollmentPendingPaymentNotes,
  buildSeminarPaymentMarker,
  buildSeminarPaymentNotes,
  buildSeminarPendingPaymentMarker,
  extractSeminarPendingPaymentId,
} from '~/utils/seminar-payment-notes';

type RegistrationType = 'self' | 'student';
type SeminarAudienceScope = 'youth' | 'adults' | 'mixed' | null | undefined;
type RegistrationWaiverSummary = { id: string; title: string };

export function seminarSupportsAdultRegistration(audienceScope: SeminarAudienceScope) {
  return audienceScope === 'adults' || audienceScope === 'mixed';
}

export function getDefaultSeminarRegistrationType({
  audienceScope,
  hasSelfRegistrant,
  hasStudents,
}: {
  audienceScope: SeminarAudienceScope;
  hasSelfRegistrant: boolean;
  hasStudents: boolean;
}): RegistrationType {
  if (!seminarSupportsAdultRegistration(audienceScope)) {
    return 'student';
  }

  if (hasSelfRegistrant) {
    return 'self';
  }

  return hasStudents ? 'student' : 'self';
}

export function shouldShowSeminarRegistrationTypeSelector({
  audienceScope,
  hasStudents,
}: {
  audienceScope: SeminarAudienceScope;
  hasStudents: boolean;
}) {
  return hasStudents && seminarSupportsAdultRegistration(audienceScope);
}

export function shouldRequireStudentProfileForSeminar({
  audienceScope,
  hasStudents,
}: {
  audienceScope: SeminarAudienceScope;
  hasStudents: boolean;
}) {
  return !hasStudents && !seminarSupportsAdultRegistration(audienceScope);
}

export function shouldShowAddStudentCtaForSeminar({
  audienceScope,
  hasStudents,
  hasFamilyProfile,
}: {
  audienceScope: SeminarAudienceScope;
  hasStudents: boolean;
  hasFamilyProfile: boolean;
}) {
  return hasFamilyProfile && !hasStudents && audienceScope !== 'adults';
}

export function buildSeminarWaiverSignHref({
  waiverId,
  returnTo,
}: {
  waiverId: string;
  returnTo: string;
}) {
  return `/family/waivers/${waiverId}/sign?redirectTo=${encodeURIComponent(returnTo)}`;
}

function paymentMatchesSeminarContext({
  notes,
  seriesId,
  studentId,
}: {
  notes?: string | null;
  seriesId: string;
  studentId: string;
}) {
  if (!notes) {
    return false;
  }

  return notes.includes(buildSeminarPaymentMarker({ seriesId, studentId }));
}

async function findPendingPaymentById({
  paymentId,
  familyId,
  supabase,
}: {
  paymentId: string;
  familyId: string;
  supabase: Pick<ReturnType<typeof getSupabaseAdminClient>, 'from'>;
}) {
  const { data: payment } = await supabase
    .from('payments')
    .select('id, notes')
    .eq('id', paymentId)
    .eq('family_id', familyId)
    .eq('type', 'individual_session')
    .eq('status', 'pending')
    .maybeSingle();

  return payment ?? null;
}

async function findExistingPendingSeminarPayment({
  familyId,
  studentId,
  seriesId,
  enrollmentCreatedAt,
  expectedTotalCents,
  supabase,
}: {
  familyId: string;
  studentId: string;
  seriesId: string;
  enrollmentCreatedAt: string;
  expectedTotalCents: number;
  supabase: Pick<ReturnType<typeof getSupabaseAdminClient>, 'from'>;
}) {
  const { data: pendingPayments } = await supabase
    .from('payments')
    .select('id, created_at, notes, total_amount, payment_students(student_id)')
    .eq('family_id', familyId)
    .eq('type', 'individual_session')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!pendingPayments || pendingPayments.length === 0) {
    return null;
  }

  const exactNoteMatch = pendingPayments.find((payment) =>
    paymentMatchesSeminarContext({
      notes: payment.notes,
      seriesId,
      studentId,
    }),
  );

  if (exactNoteMatch) {
    return exactNoteMatch;
  }

  const matchingTotalPayments = pendingPayments.filter((payment) => payment.total_amount === expectedTotalCents);
  const studentLinkedPayments = matchingTotalPayments.filter((payment) =>
    payment.payment_students?.some((paymentStudent) => paymentStudent.student_id === studentId),
  );

  if (studentLinkedPayments.length === 1) {
    return studentLinkedPayments[0];
  }

  const enrollmentCreatedAtTime = new Date(enrollmentCreatedAt).getTime();
  const legacyCandidates = matchingTotalPayments.filter((payment) => {
    if (!payment.created_at) {
      return false;
    }

    if (payment.payment_students && payment.payment_students.length > 0) {
      return false;
    }

    return new Date(payment.created_at).getTime() >= enrollmentCreatedAtTime;
  });

  if (legacyCandidates.length === 1) {
    return legacyCandidates[0];
  }

  if (matchingTotalPayments.length === 1) {
    return matchingTotalPayments[0];
  }

  if (pendingPayments.length === 1) {
    return pendingPayments[0];
  }

  return null;
}

async function getSeminarRegistrationWaiverState({
  userId,
  familyId,
  supabase,
}: {
  userId: string;
  familyId?: string | null;
  supabase: Pick<ReturnType<typeof getSupabaseAdminClient>, 'from'>;
}) {
  if (familyId) {
    const waiverStatus = await getFamilyRegistrationWaiverStatus(familyId, supabase as never);
    const signedWaiverIds = waiverStatus.signed_waivers.map((waiver) => waiver.id);
    const requiredWaivers = [...waiverStatus.signed_waivers, ...waiverStatus.missing_waivers]
      .map((waiver) => ({ id: waiver.id, title: waiver.title }))
      .sort((left, right) => left.title.localeCompare(right.title));

    return {
      requiredWaivers,
      signedWaiverIds,
      missingWaivers: waiverStatus.missing_waivers.map((waiver) => ({
        id: waiver.id,
        title: waiver.title,
      })),
    };
  }

  const { data: requiredWaivers } = await supabase
    .from('waivers')
    .select('id, title')
    .eq('required_for_registration', true)
    .eq('is_active', true)
    .order('title');

  const requiredWaiverIds = (requiredWaivers || []).map((waiver) => waiver.id);
  let signedWaiverIds: string[] = [];

  if (requiredWaiverIds.length > 0) {
    const { data: signatures } = await supabase
      .from('waiver_signatures')
      .select('waiver_id')
      .eq('user_id', userId)
      .in('waiver_id', requiredWaiverIds);

    signedWaiverIds = signatures?.map((signature) => signature.waiver_id) || [];
  }

  const missingWaivers = (requiredWaivers || []).filter((waiver) => !signedWaiverIds.includes(waiver.id));

  return {
    requiredWaivers: requiredWaivers || [],
    signedWaiverIds,
    missingWaivers,
  };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const seriesId = url.searchParams.get('seriesId');
  const isWaitlist = url.searchParams.get('waitlist') === 'true';

  if (!seriesId) {
    throw new Response("Series ID required", { status: 400 });
  }

  const { supabaseServer, user, response: { headers } } = await getOptionalUser(request);

  // Get seminar details
  const program = await getProgramBySlug(slug, supabaseServer);

  let seminarData;
  if (!program) {
    seminarData = await getSeminarWithSeries(slug, supabaseServer);
    if (!seminarData) {
      throw new Response("Seminar not found", { status: 404 });
    }
  } else {
    seminarData = await getSeminarWithSeries(program.id, supabaseServer);
  }

  if (!seminarData || seminarData.engagement_type !== 'seminar') {
    throw new Response("Seminar not found", { status: 404 });
  }

  const seminar = seminarData ? serializeSeminarForClient(seminarData) : null;

  // Find the specific series
  const series = seminar?.classes?.find((c: { id: string }) => c.id === seriesId);

  if (!series) {
    throw new Response("Series not found", { status: 404 });
  }
  if (!series.allow_self_enrollment) {
    throw new Response("This seminar series does not allow self-registration.", { status: 403 });
  }
  const registrationAvailability = getSeminarSeriesRegistrationAvailability(series);
  if (isWaitlist) {
    if (!registrationAvailability.canJoinWaitlist) {
      throw new Response("The waitlist is not available for this seminar series.", { status: 403 });
    }
  } else if (!registrationAvailability.canRegister) {
    throw new Response("Registration is not open for this seminar series.", { status: 403 });
  }

  // If not authenticated, redirect to login
  if (!user) {
    const currentUrl = new URL(request.url);
    const redirectTo = `${currentUrl.pathname}${currentUrl.search}`;
    return redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`, { headers });
  }

  // Get user profile and family info
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('family_id, families(family_type)')
    .eq('id', user.id)
    .single();

  // Check if user is a self-registrant
  const selfRegistrant = await getSelfRegistrantByProfileId(user.id, supabaseServer);

  // Get family students if applicable
  let students: Array<{id: string; first_name: string; last_name: string; is_adult: boolean; birth_date: string | null}> = [];
  if (profile?.family_id && profile.families?.family_type === 'household') {
    const { data: familyStudents } = await supabaseServer
      .from('students')
      .select('id, first_name, last_name, is_adult, birth_date')
      .eq('family_id', profile.family_id)
      .order('first_name');
    students = familyStudents || [];
  }

  const currentUrl = `${url.pathname}${url.search}`;
  const waiverState = await getSeminarRegistrationWaiverState({
    userId: user.id,
    familyId: profile?.family_id,
    supabase: supabaseServer,
  });
  const waiverSignLinks = profile?.family_id
    ? waiverState.missingWaivers.map((waiver) => ({
        ...waiver,
        href: buildSeminarWaiverSignHref({
          waiverId: waiver.id,
          returnTo: currentUrl,
        }),
      }))
    : [];
  const addStudentUrl = profile?.family_id
    ? `/family/add-student?returnTo=${encodeURIComponent(currentUrl)}`
    : null;

  return json({
    seminar,
    series,
    user,
    profile,
    selfRegistrant,
    students,
    requiredWaivers: waiverState.requiredWaivers,
    signedWaiverIds: waiverState.signedWaiverIds,
    missingWaivers: waiverState.missingWaivers,
    waiverSignLinks,
    canSignRequiredWaivers: Boolean(profile?.family_id),
    addStudentUrl,
    isWaitlist,
  }, { headers });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { slug } = params;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'register') {
    return handleSeminarRegistration(formData, request);
  }

  throw new Response("Invalid intent", { status: 400 });
}

async function handleSeminarRegistration(formData: FormData, request: Request) {
  const { supabaseServer, user, response: { headers } } = await getOptionalUser(request);
  const supabaseAdmin = getSupabaseAdminClient();

  if (!user) {
    const currentUrl = new URL(request.url);
    const redirectTo = `${currentUrl.pathname}${currentUrl.search}`;
    return redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`, { headers });
  }

  try {
    const seriesId = formData.get('seriesId') as string;
    const registrationType = formData.get('registrationType') as RegistrationType;
    const isWaitlist = formData.get('waitlist') === 'true';

    // Get series and program details before any registration sub-flow can proceed.
    const { data: series } = await supabaseServer
      .from('classes')
      .select('*, programs(*)')
      .eq('id', seriesId)
      .single();

    if (!series) {
      return json({ error: 'Series not found' }, { status: 404 });
    }

    const registrationAvailability = getSeminarSeriesRegistrationAvailability(series);
    if (isWaitlist) {
      if (!registrationAvailability.canJoinWaitlist) {
        return json({ error: 'The waitlist is not available for this seminar series.' }, { status: 400 });
      }
    } else if (!registrationAvailability.canRegister) {
      return json({ error: 'Registration is not open for this seminar series.' }, { status: 400 });
    }

    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();
    const currentUrl = new URL(request.url);
    const returnTo = `${currentUrl.pathname}${currentUrl.search}`;
    const waiverState = await getSeminarRegistrationWaiverState({
      userId: user.id,
      familyId: profile?.family_id,
      supabase: supabaseServer,
    });

    if (waiverState.missingWaivers.length > 0) {
      if (profile?.family_id) {
        return redirect(
          buildSeminarWaiverSignHref({
            waiverId: waiverState.missingWaivers[0].id,
            returnTo,
          }),
          { headers }
        );
      }

      return json(
        {
          error: `Please sign required waivers before registering: ${waiverState.missingWaivers.map((waiver) => waiver.title).join(', ')}`,
        },
        { status: 400 }
      );
    }

    let studentId: string;
    let familyId: string;

    const adultRegistrationAllowed = seminarSupportsAdultRegistration(series.programs?.audience_scope);

    if (registrationType === 'self') {
      if (!adultRegistrationAllowed) {
        return json({ error: 'This seminar series is not available for adult registration' }, { status: 400 });
      }

      if (!series.allow_self_enrollment) {
        return json({ error: 'This seminar series does not allow self-registration.' }, { status: 400 });
      }

      const existingSelfRegistrant = await getSelfRegistrantByProfileId(user.id, supabaseServer);
      if (existingSelfRegistrant) {
        studentId = existingSelfRegistrant.student.id;
        familyId = existingSelfRegistrant.family.id;
      } else {
        // Self-registration flow
        const firstName = formData.get('firstName') as string;
        const lastName = formData.get('lastName') as string;
        const email = formData.get('email') as string;
        const phone = formData.get('phone') as string;
        const emergencyContact = formData.get('emergencyContact') as string;

        if (!firstName || !lastName || !email || !phone) {
          return json({ error: 'All fields are required for self-registration' }, { status: 400 });
        }

        // Create or get self-registrant
        const selfRegistrant = await createSelfRegistrant({
          profileId: user.id,
          firstName,
          lastName,
          email,
          phone,
          emergencyContact,
        }, supabaseAdmin);

        studentId = selfRegistrant.student.id;
        familyId = selfRegistrant.family.id;
      }
    } else if (registrationType === 'student') {
      // Existing student registration
      studentId = formData.get('studentId') as string;

      if (!studentId) {
        return json({ error: 'Student selection is required' }, { status: 400 });
      }

      // Get family ID from profile
      if (!profile?.family_id) {
        return json({ error: 'Family profile is incomplete' }, { status: 400 });
      }

      const { data: student } = await supabaseServer
        .from('students')
        .select('id')
        .eq('id', studentId)
        .eq('family_id', profile.family_id)
        .maybeSingle();

      if (!student) {
        return json({ error: 'Selected student is not available for this family' }, { status: 400 });
      }

      familyId = profile.family_id;
    } else {
      return json({ error: 'Invalid registration type' }, { status: 400 });
    }

    // Calculate pricing: run override → template single_purchase_price → template registration_fee
    const seminarFee = series.price_override_cents
      ? fromCents(series.price_override_cents)
      : series.programs?.single_purchase_price_cents
        ? fromCents(series.programs.single_purchase_price_cents)
        : series.programs?.registration_fee_cents
          ? fromCents(series.programs.registration_fee_cents)
          : ZERO_MONEY;

    const paymentRequired = isPositive(seminarFee);

    const taxCalculation = paymentRequired
      ? await calculateTaxesForPayment({
          subtotalAmount: seminarFee,
          paymentType: 'individual_session',
          studentIds: [studentId],
        })
      : null;
    const paymentTotal = paymentRequired && taxCalculation
      ? addMoney(seminarFee, taxCalculation.totalTaxAmount)
      : ZERO_MONEY;
    const paymentTotalCents = paymentRequired ? toCents(paymentTotal) : 0;

    const { data: existingEnrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id, status, notes, created_at')
      .eq('class_id', seriesId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (existingEnrollment?.status === 'active') {
      return json({ error: 'Student is already enrolled in this class' }, { status: 400 });
    }

    if (existingEnrollment?.status === 'trial') {
      return json({ error: 'Student is already enrolled in this class as a trial' }, { status: 400 });
    }

    if (existingEnrollment?.status === 'waitlist') {
      return json({ error: 'Student is already on the waitlist for this class' }, { status: 400 });
    }

    if (isWaitlist) {
      if (!existingEnrollment) {
        await enrollStudent(
          { student_id: studentId, class_id: seriesId, program_id: series.program_id, status: 'waitlist' },
          supabaseAdmin
        );
      }
      return json({ success: true, paymentRequired: false, waitlisted: true, enrollmentId: existingEnrollment?.id ?? '', message: 'Added to waitlist successfully!' });
    }

    if (existingEnrollment?.status === 'pending_payment' && paymentRequired) {
      const enrollmentPaymentId = extractSeminarPendingPaymentId({
        notes: existingEnrollment.notes,
        seriesId,
        studentId,
      });
      const verifiedPendingPaymentId = enrollmentPaymentId
        ? await findPendingPaymentById({
            paymentId: enrollmentPaymentId,
            familyId,
            supabase: supabaseAdmin,
          })
        : null;

      const existingPendingPayment = verifiedPendingPaymentId
        ? verifiedPendingPaymentId
        : await findExistingPendingSeminarPayment({
          familyId,
          studentId,
          seriesId,
          enrollmentCreatedAt: existingEnrollment.created_at,
          expectedTotalCents: paymentTotalCents,
          supabase: supabaseAdmin,
        });

      if (existingPendingPayment) {
        const updatedPaymentNotes = buildSeminarPaymentNotes({
          existingNotes: existingPendingPayment.notes,
          seriesId,
          studentId,
        });

        if (updatedPaymentNotes !== existingPendingPayment.notes) {
          await supabaseAdmin
            .from('payments')
            .update({ notes: updatedPaymentNotes })
            .eq('id', existingPendingPayment.id);
        }

        const updatedEnrollmentNotes = buildEnrollmentPendingPaymentNotes({
          existingNotes: existingEnrollment.notes,
          paymentId: existingPendingPayment.id,
          seriesId,
          studentId,
        });

        if (updatedEnrollmentNotes !== existingEnrollment.notes) {
          await supabaseAdmin
            .from('enrollments')
            .update({ notes: updatedEnrollmentNotes })
            .eq('id', existingEnrollment.id);
        }

        return redirect(`/pay/${existingPendingPayment.id}`, { headers });
      }
    }

    const enrollment = existingEnrollment?.status === 'pending_payment'
      ? existingEnrollment
      : await enrollStudent(
          {
            student_id: studentId,
            class_id: seriesId,
            program_id: series.program_id,
            status: paymentRequired ? 'pending_payment' : 'active',
          },
          supabaseAdmin
        );

    if (paymentRequired) {
      if (!taxCalculation) {
        return json({ error: 'Failed to calculate seminar taxes' }, { status: 500 });
      }

      // Create payment record
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert({
          family_id: familyId,
          subtotal_amount: toCents(seminarFee),
          total_amount: paymentTotalCents,
          type: 'individual_session',
          status: 'pending',
          notes: buildSeminarPaymentNotes({
            seriesId,
            studentId,
          }),
        })
        .select('id')
        .single();

      if (paymentError) {
        console.error('Error creating payment:', paymentError);
        return json({ error: 'Failed to create payment record' }, { status: 500 });
      }

      // Create payment_taxes records
      if (taxCalculation.paymentTaxes.length > 0) {
        const paymentTaxes = taxCalculation.paymentTaxes.map(tax => ({
          payment_id: payment.id,
          tax_rate_id: tax.tax_rate_id,
          tax_amount: toCents(tax.tax_amount),
          tax_name_snapshot: tax.tax_name_snapshot,
          tax_rate_snapshot: tax.tax_rate_snapshot,
        }));

        await supabaseAdmin.from('payment_taxes').insert(paymentTaxes);
      }

      const { error: paymentStudentError } = await supabaseAdmin
        .from('payment_students')
        .insert({
          payment_id: payment.id,
          student_id: studentId,
        });

      if (paymentStudentError) {
        console.error('Error linking seminar payment to student:', paymentStudentError);
        await supabaseAdmin.from('payments').delete().eq('id', payment.id);
        return json({ error: 'Failed to link payment to the student' }, { status: 500 });
      }

      const enrollmentNotes = buildEnrollmentPendingPaymentNotes({
        existingNotes: existingEnrollment?.notes ?? null,
        paymentId: payment.id,
        seriesId,
        studentId,
      });

      await supabaseAdmin
        .from('enrollments')
        .update({ notes: enrollmentNotes })
        .eq('id', enrollment.id);

      return redirect(`/pay/${payment.id}`, { headers });
    } else {
      // Free seminar - activate enrollment
      await supabaseAdmin
        .from('enrollments')
        .update({ status: 'active' })
        .eq('id', enrollment.id);

      return json({
        success: true,
        paymentRequired: false,
        enrollmentId: enrollment.id,
        message: 'Registration completed successfully!',
      });
    }
  } catch (error) {
    if (error instanceof EnrollmentValidationError) {
      const firstValidationMessage = error.validation.errors[0] || 'Enrollment validation failed';
      return json({ error: firstValidationMessage }, { status: 400 });
    }
    if (isServiceError(error)) {
      return json({ error: error.message }, { status: error.status });
    }
    console.error('Registration error:', error);
    return json({ error: 'Failed to process registration' }, { status: 500 });
  }
}

export default function SeminarRegister() {
  const {
    seminar,
    series,
    selfRegistrant,
    students,
    missingWaivers,
    waiverSignLinks,
    canSignRequiredWaivers,
    addStudentUrl,
    isWaitlist,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const registrationTypeSelectorVisible = shouldShowSeminarRegistrationTypeSelector({
    audienceScope: seminar?.audience_scope,
    hasStudents: students.length > 0,
  });

  const [registrationType, setRegistrationType] = useState<RegistrationType>(() =>
    getDefaultSeminarRegistrationType({
      audienceScope: seminar?.audience_scope,
      hasSelfRegistrant: Boolean(selfRegistrant),
      hasStudents: students.length > 0,
    })
  );
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const hasAllRequiredWaivers = missingWaivers.length === 0;
  const requiresStudentProfile = shouldRequireStudentProfileForSeminar({
    audienceScope: seminar?.audience_scope,
    hasStudents: students.length > 0,
  });
  const showAddStudentCta = shouldShowAddStudentCtaForSeminar({
    audienceScope: seminar?.audience_scope,
    hasStudents: students.length > 0,
    hasFamilyProfile: Boolean(addStudentUrl),
  });

  const seminarFee = series?.price_override_cents
    ? fromCents(series.price_override_cents)
    : seminar?.single_purchase_price_cents
      ? fromCents(seminar.single_purchase_price_cents)
      : seminar?.registration_fee_cents
        ? fromCents(seminar.registration_fee_cents)
        : ZERO_MONEY;
  const registrationAvailability = getSeminarSeriesRegistrationAvailability(series);

  const showSuccess = actionData && 'success' in actionData && actionData.success && 'paymentRequired' in actionData && !actionData.paymentRequired;
  const seminarDetailHref = seminar ? `/curriculum/seminars/${seminar.slug || seminar.id}` : '/curriculum';

  const isWaitlistSuccess = actionData && 'waitlisted' in actionData && actionData.waitlisted;

  if (showSuccess) {
    return (
      <div className="min-h-screen page-background-styles py-12 text-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="page-card-styles !bg-white dark:!bg-gray-700 dark:!border-gray-600 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="page-header-styles mb-4">
              {isWaitlistSuccess ? 'Added to Waitlist' : 'Registration Successful'}
            </h2>
            <p className="page-subheader-styles">
              {isWaitlistSuccess
                ? `You are on the waitlist for ${series.name}. We will contact you if a spot opens up.`
                : `You're registered for ${series.name}. You can head back to your dashboard whenever you're ready.`}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">
                <Link to="/family">Go to Dashboard</Link>
              </Button>
              <Button asChild variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-green-900/30">
                <Link to={seminarDetailHref}>Back to Seminar Details</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!seminar) {
    return (
      <div className="min-h-screen page-background-styles py-12 text-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="page-card-styles !bg-white dark:!bg-gray-700 dark:!border-gray-600 text-center">
            <h1 className="page-header-styles mb-4">Seminar not found</h1>
            <p className="page-subheader-styles">
              We couldn&apos;t load this seminar registration page.
            </p>
            <div className="mt-8">
              <Button asChild className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">
                <Link to="/curriculum">Back to Curriculum</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-background-styles py-12 text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          to={seminarDetailHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-green-600 transition-colors hover:text-green-700 hover:underline dark:text-green-400 dark:hover:text-green-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Seminar Details
        </Link>

        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-green-600 dark:text-green-400">
            Seminar Registration
          </p>
          <h1 className="page-header-styles mt-3">{seminar.name}</h1>
          <p className="page-subheader-styles">
            {series.name} • Review your registration path, confirm waivers, and complete sign-up.
          </p>
        </div>

        <section className="page-card-styles !bg-white dark:!bg-gray-700 dark:!border-gray-600 mb-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-amber-50 p-5 dark:border-gray-600 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Series</p>
              <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{series.name}</p>
            </div>
            {series.series_start_on && series.series_end_on && (
              <div className="rounded-2xl border border-gray-200 bg-amber-50 p-5 dark:border-gray-600 dark:bg-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">Dates</p>
                <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {formatSeminarDateRange(series.series_start_on, series.series_end_on)}
                </p>
              </div>
            )}
            <div className="rounded-2xl border border-gray-200 bg-amber-50 p-5 dark:border-gray-600 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Fee</p>
              <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                {isPositive(seminarFee) ? seminarFee.toFormat() : 'Free'}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-amber-50 p-5 dark:border-gray-600 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Registration</p>
              <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                {registrationAvailability.canJoinWaitlist
                  ? 'Online waitlist available'
                  : registrationAvailability.canRegister
                    ? 'Online sign-up open'
                    : 'Registration not open'}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1.45fr,0.9fr]">
          <Card className="form-container-styles border-gray-200/80 backdrop-blur-lg dark:border-gray-600/80">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400">
                Registration Information
              </CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                Complete the form below to register for this seminar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showAddStudentCta && addStudentUrl && (
                <Alert className="mb-6 border-green-200 bg-green-100 dark:border-green-700 dark:bg-green-900/30">
                  <AlertTitle className="text-lg font-semibold">
                    {requiresStudentProfile ? 'Add a student before registering' : 'Need to register a child?'}
                  </AlertTitle>
                  <AlertDescription className="mt-2 space-y-4 text-sm text-muted-foreground">
                    <p>
                      {requiresStudentProfile
                        ? 'This seminar requires a student profile. Add a student now and we’ll bring you right back to complete registration.'
                        : 'You can register yourself for this seminar, or add a student now if you need to register a child.'}
                    </p>
                    <div>
                      <Button asChild className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">
                        <Link to={addStudentUrl}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add a student
                        </Link>
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {isWaitlist && (
                <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                  <AlertTitle className="text-amber-800 dark:text-amber-200">Joining Waitlist</AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-300">
                    This series is full. Complete the form below to join the waitlist. We will contact you if a spot becomes available.
                  </AlertDescription>
                </Alert>
              )}

              <Form method="post">
                <input type="hidden" name="intent" value="register" />
                <input type="hidden" name="seriesId" value={series.id} />
                <input type="hidden" name="registrationType" value={registrationType} />
                {isWaitlist && <input type="hidden" name="waitlist" value="true" />}

                {/* Registration Type Selection */}
                {registrationTypeSelectorVisible && (
                  <div className="mb-6">
                    <Label className="mb-3 block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Who is registering?
                    </Label>
                    <RadioGroup value={registrationType} onValueChange={(value) => setRegistrationType(value as RegistrationType)}>
                      <div className="rounded-xl border border-gray-200 bg-amber-50 p-4 mb-3 dark:border-gray-600 dark:bg-gray-800">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="student" id="student" />
                          <Label htmlFor="student" className="font-normal text-gray-900 dark:text-white">
                            Existing family member
                          </Label>
                        </div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-amber-50 p-4 dark:border-gray-600 dark:bg-gray-800">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="self" id="self" />
                          <Label htmlFor="self" className="font-normal text-gray-900 dark:text-white">
                            Myself (adult registration)
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Student Selection */}
                {registrationType === 'student' && students.length > 0 && (
                  <div className="mb-6">
                    <Label htmlFor="studentId" className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                      Select Student
                    </Label>
                    <select
                      id="studentId"
                      name="studentId"
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="input-custom-styles w-full mt-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      required
                    >
                      <option value="">Select a student...</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.first_name} {student.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Self Registration Form */}
                {registrationType === 'self' && !selfRegistrant && (
                  <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName" className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">First Name *</Label>
                        <Input id="firstName" name="firstName" required className="input-custom-styles mt-2 rounded-xl border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800" />
                      </div>
                      <div>
                        <Label htmlFor="lastName" className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">Last Name *</Label>
                        <Input id="lastName" name="lastName" required className="input-custom-styles mt-2 rounded-xl border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email" className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">Email *</Label>
                      <Input id="email" name="email" type="email" required className="input-custom-styles mt-2 rounded-xl border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800" />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">Phone *</Label>
                      <Input id="phone" name="phone" type="tel" required className="input-custom-styles mt-2 rounded-xl border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800" />
                    </div>
                    <div>
                      <Label htmlFor="emergencyContact" className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">Emergency Contact (Optional)</Label>
                      <Input id="emergencyContact" name="emergencyContact" className="input-custom-styles mt-2 rounded-xl border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800" />
                    </div>
                  </div>
                )}

                {selfRegistrant && registrationType === 'self' && (
                  <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10">
                    <AlertDescription>
                      Registering as: {selfRegistrant.student.first_name} {selfRegistrant.student.last_name}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="mb-6">
                  <Separator className="my-4" />
                  {hasAllRequiredWaivers ? (
                    <Alert>
                      <AlertDescription>
                        All required waivers are signed. You can complete registration now.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <AlertDescription className="space-y-3">
                        <p>
                          Please sign the required waivers before registering: {missingWaivers.map((waiver: RegistrationWaiverSummary) => waiver.title).join(', ')}.
                        </p>
                        {waiverSignLinks.length > 0 ? (
                          <>
                            <div className="flex flex-wrap gap-3">
                              {waiverSignLinks.map((waiver) => (
                                <Link key={waiver.id} className="underline font-medium" to={waiver.href}>
                                  Sign {waiver.title}
                                </Link>
                              ))}
                              <Link className="underline" to="/family/waivers">
                                Review all waivers
                              </Link>
                            </div>
                            <p className="text-sm">
                              After signing, you&apos;ll return here to finish registration.
                            </p>
                          </>
                        ) : canSignRequiredWaivers ? (
                          <Link className="underline font-medium" to="/family/waivers">
                            Review waivers
                          </Link>
                        ) : (
                          <p className="text-sm">
                            Required waivers must be signed from an existing family profile before registration can continue.
                          </p>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Error Display */}
                {actionData && 'error' in actionData && actionData.error && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{actionData.error}</AlertDescription>
                  </Alert>
                )}

                {/* Submit Button */}
                {requiresStudentProfile && addStudentUrl ? (
                  <Button asChild className="w-full font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">
                    <Link to={addStudentUrl}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add a Student to Continue
                    </Link>
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                    disabled={isSubmitting || !hasAllRequiredWaivers}
                  >
                    {isSubmitting ? 'Processing...' : isPositive(seminarFee) ? 'Continue to Payment' : 'Complete Registration'}
                  </Button>
                )}
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="page-card-styles !bg-white dark:!bg-gray-700 dark:!border-gray-600 lg:sticky lg:top-6">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-600 dark:text-green-400">
                    Seminar Summary
                  </p>
                  <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                    {series.name}
                  </h2>
                </div>
                <div className="rounded-full bg-green-600 px-3 py-1 text-sm font-semibold text-white dark:bg-green-400 dark:text-gray-900">
                  {registrationAvailability.canJoinWaitlist
                    ? 'Waitlist'
                    : registrationAvailability.canRegister
                      ? 'Open'
                      : 'Closed'}
                </div>
              </div>

              <div className="space-y-4">
                <SummaryRow
                  label="Series"
                  value={series.name}
                />
                {series.series_start_on && series.series_end_on && (
                  <SummaryRow
                    label="Duration"
                    value={formatSeminarDateRange(series.series_start_on, series.series_end_on)}
                    icon={<Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />}
                  />
                )}
                {series.series_session_quota && (
                  <SummaryRow
                    label="Sessions"
                    value={`${series.series_session_quota} sessions`}
                    icon={<Clock className="h-4 w-4 text-green-600 dark:text-green-400" />}
                  />
                )}
                {(series.min_capacity != null || series.max_capacity != null) && (
                  <SummaryRow
                    label="Capacity"
                    value={formatSeminarCapacity(series.min_capacity, series.max_capacity)}
                    icon={<Users className="h-4 w-4 text-green-600 dark:text-green-400" />}
                  />
                )}
                {series.session_duration_minutes && (
                  <SummaryRow
                    label="Session Length"
                    value={`${series.session_duration_minutes} minutes`}
                    icon={<Clock className="h-4 w-4 text-green-600 dark:text-green-400" />}
                  />
                )}
                {series.sessions_per_week_override && (
                  <SummaryRow
                    label="Weekly Cadence"
                    value={`${series.sessions_per_week_override} sessions per week`}
                    icon={<Clock className="h-4 w-4 text-green-600 dark:text-green-400" />}
                  />
                )}
                {(registrationAvailability.canRegister || registrationAvailability.canJoinWaitlist) && (
                  <SummaryRow
                    label="Registration"
                    value={registrationAvailability.canJoinWaitlist ? 'Waitlist available' : 'Self-registration available'}
                    icon={<Users className="h-4 w-4 text-green-600 dark:text-green-400" />}
                  />
                )}
                {series.on_demand && (
                  <SummaryRow
                    label="Format"
                    value="On-demand access"
                    icon={<Clock className="h-4 w-4 text-green-600 dark:text-green-400" />}
                  />
                )}
                <Separator />
                <div className="rounded-2xl border border-gray-200 bg-amber-50 p-5 dark:border-gray-600 dark:bg-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Fee</p>
                  <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">
                    {isPositive(seminarFee) ? seminarFee.toFormat() : 'Free'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-amber-50 p-4 dark:border-gray-600 dark:bg-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-2 flex items-start gap-2">
        {icon}
        <p className="text-base font-semibold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function formatSeminarDateRange(start: string, end: string) {
  return `${formatDate(start, { formatString: 'MMM d, yyyy' })} - ${formatDate(end, { formatString: 'MMM d, yyyy' })}`;
}

function formatSeminarCapacity(minCapacity?: number | null, maxCapacity?: number | null) {
  if (minCapacity && maxCapacity) {
    return `${minCapacity}-${maxCapacity} participants`;
  }

  if (minCapacity) {
    return `Minimum ${minCapacity} participants`;
  }

  if (maxCapacity) {
    return `Up to ${maxCapacity} participants`;
  }

  return 'Flexible';
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
    ...rest
  } = seminar;

  return {
    ...rest,
    monthly_fee_cents: monthly_fee ? toCents(monthly_fee) : null,
    registration_fee_cents: registration_fee ? toCents(registration_fee) : null,
    yearly_fee_cents: yearly_fee ? toCents(yearly_fee) : null,
    individual_session_fee_cents: individual_session_fee ? toCents(individual_session_fee) : null,
    single_purchase_price_cents: single_purchase_price ? toCents(single_purchase_price) : null,
    subscription_monthly_price_cents: subscription_monthly_price ? toCents(subscription_monthly_price) : null,
    subscription_yearly_price_cents: subscription_yearly_price ? toCents(subscription_yearly_price) : null,
    classes: classes.map((cls) => ({
      ...cls,
      class_sessions: (cls.class_sessions || []).map((session) => ({
        ...session,
        sequence_number: session.sequence_number ?? null,
      })),
    })),
  };
}
