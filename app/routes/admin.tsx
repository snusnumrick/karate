import { Outlet } from "@remix-run/react";
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getSupabaseServerClient, isUserAdmin } from "~/utils/supabase.server";

// This loader protects the entire /admin section
export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    // Use headers for potential cookie setting by Supabase client
    return redirect('/login?redirectTo=/admin', { headers });
  }

  const isAdmin = await isUserAdmin(user.id);

  if (!isAdmin) {
    // User is logged in but not an admin, redirect to home or family portal
    // Use headers here too
    return redirect('/family', { headers });
  }

  // User is an admin, allow access to the admin section
  // Return null or necessary layout data, include headers
  return json(null, { headers });
}

// Basic layout component for the admin section
export default function AdminLayout() {
  return (
    <div className="admin-layout bg-gray-100 dark:bg-gray-900 min-h-screen">
      {/* You could add an admin-specific Navbar or Sidebar here */}
      {/* <AdminNavbar /> */}
      <main className="p-4 md:p-8">
        <Outlet /> {/* Child routes like admin/_index.tsx will render here */}
      </main>
      {/* You could add an admin-specific Footer here */}
    </div>
  );
}

// Optional: Add an ErrorBoundary specific to the admin layout
export function ErrorBoundary() {
  // ... basic error boundary implementation ...
  return (
    <div>
      <h1>Admin Section Error</h1>
      <p>Something went wrong within the admin area.</p>
      {/* You might want more detailed error display here */}
    </div>
  );
}
