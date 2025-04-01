import {json, redirect, type LoaderFunctionArgs, TypedResponse} from "@remix-run/node";
import {useLoaderData, useFetcher, Link, useRouteError} from "@remix-run/react"; // Use useFetcher, remove Form, useNavigation, useActionData
import React, { useState, useEffect } from "react"; // Add React hooks
import { loadStripe, type Stripe } from '@stripe/stripe-js'; // Import Stripe.js
import { getSupabaseServerClient } from "~/utils/supabase.server"; // Remove createPaymentSession import
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { ExclamationTriangleIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { siteConfig } from "~/config/site";
import { checkStudentEligibility, type EligibilityStatus } from "~/utils/supabase.server"; // Import eligibility check
import { Checkbox } from "~/components/ui/checkbox"; // Import Checkbox
import { format } from 'date-fns'; // Import format

// Payment Calculation
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
}

// Updated Loader data interface - remove totalAmountInCents
export interface LoaderData {
    familyId: string;
    familyName: string;
    // No longer need the separate 'students' array, details are in studentPaymentDetails
    studentPaymentDetails?: StudentPaymentDetail[];
    stripePublishableKey?: string;
    error?: string;
}

// Loader function
export async function loader({ request }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const { supabaseServer, response } = getSupabaseServerClient(request);
    const headers = response.headers;
    const { data: { user } } = await supabaseServer.auth.getUser();

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
        throw new Response("Could not load family details.", { status: 500, headers });
    }
    const familyName : string = familyData.name!;

    // 2. Fetch Students for the Family
    const {data: studentsData, error: studentsError} = await supabaseServer
        .from('students')
        .select('id::text, first_name::text, last_name::text')
        .eq('family_id', familyId);

    if (studentsError) {
        console.error("Payment Loader Error: Failed to load students", studentsError.message);
        throw new Response("Could not load student information.", { status: 500, headers });
    }
    if (!studentsData || studentsData.length === 0) {
        // Return specific error handled by the component
        return json({
            familyId,
            familyName,
            // No students found, return empty details
            error: "No students found in this family."
        }, { headers });
    }
    const students = studentsData; // Keep full student list

    // 3. Fetch Successful Payments for the Family
    const { data: paymentsData, error: paymentsError } = await supabaseServer
        .from('payments')
        .select('id, status') // Only need id and status
        .eq('family_id', familyId)
        .eq('status', 'succeeded'); // Only count successful payments

    if (paymentsError) {
        console.error("Payment Loader Error: Failed to load payments", paymentsError.message);
        throw new Response("Could not load payment history.", { status: 500, headers });
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
            throw new Response("Could not load payment link history.", { status: 500, headers });
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
        if (pastPaymentCount === 0) {
            nextPaymentAmount = siteConfig.pricing.firstMonth;
            nextPaymentTierLabel = "1st Month";
        } else if (pastPaymentCount === 1) {
            nextPaymentAmount = siteConfig.pricing.secondMonth;
            nextPaymentTierLabel = "2nd Month";
        } else { // 2 or more past payments
            nextPaymentAmount = siteConfig.pricing.monthly;
            nextPaymentTierLabel = "Monthly";
        }

        // 3. Determine if payment is needed now
        const needsPayment = eligibility.reason === 'Trial' || eligibility.reason === 'Expired';

        studentPaymentDetails.push({
            studentId: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            eligibility: eligibility, // Include eligibility status
            needsPayment: needsPayment, // Include flag
            nextPaymentAmount: nextPaymentAmount,
            nextPaymentTierLabel: nextPaymentTierLabel,
            pastPaymentCount: pastPaymentCount,
        });

        // totalAmountInCents += nextPaymentAmount * 100; // Remove pre-calculation
    }

    // --- Prepare and Return Data ---
    const getStripePublishableKey = (): string | undefined => {
        const key = process.env.STRIPE_PUBLISHABLE_KEY;
        if (!key) {
            console.warn("STRIPE_PUBLISHABLE_KEY is not set in environment variables.");
            // Allow proceeding but component should handle missing key
        }
        return key;
    };
    const stripePublishableKey = getStripePublishableKey();

    // Return data without pre-calculated total
    return json({
        familyId,
        familyName,
        studentPaymentDetails, // This now contains all student info needed
        stripePublishableKey
    }, { headers });
}

export default function FamilyPaymentPage() {
    // Destructure the updated loader data (no totalAmountInCents, no separate students array)
    const {
        familyId,
        familyName,
        studentPaymentDetails,
        stripePublishableKey,
        error: loaderError
    } = useLoaderData<typeof loader>();

    const fetcher = useFetcher<{ sessionId?: string; error?: string }>();
    const [stripe, setStripe] = useState<Stripe | null>(null);
    const [clientError, setClientError] = useState<string | null>(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set()); // State for selected students

    const isProcessing = fetcher.state !== 'idle';

    // --- Dynamic Calculation ---
    const calculateTotal = () => {
        let total = 0;
        selectedStudentIds.forEach(id => {
            const detail = studentPaymentDetails!.find(d => d.studentId === id);
            if (detail) {
                total += detail.nextPaymentAmount * 100; // Add amount in cents
            }
        });
        return total;
    };

    const currentTotalInCents = calculateTotal();
    const currentTotalDisplay = `${siteConfig.pricing.currency}${(currentTotalInCents / 100).toFixed(2)}`;
    // --- End Dynamic Calculation ---


    // Log fetcher state and data on every render for debugging
    console.log("Fetcher state:", fetcher.state);
    console.log("Fetcher data:", fetcher.data);


    // Effect to load Stripe.js
    useEffect(() => {
        if (stripePublishableKey) {
            loadStripe(stripePublishableKey).then(stripeInstance => {
                setStripe(stripeInstance);
            }).catch(error => {
                 console.error("Failed to load Stripe.js:", error);
                 setClientError("Failed to load payment library. Please refresh the page.");
            });
        } else {
            console.error("Stripe publishable key is missing.");
            setClientError("Payment processing is not configured correctly. Please contact support.");
        }
    }, [stripePublishableKey]);

    // Effect to handle redirect after fetcher gets sessionId
    useEffect(() => {
        console.log("Effect check: fetcher.data:", fetcher.data, "stripe loaded:", !!stripe); // Log effect trigger
        if (fetcher.data?.sessionId && stripe) {
            console.log("Attempting redirect to Stripe Checkout with session ID:", fetcher.data.sessionId); // Log redirect attempt
            stripe.redirectToCheckout({ sessionId: fetcher.data.sessionId })
                .then(result => {
                    // If redirectToCheckout fails (e.g., network error), show error
                    if (result.error) {
                        console.error("Stripe redirectToCheckout error:", result.error);
                        setClientError(result.error.message || "Failed to redirect to payment page. Please try again.");
                    }
                }).catch(error => {
                    console.error("Error during Stripe redirect:", error);
                    setClientError("An unexpected error occurred while redirecting to payment. Please try again.");
                });
        }
        // Handle errors returned by the fetcher API call itself
        if (fetcher.data?.error) {
             setClientError(fetcher.data.error);
        }
    }, [fetcher.data, stripe]);


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

    // Handle form submission
    const handlePaymentSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setClientError(null);

        if (!stripe) {
            setClientError("Payment system is not ready. Please wait a moment or refresh.");
            return;
        }
        if (selectedStudentIds.size === 0) {
             setClientError("Please select at least one student to pay for.");
             return;
        }
        const calculatedTotal = calculateTotal();
        if (calculatedTotal <= 0) {
             setClientError("Calculated payment amount must be greater than zero.");
             return;
        }

        const formData = new FormData(event.currentTarget);
        // Set the CALCULATED total amount in cents
        formData.set('amountInCents', String(calculatedTotal));
        // Set the SELECTED student IDs
        formData.set('studentIds', Array.from(selectedStudentIds).join(','));

        console.log("Submitting to API with formData:", Object.fromEntries(formData));

        fetcher.submit(formData, {
            method: 'post',
            action: '/api/create-checkout-session',
        });
        console.log("Form submitted to fetcher.");
    };
    // --- End Event Handlers ---


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

    // Handle missing Stripe key from loader
    if (!stripePublishableKey) {
         return (
             <div className="container mx-auto px-4 py-8 max-w-md">
                 <Alert variant="destructive" className="mb-4">
                     <ExclamationTriangleIcon className="h-4 w-4" />
                     <AlertTitle>Configuration Error</AlertTitle>
                     <AlertDescription>
                         Payment processing is not configured correctly. Please contact support.
                     </AlertDescription>
                 </Alert>
             </div>
         );
    }

    // Handle other potential loader errors (e.g., failed to get familyId)
    // studentPaymentDetails will be empty if students couldn't be loaded properly by the loader logic
    if (!familyId || !studentPaymentDetails) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-md">
                <Alert variant="destructive" className="mb-4">
                    <ExclamationTriangleIcon className="h-4 w-4" />
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

            {/* Display errors from client-side state (Stripe load/redirect) or fetcher */}
            {(clientError || fetcher.data?.error) && (
                <Alert variant="destructive" className="mb-4">
                    <ExclamationTriangleIcon className="h-4 w-4"/>
                    <AlertTitle>Payment Error</AlertTitle>
                    <AlertDescription>{clientError || fetcher.data?.error}</AlertDescription>
                </Alert> // Add missing closing tag
            )}

            {/* Student Selection & Payment Details Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-600">Select Students to Pay For</h2>

                {/* Student List with Checkboxes */}
                <div className="space-y-4 mb-6">
                    {studentPaymentDetails.map(detail => (
                        <div key={detail.studentId} className={`flex items-start space-x-3 p-3 rounded-md ${detail.needsPayment ? 'border border-gray-200 dark:border-gray-700' : 'opacity-70 bg-gray-50 dark:bg-gray-700/50'}`}>
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
                                    {detail.eligibility.reason === 'Paid' && detail.eligibility.lastPaymentDate &&
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
                                {detail.needsPayment && (
                                     <p className="text-sm font-semibold text-green-700 dark:text-green-400 mt-1">
                                         Next Payment: {siteConfig.pricing.currency}{detail.nextPaymentAmount.toFixed(2)} ({detail.nextPaymentTierLabel})
                                     </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Calculated Total Amount */}
                <div className="border-t pt-4 mt-4 dark:border-gray-600">
                    <div className="flex justify-between items-center font-bold text-lg">
                        <span>Total Due:</span>
                        <span>{currentTotalDisplay}</span>
                    </div>
                </div>

                 {/* Pricing Info Alert */}
                 <Alert variant="default" className="mt-6 bg-blue-50 dark:bg-gray-700 border-blue-200 dark:border-gray-600">
                   <InfoCircledIcon className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                   <AlertTitle className="text-blue-800 dark:text-blue-200">How Pricing Works</AlertTitle>
                   <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                     Your first class is a <span className="font-semibold">{siteConfig.pricing.freeTrial}</span>.
                     The 1st month fee is {siteConfig.pricing.currency}{siteConfig.pricing.firstMonth},
                     2nd month is {siteConfig.pricing.currency}{siteConfig.pricing.secondMonth},
                     and the ongoing rate is {siteConfig.pricing.currency}{siteConfig.pricing.monthly}/month per student.
                     The total above reflects the calculated amount based on each student&apos;s payment history.
                   </AlertDescription>
                 </Alert>
            </div>

            {/* Payment Form - Submits selected students and calculated total */}
            <form onSubmit={handlePaymentSubmit}>
                {/* Hidden fields for family info */}
                <input type="hidden" name="familyId" value={familyId} />
                <input type="hidden" name="familyName" value={familyName} />
                {/* studentIds and amountInCents are added dynamically in handlePaymentSubmit */}

                <Button
                    type="submit"
                    className="w-full"
                    // Disable if processing, stripe not loaded, no student selected, or total is 0
                    disabled={isProcessing || !stripe || selectedStudentIds.size === 0 || currentTotalInCents <= 0}
                >
                    {isProcessing ? "Processing..." : `Proceed to Pay ${currentTotalDisplay}`}
                </Button>
            </form>
            <div className="mt-4 text-center">
                <Link to="/family" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
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
                <ExclamationTriangleIcon className="h-4 w-4" />
                <AlertTitle>Payment Page Error</AlertTitle>
                <AlertDescription>
                    {error instanceof Error
                        ? error.message
                        : "An unexpected error occurred while loading the payment page."}
                    Please try returning to the <Link to="/family" className="font-medium underline px-1">Family Portal</Link>.
                </AlertDescription>
                 {/* Optional: Display stack trace in development */}
                 {process.env.NODE_ENV === "development" && error instanceof Error && (
                    <pre className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs dark:bg-red-900/50 dark:text-red-100">
                        {error.stack}
                    </pre>
                 )}
            </Alert>
        </div>
    );
}
