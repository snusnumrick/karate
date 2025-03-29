import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link, useParams } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button"; // Assuming Button component exists

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { waiverId } = params;
  if (!waiverId) {
    throw new Response("Waiver ID is required", { status: 400 });
  }

  const { supabaseServer, headers } = getSupabaseServerClient(request);

  // Ensure user is authenticated (as per RLS policy)
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) {
    // Redirect to login, preserving the intended destination
    const url = new URL(request.url);
    return redirect(`/login?redirectTo=${url.pathname}`, { headers });
  }

  // Fetch the specific waiver
  const { data: waiver, error } = await supabaseServer
    .from('waivers')
    .select('*')
    .eq('id', waiverId)
    .single(); // Use .single() as we expect one waiver or none

  if (error || !waiver) {
    // Throw a 404 if waiver not found or error occurs
    console.error("Error fetching waiver:", error);
    throw new Response("Waiver Not Found", { status: 404 });
  }

  return json({ waiver }, { headers });
}

export default function WaiverDetailsPage() {
  const { waiver } = useLoaderData<typeof loader>();
  const params = useParams(); // To get waiverId for the sign link

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Link to="/waivers" className="text-blue-600 hover:underline mb-4 inline-block">
        &larr; Back to Waivers List
      </Link>

      <h1 className="text-3xl font-bold mb-2">{waiver.title}</h1>
      <p className="text-gray-600 mb-6">{waiver.description}</p>

      {waiver.required && (
        <span className="inline-block mb-4 px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
          Required
        </span>
      )}

      {/* Render waiver content - potentially use a markdown renderer if content is markdown */}
      <div className="prose dark:prose-invert max-w-none border rounded-lg p-6 bg-gray-50 dark:bg-gray-800 whitespace-pre-wrap">
        {waiver.content}
      </div>

      <div className="mt-8 flex justify-end">
        {/* TODO: Add logic to hide this button if already signed */}
        <Button asChild>
          <Link to={`/waivers/${params.waiverId}/sign`}>
            Sign Now
          </Link>
        </Button>
      </div>
    </div>
  );
}

// Optional: Add an Error Boundary specific to this route
export function ErrorBoundary() {
  const error = useRouteError();

  // Log the error to the console
  console.error(error);

  // Check if it's a response error (like our 404)
  if (isRouteErrorResponse(error)) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
        <Link to="/waivers" className="text-blue-600 hover:underline mt-4 inline-block">
          &larr; Back to Waivers List
        </Link>
      </div>
    );
  }

  // Generic error for unexpected issues
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 text-center">
      <h1 className="text-2xl font-bold text-red-600 mb-4">An Unexpected Error Occurred</h1>
      <p>We're sorry, something went wrong.</p>
      <Link to="/waivers" className="text-blue-600 hover:underline mt-4 inline-block">
        &larr; Back to Waivers List
      </Link>
    </div>
  );
}

// Helper to check if the error is a Remix route error response
import { isRouteErrorResponse, useRouteError } from "@remix-run/react";
