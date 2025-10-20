import React from 'react';
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { Form, useLoaderData, Link } from '@remix-run/react';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { Users, AlertCircle, DollarSign, UserPlus } from 'lucide-react';
import { formatDate } from '~/utils/misc';
import { EventService } from '~/services/event.server';
import { formatMoney, isPositive, multiplyMoney, serializeMoney, deserializeMoney } from '~/utils/money';
import { moneyFromRow } from '~/utils/database-money';

export async function action({ request, params }: ActionFunctionArgs) {
  const { eventId } = params;
  if (!eventId) {
    throw new Response("Event ID is required", { status: 400 });
  }

  const formData = await request.formData();
  const selectedStudentIds = formData.getAll('studentIds') as string[];

  if (selectedStudentIds.length === 0) {
    return json({ error: 'Please select at least one student to register' }, { status: 400 });
  }

  // Redirect to waivers page with selected student IDs
  const studentIdsParam = selectedStudentIds.join(',');
  return redirect(`/events/${eventId}/register/waivers?studentIds=${studentIdsParam}`);
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { eventId } = params;

  if (!eventId) {
    throw new Response("Event ID is required", { status: 400 });
  }

  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    const currentUrl = new URL(request.url);
    throw redirect(`/login?redirectTo=${encodeURIComponent(currentUrl.pathname)}`);
  }

  // Get event details
  const event = await EventService.getEventById(eventId, true);

  if (!event) {
    throw new Response("Event not found", { status: 404 });
  }

  // Get user's family_id
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) {
    throw new Response('Family profile not found', { status: 404 });
  }

  // Get family students
  const { data: students } = await supabaseServer
    .from('students')
    .select('id, first_name, last_name, birth_date')
    .eq('family_id', profile.family_id)
    .order('first_name');

  // Get already registered students for this event
  const { data: registrations } = await supabaseServer
    .from('event_registrations')
    .select('student_id')
    .eq('event_id', eventId)
    .eq('family_id', profile.family_id);

  const registeredStudentIds = registrations?.map(r => r.student_id) || [];

  // Check if event has required waivers
  const { data: eventWaivers } = await supabaseServer
    .from('event_waivers')
    .select('waiver_id')
    .eq('event_id', eventId)
    .eq('is_required', true);

  const hasRequiredWaivers = (eventWaivers?.length || 0) > 0;

  // Check if user has already signed all required waivers
  let allWaiversSigned = false;
  if (hasRequiredWaivers) {
    const waiverIds = eventWaivers?.map(w => w.waiver_id) || [];
    const { data: signatures } = await supabaseServer
      .from('waiver_signatures')
      .select('waiver_id')
      .eq('user_id', user.id)
      .in('waiver_id', waiverIds);

    const signedWaiverIds = signatures?.map(s => s.waiver_id) || [];
    allWaiversSigned = waiverIds.every(id => signedWaiverIds.includes(id));
  }

  // Get error from query params (if redirected back due to error)
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  let errorMessage: string | undefined;

  if (error === 'waiver_mismatch') {
    errorMessage = 'The waiver you signed does not cover the students you are trying to register. Please re-select students and sign again.';
  } else if (error === 'waivers_not_signed') {
    errorMessage = 'You must sign all required waivers before completing registration. Please select students and sign the required waivers.';
  }

  const registrationFee = moneyFromRow('events', 'registration_fee', event as unknown as Record<string, unknown>);

  return json({
    event: {
      id: event.id,
      title: event.title,
      start_date: event.start_date,
      registration_fee: serializeMoney(registrationFee),
    },
    students: students || [],
    registeredStudentIds,
    hasRequiredWaivers,
    allWaiversSigned,
    error: errorMessage,
  });
}

export default function EventStudentSelection() {
  const loaderData = useLoaderData<typeof loader>();
  const { event: serializedEvent, students, registeredStudentIds, hasRequiredWaivers, allWaiversSigned, error } = loaderData;
  const event = {
    ...serializedEvent,
    registration_fee: deserializeMoney(serializedEvent.registration_fee),
  };
  const [selectedStudents, setSelectedStudents] = React.useState<Set<string>>(new Set());

  const availableStudents = students.filter(s => !registeredStudentIds.includes(s.id));
  const registeredStudents = students.filter(s => registeredStudentIds.includes(s.id));

  const handleStudentToggle = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedStudents);
    if (checked) {
      newSelected.add(studentId);
    } else {
      newSelected.delete(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const totalFee = multiplyMoney(event.registration_fee, selectedStudents.size);
  const hasRegistrationFee = isPositive(event.registration_fee);

  const currentUrl = typeof window !== 'undefined' ? window.location.pathname : `/events/${event.id}/register/students`;
  const addStudentUrl = `/family/add-student?redirectTo=${encodeURIComponent(currentUrl)}`;

  return (
    <div className="min-h-screen page-background-styles py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-8">
          <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <Link to="/" className="hover:text-green-600 dark:hover:text-green-400">Home</Link>
            <span>/</span>
            <Link to={`/events/${event.id}`} className="hover:text-green-600 dark:hover:text-green-400">Event Details</Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">Select Students</span>
          </nav>
        </div>

        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="page-header-styles text-3xl font-extrabold sm:text-4xl mb-4">
            Select Students to Register
          </h1>
          <p className="page-subheader-styles mt-3 max-w-2xl mx-auto text-xl">
            Choose which students to register for {event.title}
          </p>
          {event.start_date && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {formatDate(event.start_date, { formatString: 'EEEE, MMMM d, yyyy' })}
            </p>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* No Students Alert */}
        {students.length === 0 && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Students Found</AlertTitle>
            <AlertDescription className="mt-2">
              You need to add at least one student to your profile before registering for events.
            </AlertDescription>
            <div className="mt-4">
              <Button asChild>
                <Link to={addStudentUrl}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Student
                </Link>
              </Button>
            </div>
          </Alert>
        )}

        {/* All Students Registered Alert */}
        {students.length > 0 && availableStudents.length === 0 && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>All Students Already Registered</AlertTitle>
            <AlertDescription>
              All of your students are already registered for this event.
            </AlertDescription>
            <div className="mt-4">
              <Button asChild variant="outline">
                <Link to={`/events/${event.id}`}>Back to Event Details</Link>
              </Button>
            </div>
          </Alert>
        )}

        {/* Student Selection Form */}
        {availableStudents.length > 0 && (
          <Card className="form-container-styles">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Students
              </CardTitle>
              <CardDescription>
                {hasRequiredWaivers && !allWaiversSigned
                  ? 'After selecting students, you\'ll be asked to sign required waivers before completing registration.'
                  : hasRequiredWaivers && allWaiversSigned
                  ? 'You have already signed the required waivers. Select students to complete registration.'
                  : 'Select the students you want to register for this event.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="space-y-6">
                {/* Waivers Already Signed Notice */}
                {hasRequiredWaivers && allWaiversSigned && (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                    <AlertCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-900 dark:text-green-100">
                      ✓ All required waivers have been signed. You can proceed directly to registration.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Available Students */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Available Students</Label>
                  {availableStudents.map((student) => {
                    const age = student.birth_date ? new Date().getFullYear() - new Date(student.birth_date).getFullYear() : 0;
                    return (
                      <div
                        key={student.id}
                        className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <Checkbox
                          id={student.id}
                          name="studentIds"
                          value={student.id}
                          checked={selectedStudents.has(student.id)}
                          onCheckedChange={(checked) => handleStudentToggle(student.id, checked as boolean)}
                        />
                        <Label
                          htmlFor={student.id}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium text-gray-900 dark:text-white">
                            {student.first_name} {student.last_name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Age {age} · Born {student.birth_date ? formatDate(student.birth_date, { formatString: 'MMM d, yyyy' }) : 'Unknown'}
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </div>

                {/* Already Registered Students */}
                {registeredStudents.length > 0 && (
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Already Registered</Label>
                    {registeredStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center space-x-3 p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
                      >
                        <Checkbox checked disabled />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {student.first_name} {student.last_name}
                          </div>
                          <div className="text-sm text-green-600 dark:text-green-400">
                            ✓ Already registered for this event
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Summary */}
                {selectedStudents.size > 0 && (
                  <div className="form-card-styles p-6 rounded-lg border-l-4 border-green-600">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Registration Summary</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''} selected
                        </p>
                      </div>
                      {hasRegistrationFee && (
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            {formatMoney(totalFee, { trimTrailingZeros: true })}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {formatMoney(event.registration_fee, { trimTrailingZeros: true })} × {selectedStudents.size}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Add Student Link */}
                <div className="text-center">
                  <Link
                    to={addStudentUrl}
                    className="text-sm text-green-600 dark:text-green-400 hover:underline inline-flex items-center gap-1"
                  >
                    <UserPlus className="h-4 w-4" />
                    Need to add another student to your profile?
                  </Link>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={selectedStudents.size === 0}
                  >
                    {hasRequiredWaivers && !allWaiversSigned
                      ? 'Continue to Waiver'
                      : 'Continue to Registration'}
                    →
                  </Button>
                </div>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
