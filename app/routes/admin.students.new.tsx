import {type ActionFunctionArgs, json, type MetaFunction, redirect} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation} from "@remix-run/react";
import {Database} from "~/types/database.types";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { csrf } from "~/utils/csrf.server";

import {Button} from "~/components/ui/button";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "~/components/ui/card";
import {ExclamationTriangleIcon} from "@radix-ui/react-icons";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { StudentFormFields } from "~/components/StudentFormFields";

// Loader to get all families for the dropdown
export async function loader() {
    const supabaseServer = getSupabaseAdminClient();

    // Fetch all families for the dropdown
    const {data: families, error: familiesError} = await supabaseServer
        .from('families')
        .select('id, name')
        .order('name', { ascending: true });

    if (familiesError) {
        console.error("[Admin Add Student Loader] Error fetching families:", familiesError.message);
        throw new Response("Failed to load families", {status: 500});
    }

    return json({families: families || []});
}

export const meta: MetaFunction = () => {
    return [
        {title: "Add New Student | Admin Dashboard"},
        {name: "description", content: "Add a new student to the system."},
    ];
};

// Action function to handle adding the student
export async function action({request}: ActionFunctionArgs) {
    await csrf.validate(request);
    const formData = await request.formData();

    const supabaseServer = getSupabaseAdminClient();

    // Extract student data from form
    const familyId = formData.get("familyId") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const birthDate = formData.get("birthDate") as string;
    const gender = formData.get("gender") as string;
    const tShirtSize = formData.get("tShirtSize") as string;
    const height = formData.get("height") as string | null;
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

    // Basic validation
    const fieldErrors: Record<string, string> = {};
    if (!familyId) fieldErrors.familyId = "Family is required.";
    if (!firstName) fieldErrors.firstName = "First name is required.";
    if (!lastName) fieldErrors.lastName = "Last name is required.";
    if (!birthDate) fieldErrors.birthDate = "Birth date is required.";
    if (!gender) fieldErrors.gender = "Gender is required.";
    if (!tShirtSize) fieldErrors.tShirtSize = "T-Shirt size is required.";
    if (height && (isNaN(parseInt(height)) || parseInt(height) < 50 || parseInt(height) > 250)) {
        fieldErrors.height = "Height must be between 50 and 250 cm.";
    }
    if (!school) fieldErrors.school = "School is required.";
    if (!gradeLevel) fieldErrors.gradeLevel = "Grade level is required.";

    if (Object.keys(fieldErrors).length > 0) {
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
            family_id: familyId,
            first_name: firstName,
            last_name: lastName,
            gender: gender,
            birth_date: birthDate,
            t_shirt_size: tShirtSize as Database['public']['Enums']['t_shirt_size_enum'],
            height: height ? parseInt(height) : null,
            school: school,
            grade_level: gradeLevel,
            special_needs: specialNeeds || null,
            allergies: allergies || null,
            medications: medications || null,
            immunizations_up_to_date: immunizationsUpToDate || null,
            immunization_notes: immunizationNotes || null,
            email: email || null,
            cell_phone: cellPhone || null,
        }).select().single();

        if (studentInsertError) {
            console.error("[Admin Add Student Action] Error inserting student:", studentInsertError);
            throw studentInsertError;
        }

        console.log(`[Admin Add Student Action] Successfully added student ${newStudent?.id} to family ${familyId}`);
        
        // Redirect back to the admin students page on success
        return redirect(`/admin/students`);

    } catch (error: unknown) {
        console.error('[Admin Add Student Action] Add student error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to add student. Please try again.';
        
        return json<{ error: string; fieldErrors: typeof fieldErrors; formData: Record<string, string> }>({
            error: errorMessage,
            fieldErrors,
            formData: Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : '']))
        }, {status: 500});
    }
}

export default function AdminAddStudentPage() {
    const {families} = useLoaderData<typeof loader>();
    const actionData = useActionData<{
        error: string;
        fieldErrors: Record<string, string>;
        formData: Record<string, string>;
    }>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="space-y-6">
            <AppBreadcrumb
                items={breadcrumbPatterns.adminStudentNew()}
                className="mb-6"
            />

            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Add New Student</h1>
                <Button asChild variant="outline" size="sm">
                    <Link to="/admin/students">Cancel</Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Student Details</CardTitle>
                    <CardDescription>Enter the information for the new student.</CardDescription>
                </CardHeader>
                <CardContent>
                    {actionData?.error && (
                        <Alert variant="destructive" className="mb-4">
                            <ExclamationTriangleIcon className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{actionData.error}</AlertDescription>
                        </Alert>
                    )}

                    <Form method="post">
                        <StudentFormFields
                            mode="create"
                            variant="admin"
                            families={families}
                            showFamilySelector={true}
                            actionData={actionData}
                            cancelPath="/admin/students"
                            submitButtonText="Add Student"
                            isSubmitting={isSubmitting}
                        />
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}