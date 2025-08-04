import {json, type LoaderFunctionArgs} from "@remix-run/node";
import {Link, useLoaderData, useRouteError, isRouteErrorResponse} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import { formatDate } from "~/utils/misc";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

export async function loader({request, params}: LoaderFunctionArgs) {
    const {supabaseServer} = getSupabaseServerClient(request);
    const waiverId = params.waiverId;

    if (!waiverId) {
        throw new Response("Waiver ID is required", {status: 400});
    }

    // Get the waiver details
    const {data: waiver, error: waiverError} = await supabaseServer
        .from('waivers')
        .select('*')
        .eq('id', waiverId)
        .single();

    if (waiverError || !waiver) {
        throw new Response("Waiver not found", {status: 404});
    }

    // Get the current user
    const {data: {user}} = await supabaseServer.auth.getUser();

    let userSignature = null;
    if (user) {
        // Check if the user has signed this waiver
        const {data: signature} = await supabaseServer
            .from('waiver_signatures')
            .select('signed_at, signature_data')
            .eq('user_id', user.id)
            .eq('waiver_id', waiverId)
            .single();

        userSignature = signature;
    }

    return json({
        waiver,
        userSignature,
        isAuthenticated: !!user
    });
}

export default function WaiverDetail() {
    const {waiver, userSignature, isAuthenticated} = useLoaderData<typeof loader>();

    const isSigned = !!userSignature;
    const signedDate = isSigned && userSignature?.signed_at ? formatDate(userSignature.signed_at, { formatString: 'P' }) : null;

    return (
        <div className="min-h-screen page-background-styles py-12 text-foreground">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <AppBreadcrumb items={breadcrumbPatterns.familyWaiverDetail(waiver.title)} className="mb-6" />
                
                {/* Page Header */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-extrabold page-header-styles sm:text-4xl">
                        {waiver.title}
                    </h1>
                    {waiver.description && (
                        <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                            {waiver.description}
                        </p>
                    )}
                    {waiver.required && (
                        <span className="inline-block mt-4 px-3 py-1 text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded">
                            Required
                        </span>
                    )}
                </div>
                
                <div className="form-container-styles p-8 backdrop-blur-lg">
                    <div className="prose prose-gray dark:prose-invert max-w-none mb-8">
                        <div dangerouslySetInnerHTML={{__html: waiver.content}} />
                    </div>

                    <div className="border-t pt-6">
                        {!isAuthenticated ? (
                            <div className="text-center">
                                <p className="mb-4">Please log in to sign this waiver.</p>
                                <Link
                                    to={`/login?redirectTo=/family/waivers/${waiver.id}`}
                                    className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 transition-colors"
                                >
                                    Log In to Sign
                                </Link>
                            </div>
                        ) : isSigned ? (
                            <div className="text-center">
                                <div className="flex items-center justify-center space-x-4 mb-4">
                                    <span className="text-green-600 dark:text-green-400 font-medium text-lg">✓ Signed</span>
                                    <span className="text-gray-500 dark:text-gray-400">
                                        on {signedDate}
                                    </span>
                                </div>
                                
                                {userSignature?.signature_data && (
                                    <div className="mb-4">
                                        <img 
                                            src={userSignature.signature_data} 
                                            alt="Your signature" 
                                            className="h-16 w-auto mx-auto border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                                        />
                                    </div>
                                )}
                                
                                <Link
                                    to="/family/waivers"
                                    className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-500 transition-colors"
                                >
                                    Back to Waivers
                                </Link>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="mb-4 text-gray-600 dark:text-gray-300">
                                    By signing this waiver, you acknowledge that you have read and understood the terms and conditions.
                                </p>
                                <div className="flex justify-center space-x-4">
                                    <Link
                                        to="/family/waivers"
                                        className="px-6 py-3 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-500 transition-colors"
                                    >
                                        Back to Waivers
                                    </Link>
                                    <Link
                                        to={`/family/waivers/${waiver.id}/sign`}
                                        className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 transition-colors"
                                    >
                                        Sign This Waiver
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Optional: Add an Error Boundary specific to this route
export function ErrorBoundary() {
    const error = useRouteError();

    // Log the error to the console
    console.error(error);

    // Check if it's a response error (like our 404)
    if (isRouteErrorResponse(error)) {
        return (
            <div className="min-h-screen page-background-styles py-12 text-foreground">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md backdrop-blur-lg border dark:border-gray-700 text-center">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">
                            {error.status} {error.statusText}
                        </h1>
                        <p>{error.data}</p>
                        <Link to="/family/waivers" className="text-green-600 dark:text-green-400 hover:underline mt-4 inline-block">
                            &larr; Back to Waivers List
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Generic error for unexpected issues
    return (
        <div className="min-h-screen page-background-styles py-12 text-foreground">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md backdrop-blur-lg border dark:border-gray-700 text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">An Unexpected Error Occurred</h1>
                    <p>We&apos;re sorry, something went wrong.</p>
                    <Link to="/family/waivers" className="text-green-600 dark:text-green-400 hover:underline mt-4 inline-block">
                        &larr; Back to Waivers List
                    </Link>
                </div>
            </div>
        </div>
    );
}

