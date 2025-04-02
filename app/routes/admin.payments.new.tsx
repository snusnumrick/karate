import {useState} from 'react';
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect, type TypedResponse,} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation, useRouteError} from "@remix-run/react";
import {createClient} from '@supabase/supabase-js';
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Database} from "~/types/supabase";
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import {Textarea} from "~/components/ui/textarea"; // Import Textarea
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert"; // For displaying errors
import {format} from 'date-fns'; // For default date

type FamilyInfo = Pick<Database['public']['Tables']['families']['Row'], 'id' | 'name'>;

type LoaderData = {
    families: FamilyInfo[];
};

type ActionData = {
    success?: boolean;
    error?: string;
    fieldErrors?: {
        familyId?: string;
        amount?: string;
        paymentDate?: string;
        paymentMethod?: string;
        status?: string;
    };
};

// Function to get today's date in YYYY-MM-DD format
function getTodayDateString(): string {
    return format(new Date(), 'yyyy-MM-dd');
}

export async function loader({request}: LoaderFunctionArgs) {
    console.log("Entering /admin/payments/new loader...");
    const {response} = getSupabaseServerClient(request);
    const headers = response.headers;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin new payment loader: Missing Supabase env variables.");
        throw new Response("Server configuration error.", {status: 500, headers: Object.fromEntries(headers)});
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        console.log("Admin new payment loader: Fetching families...");
        const {data: families, error} = await supabaseAdmin
            .from('families')
            .select('id, name')
            .order('name', {ascending: true});

        if (error) {
            console.error("Error fetching families:", error.message);
            throw new Response("Failed to load family data.", {status: 500, headers: Object.fromEntries(headers)});
        }

        console.log(`Admin new payment loader: Fetched ${families?.length ?? 0} families.`);
        return json<LoaderData>({families: families || []}, {headers: Object.fromEntries(headers)});

    } catch (error) {
        if (error instanceof Error) {
            console.error("Error in /admin/payments/new loader:", error.message);
        } else {
            console.error("Error in /admin/payments/new loader:", error);
        }
        throw new Response("Failed to load data for new payment form.", {
            status: 500,
            headers: Object.fromEntries(headers)
        });
    }
}

export async function action({request}: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    console.log("Entering /admin/payments/new action...");
    const {response} = getSupabaseServerClient(request); // Get headers
    const headers = response.headers;
    const formData = await request.formData();

    const familyId = formData.get("familyId") as string;
    const amountStr = formData.get("amount") as string;
    const paymentDate = formData.get("paymentDate") as string || getTodayDateString();
    const paymentMethod = formData.get("paymentMethod") as string;
    const status = formData.get("status") as string || 'completed'; // Default to completed
    const notes = formData.get("notes") as string | null; // Get notes

    // --- Validation ---
    const fieldErrors: ActionData['fieldErrors'] = {};
    if (!familyId) fieldErrors.familyId = "Family is required.";
    if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
        fieldErrors.amount = "A valid positive amount is required.";
    }
    if (!paymentDate) fieldErrors.paymentDate = "Payment date is required.";
    if (!paymentMethod) fieldErrors.paymentMethod = "Payment method is required.";
    if (!status || !['pending', 'completed', 'failed'].includes(status)) {
        fieldErrors.status = "Invalid status selected.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        console.error("Validation errors:", fieldErrors);
        return json<ActionData>({error: "Validation failed.", fieldErrors}, {
            status: 400,
            headers: Object.fromEntries(headers)
        });
    }
    // --- End Validation ---

    const amount = parseFloat(amountStr);

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin new payment action: Missing Supabase env variables.");
        return json<ActionData>({error: "Server configuration error."}, {
            status: 500,
            headers: Object.fromEntries(headers)
        });
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        // console.log("Admin new payment action: Inserting payment record...");
        const {error: insertError} = await supabaseAdmin
            .from('payments')
            .insert({
                family_id: familyId,
                amount: amount,
                payment_date: paymentDate,
                payment_method: paymentMethod,
                status: status as Database['public']['Tables']['payments']['Row']['status'],
                notes: notes // Add notes to insert data
            });

        if (insertError) {
            console.error("Error inserting payment:", insertError.message);
            return json<ActionData>({error: `Failed to record payment: ${insertError.message}`}, {
                status: 500,
                headers: Object.fromEntries(headers)
            });
        }

        // console.log("Admin new payment action: Payment recorded successfully.");
        // Redirect to the payments index page on success
        // Add success=true query param for potential feedback message on redirect target
        headers.set('Location', '/admin/payments?success=true');
        return redirect("/admin/payments?success=true", {headers: Object.fromEntries(headers)});

    } catch (error) {
        if (error instanceof Error) {
            console.error("Error in /admin/payments/new action:", error.message);
        } else {
            console.error("Error in /admin/payments/new action:", error);
        }
        return json<ActionData>({error: "An unexpected error occurred while recording the payment."}, {
            status: 500,
            headers: Object.fromEntries(headers)
        });
    }
}


export default function AdminNewPaymentPage() {
    const {families} = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // State for controlled Select components
    const [selectedFamily, setSelectedFamily] = useState<string | undefined>(undefined);
    const [selectedMethod, setSelectedMethod] = useState<string | undefined>(undefined);
    const [selectedStatus, setSelectedStatus] = useState<string>('completed'); // Default to completed

    // console.log("Rendering AdminNewPaymentPage component...");
    // console.log("Action Data:", actionData);

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                    Record New Payment
                </h1>
                <Button variant="outline" asChild>
                    <Link to="/admin/payments">Cancel</Link>
                </Button>
            </div>

            {actionData?.error && !actionData.fieldErrors && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg p-6">
                <Form method="post">
                    <div className="space-y-6">
                        {/* Family Selection */}
                        <div>
                            <Label htmlFor="familyId">Family</Label>
                            <Select
                                name="familyId"
                                value={selectedFamily}
                                onValueChange={setSelectedFamily}
                                required
                            >
                                <SelectTrigger id="familyId">
                                    <SelectValue placeholder="Select a family"/>
                                </SelectTrigger>
                                <SelectContent>
                                    {families.map((family) => (
                                        <SelectItem key={family.id} value={family.id}>
                                            {family.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {actionData?.fieldErrors?.familyId && (
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.familyId}</p>
                            )}
                        </div>

                        {/* Amount */}
                        <div>
                            <Label htmlFor="amount">Amount ($)</Label>
                            <Input
                                id="amount"
                                name="amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="e.g., 150.00"
                                required
                                className="mt-1"
                            />
                            {actionData?.fieldErrors?.amount && (
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.amount}</p>
                            )}
                        </div>

                        {/* Payment Date */}
                        <div>
                            <Label htmlFor="paymentDate">Payment Date</Label>
                            <Input
                                id="paymentDate"
                                name="paymentDate"
                                type="date"
                                defaultValue={getTodayDateString()}
                                required
                                className="mt-1"
                            />
                            {actionData?.fieldErrors?.paymentDate && (
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.paymentDate}</p>
                            )}
                        </div>

                        {/* Payment Method */}
                        <div>
                            <Label htmlFor="paymentMethod">Payment Method</Label>
                            <Select
                                name="paymentMethod"
                                value={selectedMethod}
                                onValueChange={setSelectedMethod}
                                required
                            >
                                <SelectTrigger id="paymentMethod">
                                    <SelectValue placeholder="Select payment method"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="cheque">Cheque</SelectItem>
                                    <SelectItem value="etransfer">E-Transfer</SelectItem>
                                    <SelectItem value="stripe">Stripe (Online)</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            {actionData?.fieldErrors?.paymentMethod && (
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.paymentMethod}</p>
                            )}
                        </div>

                        {/* Status */}
                        <div>
                            <Label htmlFor="status">Status</Label>
                            <Select
                                name="status"
                                value={selectedStatus}
                                onValueChange={setSelectedStatus}
                                required
                            >
                                <SelectTrigger id="status">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                </SelectContent>
                            </Select>
                            {actionData?.fieldErrors?.status && (
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.status}</p>
                            )}
                        </div>

                        {/* Notes */}
                        <div>
                            <Label htmlFor="notes">Notes (Optional)</Label>
                            <Textarea
                                id="notes"
                                name="notes"
                                placeholder="e.g., Cheque #123, Paid for June fees"
                                className="mt-1"
                                rows={3}
                            />
                        </div>

                    </div>

                    <div className="mt-8 flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Recording..." : "Record Payment"}
                        </Button>
                    </div>
                </Form>
            </div>
        </div>
    );
}

// Basic ErrorBoundary for this route
export function ErrorBoundary() {
    const error = useRouteError() as Error;
    console.error("Error caught in AdminNewPaymentPage ErrorBoundary:", error);

    return (
        <div
            className="p-4 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900/30 dark:border-red-600 dark:text-red-300">
            <h2 className="text-xl font-bold mb-2">Error Creating New Payment</h2>
            <p>{error?.message || "An unknown error occurred."}</p>
            {process.env.NODE_ENV === "development" && (
                <pre
                    className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs dark:bg-red-900/50 dark:text-red-100">
          {error?.stack || JSON.stringify(error, null, 2)}
        </pre>
            )}
            <Link to="/admin/payments" className="text-blue-600 hover:underline mt-4 inline-block">
                Return to Payments List
            </Link>
        </div>
    );
}
