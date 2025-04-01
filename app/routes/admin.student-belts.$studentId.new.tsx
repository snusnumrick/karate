import { useState } from "react";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect, TypedResponse } from "@remix-run/node";
import { Link, useLoaderData, Form, useActionData, useNavigation, useParams } from "@remix-run/react";
import { createClient } from '@supabase/supabase-js';
import type { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input"; // Keep Input for other fields
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"; // Import Select components
import { format } from 'date-fns'; // For default date

// Define the valid belt ranks based on the enum
const beltRanks = [
  'white',
  'yellow',
  'orange',
  'green',
  'blue',
  'purple',
  'red',
  'brown',
  'black'
] as const; // Use 'as const' for stricter typing

// Define types (assuming table renamed to 'belt_awards' and types regenerated)
// Ensure app/types/supabase.ts has been regenerated after adding the enum in SQL
type BeltRankEnum = Database['public']['Enums']['belt_rank_enum'];
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>;
// Update Insert type to use the enum
type BeltAwardInsert = Omit<Database['public']['Tables']['belt_awards']['Insert'], 'type'> & { type: BeltRankEnum };


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

// Action to add new belt award
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
    // Removed description validation as it's optional
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

    // Cast the type from form data to the enum type
    const beltAwardData: BeltAwardInsert = {
        student_id: studentId,
        type: type as BeltRankEnum, // Cast to enum type
        description: description || null, // Ensure description is null if empty, as it's optional now
        awarded_date,
    };

    const { error: insertError } = await supabaseAdmin
        .from('belt_awards') // Renamed table
        .insert(beltAwardData); // Renamed variable

    if (insertError) {
        console.error("Error inserting belt award:", insertError); // Updated message
        return json({ error: "Failed to add belt award. " + insertError.message }, { status: 500 }); // Updated message
    }

    // Redirect back to the belt awards list on success
    return redirect(`/admin/students/${studentId}/belts`); // Renamed redirect path
}


export default function AddAchievementPage() { // Function name can stay for now, or rename later
    const { student } = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const params = useParams();

    const isSubmitting = navigation.state === "submitting";
    const today = format(new Date(), 'yyyy-MM-dd'); // Default date

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <Link to={`/admin/students/${params.studentId}/belts`} className="text-blue-600 hover:underline mb-4 inline-block"> {/* Renamed link */}
                &larr; Back to Belt Awards for {student.first_name} {/* Updated text */}
            </Link>
            <h1 className="text-3xl font-bold mb-6">Add New Belt Award</h1> {/* Renamed title */}

            {actionData?.error && !actionData.fieldErrors && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <Form method="post" className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <div>
                    <Label htmlFor="type">Belt Awarded</Label>
                    <Select name="type" required>
                        <SelectTrigger id="type">
                            <SelectValue placeholder="Select belt rank" />
                        </SelectTrigger>
                        <SelectContent>
                            {beltRanks.map((rank) => (
                                <SelectItem key={rank} value={rank} className="capitalize">
                                    {rank}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {actionData?.fieldErrors?.type && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.type}</p>}
                </div>
                <div>
                    {/* Assuming 'description' is notes */}
                    <Label htmlFor="description">Notes (Optional)</Label>
                    <Textarea id="description" name="description" rows={3} />
                    {actionData?.fieldErrors?.description && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.description}</p>}
                </div>
                <div>
                    <Label htmlFor="awarded_date">Awarded Date</Label>
                    <Input id="awarded_date" name="awarded_date" type="date" required defaultValue={today} />
                    {actionData?.fieldErrors?.awarded_date && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.awarded_date}</p>}
                </div>

                <div className="flex justify-end gap-4">
                    {/* Remove asChild from Cancel button */}
                    <Button type="button" variant="outline">
                        <Link to={`/admin/students/${params.studentId}/belts`}>Cancel</Link> {/* Renamed link */}
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Adding...' : 'Add Belt Award'} {/* Updated text */}
                    </Button>
                </div>
            </Form>
        </div>
    );
}

// Optional: Add ErrorBoundary
export function ErrorBoundary() {
    return <div>Error loading add belt award page.</div>; // Updated message
}
