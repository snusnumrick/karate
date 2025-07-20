import {ActionFunctionArgs, json, type LoaderFunctionArgs, TypedResponse} from "@remix-run/node"; // Added redirect
import {Form, Link, useActionData, useLoaderData, useNavigation} from "@remix-run/react"; // Added useActionData, useNavigation
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Database} from "~/types/database.types"; // Import Database type
import {z} from "zod"; // For validation
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Form as UIForm, FormControl, FormField, FormItem, FormLabel, FormMessage} from "~/components/ui/form"; // Shadcn Form components
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "~/components/ui/select"; // Import Select
import {Textarea} from "~/components/ui/textarea"; // Import Textarea
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert"; // For feedback
import {ClientOnly} from "~/components/client-only";
import {useEffect} from "react";
import {Checkbox} from "~/components/ui/checkbox"; // Import Checkbox for preferences
import { siteConfig } from "~/config/site"; // Import siteConfig
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb"; // Import breadcrumb component
import { NotificationSettings } from "~/components/NotificationSettings"; // Import notification settings

// Define a type for serialized Zod issues (plain objects)
type SerializedZodIssue = {
    path: (string | number)[]; // Path can include numbers for array indices
    message: string;
};

// Define Supabase types for easier access
type FamilyRow = Database['public']['Tables']['families']['Row'];
// GuardianRow removed as it's no longer fetched/used here

// Define expected loader data structure
interface LoaderData {
    family?: FamilyRow;
    // guardians removed
    waiverSignatures?: Database['public']['Tables']['waiver_signatures']['Row'][];
    userPreferences?: {
        receiveMarketingEmails: boolean;
    };
    error?: string;
}

// --- Validation Schemas ---
const preferencesSchema = z.object({
    intent: z.literal('updatePreferences'),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
    receiveMarketingEmails: z.coerce.boolean().optional()
}).superRefine((data, ctx) => {
    // Current password required if changing password
    if ((data.newPassword || data.confirmPassword) && !data.currentPassword) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['currentPassword'],
            message: "Current password is required to change password"
        });
    }

    // Password confirmation match
    if (data.newPassword !== data.confirmPassword) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['confirmPassword'],
            message: "Passwords must match"
        });
    }

    // New password requirements
    if (data.newPassword && data.newPassword.length < 8) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['newPassword'],
            message: "Password must be at least 8 characters"
        });
    }

    // Password complexity check
    if (data.newPassword && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(data.newPassword)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['newPassword'],
            message: "Password must contain uppercase, lowercase, and number"
        });
    }
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

const familySchema = z.object({
    intent: z.literal('updateFamily'),
    name: z.string().min(1, "Family name is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    province: z.string().min(1, "Province is required"),
    postal_code: z.string().min(1, "Postal code is required"),
    primary_phone: z.string().min(1, "Primary phone is required"),
    email: z.string().email("Invalid email address"),
    // Optional fields don't need min(1)
    referral_source: z.string().optional().nullable(),
    referral_name: z.string().optional().nullable(),
    emergency_contact: z.string().optional().nullable(),
    health_info: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});
type FamilyFormData = z.infer<typeof familySchema>;

// Removed guardianSchema and GuardianFormData

// Combined schema for parsing intent in action
const formSchema = z.union([
    familySchema,
    // guardianSchema removed
    preferencesSchema
]);

// --- Loader ---
export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        // Redirect or error if not logged in (should be handled by layout)
        return json({error: "User not authenticated"}, {status: 401, headers});
    }

    // Fetch profile to get family_id
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || !profileData.family_id) {
        console.error("Error fetching profile or family_id for account page:", profileError?.message);
        return json({error: "Failed to load user profile or family association."}, {status: 500, headers});
    }

    const familyId = profileData.family_id;

    // Fetch family data using family_id
    const {data: familyData, error: familyError} = await supabaseServer
        .from('families')
        .select('*') // Fetch all family fields
        .eq('id', familyId)
        .single();

    // Removed guardian fetching logic

    // Fetch waiver signatures
    const {data: waiverSignaturesData} = await supabaseServer
        .from('waiver_signatures')
        .select('*, waivers(title, description)')
        .eq('user_id', user.id)
        .order('signed_at', {ascending: false});

    // Get user preferences from auth metadata
    const userPreferences = {
        receiveMarketingEmails: user.user_metadata?.receive_marketing_emails ?? true
    };

    if (familyError || !familyData) {
        console.error("Error fetching family data for account page:", familyError?.message);
        // Return error if family data fails
        return json({error: "Failed to load family details."}, {status: 500, headers});
    }

    // Removed guardian error handling

    return json({
        family: familyData,
        // guardians removed
        waiverSignatures: waiverSignaturesData || [],
        userPreferences
    }, {headers});
}

// --- Action ---
type ActionResponse = {
    status: 'success' | 'error';
    message: string;
    errors?: SerializedZodIssue[]; // Use the serialized type
    intent?: 'updateFamily' | 'updatePreferences'; // Removed 'updateGuardian'
    // guardianId removed
};

export async function action({request}: ActionFunctionArgs): Promise<TypedResponse<ActionResponse>> {
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const formData = await request.formData();
    const formValues = Object.fromEntries(formData.entries());

    const parsed = formSchema.safeParse(formValues);

    if (!parsed.success) {
        console.error("Form validation failed:", parsed.error.issues);
        return json({
            status: 'error',
            message: 'Invalid form data.',
            errors: parsed.error.issues,
            intent: formData.get('intent') as 'updateFamily' | 'updatePreferences' | undefined, // Adjusted intent type
            // guardianId removed
        }, {status: 400, headers});
    }

    const {intent} = parsed.data;

    try {
        if (intent === 'updateFamily') {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {intent: _, ...familyUpdateData} = parsed.data; // Exclude intent

            // Need family ID - fetch it again based on user (safer than hidden field)
            const {data: {user}} = await supabaseServer.auth.getUser();
            if (!user) return json({status: 'error', message: 'User not authenticated.'}, {status: 401, headers});

            const {data: profileData, error: profileError} = await supabaseServer
                .from('profiles').select('family_id').eq('id', user.id).single();
            if (profileError || !profileData?.family_id) {
                return json({status: 'error', message: 'Could not find associated family.'}, {status: 404, headers});
            }

            const {error: updateError} = await supabaseServer
                .from('families')
                .update(familyUpdateData)
                .eq('id', profileData.family_id);

            if (updateError) throw updateError;

            return json({status: 'success', message: 'Family information updated successfully.', intent}, {headers});

        // Removed 'updateGuardian' intent block
        } else if (intent === 'updatePreferences') {
            const {currentPassword, newPassword, receiveMarketingEmails} = parsed.data;

            // Get user
            const {data: {user}} = await supabaseServer.auth.getUser();
            if (!user) return json({status: 'error', message: 'Not authenticated'}, {status: 401, headers});

            // Update password if provided
            if (newPassword && currentPassword) {
                const {error: updateError} = await supabaseServer.auth.updateUser({
                    password: newPassword,
                    data: {receive_marketing_emails: receiveMarketingEmails}
                });

                if (updateError) throw updateError;
            }

            // Update email preferences if no password change
            if (!newPassword) {
                const {error} = await supabaseServer.auth.updateUser({
                    data: {receive_marketing_emails: receiveMarketingEmails}
                });
                if (error) throw error;
            }

            return json({
                status: 'success',
                message: 'Preferences updated successfully',
                intent: 'updatePreferences'
            }, {headers});
        }

        // Should not happen if schema is correct
        return json({status: 'error', message: 'Invalid form intent.'}, {status: 400, headers});

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error(`Error during ${intent}:`, message);
        return json({
            status: 'error',
            message: `Failed to update information: ${message}`,
            intent: intent,
            // guardianId removed
        }, {status: 500, headers});
    }
}


// --- Component ---

// Helper to get default values, handling nulls
const getDefaultValue = (value: string | null | undefined) => value ?? '';

export default function AccountSettingsPage() {
    // guardians removed from loader data destructuring
    const {family, userPreferences, error: loaderError} = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // --- Preferences Form ---
    const preferencesForm = useForm<PreferencesFormData>({
        resolver: zodResolver(preferencesSchema),
        defaultValues: {
            intent: 'updatePreferences',
            receiveMarketingEmails: userPreferences?.receiveMarketingEmails ?? true
        }
    });

    // Reset form when action completes
    useEffect(() => {
        if (actionData?.intent === 'updatePreferences' && actionData.status === 'success') {
            preferencesForm.reset();
        }
    }, [actionData, preferencesForm]);

    // --- Family Form ---
    const familyForm = useForm<FamilyFormData>({
        resolver: zodResolver(familySchema),
        // Initialize with empty/default values, not directly from loader data
        defaultValues: {
            intent: 'updateFamily',
            name: '',
            address: '',
            city: '',
            province: '',
            postal_code: '',
            primary_phone: '',
            email: '',
            referral_source: '',
            referral_name: '',
            emergency_contact: '',
            health_info: '',
            notes: '',
        },
    });

    // Reset form with loader data on client side
    useEffect(() => {
        if (!familyForm) return;
        if (family) {
            familyForm.reset({
                intent: 'updateFamily',
                name: getDefaultValue(family.name),
                address: getDefaultValue(family.address),
                city: getDefaultValue(family.city),
                province: getDefaultValue(family.province),
                postal_code: getDefaultValue(family.postal_code),
                primary_phone: getDefaultValue(family.primary_phone),
                email: getDefaultValue(family.email),
                referral_source: getDefaultValue(family.referral_source),
                referral_name: getDefaultValue(family.referral_name),
                emergency_contact: getDefaultValue(family.emergency_contact),
                health_info: getDefaultValue(family.health_info),
                notes: getDefaultValue(family.notes),
            });
        }
    }, [family, familyForm]); // Dependency array ensures this runs when family data is available

    // --- Guardian Forms (one for each guardian) ---
    // We need a way to manage multiple forms. We can create them dynamically.
    // This example assumes you might have multiple guardians and creates a form instance for each.
    // Note: Managing dynamic forms with react-hook-form can get complex.
    // Removed comment about dynamic guardian forms

    if (loaderError) {
        return <div className="text-red-500 p-4">Error loading account settings: {loaderError}</div>;
    }
    if (!family) {
        return <div className="text-orange-500 p-4">Could not load family details. Please try again later or contact
            support.</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <AppBreadcrumb items={breadcrumbPatterns.familyAccount()} className="mb-6" />

            <ClientOnly fallback={<div className="text-center p-8">Loading account settings...</div>}>
                {() => (
                    <> {/* Use fragment to avoid adding extra div */}
                        <h1 className="text-3xl font-bold mb-6">Account Settings</h1>

                        {/* General Action Feedback */}
                        {actionData && actionData.status === 'success' && (
                            <Alert variant="default"
                                   className="bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700">
                                <AlertTitle className="text-green-800 dark:text-green-200">Success!</AlertTitle>
                                <AlertDescription className="text-green-700 dark:text-green-300">
                                    {actionData.message}
                                </AlertDescription>
                            </Alert>
                        )}
                        {actionData && actionData.status === 'error' && !actionData.errors && ( // Show general errors only if no field errors
                            <Alert variant="destructive">
                                <AlertTitle className="dark:text-red-200">Error</AlertTitle>
                                <AlertDescription className="dark:text-red-300">{actionData.message}</AlertDescription>
                            </Alert>
                        )}


                        {/* --- Family Information Form --- */}
                        <UIForm {...familyForm}>
                            <Form method="post" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
                                <h2 className="text-xl font-semibold mb-4 border-b pb-2">Family Information</h2>
                                <input type="hidden" name="intent" value="updateFamily"/>

                                {/* Display field-specific errors for family form */}
                                {actionData?.intent === 'updateFamily' && actionData.errors && (
                                    <Alert variant="destructive" className="mb-4">
                                        <AlertTitle className="text-green-800 dark:text-green-200">Validation
                                            Errors</AlertTitle>
                                        <AlertDescription className="text-green-700 dark:text-green-300">
                                            <ul className="list-disc pl-5">
                                                {/* Use the SerializedZodIssue type */}
                                                {actionData.errors.map((err: SerializedZodIssue, i: number) => <li
                                                    key={i}>{err.path.join('.')} : {err.message}</li>)}
                                            </ul>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={familyForm.control}
                                        name="name"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Family Last Name</FormLabel>
                                                <FormControl><Input {...field} autoComplete="family-name" className="input-custom-styles" tabIndex={1}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={familyForm.control}
                                        name="primary_phone"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Primary Phone</FormLabel>
                                                <FormControl><Input type="tel" {...field} autoComplete="tel" className="input-custom-styles" tabIndex={2}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={familyForm.control}
                                        name="email"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Family Email</FormLabel>
                                                <FormControl><Input type="email" {...field} autoComplete="email" className="input-custom-styles" tabIndex={3}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={familyForm.control}
                                        name="address"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Home Address</FormLabel>
                                                <FormControl><Input {...field} autoComplete="street-address" className="input-custom-styles" tabIndex={4}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={familyForm.control}
                                        name="city"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>City</FormLabel>
                                                <FormControl><Input {...field} autoComplete="address-level2" className="input-custom-styles" tabIndex={5}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={familyForm.control}
                                        name="province"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Province</FormLabel>
                                                {/* Wrap Select with ClientOnly */}
                                                <ClientOnly fallback={<Input disabled placeholder="Province..." className="input-custom-styles"/>}>
                                                    {() => (
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value} // Use field.value directly
                                                            // Remove defaultValue
                                                        >
                                                            <FormControl>
                                                                {/* Applied input-custom-styles for consistency */}
                                                                <SelectTrigger className="input-custom-styles" tabIndex={6}><SelectValue
                                                                    placeholder="Select province"/></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {/* Use provinces from siteConfig */}
                                                                {siteConfig.provinces.map((prov) => (
                                                                    <SelectItem key={prov.value} value={prov.value}>
                                                                        {prov.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </ClientOnly>
                                                {/* Add hidden input to ensure value is submitted with form */}
                                                <input
                                                    type="hidden"
                                                    name="province"
                                                    value={field.value || ''}
                                                />
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={familyForm.control}
                                        name="postal_code"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Postal Code</FormLabel>
                                                <FormControl><Input {...field} autoComplete="postal-code" className="input-custom-styles" tabIndex={7}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    {/* Optional Fields */}
                                    <FormField
                                        control={familyForm.control}
                                        name="emergency_contact"
                                        render={({field}) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Emergency Contact (Not Guardian 1 or 2)</FormLabel>
                                                <FormControl><Textarea {...field}
                                                                       value={getDefaultValue(field.value)} className="input-custom-styles" tabIndex={8}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={familyForm.control}
                                        name="health_info"
                                        render={({field}) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Personal Health Number / Info</FormLabel>
                                                {/* Removed duplicated FormItem and FormLabel */}
                                                <FormControl><Textarea {...field}
                                                                       value={getDefaultValue(field.value)} className="input-custom-styles" tabIndex={9}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={familyForm.control}
                                        name="emergency_contact"
                                        render={({field}) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Emergency Contact (Not Guardian 1 or 2)</FormLabel>
                                                <FormControl><Textarea {...field}
                                                                       value={getDefaultValue(field.value)} className="input-custom-styles" tabIndex={10}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={familyForm.control}
                                        name="notes"
                                        render={({field}) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Family Notes (Internal Use)</FormLabel>
                                                {/* Removed duplicated FormItem and FormLabel */}
                                                <FormControl><Textarea {...field}
                                                                       value={getDefaultValue(field.value)} className="input-custom-styles" tabIndex={11}/></FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Button type="submit" disabled={isSubmitting} tabIndex={12}>
                                    {isSubmitting && navigation.formData?.get('intent') === 'updateFamily' ? 'Saving...' : 'Update Family Info'}
                                </Button>
                            </Form>
                        </UIForm>

                        {/* Policy Agreements section removed */}

                        {/* --- Guardian Information Forms (Removed) --- */}


                        {/* --- Account Preferences --- */}
                        <UIForm {...preferencesForm}>
                            <Form method="post" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
                                <h2 className="text-xl font-semibold mb-4">Account Preferences</h2>
                                <input type="hidden" name="intent" value="updatePreferences"/>

                                {actionData?.intent === 'updatePreferences' && actionData.errors && (
                                    <Alert variant="destructive" className="mb-4">
                                        <AlertTitle>Validation Errors</AlertTitle>
                                        <AlertDescription>
                                            <ul className="list-disc pl-5">
                                                {actionData.errors.map((err, i) =>
                                                    <li key={i}>{err.path.join('.')} : {err.message}</li>
                                                )}
                                            </ul>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={preferencesForm.control}
                                        name="currentPassword"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Current Password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} autoComplete="current-password" className="input-custom-styles" tabIndex={13}/>
                                                </FormControl>
                                                <FormMessage/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={preferencesForm.control}
                                        name="newPassword"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>New Password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} autoComplete="new-password" className="input-custom-styles" tabIndex={14}/>
                                                </FormControl>
                                                <FormMessage/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormMessage className="text-sm text-muted-foreground mt-1">
                                        Password must be at least 8 characters and contain uppercase, lowercase, and
                                        number.
                                    </FormMessage>

                                    <FormField
                                        control={preferencesForm.control}
                                        name="confirmPassword"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Confirm Password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} autoComplete="new-password" className="input-custom-styles" tabIndex={15}/>
                                                </FormControl>
                                                <FormMessage/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={preferencesForm.control}
                                        name="receiveMarketingEmails"
                                        render={({field}) => (
                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-4">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        tabIndex={16}
                                                    />
                                                </FormControl>
                                                <div className="space-y-1 leading-none">
                                                    <FormLabel>
                                                        Receive marketing emails
                                                    </FormLabel>
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    tabIndex={17}
                                >
                                    {isSubmitting && navigation.formData?.get('intent') === 'updatePreferences'
                                        ? 'Saving...'
                                        : 'Update Preferences'}
                                </Button>
                            </Form>
                        </UIForm>

                        {/* --- Notification Settings --- */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
                            <h2 className="text-xl font-semibold mb-4">Notification Settings</h2>
                            <NotificationSettings />
                        </div>
                    </>
                )}
            </ClientOnly>
        </div>
    );
}

// --- Guardian Form Component (Removed) ---
