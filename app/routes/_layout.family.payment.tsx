import {json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs, TypedResponse} from "@remix-run/node";
import {Form, useActionData, useLoaderData, useNavigation} from "@remix-run/react";
import {getSupabaseServerClient, createPaymentSession} from "~/utils/supabase.server";
import {Button} from "~/components/ui/button";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {ExclamationTriangleIcon} from "@radix-ui/react-icons";

// Loader to get family ID and student IDs
export interface LoaderData {
    familyId: string;
    studentIds: string[];
    error?: string;
}

export async function loader({request}: LoaderFunctionArgs)
    : Promise<TypedResponse<LoaderData>> {
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
        return json({familyId, studentIds: [], error: "No students found in this family."}, {headers});
    }

    const studentIds = students.map(s => s.id);

    return json({familyId, studentIds}, {headers});
}

// Action to create payment session and redirect
export async function action({request}: ActionFunctionArgs): Promise<TypedResponse<{ error?: string }>> {
    const {response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const formData = await request.formData();
    const familyId = formData.get("familyId") as string;
    const studentIdsString = formData.get("studentIds") as string; // Comma-separated string

    if (!familyId || !studentIdsString) {
        return json({error: "Missing required information."}, {status: 400, headers});
    }

    const studentIds = studentIdsString.split(',');

    // TODO: Determine the actual amount dynamically (e.g., based on number of students, selected plan, etc.)
    // For now, using a placeholder amount. Ensure this is in the smallest currency unit (e.g., cents).
    const amount = 5000; // Example: $50.00

    try {
        const {sessionUrl, error} = await createPaymentSession(familyId, amount, studentIds, request);

        if (error || !sessionUrl) {
            console.error("Error creating payment session:", error);
            return json({error: "Failed to initiate payment session. Please try again later."}, {status: 500, headers});
        }

        // Redirect user to Stripe Checkout
        return redirect(sessionUrl, {headers});

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Unexpected error during payment session creation:", errorMessage);
        return json({error: "An unexpected error occurred. Please contact support."}, {status: 500, headers});
    }
}

export default function FamilyPaymentPage() {
    const {familyId, studentIds, error: loaderError} = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

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

    // Handle other potential loader errors (though they should throw Response)
    if (!familyId || !studentIds) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Alert variant="destructive">
                    <ExclamationTriangleIcon className="h-4 w-4"/>
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        Could not load necessary payment information. Please go back and try again.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }


    // TODO: Add more details about the payment (amount, what it covers)
    const paymentAmountDisplay = "$50.00"; // Example display amount

    return (
        <div className="container mx-auto px-4 py-8 max-w-md">
            <h1 className="text-2xl font-bold mb-6 text-center">Make Payment</h1>

            {actionData?.error && (
                <Alert variant="destructive" className="mb-4">
                    <ExclamationTriangleIcon className="h-4 w-4"/>
                    <AlertTitle>Payment Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                <p className="text-lg mb-2">You are about to make a payment of:</p>
                <p className="text-3xl font-semibold text-center mb-4">{paymentAmountDisplay}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    This payment covers [Placeholder: Describe what the payment is for, e.g., monthly fees
                    for {studentIds.length} student(s)].
                    Clicking below will redirect you to our secure payment processor.
                </p>
            </div>

            <Form method="post">
                <input type="hidden" name="familyId" value={familyId}/>
                {/* Pass student IDs as a comma-separated string */}
                <input type="hidden" name="studentIds" value={studentIds.join(',')}/>
                <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || studentIds.length === 0} // Disable if no students
                >
                    {isSubmitting ? "Processing..." : `Proceed to Pay ${paymentAmountDisplay}`}
                </Button>
            </Form>
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