import {Outlet, useRouteError, useLoaderData} from "@remix-run/react";
import {json, type LoaderFunctionArgs, redirect} from "@vercel/remix";
import {getSupabaseServerClient, isUserAdmin} from "~/utils/supabase.server";
import AdminNavbar from "~/components/AdminNavbar";
import AdminFooter from "~/components/AdminFooter";
import * as React from "react";
import { createBrowserClient, type SupabaseClient } from "@supabase/auth-helpers-remix";
import type { Database } from "~/types/database.types";

// This is a pathless layout route that will wrap all routes in the admin directory
export async function loader({request}: LoaderFunctionArgs) {
    const {supabaseServer, response, ENV} = getSupabaseServerClient(request);
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

    // Return necessary data for the layout, including ENV for Supabase client
    // Convert headers to plain object for Response
    const headersObj = Object.fromEntries(headers);
    return json({isAdmin: true, ENV}, {headers: headersObj});
}

// AuthTokenSender component for admin routes
function AuthTokenSender({ supabase }: { supabase: SupabaseClient<Database> }) {
    console.log(`Admin AuthTokenSender render ${supabase}`);
    React.useEffect(() => {
        console.log(`Admin AuthTokenSender useEffect ${supabase}`);
        const sendTokenToSw = (token: string | null) => {
            console.log(`Admin AuthTokenSender sendTokenToSw ${token}`);
            if (window.navigator.serviceWorker) {
                console.log(`Admin AuthTokenSender sendTokenToSw navigator.serviceWorker ${token}`);
                navigator.serviceWorker.ready.then((registration) => {
                    console.log(`Admin AuthTokenSender sendTokenToSw navigator.serviceWorker.ready ${token}`);
                    if (registration.active) {
                        console.log(`Admin AuthTokenSender sendTokenToSw navigator.serviceWorker.ready.active ${token}`);
                        registration.active.postMessage({
                            type: token ? 'SET_AUTH_TOKEN' : 'CLEAR_AUTH_TOKEN',
                            token: token,
                        });
                    }
                });
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                sendTokenToSw(session?.access_token ?? null);
            }
        );

        supabase.auth.getSession().then(({ data: { session } }) => {
            sendTokenToSw(session?.access_token ?? null);
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, [supabase]);

    return null;
}

// The actual layout component
export default function AdminLayout() {
    const { ENV } = useLoaderData<typeof loader>();
    const [supabase, setSupabase] = React.useState<SupabaseClient<Database> | null>(null);

    React.useEffect(() => {
        const client = createBrowserClient<Database>(
            ENV.SUPABASE_URL!,
            ENV.SUPABASE_ANON_KEY!
        );
        setSupabase(client);
    }, [ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY]);

    console.log("Entering AdminLayout...");
    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
            <AdminNavbar/> {/* Add the Admin Navbar */}
            {/* Main content area with padding */}
            <main className="flex-grow max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
                <Outlet/>
            </main>
            <AdminFooter/> {/* Add the Admin Footer */}
            
            {/* AuthTokenSender for admin routes */}
            {supabase && <AuthTokenSender supabase={supabase} />}
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
