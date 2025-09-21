import type {LoaderFunctionArgs} from "@remix-run/node";
import {json, redirect} from "@remix-run/node";
import {Link, useLoaderData, useRevalidator} from "@remix-run/react"; // Import useRevalidator
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {formatDate} from "~/utils/misc";
import {useEffect} from "react";
import {Database} from "~/types/database.types";
import {PostgrestError} from "@supabase/supabase-js";
import { formatMoney, fromCents } from "~/utils/money";

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const paymentIntentId = url.searchParams.get("payment_intent");

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

    const { supabaseServer } = getSupabaseServerClient(request);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(paymentIntentId);

    type PaymentWithRelations =
        Database["public"]["Tables"]["payments"]["Row"] & {
        family: {
            name: string; // The `name` field from the `family` table
        } | null; // Relation data can potentially be null
        one_on_one_sessions: {
            quantity_purchased: number; // The `quantity_purchased` field from the `one_on_one_sessions` table
        }[]; // It's an array because there may be multiple sessions

    };

    // Find payment by either payment_intent_id (external provider ID) or id (local UUID)
    // This handles both Stripe (uses external payment_intent_id) and Square (may use local id)
    const baseQuery = supabaseServer
        .from('payments')
        .select(`
            *,
            family:family_id (name),
            one_on_one_sessions ( quantity_purchased )
        `);

    const filterQuery = isUuid
        ? baseQuery.or(`payment_intent_id.eq.${paymentIntentId},id.eq.${paymentIntentId}`)
        : baseQuery.eq('payment_intent_id', paymentIntentId);

    const { data: payment, error }: { data: PaymentWithRelations | null; error: PostgrestError | null; } = await filterQuery
        .maybeSingle(); // Use maybeSingle to handle 0 rows gracefully

    // Handle potential errors or payment not found
    if (error) {
        console.error(`Error fetching payment by Payment Intent ID ${paymentIntentId}:`, error.message);
        return json({
            payment: null,
            is_processing: false,
            error: "Error retrieving payment details. Please check your payment history later or contact support.",
            familyPortalUrl: null
        }, { status: 500 });
    }

    if (!payment) {
        console.warn(`Payment record not found for Payment Intent ID ${paymentIntentId}. This might be temporary if the webhook is delayed.`);
        return json({
            payment: null,
            is_processing: true,
            error: "Payment details not yet available. This page will update automatically.",
            familyPortalUrl: null
        });
    }

    if (payment.family_id) {
        console.log(`Payment ${payment.id} belongs to family ${payment.family_id}.`);
    }

    const paymentDateFormatted = payment.payment_date ? formatDate(payment.payment_date, { formatString: 'PPP' }) : null;
    const isPending = payment.status === 'pending';
    const familyPortalUrl = payment.family_id ? '/family' : null;

    return json({
        payment: {
            ...payment,
            formatted_payment_date: paymentDateFormatted,
        },
        is_processing: isPending,
        error: null,
        familyPortalUrl
    });
}

export default function PaymentSuccess() {
    const { payment, is_processing, error, familyPortalUrl } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();


    // Effect to trigger revalidation if payment is still pending OR if loader failed to find the record initially
    // Moved BEFORE the early return to satisfy Rules of Hooks
    useEffect(() => {
        if (is_processing && revalidator.state === 'idle') {
            const timer = setTimeout(() => {
                revalidator.revalidate();
            }, 3000);

            return () => {
                clearTimeout(timer);
            };
        }
    }, [is_processing, revalidator]);

    if (is_processing) {
        return (
            <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                        <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Processing</h1>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        {error || "Your payment is being processed. This page will update automatically once confirmed."}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                        (If this screen persists, please check your payment history later or contact support.)
                    </p>
                    <Link to="/" className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500">
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
                <h1 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Error Loading Payment Details</h1>
                <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
                <Link to="/" className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500">
                    Return Home
                </Link>
            </div>
        );
    }

    if (!payment) {
        return (
            <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
                <h1 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Payment Not Found</h1>
                <p className="text-gray-600 dark:text-gray-300 mb-6">We could not find your payment details. Please contact support.</p>
                <Link to="/" className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500">
                    Return Home
                </Link>
            </div>
        );
    }

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
                        ? `Thank you for your payment of ${formatMoney(fromCents(payment.total_amount))}`
                        : `Your payment of ${formatMoney(fromCents(payment.total_amount))} is being processed.`
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

                    {familyPortalUrl && (
                        <Link
                            to={familyPortalUrl}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                            Go to Family Portal
                        </Link>
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
