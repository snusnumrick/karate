import {Outlet, useRouteError} from "@remix-run/react";
import {json, type LoaderFunctionArgs, redirect} from "@vercel/remix";
import {getSupabaseServerClient, isUserAdmin} from "~/utils/supabase.server";
import AdminNavbar from "~/components/AdminNavbar";
import AdminFooter from "~/components/AdminFooter";

// This is a pathless layout route that will wrap all routes in the admin directory
export async function loader({request}: LoaderFunctionArgs) {
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();
    const headers = response.headers;

    if (!user) {
        console.warn("Admin layout loader: No user found, redirecting to login.");
        return redirect('/login?redirectTo=/admin', {headers});
    }

    const isAdmin = await isUserAdmin(user.id);

    if (!isAdmin) {
        console.warn(`Admin layout loader: User ${user.id} is not admin, redirecting to /family.`);
        return redirect('/family', {headers});
    }

    // Return necessary data for the layout, or just null/{} if none needed yet
    // Convert headers to plain object for Response
    const headersObj = Object.fromEntries(headers);
    return json({isAdmin: true}, {headers: headersObj});
}

// The actual layout component
export default function AdminLayout() {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
            <AdminNavbar/> {/* Add the Admin Navbar */}
            {/* Main content area with padding */}
            <main className="flex-grow max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
                <Outlet/>
            </main>
            <AdminFooter/> {/* Add the Admin Footer */}
        </div>
    );
}

// Optional: Add back a specific ErrorBoundary for the admin section
export function ErrorBoundary() {
    const error = useRouteError() as Error;
    // Keep this console.error for actual error reporting
    console.error("Error caught in Admin layout ErrorBoundary:", error);

    return (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <h1 className="text-xl font-bold">Admin Section Error</h1>
            <p>{error?.message || "An unknown error occurred."}</p>
            {error?.stack && (
                <pre className="mt-2 p-2 bg-red-50 text-red-900 text-xs overflow-auto">
          {error.stack}
        </pre>
            )}
        </div>
    );
}
