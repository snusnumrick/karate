import {json, TypedResponse} from "@remix-run/node";
import {Link, useLoaderData, useRouteError} from "@remix-run/react";
import {createClient} from '@supabase/supabase-js';
import type {Database} from "~/types/supabase";
import {Button} from "~/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import {Badge} from "~/components/ui/badge";
import {format} from 'date-fns';
import {PaymentStatus} from "~/types/models"; // Import the enum

// Define types
type PendingPayment =
    Pick<Database['public']['Tables']['payments']['Row'], 'id' | 'amount' | 'family_id' | 'status' | 'payment_date'>
    & {
    families: { name: string } | null; // Include family name
};

type LoaderData = {
    pendingPayments: Array<Omit<PendingPayment, 'families'> & { familyName: string }>;
};

export async function loader(): Promise<TypedResponse<LoaderData>> {
    console.log("Entering /admin/payments/pending loader...");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin pending payments loader: Missing Supabase env variables.");
        throw new Response("Server configuration error.", {status: 500});
    }
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        // Fetch payments with status 'pending' and related family name
        const {data, error} = await supabaseAdmin
            .from('payments')
            .select(`
                id,
                amount,
                family_id,
                status,
                payment_date,
                families ( name )
            `)
            .eq('status', PaymentStatus.Pending) // Filter by pending status using enum
            .order('payment_date', {ascending: true, nullsFirst: true}); // Show oldest pending first

        if (error) throw new Error(`Failed to fetch pending payments: ${error.message}`);

        // Format data for easier use
        const formattedPayments = data?.map(p => ({
            ...p,
            familyName: p.families?.name ?? 'N/A'
        })) || [];

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
            <Link to="/admin" className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Back to Admin Dashboard
            </Link>
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
                                        {payment.payment_date ? format(new Date(payment.payment_date), 'yyyy-MM-dd') : 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-right">${(payment.amount / 100).toFixed(2)}</TableCell>
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
            <Link to="/admin" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Admin
                Dashboard</Link>
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <h2 className="text-xl font-bold mb-2">Error Loading Pending Payments ({errorStatus})</h2>
                <p>{errorMessage}</p>
            </div>
        </div>
    );
}
