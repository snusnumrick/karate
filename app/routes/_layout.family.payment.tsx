import {json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs, TypedResponse} from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react"; // Use useFetcher, remove Form, useNavigation, useActionData
import { useState, useEffect } from "react"; // Add React hooks
import { loadStripe, type Stripe } from '@stripe/stripe-js'; // Import Stripe.js
import { getSupabaseServerClient } from "~/utils/supabase.server"; // Remove createPaymentSession import
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Link } from "@remix-run/react"; // Ensure Link is imported


// Loader data interface
export interface LoaderData {
    familyId: string;
    familyName: string; // Add family name
    studentIds: string[];
    stripePublishableKey: string | null; // Add Stripe publishable key
    error?: string;
}

// Loader function
export async function loader({ request }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
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
        .single();
    console.log("Profile Data:", profileData, "Profile Error:", profileError);

    if (profileError || !profileData?.family_id) {
        console.error("Payment Loader Error: Failed to load profile or family_id", profileError?.message);
        // Redirect back to family portal with an error message? Or throw a generic error?
        // For now, throw an error that the boundary can catch.
        throw new Response("Could not load your family information. Please try again.", {status: 500});
    }

    const familyId = profileData.family_id;

    // Get student IDs associated with the family
    const {data: students, error: studentsError} = await supabaseServer
        .from('students')
        .select('id')
        .eq('family_id', familyId);

    if (studentsError) {
        console.error("Payment Loader Error: Failed to load students for family", studentsError.message);
        throw new Response("Could not load student information for payment. Please try again.", {status: 500});
    }

    if (!students || students.length === 0) {
        // Redirect back if no students, maybe with a message?
        // Or handle this in the component. Let's handle in component for now.
        // Need family name here too
        return json({familyId, familyName: "Unknown Family", studentIds: [], error: "No students found in this family."}, {headers});
    }

    // Fetch family name along with student IDs
    const { data: familyData, error: familyError } = await supabaseServer
        .from('families')
        .select('name')
        .eq('id', familyId)
        .single();

    if (familyError || !familyData) {
        console.error("Payment Loader Error: Failed to load family name", familyError?.message);
        throw new Response("Could not load family details for payment.", { status: 500 });
    }
    const familyName = familyData.name;


    const studentIds = students.map(s => s.id);
    const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || null;

    if (!stripePublishableKey) {
        console.warn("STRIPE_PUBLISHABLE_KEY is not set in environment variables.");
        // Decide if this is a critical error. For now, pass null and handle in component.
    }

    return json({ familyId, familyName, studentIds, stripePublishableKey }, { headers });
}

// Remove the action function entirely - logic moved to API route and client-side

export default function FamilyPaymentPage() {
    const { familyId, familyName, studentIds, stripePublishableKey, error: loaderError } = useLoaderData<typeof loader>();
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

    // Handle case where loader found no students
    if (loaderError && loaderError === "No students found in this family.") {
        return (
            <div className="container mx-auto px-4 py-8">
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
             <div className="container mx-auto px-4 py-8">
                 <Alert variant="destructive">
                     <ExclamationTriangleIcon className="h-4 w-4"/>
                     <AlertTitle>Configuration Error</AlertTitle>
                     <AlertDescription>
                         Payment processing is not configured correctly. Please contact support.
                     </AlertDescription>
                 </Alert>
             </div>
         );
    }

    // Handle other potential loader errors (e.g., failed to get familyId/students)
    if (!familyId || !studentIds) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Alert variant="destructive">
                    <ExclamationTriangleIcon className="h-4 w-4"/>
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        Could not load necessary payment information. Please go back and try again or contact support.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // TODO: Determine the actual amount dynamically based on enrollment duration.
    // For now, use the standard monthly rate as the default.
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
