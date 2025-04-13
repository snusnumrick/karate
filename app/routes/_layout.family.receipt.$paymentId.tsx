import { json, type LoaderFunctionArgs, type MetaFunction, TypedResponse } from "@remix-run/node";
import { Link, useLoaderData, useRouteError } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Printer } from "lucide-react";
import type { Database } from "~/types/supabase";
import { siteConfig } from "~/config/site"; // Import site config for business details
import { format } from 'date-fns'; // For formatting dates

// Define the types for the data needed for the receipt
type PaymentTaxRow = Database['public']['Tables']['payment_taxes']['Row'];
type FamilyRow = Database['public']['Tables']['families']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row']; // Includes card_last4 now
type OneOnOneSessionRow = Database['public']['Tables']['one_on_one_sessions']['Row'];

type ReceiptPaymentData = PaymentRow & {
    families: Pick<FamilyRow, 'name' | 'email' | 'address' | 'city' | 'province' | 'postal_code'> | null;
    payment_taxes: Array<Pick<PaymentTaxRow, 'tax_name_snapshot' | 'tax_amount' | 'tax_rate_snapshot'>>;
    one_on_one_sessions: Array<Pick<OneOnOneSessionRow, 'quantity_purchased'>>; // Fetch quantity if applicable
    // card_last4 is already included via PaymentRow
};

type LoaderData = {
    payment?: ReceiptPaymentData;
    error?: string;
    businessName?: string;
    businessAddress?: string; // Add more business details as needed
    businessPhone?: string;
    businessEmail?: string;
};

// Helper function to get user-friendly product description (copied from success page)
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

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const paymentId = data?.payment?.id ? ` ${data.payment.id}` : "";
    return [
        { title: `Payment Receipt${paymentId} - ${siteConfig.name}` },
        { name: "description", content: `View your payment receipt from ${siteConfig.name}.` },
        // Prevent indexing of receipt pages
        { name: "robots", content: "noindex, nofollow" },
    ];
};

export async function loader({ request, params }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const paymentId = params.paymentId;
    const { supabaseServer, response, supabaseClient } = getSupabaseServerClient(request);

    if (!paymentId) {
        return json({ error: "Payment ID missing." }, { status: 400, headers: response.headers });
    }

    // Verify user is logged in
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        // Although the _layout should handle this, double-check here for route-specific logic
        return json({ error: "Not authenticated." }, { status: 401, headers: response.headers });
    }

    // Fetch payment details including related family, tax info, and card_last4
    // Use supabaseServer (service role) for potentially broader access if needed,
    // but rely on RLS check below for authorization.
    const { data: paymentData, error: dbError } = await supabaseServer
        .from('payments')
        .select(`
            *,
            card_last4,
            families ( name, email, address, city, province, postal_code ),
            payment_taxes ( tax_name_snapshot, tax_amount, tax_rate_snapshot ),
            one_on_one_sessions ( quantity_purchased )
        `)
        .eq('id', paymentId)
        .maybeSingle(); // Use maybeSingle to handle not found case

    if (dbError) {
        console.error(`[Receipt Loader] Error fetching payment ${paymentId}:`, dbError.message);
        return json({ error: `Database error: ${dbError.message}` }, { status: 500, headers: response.headers });
    }

    if (!paymentData) {
        return json({ error: "Payment record not found." }, { status: 404, headers: response.headers });
    }

    // Authorization Check: Ensure the logged-in user belongs to the family associated with the payment
    // Fetch profile using the standard client which respects RLS based on the user's session
    const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('family_id')
        .eq('id', session.user.id)
        .single();

    if (profileError) {
         console.error(`[Receipt Loader] Error fetching profile for user ${session.user.id}:`, profileError.message);
         return json({ error: "Could not verify user authorization." }, { status: 500, headers: response.headers });
    }

    if (!profileData || profileData.family_id !== paymentData.family_id) {
        console.warn(`[Receipt Loader] Authorization failed for user ${session.user.id} trying to access payment ${paymentId} for family ${paymentData.family_id}`);
        return json({ error: "You are not authorized to view this receipt." }, { status: 403, headers: response.headers });
    }

    // Only return successful payments for receipts.
    if (paymentData.status !== 'succeeded') {
         console.warn(`[Receipt Loader] Attempt to access receipt for non-succeeded payment ${paymentId} with status ${paymentData.status}`);
         return json({ error: "A receipt is only available for successfully completed payments." }, { status: 400, headers: response.headers });
    }

    // Add business details from siteConfig
    const businessName = siteConfig.name;
    // Construct address string carefully, handling potential missing parts if needed
    const addressParts = [
        siteConfig.location.address, // Assuming address is a single string like "650 Allandale Rd Suite A101"
        siteConfig.location.locality,
        siteConfig.location.region,
        siteConfig.location.postalCode
    ].filter(Boolean); // Filter out any null/undefined/empty parts
    const businessAddress = addressParts.join(', ');
    const businessPhone = siteConfig.contact.phone;
    const businessEmail = siteConfig.contact.email;


    return json({
        payment: paymentData as ReceiptPaymentData,
        businessName,
        businessAddress,
        businessPhone,
        businessEmail
    }, { headers: response.headers });
}

export default function PaymentReceiptPage() {
    const { payment, error, businessName, businessAddress, businessPhone, businessEmail } = useLoaderData<LoaderData>();

    if (error) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <Alert variant="destructive">
                    <AlertTitle>Error Loading Receipt</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Link to="/family/payment-history" className="mt-6 inline-block">
                    <Button>Return to Payment History</Button>
                </Link>
            </div>
        );
    }

    // This case should be caught by the loader's status check, but handle defensively
    if (!payment || !payment.families || payment.status !== 'succeeded') {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>Could not load complete payment details or payment was not successful.</AlertDescription>
                </Alert>
                 <Link to="/family/payment-history" className="mt-6 inline-block">
                    <Button>Return to Payment History</Button>
                </Link>
            </div>
        );
    }

    const quantity = payment.one_on_one_sessions?.[0]?.quantity_purchased ?? null;
    const paymentDate = payment.payment_date ? format(new Date(payment.payment_date), 'PPP') : 'N/A'; // Format date like 'Jan 1, 2024'

    // Function to trigger browser print dialog
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            {/* Print Button - hidden when printing */}
            <div className="mb-6 text-right print:hidden">
                <Button onClick={handlePrint} variant="outline">
                    <Printer className="mr-2 h-4 w-4" /> Print Receipt
                </Button>
            </div>

            {/* Receipt Content - Use Tailwind print utilities */}
            {/* Apply text-black for printing regardless of dark mode */}
            <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 md:p-10 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 print:shadow-none print:border-none print:bg-transparent print:dark:bg-transparent print:text-black">
                <header className="mb-8 border-b border-gray-300 dark:border-gray-600 pb-6 print:border-black">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div className="mb-4 sm:mb-0">
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white print:text-black">{businessName}</h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 print:text-black">{businessAddress}</p>
                            {/* Add Phone/Email */}
                            <p className="text-sm text-gray-600 dark:text-gray-400 print:text-black">Phone: {businessPhone}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 print:text-black">Email: {businessEmail}</p>
                        </div>
                        <div className="text-left sm:text-right">
                            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-1 print:text-black">Payment Receipt</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 print:text-black">Receipt #: {payment.id}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 print:text-black">Date Paid: {paymentDate}</p>
                        </div>
                    </div>
                </header>

                <section className="mb-8">
                    <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200 print:text-black">Bill To:</h3>
                    <p className="text-gray-700 dark:text-gray-300 print:text-black">{payment.families.name}</p>
                    <p className="text-gray-700 dark:text-gray-300 print:text-black">{payment.families.email}</p>
                    <p className="text-gray-700 dark:text-gray-300 print:text-black">{payment.families.address}</p>
                    <p className="text-gray-700 dark:text-gray-300 print:text-black">{payment.families.city}, {payment.families.province} {payment.families.postal_code}</p>
                </section>

                {/* Add print:break-inside-avoid to try and keep this section together */}
                <section className="mb-8 print:break-inside-avoid">
                    <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200 print:text-black">Payment Details:</h3>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-300 dark:border-gray-600 print:border-black">
                                <th className="py-2 pr-2 font-semibold text-gray-700 dark:text-gray-300 print:text-black">Description</th>
                                <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300 print:text-black text-right">Amount (CAD)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Item Row */}
                            <tr className="border-b border-gray-200 dark:border-gray-700 print:border-gray-400">
                                <td className="py-3 pr-2 text-gray-700 dark:text-gray-300 print:text-black">{getPaymentProductDescription(payment.type, quantity)}</td>
                                <td className="py-3 px-2 text-gray-700 dark:text-gray-300 print:text-black text-right">${(payment.subtotal_amount / 100).toFixed(2)}</td>
                            </tr>
                            {/* Tax Rows */}
                            {payment.payment_taxes && payment.payment_taxes.map((tax, index) => (
                                <tr key={index} className="border-b border-gray-200 dark:border-gray-700 print:border-gray-400">
                                    {/* Indent tax lines slightly */}
                                    <td className="py-3 pr-2 text-gray-700 dark:text-gray-300 print:text-black pl-4">{tax.tax_name_snapshot} ({ (tax.tax_rate_snapshot * 100).toFixed(2) }%)</td>
                                    <td className="py-3 px-2 text-gray-700 dark:text-gray-300 print:text-black text-right">${(tax.tax_amount / 100).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            {/* Total Row */}
                            <tr className="border-t-2 border-gray-400 dark:border-gray-500 print:border-black">
                                <td className="pt-3 pr-2 text-right font-bold text-gray-800 dark:text-gray-100 print:text-black">Total Paid:</td>
                                <td className="pt-3 px-2 text-right font-bold text-gray-800 dark:text-gray-100 print:text-black">${(payment.total_amount / 100).toFixed(2)} CAD</td>
                            </tr>
                        </tfoot>
                    </table>
                    {/* Display Payment Method and Last 4 */}
                    {payment.payment_method && (
                         <p className="text-sm text-gray-600 dark:text-gray-400 print:text-black mt-4">
                             Paid via: {payment.payment_method}
                             {payment.card_last4 && ` ending in ${payment.card_last4}`}
                         </p>
                    )}
                </section>

                {/* Add print:hidden to hide the footer when printing */}
                <footer className="mt-10 text-center text-xs text-gray-500 dark:text-gray-400 print:text-black print:hidden">
                    <p>Thank you for your payment!</p>
                    <p>{businessName} - {businessAddress}</p>
                    {/* Optional: Add website URL */}
                    <p>{siteConfig.url}</p>
                </footer>
            </div>
             {/* Link back - hidden when printing */}
            <div className="mt-6 text-center print:hidden">
                 <Link to="/family/payment-history">
                    <Button variant="link">Back to Payment History</Button>
                </Link>
            </div>
        </div>
    );
}

// Basic ErrorBoundary for the receipt page
export function ErrorBoundary() {
    const error = useRouteError();
    console.error("[PaymentReceiptPage ErrorBoundary] Caught error:", error);

    let errorMessage = "Sorry, something went wrong while loading the receipt.";
    // Attempt to extract a meaningful message from the error
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (error && typeof error === 'object') {
        if ('statusText' in error && typeof error.statusText === 'string') {
             errorMessage = `Error: ${error.statusText}`;
        } else if ('message' in error && typeof error.message === 'string') {
             errorMessage = error.message; // For generic objects with a message
        } else if ('error' in error && typeof error.error === 'string') {
             errorMessage = error.error; // If error is { error: "message" }
        }
    }


    return (
        <div className="container mx-auto px-4 py-12 text-center">
            <Alert variant="destructive">
                <AlertTitle>Receipt Error</AlertTitle>
                <AlertDescription>
                    {errorMessage} Please try again or return to your payment history.
                </AlertDescription>
            </Alert>
            <div className="mt-6 space-x-4">
                 <Link to="/family/payment-history">
                    <Button>Return to Payment History</Button>
                </Link>
            </div>
        </div>
    );
}
