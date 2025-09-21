import {json, TypedResponse} from "@remix-run/node";
import {Link, useLoaderData, useRouteError} from "@remix-run/react";
import {getSupabaseAdminClient} from '~/utils/supabase.server';
import type {Database} from "~/types/database.types";
import {Button} from "~/components/ui/button";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "~/components/ui/table";
import {Badge}from "~/components/ui/badge";
import {formatDate}from "~/utils/misc"; // Import formatDate utility
import {PaymentStatus}from "~/types/models"; // Import the enum
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { formatMoney, fromCents } from "~/utils/money";
import { centsFromRow } from "~/utils/database-money";

// Define types
// Define the structure for pending payments, including the nested family object
type PendingPayment =
    Pick<Database['public']['Tables']['payments']['Row'], 'id' | 'subtotal_amount' | 'total_amount' | 'family_id' | 'status' | 'payment_date' | 'created_at' | 'type'> // Removed tax_amount
    & {
    family: Pick<Database['public']['Tables']['families']['Row'], 'name'> | null; // Add nested family object
};

// Define the type for the formatted data returned by the loader
type FormattedPendingPayment = Omit<PendingPayment, 'family'> & { // Omit the nested 'family' object
    familyName: string | null; // Keep familyName for the component
};


type LoaderData = {
    pendingPayments: FormattedPendingPayment[]; // Return the formatted type
};

export async function loader(): Promise<TypedResponse<LoaderData>> {
    console.log("Entering /admin/payments/pending loader...");

    const supabaseAdmin = getSupabaseAdminClient();

    try {
        // Fetch payments with status 'pending' and related family name using correct syntax
        const {data, error} = await supabaseAdmin
            .from('payments')
            .select(`
                id,
                subtotal_amount,
                total_amount,
                family_id,
                status,
                payment_date,
                created_at,
                type,
                family:family_id ( name )
            `)
            .eq('status', PaymentStatus.Pending) // Filter by pending status using enum
            .order('created_at', {ascending: true, nullsFirst: true}); // Show oldest pending first based on creation

        if (error) throw new Error(`Failed to fetch pending payments: ${error.message}`);

        // Format data to add familyName at the top level for easier use in the component
        const formattedPayments: FormattedPendingPayment[] = data?.map(p => ({
            ...p, // Spread the original payment data (id, amounts, status, etc.)
            // Use centralized money rules per table / field
            subtotal_amount: centsFromRow('payments', 'subtotal_amount', p as unknown as Record<string, unknown>),
            total_amount: centsFromRow('payments', 'total_amount', p as unknown as Record<string, unknown>),
            familyName: p.family?.name ?? 'N/A' // Extract family name from the nested object
        })) ?? [];

        console.log(`Found ${formattedPayments.length} pending payments.`);
        return json({pendingPayments: formattedPayments});

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Error in /admin/payments/pending loader:", message);
        throw new Response(message, {status: 500});
    }
}


export default function PendingPaymentsPage() {
    const {pendingPayments} = useLoaderData<LoaderData>();

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.adminPaymentsPending()} className="mb-6" />
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">Families with Pending Payments</h1>

            {pendingPayments.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">No families currently have pending payments.</p>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Family Name</TableHead>
                                <TableHead>Payment Date (if set)</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingPayments.map((payment) => (
                                <TableRow key={payment.id}>
                                    <TableCell className="font-medium">
                                        <Link to={`/admin/families/${payment.family_id}`}
                                              className="text-blue-600 hover:underline">
                                            {payment.familyName}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        {/* Display created_at date as the primary date for pending */}
                                        {formatDate(payment.created_at, { formatString: 'yyyy-MM-dd HH:mm' })}
                                    </TableCell>
                                     {/* Use total_amount */}
                                    <TableCell className="text-right">{formatMoney(fromCents(payment.total_amount))}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="capitalize"> {/* Pending status */}
                                            {payment.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="outline" size="sm" asChild>
                                            <Link to={`/admin/payments/${payment.id}`}>View Payment</Link>
                                        </Button>
                                        {/* Add other actions like "Send Reminder" later */}
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

// Add a specific ErrorBoundary for this route
export function ErrorBoundary() {
    const error = useRouteError();
    console.error("Error caught in PendingPaymentsPage ErrorBoundary:", error);

    let errorMessage = "An unknown error occurred loading pending payment data.";
    let errorStatus = 500;

    if (error instanceof Response) {
        errorMessage = `Error: ${error.status} - ${error.statusText || 'Failed to load data.'}`;
        errorStatus = error.status;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.adminPaymentsPending()} className="mb-6" />
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <h2 className="text-xl font-bold mb-2">Error Loading Pending Payments ({errorStatus})</h2>
                <p>{errorMessage}</p>
            </div>
        </div>
    );
}
