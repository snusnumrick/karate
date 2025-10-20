import { json, type LoaderFunctionArgs } from "@vercel/remix";
import {Outlet, useLoaderData, useLocation, useNavigate, useRevalidator} from "@remix-run/react";
import * as React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "~/utils/supabase.client";
import PublicNavbar from "~/components/PublicNavbar";
import FamilyNavbar from "~/components/FamilyNavbar";
import AdminNavbar from "~/components/AdminNavbar";
import Footer from "~/components/Footer";
import { getSupabaseServerClient, getUserRole } from "~/utils/supabase.server";
import { getSiteData } from "~/utils/site-data.server";
import { setSiteData } from "~/utils/site-data.client";
import type { Database } from "~/types/database.types";
import InstructorNavbar from "~/components/InstructorNavbar";
import { isAdminRole, isInstructorRole, type UserRole } from '~/types/auth';


// Debug: Track loader calls to detect loops
const loaderCalls = new Map<string, { count: number; lastCall: number; timestamps: number[] }>();

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const requestId = `${pathname}${url.search}`;
    const now = Date.now();

    // Track this loader call
    const existing = loaderCalls.get(requestId);
    if (existing) {
        existing.count++;
        existing.timestamps.push(now);
        // Keep only last 10 seconds
        existing.timestamps = existing.timestamps.filter(t => now - t < 10000);

        const timeSinceLastCall = now - existing.lastCall;
        existing.lastCall = now;

        // Detect rapid loader calls (more than 5 in 10 seconds)
        if (existing.timestamps.length > 5) {
            const timeSinceFirst = now - existing.timestamps[0];
            console.warn(`[_layout loader] POTENTIAL LOOP DETECTED for ${requestId}: ${existing.timestamps.length} calls in ${timeSinceFirst}ms`);
        }

        console.log(`[_layout loader] Call #${existing.count} for ${requestId} (${timeSinceLastCall}ms since last)`);
    } else {
        loaderCalls.set(requestId, { count: 1, lastCall: now, timestamps: [now] });
        console.log(`[_layout loader] First call for ${requestId}`);
    }

    const { supabaseServer, response: { headers }, ENV } = getSupabaseServerClient(request);
    const { data: { session } } = await supabaseServer.auth.getSession();
    let userRole: UserRole | null = null;
    if (session?.user) {
        userRole = await getUserRole(session.user.id);
    }
    const isAdmin = isAdminRole(userRole);
    const isInstructor = isInstructorRole(userRole) || isAdmin;

    // Fetch site data for consistent information across all pages
    const siteData = await getSiteData();

    return json({ session, ENV, userRole, isAdmin, isInstructor, siteData }, { headers });
}

// --- 1. MODIFIED: AuthTokenSender now accepts the supabase client as a prop ---
function AuthTokenSender({ supabase }: { supabase: SupabaseClient<Database> | null }) {
    // console.log(`AuthTokenSender render ${supabase}`);
    React.useEffect(() => {
        if (!supabase) return;
        
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
    const { session: serverSession, ENV, userRole, isAdmin, isInstructor, siteData } = useLoaderData<typeof loader>();
    
    // Initialize client-side site data cache
    React.useEffect(() => {
        setSiteData(siteData);
    }, [siteData]);
    const revalidator = useRevalidator();
    const location = useLocation();
    const navigate = useNavigate();
    const isReceiptPage = location.pathname.startsWith('/family/receipt/');
    const isAdminRoute = location.pathname.startsWith('/admin');
    const isInstructorRoute = location.pathname.startsWith('/instructor');
    const isFamilyRoute = location.pathname.startsWith('/family');

    // console.log(`Layout render ${serverSession}`);

    // Use useMemo to ensure single client instance per environment
    const supabase = React.useMemo(() => {
        // Only create client on the browser side
        if (typeof window === 'undefined') {
            return null;
        }
        return getSupabaseClient({
            url: ENV.SUPABASE_URL!,
            anonKey: ENV.SUPABASE_ANON_KEY!,
            accessToken: serverSession?.access_token,
            refreshToken: serverSession?.refresh_token
        });
    }, [ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, serverSession?.access_token, serverSession?.refresh_token]);


    // Use a ref to track the access token without causing effect re-runs
    const lastAccessTokenRef = React.useRef(serverSession?.access_token);

    React.useEffect(() => {
        if (!supabase) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'PASSWORD_RECOVERY') {
                    navigate('/reset-password');
                    return;
                }
                // Compare with the ref value instead of serverSession prop
                if (session?.access_token !== lastAccessTokenRef.current) {
                    lastAccessTokenRef.current = session?.access_token;
                    revalidator.revalidate();
                }
            }
        );

        return () => {
            subscription?.unsubscribe();
        };
    }, [supabase, revalidator, navigate]);


    const user = serverSession?.user;

    const renderNavbar = () => {
        if (isAdminRoute && user && isAdmin) {
            return <AdminNavbar />;
        }
        if (isInstructorRoute && user && (isInstructor || isAdmin)) {
            return <InstructorNavbar />;
        }
        if (isFamilyRoute && user && !isAdmin) {
            return <FamilyNavbar />;
        }
        return <PublicNavbar user={user} isAdmin={isAdmin} userRole={userRole} isInstructor={isInstructor} />;
    };

    // console.log(`Layout render ${supabase}`);
    return (
        <div className="flex flex-col min-h-screen text-gray-900 dark:text-white">
            <div className={isReceiptPage ? 'print:hidden' : ''}>
                {renderNavbar()}
            </div>
            <main className="flex-grow">
                <Outlet context={{ supabase }}/>
            </main>
            <div className={isReceiptPage ? 'print:hidden' : ''}>
                <Footer user={user}/>
            </div>

            {/* --- 2. MODIFIED: Pass the client as a prop --- */}
            <AuthTokenSender supabase={supabase} />
        </div>
    );
}
