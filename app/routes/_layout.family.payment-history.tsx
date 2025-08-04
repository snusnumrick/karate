import {json, type LoaderFunctionArgs, redirect} from "@remix-run/node";
import {Link, useLoaderData} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {formatDate} from "~/utils/misc";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";


export async function loader({request}: LoaderFunctionArgs) {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        throw redirect("/login", {headers});
    }

    // Get profile to find family_id
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData?.family_id) {
        // Handle error or case where user has no family
        console.error("Payment History Loader Error: Failed to load profile or family_id", profileError?.message);
        // You might want to redirect to the family portal or show an error message
        throw new Response("Could not load your family information.", {status: 500});
    }

    const familyId = profileData.family_id;

    // Fetch all payments for the family, ordered by date descending
    const {data: payments, error: paymentsError} = await supabaseServer
        .from('payments')
        .select('*') // Select all payment columns
        .eq('family_id', familyId)
        // Order by creation date descending primarily, then payment date descending
        .order('created_at', { ascending: false })
        .order('payment_date', { ascending: false, nullsFirst: true }); // Keep nulls (pending) near the top after sorting by created_at

    if (paymentsError) {
        console.error("Payment History Loader Error: Failed to load payments", paymentsError.message);
        throw new Response("Could not load payment history.", {status: 500});
    }

    return json({payments: payments ?? []}, {headers});
}


export default function PaymentHistoryPage() {
    const {payments} = useLoaderData<typeof loader>();

    return (
        <div className="min-h-screen page-background-styles py-12 text-foreground">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <AppBreadcrumb items={breadcrumbPatterns.familyPaymentHistory()} className="mb-6" />

                {/* Page Header */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                        Full Payment History
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                        View all your payment transactions and receipts
                    </p>
                </div>

                {/* Payment History Content */}
                <div className="form-container-styles p-8 backdrop-blur-lg">
                    {payments && payments.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date
                                    </th>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount
                                    </th>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type
                                    </th>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status
                                    </th>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Method
                                    </th>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Receipt
                                    </th>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                                {payments.map((payment) => (
                                    <tr key={payment.id}>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                            {payment.payment_date ? formatDate(payment.payment_date, { formatString: 'P' }) : 'N/A'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                            ${(payment.total_amount / 100).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">
                                            {payment.type?.replace(/_/g, ' ') ?? 'N/A'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                                             <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                 payment.status === 'succeeded' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                     payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                         'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                             }`}>
                               {payment.status}
                             </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">
                                            {payment.payment_method || 'N/A'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {payment.receipt_url ? (
                                                <a
                                                    href={payment.receipt_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 underline"
                                                >
                                                    View
                                                </a>
                                            ) : (
                                                'N/A'
                                            )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {(payment.status === 'pending' || payment.status === 'failed') ? (
                                                <Link
                                                    to={`/pay/${payment.id}`}
                                                    className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 underline font-medium"
                                                >
                                                    {payment.status === 'pending' ? 'Complete Payment' : 'Retry Payment'}
                                                </Link>
                                            ) : (
                                                'N/A'
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-gray-600 dark:text-gray-400 text-lg">No payment history found.</p>
                            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Your payment transactions will appear here once you make your first payment.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Basic Error Boundary for this route
export function ErrorBoundary() {
    // const error = useRouteError(); // Use this hook in Remix v2+
    const error: Error = new Error("An unknown error occurred on the payment history page."); // Placeholder

    return (
        <div className="min-h-screen page-background-styles py-12 text-foreground">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <AppBreadcrumb items={breadcrumbPatterns.familyPaymentHistory()} className="mb-6" />
                
                {/* Page Header */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-extrabold text-red-600 dark:text-red-400 sm:text-4xl">
                        Error Loading Payment History
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                        We encountered an issue while loading your payment history
                    </p>
                </div>

                {/* Error Content */}
                <div className="form-container-styles p-8 backdrop-blur-lg">
                    <div className="text-center py-12">
                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                            {error.message}
                        </p>
                        <p className="text-gray-500 dark:text-gray-500 text-sm mt-4">
                            Please try refreshing the page or contact support if the problem persists.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
