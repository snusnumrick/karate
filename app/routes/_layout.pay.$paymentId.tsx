import {json, type LoaderFunctionArgs, redirect, TypedResponse} from "@remix-run/node";
import {Link, useFetcher, useLoaderData, useNavigate, useRouteError} from "@remix-run/react";
import {useEffect, useMemo, useState} from "react"; // Ensure useMemo is imported
import {loadStripe, StripeElementsOptions} from "@stripe/stripe-js";
import {CardElement, Elements, useElements, useStripe} from "@stripe/react-stripe-js";
import { createClient } from "@supabase/supabase-js"; // Import standard client for admin tasks
import Stripe from "stripe"; // Import Stripe SDK for server-side API calls
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Button} from "~/components/ui/button";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {siteConfig} from "~/config/site"; // Assuming price IDs might be needed indirectly or for display
import type {Database} from "~/types/supabase";

type PaymentRow = Database['public']['Tables']['payments']['Row'];
type PaymentStudentRow = Database['public']['Tables']['payment_students']['Row'];

type PaymentWithDetails = PaymentRow & {
    family: { name: string } | null;
    type: Database['public']['Enums']['payment_type_enum']; // Use 'type' to match DB column
    // Add associated students directly to the payment object
    payment_students: Array<Pick<PaymentStudentRow, 'student_id'>>;
    // Add quantity if stored directly on payment (e.g., for pre-created individual sessions)
    // quantity?: number | null;
    // status: Database['public']['Enums']['payment_status']; // Status is already part of PaymentRow
};

type LoaderData = {
    payment?: PaymentWithDetails; // Use the more detailed type
    stripePublishableKey: string;
    error?: string; // Add error field for loader errors
    // paymentStatus is implicitly included in the payment object
};

// --- Action Response Types (Mirrored from API endpoint) ---
// Type for the successful response from /api/create-payment-intent
type ActionSuccessResponse = {
    clientSecret: string;
    supabasePaymentId: string;
    totalAmount: number;
    error?: never;
};
// Type for the error response from /api/create-payment-intent
type ActionErrorResponse = {
    clientSecret?: never;
    supabasePaymentId?: never;
    totalAmount?: never;
    error: string;
};
// Combined response type for the fetcher
type ApiActionResponse = ActionSuccessResponse | ActionErrorResponse;

// Helper function to get user-friendly product description
function getPaymentProductDescription(type: Database['public']['Enums']['payment_type_enum'] | undefined | null): string {
    switch (type) {
        case 'monthly_group':
            return 'Monthly Group Class Fee';
        case 'yearly_group':
            return 'Yearly Group Class Fee';
        case 'individual_session':
            return 'Individual Session(s)';
        case 'other':
            return 'Other Payment';
        default:
            return 'Unknown Item';
    }
}

// --- Loader ---
export async function loader({request, params}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    console.log('paymentId loader parames: ', params);
    const paymentId = params.paymentId;
    if (!paymentId) {
        // Use json response for errors instead of throwing
        console.error("Payment ID is required");
        return json({error: "Payment ID is required", stripePublishableKey: ""}, {status: 400});
    }

    const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    if (!stripePublishableKey) {
        console.error("Stripe publishable key is not configured.");
        // Use json response for errors
        return json({error: "Payment gateway configuration error.", stripePublishableKey: ""}, {status: 500});
    }

    const {supabaseServer, response} = getSupabaseServerClient(request);
    // console.log('paymentId loader supabaseServer: ', supabaseServer);

    // Fetch payment, family name, and associated student IDs in one go
    // Restore full select statement
    const {data: payment, error} = await supabaseServer
        .from('payments')
        .select(`
            id, family_id, amount, payment_date, payment_method, status, stripe_session_id, stripe_payment_intent_id, receipt_url, notes, type,
            family:family_id (name),
            payment_students ( student_id )
        `)
        .eq('id', paymentId)
        .maybeSingle(); // Use maybeSingle to handle not found gracefully

    // Log the raw data received from Supabase on the server
    console.log(`[Loader] Raw payment data fetched for ID ${paymentId}:`, payment);

    if (error) {
        // Log the specific database error message
        console.error(`[Loader] Error fetching payment details for ID ${paymentId}:`, error.message);
        // Return a more specific error message including the DB error
        return json<LoaderData>({
            error: `Failed to load payment details: ${error.message}`,
            stripePublishableKey
        }, {status: 500, headers: response.headers});
    }
    // console.log('paymentId loader payment: ', payment);

    if (!payment) {
        // Return error in JSON to handle in component
        console.error("Payment not found:", paymentId);
        return json<LoaderData>({error: "Payment record not found.", stripePublishableKey}, {
            status: 404,
            headers: response.headers
        });
    }

    // --- Check Stripe Status if DB status is 'pending' ---
    if (payment.status === 'pending' && payment.stripe_payment_intent_id) {
        console.log(`[Loader] DB status is pending for ${paymentId}. Checking Stripe PI status for ${payment.stripe_payment_intent_id}...`);
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
            console.error("[Loader] Missing Stripe Secret Key or Supabase Admin credentials for pending check.");
            // Proceed cautiously, maybe let the user try, but log the config error
        } else {
            const stripe = new Stripe(stripeSecretKey);
            const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, {
                    expand: ['latest_charge'] // Expand charge to potentially get receipt URL
                });
                console.log(`[Loader] Stripe PI status for ${paymentIntent.id}: ${paymentIntent.status}`);

                if (paymentIntent.status === 'succeeded') {
                    console.log(`[Loader] Stripe PI ${paymentIntent.id} already succeeded. Updating Supabase record ${paymentId} and redirecting.`);
                    // Update Supabase record (mimic webhook logic, but only for success)
                    const receiptUrl = (paymentIntent.latest_charge && typeof paymentIntent.latest_charge === 'object') ? paymentIntent.latest_charge.receipt_url : null;
                    const paymentMethod = paymentIntent.payment_method_types?.[0] ?? null;

                    const { error: updateError } = await supabaseAdmin
                        .from('payments')
                        .update({
                            status: 'succeeded',
                            payment_date: new Date().toISOString(), // Set payment date
                            receipt_url: receiptUrl,
                            payment_method: paymentMethod,
                            // No need to update stripe_payment_intent_id again
                        })
                        .eq('id', paymentId);

                    if (updateError) {
                        console.error(`[Loader] Failed to update Supabase record ${paymentId} to succeeded after Stripe check:`, updateError.message);
                        // Proceed to payment page, but log the error
                    } else {
                        // Redirect to success page - THIS PREVENTS DOUBLE PAYMENT
                        throw redirect(`/payment/success?payment_intent=${paymentIntent.id}`, { headers: response.headers });
                    }
                    // Only mark as failed in DB if Stripe status is definitively canceled
                } else if (paymentIntent.status === 'canceled') {
                    console.log(`[Loader] Stripe PI ${paymentIntent.id} status is terminal failure: ${paymentIntent.status}. Updating Supabase record ${paymentId} to failed.`);
                    // Update Supabase record to 'failed'
                    const { error: updateError } = await supabaseAdmin
                        .from('payments')
                        .update({
                            status: 'failed',
                            payment_date: new Date().toISOString(), // Set date of failure
                        })
                        .eq('id', paymentId);

                    if (updateError) {
                        console.error(`[Loader] Failed to update Supabase record ${paymentId} to failed after Stripe check:`, updateError.message);
                    }
                    // DO NOT update the local payment object here.
                    // The component should reflect the DB state as fetched initially or after a successful update+refetch.
                    // If the DB update fails, the component should still show 'pending'.
                    // If the DB update succeeds, the component will show 'failed' because the loader refetches or the page reloads.

                    // Proceed to load the payment page allowing retry
                }
                // For other statuses ('processing', 'requires_action', 'requires_confirmation'),
                // DO NOTHING to the DB status. Let the page load with 'pending'.
                // The user can wait, complete an action, or the webhook will eventually update.

            } catch (stripeError) {
                console.error(`[Loader] Error retrieving Stripe Payment Intent ${payment.stripe_payment_intent_id}:`, stripeError instanceof Error ? stripeError.message : stripeError);
                // Proceed to load the payment page, but log the error
            }
        }
    }
    // --- End Stripe Status Check ---


    // Ensure payment is not already successfully completed (check status *again* in case it was updated by the check above)
    if (payment.status === 'succeeded') {
        console.warn(`Attempted to access payment page for already succeeded payment ${paymentId}`);
        // Redirect to success page if already succeeded
        if (payment.stripe_payment_intent_id) {
            console.log(`Payment ${paymentId} already succeeded. Redirecting to success page.`);
            throw redirect(`/payment/success?payment_intent=${payment.stripe_payment_intent_id}`, {headers: response.headers});
        } else {
            // Should not happen if succeeded, but handle defensively
            console.warn(`Payment ${paymentId} succeeded but missing Payment Intent ID. Redirecting to family portal.`);
            throw redirect(`/family`, {headers: response.headers}); // Redirect to family dashboard as fallback
        }
    }
    // Allow proceeding if status is 'pending' or 'failed'

    // Prepare the data object to be returned
    const loaderReturnData: LoaderData = {
        payment: payment as PaymentWithDetails, // Status is included within payment object
        stripePublishableKey
    };
    console.log('[Loader] Data prepared for return:', loaderReturnData);

    // Cast payment to PaymentWithDetails to satisfy LoaderData type
    return json<LoaderData>(loaderReturnData, {headers: response.headers});
}

// Remove top-level stripePromise initialization - it will be done inside the component

// --- CheckoutForm Component (Handles Card Element and Submission) ---
function CheckoutForm({payment, clientSecret}: { payment: PaymentWithDetails, clientSecret: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const navigate = useNavigate();
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    console.log('Checkout Form, payemnt: ', payment);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPaymentError(null); // Clear previous errors

        if (!stripe || !elements) {
            // Stripe.js has not yet loaded.
            console.error("Stripe.js has not loaded yet.");
            setPaymentError("Payment system is not ready. Please wait a moment and try again.");
            return;
        }

        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
            console.error("Card Element not found.");
            setPaymentError("Payment input is missing. Please refresh the page.");
            return;
        }

        setIsProcessing(true);

        // Use confirmCardPayment with the clientSecret obtained earlier
        const {error, paymentIntent} = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                // billing_details: { // Optional: Add billing details if needed/collected
                //   name: 'Jenny Rosen', // Example: Collect name if required by Stripe settings
                // },
            },
            // Simplify return_url. Stripe should append payment_intent details automatically.
            return_url: `${window.location.origin}/payment/success`
        });

        if (error) {
            console.error("Stripe confirmCardPayment error:", error);
            // Handle specific error types if needed (e.g., card errors vs. API errors)
            setPaymentError(error.message || "An unexpected error occurred during payment.");
            setIsProcessing(false); // Keep processing state false on error
        } else if (paymentIntent?.status === 'succeeded') {
            console.log("Payment Succeeded:", paymentIntent);
            // Manual navigation fallback in case Stripe's automatic redirect doesn't trigger
            // Navigate to the success page, passing the payment intent ID
            console.log(`[CheckoutForm] Navigating manually to success page for PI: ${paymentIntent.id}`);
            navigate(`/payment/success?payment_intent=${paymentIntent.id}`);
            // Keep isProcessing true until navigation occurs
            // setIsProcessing(true); // No need to set false as we are navigating away

            // Old comments below:
            // Redirect is handled by Stripe via return_url if payment requires no further actions
            // If redirection doesn't happen automatically (e.g., for certain payment methods or flows),
            // you might need manual navigation here.
            // navigate(`/payment/success?payment_intent=${paymentIntent.id}`);
            // For card payments, usually the return_url handles it.
            // We might just need to keep the user informed while Stripe redirects.
            // setIsProcessing(true); // Keep showing processing until redirect happens
        } else if (paymentIntent?.status === 'requires_action') {
            console.log("Payment requires further action (e.g., 3D Secure).");
            setPaymentError("Payment requires additional verification. Please follow the prompts.");
            // Stripe.js automatically handles the redirect for 3D Secure if using confirmCardPayment
            // No explicit redirect needed here usually. Keep processing state?
            // setIsProcessing(true); // Keep showing processing while user handles action
        } else {
            // Handle other statuses like 'processing', 'requires_payment_method', etc.
            console.warn("Payment status:", paymentIntent?.status);
            setPaymentError(`Payment status: ${paymentIntent?.status}. Please try again or contact support.`);
            // Set processing to false for these final, non-success states.
            // The 'requires_action' case implicitly keeps isProcessing true as Stripe handles the redirect.
            setIsProcessing(false); // Remove the problematic 'if' condition
        }
    };

    // Basic styling for CardElement
    const cardElementOptions = {
        style: {
            base: {
                // Use a color that works in both light and dark modes, or detect theme.
                // For simplicity, let's try a neutral dark gray for light mode
                // and override with a light color for dark mode if possible,
                // Set a base color suitable for light mode - REMOVED this duplicate
                // color: "#32325d",
                // Explicitly set a light color for dark mode visibility.
                // This might look slightly off in light mode if the background isn't pure white,
                // but visibility in dark mode is the priority here.
                // A better long-term solution might involve Stripe's Appearance API.
                // For now, let's force a light gray color.
                // color: "#E0E0E0", // Light Gray
                // Let's try white for maximum contrast on the dark background
                color: "#FFFFFF", // White text for dark mode
                // Let's try setting a light color directly, assuming dark mode has a dark background.
                // This might look slightly off in light mode, but should be visible in dark.
                // A better approach involves CSS variables or Stripe's Appearance API theme.
                // Let's try a light gray that might work on both:
                // color: "#333", // A dark gray for light mode
                // Forcing light text for dark mode visibility:
                // color: "#E0E0E0", // Light Gray - might be too light for light mode background
                // Let's stick with the original dark color for now and rely on the container styling.
                // The container has `bg-white dark:bg-gray-700`. Let's adjust the container instead.

                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                fontSmoothing: "antialiased",
                fontSize: "16px",
                "::placeholder": {
                    color: "#aab7c4" // Placeholder color (light gray, should be okay on dark bg)
                },
                // TODO: Add styles for dark mode if needed, potentially using theme context
            },
            invalid: {
                color: "#fa755a",
                iconColor: "#fa755a"
            }
        },
        // hidePostalCode: true // Remove this line to allow postal code collection
    };


    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="card-element"
                       className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Card Details
                </label>
                {/* Ensure the container background contrasts with the text color */}
                <div id="card-element"
                     className="p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900"> {/* Changed dark bg */}
                    {/* Ensure CardElement is only rendered when elements is available */}
                    {elements && <CardElement options={cardElementOptions}/>}
                </div>
            </div>

            {paymentError && (
                <Alert variant="destructive">
                    <AlertTitle>Payment Error</AlertTitle>
                    <AlertDescription>{paymentError}</AlertDescription>
                </Alert>
            )}

            <Button
                type="submit"
                disabled={!stripe || !elements || isProcessing} // Disable if stripe/elements not loaded or processing
                className="w-full"
            >
                {isProcessing ? 'Processing...' : `Pay $${(payment.amount / 100).toFixed(2)}`}
            </Button>
        </form>
    );
}


// --- Main Payment Page Component ---
export default function PaymentPage() {
    console.log("[PaymentPage] Component rendering started."); // Add log here
    // payment object now contains the status
    const {payment, stripePublishableKey, error: loaderError} = useLoaderData<LoaderData>();
    // Use the combined type for the fetcher
    const paymentIntentFetcher = useFetcher<ApiActionResponse>();
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [fetcherError, setFetcherError] = useState<string | null>(null);
    // State to hold the loaded Stripe promise/instance
    const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);

    // Options for Stripe Elements provider - Memoize to prevent unnecessary re-renders
    // Moved to top level before early returns to satisfy Rules of Hooks
    const options = useMemo<StripeElementsOptions | undefined>(() => (
        clientSecret
            ? {clientSecret, appearance: {theme: 'stripe' /* or 'night', or custom */}}
            : undefined
    ), [clientSecret]); // Only recreate options when clientSecret changes

    console.log('PaymentPage, payment: ', payment); // Keep log after hooks

    // --- Restore Fetcher Logic ---
    // Fetch the Payment Intent clientSecret when the component mounts or payment data changes
    // Fetch the Payment Intent clientSecret when the component mounts or payment data changes
    useEffect(() => {
        // Only fetch if:
        // 1. We have payment data.
        // 2. Fetcher is currently idle.
        // 3. Fetcher hasn't already successfully fetched data (check fetcher.data).
        // 4. We don't already have a clientSecret set in the component's state.
        if (payment && paymentIntentFetcher.state === 'idle' && !paymentIntentFetcher.data && !clientSecret) {
            console.log(`[PaymentPage Effect] Conditions met. Submitting to fetch clientSecret for payment ${payment.id}`);
            const formData = new FormData();

            // --- Data required by /api/create-payment-intent ---
            // These MUST match the expectations of your API action
            formData.append('familyId', payment.family_id);
            formData.append('familyName', payment.family?.name ?? 'Unknown Family'); // Need family name
            formData.append('supabasePaymentId', payment.id); // Pass Supabase ID for linking/update

            // Determine paymentOption, priceId, quantity, studentIds based on payment.payment_type
            // This logic is CRUCIAL and depends heavily on how you store payment details
            let paymentOption: 'monthly' | 'yearly' | 'individual' | null = null;
            let priceId: string | null = null; // Required for yearly/individual
            let quantity: string | null = null; // Required for individual
            const studentIds: string[] = payment.payment_students?.map(ps => ps.student_id) ?? []; // Get student IDs from loader data

            // Ensure type exists before switching
            if (!payment.type) { // Check for 'type'
                console.error(`[PaymentPage Effect] Payment object is missing 'type' property for payment ID ${payment.id}. Payment data:`, payment); // Update error message
                setFetcherError("Cannot determine payment details: Missing payment type information.");
                return; // Stop processing if type is missing
            }

            // Determine paymentOption, priceId, quantity based on payment.type
            switch (payment.type) { // Switch on 'type'
                case 'monthly_group':
                    paymentOption = 'monthly';
                    // Price ID is determined server-side based on student history for monthly
                    break;
                case 'yearly_group':
                    paymentOption = 'yearly';
                    priceId = siteConfig.stripe.priceIds.yearly; // Use configured yearly price ID
                    break;
                case 'individual_session':
                    paymentOption = 'individual';
                    priceId = siteConfig.stripe.priceIds.oneOnOneSession; // Use correct property name: oneOnOneSession
                    // Determine quantity: This depends on how you created the payment record.
                    // If the quantity is stored on the payment record itself (e.g., in a 'quantity' column
                    // or metadata), use that. Otherwise, calculate based on amount/price.
                    // For now, let's assume the amount on the payment record is correct and calculate quantity.
                    if (siteConfig.pricing.oneOnOneSession > 0) {
                        const calculatedQuantity = Math.round(payment.amount / (siteConfig.pricing.oneOnOneSession * 100));
                        quantity = calculatedQuantity > 0 ? calculatedQuantity.toString() : '1'; // Default to 1 if calculation fails
                        console.log(`[PaymentPage Effect] Calculated quantity ${quantity} for individual session payment ${payment.id} based on amount ${payment.amount} and price ${siteConfig.pricing.oneOnOneSession * 100}`);
                    } else {
                        console.error("Individual session price is zero or not configured. Cannot determine quantity.");
                        setFetcherError("Configuration error: Individual session price missing.");
                        return;
                    }
                    break;
                default:
                    console.error("Unhandled payment type in PaymentPage:", payment.type); // Log payment.type
                    setFetcherError("Cannot determine payment details for this type.");
                    return; // Stop if type is unknown
            }

            // --- Validation before submitting ---
            if (!paymentOption) {
                console.error(`Payment option could not be determined for payment ${payment.id}.`);
                setFetcherError("Could not determine payment option type.");
                return;
            }
            formData.append('paymentOption', paymentOption);

            // Pass student IDs if it's a group payment
            if (paymentOption === 'monthly' || paymentOption === 'yearly') {
                if (studentIds.length === 0) {
                    console.error(`Group payment type (${paymentOption}) selected for payment ${payment.id}, but no associated student IDs found in loader data.`);
                    setFetcherError(`Configuration error: Student details missing for ${paymentOption} payment.`);
                    return;
                }
                formData.append('studentIds', studentIds.join(','));
            }


            if ((paymentOption === 'yearly' || paymentOption === 'individual') && !priceId) {
                console.error(`Price ID missing for ${paymentOption} payment ${payment.id}.`);
                setFetcherError(`Configuration error: Price ID missing for ${paymentOption}.`);
                return;
            }
            if (priceId) formData.append('priceId', priceId);


            if (paymentOption === 'individual' && !quantity) {
                console.error(`Quantity missing for ${paymentOption} payment ${payment.id}.`);
                setFetcherError(`Configuration error: Quantity missing for ${paymentOption}.`);
                return;
            }
            if (quantity) formData.append('quantity', quantity);


            console.log("[PaymentPage Effect] Submitting to /api/create-payment-intent with formData:", Object.fromEntries(formData));
            paymentIntentFetcher.submit(formData, {method: 'post', action: '/api/create-payment-intent'});
        }
    }, [payment, paymentIntentFetcher, clientSecret]); // Add clientSecret to dependency array and check below

    // Update clientSecret state when fetcher returns data
    useEffect(() => {
        if (paymentIntentFetcher.data) {
            // Check if it's a success response
            if ('clientSecret' in paymentIntentFetcher.data && paymentIntentFetcher.data.clientSecret) {
                // Only update state if the clientSecret is actually different
                if (paymentIntentFetcher.data.clientSecret !== clientSecret) {
                    console.log(`[PaymentPage Effect] Received NEW clientSecret for payment ${paymentIntentFetcher.data.supabasePaymentId}`);
                    setClientSecret(paymentIntentFetcher.data.clientSecret);
                    setFetcherError(null); // Clear previous errors
                } else {
                    console.log(`[PaymentPage Effect] Received SAME clientSecret. No state update needed.`);
                }

                // Verify amounts match as a sanity check
                if (payment && paymentIntentFetcher.data.totalAmount && payment.amount !== paymentIntentFetcher.data.totalAmount) {
                    console.error(`Amount mismatch! Payment record: ${payment.amount}, Intent created: ${paymentIntentFetcher.data.totalAmount}`);
                    setFetcherError("Payment amount mismatch detected. Please contact support immediately.");
                    setClientSecret(null); // Prevent payment attempt with wrong amount
                }
                // Check if it's an error response
            } else if ('error' in paymentIntentFetcher.data && paymentIntentFetcher.data.error) {
                console.error("[PaymentPage Effect] Error fetching clientSecret:", paymentIntentFetcher.data.error);
                setFetcherError(paymentIntentFetcher.data.error);
                setClientSecret(null); // Clear clientSecret on error
            }
        }
    }, [paymentIntentFetcher.data, payment, clientSecret]); // Add clientSecret to dependency array
    // --- End Restore Fetcher Logic ---

    // --- Effect to Load Stripe ---
    useEffect(() => {
        if (stripePublishableKey) {
            console.log("[PaymentPage Effect] Loading Stripe.js...");
            setStripePromise(loadStripe(stripePublishableKey));
        } else {
            console.error("[PaymentPage Effect] Stripe Publishable Key is missing from loader data. Cannot load Stripe.");
            // Optionally set an error state here
        }
    }, [stripePublishableKey]); // Run only when the key changes (initially)


    // --- Render Logic ---

    // Handle loader errors first
    if (loaderError) {
        console.error(loaderError);
        return (
            <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
                <Alert variant="destructive">
                    <AlertTitle>Error Loading Payment</AlertTitle>
                    <AlertDescription>{loaderError}</AlertDescription>
                </Alert>
                <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">Return Home</Link>
            </div>
        );
    }

    // Handle case where payment data is somehow missing after loader check (shouldn't happen if loader logic is correct)
    if (!payment) {
        console.error("Payment data is unexpectedly missing.");
        return (
            <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>Payment data is unexpectedly missing.</AlertDescription>
                </Alert>
                <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">Return Home</Link>
            </div>
        );
    }


    // Options object creation moved to top level

    console.log('PaymentPage, memoized options: ', options); // Keep log before return
    return (
        <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">Complete Your Payment</h1>

            {/* Display message if retrying a failed payment */}
            {payment?.status === 'failed' && (
                <Alert variant="warning" className="mb-4"> {/* Use the new warning variant */}
                    {/* Optional: Add an icon like ExclamationTriangleIcon if desired */}
                    <AlertTitle>Previous Attempt Failed</AlertTitle>
                    <AlertDescription>
                        Your previous attempt to complete this payment failed. Please check your card details and try
                        again.
                    </AlertDescription>
                </Alert>
            )}

            {/* Display Payment Summary */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded text-left">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold">Family:</span> {payment.family?.name ?? 'N/A'}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold">Amount:</span> ${(payment.amount / 100).toFixed(2)}
                </p>
                {/* Payment ID removed */}
                {/* TODO: Add more details if needed */}
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span
                        className="font-semibold">Product:</span> {getPaymentProductDescription(payment.type)} {/* Use helper function */}
                </p>
            </div>

            {/* Display Loading / Error States */}
            {paymentIntentFetcher.state === 'submitting' &&
                <p className="text-center text-gray-600 dark:text-gray-400">Initializing payment...</p>}

            {fetcherError && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Initialization Error</AlertTitle>
                    <AlertDescription>{fetcherError}</AlertDescription>
                </Alert>
            )}

            {/* Restore Stripe Elements Form */}
            {/* Ensure stripePromise state is loaded and we have options (clientSecret) */}
            {stripePromise && options && !fetcherError ? (
                <Elements stripe={stripePromise} options={options}> {/* Use stripePromise from state */}
                    <CheckoutForm payment={payment} clientSecret={options.clientSecret!}/>
                </Elements>
            ) : (
                // Show loading only if no error and not already initializing
                !fetcherError && paymentIntentFetcher.state !== 'submitting' &&
                <p className="text-center text-gray-600 dark:text-gray-400">Loading payment form...</p>
            )}
            {/* End Restore Stripe Elements Form */}


            {/* Cancel Link - Use standard <a> tag for full page navigation */}
            <div className="mt-6 text-center">
                {/* Point cancel link to the main family index route */}
                <a href="/family" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
                    Cancel and return to Family Portal
                </a>
            </div>
        </div>
    );
}

// Optional: Add ErrorBoundary for route-level errors
export function ErrorBoundary() {
    const error = useRouteError(); // Use this hook to get the error
    console.error("[PaymentPage ErrorBoundary] Caught error:", error); // Log the caught error

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <Alert variant="destructive">
                <AlertTitle>Payment Page Error</AlertTitle>
                <AlertDescription>
                    Sorry, something went wrong while loading the payment page. Please try again later or contact
                    support.
                </AlertDescription>
            </Alert>
            <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">Return Home</Link>
        </div>
    );
}
