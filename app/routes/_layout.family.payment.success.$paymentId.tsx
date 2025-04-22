import { json, type LoaderFunctionArgs, TypedResponse } from "@remix-run/node";
import {Link, useLoaderData, useRevalidator, useRouteError, useSearchParams} from "@remix-run/react";
import { useEffect } from "react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { CheckCircle } from "lucide-react"; // Use lucide-react icon for consistency
import type { Database, Tables } from "~/types/database.types"; // Import Tables

// Define types for related tables needed for store purchases
type PaymentTaxRow = Database['public']['Tables']['payment_taxes']['Row'];
type OrderRow = Tables<'orders'>;
type OrderItemRow = Tables<'order_items'>;
type ProductVariantRow = Tables<'product_variants'>;
type ProductRow = Tables<'products'>;

// Define a type for the nested order item details needed
type OrderItemWithDetails = OrderItemRow & {
    product_variants: (Pick<ProductVariantRow, 'id' | 'size'> & {
        products: Pick<ProductRow, 'id' | 'name'> | null;
    }) | null;
};

// Define the type for the payment data expected by the loader, including tax breakdown
export type PaymentSuccessData = {
    id: string;
    status: Database['public']['Enums']['payment_status'];
    receipt_url: string | null;
    payment_method: string | null;
    payment_date: string | null;
    subtotal_amount: number;
    // tax_amount removed
    total_amount: number;
    type: Database['public']['Enums']['payment_type_enum'];
    payment_taxes: Array<Pick<PaymentTaxRow, 'tax_name_snapshot' | 'tax_amount'>>;
    // Add nested order details for store purchases
    orders: (Pick<OrderRow, 'id'> & {
        order_items: OrderItemWithDetails[];
    }) | null; // Fetch the related order and its items
    // Add quantity if needed for display (for non-store items)
    quantity?: number | null; // Make optional
};

type LoaderData = {
    payment?: PaymentSuccessData; // Use updated type
    error?: string;
    // Add quantity if fetched
    quantity?: number | null;
};

// Helper function to get user-friendly product description
function getPaymentProductDescription(type: Database['public']['Enums']['payment_type_enum'] | undefined | null, quantity?: number | null): string {
    switch (type) {
        case 'monthly_group':
            return 'Monthly Group Class Fee';
        case 'yearly_group':
            return 'Yearly Group Class Fee';
        case 'individual_session':
            return quantity ? `Individual Session(s) (Qty: ${quantity})` : 'Individual Session(s)';
        case 'other':
            return 'Other Payment';
        default:
            return 'Unknown Item';
    }
}


export async function loader({ request, params }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    // Get Stripe Payment Intent ID from URL query parameter `payment_intent`
    // OR get Supabase Payment ID from route parameter `paymentId` (for failed payments linking back)
    const url = new URL(request.url);
    const paymentIntentId = url.searchParams.get('payment_intent');
    const supabasePaymentId = params.paymentId; // This is the Supabase ID

    const { supabaseServer, response } = getSupabaseServerClient(request);

    if (!paymentIntentId && !supabasePaymentId) {
        console.error("[Payment Success Loader] Missing payment_intent query parameter AND paymentId route parameter.");
        return json({ error: "Payment identifier missing." }, { status: 400, headers: response.headers });
    }

    let payment: PaymentSuccessData | null = null;
    let error: string | undefined;
    let quantity: number | null = null;

    // Prioritize fetching by Stripe Payment Intent ID if available (standard success flow)
    if (paymentIntentId) {
        console.log(`[Payment Success Loader] Fetching payment record using Stripe PI ID: ${paymentIntentId}`);
        const { data: paymentData, error: dbError } = await supabaseServer
            .from('payments')
            // Select all required fields, including nested order details for store purchases
            .select(`
                id, status, receipt_url, payment_method, payment_date, subtotal_amount, total_amount, type,
                payment_taxes ( tax_name_snapshot, tax_amount ),
                orders (
                    id,
                    order_items (
                        *,
                        product_variants (
                            id,
                            size,
                            products ( id, name )
                        )
                    )
                )
            `)
            .eq('stripe_payment_intent_id', paymentIntentId)
            .maybeSingle();

        if (dbError) {
            console.error(`[Payment Success Loader] Error fetching payment by PI ID ${paymentIntentId}:`, dbError.message);
            error = `Database error: ${dbError.message}`;
        } else {
            payment = paymentData as PaymentSuccessData | null;
        }
    }
    // If not found by PI ID (or PI ID wasn't provided), try fetching by Supabase ID (failed payment retry flow)
    else if (supabasePaymentId) {
        console.log(`[Payment Success Loader] Fetching payment record using Supabase Payment ID: ${supabasePaymentId}`);
        const { data: paymentData, error: dbError } = await supabaseServer
            .from('payments')
            // Select all required fields, including nested order details for store purchases
            .select(`
                id, status, receipt_url, payment_method, payment_date, subtotal_amount, total_amount, type,
                payment_taxes ( tax_name_snapshot, tax_amount ),
                orders (
                    id,
                    order_items (
                        *,
                        product_variants (
                            id,
                            size,
                            products ( id, name )
                        )
                    )
                )
            `)
            .eq('id', supabasePaymentId)
            .maybeSingle();

        if (dbError) {
            console.error(`[Payment Success Loader] Error fetching payment by Supabase ID ${supabasePaymentId}:`, dbError.message);
            error = `Database error: ${dbError.message}`;
        } else {
            payment = paymentData as PaymentSuccessData | null;
        }
    }

    if (error) {
        return json({ error }, { status: 500, headers: response.headers });
    }

    // Handle case where payment record isn't found yet (webhook delay, only relevant for PI ID flow)
    if (!payment && paymentIntentId) {
        console.log(`[Payment Success Loader] Payment record for PI ID ${paymentIntentId} not found yet (likely webhook delay).`);
        // Return status indicating pending, client will auto-refresh
        return json({ payment: undefined }, { status: 200, headers: response.headers }); // Indicate pending state
    } else if (!payment && supabasePaymentId) {
        console.error(`[Payment Success Loader] Payment record for Supabase ID ${supabasePaymentId} not found.`);
        return json({ error: "Payment record not found." }, { status: 404, headers: response.headers });
    }

    // If payment was found (either way)
    if (payment) {
        console.log(`[Payment Success Loader] Found payment record ${payment.id} with status: ${payment.status}`);

        // Fetch quantity for individual sessions if applicable
        if (payment.type === 'individual_session') {
            const { data: sessionData, error: sessionError } = await supabaseServer
                .from('one_on_one_sessions')
                .select('quantity_purchased')
                .eq('payment_id', payment.id) // Link via the Supabase payment ID
                .maybeSingle();

            if (sessionError) {
                // Log the DETAILED error message to the server console for debugging
                console.error(`[Payment Success Loader] DETAILED Error fetching session quantity for payment ${payment.id}: Code=${sessionError.code}, Message=${sessionError.message}, Details=${sessionError.details}, Hint=${sessionError.hint}`);
                // Return a generic error instead of just logging
                // Use a generic message for the user, keep details in server logs
                error = "Error retrieving payment details. Please check your payment history later or contact support."; // Changed message slightly for clarity
                // Return immediately with the error
                return json({ error }, { status: 500, headers: response.headers });
            } else if (sessionData) {
                quantity = sessionData.quantity_purchased;
                console.log(`[Payment Success Loader] Fetched quantity ${quantity} for individual session payment ${payment.id}`);
            }
        }

        // Fetch quantity for individual sessions if applicable (and payment was found)
        if (payment && payment.type === 'individual_session') {
            const { data: sessionData, error: sessionError } = await supabaseServer
                .from('one_on_one_sessions')
                .select('quantity_purchased')
                .eq('payment_id', payment.id) // Link via the Supabase payment ID
                .maybeSingle();

            if (sessionError) {
                // Log the DETAILED error message to the server console for debugging
                console.error(`[Payment Success Loader] DETAILED Error fetching session quantity for payment ${payment.id}: Code=${sessionError.code}, Message=${sessionError.message}, Details=${sessionError.details}, Hint=${sessionError.hint}`);
                // Return a generic error instead of just logging
                // Use a generic message for the user, keep details in server logs
                error = "Error retrieving payment details. Please check your payment history later or contact support."; // Changed message slightly for clarity
                // Return immediately with the error
                return json({ error }, { status: 500, headers: response.headers });
            } else if (sessionData) {
                quantity = sessionData.quantity_purchased;
                console.log(`[Payment Success Loader] Fetched quantity ${quantity} for individual session payment ${payment.id}`);
            } else {
                // Log if no session record found for an individual session payment
                 console.warn(`[Payment Success Loader] No one_on_one_sessions record found for individual session payment ID ${payment.id}. Quantity will be null.`);
                 // Quantity remains null, which might be acceptable or indicate an issue elsewhere (e.g., webhook)
            }
        }
    }

    // Return the fetched payment data (including quantity if applicable)
    return json({ payment: payment as PaymentSuccessData, quantity }, { headers: response.headers });
}


export default function PaymentSuccessPage() {
    const { payment, error, quantity } = useLoaderData<LoaderData>();
    const revalidator = useRevalidator();
    const [searchParams] = useSearchParams(); // Get search params

    // Auto-refresh mechanism if payment status is pending initially (only if loaded via payment_intent)
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        // Only auto-refresh if loaded via payment_intent and status is pending
        if (searchParams.has('payment_intent') && (!payment || payment.status === 'pending')) {
            console.log("[Payment Success Effect] Payment status is pending or data missing (via PI), setting up revalidation interval.");
            intervalId = setInterval(() => {
                console.log("[Payment Success Effect] Revalidating loader data...");
                revalidator.revalidate();
            }, 3000); // Revalidate every 3 seconds
        }

        // Cleanup interval on component unmount or when payment status is no longer pending
        return () => {
            if (intervalId) {
                console.log("[Payment Success Effect] Clearing revalidation interval.");
                clearInterval(intervalId);
            }
        };
        // Depend on payment object, revalidator, and searchParams presence
    }, [payment, revalidator, searchParams]);


    if (error) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Link to="/family" className="mt-6 inline-block">
                    <Button>Return to Family Portal</Button>
                </Link>
            </div>
        );
    }

    // Display loading/pending state (only if loaded via payment_intent)
    if (searchParams.has('payment_intent') && (!payment || payment.status === 'pending')) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <div className="flex justify-center items-center mb-4">
                    {/* Optional: Add a spinner */}
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Processing payment, please wait...</p>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">This page will update automatically once the payment is confirmed.</p>
            </div>
        );
    }

    // If payment data is still missing after checks (e.g., invalid ID passed via route param)
    if (!payment) {
         return (
            <div className="container mx-auto px-4 py-12 text-center">
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>Could not load payment details.</AlertDescription>
                </Alert>
                <Link to="/family" className="mt-6 inline-block">
                    <Button>Return to Family Portal</Button>
                </Link>
            </div>
        );
    }

    // Display success or failed state based on the final loaded payment status
    const isSuccess = payment.status === 'succeeded';

    return (
        <div className="container mx-auto px-4 py-12 text-center">
            <div className="max-w-lg mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border dark:border-gray-700">
                {isSuccess ? (
                    <>
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" /> {/* Updated icon component */}
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">Thank you for your payment.</p>

                        <div className="text-left space-y-2 mb-6 border-t border-b border-gray-200 dark:border-gray-700 py-4">
                            <p><span className="font-semibold">Payment ID:</span> {payment.id}</p>
                            {/* Display Product Details */}
                            {payment.type === 'store_purchase' && payment.orders?.order_items ? (
                                payment.orders.order_items.map(item => (
                                    <p key={item.id}>
                                        <span className="font-semibold">Product:</span>{' '}
                                        {item.product_variants?.products?.name ?? 'Unknown Product'}
                                        {item.product_variants?.size && ` - Size: ${item.product_variants.size}`}
                                        {item.quantity > 1 && ` (Qty: ${item.quantity})`}
                                    </p>
                                ))
                            ) : (
                                <p><span className="font-semibold">Product:</span> {getPaymentProductDescription(payment.type, quantity)}</p>
                            )}
                            {/* Display amount breakdown */}
                            <p><span className="font-semibold">Subtotal:</span> ${(payment.subtotal_amount / 100).toFixed(2)} CAD</p>
                            {/* Display Tax Breakdown */}
                            {payment.payment_taxes && payment.payment_taxes.length > 0 && (
                                payment.payment_taxes.map((tax, index) => (
                                    <p key={index}><span className="font-semibold">{tax.tax_name_snapshot}:</span> ${(tax.tax_amount / 100).toFixed(2)} CAD</p>
                                ))
                            )}
                            <p className="font-bold border-t pt-2 mt-2 dark:border-gray-600"><span className="font-semibold">Total Amount Paid:</span> ${(payment.total_amount / 100).toFixed(2)} CAD</p>
                            {payment.payment_method && <p><span className="font-semibold">Payment Method:</span> {payment.payment_method.replace('_', ' ').toUpperCase()}</p>}
                            {payment.receipt_url && (
                                    <p className="mt-2"> {/* Add margin top for spacing */}
                                        <span className="font-semibold">Receipt:</span>{' '}
                                        {/* Link to our internal receipt page */}
                                        <Link to={payment.receipt_url} className="text-blue-600 hover:underline" prefetch="intent" target="_blank" rel="noopener noreferrer">
                                            View Receipt
                                        </Link>
                                        {/* Add target blank to open in new tab */}
                                    </p>
                                )}
                        </div>

                        <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 mt-6">
                             {/* Link to the internal receipt page if available */}
                             {payment.receipt_url && (
                                <Link to={payment.receipt_url} prefetch="intent" target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline">View Receipt</Button>
                                </Link>
                             )}
                            <Link to="/family">
                                <Button>Return to Family Portal</Button>
                            </Link>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Failed State */}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-16 w-16 text-red-500 mx-auto mb-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.008v.008H12v-.008Z" />
                        </svg>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Failed</h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">Unfortunately, your payment could not be processed.</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">Please try again or contact support if the problem persists.</p>

                        <div className="flex justify-center space-x-4">
                            {/* Link back to the payment page using the Supabase Payment ID */}
                            <Link to={`/pay/${payment.id}`}>
                                <Button variant="outline">Try Again</Button>
                            </Link>
                            <Link to="/family">
                                <Button>Return to Family Portal</Button>
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Add a basic ErrorBoundary for the page
export function ErrorBoundary() {
    const error = useRouteError(); // Use this hook to get the error
    console.error("[PaymentSuccessPage ErrorBoundary] Caught error:", error); // Log the caught error

    // Determine if the error is likely a Response object from the loader
    let errorMessage = "Sorry, something went wrong.";
    if (error instanceof Error) {
        errorMessage = error.message; // Use generic Error message
    }
    // You could add more specific checks here if needed, e.g., for Response objects

    return (
        <div className="container mx-auto px-4 py-12 text-center">
            <Alert variant="destructive">
                <AlertTitle>Payment Confirmation Error</AlertTitle>
                <AlertDescription>
                    {errorMessage} Please try refreshing the page or return to the family portal.
                </AlertDescription>
            </Alert>
            <div className="mt-6 space-x-4">
                 <Link to="/family">
                    <Button>Return to Family Portal</Button>
                </Link>
                 {/* Optional: Add a refresh button */}
                 {/* <Button onClick={() => window.location.reload()} variant="outline">Refresh Page</Button> */}
            </div>
        </div>
    );
}
