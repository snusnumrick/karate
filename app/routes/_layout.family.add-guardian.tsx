import {useEffect, useRef} from "react";
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect, TypedResponse} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import { getSupabaseAdminClient } from '~/utils/supabase.server';
import {Button} from "~/components/ui/button";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {Input} from "~/components/ui/input";
import {Textarea} from "~/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import type {Database} from "~/types/database.types";
import {z} from "zod"; // For validation
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Form as UIForm, FormControl, FormField, FormItem, FormLabel, FormMessage} from "~/components/ui/form"; // Shadcn Form components
import {ClientOnly} from "~/components/client-only";
import {AppBreadcrumb, breadcrumbPatterns} from "~/components/AppBreadcrumb";

// --- Types and Schemas ---
type GuardianInsert = Database['public']['Tables']['guardians']['Insert'];

// Define potential action data structure
type SerializedZodIssue = {
    path: (string | number)[];
    message: string;
};
type ActionResponse = {
    status: 'success' | 'error';
    message: string;
    errors?: SerializedZodIssue[];
};

// Validation Schema (similar to edit guardian, but without intent)
const addGuardianSchema = z.object({
    first_name: z.string().trim().min(1, "First name is required"),
    last_name: z.string().trim().min(1, "Last name is required"),
    relationship: z.string().trim().min(1, "Relationship is required"),
    home_phone: z.string().optional().nullable(),
    cell_phone: z.string().trim().min(1, "Cell phone is required"),
    email: z.string().email("Invalid email address"),
    work_phone: z.string().optional().nullable(),
    employer: z.string().optional().nullable(),
    employer_phone: z.string().optional().nullable(),
    employer_notes: z.string().optional().nullable(),
});
type AddGuardianFormData = z.infer<typeof addGuardianSchema>;

// --- Loader ---
// Loader to get family ID for association
interface LoaderData {
    familyId: string;
    error?: string;
}

export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return redirect("/login?redirectTo=/family/add-guardian", {headers});
    }

    // Fetch the user's profile to get their family_id
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || !profileData.family_id) {
        console.error("Error fetching profile or family_id for add guardian:", profileError?.message);
        // Redirect to family portal if no family association found
        return redirect("/family", {headers});
        // Or return an error:
        // return json({ error: "Failed to load user profile or family association." }, { status: 500, headers });
    }

    return json({familyId: profileData.family_id}, {headers});
}


// --- Action ---
export async function action({request}: ActionFunctionArgs): Promise<TypedResponse<ActionResponse>> {
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const formData = await request.formData();
    const formValues = Object.fromEntries(formData.entries());

    const {data: {user}} = await supabaseServer.auth.getUser();
    if (!user) {
        return json({status: 'error', message: 'User not authenticated.'}, {status: 401, headers});
    }

    // Fetch family ID again for security, don't rely on hidden form field
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles').select('family_id').eq('id', user.id).single();

    if (profileError || !profileData?.family_id) {
        return json({status: 'error', message: 'Could not find associated family.'}, {status: 404, headers});
    }
    const familyId = profileData.family_id;

    // Validate form data
    const parsed = addGuardianSchema.safeParse(formValues);

    if (!parsed.success) {
        console.error("Add guardian validation failed:", parsed.error.issues);
        return json({
            status: 'error',
            message: 'Invalid form data.',
            errors: parsed.error.issues,
        }, {status: 400, headers});
    }

    // Prepare data for insertion
    const guardianInsertData: GuardianInsert = {
        ...parsed.data,
        family_id: familyId, // Associate with the correct family
    };

    // Get admin client to bypass RLS for insertion
    const supabaseAdmin = getSupabaseAdminClient();

    // Insert the new guardian using the admin client
    console.log(`[Action/AddGuardian] Attempting insert for family ${familyId}`);
    const { error: insertError } = await supabaseAdmin // Use explicit admin client
        .from('guardians')
        .insert(guardianInsertData);

    if (insertError) {
        console.error("[Action/AddGuardian] Error inserting new guardian:", insertError);
        return json({
            status: 'error',
            message: `Failed to add guardian: ${insertError.message}`
        }, {status: 500, headers});
    }

    // Redirect to the main family portal on success
    return redirect("/family", {headers});
}

// --- Component ---
// Helper to get default values, handling nulls
const getDefaultValue = (value: string | null | undefined) => value ?? '';

export default function AddGuardianPage() {
    // Removed unused familyId variable
    const {error: loaderError} = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionResponse>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // Ref for the first input field to enable focus
    const firstNameRef = useRef<HTMLInputElement>(null);

    // Guardian Form setup
    const guardianForm = useForm<AddGuardianFormData>({
        resolver: zodResolver(addGuardianSchema),
        defaultValues: {
            first_name: '',
            last_name: '',
            relationship: '',
            home_phone: '',
            cell_phone: '',
            email: '',
            work_phone: '',
            employer: '',
            employer_phone: '',
            employer_notes: '',
        },
    });

    // Focus on first input field when component mounts, with delay for ClientOnly
    useEffect(() => {
        const timer = setTimeout(() => {
            if (firstNameRef.current) {
                firstNameRef.current.focus();
            }
        }, 100); // Small delay to ensure ClientOnly has rendered

        return () => clearTimeout(timer);
    }, []);

    // Display loader error if any
    if (loaderError) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Alert variant="destructive">
                    <AlertTitle>Error Loading Page</AlertTitle>
                    <AlertDescription>{loaderError}</AlertDescription>
                </Alert>
                <Button variant="link" asChild className="mt-4">
                    <Link to="/family">Return to Family Portal</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.familyAddGuardian()} className="mb-6"  />

            <h1 className="text-3xl font-bold mb-6">Add New Guardian</h1>

            {/* Display general action feedback */}
            {actionData?.status === 'error' && !actionData.errors && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.message}</AlertDescription>
                </Alert>
            )}
            {/* Success message handled by redirect */}

            <ClientOnly fallback={<div className="text-center p-8">Loading form...</div>}>
                {() => {
                    return (
                        <UIForm {...guardianForm}>
                            <Form method="post" className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                            {/* Display field-specific errors */}
                            {actionData?.errors && (
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
                                            <FormControl><Input {...field} ref={firstNameRef} autoComplete="given-name" className="input-custom-styles" tabIndex={1}/></FormControl>
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
                                            <FormControl><Input {...field} autoComplete="family-name" className="input-custom-styles" tabIndex={2}/></FormControl>
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
                                                    <SelectTrigger className="input-custom-styles" tabIndex={3}><SelectValue
                                                        placeholder="Select relationship"/></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Mother">Mother</SelectItem>
                                                    <SelectItem value="Father">Father</SelectItem>
                                                    <SelectItem value="Guardian">Guardian</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {/* Add hidden input to ensure value submission */}
                                            <input type="hidden" name={field.name} value={field.value || ''} />
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
                                            <FormControl><Input type="tel" {...field} value={getDefaultValue(field.value)} autoComplete="home tel" className="input-custom-styles" tabIndex={4}/></FormControl>
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
                                            <FormControl><Input type="tel" {...field} autoComplete="mobile tel" className="input-custom-styles" tabIndex={5}/></FormControl>
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
                                            <FormControl><Input type="email" {...field} autoComplete="email" className="input-custom-styles" tabIndex={6}/></FormControl>
                                            <FormMessage className="dark:text-red-400"/>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={guardianForm.control}
                                    name="work_phone"
                                    render={({field}) => (
                                        <FormItem>
                                            <FormLabel>Work Phone (Optional)</FormLabel>
                                            <FormControl><Input type="tel" {...field}
                                                                value={getDefaultValue(field.value)} autoComplete="work tel" className="input-custom-styles" tabIndex={7}/></FormControl>
                                            <FormMessage className="dark:text-red-400"/>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={guardianForm.control}
                                    name="employer"
                                    render={({field}) => (
                                        <FormItem>
                                            <FormLabel>Employer (Optional)</FormLabel>
                                            <FormControl><Input {...field}
                                                                value={getDefaultValue(field.value)} autoComplete="organization" className="input-custom-styles" tabIndex={8}/></FormControl>
                                            <FormMessage className="dark:text-red-400"/>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={guardianForm.control}
                                    name="employer_phone"
                                    render={({field}) => (
                                        <FormItem>
                                            <FormLabel>Employer Phone (Optional)</FormLabel>
                                            <FormControl><Input type="tel" {...field}
                                                                value={getDefaultValue(field.value)} autoComplete="work tel" className="input-custom-styles" tabIndex={9}/></FormControl>
                                            <FormMessage className="dark:text-red-400"/>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={guardianForm.control}
                                    name="employer_notes"
                                    render={({field}) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Employer Notes (Optional)</FormLabel>
                                            <FormControl><Textarea {...field}
                                                                   value={getDefaultValue(field.value)} className="input-custom-styles" tabIndex={10}/></FormControl>
                                            <FormMessage className="dark:text-red-400"/>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-4 mt-6">
                                <Button type="button" variant="outline" asChild tabIndex={11}>
                                    <Link to="/family">Cancel</Link>
                                </Button>
                                <Button type="submit" disabled={isSubmitting} tabIndex={12}>
                                    {isSubmitting ? 'Saving...' : 'Save Guardian'}
                                </Button>
                            </div>
                        </Form>
                    </UIForm>
                    );
                }}
            </ClientOnly>
        </div>
    );
}
