import { json, type ActionFunctionArgs, type LoaderFunctionArgs, redirect, TypedResponse } from "@remix-run/node";
import { Link, useFetcher, useLoaderData, useNavigate, useRouteError, useSearchParams } from "@remix-run/react"; // Import useSearchParams
import { useState, useEffect, useRef } from "react"; // Add useRef
import { checkStudentEligibility, createInitialPaymentRecord, type EligibilityStatus, getSupabaseServerClient } from "~/utils/supabase.server";import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {ExclamationTriangleIcon, InfoCircledIcon} from "@radix-ui/react-icons";
import {siteConfig} from "~/config/site";
import {Checkbox} from "~/components/ui/checkbox";
import {format} from 'date-fns';
import {RadioGroup, RadioGroupItem} from "~/components/ui/radio-group"; // Import RadioGroup
import {Label} from "~/components/ui/label";
import {Database} from "~/types/supabase";

// Payment Calculation (Existing logic needs adjustment)
//
// The logic resides entirely within the loader function of the payment page (app/routes/_layout.family.payment.tsx). It does not rely on a specific "tier" field stored in the database. Instead, it calculates the next
// appropriate tier dynamically each time the payment page is loaded:
//
//  1 Fetch Successful Payment History: The loader queries the payments table for all records associated with the current family_id that have a status of 'succeeded'.
//  2 Fetch Payment-Student Links: It then queries the payment_students junction table to find out which specific student_id was included in each of those successful payments.
//  3 Count Past Payments Per Student: For each student belonging to the family, the code counts how many times their student_id appears in the results from step 2 (i.e., how many successful payments they have been part
//    of in the past).
//  4 Determine Next Tier: Based on this pastPaymentCount:
//     • If pastPaymentCount is 0, the student is considered to be on their "Trial" or needing their "1st Month" payment. The loader calculates the nextPaymentAmount using siteConfig.pricing.firstMonth and sets the
//       nextPaymentTierLabel to "1st Month".
//     • If pastPaymentCount is 1, the student needs their "2nd Month" payment. The loader uses siteConfig.pricing.secondMonth and sets the label to "2nd Month".
//     • If pastPaymentCount is 2 or more, the student is on the "Ongoing" rate. The loader uses siteConfig.pricing.monthly and sets the label to "Monthly".
//  5 Pass to Component: This calculated nextPaymentAmount and nextPaymentTierLabel (along with eligibility status) for each student are then passed as studentPaymentDetails to the payment page component for display and
//    use in the dynamic total calculation when checkboxes are selected.


// Define the structure for student payment details, including eligibility
interface StudentPaymentDetail {
    studentId: string;
    firstName: string;
    lastName: string;
    eligibility: EligibilityStatus; // Current status (Trial, Paid, Expired)
    needsPayment: boolean; // True if status is Trial or Expired
    nextPaymentAmount: number; // Amount in dollars for their next tier
    nextPaymentTierLabel: string; // Label for their next tier (1st Month, 2nd Month, Monthly)
    pastPaymentCount: number; // Needed to determine next tier
    // Add calculated price IDs for monthly tiers
    nextPaymentPriceId: string; // Stripe Price ID for their next monthly tier
}

// Define payment options
type PaymentOption = 'monthly' | 'yearly' | 'individual';

// Updated Loader data interface
export interface LoaderData {
    familyId: string;
    familyName: string;
    // No longer need the separate 'students' array, details are in studentPaymentDetails
    studentPaymentDetails?: StudentPaymentDetail[];
    // stripePublishableKey is no longer needed here
    error?: string;
}

// Loader function
export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        // Should be protected by layout, but handle defensively
        throw redirect("/login", {headers});
    }

    // Get profile to find family_id
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single() as { data: { family_id: string | null } | null, error: Error };
    console.log("Profile Data:", profileData, "Profile Error:", profileError);

    if (profileError || !profileData?.family_id) {
        console.error("Payment Loader Error: Failed to load profile or family_id", profileError?.message);
        // Redirect back to family portal with an error message? Or throw a generic error?
        // For now, throw an error that the boundary can catch.
        throw new Response("Could not load your family information. Please try again.", {status: 500});
    }

    const familyId = profileData.family_id;

    // --- Fetch Family, Students, and Payment History ---

    // 1. Fetch Family Name
    const {data: familyData, error: familyError} = await supabaseServer
        .from('families')
        .select('name')
        .eq('id', familyId)
        .single() as { data: { name: string | null } | null, error: Error };

    if (familyError || !familyData) {
        console.error("Payment Loader Error: Failed to load family name", familyError?.message);
        throw new Response("Could not load family details.", {status: 500, headers});
    }
    const familyName: string = familyData.name!;

    // 2. Fetch Students for the Family
    const {data: studentsData, error: studentsError} = await supabaseServer
        .from('students')
        .select('id::text, first_name::text, last_name::text')
        .eq('family_id', familyId);

    if (studentsError) {
        console.error("Payment Loader Error: Failed to load students", studentsError.message);
        throw new Response("Could not load student information.", {status: 500, headers});
    }
    if (!studentsData || studentsData.length === 0) {
        // Return specific error handled by the component
        return json({
            familyId,
            familyName,
            // No students found, return empty details
            error: "No students found in this family."
        }, {headers});
    }
    const students = studentsData; // Keep full student list

    // 3. Fetch Successful Payments for the Family
    const {data: paymentsData, error: paymentsError} = await supabaseServer
        .from('payments')
        .select('id, status') // Only need id and status
        .eq('family_id', familyId)
        .eq('status', 'succeeded'); // Only count successful payments

    if (paymentsError) {
        console.error("Payment Loader Error: Failed to load payments", paymentsError.message);
        throw new Response("Could not load payment history.", {status: 500, headers});
    }
    const successfulPaymentIds = paymentsData?.map(p => p.id) || [];

    // 4. Fetch Payment-Student Links for Successful Payments
    let paymentStudentLinks: Array<{ student_id: string, payment_id: string }> = [];
    if (successfulPaymentIds.length > 0) {
        const {data: linksData, error: linksError} = await supabaseServer
            .from('payment_students')
            .select('student_id, payment_id')
            .in('payment_id', successfulPaymentIds) as {
            data: Array<{ student_id: string, payment_id: string }> | null,
            error: Error
        };

        if (linksError) {
            console.error("Payment Loader Error: Failed to load payment links", linksError.message);
            throw new Response("Could not load payment link history.", {status: 500, headers});
        }
        paymentStudentLinks = linksData || [];
    }

    // --- Calculate Eligibility and Next Payment Details Per Student ---
    const studentPaymentDetails: StudentPaymentDetail[] = [];
    // let totalAmountInCents = 0; // Remove pre-calculation

    for (const student of students) {
        // 1. Check current eligibility
        const eligibility = await checkStudentEligibility(student.id, supabaseServer);

        // 2. Determine next payment tier based on past successful payments
        const pastPaymentCount = paymentStudentLinks.filter(link => link.student_id === student.id).length;
        let nextPaymentAmount = 0;
        let nextPaymentTierLabel = "";
        let nextPaymentPriceId = ""; // Stripe Price ID

        // Determine next MONTHLY tier and price ID
        if (pastPaymentCount === 0) {
            nextPaymentAmount = siteConfig.pricing.firstMonth;
            nextPaymentTierLabel = "1st Month";
            nextPaymentPriceId = siteConfig.stripe.priceIds.firstMonth;
        } else if (pastPaymentCount === 1) {
            nextPaymentAmount = siteConfig.pricing.secondMonth;
            nextPaymentTierLabel = "2nd Month";
            nextPaymentPriceId = siteConfig.stripe.priceIds.secondMonth;
        } else { // 2 or more past payments
            nextPaymentAmount = siteConfig.pricing.monthly;
            nextPaymentTierLabel = "Monthly";
            nextPaymentPriceId = siteConfig.stripe.priceIds.monthly;
        }

        // 3. Determine if group class payment is needed now
        // Eligibility check already filters for group payments ('Paid - Monthly', 'Paid - Yearly', 'Expired', 'Trial')
        const needsPayment = eligibility.reason === 'Trial' || eligibility.reason === 'Expired';

        studentPaymentDetails.push({
            studentId: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            eligibility: eligibility,
            needsPayment: needsPayment,
            nextPaymentAmount: nextPaymentAmount, // This is the calculated MONTHLY amount
            nextPaymentTierLabel: nextPaymentTierLabel, // Monthly tier label
            nextPaymentPriceId: nextPaymentPriceId, // Monthly tier Price ID
            pastPaymentCount: pastPaymentCount,
        });
    }

    // --- Prepare and Return Data ---
    // Stripe key is no longer needed in the loader for this page

    // Return data without pre-calculated total
    return json({
        familyId,
        familyName,
        studentPaymentDetails, // This now contains all student info needed
        // stripePublishableKey removed
    }, {headers});
}


// --- Action Function ---
type ActionResponse = {
    error?: string;
    fieldErrors?: { [key: string]: string };
};

// Update return type: Action returns JSON data (success/error)
export async function action({ request }: ActionFunctionArgs): Promise<TypedResponse<ActionResponse & { success?: boolean; paymentId?: string }>> {
    const { supabaseServer, response } = getSupabaseServerClient(request);
    const formData = await request.formData();

    const familyId = formData.get('familyId') as string;
    const paymentOption = formData.get('paymentOption') as PaymentOption;
    const studentIdsString = formData.get('studentIds') as string; // Comma-separated, potentially empty
    const oneOnOneQuantityStr = formData.get('oneOnOneQuantity') as string; // Quantity for individual

    // --- Validation ---
    const fieldErrors: ActionResponse['fieldErrors'] = {};
    if (!familyId) fieldErrors.familyId = "Missing family information."; // Should not happen if form is correct
    if (!paymentOption) fieldErrors.paymentOption = "Payment option is required.";

    const studentIds = (paymentOption === 'monthly' || paymentOption === 'yearly')
        ? (studentIdsString ? studentIdsString.split(',').filter(id => id) : [])
        : [];

    let oneOnOneQuantity = 1; // Default
    if (paymentOption === 'individual') {
        if (!oneOnOneQuantityStr || isNaN(parseInt(oneOnOneQuantityStr)) || parseInt(oneOnOneQuantityStr) <= 0) {
            fieldErrors.oneOnOneQuantity = "A valid positive quantity is required for Individual Sessions.";
        } else {
            oneOnOneQuantity = parseInt(oneOnOneQuantityStr);
        }
    } else if ((paymentOption === 'monthly' || paymentOption === 'yearly') && studentIds.length === 0) {
        fieldErrors.studentIds = "Please select at least one student for group payments.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return json({ error: "Please correct the errors below.", fieldErrors }, { status: 400, headers: response.headers });
    }
    // --- End Validation ---


    // --- Server-Side Calculation & Payment Record Creation ---
    let totalAmountInCents = 0;
    let type: Database['public']['Enums']['payment_type_enum']; // Use 'type' variable

    try {
        console.log("[Action] Entered try block. Calculating amount...");
        // --- Restore Original Logic ---
        if (paymentOption === 'individual') {
            type = 'individual_session'; // Assign to 'type'
            totalAmountInCents = siteConfig.pricing.oneOnOneSession * oneOnOneQuantity * 100;
        } else if (paymentOption === 'yearly') {
            type = 'yearly_group'; // Assign to 'type'
            totalAmountInCents = siteConfig.pricing.yearly * studentIds.length * 100;
        } else { // Monthly
            type = 'monthly_group'; // Assign to 'type'
            // Need to fetch student history again server-side for accurate calculation
            for (const studentId of studentIds) {
                // Use the same logic as the API endpoint to get history
                const { count: pastPaymentCount, error: countError } = await supabaseServer
                    .from('payment_students')
                    .select('payments!inner(status)', { count: 'exact', head: true })
                    .eq('student_id', studentId)
                    .eq('payments.status', 'succeeded');

                if (countError) {
                    console.error(`Action Error: Failed to get payment count for student ${studentId}`, countError.message);
                    throw new Error(`Could not verify payment history for student ${studentId}.`);
                }
                const count = pastPaymentCount ?? 0;

                let unitAmount: number; // Amount in cents
                if (count === 0) unitAmount = siteConfig.pricing.firstMonth * 100;
                else if (count === 1) unitAmount = siteConfig.pricing.secondMonth * 100;
                else unitAmount = siteConfig.pricing.monthly * 100;
                totalAmountInCents += unitAmount;
            }
        }
        console.log(`[Action] Amount calculated: ${totalAmountInCents} cents. Type: ${type}`); // Log 'type'

        if (totalAmountInCents <= 0) {
            console.error("[Action] Calculated amount is zero or negative. Returning error.");
            return json({ error: "Calculated payment amount must be positive." }, { status: 400, headers: response.headers });
        }

        // Create the initial payment record
        console.log("[Action] Calling createInitialPaymentRecord...");
        const { data: paymentRecord, error: createError } = await createInitialPaymentRecord(
            familyId,
            totalAmountInCents,
            studentIds, // Pass selected student IDs (empty for individual)
            type // Pass 'type' variable
        );
        console.log(`[Action] createInitialPaymentRecord result: data=${JSON.stringify(paymentRecord)}, error=${createError}`);

        if (createError || !paymentRecord?.id) {
            console.error("[Action] Error condition met after createInitialPaymentRecord. Returning JSON error.", createError);
            return json({ error: `Failed to initialize payment: ${createError || 'Payment ID missing'}` }, { status: 500, headers: response.headers });
        }

        // Return full JSON success data including paymentId
        const paymentId = paymentRecord.id;
        console.log(`[Action] Payment record created successfully (ID: ${paymentId}). Returning success JSON with paymentId...`);
        return json({ success: true, paymentId: paymentId }, { headers: response.headers }); // Return success and ID

    } catch (error) {
        // This catch block handles actual errors
        console.log("[Action] Caught actual error in catch block:", error);
        // No need to check for Response instance here anymore
        const message = error instanceof Error ? error.message : "An unexpected error occurred during payment setup.";
        console.error("Action Error (in catch):", message); // Clarify log source
        return json({ error: message }, { status: 500, headers: response.headers });
    } // The main try block ends here
}


export default function FamilyPaymentPage() {
    // Destructure the updated loader data (no stripePublishableKey)
    const {
        familyId,
        studentPaymentDetails,
        // stripePublishableKey removed
        error: loaderError
    } = useLoaderData<typeof loader>();
    // Use fetcher instead of actionData/navigation for this form
    const fetcher = useFetcher<ActionResponse & { success?: boolean; paymentId?: string }>();
    const navigate = useNavigate();
    const formRef = useRef<HTMLFormElement>(null); // Add ref for the form
    const [searchParams] = useSearchParams(); // Get search params

    // --- Restore State & Calculations ---
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    // Set initial payment option based on URL query param, default to 'monthly'
    const initialOption = searchParams.get('option') === 'individual' ? 'individual' : 'monthly';
    const [paymentOption, setPaymentOption] = useState<PaymentOption>(initialOption); // State for payment option
    const [oneOnOneQuantity, setOneOnOneQuantity] = useState(1); // State for 1:1 session quantity

    // const isSubmitting = fetcher.state !== 'idle'; // Unused: fetcher.state is used directly in button disabled prop

    // --- Dynamic Calculation ---
    const calculateTotal = () => {
        let total = 0;
        if (paymentOption === 'monthly' || paymentOption === 'yearly') {
            selectedStudentIds.forEach(id => {
                const detail = studentPaymentDetails!.find(d => d.studentId === id);
                if (detail) {
                    const amount = paymentOption === 'yearly'
                        ? siteConfig.pricing.yearly // Use fixed yearly price
                        : detail.nextPaymentAmount; // Use calculated monthly price
                    total += amount * 100; // Add amount in cents
                }
            });
        } else if (paymentOption === 'individual') { // Corrected check
            total = siteConfig.pricing.oneOnOneSession * oneOnOneQuantity * 100; // Use individual price * quantity
        }
        return total;
    };

    const currentTotalInCents = calculateTotal();
    const currentTotalDisplay = `${siteConfig.pricing.currency}${(currentTotalInCents / 100).toFixed(2)}`;
    // --- End Dynamic Calculation ---


    // Remove Stripe loading and redirection useEffect hooks

    // --- Event Handlers ---
    const handleCheckboxChange = (studentId: string, checked: boolean | 'indeterminate') => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (checked === true) {
                next.add(studentId);
            } else {
                next.delete(studentId);
            }
            return next;
        });
    };

    // Remove handlePaymentSubmit function - logic moved to action

    // --- End Event Handlers ---

    // --- Effect for Client-Side Navigation (using fetcher data) ---
    useEffect(() => {
        console.log("[Effect] Running navigation effect. fetcher.data:", fetcher.data); // Log effect run and fetcher data
        // Check for both success flag and paymentId before navigating
        if (fetcher.data?.success && fetcher.data?.paymentId) {
            console.log(`[Effect] Condition met: Fetcher successful. Navigating to /pay/${fetcher.data.paymentId}`);
            navigate(`/pay/${fetcher.data.paymentId}`);
        } else if (fetcher.data) {
            // Log if fetcher.data exists but doesn't meet the success condition
            console.log("[Effect] Condition NOT met: fetcher.data present but success/paymentId missing.", fetcher.data);
            if (fetcher.data.error) {
                 console.error("[Effect] Fetcher returned error:", fetcher.data.error);
            }
        } else {
             // Only log if state is idle, otherwise it might just be loading
             if (fetcher.state === 'idle') {
                console.log("[Effect] Condition NOT met: fetcher.data is null/undefined and state is idle.");
             }
        }
    }, [fetcher.data, fetcher.state, navigate]); // Add fetcher.state to dependencies
    // --- End Effect ---


    // Handle case where loader found no students (error message comes from loader data)
    if (loaderError === "No students found in this family.") {
        return (
            <div className="container mx-auto px-4 py-8 max-w-md">
                <Alert variant="destructive">
                    <ExclamationTriangleIcon className="h-4 w-4"/>
                    <AlertTitle>No Students Found</AlertTitle>
                    <AlertDescription>
                        You must have at least one student registered in your family to make a payment.
                        Please <Link to="/family/add-student" className="font-medium underline">add a
                        student</Link> first.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // Remove Stripe key check - key is only needed on the /pay page now

    // Handle other potential loader errors (e.g., failed to get familyId)
    // studentPaymentDetails will be empty if students couldn't be loaded properly by the loader logic
    if (!familyId || !studentPaymentDetails) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-md">
                <Alert variant="destructive" className="mb-4">
                    <ExclamationTriangleIcon className="h-4 w-4"/>
                    <AlertTitle>Error Loading Payment Details</AlertTitle>
                    <AlertDescription>
                        Could not load necessary payment information. Please return to the
                        <Link to="/family" className="font-medium underline px-1">Family Portal</Link>
                        and try again, or contact support if the problem persists.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // Removed old static calculation logic

    return (
        <div className="container mx-auto px-4 py-8 max-w-lg"> {/* Increased max-width */}
            <h1 className="text-2xl font-bold mb-6 text-center">Make Payment</h1>

            {/* Display errors from fetcher.data */}
            {fetcher.data?.error && (
                <Alert variant="destructive" className="mb-4">
                    <ExclamationTriangleIcon className="h-4 w-4"/>
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{fetcher.data.error}</AlertDescription>
                    {/* Optionally display field-specific errors */}
                    {fetcher.data.fieldErrors && (
                        <ul className="list-disc pl-5 mt-2 text-sm">
                            {Object.entries(fetcher.data.fieldErrors).map(([field, error]) => (
                                error ? <li key={field}>{error}</li> : null
                            ))}
                        </ul>
                    )}
                </Alert>
            )}

            {/* Restore Payment Option Selection */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-600">Choose Payment Option</h2>
                {/* Use value prop for controlled component, remove defaultValue */}
                <RadioGroup value={paymentOption}
                            onValueChange={(value) => setPaymentOption(value as PaymentOption)} className="space-y-2">
                    {/* Option 1: Monthly Group Fees */}
                    <div className="flex items-center space-x-2">
                    <RadioGroupItem value="monthly" id="opt-monthly"/>
                        <Label htmlFor="opt-monthly">Pay Monthly Group Class Fees</Label>
                    </div>
                    {/* Option 2: Yearly Group Fees */}
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yearly" id="opt-yearly"/>
                        <Label htmlFor="opt-yearly">Pay Yearly Group Class Fees
                            ({siteConfig.pricing.currency}{siteConfig.pricing.yearly}/student)</Label>
                    </div>
                    {/* Option 3: Individual Session */}
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="individual" id="opt-individual"/> {/* Corrected value */}
                        <Label htmlFor="opt-individual">Purchase Individual Session(s) {/* Corrected label */}
                            ({siteConfig.pricing.currency}{siteConfig.pricing.oneOnOneSession}/session)</Label>
                    </div>
                </RadioGroup>

                {/* Conditional UI for Individual Session Quantity */}
                {paymentOption === 'individual' && ( // Corrected check
                    <div className="mt-4 pl-6">
                        <Label htmlFor="oneOnOneQuantity">Number of Sessions:</Label>
                        <Input
                            id="oneOnOneQuantity"
                            type="number"
                            min="1"
                            value={oneOnOneQuantity}
                            onChange={(e) => setOneOnOneQuantity(parseInt(e.target.value, 10) || 1)}
                            className="mt-1 w-20"
                        />
                         {fetcher.data?.fieldErrors?.oneOnOneQuantity && ( // Use fetcher.data
                            <p className="text-red-500 text-sm mt-1">{fetcher.data.fieldErrors.oneOnOneQuantity}</p>
                        )}
                    </div>
                )}
            </div>


            {/* Restore Student Selection & Payment Details Section (Conditional) */}
            {(paymentOption === 'monthly' || paymentOption === 'yearly') && studentPaymentDetails && studentPaymentDetails.length > 0 && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-600">
                        {paymentOption === 'yearly' ? 'Select Students for Yearly Payment' : 'Select Students for Monthly Payment'}
                    </h2>
                     {fetcher.data?.fieldErrors?.studentIds && ( // Use fetcher.data
                        <p className="text-red-500 text-sm mb-3">{fetcher.data.fieldErrors.studentIds}</p>
                    )}

                    {/* Student List with Checkboxes */}
                    <div className="space-y-4 mb-6">
                        {studentPaymentDetails.map(detail => (
                            <div key={detail.studentId}
                                 className={`flex items-start space-x-3 p-3 rounded-md ${detail.needsPayment ? 'border border-gray-200 dark:border-gray-700' : 'opacity-70 bg-gray-50 dark:bg-gray-700/50'}`}>
                                {detail.needsPayment ? (
                                    <Checkbox
                                        id={`student-${detail.studentId}`}
                                        checked={selectedStudentIds.has(detail.studentId)}
                                        onCheckedChange={(checked) => handleCheckboxChange(detail.studentId, checked)}
                                        className="mt-1" // Align checkbox better
                                    />
                                ) : (
                                    <div className="w-4 h-4 mt-1"> {/* Placeholder for alignment */} </div>
                                )}
                                <div className="flex-1">
                                    <label
                                        htmlFor={detail.needsPayment ? `student-${detail.studentId}` : undefined}
                                        className={`font-medium ${detail.needsPayment ? 'cursor-pointer' : 'cursor-default'}`}
                                    >
                                        {detail.firstName} {detail.lastName}
                                    </label>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        { (detail.eligibility.reason === 'Paid - Monthly' ||detail.eligibility.reason === 'Paid - Yearly')
                                            && detail.eligibility.lastPaymentDate &&
                                            `Active (Last Paid: ${format(new Date(detail.eligibility.lastPaymentDate), 'MMM d, yyyy')})`
                                        }
                                        {detail.eligibility.reason === 'Trial' &&
                                            `On Free Trial`
                                        }
                                        {detail.eligibility.reason === 'Expired' && detail.eligibility.lastPaymentDate &&
                                            `Expired (Last Paid: ${format(new Date(detail.eligibility.lastPaymentDate), 'MMM d, yyyy')})`
                                        }
                                        {detail.eligibility.reason === 'Expired' && !detail.eligibility.lastPaymentDate &&
                                            `Expired (No payment history)`
                                        }
                                    </p>
                                    {/* Show relevant price based on selection */}
                                    {detail.needsPayment && paymentOption === 'monthly' && (
                                        <p className="text-sm font-semibold text-green-700 dark:text-green-400 mt-1">
                                            Next Monthly
                                            Payment: {siteConfig.pricing.currency}{detail.nextPaymentAmount.toFixed(2)} ({detail.nextPaymentTierLabel})
                                        </p>
                                    )}
                                    {detail.needsPayment && paymentOption === 'yearly' && (
                                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mt-1">
                                            Yearly
                                            Payment: {siteConfig.pricing.currency}{siteConfig.pricing.yearly.toFixed(2)}
                                        </p>
                                    )}
                                    {/* Show message if payment not needed */}
                                    {!detail.needsPayment && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            Group class payment not currently due.
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )} {/* End conditional student selection div */}


            {/* Combined Total & Pricing Info Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                {/* Calculated Total Amount */}
                <div className="border-b pb-4 mb-4 dark:border-gray-600">
                    <div className="flex justify-between items-center font-bold text-lg">
                        <span>Total Due:</span>
                        <span>{currentTotalDisplay}</span>
                    </div>
                </div>

                {/* Pricing Info Alert */}
                <Alert variant="default"
                       className="bg-blue-50 dark:bg-gray-700 border-blue-200 dark:border-gray-600">
                    <InfoCircledIcon className="h-4 w-4 text-blue-600 dark:text-blue-300"/>
                    <AlertTitle className="text-blue-800 dark:text-blue-200">How Pricing Works</AlertTitle>
                    <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                        Your first class is a <span
                        className="font-semibold">{siteConfig.pricing.freeTrial}</span>.
                        Your first class is a <span className="font-semibold">{siteConfig.pricing.freeTrial}</span>.
                        Monthly fees are
                        tiered: {siteConfig.pricing.currency}{siteConfig.pricing.firstMonth} (1st), {siteConfig.pricing.currency}{siteConfig.pricing.secondMonth} (2nd),
                        then
                        {siteConfig.pricing.currency}{siteConfig.pricing.monthly}/mo per student.
                        Yearly fee: {siteConfig.pricing.currency}{siteConfig.pricing.yearly}/year per student.
                        1:1 Sessions: {siteConfig.pricing.currency}{siteConfig.pricing.oneOnOneSession}/session.
                        The total above reflects your current selection.
                    </AlertDescription>
                </Alert>
            </div>

            {/* Payment Form - Use standard form with fetcher.Form and add ID */}
            <fetcher.Form method="post" ref={formRef} id="payment-setup-form"> {/* Use fetcher.Form and add ID */}
                {/* Hidden fields for family info and selections */}
                <input type="hidden" name="familyId" value={familyId}/>
                <input type="hidden" name="paymentOption" value={paymentOption}/>
                {/* Pass selected student IDs */}
                <input type="hidden" name="studentIds" value={Array.from(selectedStudentIds).join(',')}/>
                {/* Pass quantity if individual option is selected */}
                {paymentOption === 'individual' && (
                    <input type="hidden" name="oneOnOneQuantity" value={oneOnOneQuantity}/>
                )}

                {/* Button is now outside the form but linked by the 'form' attribute */}
            </fetcher.Form> {/* fetcher.Form ends here */}

            {/* Button moved outside the form, now submits the form directly */}
            <div className="mt-6"> {/* Add some margin */}
                <Button
                    type="submit" // Change type to submit
                    form="payment-setup-form" // Associate with the form's new ID
                    className="w-full"
                    // Disable based on fetcher state and validation logic
                    disabled={
                        fetcher.state !== 'idle' || // Disable if fetcher is not idle
                        currentTotalInCents <= 0 ||
                        ((paymentOption === 'monthly' || paymentOption === 'yearly') && selectedStudentIds.size === 0) ||
                        (paymentOption === 'individual' && oneOnOneQuantity <= 0)
                    }
                >
                    {fetcher.state !== 'idle' ? "Setting up payment..." : `Proceed to Pay ${currentTotalDisplay}`}
                </Button>
            </div>

            <div className="mt-4 text-center">
                <Link to="/family" className="text-sm text-blue-600 hover:underline dark:text-blue-400"> {/* Link to family portal */}
                    Cancel and return to Family Portal
                </Link>
            </div>
        </div>
    );
}

// Error Boundary remains largely the same, but use useRouteError()
export function ErrorBoundary() {
    const error = useRouteError(); // Use this hook

    // Basic error display
    return (
        <div className="container mx-auto px-4 py-8 max-w-lg"> {/* Match container width */}
            <Alert variant="destructive">
                <ExclamationTriangleIcon className="h-4 w-4"/>
                <AlertTitle>Payment Page Error</AlertTitle>
                <AlertDescription>
                    {error instanceof Error
                        ? error.message
                        : "An unexpected error occurred while loading the payment page."}
                    Please try returning to the <Link to="/family" className="font-medium underline px-1">Family
                    Portal</Link>.
                </AlertDescription>
                {/* Optional: Display stack trace in development */}
                {process.env.NODE_ENV === "development" && error instanceof Error && (
                    <pre
                        className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs dark:bg-red-900/50 dark:text-red-100">
                        {error.stack}
                    </pre>
                )}
            </Alert>
        </div>
    );
}
