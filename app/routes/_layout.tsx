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


export async function loader({ request }: LoaderFunctionArgs) {
    const { supabaseServer, response: { headers }, ENV } = getSupabaseServerClient(request);
    const { data: { session } } = await supabaseServer.auth.getSession();
    let isAdmin = false;
    if (session?.user) {
        isAdmin = await isUserAdmin(session.user.id);
    }
    return json({ session, ENV, isAdmin }, { headers });
}

// --- 1. MODIFIED: AuthTokenSender now accepts the supabase client as a prop ---
function AuthTokenSender({ supabase }: { supabase: SupabaseClient<Database> }) {
    // console.log(`AuthTokenSender render ${supabase}`);
    React.useEffect(() => {
        // console.log(`AuthTokenSender useEffect ${supabase}`);
        // We already know supabase exists because of the conditional render below
        const sendTokenToSw = (token: string | null) => {
            // console.log(`AuthTokenSender sendTokenToSw ${token}`);
            if (window.navigator.serviceWorker) {
                // console.log(`AuthTokenSender sendTokenToSw navigator.serviceWorker ${token}`);
                navigator.serviceWorker.ready.then((registration) => {
                    // console.log(`AuthTokenSender sendTokenToSw navigator.serviceWorker.ready ${token}`);
                    if (registration.active) {
                        // console.log(`AuthTokenSender sendTokenToSw navigator.serviceWorker.ready.active ${token}`);
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
        // This effect now correctly depends on the supabase client instance
    }, [supabase]);

    return null;
}


export default function Layout() {
    const { session: serverSession, ENV, isAdmin } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const location = useLocation();
    const navigate = useNavigate();
    const isReceiptPage = location.pathname.startsWith('/family/receipt/');
    const isAdminRoute = location.pathname.startsWith('/admin');
    const isFamilyRoute = location.pathname.startsWith('/family');

    // console.log(`Layout render ${serverSession}`);

    const [supabase, setSupabase] = React.useState<SupabaseClient<Database> | null>(null);

    React.useEffect(() => {
        const client = createBrowserClient<Database>(
            ENV.SUPABASE_URL!,
            ENV.SUPABASE_ANON_KEY!
        );
        setSupabase(client);
    }, [ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY]);


    React.useEffect(() => {
        if (!supabase) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'PASSWORD_RECOVERY') {
                    navigate('/reset-password');
                    return;
                }
                if (session?.access_token !== serverSession?.access_token) {
                    revalidator.revalidate();
                }
            }
        );

        return () => {
            subscription?.unsubscribe();
        };
    }, [serverSession, supabase, revalidator, navigate]);


    const user = serverSession?.user;

    const renderNavbar = () => {
        // ... (renderNavbar function is unchanged) ...
        if (isAdminRoute && user && isAdmin) {
            return <AdminNavbar />;
        } else if (isFamilyRoute && user && !isAdmin) {
            return <FamilyNavbar />;
        } else {
            return <PublicNavbar user={user} isAdmin={isAdmin} />;
        }
    };

    // console.log(`Layout render ${supabase}`);
    return (
        <div className="flex flex-col min-h-screen text-gray-900 dark:text-white">
            <div className={isReceiptPage ? 'print:hidden' : ''}>
                {renderNavbar()}
            </div>
            <main className="flex-grow pb-16 sm:pb-2">
                <Outlet/>
            </main>
            <div className={isReceiptPage ? 'print:hidden' : ''}>
                <Footer user={user}/>
            </div>

            {/* --- 2. MODIFIED: Conditionally render and pass the client as a prop --- */}
            {supabase && <AuthTokenSender supabase={supabase} />}
        </div>
    );
}