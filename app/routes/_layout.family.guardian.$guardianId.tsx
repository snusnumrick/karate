import {useEffect, useState} from "react";
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect, TypedResponse} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation, useSubmit} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import { createClient } from '@supabase/supabase-js'; // Import createClient
import {Button} from "~/components/ui/button";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    // Removed unused AlertDialogTrigger
} from "~/components/ui/alert-dialog"; // Added AlertDialog components
import {Input} from "~/components/ui/input";
// Removed unused Label import
import {Textarea} from "~/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import type {Database} from "~/types/database.types";
import {z} from "zod"; // For validation
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Form as UIForm, FormControl, FormField, FormItem, FormLabel, FormMessage} from "~/components/ui/form"; // Shadcn Form components
import {ClientOnly} from "~/components/client-only";

// --- Types and Schemas ---
type GuardianRow = Database['public']['Tables']['guardians']['Row'];

// Define expected loader data structure
interface LoaderData {
    guardian: GuardianRow;
    error?: string;
}

// Define potential action data structure (similar to account page)
type SerializedZodIssue = {
    path: (string | number)[];
    message: string;
};
type ActionResponse = {
    status: 'success' | 'error';
    message: string;
    errors?: SerializedZodIssue[];
    intent?: 'updateGuardian' | 'deleteGuardian';
};

// Validation Schema (reused from account page, ensure consistency)
const guardianSchema = z.object({
    intent: z.literal('updateGuardian'), // Intent specific to this action
    first_name: z.string().trim().min(1, "First name is required"),
    last_name: z.string().trim().min(1, "Last name is required"),
    relationship: z.string().trim().min(1, "Relationship is required"),
    home_phone: z.string().trim().min(1, "Home phone is required"),
    cell_phone: z.string().trim().min(1, "Cell phone is required"),
    email: z.string().email("Invalid email address"),
    work_phone: z.string().optional().nullable(),
    employer: z.string().optional().nullable(),
    employer_phone: z.string().optional().nullable(),
    employer_notes: z.string().optional().nullable(),
});
type GuardianFormData = z.infer<typeof guardianSchema>;

// --- Loader ---
export async function loader({request, params}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const guardianId = params.guardianId;
    if (!guardianId) {
        throw new Response("Guardian ID is required", {status: 400});
    }

    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return redirect("/login?redirectTo=/family", {headers});
    }

    // Fetch the guardian data
    const {data: guardianData, error: guardianError} = await supabaseServer
        .from('guardians')
        .select('*')
        .eq('id', guardianId)
        .single();

    if (guardianError || !guardianData) {
        console.error("Error fetching guardian data:", guardianError?.message);
        throw new Response("Guardian not found", {status: 404});
    }

    // Verify the logged-in user belongs to the same family as the guardian
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || profileData.family_id !== guardianData.family_id) {
        console.error("Authorization error: User", user.id, "tried to access guardian", guardianId, "from different family.");
        throw new Response("Forbidden: You do not have permission to view this guardian.", {status: 403});
    }

    return json({guardian: guardianData}, {headers});
}

// --- Action ---
export async function action({request, params}: ActionFunctionArgs): Promise<TypedResponse<ActionResponse>> {
    const guardianId = params.guardianId;
    if (!guardianId) {
        return json({status: 'error', message: "Guardian ID is required"}, {status: 400});
    }

    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return redirect("/login?redirectTo=/family", {headers});
    }

    // Authorization check: Fetch guardian's family ID first
    const {data: guardianFamily, error: guardianFamilyError} = await supabaseServer
        .from('guardians')
        .select('family_id')
        .eq('id', guardianId)
        .single();

    if (guardianFamilyError || !guardianFamily) {
        return json({status: 'error', message: "Guardian not found or error fetching guardian."}, {status: 404, headers});
    }

    // Verify the logged-in user belongs to the same family
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || profileData.family_id !== guardianFamily.family_id) {
        return json({status: 'error', message: "Forbidden: You do not have permission to modify this guardian."}, {status: 403, headers});
    }

    // --- Handle Delete Intent ---
    if (intent === "deleteGuardian") {
        console.log(`[Action/Delete] Attempting to delete guardian ID: ${guardianId} for user ID: ${user.id}`);

        // Explicitly create an admin client to bypass RLS for deletion
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("[Action/Delete] Missing Supabase URL or Service Role Key");
            return json({ status: 'error', message: "Server configuration error." }, { status: 500, headers });
        }
        const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

        console.log(`[Action/Delete] Executing delete for guardian ID: ${guardianId}`);
        const deleteResult = await supabaseAdmin // Use explicit admin client
            .from('guardians')
            .delete()
            .eq('id', guardianId);

        console.log(`[Action/Delete] Delete result for guardian ID ${guardianId}:`, JSON.stringify(deleteResult)); // Log the full result

        if (deleteResult.error) {
            console.error(`[Action/Delete] Error deleting guardian ID ${guardianId}:`, deleteResult.error);
            return json({status: 'error', message: "Failed to delete guardian. " + deleteResult.error.message}, {status: 500, headers});
        }

        // Check if the operation actually affected any rows (though .delete() might not return count reliably depending on settings)
        // Supabase delete often returns { data: null, error: null } on success.

        console.log(`[Action/Delete] Assumed successful deletion for guardian ID: ${guardianId}. Redirecting...`);
        // Redirect to family page after successful deletion.
        return redirect("/family"); // Removed {headers} to ensure default revalidation
    }

    // --- Handle Edit Intent ---
    if (intent === "updateGuardian") {
        const formValues = Object.fromEntries(formData.entries());
        const parsed = guardianSchema.safeParse(formValues); // Use the specific schema

        if (!parsed.success) {
            console.error("Guardian update validation failed:", parsed.error.issues);
            return json({
                status: 'error',
                message: 'Invalid form data.',
                errors: parsed.error.issues,
                intent: 'updateGuardian'
            }, {status: 400, headers});
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {intent: _, ...guardianUpdateData} = parsed.data; // Exclude intent

        const {error: updateError} = await supabaseServer
            .from('guardians')
            .update(guardianUpdateData)
            .eq('id', guardianId);

        if (updateError) {
            console.error("Error updating guardian:", updateError);
            return json({status: 'error', message: "Failed to update guardian. " + updateError.message, intent: 'updateGuardian'}, {status: 500, headers});
        }

        // Return success message
        return json({status: 'success', message: "Guardian updated successfully.", intent: 'updateGuardian'}, {headers});
    }

    // Invalid intent
    return json({status: 'error', message: "Invalid action."}, {status: 400, headers});
}

// --- Component ---
// Helper to get default values, handling nulls
const getDefaultValue = (value: string | null | undefined) => value ?? '';

export default function GuardianDetailPage() {
    const {guardian} = useLoaderData<LoaderData>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const submit = useSubmit(); // Get the submit function
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // State for delete dialog
    // Removed deleteFormRef

    const isSubmitting = navigation.state === "submitting";
    const formIntent = navigation.formData?.get('intent');

    // Reset edit mode on successful update
    useEffect(() => {
        if (actionData?.status === 'success' && actionData.intent === 'updateGuardian' && isEditing) {
            setIsEditing(false);
        }
    }, [actionData, isEditing]);

    // Guardian Form setup (using react-hook-form)
    const guardianForm = useForm<GuardianFormData>({
        resolver: zodResolver(guardianSchema),
        defaultValues: {
            intent: 'updateGuardian',
            first_name: getDefaultValue(guardian.first_name),
            last_name: getDefaultValue(guardian.last_name),
            relationship: getDefaultValue(guardian.relationship),
            home_phone: getDefaultValue(guardian.home_phone),
            cell_phone: getDefaultValue(guardian.cell_phone),
            email: getDefaultValue(guardian.email),
            work_phone: getDefaultValue(guardian.work_phone),
            employer: getDefaultValue(guardian.employer),
            employer_phone: getDefaultValue(guardian.employer_phone),
            employer_notes: getDefaultValue(guardian.employer_notes),
        },
    });

    // Reset form if guardian data changes (e.g., after successful update revalidation)
    useEffect(() => {
        guardianForm.reset({
            intent: 'updateGuardian',
            first_name: getDefaultValue(guardian.first_name),
            last_name: getDefaultValue(guardian.last_name),
            relationship: getDefaultValue(guardian.relationship),
            home_phone: getDefaultValue(guardian.home_phone),
            cell_phone: getDefaultValue(guardian.cell_phone),
            email: getDefaultValue(guardian.email),
            work_phone: getDefaultValue(guardian.work_phone),
            employer: getDefaultValue(guardian.employer),
            employer_phone: getDefaultValue(guardian.employer_phone),
            employer_notes: getDefaultValue(guardian.employer_notes),
        });
    }, [guardian, guardianForm]);

    return (
        <div className="container mx-auto px-4 py-8">
            <Link to="/family" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Family
                Portal</Link>

            <h1 className="text-3xl font-bold mb-6">Guardian Details</h1>

            {/* Display general action feedback */}
            {actionData?.status === 'error' && !actionData.errors && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.message}</AlertDescription>
                </Alert>
            )}
            {actionData?.status === 'success' && actionData.message && (
                <Alert variant="default"
                       className="mb-4 bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{actionData.message}</AlertDescription>
                </Alert>
            )}

            {isEditing ? (
                // --- Edit Form ---
                <ClientOnly fallback={<div className="text-center p-8">Loading form...</div>}>
                    {() => (
                        <UIForm {...guardianForm}>
                            <Form method="post" className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                                <input type="hidden" name="intent" value="updateGuardian"/>

                                {/* Display field-specific errors */}
                                {actionData?.intent === 'updateGuardian' && actionData.errors && (
                                    <Alert variant="destructive" className="mb-4">
                                        <AlertTitle>Validation Errors</AlertTitle>
                                        <AlertDescription>
                                            <ul className="list-disc pl-5">
                                                {actionData.errors.map((err, i) => <li
                                                    key={i}>{err.path.join('.')} : {err.message}</li>)}
                                            </ul>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={guardianForm.control}
                                        name="first_name"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>First Name</FormLabel>
                                                <FormControl><Input {...field} tabIndex={1} className="input-custom-styles"/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={guardianForm.control}
                                        name="last_name"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Last Name</FormLabel>
                                                <FormControl><Input {...field} tabIndex={2} className="input-custom-styles"/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={guardianForm.control}
                                        name="relationship"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Relationship</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        {/* Applied input-custom-styles for consistency */}
                                                        <SelectTrigger tabIndex={3} className="input-custom-styles"><SelectValue
                                                            placeholder="Select relationship"/></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Mother">Mother</SelectItem>
                                                        <SelectItem value="Father">Father</SelectItem>
                                                        <SelectItem value="Guardian">Guardian</SelectItem>
                                                        <SelectItem value="Other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={guardianForm.control}
                                        name="home_phone"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Home Phone</FormLabel>
                                                <FormControl><Input type="tel" {...field} tabIndex={4} className="input-custom-styles"/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={guardianForm.control}
                                        name="cell_phone"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Cell Phone</FormLabel>
                                                <FormControl><Input type="tel" {...field} tabIndex={5} className="input-custom-styles"/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={guardianForm.control}
                                        name="email"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl><Input type="email" {...field} tabIndex={6} className="input-custom-styles"/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={guardianForm.control}
                                        name="work_phone"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Work Phone</FormLabel>
                                                <FormControl><Input type="tel" {...field}
                                                                    value={getDefaultValue(field.value)} tabIndex={7} className="input-custom-styles"/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={guardianForm.control}
                                        name="employer"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Employer</FormLabel>
                                                <FormControl><Input {...field}
                                                                    value={getDefaultValue(field.value)} tabIndex={8} className="input-custom-styles"/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={guardianForm.control}
                                        name="employer_phone"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Employer Phone</FormLabel>
                                                <FormControl><Input type="tel" {...field}
                                                                    value={getDefaultValue(field.value)} tabIndex={9} className="input-custom-styles"/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={guardianForm.control}
                                        name="employer_notes"
                                        render={({field}) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Employer Notes</FormLabel>
                                                <FormControl><Textarea {...field}
                                                                       value={getDefaultValue(field.value)} tabIndex={10} className="input-custom-styles"/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex justify-end gap-4 mt-6">
                                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}
                                            disabled={isSubmitting} tabIndex={11}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting} tabIndex={12}>
                                        {isSubmitting && formIntent === 'updateGuardian' ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>
                            </Form>
                        </UIForm>
                    )}
                </ClientOnly>
            ) : (
                // --- View Mode ---
                <>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6 space-y-4">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Guardian Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <p><strong>First Name:</strong> {guardian.first_name}</p>
                            <p><strong>Last Name:</strong> {guardian.last_name}</p>
                            <p><strong>Relationship:</strong> {guardian.relationship}</p>
                            <p><strong>Home Phone:</strong> {guardian.home_phone}</p>
                            <p><strong>Cell Phone:</strong> {guardian.cell_phone}</p>
                            <p><strong>Email:</strong> {guardian.email}</p>
                            <p><strong>Work Phone:</strong> {guardian.work_phone || 'N/A'}</p>
                            <p><strong>Employer:</strong> {guardian.employer || 'N/A'}</p>
                            <p><strong>Employer Phone:</strong> {guardian.employer_phone || 'N/A'}</p>
                            <p className="md:col-span-2"><strong>Employer
                                Notes:</strong> {guardian.employer_notes || 'N/A'}</p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap justify-between items-center gap-4 mt-6">
                        <Button variant="outline" onClick={() => setIsEditing(true)}>
                            Edit Guardian
                        </Button>

                        {/* Delete Button triggers Dialog */}
                        <Button
                            type="button" // Change type to button
                            variant="destructive"
                            onClick={() => setIsDeleteDialogOpen(true)} // Open dialog on click
                            disabled={isSubmitting && formIntent === 'deleteGuardian'}
                        >
                            {isSubmitting && formIntent === 'deleteGuardian' ? 'Deleting...' : 'Delete Guardian'}
                        </Button>
                    </div>

                    {/* Delete Confirmation Dialog */}
                    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the guardian
                                    <span className="font-semibold"> {guardian.first_name} {guardian.last_name}</span> and remove their data from our servers.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isSubmitting && formIntent === 'deleteGuardian'}>Cancel</AlertDialogCancel>
                                {/* Removed hidden form */}
                                {/* Action button triggers form submission via useSubmit */}
                                <AlertDialogAction
                                    onClick={() => {
                                        // No need for e.preventDefault()
                                        const formData = new FormData();
                                        formData.append('intent', 'deleteGuardian');
                                        submit(formData, { method: 'post', replace: true }); // Use submit hook, replace history entry
                                    }}
                                    disabled={isSubmitting && formIntent === 'deleteGuardian'} // Disable during submission
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90" // Style as destructive
                                >
                                    {/* Show loading state */}
                                    {isSubmitting && formIntent === 'deleteGuardian' ? 'Deleting...' : 'Delete Guardian'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}
        </div>
    );
}

// Optional: Add ErrorBoundary specific to this route
// export function ErrorBoundary() { ... }
