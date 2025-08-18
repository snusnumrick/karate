import { json, type LoaderFunctionArgs, redirect, TypedResponse } from "@remix-run/node";
import { Link, useFetcher, useLoaderData, useRouteError } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import {PaymentElement, LinkAuthenticationElement, Elements, useElements, useStripe} from "@stripe/react-stripe-js";
import Stripe from "stripe";
import {getSupabaseServerClient, getSupabaseAdminClient} from "~/utils/supabase.server";
import {Button} from "~/components/ui/button";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {siteConfig} from "~/config/site";
import type {Database} from "~/types/database.types";
import { ClientOnly } from "~/components/client-only";

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
    stripePublishableKey: string;
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
        case 'other':
            return 'Other Payment';
        default:
            return 'Unknown Item';
    }
}

// --- Loader ---
export async function loader({request, params}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
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

    const {response} = getSupabaseServerClient(request);
    const supabaseAdmin = getSupabaseAdminClient();

    // Fetch payment, family name, and associated student IDs in one go
    // Restore full select statement
    // Fetch payment, including new amount columns and related taxes
    const {data: payment, error} = await supabaseAdmin
        .from('payments')
        .select(`
            id, family_id, subtotal_amount, total_amount, payment_date, payment_method, status, stripe_session_id, stripe_payment_intent_id, receipt_url, notes, type, order_id,
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

        if (!stripeSecretKey) {
            console.error("[Loader] Missing Stripe Secret Key for pending check.");
            // Proceed cautiously, maybe let the user try, but log the config error
        } else {
            const stripe = new Stripe(stripeSecretKey);
            const supabaseAdmin = getSupabaseAdminClient();

            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, {
                    expand: ['latest_charge'] // Expand charge to potentially get receipt URL
                });
                // console.log(`[Loader] Stripe PI status for ${paymentIntent.id}: ${paymentIntent.status}`);

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
    // console.log('[Loader] Data prepared for return:', loaderReturnData);

    // Cast payment to PaymentWithDetails to satisfy LoaderData type
    return json<LoaderData>(loaderReturnData, {headers: response.headers});
}

// Remove top-level stripePromise initialization - it will be done inside the component

// --- CheckoutForm Component (Handles Card Element and Submission) ---
interface CheckoutFormProps {
    payment: PaymentWithDetails;
    // clientSecret is passed via Elements options, not needed here
    defaultEmail?: string | null;
    defaultPostalCode?: string | null;
}

function CheckoutForm({payment, defaultEmail, defaultPostalCode}: CheckoutFormProps) {
    const stripe = useStripe();
    const elements = useElements();
    // const navigate = useNavigate(); // Not used, Stripe handles redirect
    // const [email, setEmail] = useState(''); // Not used, LinkAuthenticationElement handles email internally
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    // console.log('Checkout Form, payment: ', payment);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPaymentError(null); // Clear previous errors

        if (!stripe || !elements) {
            // Stripe.js has not yet loaded.
            console.error("Stripe.js has not loaded yet.");
            setPaymentError("Payment system is not ready. Please wait a moment and try again.");
            return;
        }

        // No need to get CardElement explicitly when using PaymentElement

        setIsProcessing(true);

        // Use confirmPayment with the clientSecret obtained earlier
        // paymentIntent is not needed here as success redirects automatically
        const {error} = await stripe.confirmPayment({
            elements, // Pass the elements provider instance
            confirmParams: {
                // Make sure to change this to your payment completion page
                return_url: `${window.location.origin}/payment/success`,
                // Optional: Add payment_method_data like billing_details if needed
                // payment_method_data: {
                //   billing_details: {
                //     // name: 'Jenny Rosen', // Example - Link Auth Element often handles this
                //   },
                // }
            },
            // Optional: redirect: 'if_required' (default) or 'always'
            // redirect: 'if_required'
        });

        // If `confirmPayment` fails or requires user action, it will throw an error.
        // If it succeeds, it redirects the user to the `return_url` you specified.
        // Therefore, you only need to handle the error case here.
        // The success case (navigation) is handled by Stripe.js based on the return_url.

        if (error) {
            // This error could be either a type='card_error' or type='validation_error'
            // or another type like 'api_error'.
            console.error("Stripe confirmCardPayment error:", error);
            // Handle specific error types if needed (e.g., card errors vs. API errors)
            console.error("Stripe confirmPayment error:", error);
            setPaymentError(error.message || "An unexpected error occurred. Please try again.");
            setIsProcessing(false); // Allow user to retry
        }
        // No need for `else if (paymentIntent?.status === 'succeeded')` because
        // `confirmPayment` automatically redirects on success based on `return_url`.
        // If we reach here after the await, it means there was an error or redirection didn't happen (which shouldn't occur for standard flows).
        // If redirection *doesn't* happen for some reason (e.g., popup blocker, unusual payment method flow),
        // Stripe.js might still update the PaymentIntent status. You *could* add logic here to check
        // paymentIntent.status again, but it's generally not required for typical card/wallet payments.
        // The primary path is: success -> redirect; failure -> error message.
    };

    // Remove cardElementOptions - Styling is handled by Appearance API via Elements options

    // Define Payment Element options including wallets and default values
    const paymentElementOptions = useMemo(() => ({
        layout: "tabs" as const, // Use const assertion for layout type
        wallets: {
            applePay: 'auto' as const, // Show Apple Pay if available
            googlePay: 'auto' as const // Show Google Pay if available
        },
        // Add defaultValues to prefill form fields
        defaultValues: {
            billingDetails: {
                email: defaultEmail ?? undefined, // Use fetched email or undefined
                address: {
                    postal_code: defaultPostalCode ?? undefined, // Use fetched postal code or undefined
                    country: siteConfig.localization.country, // Set country from site config
                },
            },
        },
    }), [defaultEmail, defaultPostalCode]); // Recompute options if defaults change

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Add Link Authentication Element */}
            <LinkAuthenticationElement
                id="link-authentication-element"
                // Prefill the email if it's available from user data (optional)
                // defaultValue={userEmail}
                // onChange={(e) => setEmail(e.value.email)} // setEmail was removed, remove handler
                className="mb-4" // Add some spacing
            />

            {/* Pass options to PaymentElement */}
            <PaymentElement id="payment-element" options={paymentElementOptions}/>

            {paymentError && (
                <Alert variant="destructive" className="mt-4"> {/* Add margin top */}
                    <AlertTitle>Payment Error</AlertTitle>
                    <AlertDescription>{paymentError}</AlertDescription>
                </Alert>
            )}

            <Button
                type="submit"
                // Disable button if Stripe.js hasn't loaded, elements aren't available, or payment is processing.
                disabled={!stripe || !elements || isProcessing}
                className="w-full"
            >
                {/* Display FINAL total amount on button */}
                {isProcessing ? 'Processing...' : `Pay $${(payment.total_amount / 100).toFixed(2)}`}
            </Button>
        </form>
    );
}


// --- Main Payment Page Component ---
export default function PaymentPage() {
    // console.log("[PaymentPage] Component rendering started.");
    // payment object now contains the status
    const {payment, stripePublishableKey, error: loaderError} = useLoaderData<LoaderData>();
    // Use the combined type for the fetcher
    const paymentIntentFetcher = useFetcher<ApiActionResponse>();
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [fetcherError, setFetcherError] = useState<string | null>(null);
    // State to hold the loaded Stripe promise/instance
    const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
    // State to hold the detected theme ('light' or 'dark')
    const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light'); // Default to light initially

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

    // Options for Stripe Elements provider - Memoize to prevent unnecessary re-renders
    // Moved to top level before early returns to satisfy Rules of Hooks
    const options = useMemo<StripeElementsOptions | undefined>(() => {
        if (!clientSecret) return undefined;

        // Define appearance based on common UI elements (Tailwind/shadcn defaults)
        // Determine effective theme (handle 'system')
        // Note: This assumes your ThemeProvider resolves 'system' correctly.
        // If using next-themes, it might return 'system' initially.
        // A robust solution might involve checking resolvedTheme if available,
        // or defaulting to light/dark based on media query if theme is 'system'.
        // For simplicity here, we'll treat 'system' like 'light' initially,
        // Define appearance based on the detected theme state
        const appearance: StripeElementsOptions['appearance'] = {
            theme: currentTheme === 'dark' ? 'night' : 'stripe', // Use 'night' for dark, 'stripe' for light/auto
            variables: {
                // --- Common Variables (Apply to both themes unless overridden) ---
                colorPrimary: '#22c55e',     // Focus ring/border (green-500)
                colorDanger: '#ef4444',     // Error text (red-500)
                borderRadius: '0.375rem',   // Match form inputs (rounded-md)

                // --- Theme-Specific Overrides ---
                ...(currentTheme === 'dark'
                    ? { // Dark Theme Variables (match your existing dark mode)
                        colorBackground: '#374151', // Input background (gray-700)
                        colorText: '#ffffff',       // Input text (white)
                        colorTextSecondary: '#d1d5db', // Labels etc (gray-300)
                        colorTextPlaceholder: '#9ca3af', // Placeholder text (gray-400)
                        colorIcon: '#9ca3af',       // Icons in inputs (gray-400)
                        // colorBorder: '#4b5563',     // Input border (gray-600) - Removed invalid variable
                    }
                    : { // Light Theme Variables (match typical light mode)
                        colorBackground: '#ffffff', // Input background (white)
                        colorText: '#1f2937',       // Input text (gray-800)
                        colorTextSecondary: '#6b7280', // Labels etc (gray-500)
                        colorTextPlaceholder: '#9ca3af', // Placeholder text (gray-400)
                        colorIcon: '#9ca3af',       // Icons in inputs (gray-400)
                        // colorBorder: '#d1d5db',     // Input border (gray-300) - Removed invalid variable
                    }),
            },
            rules: {
                // --- Focus State (Common) ---
                 // Focus styling is primarily handled by the 'colorPrimary' variable now.
                // Removed invalid rule: '.Input--focus'

                // Add other rules if variables aren't sufficient for specific elements
                // e.g., Tab styling if variables don't cover it adequately
                '.Tab': {
                    // Base tab styles if needed
                },
                '.Tab:hover': {
                    // Hover styles
                },
                 '.Tab--selected': {
                    // Selected tab styles - variables might handle this
                 },
            }
        };

        return {clientSecret, appearance};

    }, [clientSecret, currentTheme]); // Recreate options when clientSecret OR currentTheme changes

    // console.log('PaymentPage, payment: ', payment);

    // --- Effect to Detect Theme ---
    useEffect(() => {
        // Function to check and set theme
        const checkTheme = () => {
            const isDarkMode = document.documentElement.classList.contains('dark');
            // console.log("[PaymentPage Theme Effect] Checking theme. Is dark mode?", isDarkMode);
            setCurrentTheme(isDarkMode ? 'dark' : 'light');
        };

        // Check theme on initial mount
        checkTheme();

        // Optional: Observe changes to the class attribute of the html element
        // This is more robust if the theme can change while the page is open
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    console.log("[PaymentPage Theme Effect] Detected class change on <html>.");
                    checkTheme(); // Re-check theme on class change
                }
            }
        });

        observer.observe(document.documentElement, { attributes: true });

        // Cleanup observer on component unmount
        return () => {
            console.log("[PaymentPage Theme Effect] Cleaning up theme observer.");
            observer.disconnect();
        };
    }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

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
            let paymentOption: 'monthly' | 'yearly' | 'individual' | 'store' | null = null; // Added 'store'
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

    // console.log('PaymentPage, memoized options: ', options); // Keep log before return
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
                    <span className="font-semibold">Subtotal:</span> ${(payment.subtotal_amount / 100).toFixed(2)}
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
                            </span> ${(tax.amount / 100).toFixed(2)}
                        </p>
                    ))
                )}
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-2 border-t pt-2 dark:border-gray-600">
                    {/* Display the final total amount */}
                    <span className="font-semibold">Total Amount:</span> ${(payment.total_amount / 100).toFixed(2)} {siteConfig.localization.currency}
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

            {/* Wrap Stripe Elements Form in ClientOnly */}
            <ClientOnly fallback={<p className="text-center text-gray-600 dark:text-gray-400 py-8">Loading payment form...</p>}>
                {() => (
                    // Ensure stripePromise state is loaded and we have options (clientSecret)
                    stripePromise && options && !fetcherError ? (
                        // Add key={clientSecret} to force remount when secret changes
                        <Elements key={clientSecret} stripe={stripePromise} options={options}>
                            <CheckoutForm
                                payment={payment} // clientSecret removed from CheckoutForm props
                                defaultEmail={payment.family?.email} // Pass family email
                                defaultPostalCode={payment.family?.postal_code} // Pass family postal code
                            />
                        </Elements>
                    ) : (
                        // Show loading only if no error and not already initializing inside ClientOnly
                        !fetcherError && paymentIntentFetcher.state !== 'submitting' &&
                        <p className="text-center text-gray-600 dark:text-gray-400 py-8">Initializing payment form...</p>
                    )
                )}
            </ClientOnly>
            {/* End Stripe Elements Form Wrapper */}


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
