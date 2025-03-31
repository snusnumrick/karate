import {json, redirect, type LoaderFunctionArgs, TypedResponse} from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react"; // Use useFetcher, remove Form, useNavigation, useActionData
import { useState, useEffect } from "react"; // Add React hooks
import { loadStripe, type Stripe } from '@stripe/stripe-js'; // Import Stripe.js
import { getSupabaseServerClient } from "~/utils/supabase.server"; // Remove createPaymentSession import
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { ExclamationTriangleIcon, InfoCircledIcon } from "@radix-ui/react-icons"; // Add InfoCircledIcon
import { siteConfig } from "~/config/site";
import type { Database } from "~/types/supabase"; // Import Database type

// Define the structure for student payment details
interface StudentPaymentDetail {
    studentId: string;
    firstName: string;
    lastName: string;
    nextPaymentAmount: number; // Amount in dollars
    nextPaymentTierLabel: string;
    pastPaymentCount: number;
}

// Updated Loader data interface
export interface LoaderData {
    familyId: string;
    familyName: string;
    students: Array<Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>>; // Pass student names too
    studentPaymentDetails: StudentPaymentDetail[];
    totalAmountInCents: number;
    stripePublishableKey: string | null;
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
        .single();
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
    const { data: familyData, error: familyError } = await supabaseServer
        .from('families')
        .select('name')
        .eq('id', familyId)
        .single();

    if (familyError || !familyData) {
        console.error("Payment Loader Error: Failed to load family name", familyError?.message);
        throw new Response("Could not load family details.", { status: 500, headers });
    }
    const familyName = familyData.name;

    // 2. Fetch Students for the Family
    const { data: studentsData, error: studentsError } = await supabaseServer
        .from('students')
        .select('id, first_name, last_name')
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
            students: [],
            studentPaymentDetails: [],
            totalAmountInCents: 0,
            stripePublishableKey: null, // Not needed if no students
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
        const { data: linksData, error: linksError } = await supabaseServer
            .from('payment_students')
            .select('student_id, payment_id')
            .in('payment_id', successfulPaymentIds);

        if (linksError) {
            console.error("Payment Loader Error: Failed to load payment links", linksError.message);
            throw new Response("Could not load payment link history.", { status: 500, headers });
        }
        paymentStudentLinks = linksData || [];
    }

    // --- Calculate Next Payment Amount Per Student ---
    const studentPaymentDetails: StudentPaymentDetail[] = [];
    let totalAmountInCents = 0;

    for (const student of students) {
        const pastPaymentCount = paymentStudentLinks.filter(link => link.student_id === student.id).length;

        let nextPaymentAmount = 0;
        let nextPaymentTierLabel = "";

        // Determine tier based on past successful payments
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

        studentPaymentDetails.push({
            studentId: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            nextPaymentAmount: nextPaymentAmount, // Store in dollars for detail display
            nextPaymentTierLabel: nextPaymentTierLabel,
            pastPaymentCount: pastPaymentCount,
        });

        totalAmountInCents += nextPaymentAmount * 100; // Add to total in cents
    }

    // --- Prepare and Return Data ---
    const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || null;
    if (!stripePublishableKey) {
        console.warn("STRIPE_PUBLISHABLE_KEY is not set in environment variables.");
        // Allow proceeding but component should handle missing key
    }

    return json({
        familyId,
        familyName,
        students, // Pass student list for potential use (e.g., hidden input)
        studentPaymentDetails,
        totalAmountInCents,
        stripePublishableKey
    }, { headers });
}

export default function FamilyPaymentPage() {
    // Destructure the updated loader data
    const {
        familyId,
        familyName,
        students, // Full student list
        studentPaymentDetails,
        totalAmountInCents,
        stripePublishableKey,
        error: loaderError
    } = useLoaderData<typeof loader>();

    const fetcher = useFetcher<{ sessionId?: string; error?: string }>(); // Fetcher for API call
    const [stripe, setStripe] = useState<Stripe | null>(null);
    const [clientError, setClientError] = useState<string | null>(null);

    const isProcessing = fetcher.state !== 'idle';

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

    // Use the standard monthly rate as the default for display and initial processing.
    // Dynamic calculation based on enrollment duration needs to be implemented in the API/loader.
    const standardMonthlyRate = siteConfig.pricing.monthly;
    const amountInCents = standardMonthlyRate * 100; // Convert to cents
    const paymentAmountDisplay = `${siteConfig.pricing.currency}${standardMonthlyRate.toFixed(2)}`; // Format for display

    // Handle form submission
    const handlePaymentSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setClientError(null); // Clear previous errors

        if (!stripe) {
            setClientError("Payment system is not ready. Please wait a moment or refresh.");
            return;
        }

        const formData = new FormData(event.currentTarget);
        // Add amountInCents to the form data for the fetcher
        formData.set('amountInCents', String(amountInCents));

        fetcher.submit(formData, {
            method: 'post',
            action: '/api/create-checkout-session', // Target the API route
        });
        console.log("Form submitted to fetcher."); // Log submission call
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-md">
            <h1 className="text-2xl font-bold mb-6 text-center">Make Payment</h1>

            {/* Display errors from client-side state (Stripe load/redirect) or fetcher */}
            {(clientError || fetcher.data?.error) && (
                <Alert variant="destructive" className="mb-4">
                    <ExclamationTriangleIcon className="h-4 w-4"/>
                    <AlertTitle>Payment Error</AlertTitle>
                    <AlertDescription>{clientError || fetcher.data?.error}</AlertDescription>
                </Alert>
            )}

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                <p className="text-lg mb-2">Standard Monthly Fee:</p>
                <p className="text-3xl font-semibold text-center mb-4">{paymentAmountDisplay}</p>
                <Alert variant="default" className="mb-4 bg-blue-50 dark:bg-gray-700 border-blue-200 dark:border-gray-600">
                  <InfoCircledIcon className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  <AlertTitle className="text-blue-800 dark:text-blue-200">Pricing Information</AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-300">
                    Your first class is a <span className="font-semibold">{siteConfig.pricing.freeTrial}</span>.
                    The 1st month is {siteConfig.pricing.currency}{siteConfig.pricing.firstMonth},
                    2nd month is {siteConfig.pricing.currency}{siteConfig.pricing.secondMonth},
                    and the ongoing rate is {siteConfig.pricing.currency}{siteConfig.pricing.monthly}/month.
                    The amount shown reflects the standard rate.
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Clicking below will redirect you to our secure payment processor to pay the standard monthly fee.
                    Adjustments based on your enrollment duration may apply.
                </p>
            </div>

            {/* Use standard form and onSubmit handler */}
            <form onSubmit={handlePaymentSubmit}>
                <input type="hidden" name="familyId" value={familyId} />
                <input type="hidden" name="familyName" value={familyName} /> {/* Add hidden input for family name */}
                {/* Pass student IDs as a comma-separated string */}
                <input type="hidden" name="studentIds" value={studentIds.join(',')} />
                {/* Amount is added dynamically in handleSubmit */}
                <Button
                    type="submit"
                    className="w-full"
                    // Disable while fetcher is working, Stripe is loading, or if no students
                    disabled={isProcessing || !stripe || studentIds.length === 0}
                >
                    {isProcessing ? "Processing..." : `Proceed to Pay ${paymentAmountDisplay}`}
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

// Basic Error Boundary for this route
export function ErrorBoundary() {
    // Check if error is a Response object to get status/message
    // Note: Remix v2 might handle this differently, check docs if needed
    // const error = useRouteError(); // Use this hook in Remix v2+
    const error: any = new Error("An unknown error occurred on the payment page."); // Placeholder for older Remix or general error

    // Basic error display
    return (
        <div className="container mx-auto px-4 py-8">
            <Alert variant="destructive">
                <ExclamationTriangleIcon className="h-4 w-4"/>
                <AlertTitle>Payment Page Error</AlertTitle>
                <AlertDescription>
                    {error instanceof Error ? error.message : "An unexpected error occurred while loading the payment page."}
                    Please try returning to the <Link to="/family" className="font-medium underline">Family
                    Portal</Link>.
                </AlertDescription>
            </Alert>
        </div>
    );
}
