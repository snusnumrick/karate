import {type ActionFunctionArgs, json, type LoaderFunctionArgs, type MetaFunction, redirect} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation, useParams} from "@remix-run/react";
import {getSupabaseAdminClient} from "~/utils/supabase.server";
import { csrf } from "~/utils/csrf.server";
import {Database} from "~/types/database.types";

import {Button} from "~/components/ui/button";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import invariant from "tiny-invariant";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "~/components/ui/card";
import {ExclamationTriangleIcon} from "@radix-ui/react-icons";
import { StudentFormFields } from "~/components/StudentFormFields";


// Loader to get family ID and name for context
export async function loader({params}: LoaderFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId;

    const supabaseServer = getSupabaseAdminClient();

    // Fetch family name for display purposes
    const {data: familyData, error: familyError} = await supabaseServer
        .from('families')
        .select('name')
        .eq('id', familyId)
        .single();

    if (familyError) {
        console.error(`[Admin Add Student Loader] Error fetching family name for ${familyId}:`, familyError.message);
        // Non-critical error, proceed without family name if needed
        // Could throw 404 if family must exist
        if (familyError.code === 'PGRST116') { // code for "Not found"
            throw new Response(`Family with ID ${familyId} not found.`, {status: 404});
        }
    }

    // Pass familyId along with name
    return json({familyId: familyId, familyName: familyData?.name ?? 'Selected Family'});
}

export const meta: MetaFunction<typeof loader> = ({data}) => {
    const familyName = data?.familyName ?? "Family";
    return [
        {title: `Add Student to ${familyName} | Admin Dashboard`},
        {name: "description", content: `Add a new student to the ${familyName} family.`},
    ];
};


// Action function to handle adding the student
export async function action({request, params}: ActionFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId; // Get familyId from URL params
    await csrf.validate(request);
    const formData = await request.formData();

    const supabaseServer = getSupabaseAdminClient();

    // Extract student data from form
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const birthDate = formData.get("birthDate") as string;
    const gender = formData.get("gender") as string;
    const tShirtSize = formData.get("tShirtSize") as string;
    const school = formData.get("school") as string;
    const gradeLevel = formData.get("gradeLevel") as string;
    // Optional fields
    const specialNeeds = formData.get("specialNeeds") as string | null;
    const allergies = formData.get("allergies") as string | null;
    const medications = formData.get("medications") as string | null;
    const immunizationsUpToDate = formData.get("immunizationsUpToDate") as string | null;
    const immunizationNotes = formData.get("immunizationNotes") as string | null;
    const email = formData.get("email") as string | null;
    const cellPhone = formData.get("cellPhone") as string | null;


    // Basic validation (add more as needed, consider Zod)
    const fieldErrors: Record<string, string> = {};
    if (!firstName) fieldErrors.firstName = "First name is required.";
    if (!lastName) fieldErrors.lastName = "Last name is required.";
    if (!birthDate) fieldErrors.birthDate = "Birth date is required.";
    if (!gender) fieldErrors.gender = "Gender is required.";
    if (!tShirtSize) fieldErrors.tShirtSize = "T-Shirt size is required.";
    if (!school) fieldErrors.school = "School is required.";
    if (!gradeLevel) fieldErrors.gradeLevel = "Grade level is required.";

    if (Object.keys(fieldErrors).length > 0) {
        // Return form data to repopulate fields on error
        return json<{
            error: string;
            fieldErrors: typeof fieldErrors;
            formData: Record<string, string>
        }>({
            error: "Please fill in all required fields.",
            fieldErrors,
            formData: Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : '']))
        }, {status: 400});
    }

    try {
        const {data: newStudent, error: studentInsertError} = await supabaseServer.from('students').insert({
            family_id: familyId, // Use familyId from URL params
            first_name: firstName,
            last_name: lastName,
            gender: gender,
            birth_date: birthDate,
            t_shirt_size: tShirtSize as Database['public']['Enums']['t_shirt_size_enum'],
            school: school,
            grade_level: gradeLevel,
            special_needs: specialNeeds || null,
            allergies: allergies || null,
            medications: medications || null,
            immunizations_up_to_date: immunizationsUpToDate || null,
            immunization_notes: immunizationNotes || null,
            email: email || null,
            cell_phone: cellPhone || null,
            // Add other fields as necessary, ensure they match your DB schema
        }).select().single(); // Select the newly created student

        if (studentInsertError) {
            console.error("[Admin Add Student Action] Error inserting student:", studentInsertError);
            // Check for specific errors like duplicates if needed
            throw studentInsertError;
        }

        console.log(`[Admin Add Student Action] Successfully added student ${newStudent?.id} to family ${familyId}`);
        
        // Redirect back to the admin family detail page on success
        return redirect(`/admin/families/${familyId}`);

    } catch (error: unknown) {
        console.error('[Admin Add Student Action] Add student error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to add student. Please try again.';
        // Check if it's a Supabase error for more details
        if (typeof error === 'object' && error !== null && 'code' in error) {
            // Potentially handle specific DB error codes (e.g., unique constraint violation)
            console.error('[Admin Add Student Action] Supabase error code:', (error as { code?: string }).code);
        }
        return json<{ error: string; fieldErrors: typeof fieldErrors; formData: Record<string, string> }>({
            error: errorMessage,
            fieldErrors, // Return field errors if they existed before the try block
            formData: Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : ''])) // Return form data
        }, {status: 500});
    }
}

export default function AdminAddStudentPage() {
    const {familyId, familyName} = useLoaderData<typeof loader>();
    const actionData = useActionData<{
        error: string;
        fieldErrors: Record<string, string>;
        formData: Record<string, string>;
    }>();
    const navigation = useNavigation();
    const params = useParams();
    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Add Student to {familyName}</h1>
                <Button asChild variant="outline" size="sm">
                    <Link to={`/admin/families/${params.familyId}`}>Cancel</Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>New Student Details</CardTitle>
                    <CardDescription>Enter the information for the new student.</CardDescription>
                </CardHeader>
                <CardContent>
                    {actionData?.error && !actionData.fieldErrors && (
                        <Alert variant="destructive" className="mb-4">
                            <ExclamationTriangleIcon className="h-4 w-4"/>
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{actionData.error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Display general error if fieldErrors exist */}
                    {actionData?.error && actionData.fieldErrors && Object.keys(actionData.fieldErrors).length > 0 && (
                        <Alert variant="destructive" className="mb-4">
                            <ExclamationTriangleIcon className="h-4 w-4"/>
                            <AlertTitle>Validation Error</AlertTitle>
                            <AlertDescription>{actionData.error}</AlertDescription>
                        </Alert>
                    )}

                    <Form method="post">
                        <StudentFormFields
                            mode="create"
                            variant="admin"
                            familyId={familyId}
                            familyName={familyName}
                            actionData={actionData}
                            cancelPath={`/admin/families/${params.familyId}`}
                            submitButtonText="Add Student"
                            submitButtonVariant="blue"
                            isSubmitting={isSubmitting}
                        />
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

// Re-use the Error Boundary from the main family detail page for now
// Or create a more specific one if needed
export {ErrorBoundary} from "./admin.families.$familyId";
