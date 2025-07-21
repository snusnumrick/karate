import {ActionFunctionArgs, json, type LoaderFunctionArgs, TypedResponse} from "@remix-run/node";
import {Form, useActionData, useLoaderData, useNavigation} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Database} from "~/types/database.types";
import {z} from "zod";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Form as UIForm, FormControl, FormField, FormItem, FormLabel, FormMessage} from "~/components/ui/form";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {ClientOnly} from "~/components/client-only";
import {useEffect} from "react";
import {Checkbox} from "~/components/ui/checkbox";
import {AppBreadcrumb} from "~/components/AppBreadcrumb";
import {NotificationSettings} from "~/components/NotificationSettings";

// Define a type for serialized Zod issues (plain objects)
type SerializedZodIssue = {
    path: (string | number)[];
    message: string;
};

// Define Supabase types for easier access
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

// Define expected loader data structure
interface LoaderData {
    profile?: ProfileRow;
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

const profileSchema = z.object({
    intent: z.literal('updateProfile'),
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// Combined schema for parsing intent in action
const formSchema = z.union([
    profileSchema,
    preferencesSchema
]);

// --- Loader ---
export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return json({error: "User not authenticated"}, {status: 401, headers});
    }

    // Fetch profile data
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData) {
        console.error("Error fetching profile for admin account page:", profileError?.message);
        return json({error: "Failed to load user profile."}, {status: 500, headers});
    }

    // Get user preferences from auth metadata
    const userPreferences = {
        receiveMarketingEmails: user.user_metadata?.receive_marketing_emails ?? true
    };

    return json({
        profile: profileData,
        userPreferences
    }, {headers});
}

// --- Action ---
type ActionResponse = {
    status: 'success' | 'error';
    message: string;
    errors?: SerializedZodIssue[];
    intent?: 'updateProfile' | 'updatePreferences';
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
            intent: formData.get('intent') as 'updateProfile' | 'updatePreferences' | undefined,
        }, {status: 400, headers});
    }

    const {data: {user}} = await supabaseServer.auth.getUser();
    if (!user) {
        return json({
            status: 'error',
            message: 'User not authenticated.',
        }, {status: 401, headers});
    }

    const validatedData = parsed.data;

    try {
        if (validatedData.intent === 'updateProfile') {
            // Update profile in database
            const {error: updateError} = await supabaseServer
                .from('profiles')
                .update({
                    first_name: validatedData.first_name,
                    last_name: validatedData.last_name,
                    email: validatedData.email,
                })
                .eq('id', user.id);

            if (updateError) {
                console.error("Error updating profile:", updateError);
                return json({
                    status: 'error',
                    message: 'Failed to update profile.',
                    intent: 'updateProfile'
                }, {status: 500, headers});
            }

            return json({
                status: 'success',
                message: 'Profile updated successfully.',
                intent: 'updateProfile'
            }, {headers});

        } else if (validatedData.intent === 'updatePreferences') {
            // Handle password change if provided
            if (validatedData.newPassword && validatedData.currentPassword) {
                const {error: passwordError} = await supabaseServer.auth.updateUser({
                    password: validatedData.newPassword
                });

                if (passwordError) {
                    console.error("Error updating password:", passwordError);
                    return json({
                        status: 'error',
                        message: 'Failed to update password. Please check your current password.',
                        intent: 'updatePreferences'
                    }, {status: 400, headers});
                }
            }

            // Update user metadata for email preferences
            if (validatedData.receiveMarketingEmails !== undefined) {
                const {error: metadataError} = await supabaseServer.auth.updateUser({
                    data: {
                        receive_marketing_emails: validatedData.receiveMarketingEmails
                    }
                });

                if (metadataError) {
                    console.error("Error updating user metadata:", metadataError);
                    return json({
                        status: 'error',
                        message: 'Failed to update preferences.',
                        intent: 'updatePreferences'
                    }, {status: 500, headers});
                }
            }

            return json({
                status: 'success',
                message: 'Preferences updated successfully.',
                intent: 'updatePreferences'
            }, {headers});
        }

        return json({
            status: 'error',
            message: 'Invalid intent.',
        }, {status: 400, headers});

    } catch (error) {
        console.error("Unexpected error in admin account action:", error);
        return json({
            status: 'error',
            message: 'An unexpected error occurred.',
        }, {status: 500, headers});
    }
}

// Helper function to get default value for form fields
function getDefaultValue(value: string | null | undefined): string {
    return value || '';
}

export default function AdminAccountSettingsPage() {
    const {profile, userPreferences, error: loaderError} = useLoaderData<typeof loader>();
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

    // --- Profile Form ---
    const profileForm = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            intent: 'updateProfile',
            first_name: '',
            last_name: '',
            email: '',
        },
    });

    // Reset form with loader data on client side
    useEffect(() => {
        if (!profileForm) return;
        if (profile) {
            profileForm.reset({
                intent: 'updateProfile',
                first_name: getDefaultValue(profile.first_name),
                last_name: getDefaultValue(profile.last_name),
                email: getDefaultValue(profile.email),
            });
        }
    }, [profile, profileForm]);

    if (loaderError) {
        return <div className="text-red-500 p-4">Error loading account settings: {loaderError}</div>;
    }
    if (!profile) {
        return <div className="text-orange-500 p-4">Could not load profile details. Please try again later or contact support.</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <AppBreadcrumb items={[
                { label: "Admin", href: "/admin" },
                { label: "Account Settings", href: "/admin/account" }
            ]} className="mb-6" />

            <ClientOnly fallback={<div className="text-center p-8">Loading account settings...</div>}>
                {() => (
                    <>
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
                        {actionData && actionData.status === 'error' && !actionData.errors && (
                            <Alert variant="destructive">
                                <AlertTitle className="dark:text-red-200">Error</AlertTitle>
                                <AlertDescription className="dark:text-red-300">{actionData.message}</AlertDescription>
                            </Alert>
                        )}

                        {/* --- Profile Information Form --- */}
                        <UIForm {...profileForm}>
                            <Form method="post" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
                                <h2 className="text-xl font-semibold mb-4 border-b pb-2">Profile Information</h2>
                                <input type="hidden" name="intent" value="updateProfile"/>

                                {/* Display field-specific errors for profile form */}
                                {actionData?.intent === 'updateProfile' && actionData.errors && (
                                    <Alert variant="destructive" className="mb-4">
                                        <AlertTitle>Validation Errors</AlertTitle>
                                        <AlertDescription>
                                            <ul className="list-disc pl-5">
                                                {actionData.errors.map((err: SerializedZodIssue, i: number) => 
                                                    <li key={i}>{err.path.join('.')} : {err.message}</li>
                                                )}
                                            </ul>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={profileForm.control}
                                        name="first_name"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>First Name</FormLabel>
                                                <FormControl>
                                                    <Input {...field} autoComplete="given-name" tabIndex={1}/>
                                                </FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={profileForm.control}
                                        name="last_name"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Last Name</FormLabel>
                                                <FormControl>
                                                    <Input {...field} autoComplete="family-name" tabIndex={2}/>
                                                </FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={profileForm.control}
                                        name="email"
                                        render={({field}) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <Input type="email" {...field} autoComplete="email" tabIndex={3}/>
                                                </FormControl>
                                                <FormMessage className="dark:text-red-400"/>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Button type="submit" disabled={isSubmitting} tabIndex={4}>
                                    {isSubmitting && navigation.formData?.get('intent') === 'updateProfile' ? 'Saving...' : 'Update Profile'}
                                </Button>
                            </Form>
                        </UIForm>

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
                                                    <Input type="password" {...field} autoComplete="current-password" tabIndex={6}/>
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
                                                    <Input type="password" {...field} autoComplete="new-password" tabIndex={7}/>
                                                </FormControl>
                                                <FormMessage/>
                                            </FormItem>
                                        )}
                                    />

                                    <div className="text-sm text-muted-foreground mt-1">
                                        Password must be at least 8 characters and contain uppercase, lowercase, and number.
                                    </div>

                                    <FormField
                                        control={preferencesForm.control}
                                        name="confirmPassword"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Confirm Password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} autoComplete="new-password" tabIndex={8}/>
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
                                                        tabIndex={9}
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
                                    tabIndex={10}
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
