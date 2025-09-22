import { json, type LoaderFunctionArgs } from "@vercel/remix";
import { Outlet, useLoaderData } from "@remix-run/react";
import { createBrowserClient } from "@supabase/auth-helpers-remix";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { getSiteData } from "~/utils/site-data.server";
import { setSiteData } from "~/utils/site-data.client";
import type { Database } from "~/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as React from "react";

export async function loader({ request }: LoaderFunctionArgs) {
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
