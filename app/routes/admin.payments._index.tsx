import {json, type LoaderFunctionArgs} from "@remix-run/node";
import {Link, useLoaderData, useRouteError} from "@remix-run/react";
import {getSupabaseServerClient, getSupabaseAdminClient} from "~/utils/supabase.server"; // Import the missing function
import {Database} from "~/types/database.types"; // Assuming your generated types
import {Button} from "~/components/ui/button";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "~/components/ui/table";
import {Badge} from "~/components/ui/badge"; // For status display
import {formatDate} from "~/utils/misc"; // For date formatting
import {PaymentStatus} from "~/types/models"; // Import the enum
import {AppBreadcrumb, breadcrumbPatterns} from "~/components/AppBreadcrumb";
import { formatMoney, fromCents } from "~/utils/money";
import { centsFromRow } from "~/utils/database-money";

// Define the shape of data returned by the loader, including the family name
type PaymentWithFamily = Database['public']['Tables']['payments']['Row'] & {
    families: { name: string } | null; // Supabase relation type
};

type InvoicePaymentFormatted = {
    id: string;
    family_id: string;
    payment_date: string | null;
    total_amount: number;
    payment_method: string | null;
    status: 'succeeded';
    notes: string | null;
    reference_number: string | null;
    familyName: string;
    source: 'invoice_payment';
    invoice_number?: string;
    invoice_id?: string;
};

type RegularPaymentFormatted = Omit<PaymentWithFamily, 'families'> & { 
    familyName: string;
    source: 'payment';
};

type LoaderData = {
    payments: Array<RegularPaymentFormatted | InvoicePaymentFormatted>;
};

export async function loader({request}: LoaderFunctionArgs) {
    // console.log("Entering /admin/payments loader...");
    const {response} = getSupabaseServerClient(request); // Get headers via helper
    const headers = response.headers;

    const supabaseAdmin = getSupabaseAdminClient();

    try {
        // console.log("Admin payments loader: Fetching payments with family names...");
        
        // Fetch regular payments
        const {data: paymentsData, error: paymentsError} = await supabaseAdmin
            .from('payments')
            .select(`*, family:family_id (name)`)
            .order('payment_date', {ascending: false});

        if (paymentsError) {
            console.error("Error fetching payments:", paymentsError.message);
            throw new Response("Failed to load payment data.", {status: 500, headers: Object.fromEntries(headers)});
        }

        // Fetch invoice payments with invoice and family information
        const {data: invoicePaymentsData, error: invoicePaymentsError} = await supabaseAdmin
            .from('invoice_payments')
            .select(`
                *,
                invoice:invoice_id (
                    id,
                    family_id,
                    invoice_number,
                    families(id, name)
                )
            `)
            .order('payment_date', {ascending: false});

        if (invoicePaymentsError) {
            console.error("Error fetching invoice payments:", invoicePaymentsError.message);
            throw new Response("Failed to load invoice payment data.", {status: 500, headers: Object.fromEntries(headers)});
        }

        // Format regular payments (normalize to cents reliably)
        const formattedPayments = paymentsData?.map((p) => {
            const cents = centsFromRow('payments', 'total_amount', p as unknown as Record<string, unknown>);
            return {
                ...p,
                total_amount: cents,
                familyName: p.family?.name ?? 'N/A',
                source: 'payment' as const
            } as RegularPaymentFormatted;
        }) || [];

        // Format invoice payments to match the payment structure
        const formattedInvoicePayments = invoicePaymentsData?.map((ip) => {
            const cents = centsFromRow('invoice_payments', 'amount', ip as unknown as Record<string, unknown>);
            return {
                id: ip.id,
                family_id: ip.invoice?.family_id || '',
                payment_date: ip.payment_date,
                total_amount: cents,
                payment_method: ip.payment_method,
                status: 'succeeded' as const,
                notes: ip.notes,
                reference_number: ip.reference_number,
                familyName: ip.invoice?.families?.name ?? 'N/A',
                source: 'invoice_payment' as const,
                invoice_number: ip.invoice?.invoice_number,
                invoice_id: ip.invoice?.id
            } as InvoicePaymentFormatted;
        }) || [];

        // Combine and sort all payments by date
        const allPayments = [...formattedPayments, ...formattedInvoicePayments]
            .sort((a, b) => {
                const dateA = new Date(a.payment_date || 0).getTime();
                const dateB = new Date(b.payment_date || 0).getTime();
                return dateB - dateA; // Most recent first
            });

        console.log(`Admin payments loader: Fetched ${formattedPayments.length} regular payments and ${formattedInvoicePayments.length} invoice payments.`);
        return json<LoaderData>({payments: allPayments}, {headers: Object.fromEntries(headers)});

    } catch (error) {
        if (error instanceof Error) {
            console.error("Error in /admin/payments loader:", error.message);
        } else {
            console.error("Error in /admin/payments loader:", error);
        }
        throw new Response("Failed to load payment data.", {status: 500, headers: Object.fromEntries(headers)});
    }
}

export default function AdminPaymentsPage() {
    const {payments} = useLoaderData<typeof loader>();
    console.log("Rendering AdminPaymentsPage component...");

    // Update function signature to accept the enum
    const getStatusVariant = (status: PaymentStatus): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case PaymentStatus.Succeeded:
                return 'default'; // Greenish in default theme
            case PaymentStatus.Pending:
                return 'secondary'; // Yellowish/Grayish
            case PaymentStatus.Failed:
                return 'destructive'; // Reddish
            default:
                return 'outline'; // Should not happen with enum, but good practice
        }
    };

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <AppBreadcrumb items={breadcrumbPatterns.adminPayments()} className="mb-6" />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                    Payment History
                </h1>
                <Button asChild>
                    <Link to="/admin/payments/new">Record New Payment</Link>
                </Button>
            </div>

            {payments.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400">No payments found.</p>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                    <Table>
                        <TableHeader>
                            {/* Removed whitespace between TableRow and TableHead */}
                            <TableRow><TableHead>Date</TableHead><TableHead>Family</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Method</TableHead><TableHead>Actions</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments.map((payment) => (
                                <TableRow key={payment.id}>
                                    <TableCell>{formatDate(payment.payment_date, { formatString: 'yyyy-MM-dd' })}</TableCell>
                                    <TableCell>
                                        <Link to={`/admin/families/${payment.family_id}`}
                                              className="text-green-600 hover:underline dark:text-green-400">
                                            {payment.familyName}
                                        </Link>
                                    </TableCell>
                                    <TableCell
                                        className="text-right">{formatMoney(fromCents(payment.total_amount))}</TableCell>
                                    <TableCell className="capitalize">
                                        {payment.source === 'invoice_payment' 
                                            ? `Invoice Payment${payment.invoice_number ? ` (${payment.invoice_number})` : ''}` 
                                            : (payment as RegularPaymentFormatted).type?.replace(/_/g, ' ') ?? 'N/A'
                                        }
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(payment.status as PaymentStatus)}
                                               className="capitalize">
                                            {payment.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell
                                        className="capitalize">{payment.payment_method?.replace('_', ' ') ?? 'N/A'}</TableCell>
                                    <TableCell>
                                        {payment.source === 'invoice_payment' ? (
                                            <Button variant="outline" size="sm" asChild>
                                                <Link to={`/admin/invoices/${(payment as InvoicePaymentFormatted).invoice_id}`}>View Invoice</Link>
                                            </Button>
                                        ) : (
                                            <Button variant="outline" size="sm" asChild>
                                                <Link to={`/admin/payments/${payment.id}`}>View</Link>
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}

// Basic ErrorBoundary for this route
export function ErrorBoundary() {
    const error = useRouteError() as Error;
    console.error("Error caught in AdminPaymentsPage ErrorBoundary:", error);

    return (
        <div
            className="p-4 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900/30 dark:border-red-600 dark:text-red-300">
            <h2 className="text-xl font-bold mb-2">Error Loading Payments</h2>
            <p>{error?.message || "An unknown error occurred."}</p>
            {process.env.NODE_ENV === "development" && (
                <pre
                    className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs dark:bg-red-900/50 dark:text-red-100">
          {error?.stack || JSON.stringify(error, null, 2)}
        </pre>
            )}
        </div>
    );
}
