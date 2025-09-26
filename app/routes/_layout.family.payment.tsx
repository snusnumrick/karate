import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect, TypedResponse} from "@remix-run/node";
import {createInitialPaymentRecord, getSupabaseServerClient, getSupabaseAdminClient} from "~/utils/supabase.server";
import {getStudentPaymentOptions, getFamilyPaymentOptions, type EnrollmentPaymentOption} from "~/services/enrollment-payment.server";
import type {Database} from "~/types/database.types";
import {
    getFamilyIdFromUser,
    getFamilyPaymentEligibilityData,
    type PaymentEligibilityData
} from "~/services/payment-eligibility.server";
import {getTodayLocalDateString} from "~/components/calendar/utils";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {CreditCardIcon, Link} from "lucide-react";
import {ExclamationTriangleIcon} from "@radix-ui/react-icons";
import {useLoaderData, useRouteError, useSearchParams} from "@remix-run/react";
import {PaymentSetupForm} from "~/components/PaymentSetupForm";
import {csrf} from "~/utils/csrf.server";
import {
    Money,
    ZERO_MONEY,
    multiplyMoney,
    subtractMoney,
    maxMoney,
    createMoney,
    isPositive,
    toMoney,
    addMoney
} from "~/utils/money";

// Payment Calculation (Flat Monthly Rate)
//
// The logic resides entirely within the loader function of the payment page (app/routes/_layout.family.payment.tsx). With automatic discounts now in place,
// all students pay the same flat monthly rate, and discounts are applied automatically based on enrollment events and other criteria.
//
//  1 Fetch Successful Payment History: The loader queries the payments table for all records associated with the current family_id that have a status of 'succeeded'.
//  2 Fetch Payment-Student Links: It then queries the payment_students junction table to find out which specific student_id was included in each of those successful payments.
//  3 Count Past Payments Per Student: For each student belonging to the family, the code counts how many times their student_id appears in the results from step 2 (i.e., how many successful payments they have been part
//    of in the past). This is kept for historical tracking purposes.
//  4 Resolve Program Fees Dynamically: Monthly, yearly, and individual session amounts pull from the student's active program pricing so totals reflect current rates.
//     Automatic discounts will be applied at checkout for new students and other qualifying events.
//  5 Pass to Component: The calculated nextPaymentAmount and nextPaymentTierLabel (along with eligibility status) for each student are then passed as studentPaymentDetails to the payment page component for display and
//    use in the dynamic total calculation when checkboxes are selected.


// Define payment options
type PaymentOption = 'monthly' | 'yearly' | 'individual';

// Updated Loader data interface
export type LoaderData = PaymentEligibilityData;

// Loader function
export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        // Should be protected by layout, but handle defensively
        throw redirect("/login", {headers});
    }

    // Get family ID from user profile
    const {familyId, error: familyIdError} = await getFamilyIdFromUser(user.id, supabaseServer);

    if (familyIdError || !familyId) {
        throw new Response(familyIdError || "Could not load your family information. Please try again.", {status: 500});
    }

    // Get payment eligibility data using the reusable service
    const paymentData: PaymentEligibilityData = await getFamilyPaymentEligibilityData(familyId, supabaseServer);

    if (paymentData.error) {
        // Handle specific errors that should be shown to the user vs thrown
        if (paymentData.error === "No students found in this family.") {
            return json(paymentData, {headers});
        }
        throw new Response(paymentData.error, {status: 500, headers});
    }

    // Convert nextPaymentAmount from serialized number back to Money type
    const convertedPaymentData = {
      ...paymentData,
      studentPaymentDetails: paymentData.studentPaymentDetails.map(detail => ({
        ...detail,
        nextPaymentAmount: toMoney(detail.nextPaymentAmount as unknown),
        monthlyAmount: detail.monthlyAmount ? toMoney(detail.monthlyAmount as unknown) : undefined,
        yearlyAmount: detail.yearlyAmount ? toMoney(detail.yearlyAmount as unknown) : undefined,
        individualSessionAmount: detail.individualSessionAmount ? toMoney(detail.individualSessionAmount as unknown) : undefined,
      }))
    };

    return json(convertedPaymentData, {headers});
}


// --- Action Function ---
type ActionResponse = {
    error?: string;
    fieldErrors?: { [key: string]: string };
    zeroPayment?: boolean;
};

// Update return type: Action returns JSON data (success/error)
export async function action({request}: ActionFunctionArgs): Promise<TypedResponse<ActionResponse & {
    success?: boolean;
    supabasePaymentId?: string
}>> {
    const {supabaseServer, response} = getSupabaseServerClient(request);
    
    // CSRF validation
    await csrf.validate(request);
    
    const formData = await request.formData();

    const familyId = formData.get('familyId') as string;
    const paymentOption = formData.get('paymentOption') as PaymentOption;
    const studentIdsString = formData.get('studentIds') as string; // Comma-separated, potentially empty
    const enrollmentId = formData.get('enrollmentId') as string | null;
    const oneOnOneQuantityStr = formData.get('oneOnOneQuantity') as string; // Quantity for individual
    const discountCodeId = formData.get('discountCodeId') as string | null; // Discount code ID
    const discountAmountStr = formData.get('discountAmount') as string | null; // Discount amount

    console.log("[Action] Received payment form data:", formData);
    console.log("[Action] FormData entries:", Object.fromEntries(formData.entries()));
    console.log("[Action] FormData keys:", Array.from(formData.keys()));
    console.log("[Action] FormData values:", Array.from(formData.values()));

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
        return json({error: "Please correct the errors below.", fieldErrors}, {status: 400, headers: response.headers});
    }
    // --- End Validation ---


    // --- Server-Side Calculation & Payment Record Creation ---
    let totalAmount : Money = ZERO_MONEY;
    let type: Database['public']['Enums']['payment_type_enum']; // Use 'type' variable

    try {
        const familyPaymentOptions = await getFamilyPaymentOptions(familyId, supabaseServer);
        const pricingByStudent = new Map<string, EnrollmentPaymentOption[]>(
            familyPaymentOptions.map(option => [option.studentId, option.enrollments])
        );

        let enrollmentDetails: EnrollmentPaymentOption | undefined;
        if (enrollmentId && studentIds.length > 0) {
            const studentId = studentIds[0];
            const paymentOptions = await getStudentPaymentOptions(studentId, supabaseServer);
            enrollmentDetails = paymentOptions?.enrollments.find(e => e.enrollmentId === enrollmentId);
        }

        const resolveMonthlyAmount = (studentId: string): Money | null => {
            if (enrollmentDetails && enrollmentDetails.studentId === studentId && enrollmentDetails.monthlyAmount) {
                return enrollmentDetails.monthlyAmount;
            }
            const enrollments = pricingByStudent.get(studentId) ?? [];
            const match = enrollments.find(option => option.monthlyAmount);
            return match?.monthlyAmount ?? null;
        };

        const resolveYearlyAmount = (studentId: string): Money | null => {
            if (enrollmentDetails && enrollmentDetails.studentId === studentId && enrollmentDetails.yearlyAmount) {
                return enrollmentDetails.yearlyAmount;
            }
            const enrollments = pricingByStudent.get(studentId) ?? [];
            const match = enrollments.find(option => option.yearlyAmount);
            return match?.yearlyAmount ?? null;
        };

        const resolveIndividualSessionAmount = (): Money => {
            if (enrollmentDetails?.individualSessionAmount) {
                return enrollmentDetails.individualSessionAmount;
            }
            if (studentIds.length > 0) {
                for (const studentId of studentIds) {
                    const enrollments = pricingByStudent.get(studentId) ?? [];
                    const match = enrollments.find(option => option.individualSessionAmount);
                    if (match?.individualSessionAmount) {
                        return match.individualSessionAmount;
                    }
                }
            }
            for (const option of familyPaymentOptions) {
                const match = option.enrollments.find(enrollment => enrollment.individualSessionAmount);
                if (match?.individualSessionAmount) {
                    return match.individualSessionAmount;
                }
            }
            return ZERO_MONEY;
        };

        if (paymentOption === 'individual') {
            type = 'individual_session';
            const sessionAmount = resolveIndividualSessionAmount();
            if (!isPositive(sessionAmount)) {
                throw new Error('Individual session pricing is not configured for this family.');
            }
            totalAmount = multiplyMoney(sessionAmount, oneOnOneQuantity);
        } else if (paymentOption === 'yearly') {
            type = 'yearly_group';
            let subtotal = ZERO_MONEY;
            const missing: string[] = [];
            studentIds.forEach(studentId => {
                const amount = resolveYearlyAmount(studentId);
                if (!amount || !isPositive(amount)) {
                    missing.push(studentId);
                    return;
                }
                subtotal = addMoney(subtotal, amount);
            });
            if (missing.length > 0) {
                throw new Error('Yearly pricing is not configured for one or more selected students.');
            }
            totalAmount = subtotal;
        } else {
            type = 'monthly_group';
            let subtotal = ZERO_MONEY;
            const missing: string[] = [];
            studentIds.forEach(studentId => {
                const amount = resolveMonthlyAmount(studentId);
                if (!amount || !isPositive(amount)) {
                    missing.push(studentId);
                    return;
                }
                subtotal = addMoney(subtotal, amount);
            });
            if (missing.length > 0) {
                throw new Error('Monthly pricing is not configured for one or more selected students.');
            }
            totalAmount = subtotal;
        }
        const subtotalAmount = totalAmount;

        // Parse discount amount
        const discountAmount : Money = discountAmountStr ? createMoney(discountAmountStr, true) : ZERO_MONEY;

        // Apply discount to subtotal
        const finalSubtotal : Money = maxMoney(ZERO_MONEY,subtractMoney(subtotalAmount, discountAmount));

        // Handle zero payment case - create a succeeded payment record directly
        if (!isPositive(finalSubtotal)) {
            console.log("[Action] Zero payment detected. Creating succeeded payment record directly.");

            // Create the initial payment record with zero amount
            const {data: paymentRecord, error: createError} = await createInitialPaymentRecord(
                familyId,
                finalSubtotal, // This will be 0
                studentIds,
                type,
                null, // orderId
                discountCodeId,
                discountAmount
            );

            if (createError || !paymentRecord?.id) {
                console.error("[Action] Error creating zero payment record:", createError);
                return json({error: `Failed to initialize payment: ${createError || 'Payment ID missing'}`}, {
                    status: 500,
                    headers: response.headers
                });
            }

            // Update the payment status to succeeded since no actual payment is needed
            console.log(`[Action] Attempting to update payment ${paymentRecord.id} to succeeded status`);

            // Use the centralized admin client
            const supabaseAdmin = getSupabaseAdminClient();

            const {data: updateData, error: updateError} = await supabaseAdmin
                .from('payments')
                .update({
                    status: 'succeeded',
                    payment_date: getTodayLocalDateString(), // Convert to YYYY-MM-DD format for date field
                    payment_method: 'discount_100_percent'
                })
                .eq('id', paymentRecord.id)
                .select('id, status, payment_method, payment_date');

            if (updateError) {
                console.error("[Action] Error updating zero payment to succeeded:", updateError);
                return json({error: `Failed to complete zero payment: ${updateError.message}`}, {
                    status: 500,
                    headers: response.headers
                });
            }

            console.log(`[Action] Zero payment update result:`, updateData);
            console.log(`[Action] Zero payment completed successfully (ID: ${paymentRecord.id}).`);
            return json({success: true, supabasePaymentId: paymentRecord.id, zeroPayment: true}, {headers: response.headers});
        }

        // Create the initial payment record
        // console.log("[Action] Calling createInitialPaymentRecord with subtotal...");
        const {data: paymentRecord, error: createError} = await createInitialPaymentRecord(
            familyId,
            finalSubtotal, // Pass the final subtotal after discount
            studentIds, // Pass selected student IDs (empty for individual)
            type, // Pass 'type' variable
            null, // orderId
            discountCodeId, // Pass discount code ID
            discountAmount // Pass discount amount
        );
        // console.log(`[Action] createInitialPaymentRecord result: data=${JSON.stringify(paymentRecord)}, error=${createError}`);

        if (createError || !paymentRecord?.id) {
            console.error("[Action] Error condition met after createInitialPaymentRecord. Returning JSON error.", createError);
            return json({error: `Failed to initialize payment: ${createError || 'Payment ID missing'}`}, {
                status: 500,
                headers: response.headers
            });
        }

        // Return full JSON success data including supabasePaymentId
        const paymentId = paymentRecord.id;
        // console.log(`[Action] Payment record created successfully (ID: ${paymentId}). Returning success JSON with supabasePaymentId...`);
        return json({success: true, supabasePaymentId: paymentId}, {headers: response.headers}); // Return success and ID

    } catch (error) {
        // This catch block handles actual errors
        // No need to check for Response instance here anymore
        const message = error instanceof Error ? error.message : "An unexpected error occurred during payment setup.";
        console.error("Action Error (in catch):", message); // Clarify log source
        return json({error: message}, {status: 500, headers: response.headers});
    } // The main try block ends here
}

export default function FamilyPaymentPage() {
    const loaderData = useLoaderData<typeof loader>();
    const {
        familyId,
        hasAvailableDiscounts,
        error: loaderError
    } = loaderData;
    
    // Convert serialized data back to proper types
    const studentPaymentDetails = loaderData.studentPaymentDetails.map(detail => ({
        ...detail,
        nextPaymentAmount: toMoney(detail.nextPaymentAmount as unknown),
        monthlyAmount: detail.monthlyAmount ? toMoney(detail.monthlyAmount as unknown) : undefined,
        yearlyAmount: detail.yearlyAmount ? toMoney(detail.yearlyAmount as unknown) : undefined,
        individualSessionAmount: detail.individualSessionAmount ? toMoney(detail.individualSessionAmount as unknown) : undefined
    }));
    
    const [searchParams] = useSearchParams();

    // Handle case where loader found no students
    if (loaderError === "No students found in this family.") {
        return (
            <div className="min-h-screen page-background-styles">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    {/* Page Header */}
                    <div className="text-center mb-8">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <CreditCardIcon className="h-8 w-8 text-green-600 dark:text-green-400"/>
                            <h1 className="text-3xl font-bold text-foreground">Make Payment</h1>
                        </div>
                        <p className="text-muted-foreground">Secure payment processing for your family</p>
                    </div>

                    {/* Content Container */}
                    <div className="form-container-styles p-8 backdrop-blur-lg max-w-md mx-auto">
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
                </div>
            </div>
        );
    }

    // Handle other potential loader errors
    if (!familyId || !studentPaymentDetails) {
        return (
            <div className="min-h-screen page-background-styles">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    {/* Page Header */}
                    <div className="text-center mb-8">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <CreditCardIcon className="h-8 w-8 text-green-600 dark:text-green-400"/>
                            <h1 className="text-3xl font-bold text-foreground">Make Payment</h1>
                        </div>
                        <p className="text-muted-foreground">Secure payment processing for your family</p>
                    </div>

                    {/* Content Container */}
                    <div className="form-container-styles p-8 backdrop-blur-lg max-w-md mx-auto">
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
                </div>
            </div>
        );
    }

    // Set initial payment option based on URL query param
    const initialOption = searchParams.get('option') === 'individual' ? 'individual' : 'monthly';

    return (
        <div className="min-h-screen page-background-styles">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Page Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <CreditCardIcon className="h-8 w-8 text-green-600 dark:text-green-400"/>
                        <h1 className="text-3xl font-bold text-foreground">Make Payment</h1>
                    </div>
                    <p className="text-muted-foreground">Secure payment processing for your family</p>
                </div>

                {/* Content Container */}
                <div className="form-container-styles p-8 backdrop-blur-lg max-w-lg mx-auto">
                    <PaymentSetupForm
                        familyId={familyId}
                        studentPaymentDetails={studentPaymentDetails}
                        hasAvailableDiscounts={hasAvailableDiscounts}
                        mode="family"
                        initialPaymentOption={initialOption}
                        actionEndpoint="/family/payment"
                    />

                    <div className="mt-6 text-center">
                        <Link to="/family" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                            Cancel and return to Family Portal
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Error Boundary with consistent styling
export function ErrorBoundary() {
    const error = useRouteError();

    return (
        <div className="min-h-screen page-background-styles">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Page Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <CreditCardIcon className="h-8 w-8 text-green-600 dark:text-green-400"/>
                        <h1 className="text-3xl font-bold text-foreground">Make Payment</h1>
                    </div>
                    <p className="text-muted-foreground">Secure payment processing for your family</p>
                </div>

                {/* Content Container */}
                <div className="form-container-styles p-8 backdrop-blur-lg max-w-lg mx-auto">
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
            </div>
        </div>
    );
}
