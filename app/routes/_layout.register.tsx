// Removed unused useState import
import {Form, isRouteErrorResponse, Link, Outlet, useActionData, useLocation, useRouteError} from "@remix-run/react"; // Import Outlet and useLocation
import type {ActionFunctionArgs} from "@remix-run/node"; // or cloudflare/deno
import {json, redirect} from "@remix-run/node"; // or cloudflare/deno
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Checkbox} from "~/components/ui/checkbox";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { siteConfig } from "~/config/site";
// Removed unused BELT_RANKS import

// Action function to handle form submission
export async function action({request}: ActionFunctionArgs) {
    const formData = await request.formData();
    // console.log(formData);
    const {supabaseServer} = getSupabaseServerClient(request);

    // Validate matching emails and passwords
    const contact1Email = formData.get('contact1Email') as string;
    const portalPassword = formData.get('portalPassword') as string;
    const portalPasswordConfirm = formData.get('portalPasswordConfirm') as string;
    const referralSource = formData.get('referralSource') as string;
    const familyName = formData.get('familyName') as string;
    const address = formData.get('address') as string;
    const city = formData.get('city') as string;
    const province = formData.get('province') as string;
    const postalCode = formData.get('postalCode') as string;
    const primaryPhone = formData.get('primaryPhone') as string;
    const contact1FirstName = formData.get('contact1FirstName') as string;
    const contact1LastName = formData.get('contact1LastName') as string;
    const contact1Type = formData.get('contact1Type') as string;
    const contact1CellPhone = formData.get('contact1CellPhone') as string;
    const contact1EmailConfirm = formData.get('contact1EmailConfirm') as string;

    // --- Server-Side Validation ---
    const errors: { [key: string]: string } = {};

    const requiredFields = {
        referralSource, familyName, address, city, province, postalCode, primaryPhone,
        contact1FirstName, contact1LastName, contact1Type, contact1CellPhone,
        contact1Email, contact1EmailConfirm, portalPassword, portalPasswordConfirm
    };

    for (const [key, value] of Object.entries(requiredFields)) {
        if (!value || String(value).trim() === '') {
            errors[key] = "This field is required";
        }
    }

    if (contact1Email && contact1EmailConfirm && contact1Email !== contact1EmailConfirm) {
        errors.contact1EmailConfirm = 'Guardian emails do not match';
    }

    if (portalPassword && portalPasswordConfirm && portalPassword !== portalPasswordConfirm) {
        errors.portalPasswordConfirm = 'Passwords do not match';
    }

    if (portalPassword && portalPassword.length < 8) {
        errors.portalPassword = 'Password must be at least 8 characters';
    }

    if (Object.keys(errors).length > 0) {
        return json({ errors, formData: Object.fromEntries(formData) }, { status: 400 });
    }

    try {
        // Create auth user
        console.log('Creating auth user ...', contact1Email);
        // Construct the redirect URL based on the request origin
        const url = new URL(request.url);
        const emailRedirectTo = `${url.origin}/auth/callback`;

        // Get marketing email preference from form
        const receiveMarketing = formData.has('marketingEmails');

        const {data: {user}, error: authError} = await supabaseServer.auth.signUp({
            email: contact1Email,
            password: portalPassword,
            options: {
                // This tells Supabase where to redirect the user after email confirmation
                emailRedirectTo: emailRedirectTo,
                data: {
                    receive_marketing_emails: receiveMarketing // Use form value instead of hardcoded true
                }
            }
        });
        console.log('Auth user created:', user, authError);

        if (authError || !user) throw authError || new Error('User creation failed');

        // Call RPC function to create family, update profile, and create guardian
        const rpcParams = {
            p_user_id: user.id,
            p_family_name: formData.get('familyName') as string,
            p_address: formData.get('address') as string,
            p_city: formData.get('city') as string,
            p_province: formData.get('province') as string,
            p_postal_code: formData.get('postalCode') as string,
            p_primary_phone: formData.get('primaryPhone') as string,
            p_user_email: contact1Email,
            p_referral_source: formData.get('referralSource') as string || '',
            p_referral_name: formData.get('referralName') as string || '',
            p_emergency_contact: formData.get('emergencyContact') as string || '',
            p_health_info: formData.get('healthNumber') as string || '',
            p_contact1_first_name: formData.get('contact1FirstName') as string,
            p_contact1_last_name: formData.get('contact1LastName') as string,
            p_contact1_type: formData.get('contact1Type') as string,
            p_contact1_home_phone: formData.get('contact1HomePhone') as string || '',
            p_contact1_work_phone: formData.get('contact1WorkPhone') as string || '',
            p_contact1_cell_phone: formData.get('contact1CellPhone') as string
        };

        const { data: rpcData, error: rpcError } = await supabaseServer.rpc(
            'complete_new_user_registration',
            rpcParams
        );

        if (rpcError) {
            console.error('Error calling complete_new_user_registration RPC:', rpcError);
            throw rpcError;
        }
        console.log('RPC complete_new_user_registration successful, family_id:', rpcData);

        // Waiver signatures will be handled in a separate dedicated flow.
        // Students will be added via the family portal after registration.

        return redirect('/register/success');

    } catch (error) {
        console.error('Registration error:', error);
        // Ensure error is an instance of Error for consistent message property
        const errorMessage = error instanceof Error ? error.message : String(error);
        return json({
            error: errorMessage, // Use the processed error message
            formData: Object.fromEntries(formData)
        }, {status: 500});
    }
}


export default function RegisterPage() {
    const actionData = useActionData<typeof action>();
    const errors = actionData && "errors" in actionData ? actionData.errors : null;
    const error = actionData && "error" in actionData ? actionData.error : null;
    // Removed multi-step state: const [currentStep, setCurrentStep] = useState(1);
    // Removed state used for pre-filling: const [familyName, setFamilyName] = useState("");
    // Removed state used for pre-filling: const [primaryPhone, setPrimaryPhone] = useState("");

    // Removed multi-step functions: nextStep, prevStep

    const location = useLocation(); // Get the current location

    // Determine if we are on the base /register route or a child route
    const isBaseRegisterRoute = location.pathname === '/register';

    return (
        <div className="min-h-screen bg-amber-50 dark:bg-gray-800 py-12 text-foreground">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {isBaseRegisterRoute ? (
                    // Render the multi-step form only on /register
                    <div
                        className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md backdrop-blur-lg border dark:border-gray-700">
                        {/* Stack vertically on mobile, row on sm+, adjust spacing/alignment */}
                        <div className="flex flex-col items-start space-y-2 mb-6 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                            <h1 className="text-3xl font-bold text-green-600 dark:text-green-400">Registration</h1>
                            <Link to="/login"
                                  className="text-sm text-green-600 dark:text-green-400 hover:underline hover:text-green-700 dark:hover:text-green-300 sm:text-base">
                                Already a customer? Click here to login.
                            </Link>
                        </div>

                        <div
                            className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md text-center">
                            <p className="font-semibold text-green-800 dark:text-green-200">Your first class is a <span
                                className="font-bold">{siteConfig.pricing.freeTrial}</span>!</p>
                        </div>

                        <p className="mb-6 text-muted-foreground">
                            Welcome to Karate Greenegin! We are so excited to meet your performer and
                            family! Please complete the following registration form. Afterwards you will be able to
                            enroll in the classes of your choice!
                        </p>

                        {/* Removed Step Indicator */}

                        <Form method="post" noValidate className="space-y-8">
                            {/* Form sections are now rendered sequentially */}
                            <div> {/* Wrap sections for structure if needed */}
                                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">REFERRAL
                                    INFORMATION</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label htmlFor="referralSource" className="text-sm font-medium mb-1">
                                            How did you hear about us?<span className="text-red-500">*</span>
                                        </Label>
                                        <Select name="referralSource" required>
                                            <SelectTrigger id="referralSource"
                                                           className={`input-custom-styles w-full ${errors?.referralSource ? 'border-red-500' : ''}`}> {/* Applied custom style, removed redundant */}
                                                <SelectValue placeholder="Select an option"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="friend">Friend</SelectItem>
                                                <SelectItem value="social">Social Media</SelectItem>
                                                <SelectItem value="search">Search Engine</SelectItem>
                                                <SelectItem value="flyer">Flyer</SelectItem>
                                                <SelectItem value="event">Event</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {errors?.referralSource && (
                                            <p className="text-red-500 text-sm mt-1">{errors.referralSource}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="referralName" className="text-sm font-medium mb-1">
                                            Referral Name
                                        </Label>
                                        <Input
                                            type="text"
                                            id="referralName"
                                            name="referralName"
                                            className="input-custom-styles"
                                        />
                                    </div>
                                </div>

                                <h2 className="text-xl font-semibold text-foreground mt-8 mb-4 pb-2 border-b border-border">FAMILY
                                    INFORMATION</h2>
                                <div>
                                    <Label htmlFor="familyName" className="text-sm font-medium mb-1">
                                        Family Last Name<span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="text"
                                        id="familyName"
                                        name="familyName"
                                        required
                                        className={`input-custom-styles ${errors?.familyName ? 'border-red-500' : ''}`}
                                    />
                                    {errors?.familyName && (
                                        <p className="text-red-500 text-sm mt-1">{errors.familyName}</p>
                                    )}
                                </div>

                                <h2 className="text-xl font-semibold text-foreground mt-8 mb-4 pb-2 border-b border-border">WHERE
                                    DO YOU LIVE?</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <Label htmlFor="address" className="text-sm font-medium mb-1">
                                            Home Address<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="text"
                                            id="address"
                                            name="address"
                                            required
                                            className={`input-custom-styles ${errors?.address ? 'border-red-500' : ''}`}
                                        />
                                        {errors?.address && (
                                            <p className="text-red-500 text-sm mt-1">{errors.address}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="city" className="text-sm font-medium mb-1">
                                            City<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="text"
                                            id="city"
                                            name="city"
                                            required
                                            className={`input-custom-styles ${errors?.city ? 'border-red-500' : ''}`}
                                        />
                                        {errors?.city && (
                                            <p className="text-red-500 text-sm mt-1">{errors.city}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="province" className="text-sm font-medium mb-1">
                                            Province<span className="text-red-500">*</span>
                                        </Label>
                                        <Select name="province" required>
                                            <SelectTrigger id="province"
                                                           className={`input-custom-styles w-full ${errors?.province ? 'border-red-500' : ''}`}> {/* Applied custom style, removed redundant */}
                                                <SelectValue placeholder="Select a province"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {/* Use provinces from siteConfig */}
                                                {siteConfig.provinces.map((prov) => (
                                                    <SelectItem key={prov.value} value={prov.value}>
                                                        {prov.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors?.province && (
                                            <p className="text-red-500 text-sm mt-1">{errors.province}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="postalCode" className="text-sm font-medium mb-1">
                                            Postal Code<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="text"
                                            id="postalCode"
                                            name="postalCode"
                                            required
                                            className={`input-custom-styles ${errors?.postalCode ? 'border-red-500' : ''}`}
                                        />
                                        {errors?.postalCode && (
                                            <p className="text-red-500 text-sm mt-1">{errors.postalCode}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="primaryPhone" className="text-sm font-medium mb-1">
                                            Primary Phone<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="tel"
                                            id="primaryPhone"
                                            name="primaryPhone"
                                            required
                                            className={`input-custom-styles ${errors?.primaryPhone ? 'border-red-500' : ''}`}
                                        />
                                        {errors?.primaryPhone && (
                                            <p className="text-red-500 text-sm mt-1">{errors.primaryPhone}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Removed "Continue" button for Step 1 */}
                            </div>

                            {/* Step 2: Additional Info & Contact 1 (Now part of the main flow) */}
                            <div>
                                <h2 className="text-xl font-semibold text-foreground mt-8 mb-4 pb-2 border-b border-border">ADDITIONAL
                                    INFO</h2>
                                <div className="space-y-6">
                                    <div>
                                        <Label htmlFor="emergencyContact" className="text-sm font-medium mb-1">
                                            Emergency Contact Info {/* Removed required asterisk */}
                                        </Label>
                                        <Textarea
                                            id="emergencyContact"
                                            name="emergencyContact"
                                            required
                                            rows={3}
                                            className="input-custom-styles" // Removed redundant focus/dark styles
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="healthNumber" className="text-sm font-medium mb-1">
                                            Personal Health Number
                                        </Label>
                                        <Textarea
                                            id="healthNumber"
                                            name="healthNumber"
                                            rows={3}
                                            className="input-custom-styles" // Applied custom style
                                        />
                                    </div>
                                </div>

                                <h2 className="text-xl font-semibold text-foreground mt-8 mb-4 pb-2 border-b border-border">Primary
                                    Guardian</h2>
                                <p className="text-sm text-muted-foreground mb-4 -mt-3">
                                    This is the main contact for the family. You can add additional guardians later via the family portal.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <Label htmlFor="contact1FirstName" className="block text-sm font-medium mb-1">
                                            First Name<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="text"
                                            id="contact1FirstName"
                                            name="contact1FirstName"
                                            required
                                            className={`input-custom-styles ${errors?.contact1FirstName ? 'border-red-500' : ''}`}
                                        />
                                        {errors?.contact1FirstName && (
                                            <p className="text-red-500 text-sm mt-1">{errors.contact1FirstName}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="contact1LastName" className="block text-sm font-medium mb-1">
                                            Last Name<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="text"
                                            id="contact1LastName"
                                            name="contact1LastName"
                                            required
                                            // Removed defaultValue={familyName}
                                            className={`input-custom-styles ${errors?.contact1LastName ? 'border-red-500' : ''}`}
                                        />
                                        {errors?.contact1LastName && (
                                            <p className="text-red-500 text-sm mt-1">{errors.contact1LastName}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="contact1Type" className="block text-sm font-medium mb-1">
                                            Type<span className="text-red-500">*</span>
                                        </Label>
                                        <Select name="contact1Type" required>
                                            <SelectTrigger id="contact1Type"
                                                           className={`input-custom-styles w-full ${errors?.contact1Type ? 'border-red-500' : ''}`}> {/* Applied custom style, removed redundant */}
                                                <SelectValue placeholder="Select relationship"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Mother">Mother</SelectItem>
                                                <SelectItem value="Father">Father</SelectItem>
                                                <SelectItem value="Guardian">Guardian</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {errors?.contact1Type && (
                                            <p className="text-red-500 text-sm mt-1">{errors.contact1Type}</p>
                                        )}
                                    </div>
                                </div>

                                <h3 className="text-lg font-medium text-foreground mt-6 mb-3">HOW CAN WE CONTACT
                                    YOU?</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <Label htmlFor="contact1HomePhone" className="block text-sm font-medium mb-1">
                                            Home Phone
                                        </Label>
                                        <Input
                                            type="tel"
                                            id="contact1HomePhone"
                                            name="contact1HomePhone"
                                            //required
                                            // Removed defaultValue={primaryPhone}
                                            className={`input-custom-styles ${errors?.contact1HomePhone ? 'border-red-500' : ''}`}
                                        />
                                        {errors?.contact1HomePhone && (
                                            <p className="text-red-500 text-sm mt-1">{errors.contact1HomePhone}</p>
                                        )}
                                    </div>
                                  
                                    {/* Removed Work Phone Input */}

                                    <div>
                                        <Label htmlFor="contact1CellPhone" className="block text-sm font-medium mb-1">
                                            Cell Phone<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="tel"
                                            id="contact1CellPhone"
                                            name="contact1CellPhone"
                                            required
                                            className={`input-custom-styles ${errors?.contact1CellPhone ? 'border-red-500' : ''}`}
                                        />
                                        {errors?.contact1CellPhone && (
                                            <p className="text-red-500 text-sm mt-1">{errors.contact1CellPhone}</p>
                                        )}
                                    </div>
                                </div>

                                <h3 className="text-lg font-medium text-foreground mt-6 mb-3">PORTAL ACCESS (YOUR EMAIL
                                    IS YOUR LOGIN)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label htmlFor="contact1Email" className="block text-sm font-medium mb-1">
                                            Email<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="email"
                                            id="contact1Email"
                                            name="contact1Email"
                                            required
                                            autoComplete="username" // Added autocomplete attribute
                                            className={`input-custom-styles ${errors?.contact1Email ? 'border-red-500' : ''}`}
                                        />
                                        {errors?.contact1Email && (
                                            <p className="text-red-500 text-sm mt-1">{errors.contact1Email}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">(Emails are kept
                                            confidential)</p>
                                    </div>

                                    <div>
                                        <Label htmlFor="contact1EmailConfirm"
                                               className="block text-sm font-medium mb-1">
                                            Confirm Email<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="email"
                                            id="contact1EmailConfirm"
                                            name="contact1EmailConfirm"
                                            required
                                            className={`input-custom-styles ${errors?.contact1EmailConfirm ? 'border-red-500' : ''}`}
                                        />
                                        {errors?.contact1EmailConfirm && (
                                            <p className="text-red-500 text-sm mt-1">{errors.contact1EmailConfirm}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="portalPassword" className="block text-sm font-medium mb-1">
                                            Portal Account Password
                                        </Label>
                                        <Input
                                            type="password"
                                            id="portalPassword"
                                            name="portalPassword"
                                            minLength={8}
                                            autoComplete="new-password" // Added autocomplete attribute
                                            className={`input-custom-styles ${errors?.portalPassword ? 'border-red-500' : ''}`}
                                        />
                                        {errors?.portalPassword && (
                                            <p className="text-red-500 text-sm mt-1">{errors.portalPassword}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">Minimum number of characters
                                            is 8</p>
                                    </div>

                                    <div>
                                        <Label htmlFor="portalPasswordConfirm"
                                               className="block text-sm font-medium mb-1">
                                            Confirm Portal Account Password
                                        </Label>
                                        <Input
                                            type="password"
                                            id="portalPasswordConfirm"
                                            name="portalPasswordConfirm"
                                            minLength={8}
                                            autoComplete="new-password" // Added autocomplete attribute
                                            className={`input-custom-styles ${errors?.portalPasswordConfirm ? 'border-red-500' : ''}`}
                                        />
                                        {errors?.portalPasswordConfirm && (
                                            <p className="text-red-500 text-sm mt-1">{errors.portalPasswordConfirm}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">Minimum number of characters
                                            is 8</p>
                                    </div>
                                </div>

                                <div className="md:col-span-2 mt-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="marketingEmails"
                                            name="marketingEmails"
                                            defaultChecked={true}
                                            className="dark:border-gray-400 dark:data-[state=checked]:bg-green-400"
                                        />
                                        <Label htmlFor="marketingEmails" className="text-sm font-medium">
                                            I want to receive promotional emails and updates
                                        </Label>
                                    </div>
                                    <p className="text-muted-foreground text-sm mt-1 ml-6">
                                        You can change this preference anytime in your account settings
                                    </p>
                                </div>

                                {/* Removed Employer Section for Guardian 1 */}
                                {/* Removed Back/Continue buttons for Step 2 */}
                            </div>

                            {/* Step 3: Contact 2 (Removed) */}

                            {/* Final Submit Button */}
                            <div className="mt-8">
                                <Button
                                    type="submit"
                                    className="w-full font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700"
                                >
                                    SUBMIT REGISTRATION
                                </Button>
                            </div>

                            {/* Display Action Error (if any) */}
                            {error && (
                                <div
                                    className="text-red-500 text-sm mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                    Error: {error}
                                </div>
                            )}

                        </Form>
                    </div>
                ) : (
                    // Render the Outlet for child routes like /register/success
                    <Outlet/>
                )}
            </div>
        </div>
    );
}

// Error Boundary for the registration route
export function ErrorBoundary() {
    const error = useRouteError();

    // Log the error to the console
    console.error("Registration Route Error:", error);

    let title = "An Unexpected Error Occurred";
    let message = "We encountered an unexpected issue. Please try again later.";
    let status = 500;

    if (isRouteErrorResponse(error)) {
        title = `${error.status} ${error.statusText}`;
        message = error.data?.message || error.data || "An error occurred processing your request.";
        status = error.status;
    } else if (error instanceof Error) {
        // Keep generic message for users, but we logged the specific error
        message = error.message; // Or keep the generic message above
    }

    return (
        <div
            className="min-h-screen bg-amber-50 dark:bg-gray-800 py-12 text-foreground flex items-center justify-center">
            <div className="max-w-md w-full mx-auto px-4 sm:px-6 lg:px-8">
                <Alert variant="destructive"
                       className="bg-white dark:bg-gray-800 shadow-md border dark:border-gray-700">
                    <AlertTitle className="text-lg font-bold">{title}</AlertTitle>
                    <AlertDescription className="mt-2">
                        {message}
                        {status === 405 &&
                            <p className="mt-2 text-sm">It seems there was an issue submitting the form. Please check
                                the form and try again.</p>}
                    </AlertDescription>
                    <div className="mt-4">
                        <Button asChild variant="outline">
                            <Link to="/register">Go back to Registration</Link>
                        </Button>
                    </div>
                </Alert>
            </div>
        </div>
    );
}
