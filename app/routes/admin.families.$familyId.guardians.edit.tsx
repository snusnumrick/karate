import invariant from "tiny-invariant";
import type {ActionFunctionArgs, LoaderFunctionArgs, MetaFunction} from "@remix-run/node";
import {json, redirect} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation, useParams} from "@remix-run/react";
// Import createClient
import {createClient} from "@supabase/supabase-js";
// Remove unused PostgrestFilterBuilder import
import {Database, TablesUpdate} from "~/types/database.types"; // Import TablesUpdate
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "~/components/ui/select"; // Import Select components
import {Separator} from "~/components/ui/separator";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {ExclamationTriangleIcon} from "@radix-ui/react-icons";
import { ClientOnly } from "~/components/client-only"; // Import ClientOnly
import { AdminCard, AdminCardHeader, AdminCardTitle, AdminCardDescription, AdminCardContent, AdminCardFooter } from "~/components/AdminCard";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

type GuardianRow = Database['public']['Tables']['guardians']['Row'];

// Define the shape of the data returned by the loader
type LoaderData = {
    familyName: string | null;
    guardians: GuardianRow[];
};

// Define the shape of the data returned by the action
type ActionData = {
    success?: boolean;
    error?: string;
    // More complex error handling might be needed for multiple guardians
    fieldErrors?: Record<string, Record<string, string>>; // e.g., { guardianId: { fieldName: errorMessage } }
};

export const meta: MetaFunction<typeof loader> = ({data}) => {
    const familyName = data?.familyName ?? "Family";
    return [
        {title: `Edit Guardians for ${familyName} | Admin Dashboard`},
        {name: "description", content: `Edit guardian details for the ${familyName} family.`},
    ];
};

// Loader to fetch family name and existing guardians
export async function loader({params}: LoaderFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Guardians Edit Loader] Missing Supabase URL or Service Role Key env vars.");
        throw new Response("Server configuration error", {status: 500});
    }

    const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Fetch family name and guardians in parallel
    const [familyResult, guardiansResult] = await Promise.all([
        supabaseServer
            .from('families')
            .select('name')
            .eq('id', familyId)
            .maybeSingle(), // Use maybeSingle in case family is somehow deleted
        supabaseServer
            .from('guardians')
            .select('*')
            .eq('family_id', familyId)
        // .order('created_at', { ascending: true }) // Removed: Column does not exist
    ]);

    const {data: familyData, error: familyError} = familyResult;
    const {data: guardians, error: guardiansError} = guardiansResult;

    if (familyError) {
        console.error(`[Guardians Edit Loader] Supabase error fetching family name ${familyId}:`, familyError.message);
        // Don't necessarily fail if only name fetch fails, but log it
    }
    if (guardiansError) {
        console.error(`[Guardians Edit Loader] Supabase error fetching guardians for family ${familyId}:`, guardiansError.message);
        throw new Response(`Database error fetching guardians: ${guardiansError.message}`, {status: 500});
    }

    if (!guardians) {
        // This shouldn't happen if the query succeeds, but good to check
        throw new Response("Could not fetch guardians", {status: 500});
    }

    return json({familyName: familyData?.name ?? null, guardians});
}

// Action to handle form submission for updating guardians
export async function action({request, params}: ActionFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId;
    const formData = await request.formData();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Guardians Edit Action] Missing Supabase URL or Service Role Key env vars.");
        return json<ActionData>({error: "Server configuration error"}, {status: 500});
    }

    const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Let TypeScript infer the type of the array elements (they are thenable builders)
    const updates = [];
    const fieldErrors: ActionData['fieldErrors'] = {};

    // Need a way to iterate through guardians submitted in the form.
    // Let's assume form names like `guardians[GUARDIAN_ID][first_name]`
    // This requires parsing formData more carefully.
    // A simpler approach for now: refetch guardians and update based on form data.

    // Refetch guardians to ensure we have the correct IDs
    const {data: currentGuardians, error: fetchError} = await supabaseServer
        .from('guardians')
        .select('id')
        .eq('family_id', familyId);

    if (fetchError) {
        console.error(`[Guardians Edit Action] Error fetching current guardians for family ${familyId}:`, fetchError.message);
        return json<ActionData>({error: `Database error: ${fetchError.message}`}, {status: 500});
    }
    if (!currentGuardians) {
        return json<ActionData>({error: "Could not find guardians to update."}, {status: 404});
    }

    for (const guardian of currentGuardians) {
        const guardianId = guardian.id;
        const firstName = formData.get(`guardian_${guardianId}_first_name`) as string | null;
        const lastName = formData.get(`guardian_${guardianId}_last_name`) as string | null;
        const relationship = formData.get(`guardian_${guardianId}_relationship`) as string | null;
        const cell_phone = formData.get(`guardian_${guardianId}_cell_phone`) as string | null;
        const email = formData.get(`guardian_${guardianId}_email`) as string | null;
        const home_phone = formData.get(`guardian_${guardianId}_home_phone`) as string | null;
        const work_phone = formData.get(`guardian_${guardianId}_work_phone`) as string | null;
        const employer = formData.get(`guardian_${guardianId}_employer`) as string | null;
        const employer_phone = formData.get(`guardian_${guardianId}_employer_phone`) as string | null;
        const employer_notes = formData.get(`guardian_${guardianId}_employer_notes`) as string | null;


        // Basic Validation per guardian - Align with DB constraints
        const currentGuardianErrors: Record<string, string> = {};
        if (!firstName) currentGuardianErrors.first_name = "First name is required.";
        if (!lastName) currentGuardianErrors.last_name = "Last name is required.";
        if (!relationship) currentGuardianErrors.relationship = "Relationship is required.";
        if (!cell_phone) currentGuardianErrors.cell_phone = "Cell phone is required.";
        if (!email) currentGuardianErrors.email = "Email is required.";
        // Home phone is now optional
        // Optional fields don't need presence validation unless specific formats are required
        // Add more specific validation (email format, phone format, etc.)

        if (Object.keys(currentGuardianErrors).length > 0) {
            fieldErrors[guardianId] = currentGuardianErrors;
        } else {
            // Type safety: firstName, lastName, etc., are confirmed non-null strings here due to the validation above.
            // Use the imported TablesUpdate type for better clarity
            // Required fields are guaranteed non-null here by validation.
            // Optional fields use '|| undefined' to match the expected type 'string | undefined'.
            const updatePayload: TablesUpdate<"guardians"> = {
                first_name: firstName!,
                last_name: lastName!,
                relationship: relationship!,
                cell_phone: cell_phone!,
                email: email!,
                home_phone: home_phone!,
                // Optional fields
                work_phone: work_phone,
                employer: employer,
                employer_phone: employer_phone,
                employer_notes: employer_notes,
            };

            // Add update operation to the list
            updates.push(
                supabaseServer
                    .from('guardians')
                    .update(updatePayload) // Pass the explicitly typed payload
                    .eq('id', guardianId)
            );
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        console.log("[Guardians Edit Action] Validation failed:", fieldErrors);
        return json<ActionData>({error: "Validation failed", fieldErrors}, {status: 400});
    }

    // Execute all update promises
    const results = await Promise.allSettled(updates);

    // Check for errors during update
    const updateErrors = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason); // Extract the rejection reason

    if (updateErrors.length > 0) {
        console.error(`[Guardians Edit Action] Supabase error updating guardians for family ${familyId}:`, updateErrors);
        // Extract error messages more reliably
        const errorMessages = updateErrors.map(error => error?.message || 'Unknown update error').join(', ');
        return json<ActionData>({error: `Database error during update: ${errorMessages}`}, {status: 500});
    }

    // Redirect back to the family detail page after successful update
    return redirect(`/admin/families/${familyId}`);
}


// Component for the Edit Guardians page
export default function EditGuardiansPage() {
    const {familyName, guardians} = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const params = useParams();

    const isSubmitting = navigation.state === "submitting";

    // Get the first guardian's name for breadcrumb, or use "Guardians" if multiple
    const guardianName = guardians.length === 1 
        ? `${guardians[0].first_name} ${guardians[0].last_name}`.trim()
        : "Guardians";

    return (
        <div className="space-y-6">
            <AppBreadcrumb 
                items={breadcrumbPatterns.adminFamilyGuardianEdit(
                    familyName ?? 'Family', 
                    params.familyId!, 
                    guardianName
                )} 
            />
            
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Edit Guardians for {familyName ?? 'Family'}</h1>
                {/* Top Cancel button removed */}
            </div>

            <AdminCard>
                <AdminCardHeader>
                    <AdminCardTitle>Edit Guardian Details</AdminCardTitle>
                    <AdminCardDescription>Update the information for the guardians associated with
                        the {familyName ?? 'family'} family.</AdminCardDescription>
                </AdminCardHeader>
                <AdminCardContent>
                    {actionData?.error && !actionData.fieldErrors && (
                        <Alert variant="destructive" className="mb-4">
                            <ExclamationTriangleIcon className="h-4 w-4"/>
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{actionData.error}</AlertDescription>
                        </Alert>
                    )}
                    {guardians.length === 0 ? (
                        <p>There are no guardians associated with this family to edit.</p>
                    ) : (
                        <ClientOnly fallback={<div className="text-center p-8">Loading form...</div>}>
                            {() => (
                                <Form method="post" className="space-y-6">
                                    {guardians.map((guardian, index) => {
                                        const guardianId = guardian.id;
                                const errors = actionData?.fieldErrors?.[guardianId];
                                return (
                                    <div key={guardianId} className="p-4 border rounded-md space-y-4">
                                        <h3 className="font-semibold text-lg">Guardian {index + 1}</h3>
                                        {/* Hidden input to identify the guardian - might not be needed if using named fields */}
                                        {/* <input type="hidden" name={`guardians[${index}][id]`} value={guardianId} /> */}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* First Name */}
                                            <div className="space-y-1">
                                                <Label htmlFor={`guardian_${guardianId}_first_name`}>First Name</Label>
                                                <Input
                                                    id={`guardian_${guardianId}_first_name`}
                                                    name={`guardian_${guardianId}_first_name`}
                                                    className="input-custom-styles"
                                                    defaultValue={guardian.first_name ?? ''}
                                                    required
                                                    aria-invalid={!!errors?.first_name}
                                                    aria-describedby={`guardian_${guardianId}_first_name-error`}
                                                    tabIndex={index * 10 + 1}
                                                />
                                                {errors?.first_name && (
                                                    <p id={`guardian_${guardianId}_first_name-error`}
                                                       className="text-sm text-destructive">
                                                        {errors.first_name}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Last Name */}
                                            <div className="space-y-1">
                                                <Label htmlFor={`guardian_${guardianId}_last_name`}>Last Name</Label>
                                                <Input
                                                    id={`guardian_${guardianId}_last_name`}
                                                    name={`guardian_${guardianId}_last_name`}
                                                    className="input-custom-styles"
                                                    defaultValue={guardian.last_name ?? ''}
                                                    required
                                                    aria-invalid={!!errors?.last_name}
                                                    aria-describedby={`guardian_${guardianId}_last_name-error`}
                                                    tabIndex={index * 10 + 2}
                                                />
                                                {errors?.last_name && (
                                                    <p id={`guardian_${guardianId}_last_name-error`}
                                                       className="text-sm text-destructive">
                                                        {errors.last_name}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Relationship */}
                                            <div className="space-y-1">
                                                <Label htmlFor={`guardian_${guardianId}_relationship`}>Relationship</Label>
                                                {/* Use Select component */}
                                                <Select
                                                    name={`guardian_${guardianId}_relationship`}
                                                    defaultValue={guardian.relationship ?? ''}
                                                    required
                                                >
                                                    {/* Applied input-custom-styles for consistency */}
                                                    <SelectTrigger
                                                        id={`guardian_${guardianId}_relationship`}
                                                        className="input-custom-styles"
                                                        aria-invalid={!!errors?.relationship}
                                                        aria-describedby={`guardian_${guardianId}_relationship-error`}
                                                        tabIndex={index * 10 + 3}
                                                    >
                                                        <SelectValue placeholder="Select relationship"/>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Mother">Mother</SelectItem>
                                                        <SelectItem value="Father">Father</SelectItem>
                                                        <SelectItem value="Guardian">Guardian</SelectItem>
                                                        <SelectItem value="Other">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {errors?.relationship && (
                                                    <p id={`guardian_${guardianId}_relationship-error`}
                                                       className="text-sm text-destructive">
                                                        {errors.relationship}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Cell Phone */}
                                            <div className="space-y-1">
                                                <Label htmlFor={`guardian_${guardianId}_cell_phone`}>Cell Phone</Label>
                                                <Input
                                                    id={`guardian_${guardianId}_cell_phone`}
                                                    name={`guardian_${guardianId}_cell_phone`}
                                                    type="tel"
                                                    className="input-custom-styles"
                                                    defaultValue={guardian.cell_phone ?? ''} // Use cell_phone
                                                    required // Added required
                                                    autoComplete="mobile tel"
                                                    aria-invalid={!!errors?.cell_phone}
                                                    aria-describedby={`guardian_${guardianId}_cell_phone-error`}
                                                    tabIndex={index * 10 + 4}
                                                />
                                                {errors?.cell_phone && (
                                                    <p id={`guardian_${guardianId}_cell_phone-error`}
                                                       className="text-sm text-destructive">
                                                        {errors.cell_phone}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Home Phone */}
                                            <div className="space-y-1">
                                                <Label htmlFor={`guardian_${guardianId}_home_phone`}>Home Phone</Label>
                                                <Input
                                                    id={`guardian_${guardianId}_home_phone`}
                                                    name={`guardian_${guardianId}_home_phone`}
                                                    type="tel"
                                                    className="input-custom-styles"
                                                    defaultValue={guardian.home_phone ?? ''}
                                                    autoComplete="home tel"
                                                    aria-invalid={!!errors?.home_phone}
                                                    aria-describedby={`guardian_${guardianId}_home_phone-error`}
                                                    tabIndex={index * 10 + 5}
                                                />
                                                {errors?.home_phone && (
                                                    <p id={`guardian_${guardianId}_home_phone-error`}
                                                       className="text-sm text-destructive">
                                                        {errors.home_phone}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Work Phone */}
                                            <div className="space-y-1">
                                                <Label htmlFor={`guardian_${guardianId}_work_phone`}>Work Phone</Label>
                                                <Input
                                                    id={`guardian_${guardianId}_work_phone`}
                                                    name={`guardian_${guardianId}_work_phone`}
                                                    type="tel"
                                                    className="input-custom-styles"
                                                    defaultValue={guardian.work_phone ?? ''}
                                                    autoComplete="work tel"
                                                    aria-invalid={!!errors?.work_phone}
                                                    aria-describedby={`guardian_${guardianId}_work_phone-error`}
                                                    tabIndex={index * 10 + 6}
                                                />
                                                {errors?.work_phone && (
                                                    <p id={`guardian_${guardianId}_work_phone-error`}
                                                       className="text-sm text-destructive">
                                                        {errors.work_phone}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Email */}
                                            <div className="space-y-1"> {/* Removed col-span */}
                                                <Label htmlFor={`guardian_${guardianId}_email`}>Email</Label>
                                                <Input
                                                    id={`guardian_${guardianId}_email`}
                                                    name={`guardian_${guardianId}_email`}
                                                    type="email"
                                                    className="input-custom-styles"
                                                    defaultValue={guardian.email ?? ''}
                                                    required // Added required
                                                    autoComplete="email"
                                                    aria-invalid={!!errors?.email}
                                                    aria-describedby={`guardian_${guardianId}_email-error`}
                                                    tabIndex={index * 10 + 7}
                                                />
                                                {errors?.email && (
                                                    <p id={`guardian_${guardianId}_email-error`}
                                                       className="text-sm text-destructive">
                                                        {errors.email}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Employer */}
                                            <div className="space-y-1">
                                                <Label htmlFor={`guardian_${guardianId}_employer`}>Employer</Label>
                                                <Input
                                                    id={`guardian_${guardianId}_employer`}
                                                    name={`guardian_${guardianId}_employer`}
                                                    className="input-custom-styles"
                                                    defaultValue={guardian.employer ?? ''}
                                                    aria-invalid={!!errors?.employer}
                                                    aria-describedby={`guardian_${guardianId}_employer-error`}
                                                    tabIndex={index * 10 + 8}
                                                />
                                                {errors?.employer && (
                                                    <p id={`guardian_${guardianId}_employer-error`}
                                                       className="text-sm text-destructive">
                                                        {errors.employer}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Employer Phone */}
                                            <div className="space-y-1">
                                                <Label htmlFor={`guardian_${guardianId}_employer_phone`}>Employer
                                                    Phone</Label>
                                                <Input
                                                    id={`guardian_${guardianId}_employer_phone`}
                                                    name={`guardian_${guardianId}_employer_phone`}
                                                    type="tel"
                                                    className="input-custom-styles"
                                                    defaultValue={guardian.employer_phone ?? ''}
                                                    autoComplete="work tel"
                                                    aria-invalid={!!errors?.employer_phone}
                                                    aria-describedby={`guardian_${guardianId}_employer_phone-error`}
                                                    tabIndex={index * 10 + 9}
                                                />
                                                {errors?.employer_phone && (
                                                    <p id={`guardian_${guardianId}_employer_phone-error`}
                                                       className="text-sm text-destructive">
                                                        {errors.employer_phone}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Employer Notes */}
                                            <div className="space-y-1 md:col-span-2"> {/* Span across columns */}
                                                <Label htmlFor={`guardian_${guardianId}_employer_notes`}>Employer
                                                    Notes</Label>
                                                <Input // Consider using Textarea if notes can be long
                                                    id={`guardian_${guardianId}_employer_notes`}
                                                    name={`guardian_${guardianId}_employer_notes`}
                                                    className="input-custom-styles"
                                                    defaultValue={guardian.employer_notes ?? ''}
                                                    aria-invalid={!!errors?.employer_notes}
                                                    aria-describedby={`guardian_${guardianId}_employer_notes-error`}
                                                    tabIndex={index * 10 + 10}
                                                />
                                                {errors?.employer_notes && (
                                                    <p id={`guardian_${guardianId}_employer_notes-error`}
                                                       className="text-sm text-destructive">
                                                        {errors.employer_notes}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <Separator className="my-4"/>

                            <div className="flex justify-end space-x-2">
                                <Button type="button" variant="outline" asChild tabIndex={guardians.length * 10 + 1}>
                                    <Link to={`/admin/families/${params.familyId}`}>Cancel</Link>
                                </Button>
                                <Button type="submit" disabled={isSubmitting} tabIndex={guardians.length * 10 + 2}>
                                    {isSubmitting ? "Saving Guardians..." : "Save All Changes"}
                                </Button>
                            </div>
                                </Form>
                            )}
                        </ClientOnly>
                    )}
                </AdminCardContent>
            </AdminCard>
        </div>
    );
}

// Re-use the Error Boundary from the main family detail page for now
export {ErrorBoundary} from "./admin.families.$familyId";
