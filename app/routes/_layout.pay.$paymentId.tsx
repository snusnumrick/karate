import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect, TypedResponse } from "@remix-run/node";
import { Link, useFetcher, useLoaderData, useRouteError } from "@remix-run/react";
import { useEffect, useMemo, useState, useCallback } from "react";
import PaymentForm from "~/components/payment/PaymentForm";
import {getSupabaseServerClient, getSupabaseAdminClient} from "~/utils/supabase.server";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {siteConfig} from "~/config/site";
import type {Database} from "~/types/database.types";
import { formatMoney, fromCents } from "~/utils/money";
import { getPaymentProvider } from '~/services/payments/index.server';
import type { ClientRenderConfig, PaymentProviderId } from '~/services/payments/types.server';

// Import types for payment table columns
type PaymentColumns = Database['public']['Tables']['payments']['Row'];
type PaymentStudentRow = Database['public']['Tables']['payment_students']['Row'];
type FamilyRow = Database['public']['Tables']['families']['Row'];
type PaymentTaxRow = Database['public']['Tables']['payment_taxes']['Row'];
type TaxRateRow = Database['public']['Tables']['tax_rates']['Row']; // Add TaxRateRow type

// Define the detailed payment type including new amount columns and taxes with description
type PaymentWithDetails = Omit<PaymentColumns, 'amount' | 'tax_amount'> & { // Omit old amount and single tax_amount
    subtotal_amount: number;
    total_amount: number;
    family: Pick<FamilyRow, 'name' | 'email' | 'postal_code'> | null;
    type: Database['public']['Enums']['payment_type_enum'];
    // Update payment_taxes to include the related tax rate description
    payment_taxes: Array<
        Pick<PaymentTaxRow, 'tax_name_snapshot' | 'tax_amount'> & {
        tax_rates: Pick<TaxRateRow, 'description'> | null; // Fetch description from related tax_rates
    }
    >;
    payment_students: Array<Pick<PaymentStudentRow, 'student_id'>>;
    // quantity?: number | null; // Keep if needed
};

type LoaderData = {
    payment?: PaymentWithDetails; // Use the more detailed type
    paymentProviderId: PaymentProviderId;
    providerConfig: ClientRenderConfig;
    error?: string; // Add error field for loader errors
    // paymentStatus is implicitly included in the payment object
};

// --- Action Response Types (Mirrored from API endpoint) ---
// Type for the successful response from /api/create-payment-intent (includes subtotal, tax, total)
type ActionSuccessResponse = {
    clientSecret: string;
    supabasePaymentId: string;
    subtotalAmount: number; // Amount before tax in cents
    taxAmount: number;      // Calculated tax amount in cents (can be 0)
    totalAmount: number;    // Total amount in cents (subtotal + tax)
    provider: PaymentProviderId;
    error?: never; // Ensure error is not present on success
};

// Type for the error response from /api/create-payment-intent (ensure new fields are not present)
type ActionErrorResponse = {
    clientSecret?: never; // Ensure clientSecret is not present on error
    supabasePaymentId?: never;
    subtotalAmount?: never;
    taxAmount?: never;
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
        case 'store_purchase': // Add case for store purchase
            return 'Store Item Purchase';
        case 'event_registration': // Add case for event registration
            return 'Event Registration Fee';
        case 'other':
            return 'Other Payment';
        default:
            return 'Unknown Item';
    }
}

// --- Loader ---
export async function loader({request, params}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const paymentProvider = getPaymentProvider();
    const paymentProviderId = paymentProvider.id as PaymentProviderId;
    const renderConfig = paymentProvider.getClientRenderConfig();

    if (!paymentProvider.isConfigured()) {
        return json({
            error: "Payment gateway configuration error.",
            paymentProviderId,
            providerConfig: renderConfig,
        }, { status: 500 });
    }

    const paymentId = params.paymentId;
    if (!paymentId) {
        console.error("Payment ID is required");
        return json({
            error: "Payment ID is required",
            paymentProviderId,
            providerConfig: renderConfig,
        }, {status: 400});
    }

    if (paymentId === 'event-payment-success') {
        console.log("Redirecting from event-payment-success to events page");
        return redirect('/events');
    }

    const {response} = getSupabaseServerClient(request);
    const supabaseAdmin = getSupabaseAdminClient();

    // Fetch payment, family name, and associated student IDs in one go
    // TODO: Migrate database fields to be provider-neutral (stripe_* -> payment_*)
    // Fetch payment, including new amount columns and related taxes
    const {data: payment, error} = await supabaseAdmin
        .from('payments')
        .select(`
            id, family_id, subtotal_amount, total_amount, payment_date, payment_method, status, stripe_session_id, payment_intent_id, receipt_url, notes, type, order_id,
            family:family_id (name, email, postal_code),
            payment_students ( student_id ),
            payment_taxes (
                tax_name_snapshot,
                tax_amount,
                tax_rates ( description )
            )
        `)
        .eq('id', paymentId)
        .maybeSingle(); // Use maybeSingle to handle not found

    // console.log(`[Loader] Fetching payment details for ID ${paymentId}... - ${payment}, ${error}`);

    if (error) {
        // Log the specific database error message
        console.error(`[Loader] Error fetching payment details for ID ${paymentId}:`, error.message);
        // Return a more specific error message including the DB error
        return json<LoaderData>({
            error: `Failed to load payment details: ${error.message}`,
            paymentProviderId,
            providerConfig: renderConfig,
        }, {status: 500, headers: response.headers});
    }
    // console.log('paymentId loader payment: ', payment);

    if (!payment) {
        // Return error in JSON to handle in component
        console.error("Payment not found:", paymentId);
        return json<LoaderData>({
            error: "Payment record not found.",
            paymentProviderId,
            providerConfig: renderConfig,
        }, {
            status: 404,
            headers: response.headers
        });
    }

    // --- Check provider status if DB status is 'pending' ---
    const paymentIntentId = payment.payment_intent_id; // Generic payment intent ID for all providers
    if (payment.status === 'pending' && paymentIntentId) {
        console.log(`[Loader] DB status is pending for ${paymentId}. Checking provider intent status for ${paymentIntentId}...`);
        const supabaseAdmin = getSupabaseAdminClient();

        try {
            const providerIntent = await paymentProvider.retrievePaymentIntent(paymentIntentId, {
                includeLatestCharge: true,
                includePaymentMethod: true,
            });

            if (providerIntent.status === 'succeeded') {
                console.log(`[Loader] Provider intent ${providerIntent.id} already succeeded. Updating Supabase record ${paymentId} and redirecting.`);
                const receiptUrl = providerIntent.receiptUrl ?? null;
                const paymentMethod = providerIntent.paymentMethodType ?? null;

                const { error: updateError } = await supabaseAdmin
                    .from('payments')
                    .update({
                        status: 'succeeded',
                        payment_date: new Date().toISOString(),
                        receipt_url: receiptUrl,
                        payment_method: paymentMethod,
                    })
                    .eq('id', paymentId);

                if (updateError) {
                    console.error(`[Loader] Failed to update Supabase record ${paymentId} to succeeded after provider check:`, updateError.message);
                } else {
                    throw redirect(`/payment/success?payment_intent=${providerIntent.id}`, { headers: response.headers });
                }
            } else if (providerIntent.status === 'canceled') {
                console.log(`[Loader] Provider intent ${providerIntent.id} status is terminal failure. Updating Supabase record ${paymentId} to failed.`);
                const { error: updateError } = await supabaseAdmin
                    .from('payments')
                    .update({
                        status: 'failed',
                        payment_date: new Date().toISOString(),
                    })
                    .eq('id', paymentId);

                if (updateError) {
                    console.error(`[Loader] Failed to update Supabase record ${paymentId} to failed after provider check:`, updateError.message);
                }
            }
            // For other statuses we leave the record as pending and allow the UI to render the existing state.
        } catch (providerError) {
            console.error(`[Loader] Error retrieving payment intent ${paymentIntentId}:`, providerError instanceof Error ? providerError.message : providerError);
        }
    }
    // --- End provider status check ---


    // Ensure payment is not already successfully completed (check status *again* in case it was updated by the check above)
    if (payment.status === 'succeeded') {
        console.warn(`Attempted to access payment page for already succeeded payment ${paymentId}`);
        // Redirect to success page if already succeeded
        if (paymentIntentId) {
            console.log(`Payment ${paymentId} already succeeded. Redirecting to success page.`);
            throw redirect(`/payment/success?payment_intent=${paymentIntentId}`, {headers: response.headers});
        } else {
            // Should not happen if succeeded, but handle defensively
            console.warn(`Payment ${paymentId} succeeded but missing Payment Intent ID. Redirecting to family portal.`);
            throw redirect(`/family`, {headers: response.headers}); // Redirect to family dashboard as fallback
        }
    }
    // Allow proceeding if status is 'pending' or 'failed'

    // Prepare the data object to be returned
    const loaderReturnData: LoaderData = {
        payment: payment as PaymentWithDetails,
        paymentProviderId,
        providerConfig: renderConfig,
    };
    // console.log('[Loader] Data prepared for return:', loaderReturnData);

    // Cast payment to PaymentWithDetails to satisfy LoaderData type
    return json<LoaderData>(loaderReturnData, {headers: response.headers});
}

// --- Action Handler for Payment Confirmation ---
export async function action({ request, params }: ActionFunctionArgs) {
    const paymentId = params.paymentId;
    if (!paymentId) {
        return json({ success: false, error: "Payment ID is required" }, { status: 400 });
    }

    const formData = await request.formData();
    const actionType = formData.get('action');

    if (actionType === 'confirm_payment') {
        const paymentMethodId = formData.get('payment_method_id') as string;
        const paymentIntentId = formData.get('payment_intent_id') as string;

        if (!paymentMethodId || !paymentIntentId) {
            return json({ 
                success: false, 
                error: "Missing payment method or payment intent ID" 
            }, { status: 400 });
        }

        try {
            const paymentProvider = getPaymentProvider();
            
            // Confirm payment with the payment provider
            const result = await paymentProvider.confirmPaymentIntent({
                payment_intent_id: paymentIntentId,
                payment_method_id: paymentMethodId,
            });

            if (result.status === 'succeeded') {
                // Store Square payment ID for webhook correlation
                // Note: Status update will be handled by Square webhook
                try {
                    const { supabaseServer } = getSupabaseServerClient(request);
                    console.log(`[Square] Storing Square payment ID ${result.id} for webhook correlation`);
                    
                    await supabaseServer
                        .from('payments')
                        .update({ 
                            payment_intent_id: result.id
                        })
                        .eq('id', paymentIntentId);
                } catch (dbError) {
                    console.error('Failed to store Square payment ID:', dbError);
                    // Don't fail the payment if ID storage fails
                }
                
                return json({ 
                    success: true, 
                    payment: result 
                });
            } else if (result.status === 'failed') {
                return json({ 
                    success: false, 
                    error: "Payment was declined. Please try a different payment method." 
                });
            } else {
                return json({ 
                    success: false, 
                    error: "Payment is still processing. Please wait a moment and check your payment status." 
                });
            }
        } catch (error) {
            console.error('Payment confirmation failed:', error);
            return json({ 
                success: false, 
                error: error instanceof Error ? error.message : "Payment failed. Please try again." 
            }, { status: 500 });
        }
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
}

// --- Main Payment Page Component ---
export default function PaymentPage() {
    // console.log("[PaymentPage] Component rendering started.");
    // payment object now contains the status
    const {
        payment,
        error: loaderError,
        providerConfig,
    } = useLoaderData<LoaderData>();
    // Use the combined type for the fetcher
    const paymentIntentFetcher = useFetcher<ApiActionResponse>();
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [fetcherError, setFetcherError] = useState<string | null>(null);

    // Memoize the onError callback to prevent unnecessary re-renders
    const handleError = useCallback((message: string) => {
        setFetcherError(message);
    }, []);

    // --- Helper to Group Taxes ---
    const groupedTaxes = useMemo(() => {
        if (!payment?.payment_taxes) {
            return [];
        }

        const taxMap = new Map<string, number>(); // Map: tax description/name -> total amount

        payment.payment_taxes.forEach(tax => {
            // Use description first, fallback to snapshot name
            const key = tax.tax_rates?.description || tax.tax_name_snapshot || 'Unknown Tax';
            const currentAmount = taxMap.get(key) || 0;
            // Ensure tax_amount is treated as a number, default to 0 if null/undefined
            taxMap.set(key, currentAmount + (tax.tax_amount ?? 0));
        });

        // Convert map back to an array of objects for rendering
        return Array.from(taxMap.entries()).map(([description, amount]) => ({
            description,
            amount,
        }));
    }, [payment?.payment_taxes]); // Recalculate if taxes change


    // console.log('PaymentPage, payment: ', payment);


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
            // console.log(`[PaymentPage Effect] Conditions met. Submitting to fetch clientSecret for payment ${payment.id}`);
            const formData = new FormData();

            // --- Data required by /api/create-payment-intent ---
            // These MUST match the expectations of your API action
            formData.append('familyId', payment.family_id);
            formData.append('familyName', payment.family?.name ?? 'Unknown Family'); // Need family name
            formData.append('supabasePaymentId', payment.id); // Pass Supabase ID for linking/update

            // The database now stores the discounted subtotal, so use it directly
            formData.append('subtotalAmount', payment.subtotal_amount.toString());
            formData.append('totalAmount', payment.total_amount.toString());


            // Determine paymentOption, priceId, quantity, studentIds based on payment.payment_type
            // This logic is CRUCIAL and depends heavily on how you store payment details
            let paymentOption: 'monthly' | 'yearly' | 'individual' | 'store' | 'event' | null = null; // Added 'store' and 'event'
            const priceId: string | null = null; // Required for yearly/individual
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
                    // Price ID will be determined by the payment provider based on the payment option
                    break;
                case 'individual_session':
                    paymentOption = 'individual';
                    // Price ID will be determined by the payment provider based on the payment option
                    // Determine quantity: This depends on how you created the payment record.
                    // If the quantity is stored on the payment record itself (e.g., in a 'quantity' column), use that.
                    // Otherwise, calculate based on subtotal_amount / price.
                    // Let's assume quantity needs calculation based on subtotal.
                    if (siteConfig.pricing.oneOnOneSession > 0 && payment.subtotal_amount) {
                        const pricePerSessionCents = siteConfig.pricing.oneOnOneSession * 100;
                        const calculatedQuantity = Math.round(payment.subtotal_amount / pricePerSessionCents);
                        quantity = calculatedQuantity > 0 ? calculatedQuantity.toString() : '1'; // Default to 1 if calculation fails
                        // console.log(`[PaymentPage Effect] Calculated quantity ${quantity} for individual session payment ${payment.id} based on subtotal ${payment.subtotal_amount} and price ${pricePerSessionCents}`);
                    } else {
                        console.error("Individual session price is zero, not configured, or subtotal_amount missing. Cannot determine quantity.");
                        setFetcherError("Configuration error: Cannot determine individual session quantity.");
                        return;
                    }
                    break;
                case 'store_purchase': // Add case for store purchase
                    paymentOption = 'store'; // Use a specific identifier or null if API handles it
                    // No priceId, quantity, or studentIds needed here as amounts are passed directly
                    break;
                case 'event_registration': // Add case for event registration
                    paymentOption = 'event'; // Use event-specific payment option
                    // No priceId, quantity, or studentIds needed here as amounts are passed directly
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


            // Price ID validation is handled by the payment provider
            if (priceId) formData.append('priceId', priceId);


            if (paymentOption === 'individual' && !quantity) {
                console.error(`Quantity missing for ${paymentOption} payment ${payment.id}.`);
                setFetcherError(`Configuration error: Quantity missing for ${paymentOption}.`);
                return;
            }
            if (quantity) formData.append('quantity', quantity);

            // Append orderId specifically for store purchases
            if (paymentOption === 'store') {
                if (!payment.order_id) { // Validate that order_id exists on the payment record
                    console.error(`Store purchase payment ${payment.id} is missing the required order_id.`);
                    setFetcherError("Configuration error: Cannot process store payment without linked order.");
                    return;
                }
                formData.append('orderId', payment.order_id); // Append orderId
            }


            // console.log("[PaymentPage Effect] Submitting to /api/create-payment-intent with formData:", Object.fromEntries(formData));
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

                // Verify amounts match as a sanity check (compare subtotal, tax, and total)
                if (payment) {
                    let mismatch = false;
                    // The database now stores the discounted subtotal, so compare directly
                    if (paymentIntentFetcher.data.subtotalAmount !== payment.subtotal_amount) {
                        console.error(`Subtotal Amount mismatch! DB record: ${payment.subtotal_amount}, Intent created: ${paymentIntentFetcher.data.subtotalAmount}`);
                        mismatch = true;
                    }
                    // Verify total tax amount (Commented out comparison - only check subtotal and total)
                    // const dbTotalTax = payment.payment_taxes?.reduce((sum, tax) => sum + tax.tax_amount, 0) ?? 0;
                    // if (paymentIntentFetcher.data.taxAmount !== dbTotalTax) {
                    //     console.error(`Total Tax Amount mismatch! DB record sum: ${dbTotalTax}, Intent created: ${paymentIntentFetcher.data.taxAmount}`);
                    //     mismatch = true;
                    // }
                    if (paymentIntentFetcher.data.totalAmount !== payment.total_amount) {
                        console.error(`Total Amount mismatch! DB record: ${payment.total_amount}, Intent created: ${paymentIntentFetcher.data.totalAmount}`);
                        mismatch = true;
                    }
                    if (mismatch) {
                        setFetcherError("Payment amount mismatch detected. Please contact support immediately.");
                        setClientSecret(null); // Prevent payment attempt with wrong amount
                    }
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
                {/* Display Subtotal (already discounted) */}
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold">Subtotal:</span> {formatMoney(fromCents(payment.subtotal_amount))}
                    {payment.discount_amount && payment.discount_amount > 0 && (
                        <span className="text-green-600 dark:text-green-400 ml-2">
                            (discount applied)
                        </span>
                    )}
                </p>
                {/* Display Grouped Tax Breakdown */}
                {groupedTaxes.length > 0 && (
                    groupedTaxes.map((tax, index) => (
                        <p key={index} className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-semibold">
                                {tax.description}:
                            </span> {formatMoney(fromCents(tax.amount))}
                        </p>
                    ))
                )}
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-2 border-t pt-2 dark:border-gray-600">
                    {/* Display the final total amount */}
                    <span className="font-semibold">Total Amount:</span> {formatMoney(fromCents(payment.total_amount))}
                </p>
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

            <PaymentForm
                payment={payment}
                providerConfig={providerConfig}
                clientSecret={clientSecret}
                providerData={undefined} // No provider-specific data needed in this flow
                onError={handleError}
            />


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
