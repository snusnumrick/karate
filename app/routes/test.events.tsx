import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);

  // Check what events exist
  const { data: events, error: eventsError } = await supabaseServer
    .from('events')
    .select('*');

  // Check what event types exist
  const { data: eventTypes, error: eventTypesError } = await supabaseServer
    .from('event_types')
    .select('*');

  // Check what students exist
  const { data: students, error: studentsError } = await supabaseServer
    .from('students')
    .select('*');

  // Check what families exist
  const { data: families, error: familiesError } = await supabaseServer
    .from('families')
    .select('*');

  return json({
    events: { data: events, error: eventsError },
    eventTypes: { data: eventTypes, error: eventTypesError },
    students: { data: students, error: studentsError },
    families: { data: families, error: familiesError }
  });
}

export default function TestEvents() {
  const { events, eventTypes, students, families } = useLoaderData<typeof loader>();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Database Test</h1>
      
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Events</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(events, null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Event Types</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(eventTypes, null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Students</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(students, null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Families</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(families, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}