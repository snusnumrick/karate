import { json, type LoaderFunctionArgs } from "@vercel/remix";
import {Outlet, useLoaderData, useLocation, useNavigate, useRevalidator} from "@remix-run/react";
import * as React from "react";
import { createBrowserClient, type SupabaseClient } from "@supabase/auth-helpers-remix";
import PublicNavbar from "~/components/PublicNavbar";
import FamilyNavbar from "~/components/FamilyNavbar";
import AdminNavbar from "~/components/AdminNavbar";
import Footer from "~/components/Footer";
import { getSupabaseServerClient, isUserAdmin } from "~/utils/supabase.server";
import type { Database } from "~/types/database.types";

// Add TypeScript declaration for the global window.__SUPABASE_SINGLETON_CLIENT property
declare global {
    interface Window {
        __SUPABASE_SINGLETON_CLIENT?: SupabaseClient<Database>;
    }
}


// Loader to get the session state AND environment variables for the client
export async function loader({ request }: LoaderFunctionArgs) {
    // IMPORTANT: This ENV object should only contain variables safe for the client
    const { supabaseServer, response: { headers }, ENV } = getSupabaseServerClient(request);
    const { data: { session } } = await supabaseServer.auth.getSession();

    // Check if user is admin if they're logged in
    let isAdmin = false;
    if (session?.user) {
        isAdmin = await isUserAdmin(session.user.id);
    }

    // Return session, ENV, isAdmin status, and headers (important for setting/clearing cookies)
    return json({ session, ENV, isAdmin }, { headers });
}

// --- 1. AuthTokenSender component added here ---
// This component listens for auth changes and sends the token to the service worker.
function AuthTokenSender() {
    React.useEffect(() => {
        if (typeof window === 'undefined' || !window.navigator.serviceWorker) {
            return;
        }

        // Use the singleton client created in the layout
        const supabase = window.__SUPABASE_SINGLETON_CLIENT;
        if (!supabase) return;

        const sendTokenToSw = (token: string | null) => {
            navigator.serviceWorker.ready.then((registration) => {
                if (registration.active) {
                    registration.active.postMessage({
                        type: token ? 'SET_AUTH_TOKEN' : 'CLEAR_AUTH_TOKEN',
                        token: token,
                    });
                }
            });
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
    }, []);

    return null; // This component does not render any UI
}


export default function Layout() {
    const { session: serverSession, ENV, isAdmin } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const location = useLocation();
    const isReceiptPage = location.pathname.startsWith('/family/receipt/');
    const isAdminRoute = location.pathname.startsWith('/admin');
    const isFamilyRoute = location.pathname.startsWith('/family');
    const navigate = useNavigate();


    // State to hold the client-side Supabase instance
    const [supabase, setSupabase] = React.useState<SupabaseClient<Database> | null>(null);

    // Effect to initialize the client-side Supabase client
    React.useEffect(() => {
        // Use createBrowserClient from @supabase/auth-helpers-remix
        const client = createBrowserClient<Database>(
            ENV.SUPABASE_URL!,
            ENV.SUPABASE_ANON_KEY!
        );

        // --- 2. Create a global singleton instance for other components to use ---
        window.__SUPABASE_SINGLETON_CLIENT = client;

        setSupabase(client);
    }, [ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY]);


    // Effect to listen for authentication state changes
    React.useEffect(() => {
        // Ensure supabase client is initialized
        if (!supabase) return;

        // console.log("[Layout Effect] Setting up onAuthStateChange listener.");


        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                // console.log(`[Layout Auth Listener] Event: ${event}`, session); // Log event and session

                // Handle password recovery event
                if (event === 'PASSWORD_RECOVERY') {
                    console.log('[Layout Auth Listener] Password recovery detected, redirecting...');
                    navigate('/reset-password');
                    return;
                }

                // Compare the session from the event with the session loaded from the server
                // Revalidate if the user logs in or out in another tab/window
                if (session?.access_token !== serverSession?.access_token) {
                    // console.log("[Layout Auth Listener] Session changed, revalidating...");
                    // call useRevalidator to re-run loaders
                    revalidator.revalidate();
                }
            }
        );

        // Cleanup function to unsubscribe the listener
        return () => {
            // console.log("[Layout Effect] Unsubscribing from onAuthStateChange.");
            subscription?.unsubscribe();
        };
        // Rerun effect if serverSession or supabase client changes
    }, [serverSession, supabase, revalidator, navigate]);


    const user = serverSession?.user;

    // Determine which navbar to render based on route and user status
    const renderNavbar = () => {
        if (isAdminRoute && user && isAdmin) {
            return <AdminNavbar />;
        } else if (isFamilyRoute && user && !isAdmin) {
            return <FamilyNavbar />;
        } else {
            // Public navbar for home page, classes, about, etc.
            return <PublicNavbar user={user} isAdmin={isAdmin} />;
        }
    };

    return (
        <div className="flex flex-col min-h-screen text-gray-900 dark:text-white">
            {/* Conditionally add print:hidden class to the Navbar */}
            <div className={isReceiptPage ? 'print:hidden' : ''}>
                {renderNavbar()}
            </div>
            <main className="flex-grow pb-16 sm:pb-2">
                <Outlet/>
            </main>
            {/* Conditionally add print:hidden class to the Footer */}
            <div className={isReceiptPage ? 'print:hidden' : ''}>
                <Footer user={user}/>
            </div>

            {/* --- 3. Render the AuthTokenSender component --- */}
            <AuthTokenSender />
        </div>
    );
}