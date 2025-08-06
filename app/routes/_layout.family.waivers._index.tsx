import {json, type LoaderFunctionArgs} from "@remix-run/node";
import {Link, useLoaderData} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import { formatDate } from "~/utils/misc"; // Import formatDate utility
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

export async function loader({request}: LoaderFunctionArgs) {
    const {supabaseServer} = getSupabaseServerClient(request);

    // Get the current user
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return json({waivers: [], userSignedWaivers: [], isAuthenticated: false});
    }

    // Get all available waivers
    const {data: waivers, error: waiversError} = await supabaseServer
        .from('waivers')
        .select('*')
        .order('required', {ascending: false});

    // Get waivers signed by the user with signature data
    const {data: userSignedWaivers} = await supabaseServer
        .from('waiver_signatures')
        .select('waiver_id, signed_at, signature_data')
        .eq('user_id', user.id);

    // Basic error logging if waivers fetch fails
    if (waiversError) {
        console.error("Error fetching waivers:", waiversError);
        // Depending on desired UX, you might want to throw an error or return an error state
    }

    return json({
        waivers: waivers || [],
        userSignedWaivers: userSignedWaivers || [],
        isAuthenticated: true
    });
}

export default function WaiversIndex() {
    const {waivers, userSignedWaivers, isAuthenticated} = useLoaderData<typeof loader>();

    // Create a map of waiver_id to signature info for quick lookup
    const signedWaiverMap = new Map();
    userSignedWaivers.forEach(signature => {
        signedWaiverMap.set(signature.waiver_id, {
            signed_at: signature.signed_at,
            signature_data: signature.signature_data
        });
    });

    return (
        <div className="page-styles">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <AppBreadcrumb items={breadcrumbPatterns.familyWaivers()} className="mb-6" />
                
                {/* Page Header */}
                <div className="family-page-header-section-styles">
                    <h1 className="page-header-styles">
                        Waivers & Agreements
                    </h1>
                    <p className="page-subheader-styles">
                        Review and sign required waivers for your family
                    </p>
                </div>
                
                <div className="form-container-styles p-8 backdrop-blur-lg">
                    <div className="space-y-4">
                        {!isAuthenticated ? (
                            <p>Please <Link to="/login?redirectTo=/family/waivers" className="text-green-600 dark:text-green-400 hover:underline">log
                                in</Link> to view and sign waivers.</p>
                        ) : waivers.length === 0 ? (
                            <p>No waivers are currently available.</p>
                        ) : (
                            waivers.map(waiver => {
                                const isSigned = signedWaiverMap.has(waiver.id);
                                const signatureInfo = signedWaiverMap.get(waiver.id);
                                const signedDate = isSigned && signatureInfo?.signed_at ? formatDate(signatureInfo.signed_at, { formatString: 'P' }) : null;

                                return (
                                    <div key={waiver.id} className="border rounded-lg p-6 bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-4">
                                            <Link 
                                                to={`/family/waivers/${waiver.id}`}
                                                className="text-xl font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline"
                                            >
                                                {waiver.title}
                                            </Link>
                                            {waiver.required && (
                                                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded">
                                                    Required
                                                </span>
                                            )}
                                        </div>
                                        
                                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                                            {waiver.description}
                                        </p>

                                    
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center space-x-4">
                                            <Link
                                                to={`/family/waivers/${waiver.id}`}
                                                className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-500 transition-colors"
                                            >
                                                View
                                            </Link>
                                            {isSigned ? (
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-green-600 dark:text-green-400 font-medium">✓ Signed</span>
                                                    <span className="text-gray-500 dark:text-gray-400 text-sm">
                                                        on {signedDate}
                                                    </span>
                                                </div>
                                            ) : (
                                                <Link
                                                    to={`/family/waivers/${waiver.id}/sign`}
                                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 transition-colors"
                                                >
                                                    Sign Now
                                                </Link>
                                            )}
                                        </div>
                                        
                                        {isSigned && signatureInfo?.signature_data && (
                                            <div className="ml-4">
                                                <img 
                                                    src={signatureInfo.signature_data} 
                                                    alt="Signature" 
                                                    className="h-12 w-auto border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
