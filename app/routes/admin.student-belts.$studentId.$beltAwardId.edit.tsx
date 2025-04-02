import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect, TypedResponse} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation, useParams} from "@remix-run/react";
import {createClient} from '@supabase/supabase-js';
import type {Database} from "~/types/supabase";
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input"; // Keep Input for other fields
import {Label} from "~/components/ui/label";
import {Textarea} from "~/components/ui/textarea";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select"; // Import Select components
import {BELT_RANKS} from "~/utils/constants";

// Define types (assuming table renamed to 'belt_awards' and types regenerated)
// Ensure app/types/supabase.ts has been regenerated after adding the enum in SQL
type BeltRankEnum = Database['public']['Enums']['belt_rank_enum'];
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>;
// Update Row and Update types to use the enum
type BeltAwardRow = Omit<Database['public']['Tables']['belt_awards']['Row'], 'type'> & { type: BeltRankEnum };
type BeltAwardUpdate = Omit<Database['public']['Tables']['belt_awards']['Update'], 'type'> & { type?: BeltRankEnum };


type LoaderData = {
    student: StudentRow;
    beltAward: BeltAwardRow;
};

type ActionData = {
    success?: boolean;
    message?: string;
    error?: string;
    fieldErrors?: { [key: string]: string };
};

// Loader to get student name and specific belt award
export async function loader({params}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const studentId = params.studentId;
    const beltAwardId = params.beltAwardId; // Renamed parameter (needs file rename too)
    if (!studentId || !beltAwardId) { // Renamed variable
        throw new Response("Student ID and Belt Award ID are required", {status: 400}); // Updated message
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Response("Server configuration error.", {status: 500});
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Fetch student name
    const {data: studentData, error: studentError} = await supabaseAdmin
        .from('students')
        .select('id, first_name, last_name')
        .eq('id', studentId)
        .single();

    if (studentError || !studentData) {
        throw new Response("Student not found", {status: 404});
    }

    // Fetch the specific belt award
    const {data: beltAwardData, error: beltAwardError} = await supabaseAdmin // Renamed variables
        .from('belt_awards') // Renamed table
        .select('*')
        .eq('id', beltAwardId) // Renamed variable
        .eq('student_id', studentId) // Ensure it belongs to the correct student
        .single();

    if (beltAwardError || !beltAwardData) { // Renamed variables
        throw new Response("Belt award not found", {status: 404}); // Updated message
    }

    return json({student: studentData, beltAward: beltAwardData}); // Renamed property
}

// Action to update belt award
export async function action({request, params}: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const studentId = params.studentId;
    const beltAwardId = params.beltAwardId; // Renamed parameter (needs file rename too)
    if (!studentId || !beltAwardId) { // Renamed variable
        return json({error: "Student ID or Belt Award ID is missing."}, {status: 400}); // Updated message
    }

    const formData = await request.formData();
    const type = formData.get("type") as string;
    const description = formData.get("description") as string;
    const awarded_date = formData.get("awarded_date") as string;

    // Basic Validation
    const fieldErrors: { [key: string]: string } = {};
    if (!type) fieldErrors.type = "Type is required.";
    if (!description) fieldErrors.description = "Description is required.";
    if (!awarded_date) fieldErrors.awarded_date = "Awarded date is required.";

    if (Object.keys(fieldErrors).length > 0) {
        return json({error: "Please correct the errors below.", fieldErrors}, {status: 400});
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return json({error: "Server configuration error."}, {status: 500});
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Cast the type from form data to the enum type
    const beltAwardUpdateData: BeltAwardUpdate = {
        type: type as BeltRankEnum, // Cast to enum type
        description: description || undefined, // Ensure description is undefined if empty
        awarded_date,
        // student_id is not updated
    };

    const {error: updateError} = await supabaseAdmin
        .from('belt_awards') // Renamed table
        .update(beltAwardUpdateData) // Renamed variable
        .eq('id', beltAwardId); // Renamed variable

    if (updateError) {
        console.error("Error updating belt award:", updateError); // Updated message
        return json({error: "Failed to update belt award. " + updateError.message}, {status: 500}); // Updated message
    }

    // Redirect back to the belt awards list on success - Update path
    return redirect(`/admin/student-belts/${studentId}`);
}


export default function EditAchievementPage() { // Function name can stay for now, or rename later
    const {student, beltAward} = useLoaderData<LoaderData>(); // Renamed variable
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const params = useParams();

    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            {/* Update path */}
            <Link to={`/admin/student-belts/${params.studentId}`}
                  className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Back to Belt Awards for {student.first_name} {/* Updated text */}
            </Link>
            <h1 className="text-3xl font-bold mb-6">Edit Belt Award</h1> {/* Renamed title */}

            {actionData?.error && !actionData.fieldErrors && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <Form method="post" className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <div>
                    <Label htmlFor="type">Belt Awarded</Label>
                    <Select name="type" required defaultValue={beltAward.type}>
                        <SelectTrigger id="type">
                            <SelectValue placeholder="Select belt rank"/>
                        </SelectTrigger>
                        <SelectContent>
                            {BELT_RANKS.map((rank) => (
                                <SelectItem key={rank} value={rank} className="capitalize">
                                    {rank}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {actionData?.fieldErrors?.type &&
                        <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.type}</p>}
                </div>
                <div>
                    {/* Assuming 'description' is notes */}
                    <Label htmlFor="description">Notes (Optional)</Label>
                    <Textarea id="description" name="description" defaultValue={beltAward.description || undefined} rows={3}/>
                    {actionData?.fieldErrors?.description &&
                        <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.description}</p>}
                </div>
                <div>
                    <Label htmlFor="awarded_date">Awarded Date</Label>
                    <Input id="awarded_date" name="awarded_date" type="date" required
                           defaultValue={beltAward.awarded_date}/>
                    {actionData?.fieldErrors?.awarded_date &&
                        <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.awarded_date}</p>}
                </div>

                <div className="flex justify-end gap-4">
                    {/* Remove asChild from Cancel button - Update path */}
                    <Button type="button" variant="outline">
                        <Link to={`/admin/student-belts/${params.studentId}`}>Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'} {/* Text can remain generic */}
                    </Button>
                </div>
            </Form>
        </div>
    );
}

// Optional: Add ErrorBoundary
export function ErrorBoundary() {
    return <div>Error loading edit belt award page.</div>; // Updated message
}
