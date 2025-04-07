import {json, type LoaderFunctionArgs, redirect} from "@remix-run/node";
import {Link, useLoaderData} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";


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
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <Link to="/family" className="text-blue-600 hover:underline dark:text-blue-400">
                    &larr; Back to Family Portal
                </Link>
            </div>

            <h1 className="text-3xl font-bold mb-6">Full Payment History</h1>

            {payments && payments.length > 0 ? (
                <div className="overflow-x-auto bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
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
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type {/* Added Type */}
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
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions {/* New Actions Header */}
                            </th>
                        </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {payments.map((payment) => (
                            <tr key={payment.id}>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                    {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                    ${(payment.amount / 100).toFixed(2)}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize"> {/* Added Type Cell */}
                                    {payment.type?.replace(/_/g, ' ') ?? 'N/A'} {/* Use global replace */}
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
                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                        >
                                            View
                                        </a>
                                    ) : (
                                        'N/A'
                                    )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"> {/* New Actions Cell */}
                                    {(payment.status === 'pending' || payment.status === 'failed') ? (
                                        <Link
                                            to={`/pay/${payment.id}`}
                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline font-medium"
                                        >
                                            {payment.status === 'pending' ? 'Complete Payment' : 'Retry Payment'}
                                        </Link>
                                    ) : (
                                        'N/A' // Or leave empty: ''
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <p className="text-gray-600 dark:text-gray-400">No payment history found.</p>
                </div>
            )}
        </div>
    );
}

// Basic Error Boundary for this route
export function ErrorBoundary() {
    // const error = useRouteError(); // Use this hook in Remix v2+
    const error: Error = new Error("An unknown error occurred on the payment history page."); // Placeholder

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <Link to="/family" className="text-blue-600 hover:underline dark:text-blue-400">
                    &larr; Back to Family Portal
                </Link>
            </div>
            <h1 className="text-3xl font-bold mb-6 text-red-600 dark:text-red-400">Error Loading Payment History</h1>
            <p className="text-gray-600 dark:text-gray-400">
                {error.message}
            </p>
        </div>
    );
}
