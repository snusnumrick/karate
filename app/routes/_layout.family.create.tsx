import {Form, useActionData, useLoaderData, useNavigation} from "@remix-run/react";
import {json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs} from "@remix-run/node";
import {AuthenticityTokenInput} from "remix-utils/csrf/react";
import {csrf} from "~/utils/csrf.server";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {siteConfig} from "~/config/site";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "~/components/ui/select";
import {Textarea} from "~/components/ui/textarea";
import {Checkbox} from "~/components/ui/checkbox";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {SubmitButtonWithLoading} from "~/components/SubmitButtonWithLoading";
import {FormLoadingOverlay} from "~/components/FormLoadingOverlay";

interface LoaderData {
    provinces: typeof siteConfig.provinces;
}

interface ActionData {
    errors?: Record<string, string>;
    error?: string;
}

export async function loader({request}: LoaderFunctionArgs) {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return redirect(`/login?redirectTo=${encodeURIComponent('/family/create')}`);
    }

    const {data: profile, error} = await supabaseServer
        .from('profiles')
        .select('family_id, role')
        .eq('id', user.id)
        .single();

    if (error || !profile) {
        console.error('Unable to load profile for family creation:', error?.message);
        return json({provinces: siteConfig.provinces}, {status: 500, headers});
    }

    if (profile.role === 'admin') {
        return redirect('/admin', {headers});
    }

    if (profile.role === 'instructor') {
        return redirect('/instructor', {headers});
    }

    if (profile.family_id) {
        return redirect('/family', {headers});
    }

    return json<LoaderData>({
        provinces: siteConfig.provinces,
    }, {headers});
}

export async function action({request}: ActionFunctionArgs) {
    try {
        await csrf.validate(request);
    } catch (error) {
        console.error('CSRF validation failed for family create:', error);
        return json<ActionData>({errors: {_form: 'Security validation failed. Please refresh and try again.'}}, {status: 403});
    }

    const formData = await request.formData();
    const receiveMarketing = formData.get('marketingEmails') === 'on';

    const requiredFields = [
        'familyName',
        'address',
        'city',
        'province',
        'postalCode',
        'primaryPhone',
        'contact1FirstName',
        'contact1LastName',
        'contact1Type',
        'contact1CellPhone',
    ];

    const errors: Record<string, string> = {};
    for (const field of requiredFields) {
        const value = formData.get(field);
        if (!value || String(value).trim() === '') {
            errors[field] = 'This field is required';
        }
    }

    const postalCode = formData.get('postalCode');
    if (postalCode && String(postalCode).length < 6) {
        errors.postalCode = 'Please enter a valid postal code';
    }

    if (Object.keys(errors).length > 0) {
        return json<ActionData>({errors}, {status: 400});
    }

    const {supabaseServer} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return redirect(`/login?redirectTo=${encodeURIComponent('/family/create')}`);
    }

    try {
        // Note: Parameter order changed in migration 031 - required params first, then optional
        const rpcParams = {
            // Required parameters
            p_user_id: user.id,
            p_family_name: formData.get('familyName') as string,
            p_postal_code: formData.get('postalCode') as string,
            p_primary_phone: formData.get('primaryPhone') as string,
            p_user_email: user.email ?? '',
            // Optional parameters (must be undefined, not empty string, to pass DB constraints)
            p_address: (formData.get('address') as string) || undefined,
            p_city: (formData.get('city') as string) || undefined,
            p_province: (formData.get('province') as string) || undefined,
            p_referral_source: (formData.get('referralSource') as string) || undefined,
            p_referral_name: (formData.get('referralName') as string) || undefined,
            p_emergency_contact: (formData.get('emergencyContact') as string) || undefined,
            p_health_info: (formData.get('healthInfo') as string) || undefined,
            p_contact1_first_name: formData.get('contact1FirstName') as string,
            p_contact1_last_name: formData.get('contact1LastName') as string,
            p_contact1_type: formData.get('contact1Type') as string,
            p_contact1_home_phone: (formData.get('contact1HomePhone') as string) || undefined,
            p_contact1_work_phone: (formData.get('contact1WorkPhone') as string) || undefined,
            p_contact1_cell_phone: formData.get('contact1CellPhone') as string,
        };

        const {error: rpcError} = await supabaseServer.rpc('complete_new_user_registration', rpcParams);

        if (rpcError) {
            console.error('complete_new_user_registration failed:', rpcError);
            return json<ActionData>({error: 'Something went wrong while creating your family. Please try again.'}, {status: 500});
        }

        await supabaseServer.auth.updateUser({
            data: {receive_marketing_emails: receiveMarketing},
        });

        return redirect('/family');
    } catch (error) {
        console.error('Family creation error:', error);
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        return json<ActionData>({error: message}, {status: 500});
    }
}

export default function FamilyCreatePage() {
    const {provinces} = useLoaderData<typeof loader>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const errors = actionData?.errors ?? {};
    const formError = actionData?.error ?? errors?._form;

    // Detect form submission state
    const isSubmitting = navigation.state === 'submitting';

    return (
        <div className="min-h-screen page-background-styles py-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-10 text-center space-y-3">
                    <h1 className="text-3xl font-extrabold text-primary-700 dark:text-primary-300">Set up your family account</h1>
                    <p className="text-lg text-muted-foreground">
                        Provide a few details so we can connect your profile to the family dashboard.
                    </p>
                </div>

                {formError && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertTitle>We couldn&apos;t finish setting up your family</AlertTitle>
                        <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                )}

                <Form method="post" className="space-y-8 form-container-styles p-8">
                    <AuthenticityTokenInput />

                    <section className="space-y-4">
                        <h2 className="text-xl font-semibold text-foreground">Family details</h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="familyName">Family name</Label>
                                <Input id="familyName" name="familyName" required aria-invalid={Boolean(errors.familyName)} />
                                {errors.familyName && <p className="text-sm text-destructive">{errors.familyName}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="primaryPhone">Primary phone</Label>
                                <Input id="primaryPhone" name="primaryPhone" required aria-invalid={Boolean(errors.primaryPhone)} />
                                {errors.primaryPhone && <p className="text-sm text-destructive">{errors.primaryPhone}</p>}
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <Input id="address" name="address" required aria-invalid={Boolean(errors.address)} />
                                {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city">City</Label>
                                <Input id="city" name="city" required aria-invalid={Boolean(errors.city)} />
                                {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="province">Province</Label>
                                <Select name="province" required>
                                    <SelectTrigger id="province" aria-invalid={Boolean(errors.province)}>
                                        <SelectValue placeholder="Select province" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {provinces.map((province) => (
                                            <SelectItem key={province.value} value={province.value}>
                                                {province.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.province && <p className="text-sm text-destructive">{errors.province}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="postalCode">Postal code</Label>
                                <Input id="postalCode" name="postalCode" required aria-invalid={Boolean(errors.postalCode)} />
                                {errors.postalCode && <p className="text-sm text-destructive">{errors.postalCode}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="referralSource">How did you hear about us?</Label>
                                <Input id="referralSource" name="referralSource" />
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="referralName">Referred by (optional)</Label>
                                <Input id="referralName" name="referralName" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="emergencyContact">Emergency contact (optional)</Label>
                                <Input id="emergencyContact" name="emergencyContact" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="healthInfo">Relevant medical notes (optional)</Label>
                            <Textarea id="healthInfo" name="healthInfo" rows={3} />
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-semibold text-foreground">Primary guardian</h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="contact1FirstName">First name</Label>
                                <Input id="contact1FirstName" name="contact1FirstName" required aria-invalid={Boolean(errors.contact1FirstName)} />
                                {errors.contact1FirstName && <p className="text-sm text-destructive">{errors.contact1FirstName}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact1LastName">Last name</Label>
                                <Input id="contact1LastName" name="contact1LastName" required aria-invalid={Boolean(errors.contact1LastName)} />
                                {errors.contact1LastName && <p className="text-sm text-destructive">{errors.contact1LastName}</p>}
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="contact1Type">Relationship to student</Label>
                                <Select name="contact1Type" required>
                                    <SelectTrigger id="contact1Type" aria-invalid={Boolean(errors.contact1Type)}>
                                        <SelectValue placeholder="Select relationship" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Parent">Parent</SelectItem>
                                        <SelectItem value="Guardian">Guardian</SelectItem>
                                        <SelectItem value="Grandparent">Grandparent</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.contact1Type && <p className="text-sm text-destructive">{errors.contact1Type}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact1CellPhone">Cell phone</Label>
                                <Input id="contact1CellPhone" name="contact1CellPhone" required aria-invalid={Boolean(errors.contact1CellPhone)} />
                                {errors.contact1CellPhone && <p className="text-sm text-destructive">{errors.contact1CellPhone}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact1HomePhone">Home phone (optional)</Label>
                                <Input id="contact1HomePhone" name="contact1HomePhone" />
                            </div>
                        </div>
                        <div className="space-y-2 md:w-1/3">
                            <Label htmlFor="contact1WorkPhone">Work phone (optional)</Label>
                            <Input id="contact1WorkPhone" name="contact1WorkPhone" />
                        </div>
                    </section>

                    <div className="flex items-center space-x-2">
                        <Checkbox id="marketingEmails" name="marketingEmails" defaultChecked />
                        <Label htmlFor="marketingEmails" className="text-sm text-muted-foreground">
                            Keep me informed about schedule updates and dojo news.
                        </Label>
                    </div>

                    <div className="flex justify-end">
                        <SubmitButtonWithLoading
                            isSubmitting={isSubmitting}
                            defaultText="Create family"
                            loadingText="Setting up your family..."
                            className="px-8"
                        />
                    </div>
                </Form>
            </div>

            {/* Loading Overlay */}
            <FormLoadingOverlay
                isVisible={isSubmitting}
                title="Setting up your family"
                message="We're creating your family account and adding your information. This may take a few moments..."
            />
        </div>
    );
}
