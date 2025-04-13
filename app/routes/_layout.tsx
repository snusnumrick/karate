import {json, type LoaderFunctionArgs} from "@remix-run/node";
import {Outlet, useLocation} from "@remix-run/react"; // Import useLocation
import Navbar from "~/components/Navbar";
import Footer from "~/components/Footer";
import {getSupabaseServerClient} from "~/utils/supabase.server";

// Loader to get the session state
export async function loader({request}: LoaderFunctionArgs) {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {session}} = await supabaseServer.auth.getSession();

    // Return session and headers (important for setting/clearing cookies)
    return json({session}, {headers});
}

export default function Layout() {
    // useLoaderData() is not strictly needed here in the layout itself,
    // but it's good practice if you might need the data directly.
    // Child routes will access it via useRouteLoaderData('routes/_layout').
    // const { session } = useLoaderData<typeof loader>();
    const location = useLocation();
    const isReceiptPage = location.pathname.startsWith('/family/receipt/');

    return (
        <div className="flex flex-col min-h-screen text-gray-900 dark:text-white">
            {/* Conditionally add print:hidden class to the Navbar */}
            <div className={isReceiptPage ? 'print:hidden' : ''}>
                <Navbar/>
            </div>
            <main className="flex-grow pt-16 pb-16">
                <Outlet/>
            </main>
            {/* Conditionally add print:hidden class to the Footer */}
            <div className={isReceiptPage ? 'print:hidden' : ''}>
                <Footer/>
            </div>
        </div>
    );
}
