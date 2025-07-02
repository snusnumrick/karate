import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useLocation, useRevalidator } from "@remix-run/react";
import { useEffect, useState } from "react";
import { createBrowserClient, type SupabaseClient } from "@supabase/auth-helpers-remix";
import Navbar from "~/components/Navbar";
import Footer from "~/components/Footer";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import type { Database } from "~/types/database.types";
import { ClientOnly } from "~/components/client-only";

export async function loader({ request }: LoaderFunctionArgs) {
    const { supabaseServer, response: { headers }, ENV } = getSupabaseServerClient(request);
    const { data: { session } } = await supabaseServer.auth.getSession();
    return json({ session, ENV }, { headers });
}

export default function Layout() {
    const { session: serverSession, ENV } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const location = useLocation();
    const isReceiptPage = location.pathname.startsWith('/family/receipt/');

    const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null);

    useEffect(() => {
        const client = createBrowserClient<Database>(
            ENV.SUPABASE_URL!,
            ENV.SUPABASE_ANON_KEY!
        );
        setSupabase(client);
    }, [ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY]);

    useEffect(() => {
        if (!supabase) return;
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (session?.access_token !== serverSession?.access_token) {
                    revalidator.revalidate();
                }
            }
        );
        return () => {
            subscription?.unsubscribe();
        };
    }, [serverSession, supabase, revalidator]);

    return (
        <div className="flex flex-col min-h-screen text-gray-900 dark:text-white">
            <ClientOnly>
                {() => (
                    <div className={isReceiptPage ? 'print:hidden' : ''}>
                        <Navbar session={serverSession} />
                    </div>
                )}
            </ClientOnly>
            <main className="flex-grow pt-16 pb-16">
                <Outlet/>
            </main>
            <ClientOnly>
                {() => (
                    <div className={isReceiptPage ? 'print:hidden' : ''}>
                        <Footer session={serverSession} />
                    </div>
                )}
            </ClientOnly>
        </div>
    );
}
