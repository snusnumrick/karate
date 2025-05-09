import type {LoaderFunctionArgs} from "@remix-run/node";
import {json, redirect} from "@remix-run/node";
import {Link, useLoaderData, useRevalidator} from "@remix-run/react"; // Import useRevalidator
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {format, parse} from 'date-fns'; // Import format and parse functions
import {useEffect} from "react";
import {Database} from "~/types/database.types";
import {PostgrestError} from "@supabase/supabase-js";

export async function loader({request}: LoaderFunctionArgs) {
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

    type PaymentWithRelations =

        Database["public"]["Tables"]["payments"]["Row"] & {
        family: {
            name: string; // The `name` field from the `family` table
        } | null; // Relation data can potentially be null
        one_on_one_sessions: {
            quantity_purchased: number; // The `quantity_purchased` field from the `one_on_one_sessions` table
        }[]; // It's an array because there may be multiple sessions

    };


    // Get payment details
    const {data: payment, error}: {
        data: PaymentWithRelations | null,
        error: PostgrestError | null
    } = await supabaseServer
        .from('payments')
        .select(`
            *,
            family:family_id (name),                                                                                                                                                                                  
            one_on_one_sessions ( quantity_purchased )                                                                                                                                                                
        `)
        // Query by 'stripe_payment_intent_id'
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle(); // Use maybeSingle to handle 0 rows gracefully

    // Handle potential errors or payment not found
    if (error) {
        console.error(`Error fetching payment by Payment Intent ID ${paymentIntentId}:`, error.message);
        // Return a generic error, but log the specific one
        return json({error: "Error retrieving payment details. Please check your payment history later or contact support."}, {status: 500});
    }

    if (!payment) {
        console.warn(`Payment record not found for Payment Intent ID ${paymentIntentId}. This might be temporary if the webhook is delayed.`);
        // Return an error indicating the payment might still be processing
        return json({error: "Payment details not yet available. Please wait a moment and check your payment history, or contact support if this persists."}, {status: 404});
    }
    // Format the date in the loader for consistency
    const formattedDate = payment.payment_date ? format(parse(payment.payment_date, 'yyyy-MM-dd', new Date()), 'PPP') : null; // Use 'PPP' for readable format like 'MMM d, yyyy'
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

    // Log loaderData on each render
    // console.log('[PaymentSuccess Render] loaderData:', JSON.stringify(loaderData));
    // console.log('[PaymentSuccess Render] revalidator.state:', revalidator.state);


    // Effect to trigger revalidation if payment is still pending OR if loader failed to find the record initially
    // Moved BEFORE the early return to satisfy Rules of Hooks
    useEffect(() => {
        // console.log("[PaymentSuccess Effect] Running effect. Current revalidator state:", revalidator.state);
        // Check if payment is explicitly pending OR if the loader returned the specific 'not yet available' error
        const payment = 'payment' in loaderData ? loaderData.payment : null;
        const isExplicitlyPending = payment?.is_pending_update ?? false;
        const isWaitingForWebhook = 'error' in loaderData && loaderData.error?.startsWith("Payment details not yet available");

        // console.log(`[PaymentSuccess Effect] Checking condition: isExplicitlyPending=${isExplicitlyPending}, isWaitingForWebhook=${isWaitingForWebhook}, revalidator.state=${revalidator.state}`);

        // Revalidate if explicitly pending OR if waiting for webhook, and revalidator is idle
        if ((isExplicitlyPending || isWaitingForWebhook) && revalidator.state === 'idle') {
            // console.log("[PaymentSuccess Effect] Condition met: Payment pending or waiting for webhook, scheduling revalidation...");
            const timer = setTimeout(() => {
                revalidator.revalidate();
                // console.log("[PaymentSuccess Effect] revalidator.revalidate() called.");
            }, 3000); // Revalidate after 3 seconds

            // Cleanup timer on component unmount or if revalidator state changes
            return () => {
                // console.log("[PaymentSuccess Effect] Cleanup function called. Clearing timer.");
                clearTimeout(timer);
            };
        } else {
            console.log(`[PaymentSuccess Effect] Condition NOT met or already revalidating. No timer scheduled. isExplicitlyPending=${isExplicitlyPending}, isWaitingForWebhook=${isWaitingForWebhook}, Revalidator   
state: ${revalidator.state}`);
        }
        // Dependencies: revalidate whenever loaderData changes (including error state) or revalidator state changes
    }, [loaderData, revalidator]); // Depend on loaderData and revalidator state
    // Log loader data just before returning JSX
    // console.log('[PaymentSuccess Render] Final loaderData before JSX:', JSON.stringify(loaderData));

    // Handle specific "not yet available" error by showing processing state
    if ('error' in loaderData && loaderData.error?.startsWith("Payment details not yet available")) {
        // Show processing state - the useEffect hook will trigger revalidation
        return (
            <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <div className="text-center">
                    {/* Processing Icon */}
                    <div
                        className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                        <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-300" fill="none" stroke="currentColor"
                             viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    {/* Processing Title & Text */}
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Processing</h1>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Your payment is being processed. This page will update automatically once confirmed.
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                        (If this screen persists, please check your payment history later or contact support.)
                    </p>
                    <Link
                        to="/"
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }
    // Handle other generic errors
    else if ('error' in loaderData) {
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
    // console.log('[PaymentSuccess Render] Status used for rendering:', payment.status);
    // console.log('[PaymentSuccess Component] Receipt URL from loader data:', payment.receipt_url);
    // Extract quantity if available
    const quantityPurchased =
        (payment.type === 'individual_session' && payment.one_on_one_sessions && payment.one_on_one_sessions.length > 0)
        ? payment.one_on_one_sessions[0].quantity_purchased
        : null;

    const isSucceeded = payment.status === 'succeeded';
    const isPending = payment.status === 'pending';

    return (
        <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="text-center">
                {/* Conditional Icon */}
                {isSucceeded && (
                    <div
                        className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-green-100 dark:bg-green-900 rounded-full">
                        <svg className="w-8 h-8 text-green-600 dark:text-green-300" fill="none" stroke="currentColor"
                             viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                )}
                {isPending && (
                    <div
                        className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                        {/* Simple Clock Icon */}
                        <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-300" fill="none" stroke="currentColor"
                             viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                )}
                {/* Add handling for 'failed' if needed, though usually redirect occurs */}

                {/* Conditional Title */}
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {isSucceeded ? 'Payment Successful!' : 'Payment Processing'}
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {isSucceeded
                        ? `Thank you for your payment of $${(payment.total_amount / 100).toFixed(2)}`
                        : `Your payment of $${(payment.total_amount / 100).toFixed(2)} is being processed.`
                    }
                </p>

                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded text-left">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">Family:</span> {payment.family?.name ?? 'N/A'}
                    </p>
                    {/* Transaction ID Removed */}
                    {/* Conditional Date Display */}
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span
                            className="font-semibold">Date:</span> {isSucceeded ? (payment.formatted_payment_date ?? 'N/A') : 'Processing...'}
                    </p>
                    {/* Conditionally display quantity purchased (only if succeeded) */}
                    {isSucceeded && quantityPurchased !== null && (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-semibold">Quantity Purchased:</span> {quantityPurchased} session(s)
                        </p>
                    )}
                    {/* Show processing note only if pending */}
                    {isPending && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Note: Final details are being
                            processed.</p>
                    )}
                </div>

                <div className="flex justify-center space-x-4">
                    {/* Conditional Receipt Link */}
                    {isSucceeded && payment.receipt_url && (
                        <a
                            href={payment.receipt_url}
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
