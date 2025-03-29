import { Outlet, useRouteError } from "@remix-run/react";
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getSupabaseServerClient, isUserAdmin } from "~/utils/supabase.server";

// Regular layout route for /admin/*
// Loader protects the entire section
export async function loader({ request }: LoaderFunctionArgs) {
  console.log("Entering /_admin layout loader..."); // Updated log
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();
  const headers = response.headers;
  console.log("_Admin layout loader - User:", user?.id); // Updated log

  if (!user) {
    console.log("_Admin layout loader - No user found, redirecting to login."); // Updated log
    return redirect('/login?redirectTo=/admin', { headers });
  }

  const isAdmin = await isUserAdmin(user.id);
  console.log(`_Admin layout loader - User ${user.id} isAdmin: ${isAdmin}`); 
  console.log('Response headers:', Object.fromEntries(headers));
  
  if (!isAdmin) {
    console.log(`_Admin layout loader - User ${user.id} is not admin, redirecting to /family.`); // Updated log
    return redirect('/family', { headers });
  }

  console.log("_Admin layout loader - User is admin, allowing access."); // Updated log
  // Return necessary data for the layout, or just null/{} if none needed yet
  // Convert headers to plain object for Response
  const headersObj = Object.fromEntries(headers);
  console.log('Final headers being sent:', headersObj);
  return json({ isAdmin: true }, { headers: headersObj });
}

// The actual layout component
export default function AdminLayout() {
  console.log("Rendering AdminLayout component"); // Updated log
  // You can add Admin-specific Navbars, sidebars etc. here later
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4"> {/* Added dark mode background */}
      <main className="max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}

// Optional: Add back a specific ErrorBoundary for the admin section
export function ErrorBoundary() {
  const error = useRouteError() as Error;
  console.error("Error caught in _Admin layout ErrorBoundary:", error);

  return (
    <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
      <h1 className="text-xl font-bold">Admin Section Error</h1>
      <p>{error?.message || "An unknown error occurred."}</p>
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-2 p-2 bg-red-50 text-red-900 text-xs overflow-auto">
          {error?.stack}
        </pre>
      )}
    </div>
  );
}
