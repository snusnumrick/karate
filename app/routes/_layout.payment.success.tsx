import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useLoaderData, useRevalidator } from "@remix-run/react"; // Import useRevalidator
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { format } from 'date-fns'; // Import format function
import { useEffect } from "react";
import {Database} from "~/types/supabase"; // Import useEffect

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const paymentIntentId = url.searchParams.get("payment_intent"); // Expect payment_intent ID
    // const paymentIntentClientSecret = url.searchParams.get("payment_intent_client_secret"); // Needed for potential retrieval/confirmation step if not done client-side

    if (!paymentIntentId) {
        console.warn("Payment Success page loaded without payment_intent query parameter.");
        // Redirect or show a generic success/error? Redirecting home for now.
        return redirect("/");
    }
    // We might not always need the client_secret here if status is confirmed via webhook,
    // but it's useful if we need to retrieve the PI details directly.
    // if (!paymentIntentClientSecret) {
    //     console.warn("Payment Success page loaded without payment_intent_client_secret query parameter.");
    //     return redirect("/");
    // }

    const {supabaseServer} = getSupabaseServerClient(request);

    // Get payment details
    const {data: payment, error} = await supabaseServer
        .from('payments')
        .select(`
            id, family_id, amount, payment_date, payment_method, status, stripe_payment_intent_id, receipt_url, type, notes,
            family:family_id (name),
            one_on_one_sessions ( quantity_purchased )
        `)
        // **ASSUMPTION**: Querying by 'stripe_payment_intent_id' column now
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single();

    if (error || !payment) {
        console.error(`Error fetching payment by Payment Intent ID ${paymentIntentId}:`, error?.message);
        // Potentially try fetching from Stripe API as a fallback if needed?
        // For now, return not found.
        return json({ error: "Payment details not found. It might still be processing." }, { status: 404 });
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
    const revalidator = useRevalidator(); // Get the revalidator function

    // Effect to trigger revalidation if payment is still pending
    // Moved BEFORE the early return to satisfy Rules of Hooks
    useEffect(() => {
        // Access payment data safely within the effect, checking if it exists
        const payment = 'payment' in loaderData ? loaderData.payment : null;
        if (payment?.is_pending_update && revalidator.state === 'idle') {
            console.log("[PaymentSuccess Effect] Payment status is pending, scheduling revalidation...");
            const timer = setTimeout(() => {
                console.log("[PaymentSuccess Effect] Revalidating loader data...");
                revalidator.revalidate();
            }, 3000); // Revalidate after 3 seconds

            // Cleanup timer on component unmount or if revalidator state changes
            return () => clearTimeout(timer);
        } else {
            console.log(`[PaymentSuccess Effect] No revalidation needed. Pending: ${payment?.is_pending_update}, Revalidator state: ${revalidator.state}`);
        }
        // Dependencies: revalidate only when payment data changes or revalidator becomes idle again
    }, [loaderData, revalidator]); // Depend on loaderData as a whole

    // console.log('Loader data:', loaderData); // Removed log

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
    const { payment } = loaderData;
    // console.log('Payment:', payment); // Removed log

    // useEffect hook moved to the top level

    // Type assertion for easier access, matching the updated enum
    const typedPayment = payment as {
        amount: number;
        family_id: string;
        id: string;
        payment_date: string | null; // Can be null if webhook hasn't run yet
        payment_method: string | null; // Can be null
        status: "pending" | "succeeded" | "failed";
        type: Database['public']['Enums']['payment_type_enum']; // Add the type property here
        family: { name: string } | null;
        receipt_url?: string | null;
        formatted_payment_date: string | null;
        is_pending_update: boolean;
        // Add the nested one_on_one_sessions data structure
        one_on_one_sessions: { quantity_purchased: number }[] | null;
    };
    // console.log('Typed Payment:', typedPayment); // Removed log
    console.log('[PaymentSuccess Component] Receipt URL from loader data:', typedPayment.receipt_url); // Log receipt URL
    // Extract quantity if available
    const quantityPurchased = (typedPayment.type === 'individual_session' && typedPayment.one_on_one_sessions && typedPayment.one_on_one_sessions.length > 0)
        ? typedPayment.one_on_one_sessions[0].quantity_purchased
        : null;

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
                            className="font-semibold">Date:</span> {typedPayment.formatted_payment_date ?? (typedPayment.is_pending_update ? 'Processing...' : 'N/A')}
                    </p>
                    {/* Conditionally display quantity purchased */}
                    {quantityPurchased !== null && (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-semibold">Quantity Purchased:</span> {quantityPurchased} session(s)
                        </p>
                    )}
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
