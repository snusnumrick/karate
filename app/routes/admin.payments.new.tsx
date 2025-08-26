import {useEffect, useRef, useState} from 'react';
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect, type TypedResponse,} from "@remix-run/node";
import {Form, useActionData, useLoaderData, useNavigation, useRouteError} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Database} from "~/types/database.types";
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Checkbox} from "~/components/ui/checkbox";
import {Label} from "~/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import {Textarea} from "~/components/ui/textarea"; // Import Textarea
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert"; // For displaying errors
import {format} from 'date-fns'; // For default date
import {AppBreadcrumb, breadcrumbPatterns} from "~/components/AppBreadcrumb";

type FamilyInfo = Pick<Database['public']['Tables']['families']['Row'], 'id' | 'name'>;
type StudentInfo = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name' | 'family_id'>;
type TaxRateInfo = Pick<Database['public']['Tables']['tax_rates']['Row'], 'id' | 'name' | 'rate' | 'description'>; // Add type for tax rates

type LoaderData = {
    families: FamilyInfo[];
    students: StudentInfo[];
    taxRates: TaxRateInfo[]; // Add tax rates to loader data
};

type ActionData = {
    success?: boolean;
    error?: string;
    fieldErrors?: {
        familyId?: string;
        studentIds?: string;
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

    const { getSupabaseAdminClient } = await import('~/utils/supabase.server');
    const supabaseAdmin = getSupabaseAdminClient();

    try {
        // console.log("Admin new payment loader: Fetching families...");
        const {data: families, error} = await supabaseAdmin
            .from('families')
            .select('id, name')
            .order('name', {ascending: true});

        if (error) {
            console.error("Error fetching families:", error.message);
            throw new Response("Failed to load family data.", {status: 500, headers: Object.fromEntries(headers)});
        }
        // console.log(`Admin new payment loader: Fetched ${families?.length ?? 0} families.`);

        // Fetch students
        // console.log("Admin new payment loader: Fetching students...");
        const { data: students, error: studentsError } = await supabaseAdmin
            .from('students')
            .select('id, first_name, last_name, family_id')
            .order('first_name', { ascending: true });

        if (studentsError) {
            console.error("Error fetching students:", studentsError.message);
            throw new Response("Failed to load student data.", { status: 500, headers: Object.fromEntries(headers) });
        }
        // console.log(`Admin new payment loader: Fetched ${students?.length ?? 0} students.`);

        // Fetch all active tax rates (admin should have choice of all available taxes)
        // console.log("Admin new payment loader: Fetching active tax rates...");
        const { data: taxRatesData, error: taxRatesError } = await supabaseAdmin
            .from('tax_rates')
            .select('id, name, rate, description') // Select fields needed for display/calculation
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (taxRatesError) {
            console.error("Error fetching tax rates:", taxRatesError.message);
            // Proceed without tax rates, but log the error. The component should handle missing rates.
            // throw new Response("Failed to load tax rate data.", { status: 500, headers: Object.fromEntries(headers) });
        }
        // console.log(`Admin new payment loader: Fetched ${taxRatesData?.length ?? 0} active tax rates.`);


        return json<LoaderData>({
            families: families || [],
            students: students || [],
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
    // console.log("Entering /admin/payments/new action...");
    const {response} = getSupabaseServerClient(request); // Get headers
    const headers = response.headers;
    const formData = await request.formData();

    const familyId = formData.get("familyId") as string;
    const studentIdsString = formData.get("studentIds") as string;
    const subtotalAmountStr = formData.get("subtotalAmount") as string; // Changed from amount
    let paymentDate = formData.get("paymentDate") as string | null;
    const paymentMethod = formData.get("paymentMethod") as string;
    const status = paymentMethod === 'stripe' ? 'pending' : 'succeeded';
    const notes = formData.get("notes") as string | null;
    const type = formData.get("type") as string || 'monthly_group'; // Use 'type' variable
    const quantityStr = formData.get("quantity") as string; // Get quantity for one_on_one session
    const selectedTaxRateIdsString = formData.get("selectedTaxRateIds") as string; // Get selected tax rate IDs

    // --- Validation ---
    const fieldErrors: ActionData['fieldErrors'] = {};
    if (!familyId) fieldErrors.familyId = "Family is required.";
    const studentIds = studentIdsString ? studentIdsString.split(',').filter(id => id.trim() !== '') : [];
    if ((type === 'monthly_group' || type === 'yearly_group') && studentIds.length === 0) {
        fieldErrors.studentIds = "Please select at least one student for group payments.";
    }
    // Validate subtotal amount
    let subtotalAmount = 0;
    if (!subtotalAmountStr || isNaN(parseFloat(subtotalAmountStr)) || parseFloat(subtotalAmountStr) < 0) { // Allow 0 subtotal? Check requirements. Let's assume >= 0
        fieldErrors.subtotalAmount = "A valid non-negative subtotal amount is required.";
    } else {
        subtotalAmount = parseFloat(subtotalAmountStr); // Keep as float for now
    }

    if (paymentMethod !== 'stripe') {
        if (!paymentDate) {
            // Default the date if it's a non-Stripe payment and date is missing.
            paymentDate = getTodayDateString();
        }
    } else {
        paymentDate = null; // Stripe payments are pending, date will be set on success
    }

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

    const { getSupabaseAdminClient } = await import('~/utils/supabase.server');
    const supabaseAdmin = getSupabaseAdminClient();

    try {
        // --- Multi-Tax Calculation ---
        const selectedTaxRateIds = selectedTaxRateIdsString ? selectedTaxRateIdsString.split(',').filter(id => id.trim() !== '') : [];
        
        let taxRatesData = null;
        let taxRatesError = null;
        
        // Only fetch tax rates if some are selected
        if (selectedTaxRateIds.length > 0) {
            const result = await supabaseAdmin
                .from('tax_rates')
                .select('id, name, rate, description') // Fetch description as well
                .in('id', selectedTaxRateIds)
                .eq('is_active', true);
            taxRatesData = result.data;
            taxRatesError = result.error;
        }

        if (taxRatesError) {
            throw new Error(`Failed to fetch tax rates: ${taxRatesError.message}`);
        }

        let totalTaxAmountInCents = 0;
        const paymentTaxesToInsert: Array<{
            tax_rate_id: string;
            tax_amount: number;
            tax_rate_snapshot: number;
            tax_name_snapshot: string;
            tax_description_snapshot: string | null; // Add description snapshot
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
                    tax_description_snapshot: taxRate.description, // Store description
                });
            }
        }
        const totalAmountInCents = subtotalAmountInCents + totalTaxAmountInCents;
        // --- End Multi-Tax Calculation ---

        // console.log("Admin new payment action: Inserting payment record...");
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
        console.log(`Payment ${paymentId} recorded. Status: ${status}. Subtotal: ${subtotalAmountInCents}, Total Tax: ${totalTaxAmountInCents}, Total: ${totalAmountInCents}`);

        // Insert student links if applicable
        if ((type === 'monthly_group' || type === 'yearly_group') && studentIds.length > 0) {
            const paymentStudentsToInsert = studentIds.map(studentId => ({
                payment_id: paymentId,
                student_id: studentId,
            }));
            const { error: insertStudentsError } = await supabaseAdmin
                .from('payment_students')
                .insert(paymentStudentsToInsert);

            if (insertStudentsError) {
                console.error(`Error inserting payment_students for payment ${paymentId}:`, insertStudentsError.message);
                // For now, return error indicating partial failure.
                return json<ActionData>({error: `Payment recorded, but failed to link students: ${insertStudentsError.message}`}, {
                    status: 500,
                    headers: Object.fromEntries(headers)
                });
            }
            console.log(`Inserted ${paymentStudentsToInsert.length} student links for payment ${paymentId}.`);
        }

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
            // console.log(`Recording Individual Session purchase for payment ${paymentId}, quantity: ${quantity}`);
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

        // If it's a Stripe payment, redirect to the payment page to handle it.
        if (paymentMethod === 'stripe') {
            console.log(`Stripe payment initiated. Redirecting to payment page for payment ${paymentId}.`);
            return redirect(`/pay/${paymentId}`, { headers: Object.fromEntries(headers) });
        }

        // Redirect to the payments index page on success for other methods
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
    const {families, students, taxRates} = useLoaderData<typeof loader>(); // Get families and taxRates
    // Single declaration for action data
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // Ref for family field to enable focus
    const familySelectRef = useRef<HTMLButtonElement>(null);

    // State for controlled Select components
    const [selectedFamily, setSelectedFamily] = useState<string | undefined>(undefined);
    const [familyStudents, setFamilyStudents] = useState<StudentInfo[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [selectedMethod, setSelectedMethod] = useState<string | undefined>(undefined);
    // selectedStatus state removed
    const [selectedType, setSelectedType] = useState<string>('monthly_group'); // Use selectedType state
    const [subtotalStr, setSubtotalStr] = useState<string>(''); // State for subtotal input string
    const [selectedTaxRateIds, setSelectedTaxRateIds] = useState<Set<string>>(new Set()); // State for selected tax rates

    // Focus on family field when component mounts
    useEffect(() => {
        if (familySelectRef.current) {
            familySelectRef.current.focus();
        }
    }, []);

    useEffect(() => {
        if (selectedFamily) {
            const currentFamilyStudents = students.filter(s => s.family_id === selectedFamily);
            setFamilyStudents(currentFamilyStudents);
            setSelectedStudentIds(new Set()); // Reset student selection when family changes

            // If a group payment type is selected but the new family has no students, reset the type.
            if (currentFamilyStudents.length === 0 && (selectedType === 'monthly_group' || selectedType === 'yearly_group')) {
                setSelectedType('other'); // Default to 'other'
            }
        } else {
            setFamilyStudents([]);
            setSelectedStudentIds(new Set());
        }
    }, [selectedFamily, students, selectedType]);

    const handleCheckboxChange = (studentId: string, checked: boolean) => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (checked) {
                next.add(studentId);
            } else {
                next.delete(studentId);
            }
            return next;
        });
    };

    // Client-side calculation for display
    const calculateDisplayAmounts = () => {
        const subtotalNum = parseFloat(subtotalStr);
        if (isNaN(subtotalNum) || subtotalNum < 0) {
            return { subtotal: 0, taxes: [], total: 0 };
        }
        const subtotalCents = Math.round(subtotalNum * 100);
        let totalTaxCents = 0;
        const calculatedTaxes: Array<{ name: string; description: string | null; amount: number }> = [];

        // Use only selected tax rates from loader data
        if (taxRates && taxRates.length > 0) {
            for (const taxRate of taxRates) {
                // Only calculate tax if this tax rate is selected
                if (selectedTaxRateIds.has(taxRate.id)) {
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
            <AppBreadcrumb items={breadcrumbPatterns.adminPaymentNew()} className="mb-6" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                    Record New Payment
                </h1>
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
                                <SelectTrigger id="familyId" tabIndex={1} ref={familySelectRef} className="input-custom-styles">
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
                                <SelectTrigger id="type" tabIndex={2} className="input-custom-styles"> {/* Update id */}
                                    <SelectValue placeholder="Select payment type"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly_group"
                                                disabled={!!(selectedFamily && familyStudents.length === 0)}>Monthly Group Class</SelectItem>
                                    <SelectItem value="yearly_group"
                                                disabled={!!(selectedFamily && familyStudents.length === 0)}>Yearly Group Class</SelectItem>
                                    <SelectItem value="individual_session">Individual Session</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            {actionData?.fieldErrors?.type && ( // Check 'type' field error
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.type}</p>
                            )}
                        </div>

                        {/* Conditionally show student selection */}
                        {(selectedType === 'monthly_group' || selectedType === 'yearly_group') && selectedFamily && (
                            <div className="border p-4 rounded-md mt-4 bg-gray-50/50 dark:bg-gray-700/50 dark:border-gray-600">
                                <Label className="font-semibold">Students</Label>
                                {familyStudents.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                        {familyStudents.map(student => (
                                            <div key={student.id} className="flex items-center space-x-3">
                                                <Checkbox
                                                    id={`student-${student.id}`}
                                                    checked={selectedStudentIds.has(student.id)}
                                                    onCheckedChange={(checked) => handleCheckboxChange(student.id, !!checked)}
                                                    tabIndex={2 + familyStudents.indexOf(student) + 1}
                                                />
                                                <Label htmlFor={`student-${student.id}`} className="font-normal cursor-pointer">
                                                    {student.first_name} {student.last_name}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 mt-2">No students found for this family.</p>
                                )}
                                {actionData?.fieldErrors?.studentIds && (
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.studentIds}</p>
                                )}
                            </div>
                        )}

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
                                    tabIndex={3}
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
                                tabIndex={4}
                            />
                            {actionData?.fieldErrors?.subtotalAmount && (
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.subtotalAmount}</p>
                            )}
                        </div>

                        {/* Tax Rates Selection */}
                        <div>
                            <Label className="block text-sm font-medium mb-1">
                                Tax Rates
                            </Label>
                            <div className="space-y-2 mt-2">
                                {taxRates.length > 0 ? (
                                    taxRates.map((taxRate) => (
                                        <div key={taxRate.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`tax-${taxRate.id}`}
                                                checked={selectedTaxRateIds.has(taxRate.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedTaxRateIds(prev => {
                                                        const newIds = new Set(prev);
                                                        if (checked) {
                                                            newIds.add(taxRate.id);
                                                        } else {
                                                            newIds.delete(taxRate.id);
                                                        }
                                                        return newIds;
                                                    });
                                                }}
                                            />
                                            <Label
                                                htmlFor={`tax-${taxRate.id}`}
                                                className="text-sm font-normal cursor-pointer"
                                            >
                                                {taxRate.name} ({(taxRate.rate * 100).toFixed(2)}%)
                                                {taxRate.description && (
                                                    <span className="text-muted-foreground ml-1">- {taxRate.description}</span>
                                                )}
                                            </Label>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground">No tax rates available</p>
                                )}
                            </div>
                            {/* Hidden input to submit selected tax rate IDs */}
                            <input
                                type="hidden"
                                name="selectedTaxRateIds"
                                value={Array.from(selectedTaxRateIds).join(',')}
                            />
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

                        {/* Payment Date (hidden for Stripe) */}
                        {selectedMethod !== 'stripe' && (
                            <div>
                                <Label htmlFor="paymentDate">Payment Date</Label>
                                <Input
                                    id="paymentDate"
                                    name="paymentDate"
                                    type="date"
                                    defaultValue={getTodayDateString()}
                                    required={selectedMethod !== 'stripe'}
                                    className="mt-1"
                                    tabIndex={5}
                                />
                                {actionData?.fieldErrors?.paymentDate && (
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.paymentDate}</p>
                                )}
                            </div>
                        )}

                        {/* Payment Method */}
                        <div>
                            <Label htmlFor="paymentMethod">Payment Method</Label>
                            <Select
                                name="paymentMethod"
                                value={selectedMethod}
                                onValueChange={setSelectedMethod}
                                required
                            >
                                <SelectTrigger id="paymentMethod" tabIndex={6} className="input-custom-styles">
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

                        {/* Stripe Info Message */}
                        {selectedMethod === 'stripe' && (
                            <Alert variant="default" className="bg-blue-50 dark:bg-gray-700 border-blue-200 dark:border-gray-600">
                                <AlertTitle className="text-blue-800 dark:text-blue-200">Stripe Payment</AlertTitle>
                                <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                                    After submitting, you will be redirected to a secure Stripe payment page to complete the transaction. The payment will be marked as &apos;pending&apos; until completed.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Notes */}
                        <div>
                            <Label htmlFor="notes">Notes (Optional)</Label>
                            <Textarea
                                id="notes"
                                name="notes"
                                placeholder="e.g., Cheque #123, Paid for June fees"
                                className="mt-1"
                                rows={3}
                                tabIndex={7}
                            />
                        </div>

                    </div>

                    <input type="hidden" name="studentIds" value={Array.from(selectedStudentIds).join(',')} />

                    <div className="mt-8 flex justify-end">
                        <Button type="submit" disabled={isSubmitting} tabIndex={8}>
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
            {error && (
                <pre
                    className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs dark:bg-red-900/50 dark:text-red-100">
          {error.stack || JSON.stringify(error, null, 2)}
        </pre>
            )}
            <a href="/admin/payments" className="text-blue-600 hover:underline mt-4 inline-block">
                Return to Payments List
            </a>
        </div>
    );
}
