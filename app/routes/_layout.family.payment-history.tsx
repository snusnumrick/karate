import {json, type LoaderFunctionArgs, redirect} from "@remix-run/node";
import {Link, useLoaderData} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {formatDate} from "~/utils/misc";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import {Database} from "~/types/database.types";
import { formatMoney, fromCents } from "~/utils/money";
import { centsFromRow } from "~/utils/database-money";

// Define types for combined payment data
type RegularPayment = Database['public']['Tables']['payments']['Row'] & {
    source: 'payment';
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
    source: 'invoice_payment';
    invoice_number?: string;
    invoice_id?: string;
    receipt_url?: string | null;
    type?: string;
};

type CombinedPayment = RegularPayment | InvoicePaymentFormatted;


export async function loader({request}: LoaderFunctionArgs) {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        throw redirect("/login", {headers});
    }

    // Get profile to find family_id
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData?.family_id) {
        // Handle error or case where user has no family
        console.error("Payment History Loader Error: Failed to load profile or family_id", profileError?.message);
        // You might want to redirect to the family portal or show an error message
        throw new Response("Could not load your family information.", {status: 500});
    }

    const familyId = profileData.family_id;

    // Fetch regular payments for the family
    const {data: paymentsData, error: paymentsError} = await supabaseServer
        .from('payments')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })
        .order('payment_date', { ascending: false, nullsFirst: true });

    if (paymentsError) {
        console.error("Payment History Loader Error: Failed to load payments", paymentsError.message);
        throw new Response("Could not load payment history.", {status: 500});
    }

    // Fetch invoice payments for the family
    const {data: invoicePaymentsData, error: invoicePaymentsError} = await supabaseServer
        .from('invoice_payments')
        .select(`
            *,
            invoice:invoice_id (
                id,
                family_id,
                invoice_number
            )
        `)
        .eq('invoice.family_id', familyId)
        .order('payment_date', { ascending: false });

    if (invoicePaymentsError) {
        console.error("Payment History Loader Error: Failed to load invoice payments", invoicePaymentsError.message);
        throw new Response("Could not load invoice payment history.", {status: 500});
    }

    // Format regular payments (normalize to cents)
    const formattedPayments: RegularPayment[] = (paymentsData || []).map(p => ({
        ...p,
        total_amount: centsFromRow('payments', 'total_amount', p as unknown as Record<string, unknown>),
        source: 'payment' as const
    }));

    // Format invoice payments to match the payment structure
    const formattedInvoicePayments: InvoicePaymentFormatted[] = (invoicePaymentsData || []).map(ip => ({
        id: ip.id,
        family_id: familyId,
        payment_date: ip.payment_date,
        total_amount: centsFromRow('invoice_payments', 'amount', ip as unknown as Record<string, unknown>),
        payment_method: ip.payment_method,
        status: 'succeeded' as const,
        notes: ip.notes,
        reference_number: ip.reference_number,
        source: 'invoice_payment' as const,
        invoice_number: ip.invoice?.invoice_number,
        invoice_id: ip.invoice?.id,
        receipt_url: (ip as unknown as { receipt_url?: string | null }).receipt_url ?? null,
        type: 'invoice_payment'
    }));

    // Combine and sort all payments by date
    const allPayments: CombinedPayment[] = [...formattedPayments, ...formattedInvoicePayments]
        .sort((a, b) => {
            const dateA = new Date(a.payment_date || 0).getTime();
            const dateB = new Date(b.payment_date || 0).getTime();
            return dateB - dateA; // Most recent first
        });

    return json({payments: allPayments}, {headers});
}


export default function PaymentHistoryPage() {
    const {payments} = useLoaderData<typeof loader>();

    return (
        <div className="page-styles">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <AppBreadcrumb items={breadcrumbPatterns.familyPaymentHistory()} className="mb-6" />

                {/* Page Header */}
                <div className="family-page-header-section-styles">
                    <h1 className="page-header-styles">
                        Full Payment History
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                        View all your payment transactions and receipts
                    </p>
                </div>

                {/* Payment History Content */}
                <div className="form-container-styles p-8 backdrop-blur-lg">
                    {payments && payments.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date
                                    </th>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount
                                    </th>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type
                                    </th>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status
                                    </th>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Method
                                    </th>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Receipt
                                    </th>
                                    <th scope="col"
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                                {payments.map((payment) => (
                                    <tr key={payment.id}>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                            {payment.payment_date ? formatDate(payment.payment_date, { formatString: 'P' }) : 'N/A'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                            {formatMoney(fromCents(payment.total_amount))}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">
                                            {payment.source === 'invoice_payment' 
                                                ? `Invoice Payment${payment.invoice_number ? ` (${payment.invoice_number})` : ''}` 
                                                : (payment as RegularPayment).type?.replace(/_/g, ' ') ?? 'N/A'
                                            }
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                                             <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                 payment.status === 'succeeded' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                     payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                         'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                             }`}>
                               {payment.status}
                             </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">
                                            {payment.payment_method || 'N/A'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {payment.source === 'invoice_payment' ? (
                                                (payment as InvoicePaymentFormatted).receipt_url ? (
                                                    <a
                                                        href={(payment as InvoicePaymentFormatted).receipt_url!}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 underline"
                                                    >
                                                        View
                                                    </a>
                                                ) : payment.invoice_id ? (
                                                    <Link
                                                        to={`/family/invoices/${payment.invoice_id}`}
                                                        className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 underline"
                                                    >
                                                        Invoice
                                                    </Link>
                                                ) : 'N/A'
                                            ) : (
                                                payment.receipt_url ? (
                                                    <a
                                                        href={payment.receipt_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 underline"
                                                    >
                                                        View
                                                    </a>
                                                ) : (
                                                    'N/A'
                                                )
                                            )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {payment.source === 'invoice_payment' ? (
                                                payment.invoice_id ? (
                                                    <Link
                                                        to={`/family/invoices/${payment.invoice_id}`}
                                                        className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 underline font-medium"
                                                    >
                                                        View Invoice
                                                    </Link>
                                                ) : 'N/A'
                                            ) : (
                                                (payment.status === 'pending' || payment.status === 'failed') ? (
                                                    <Link
                                                        to={`/pay/${payment.id}`}
                                                        className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 underline font-medium"
                                                    >
                                                        {payment.status === 'pending' ? 'Complete Payment' : 'Retry Payment'}
                                                    </Link>
                                                ) : (
                                                    'N/A'
                                                )
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-gray-600 dark:text-gray-400 text-lg">No payment history found.</p>
                            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Your payment transactions will appear here once you make your first payment.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Basic Error Boundary for this route
export function ErrorBoundary() {
    // const error = useRouteError(); // Use this hook in Remix v2+
    const error: Error = new Error("An unknown error occurred on the payment history page."); // Placeholder

    return (
        <div className="min-h-screen page-background-styles py-12 text-foreground">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <AppBreadcrumb items={breadcrumbPatterns.familyPaymentHistory()} className="mb-6" />
                
                {/* Page Header */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-extrabold text-red-600 dark:text-red-400 sm:text-4xl">
                        Error Loading Payment History
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                        We encountered an issue while loading your payment history
                    </p>
                </div>

                {/* Error Content */}
                <div className="form-container-styles p-8 backdrop-blur-lg">
                    <div className="text-center py-12">
                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                            {error.message}
                        </p>
                        <p className="text-gray-500 dark:text-gray-500 text-sm mt-4">
                            Please try refreshing the page or contact support if the problem persists.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
