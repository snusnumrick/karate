import { json, type LoaderFunctionArgs } from "@vercel/remix";
import { Outlet, useLoaderData } from "@remix-run/react";
import { createBrowserClient } from "@supabase/auth-helpers-remix";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { getSiteData } from "~/utils/site-data.server";
import { setSiteData } from "~/utils/site-data.client";
import type { Database } from "~/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as React from "react";

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
            console.warn(`[intro loader] POTENTIAL LOOP DETECTED for ${requestId}: ${existing.timestamps.length} calls in ${timeSinceFirst}ms`);
        }

        console.log(`[intro loader] Call #${existing.count} for ${requestId} (${timeSinceLastCall}ms since last)`);
    } else {
        loaderCalls.set(requestId, { count: 1, lastCall: now, timestamps: [now] });
        console.log(`[intro loader] First call for ${requestId}`);
    }

    const { supabaseServer, response: { headers }, ENV } = getSupabaseServerClient(request);
    const { data: { session } } = await supabaseServer.auth.getSession();

    // Fetch site data for consistent information across all pages
    const siteData = await getSiteData();

    return json({ session, ENV, siteData }, { headers });
}

function AuthTokenSender({ supabase }: { supabase: SupabaseClient<Database> }) {
    React.useEffect(() => {
        const sendTokenToSw = (token: string | null) => {
            if (window.navigator.serviceWorker) {
                navigator.serviceWorker.ready.then((registration) => {
                    if (registration.active) {
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

export default function IntroLayout() {
    const { ENV, siteData } = useLoaderData<typeof loader>();
    
    // Initialize client-side site data cache
    React.useEffect(() => {
        setSiteData(siteData);
    }, [siteData]);

    // Use useMemo to ensure single client instance per environment
    const supabase = React.useMemo<SupabaseClient<Database>>(() => {
        return createBrowserClient<Database, "public">(
            ENV.SUPABASE_URL!,
            ENV.SUPABASE_ANON_KEY!
        ) as unknown as SupabaseClient<Database>;
    }, [ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY]);

    return (
        <div className="min-h-screen text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900">
            <main>
                <Outlet />
            </main>
            <AuthTokenSender supabase={supabase} />
        </div>
    );
}
