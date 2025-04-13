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
import { siteConfig } from '~/config/site'; // Import siteConfig

type FamilyInfo = Pick<Database['public']['Tables']['families']['Row'], 'id' | 'name'>;
type TaxRateInfo = Pick<Database['public']['Tables']['tax_rates']['Row'], 'name' | 'rate' | 'description'>; // Add type for tax rates

type LoaderData = {
    families: FamilyInfo[];
    taxRates: TaxRateInfo[]; // Add tax rates to loader data
};

type ActionData = {
    success?: boolean;
    error?: string;
    fieldErrors?: {
        familyId?: string;
        subtotalAmount?: string; // Changed from amount
        paymentDate?: string;
        paymentMethod?: string;
        status?: string;
        type?: string; // Use 'type'
        quantity?: string; // Added for one_on_one session quantity
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
            console.error("Error fetching families:", error.message);
            throw new Response("Failed to load family data.", {status: 500, headers: Object.fromEntries(headers)});
        }
        console.log(`Admin new payment loader: Fetched ${families?.length ?? 0} families.`);

        // Fetch active tax rates
        console.log("Admin new payment loader: Fetching active tax rates...");
        const applicableTaxNames = siteConfig.pricing.applicableTaxNames;
        const { data: taxRatesData, error: taxRatesError } = await supabaseAdmin
            .from('tax_rates')
            .select('name, rate, description') // Select fields needed for display/calculation
            .in('name', applicableTaxNames)
            .eq('is_active', true);

        if (taxRatesError) {
            console.error("Error fetching tax rates:", taxRatesError.message);
            // Proceed without tax rates, but log the error. The component should handle missing rates.
            // throw new Response("Failed to load tax rate data.", { status: 500, headers: Object.fromEntries(headers) });
        }
        console.log(`Admin new payment loader: Fetched ${taxRatesData?.length ?? 0} active tax rates.`);


        return json<LoaderData>({
            families: families || [],
            taxRates: taxRatesData || [] // Return fetched tax rates (or empty array)
        }, {headers: Object.fromEntries(headers)});

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
    const subtotalAmountStr = formData.get("subtotalAmount") as string; // Changed from amount
    const paymentDate = formData.get("paymentDate") as string || getTodayDateString();
    const paymentMethod = formData.get("paymentMethod") as string;
    const status = 'succeeded'; // Hardcode status to succeeded for manual admin entry
    const notes = formData.get("notes") as string | null;
    const type = formData.get("type") as string || 'monthly_group'; // Use 'type' variable
    const quantityStr = formData.get("quantity") as string; // Get quantity for one_on_one session

    // --- Validation ---
    const fieldErrors: ActionData['fieldErrors'] = {};
    if (!familyId) fieldErrors.familyId = "Family is required.";
    // Validate subtotal amount
    let subtotalAmount = 0;
    if (!subtotalAmountStr || isNaN(parseFloat(subtotalAmountStr)) || parseFloat(subtotalAmountStr) < 0) { // Allow 0 subtotal? Check requirements. Let's assume >= 0
        fieldErrors.subtotalAmount = "A valid non-negative subtotal amount is required.";
    } else {
        subtotalAmount = parseFloat(subtotalAmountStr); // Keep as float for now
    }
    if (!paymentDate) fieldErrors.paymentDate = "Payment date is required.";
    if (!paymentMethod) fieldErrors.paymentMethod = "Payment method is required.";
    // Status validation removed as it's hardcoded
    // Use the actual enum values for type validation
    if (!type || !['monthly_group', 'yearly_group', 'individual_session', 'other'].includes(type)) { // Check 'type' variable
        fieldErrors.type = "Invalid payment type selected."; // Use 'type' key
    }
    let quantity: number | null = null;
    if (type === 'individual_session') { // Check 'type' variable
        if (!quantityStr || isNaN(parseInt(quantityStr)) || parseInt(quantityStr) <= 0) {
            fieldErrors.quantity = "A valid positive quantity is required for Individual Sessions.";
        } else {
            quantity = parseInt(quantityStr);
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        console.error("Validation errors:", fieldErrors);
        return json<ActionData>({error: "Validation failed.", fieldErrors}, {
            status: 400,
            headers: Object.fromEntries(headers)
        });
    }
    // --- End Validation ---

    // Convert subtotal to cents
    const subtotalAmountInCents = Math.round(subtotalAmount * 100);

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
        // --- Multi-Tax Calculation ---
        const applicableTaxNames = siteConfig.pricing.applicableTaxNames;
        const { data: taxRatesData, error: taxRatesError } = await supabaseAdmin
            .from('tax_rates')
            .select('id, name, rate')
            .in('name', applicableTaxNames)
            .eq('is_active', true);

        if (taxRatesError) {
            throw new Error(`Failed to fetch tax rates: ${taxRatesError.message}`);
        }

        let totalTaxAmountInCents = 0;
        const paymentTaxesToInsert: Array<{
            tax_rate_id: string;
            tax_amount: number;
            tax_rate_snapshot: number;
            tax_name_snapshot: string;
        }> = [];

        if (taxRatesData) {
            for (const taxRate of taxRatesData) {
                const rate = Number(taxRate.rate);
                if (isNaN(rate)) continue;
                const taxAmountForThisRate = Math.round(subtotalAmountInCents * rate);
                totalTaxAmountInCents += taxAmountForThisRate;
                paymentTaxesToInsert.push({
                    tax_rate_id: taxRate.id,
                    tax_amount: taxAmountForThisRate,
                    tax_rate_snapshot: rate,
                    tax_name_snapshot: taxRate.name,
                });
            }
        }
        const totalAmountInCents = subtotalAmountInCents + totalTaxAmountInCents;
        // --- End Multi-Tax Calculation ---

        console.log("Admin new payment action: Inserting payment record...");
        // Insert main payment record
        const { data: paymentData, error: insertPaymentError } = await supabaseAdmin
            .from('payments')
            .insert({
                family_id: familyId,
                subtotal_amount: subtotalAmountInCents,
                // tax_amount removed
                total_amount: totalAmountInCents,
                payment_date: paymentDate,
                payment_method: paymentMethod,
                status: status as Database['public']['Enums']['payment_status'],
                type: type as Database['public']['Enums']['payment_type_enum'],
                notes: notes
            })
            .select('id')
            .single();

        if (insertPaymentError || !paymentData?.id) {
            console.error("Error inserting payment:", insertPaymentError?.message);
            return json<ActionData>({error: `Failed to record payment: ${insertPaymentError?.message || 'Could not retrieve payment ID'}`}, {
                status: 500,
                headers: Object.fromEntries(headers)
            });
        }

        const paymentId = paymentData.id;
        console.log(`Payment ${paymentId} recorded successfully. Subtotal: ${subtotalAmountInCents}, Total Tax: ${totalTaxAmountInCents}, Total: ${totalAmountInCents}`);

        // Insert tax breakdown
        if (paymentTaxesToInsert.length > 0) {
            const taxesWithPaymentId = paymentTaxesToInsert.map(tax => ({
                ...tax,
                payment_id: paymentId,
            }));
            const { error: insertTaxesError } = await supabaseAdmin
                .from('payment_taxes')
                .insert(taxesWithPaymentId);

            if (insertTaxesError) {
                console.error(`Error inserting payment_taxes for payment ${paymentId}:`, insertTaxesError.message);
                // Attempt cleanup? Or return partial success error?
                // For now, return error indicating partial failure.
                return json<ActionData>({error: `Payment recorded, but failed to record tax details: ${insertTaxesError.message}`}, {
                    status: 500,
                    headers: Object.fromEntries(headers)
                });
            }
             console.log(`Inserted ${taxesWithPaymentId.length} tax records for payment ${paymentId}.`);
        }

        // If it's an individual session payment, record the session purchase (logic remains the same)
        if (type === 'individual_session' && quantity !== null) {
            console.log(`Recording Individual Session purchase for payment ${paymentId}, quantity: ${quantity}`);
            const { error: sessionInsertError } = await supabaseAdmin
                .from('one_on_one_sessions') // Table name remains the same
                .insert({
                    payment_id: paymentId,
                    family_id: familyId,
                    quantity_purchased: quantity,
                    quantity_remaining: quantity, // Initially, remaining equals purchased
                    // purchase_date, created_at, updated_at have defaults
                });

            if (sessionInsertError) {
                console.error(`Error inserting Individual Session record for payment ${paymentId}:`, sessionInsertError.message);
                // Note: Payment is already created. Might need manual cleanup or a more robust transaction.
                // For now, return an error indicating partial success.
                return json<ActionData>({error: `Payment recorded, but failed to record Individual Session details: ${sessionInsertError.message}`}, {
                    status: 500, // Or maybe a different status?
                    headers: Object.fromEntries(headers)
                });
            }
            console.log(`Individual Session purchase recorded for payment ${paymentId}.`);
        }

        // Redirect to the payments index page on success
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
    // Combined declaration for loader data
    const {families, taxRates} = useLoaderData<typeof loader>(); // Get families and taxRates
    // Single declaration for action data
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // State for controlled Select components
    const [selectedFamily, setSelectedFamily] = useState<string | undefined>(undefined);
    const [selectedMethod, setSelectedMethod] = useState<string | undefined>(undefined);
    // selectedStatus state removed
    const [selectedType, setSelectedType] = useState<string>('monthly_group'); // Use selectedType state
    const [subtotalStr, setSubtotalStr] = useState<string>(''); // State for subtotal input string

    // Client-side calculation for display
    const calculateDisplayAmounts = () => {
        const subtotalNum = parseFloat(subtotalStr);
        if (isNaN(subtotalNum) || subtotalNum < 0) {
            return { subtotal: 0, taxes: [], total: 0 };
        }
        const subtotalCents = Math.round(subtotalNum * 100);
        let totalTaxCents = 0;
        const calculatedTaxes: Array<{ name: string; description: string | null; amount: number }> = [];

        // Use taxRates from loader data
        if (taxRates && taxRates.length > 0) {
            for (const taxRate of taxRates) {
                const rate = Number(taxRate.rate);
                if (!isNaN(rate)) {
                    const taxAmountForThisRate = Math.round(subtotalCents * rate);
                    totalTaxCents += taxAmountForThisRate;
                    calculatedTaxes.push({
                        name: taxRate.name,
                        description: taxRate.description,
                        amount: taxAmountForThisRate,
                    });
                }
            }
        }
        const totalCents = subtotalCents + totalTaxCents;
        return { subtotal: subtotalCents, taxes: calculatedTaxes, total: totalCents };
    };

    const { subtotal: calculatedSubtotalCents, taxes: calculatedTaxes, total: calculatedTotalCents } = calculateDisplayAmounts();

    // console.log("Rendering AdminNewPaymentPage component...");
    // console.log("Action Data:", actionData);
    // console.log("Tax Rates from Loader:", taxRates);
    // console.log("Calculated Display Amounts:", { calculatedSubtotalCents, calculatedTaxes, calculatedTotalCents });

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

                        {/* Payment Type */}
                        <div>
                            <Label htmlFor="type">Payment Type</Label> {/* Update htmlFor */}
                            <Select
                                name="type" // Update name
                                value={selectedType} // Update value
                                onValueChange={setSelectedType} // Update handler
                                required
                            >
                                <SelectTrigger id="type"> {/* Update id */}
                                    <SelectValue placeholder="Select payment type"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly_group">Monthly Group Class</SelectItem>
                                    <SelectItem value="yearly_group">Yearly Group Class</SelectItem>
                                    <SelectItem value="individual_session">Individual Session</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            {actionData?.fieldErrors?.type && ( // Check 'type' field error
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.type}</p>
                            )}
                        </div>

                        {/* Conditionally show Quantity for Individual sessions */}
                        {selectedType === 'individual_session' && ( // Check selectedType state
                            <div>
                                <Label htmlFor="quantity">Quantity (Number of Sessions)</Label>
                                <Input
                                    id="quantity"
                                    name="quantity"
                                    type="number"
                                    min="1"
                                    step="1"
                                    placeholder="e.g., 5"
                                    required={selectedType === 'individual_session'} // Check selectedType state
                                    className="mt-1"
                                />
                                {actionData?.fieldErrors?.quantity && (
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.quantity}</p>
                                )}
                            </div>
                        )}

                        {/* Subtotal Amount */}
                        <div>
                            <Label htmlFor="subtotalAmount">Subtotal Amount ($)</Label>
                            <Input
                                id="subtotalAmount"
                                name="subtotalAmount" // Changed name
                                type="number"
                                step="0.01"
                                min="0.00"
                                placeholder="e.g., 150.00"
                                required
                                className="mt-1"
                                value={subtotalStr} // Control input value
                                onChange={(e) => setSubtotalStr(e.target.value)} // Update state on change
                            />
                            {actionData?.fieldErrors?.subtotalAmount && (
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.subtotalAmount}</p>
                            )}
                        </div>

                        {/* Display Calculated Tax and Total */}
                        {calculatedSubtotalCents > 0 && (
                            <div className="mt-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 space-y-1">
                                <p className="text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                                    <span>Subtotal:</span>
                                    <span>${(calculatedSubtotalCents / 100).toFixed(2)}</span>
                                </p>
                                {calculatedTaxes.map((tax, index) => (
                                    <p key={index} className="text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                                        <span>{tax.description || tax.name}:</span>
                                        <span>${(tax.amount / 100).toFixed(2)}</span>
                                    </p>
                                ))}
                                <p className="text-md font-semibold text-gray-800 dark:text-gray-100 flex justify-between border-t pt-2 mt-2 dark:border-gray-500">
                                    <span>Total Amount:</span>
                                    <span>${(calculatedTotalCents / 100).toFixed(2)}</span>
                                </p>
                            </div>
                        )}

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

                        {/* Status field removed */}

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
