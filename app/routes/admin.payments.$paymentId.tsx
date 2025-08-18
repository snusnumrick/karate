import { json, type ActionFunctionArgs, type LoaderFunctionArgs, TypedResponse } from "@remix-run/node"; // Add ActionFunctionArgs
import { Link, useLoaderData, useRouteError, useParams, useFetcher } from "@remix-run/react"; // Add useFetcher
import { getSupabaseAdminClient } from '~/utils/supabase.server';
import { formatDate } from "~/utils/misc"; // Import formatDate utility
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { siteConfig } from "~/config/site";
import type { Database } from "~/types/database.types";
import { PaymentStatus } from "~/types/models"; // Import the enum
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

// Define the detailed payment type expected by the loader
type PaymentColumns = Database['public']['Tables']['payments']['Row'];
type FamilyRow = Database['public']['Tables']['families']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];
type PaymentTaxRow = Database['public']['Tables']['payment_taxes']['Row'];
type TaxRateRow = Database['public']['Tables']['tax_rates']['Row'];

type PaymentDetail = Omit<PaymentColumns, 'amount' | 'tax_amount'> & {
    family: Pick<FamilyRow, 'id' | 'name'> | null;
    payment_students: Array<{
        students: Pick<StudentRow, 'id' | 'first_name' | 'last_name'> | null;
    }>;
    payment_taxes: Array<
        Pick<PaymentTaxRow, 'tax_name_snapshot' | 'tax_amount'> & {
            tax_rates: Pick<TaxRateRow, 'description'> | null;
        }
    >;
};

type LoaderData = {
    payment: PaymentDetail;
};

// Type for the action response
type ActionData = {
    success?: boolean;
    message?: string;
    error?: string;
};


// Helper function to get user-friendly product description
function getPaymentProductDescription(type: Database['public']['Enums']['payment_type_enum'] | undefined | null): string {
    switch (type) {
        case 'monthly_group': return 'Monthly Group Class Fee';
        case 'yearly_group': return 'Yearly Group Class Fee';
        case 'individual_session': return 'Individual Session(s)';
        case 'other': return 'Other Payment';
        default: return 'Unknown Item';
    }
}

// Helper function to format status with appropriate badge variant
function getStatusBadgeVariant(status: PaymentStatus): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
        case PaymentStatus.Succeeded: return "default"; // Greenish in shadcn default theme
        case PaymentStatus.Pending: return "secondary"; // Gray
        case PaymentStatus.Failed: return "destructive"; // Red
        default: return "outline";
    }
}

export async function loader({ params }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const paymentId = params.paymentId;
    if (!paymentId) {
        throw new Response("Payment ID not provided", { status: 400 });
    }

    console.log(`[Admin Payment Detail Loader] Fetching details for payment ID: ${paymentId}`);

    const supabaseAdmin = getSupabaseAdminClient();

    const MAX_RETRIES = 4;
    const RETRY_DELAY_MS = 250;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const { data: payment, error } = await supabaseAdmin
            .from('payments')
            .select(`
                *,
                family:family_id ( id, name ),
                payment_students!left (
                    students ( id, first_name, last_name )
                ),
                payment_taxes!left (
                    tax_name_snapshot,
                    tax_amount,
                    tax_rates ( description )
                )
            `)
            .eq('id', paymentId)
            .single(); // Expect exactly one record

        if (error) {
            console.error(`[Admin Payment Detail Loader] Error on attempt ${attempt} fetching payment ${paymentId}:`, error.message);
            // Don't retry on database errors, fail fast.
            throw new Response(`Database Error: ${error.message}`, { status: 500 });
        }

        if (payment) {
            console.log(`[Admin Payment Detail Loader] Successfully fetched payment ${paymentId} on attempt ${attempt}.`);
            return json({ payment: payment as PaymentDetail });
        }

        // If payment is not found, wait and retry
        if (attempt < MAX_RETRIES) {
            console.log(`[Admin Payment Detail Loader] Payment ${paymentId} not found on attempt ${attempt}. Retrying in ${RETRY_DELAY_MS}ms...`);
            await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
        }
    }

    // If loop completes without finding a payment
    console.log(`[Admin Payment Detail Loader] Payment ${paymentId} not found after ${MAX_RETRIES} attempts.`);
    throw new Response("Payment not found", { status: 404 });
}

// --- Action Function ---
export async function action({ request, params }: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const paymentId = params.paymentId;
    if (!paymentId) {
        return json({ error: "Payment ID missing from request." }, { status: 400 });
    }

    const formData = await request.formData();
    const newStatus = formData.get("newStatus") as string;

    if (!newStatus || !['succeeded', 'failed'].includes(newStatus)) {
        return json({ error: "Invalid target status provided." }, { status: 400 });
    }

    console.log(`[Admin Payment Action] Attempting to update payment ${paymentId} to status: ${newStatus}`);

    const supabaseAdmin = getSupabaseAdminClient();

    try {
        const updateData: Partial<Database['public']['Tables']['payments']['Update']> = {
            status: newStatus as PaymentStatus,
            payment_date: new Date().toISOString(), // Set payment date on manual update
            updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabaseAdmin
            .from('payments')
            .update(updateData)
            .eq('id', paymentId);

        if (updateError) {
            console.error(`[Admin Payment Action] Error updating payment ${paymentId}:`, updateError.message);
            return json({ error: `Database error: ${updateError.message}` }, { status: 500 });
        }

        console.log(`[Admin Payment Action] Successfully updated payment ${paymentId} to ${newStatus}.`);
        // Revalidation should happen automatically via fetcher, return success
        return json({ success: true, message: `Payment status updated to ${newStatus}.` });

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`[Admin Payment Action] Unexpected error for payment ${paymentId}:`, message);
        return json({ error: message }, { status: 500 });
    }
}
// --- End Action Function ---


export default function AdminPaymentDetailPage() {
    const { payment } = useLoaderData<LoaderData>();
    const fetcher = useFetcher<ActionData>(); // Add fetcher for status updates
    const isUpdating = fetcher.state !== 'idle';

    // Construct Stripe dashboard link if PI ID exists
    const stripePaymentIntentUrl = payment.stripe_payment_intent_id
        ? `https://dashboard.stripe.com/${process.env.NODE_ENV === 'production' ? '' : 'test/'}payments/${payment.stripe_payment_intent_id}`
        : null;

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.adminPaymentDetail(payment.id)} className="mb-6" />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                    Payment Details
                </h1>
                 {/* Action Buttons Area */}
                 <div className="flex items-center space-x-2">
                    {/* Conditionally show update buttons */}
                    {(payment.status === PaymentStatus.Pending || payment.status === PaymentStatus.Failed) && (
                        <>
                            <fetcher.Form method="post">
                                <input type="hidden" name="newStatus" value={PaymentStatus.Succeeded} />
                                <Button type="submit" variant="default" size="sm" disabled={isUpdating}>
                                    {isUpdating ? 'Updating...' : 'Mark as Succeeded'}
                                </Button>
                            </fetcher.Form>
                            {/* Only show Mark as Failed if current status is Pending */}
                            {payment.status === PaymentStatus.Pending && (
                                <fetcher.Form method="post">
                                    <input type="hidden" name="newStatus" value={PaymentStatus.Failed} />
                                    <Button type="submit" variant="destructive" size="sm" disabled={isUpdating}>
                                        {isUpdating ? 'Updating...' : 'Mark as Failed'}
                                    </Button>
                                </fetcher.Form>
                            )}
                        </>
                    )}
                 </div>
            </div>

             {/* Display Fetcher Success/Error Messages */}
             {fetcher.data?.error && (
                <Alert variant="destructive" className="my-4">
                    <AlertTitle>Update Error</AlertTitle>
                    <AlertDescription>{fetcher.data.error}</AlertDescription>
                </Alert>
            )}
            {fetcher.data?.success && (
                <Alert variant="default" className="my-4 bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{fetcher.data.message}</AlertDescription>
                </Alert>
            )}

            <Card className="bg-white dark:bg-gray-800 shadow-md">
                <CardHeader>
                    <CardTitle>Payment ID: {payment.id}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p><span className="font-semibold">Family:</span> {payment.family ? (
                                <Link to={`/admin/families/${payment.family.id}`} className="text-blue-600 hover:underline">{payment.family.name}</Link>
                            ) : 'N/A'}</p>
                            <p><span className="font-semibold">Payment Date:</span> {formatDate(payment.payment_date, { formatString: 'yyyy-MM-dd' })}</p>
                            <p><span className="font-semibold">Payment Method:</span> {payment.payment_method ? payment.payment_method.replace('_', ' ').toUpperCase() : 'N/A'}</p>
                            {/* Changed <p> to <div> to allow <Badge> (which renders a div) inside */}
                            <div><span className="font-semibold">Status:</span> <Badge variant={getStatusBadgeVariant(payment.status as PaymentStatus)} className="capitalize ml-2">{payment.status}</Badge></div>
                            <p><span className="font-semibold">Type:</span> {getPaymentProductDescription(payment.type)}</p>
                        </div>
                        <div className="text-right">
                            <p><span className="font-semibold">Subtotal:</span> ${(payment.subtotal_amount / 100).toFixed(2)}</p>
                            {payment.payment_taxes && payment.payment_taxes.length > 0 && (
                                payment.payment_taxes.map((tax, index) => (
                                    <p key={index} className="text-sm text-gray-600 dark:text-gray-400">
                                        <span className="font-semibold">{tax.tax_rates?.description || tax.tax_name_snapshot}:</span> ${(tax.tax_amount / 100).toFixed(2)}
                                    </p>
                                ))
                            )}
                            <p className="font-bold text-lg border-t pt-2 mt-2 dark:border-gray-600"><span className="font-semibold">Total Amount:</span> ${(payment.total_amount / 100).toFixed(2)} {siteConfig.localization.currency}</p>
                        </div>
                    </div>

                    {payment.payment_students && payment.payment_students.length > 0 && (
                        <div>
                            <h3 className="font-semibold mt-4 mb-2">Associated Students:</h3>
                            <ul className="list-disc list-inside space-y-1">
                                {payment.payment_students.map((ps, index) => (
                                    ps.students ? (
                                        <li key={index}>
                                            <Link to={`/admin/students/${ps.students.id}`} className="text-blue-600 hover:underline">
                                                {ps.students.first_name} {ps.students.last_name}
                                            </Link>
                                        </li>
                                    ) : <li key={index}>Unknown Student</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {payment.notes && (
                        <div>
                            <h3 className="font-semibold mt-4 mb-2">Notes:</h3>
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{payment.notes}</p>
                        </div>
                    )}

                    {(payment.receipt_url || stripePaymentIntentUrl) && (
                         <div className="mt-4 border-t pt-4 dark:border-gray-600">
                            <h3 className="font-semibold mb-2">Stripe Information:</h3>
                            {payment.receipt_url && (
                                <p>
                                    <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        View Receipt
                                    </a>
                                </p>
                            )}
                            {stripePaymentIntentUrl && (
                                <p>
                                    <a href={stripePaymentIntentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        View Payment Intent in Stripe
                                    </a> ({payment.stripe_payment_intent_id})
                                </p>
                            )}
                        </div>
                    )}

                </CardContent>
            </Card>
        </div>
    );
}

// Error Boundary for this specific route
export function ErrorBoundary() {
    const error = useRouteError();
    const params = useParams();
    console.error(`Error caught in AdminPaymentDetailPage ErrorBoundary for ID ${params.paymentId}:`, error);

    let errorMessage = "An unknown error occurred loading payment details.";
    let errorStatus = 500;

    if (error instanceof Response) {
        errorMessage = `Error: ${error.status} - ${error.statusText || 'Failed to load data.'}`;
        errorStatus = error.status;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <Link to="/admin/payments" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Payments List</Link>
            <Alert variant="destructive">
                <AlertTitle>Error Loading Payment ({errorStatus})</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
        </div>
    );
}
