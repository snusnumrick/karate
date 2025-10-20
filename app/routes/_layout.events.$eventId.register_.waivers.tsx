import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { FileText, AlertCircle } from 'lucide-react';

interface Waiver {
  id: string;
  title: string;
  content: string;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { eventId } = params;

  if (!eventId) {
    throw new Response("Event ID is required", { status: 400 });
  }

  const url = new URL(request.url);
  const studentIdsParam = url.searchParams.get('studentIds');

  if (!studentIdsParam) {
    // No student IDs provided, redirect back to student selection
    throw redirect(`/events/${eventId}/register/students`);
  }

  const studentIds = studentIdsParam.split(',');

  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    const currentUrl = new URL(request.url);
    throw redirect(`/login?redirectTo=${encodeURIComponent(currentUrl.pathname + currentUrl.search)}`);
  }

  // Verify user's family owns these students
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (!profile?.family_id) {
    throw new Response('Family profile not found', { status: 404 });
  }

  const { data: students } = await supabaseServer
    .from('students')
    .select('id')
    .eq('family_id', profile.family_id)
    .in('id', studentIds);

  if (!students || students.length !== studentIds.length) {
    throw new Response('Invalid student IDs', { status: 400 });
  }

  // Get event details
  const { data: event } = await supabaseServer
    .from('events')
    .select('title')
    .eq('id', eventId)
    .single();

  if (!event) {
    throw new Response("Event not found", { status: 404 });
  }

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

  const requiredWaivers = eventWaivers?.map(ew => ew.waivers).filter(Boolean) as Waiver[] || [];

  // Check which waivers are already signed
  if (requiredWaivers.length > 0) {
    const { data: signatures } = await supabaseServer
      .from('waiver_signatures')
      .select('waiver_id')
      .eq('user_id', user.id)
      .in('waiver_id', requiredWaivers.map(w => w.id));

    const signedWaiverIds = signatures?.map(s => s.waiver_id) || [];
    const missingWaivers = requiredWaivers.filter(w => !signedWaiverIds.includes(w.id));

    // If all waivers are signed, redirect to registration with studentIds
    if (missingWaivers.length === 0) {
      throw redirect(`/events/${eventId}/register?studentIds=${studentIdsParam}`);
    }

    return json({
      eventId,
      eventTitle: event.title,
      missingWaivers,
      studentIds: studentIdsParam
    });
  }

  // No required waivers, redirect to registration with studentIds
  throw redirect(`/events/${eventId}/register?studentIds=${studentIdsParam}`);
}

export default function EventRegistrationWaivers() {
  const { eventId, eventTitle, missingWaivers, studentIds } = useLoaderData<typeof loader>();

  // Always show the first missing waiver (loader filters out signed ones)
  const currentWaiver = missingWaivers[0];
  const totalWaivers = missingWaivers.length;

  return (
    <div className="min-h-screen page-background-styles py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-8">
          <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <Link to="/" className="hover:text-green-600 dark:hover:text-green-400">Home</Link>
            <span>/</span>
            <Link to={`/events/${eventId}`} className="hover:text-green-600 dark:hover:text-green-400">Event Details</Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">Required Waivers</span>
          </nav>
        </div>

        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="page-header-styles text-3xl font-extrabold sm:text-4xl mb-4">
            Required Waivers
          </h1>
          <p className="page-subheader-styles mt-3 max-w-2xl mx-auto text-xl">
            Please sign all required waivers before registering for {eventTitle}
          </p>
        </div>

        {/* Current Waiver */}
        <Card className="form-container-styles mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {currentWaiver.title}
            </CardTitle>
            <CardDescription>
              {totalWaivers > 1 && `Waiver 1 of ${totalWaivers}`}
              {totalWaivers === 1 && 'Required waiver'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please review and sign this waiver to continue with your registration.
                {totalWaivers > 1 && ` After signing, you'll be asked to sign ${totalWaivers - 1} more waiver${totalWaivers - 1 > 1 ? 's' : ''}.`}
              </AlertDescription>
            </Alert>

            <div className="flex justify-center">
              <Button asChild size="lg">
                <Link
                  to={`/family/waivers/${currentWaiver.id}/sign?eventId=${eventId}&studentIds=${studentIds}&redirectTo=${encodeURIComponent(`/events/${eventId}/register/waivers?studentIds=${studentIds}`)}`}
                >
                  Sign {currentWaiver.title}
                </Link>
              </Button>
            </div>

            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              {totalWaivers === 1
                ? "After signing, you'll continue registration."
                : "After signing, you'll return here to continue."}
            </div>
          </CardContent>
        </Card>

        {/* All Waivers List */}
        {totalWaivers > 1 && (
          <Card className="form-container-styles">
            <CardHeader>
              <CardTitle className="text-base">All Required Waivers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {missingWaivers.map((waiver, index) => (
                  <div
                    key={waiver.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="flex-shrink-0">
                      {index === 0 ? (
                        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <FileText className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${
                        index === 0
                          ? 'text-blue-900 dark:text-blue-100'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {waiver.title}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {index === 0 ? 'Current' : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
