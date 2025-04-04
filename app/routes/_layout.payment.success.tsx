import type {LoaderFunctionArgs} from "@remix-run/node";
import {json, redirect} from "@remix-run/node";
import {Link, useLoaderData} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {format} from 'date-fns'; // Import format function

export async function loader({request}: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
        return redirect("/");
    }

    const {supabaseServer} = getSupabaseServerClient(request);

    // Get payment details
    const {data: payment, error} = await supabaseServer
        .from('payments')
        .select(`
      *,
      family:family_id (name)
    `)
        .eq('stripe_session_id', sessionId) // Use the correct column name
        .single();

    if (error || !payment) {
        return json({error: "Payment not found"}, {status: 404});
    }

    // Format the date in the loader for consistency
    const formattedDate = payment.payment_date ? format(new Date(payment.payment_date), 'PPP') : null; // Use 'PPP' for readable format like 'MMM d, yyyy'
    const isPending = payment.status === 'pending'; // Check if status is still pending

    return json({
        payment: {
            ...payment,
            formatted_payment_date: formattedDate, // Add the formatted date string
            is_pending_update: isPending // Add a flag for the component
        }
    });
}

export default function PaymentSuccess() {
    const loaderData = useLoaderData<typeof loader>();
    console.log('Loader data:', loaderData);

    // Handle case where loader returned an error
    if ('error' in loaderData) {
        return (
            <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
                <h1 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Error Loading Payment Details</h1>
                <p className="text-gray-600 dark:text-gray-300 mb-6">{loaderData.error}</p>
                <Link
                    to="/"
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                    Return Home
                </Link>
            </div>
        );
    }

    // Now we know payment exists
    const {payment} = loaderData;
    console.log('Payment:', payment);

    // Type assertion for easier access, matching the updated enum
    const typedPayment = payment as {
        amount: number;
        family_id: string;
        id: string;
        payment_date: string | null; // Can be null if webhook hasn't run yet
        payment_method: string | null; // Can be null
        status: "pending" | "succeeded" | "failed";
        family: { name: string } | null;
        receipt_url?: string | null;
        formatted_payment_date: string | null; // Add the formatted date field
        is_pending_update: boolean; // Add the pending flag field
    };
    console.log('Typed Payment:', typedPayment);

    return (
        <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="text-center">
                <div
                    className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-green-100 dark:bg-green-900 rounded-full">
                    <svg className="w-8 h-8 text-green-600 dark:text-green-300" fill="none" stroke="currentColor"
                         viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h1>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Thank you for your payment of ${(typedPayment.amount / 100).toFixed(2)}
                </p>

                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded text-left">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">Family:</span> {typedPayment.family?.name ?? 'N/A'}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">Transaction ID:</span> {typedPayment.id}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span
                            className="font-semibold">Date:</span> {typedPayment.formatted_payment_date ?? (typedPayment.is_pending_update ? 'Processing...' : 'N/A')} {/* Adjust display based on pending status */}
                    </p>
                    {typedPayment.is_pending_update && (
                         <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Note: Final details are being processed.</p>
                    )}
                </div>

                <div className="flex justify-center space-x-4">
                    {typedPayment.receipt_url && (
                        <a
                            href={typedPayment.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            View Receipt
                        </a>
                    )}

                    <Link
                        to="/"
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                        Return Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
