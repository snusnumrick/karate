import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useActionData, Form, useNavigation } from '@remix-run/react';
import { getSupabaseServerClient, getSupabaseAdminClient } from '~/utils/supabase.server';
import { getProgramBySlug, getSeminarWithSeries } from '~/services/program.server';
import { createSelfRegistrant, getSelfRegistrantByProfileId } from '~/services/self-registration.server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Checkbox } from '~/components/ui/checkbox';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Separator } from '~/components/ui/separator';
import { AlertCircle, Calendar, Clock, Users, CheckCircle } from 'lucide-react';
import { calculateTaxesForPayment } from '~/services/tax-rates.server';
import { addMoney, isPositive, toCents, ZERO_MONEY, fromCents } from '~/utils/money';
import { useState } from 'react';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { slug } = params;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const seriesId = url.searchParams.get('seriesId');

  if (!seriesId) {
    throw new Response("Series ID required", { status: 400 });
  }

  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();

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

  // Find the specific series
  const series = seminarData?.classes?.find((c: { id: string }) => c.id === seriesId);
  if (!series) {
    throw new Response("Series not found", { status: 404 });
  }

  // If not authenticated, redirect to login
  if (!user) {
    const currentUrl = new URL(request.url);
    const redirectTo = `${currentUrl.pathname}${currentUrl.search}`;
    return redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
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

  // Get required waivers
  const { data: requiredWaivers } = await supabaseServer
    .from('waivers')
    .select('id, title, content')
    .eq('is_active', true)
    .order('title');

  return json({
    seminar: seminarData,
    series,
    user,
    profile,
    selfRegistrant,
    students,
    requiredWaivers: requiredWaivers || [],
  });
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
  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();
  const supabaseAdmin = getSupabaseAdminClient();

  if (!user) {
    return redirect('/login');
  }

  try {
    const seriesId = formData.get('seriesId') as string;
    const registrationType = formData.get('registrationType') as string;
    const waiverAcknowledged = formData.get('waiverAcknowledged') === 'true';

    if (!waiverAcknowledged) {
      return json({ error: 'You must acknowledge the waiver to register' }, { status: 400 });
    }

    let studentId: string;
    let familyId: string;

    if (registrationType === 'self') {
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
    } else if (registrationType === 'student') {
      // Existing student registration
      studentId = formData.get('studentId') as string;

      if (!studentId) {
        return json({ error: 'Student selection is required' }, { status: 400 });
      }

      // Get family ID from profile
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

      if (!profile?.family_id) {
        return json({ error: 'Family profile is incomplete' }, { status: 400 });
      }

      familyId = profile.family_id;
    } else {
      return json({ error: 'Invalid registration type' }, { status: 400 });
    }

    // Get series and program details for pricing
    const { data: series } = await supabaseServer
      .from('classes')
      .select('*, programs(*)')
      .eq('id', seriesId)
      .single();

    if (!series) {
      return json({ error: 'Series not found' }, { status: 404 });
    }

    // Check if already enrolled
    const { data: existingEnrollment } = await supabaseServer
      .from('enrollments')
      .select('id')
      .eq('class_id', seriesId)
      .eq('student_id', studentId)
      .single();

    if (existingEnrollment) {
      return json({ error: 'Already registered for this seminar series' }, { status: 400 });
    }

    // Calculate pricing
    const seminarFee = series.programs?.single_purchase_price_cents
      ? fromCents(series.programs.single_purchase_price_cents)
      : ZERO_MONEY;

    const paymentRequired = isPositive(seminarFee);

    // Create enrollment
    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from('enrollments')
      .insert({
        student_id: studentId,
        class_id: seriesId,
        program_id: series.program_id,
        status: paymentRequired ? 'waitlist' : 'active', // Waitlist until payment
      })
      .select('id')
      .single();

    if (enrollmentError) {
      console.error('Error creating enrollment:', enrollmentError);
      return json({ error: 'Failed to create enrollment' }, { status: 500 });
    }

    if (paymentRequired) {
      // Calculate taxes
      const taxCalculation = await calculateTaxesForPayment({
        subtotalAmount: seminarFee,
        paymentType: 'individual_session',
        studentIds: [studentId],
      });

      const total = addMoney(seminarFee, taxCalculation.totalTaxAmount);

      // Create payment record
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert({
          family_id: familyId,
          subtotal_amount: toCents(seminarFee),
          total_amount: toCents(total),
          type: 'individual_session',
          status: 'pending',
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

      // Link payment to student (payment is already linked via payment_students table)
      // No need to update enrollment - payment linkage is through payment_students

      return json({
        success: true,
        paymentRequired: true,
        paymentId: payment.id,
        enrollmentId: enrollment.id,
        familyId,
        studentId,
        taxes: taxCalculation.paymentTaxes.map(tax => ({
          taxName: tax.tax_name_snapshot,
          taxAmount: tax.tax_amount,
          taxRate: tax.tax_rate_snapshot,
        })),
        totalTaxAmount: taxCalculation.totalTaxAmount,
      });
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
    console.error('Registration error:', error);
    return json({ error: 'Failed to process registration' }, { status: 500 });
  }
}

export default function SeminarRegister() {
  const { seminar, series, selfRegistrant, students } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [registrationType, setRegistrationType] = useState<'self' | 'student'>(
    selfRegistrant ? 'self' : students.length > 0 ? 'student' : 'self'
  );
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [waiverAcknowledged, setWaiverAcknowledged] = useState(false);

  const seminarFee = seminar?.single_purchase_price_cents
    ? fromCents(seminar.single_purchase_price_cents)
    : ZERO_MONEY;

  const showSuccess = actionData && 'success' in actionData && actionData.success && 'paymentRequired' in actionData && !actionData.paymentRequired;

  if (showSuccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Registration Successful!</h2>
              <p className="text-muted-foreground mb-6">
                You&apos;ve been successfully registered for {series.series_label || series.name}.
              </p>
              <Button asChild>
                <a href="/family">Go to Dashboard</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!seminar) {
    return <div>Seminar not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Register for Seminar</h1>
      <p className="text-muted-foreground mb-6">
        {seminar.name} - {series.series_label || series.name}
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Registration Form */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Registration Information</CardTitle>
              <CardDescription>
                Complete the form below to register for this seminar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post">
                <input type="hidden" name="intent" value="register" />
                <input type="hidden" name="seriesId" value={series.id} />
                <input type="hidden" name="registrationType" value={registrationType} />

                {/* Registration Type Selection */}
                {!selfRegistrant && students.length > 0 && 'audience_scope' in series && series.audience_scope !== 'youth' && (
                  <div className="mb-6">
                    <Label className="mb-3 block">Who is registering?</Label>
                    <RadioGroup value={registrationType} onValueChange={(value) => setRegistrationType(value as 'self' | 'student')}>
                      <div className="flex items-center space-x-2 mb-2">
                        <RadioGroupItem value="student" id="student" />
                        <Label htmlFor="student" className="font-normal">
                          Existing family member
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="self" id="self" />
                        <Label htmlFor="self" className="font-normal">
                          Myself (adult registration)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Student Selection */}
                {registrationType === 'student' && students.length > 0 && (
                  <div className="mb-6">
                    <Label htmlFor="studentId">Select Student</Label>
                    <select
                      id="studentId"
                      name="studentId"
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2"
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
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input id="firstName" name="firstName" required />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input id="lastName" name="lastName" required />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" name="email" type="email" required />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone *</Label>
                      <Input id="phone" name="phone" type="tel" required />
                    </div>
                    <div>
                      <Label htmlFor="emergencyContact">Emergency Contact (Optional)</Label>
                      <Input id="emergencyContact" name="emergencyContact" />
                    </div>
                  </div>
                )}

                {selfRegistrant && registrationType === 'self' && (
                  <Alert className="mb-6">
                    <AlertDescription>
                      Registering as: {selfRegistrant.student.first_name} {selfRegistrant.student.last_name}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Waiver Acknowledgement */}
                <div className="mb-6">
                  <Separator className="my-4" />
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="waiverAcknowledged"
                      name="waiverAcknowledged"
                      checked={waiverAcknowledged}
                      onCheckedChange={(checked) => setWaiverAcknowledged(checked as boolean)}
                      value="true"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="waiverAcknowledged" className="text-sm font-medium">
                        I acknowledge and accept the waiver requirements *
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        By checking this box, you agree to the terms and conditions outlined in the required waivers.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {actionData && 'error' in actionData && actionData.error && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{actionData.error}</AlertDescription>
                  </Alert>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || !waiverAcknowledged}
                >
                  {isSubmitting ? 'Processing...' : isPositive(seminarFee) ? 'Continue to Payment' : 'Complete Registration'}
                </Button>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Seminar Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Seminar Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Series</p>
                <p className="font-medium">{series.series_label || series.name}</p>
              </div>
              {series.series_start_on && series.series_end_on && (
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <p className="text-sm">
                      {new Date(series.series_start_on).toLocaleDateString()} -{' '}
                      {new Date(series.series_end_on).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
              {series.series_session_quota && (
                <div>
                  <p className="text-sm text-muted-foreground">Sessions</p>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <p className="text-sm">{series.series_session_quota} sessions</p>
                  </div>
                </div>
              )}
              {series.min_capacity && series.max_capacity && (
                <div>
                  <p className="text-sm text-muted-foreground">Capacity</p>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <p className="text-sm">
                      {series.min_capacity}-{series.max_capacity} participants
                    </p>
                  </div>
                </div>
              )}
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Total Fee</p>
                <p className="text-2xl font-bold">
                  {isPositive(seminarFee) ? seminarFee.toFormat() : 'Free'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
