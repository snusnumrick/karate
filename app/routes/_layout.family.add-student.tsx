import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect} from "@remix-run/node";
import {Form, useActionData, useLoaderData, useNavigation} from "@remix-run/react";
import {csrf} from "~/utils/csrf.server";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import type {Database} from "~/types/database.types";

import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {AppBreadcrumb, breadcrumbPatterns} from "~/components/AppBreadcrumb";
import { StudentFormFields } from "~/components/StudentFormFields";

type ActionData = {
    success?: boolean;
    message?: string;
    error?: string;
    fieldErrors?: { [key: string]: string };
};

// Loader to get family ID and name for context
export async function loader({request}: LoaderFunctionArgs) {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        // Should be protected by layout, but handle just in case
        return redirect("/login", {headers});
    }

    // Get the user's profile to find their family_id
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || !profileData.family_id) {
        console.error("Error fetching profile or family_id for add student:", profileError?.message);
        // Redirect to family page with an error state? Or throw?
        // For now, throw an error that the ErrorBoundary can catch.
        throw new Response("Could not find your family information. Please go back to the family portal.", {status: 404});
    }

    // Fetch family name for display purposes (optional but nice)
    const {data: familyData, error: familyError} = await supabaseServer
        .from('families')
        .select('name')
        .eq('id', profileData.family_id)
        .single();

    if (familyError) {
        console.error("Error fetching family name:", familyError?.message);
        // Non-critical error, proceed without family name if needed
    }

    // Generate CSRF token
    const [csrfToken, csrfCookieHeader] = await csrf.commitToken(request);
    if (csrfCookieHeader) {
        headers.append('Set-Cookie', csrfCookieHeader);
    }

    // Get returnTo parameter for event registration flow
    const url = new URL(request.url);
    const returnTo = url.searchParams.get('returnTo');

    return json({
        familyId: profileData.family_id,
        familyName: familyData?.name || 'Your Family',
        csrfToken,
        returnTo: returnTo || null
    }, {headers});
}


// Action function to handle adding the student
export async function action({request}: ActionFunctionArgs): Promise<Response> {
    const formData = await request.formData();

    // Validate CSRF token
    try {
        await csrf.validate(formData, request.headers);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        throw new Response("Invalid CSRF token", {status: 403});
    }
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return json<ActionData>({error: "User not authenticated."}, {status: 401, headers});
    }

    // Get family_id from profile again (or pass from loader if preferred, but safer to re-fetch)
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || !profileData.family_id) {
        console.error("Action Error: fetching profile or family_id:", profileError?.message);
        return json<ActionData>({error: "Could not find your family information."}, {status: 400, headers});
    }

    const familyId = profileData.family_id;

    // Extract student data from form
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const birthDate = formData.get("birthDate") as string;
    const gender = formData.get("gender") as string;
    const tShirtSize = formData.get("tShirtSize") as string;
    const height = formData.get("height") as string;
    const school = formData.get("school") as string;
    const gradeLevel = formData.get("gradeLevel") as string;
    // Optional fields
    const specialNeeds = formData.get("specialNeeds") as string | null;
    const allergies = formData.get("allergies") as string | null;
    const medications = formData.get("medications") as string | null;
    const immunizationsUpToDate = formData.get("immunizationsUpToDate") as string | null;
    const immunizationNotes = formData.get("immunizationNotes") as string | null;
    // const beltRank = formData.get("beltRank") as string | null; // Removed - belt rank managed via belt_awards
    const email = formData.get("email") as string | null;
    const cellPhone = formData.get("cellPhone") as string | null;


    // Basic validation (add more as needed)
    const fieldErrors: { [key: string]: string } = {};
    if (!firstName) fieldErrors.firstName = "First name is required.";
    if (!lastName) fieldErrors.lastName = "Last name is required.";
    if (!birthDate) fieldErrors.birthDate = "Birth date is required.";
    if (!gender) fieldErrors.gender = "Gender is required.";
    if (!tShirtSize) fieldErrors.tShirtSize = "T-Shirt size is required.";
    if (!school) fieldErrors.school = "School is required.";
    if (!gradeLevel) fieldErrors.gradeLevel = "Grade level is required.";

    // Validate height if provided
    if (height && (parseInt(height) < 50 || parseInt(height) > 250)) {
        fieldErrors.height = 'Height must be between 50 and 250 cm.';
    }

    if (Object.keys(fieldErrors).length > 0) {
        return json<ActionData>({error: "Please fill in all required fields.", fieldErrors}, {status: 400, headers});
    }

    try {
        const {error: studentInsertError} = await supabaseServer.from('students').insert({
            family_id: familyId,
            first_name: firstName,
            last_name: lastName,
            gender: gender,
            birth_date: birthDate,
            t_shirt_size: tShirtSize as Database['public']['Enums']['t_shirt_size_enum'],
            height: height ? parseInt(height) : null,
            school: school,
            grade_level: gradeLevel,
            special_needs: specialNeeds,
            allergies: allergies,
            medications: medications,
            immunizations_up_to_date: immunizationsUpToDate,
            immunization_notes: immunizationNotes,
            // belt_rank: beltRank as typeof BELT_RANKS[number] | null, // Removed - belt rank managed via belt_awards
            email: email,
            cell_phone: cellPhone,
            // Add other fields as necessary, ensure they match your DB schema
            // Note: Initial belt rank (White) should be added via belt_awards by an admin if needed.
        }).select().single();

        if (studentInsertError) {
            console.error("Error inserting student:", studentInsertError);
            throw studentInsertError;
        }


        // Check for returnTo parameter (for event registration flow)
        const url = new URL(request.url);
        const returnTo = url.searchParams.get('returnTo');

        // Redirect to returnTo if provided, otherwise go to family portal
        return redirect(returnTo || "/family", {headers});

    } catch (error: unknown) {
        console.error('Add student error:', error);
        return json<ActionData>({
            error: error instanceof Error ? error.message : 'Failed to add student. Please try again.'
        }, {status: 500, headers});
    }
}

export default function AddStudentPage() {
    const {familyId, familyName} = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.familyAddStudent()} className="mb-6"/>

            <h1 className="text-3xl font-bold mb-2">Add Student to {familyName}</h1>
            <p className="text-muted-foreground mb-6">Enter the details for the new student.</p>

            {actionData?.error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md border dark:border-gray-700">
                <Form method="post">
                    <StudentFormFields
                        mode="create"
                        variant="family"
                        familyId={familyId}
                        familyName={familyName}
                        actionData={actionData}
                        submitButtonText="Add Student"
                        submitButtonVariant="green"
                        enableAutoFocus={true}
                        isSubmitting={isSubmitting}
                    />
                </Form>
            </div>
        </div>
    );
}

// Optional: Add an ErrorBoundary specific to this page
export function ErrorBoundary() {
    // You can customize this based on the ErrorBoundary in _layout.register.tsx
    // For now, a simple one:
    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.familyAddStudent()} className="mb-6"/>
            <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    There was an error loading or processing the add student form. Please try again or go back to the
                    family portal.
                </AlertDescription>
            </Alert>
        </div>
    );
}
