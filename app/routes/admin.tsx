import { Outlet, useRouteError } from "@remix-run/react"; // Import useRouteError
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getSupabaseServerClient, isUserAdmin } from "~/utils/supabase.server";

// This loader protects the entire /admin section
export async function loader({ request }: LoaderFunctionArgs) {
  console.log("Entering /admin loader..."); // Add log
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();
  console.log("Admin loader - User:", user?.id); // Add log

  if (!user) {
    console.log("Admin loader - No user found, redirecting to login."); // Add log
    // Use headers for potential cookie setting by Supabase client
    return redirect('/login?redirectTo=/admin', { headers });
  }

  const isAdmin = await isUserAdmin(user.id);
  console.log(`Admin loader - User ${user.id} isAdmin: ${isAdmin}`); // Add log

  if (!isAdmin) {
    console.log(`Admin loader - User ${user.id} is not admin, redirecting to /family.`); // Add log
    // User is logged in but not an admin, redirect to home or family portal
    // Use headers here too
    return redirect('/family', { headers });
  }

  console.log("Admin loader - User is admin, allowing access."); // Add log
  // User is an admin, allow access to the admin section
  // Return null or necessary layout data, include headers
  return json({ isAdmin: true }, { headers }); // Return some data to confirm loader ran
}

// Temporarily simplified AdminLayout for debugging
export default function AdminLayout() {
  return (
    <>
      <h1 className="text-2xl font-bold text-blue-500 p-4 border-b-2 border-blue-500">ADMIN LAYOUT TEST</h1>
      <Outlet /> {/* Render the child route directly */}
    </>
  );
}

// Enhanced ErrorBoundary specific to the admin layout
export function ErrorBoundary() {
  const error = useRouteError() as { status?: number; data?: { message?: string }; message?: string; statusText?: string };
  console.error("Error caught in AdminLayout ErrorBoundary:", error); // Log the error

  const status = error?.status || 500;
  const errorMessage = error?.data?.message || error?.message || "An unknown error occurred";
  const statusText = error?.statusText || "Error";

   // Create a consistent error object for display
   const errorForDisplay = {
     status: status,
     statusText: statusText,
     internal: (error as any)?.internal,
     data: error?.data,
     message: errorMessage,
     stack: (error as any)?.stack // Include stack in dev
   };

  return (
    <div className="p-4 md:p-8 bg-red-100 border border-red-400 text-red-700 rounded">
      <h1 className="text-2xl font-bold mb-2">Admin Section Error: {status} {statusText}</h1>
      <p className="mb-4">{errorMessage}</p>
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-4 p-4 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs">
          {JSON.stringify(errorForDisplay, null, 2)}
        </pre>
      )}
    </div>
  );
}
