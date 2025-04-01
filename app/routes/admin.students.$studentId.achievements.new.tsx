import { useState } from "react";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect, TypedResponse } from "@remix-run/node";
import { Link, useLoaderData, Form, useActionData, useNavigation, useParams } from "@remix-run/react";
import { createClient } from '@supabase/supabase-js';
import type { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { format } from 'date-fns'; // For default date

// Define types
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>;
type AchievementInsert = Database['public']['Tables']['achievements']['Insert'];

type LoaderData = {
  student: StudentRow;
};

type ActionData = {
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: { [key: string]: string };
};

// Loader to get student name
export async function loader({ params }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const studentId = params.studentId;
    if (!studentId) {
        throw new Response("Student ID is required", { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Response("Server configuration error.", { status: 500 });
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    const { data: studentData, error: studentError } = await supabaseAdmin
        .from('students')
        .select('id, first_name, last_name')
        .eq('id', studentId)
        .single();

    if (studentError || !studentData) {
        throw new Response("Student not found", { status: 404 });
    }

    return json({ student: studentData });
}

// Action to add new achievement
export async function action({ request, params }: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const studentId = params.studentId;
    if (!studentId) {
        return json({ error: "Student ID is missing." }, { status: 400 });
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
    // Add more specific validation if needed (e.g., date format)

    if (Object.keys(fieldErrors).length > 0) {
        return json({ error: "Please correct the errors below.", fieldErrors }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return json({ error: "Server configuration error." }, { status: 500 });
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    const achievementData: AchievementInsert = {
        student_id: studentId,
        type,
        description,
        awarded_date,
    };

    const { error: insertError } = await supabaseAdmin
        .from('achievements')
        .insert(achievementData);

    if (insertError) {
        console.error("Error inserting achievement:", insertError);
        return json({ error: "Failed to add achievement. " + insertError.message }, { status: 500 });
    }

    // Redirect back to the achievements list on success
    return redirect(`/admin/students/${studentId}/achievements`);
}


export default function AddAchievementPage() {
    const { student } = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const params = useParams();

    const isSubmitting = navigation.state === "submitting";
    const today = format(new Date(), 'yyyy-MM-dd'); // Default date

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <Link to={`/admin/students/${params.studentId}/achievements`} className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Back to Achievements for {student.first_name}
            </Link>
            <h1 className="text-3xl font-bold mb-6">Add New Achievement</h1>

            {actionData?.error && !actionData.fieldErrors && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <Form method="post" className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <div>
                    <Label htmlFor="type">Achievement Type</Label>
                    <Input id="type" name="type" required />
                    {actionData?.fieldErrors?.type && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.type}</p>}
                </div>
                <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" required rows={3} />
                    {actionData?.fieldErrors?.description && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.description}</p>}
                </div>
                <div>
                    <Label htmlFor="awarded_date">Awarded Date</Label>
                    <Input id="awarded_date" name="awarded_date" type="date" required defaultValue={today} />
                    {actionData?.fieldErrors?.awarded_date && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.awarded_date}</p>}
                </div>

                <div className="flex justify-end gap-4">
                    <Button type="button" variant="outline" asChild>
                        <Link to={`/admin/students/${params.studentId}/achievements`}>Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Adding...' : 'Add Achievement'}
                    </Button>
                </div>
            </Form>
        </div>
    );
}

// Optional: Add ErrorBoundary
export function ErrorBoundary() {
    return <div>Error loading add achievement page.</div>;
}
