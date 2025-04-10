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
import {Textarea} from "~/components/ui/textarea";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {siteConfig} from "~/config/site";
// Removed unused BELT_RANKS import

// Action function to handle form submission
export async function action({request}: ActionFunctionArgs) {
    const formData = await request.formData();
    // console.log(formData);
    const {supabaseServer} = getSupabaseServerClient(request);

    // Validate matching emails and passwords
    const contact1Email = formData.get('contact1Email') as string;
    const password = formData.get('portalPassword') as string;
    const passwordConfirm = formData.get('portalPasswordConfirm') as string;
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
    const contact1HomePhone = formData.get('contact1HomePhone') as string;
    const contact1CellPhone = formData.get('contact1CellPhone') as string;
    const contact1EmailConfirm = formData.get('contact1EmailConfirm') as string;

    // --- Server-Side Validation ---
    const requiredFields = {
        referralSource, familyName, address, city, province, postalCode, primaryPhone,
        contact1FirstName, contact1LastName, contact1Type, contact1HomePhone, contact1CellPhone,
        contact1Email, contact1EmailConfirm, password, passwordConfirm
    };
    const missingFields = Object.entries(requiredFields)
        .filter(([, value]) => !value || String(value).trim() === '')
        .map(([key]) => key);

    if (missingFields.length > 0) {
        return json({ error: `Missing required fields: ${missingFields.join(', ')}` }, { status: 400 });
    }

    if (contact1Email !== contact1EmailConfirm) {
        return json({ error: 'Guardian emails do not match' }, { status: 400 });
    }

    if (password !== passwordConfirm) {
        return json({error: 'Passwords do not match'}, {status: 400});
    }

    if (password.length < 8) {
        return json({error: 'Password must be at least 8 characters'}, {status: 400});
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
            password,
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

        // Create family record
        const {data: familyData, error: familyError} = await supabaseServer.from('families')
            .insert({
                address: formData.get('address') as string,
                city: formData.get('city') as string,
                province: formData.get('province') as string,
                postal_code: formData.get('postalCode') as string,
                primary_phone: formData.get('primaryPhone') as string,
                email: contact1Email,
                name: formData.get('familyName') as string,
                referral_source: formData.get('referralSource') as string || null,
                referral_name: formData.get('referralName') as string || null,
                emergency_contact: formData.get('emergencyContact') as string || null,
                health_info: formData.get('healthNumber') as string || null
            })
            .select('id')
            .single();

        if (familyError) throw familyError;
        console.log('Family created:', familyData);
        const familyId = familyData.id;

        // Create user profile
        const {data: profileData, error: profileError} = await supabaseServer.from('profiles').insert({
            id: user.id,
            email: contact1Email,
            role: 'user',
            family_id: familyId
        });

        if (profileError) throw profileError;
        console.log('Profile created:', profileData);

        // Process Contact #1
        const contact1FirstName = formData.get('contact1FirstName') as string;
        const contact1LastName = formData.get('contact1LastName') as string;
        // console.log(`Attempting to insert Guardian 1: Name=${contact1FirstName} ${contact1LastName}, Email=${contact1Email}`); // Added logging
        const {data: contact1Data, error: contact1Error} = await supabaseServer.from('guardians').insert({
            family_id: familyId,
            first_name: contact1FirstName as string,
            last_name: contact1LastName as string,
            relationship: formData.get('contact1Type') as string,
            home_phone: formData.get('contact1HomePhone') as string,
            work_phone: formData.get('contact1WorkPhone') as string | null,
            cell_phone: formData.get('contact1CellPhone') as string,
            email: contact1Email as string
            // Removed optional employer fields
            // employer: formData.get('contact1Employer') as string | null,
            // employer_phone: formData.get('contact1EmployerPhone') as string | null,
            // employer_notes: formData.get('contact1EmployerNotes') as string | null
        });

        if (contact1Error) {
            console.error('Error inserting Guardian 1:', contact1Error);
            throw contact1Error;
        }
        console.log('Contact #1 (Registering User) created:', contact1Data);

        // Removed Guardian #2 processing logic

        // Waiver signatures will be handled in a separate dedicated flow.
        // Students will be added via the family portal after registration.

        return redirect('/register/success');

    } catch (error) {
        console.error('Registration error:', error);
        return json({
            error: error instanceof Error ? error.message : 'Registration failed',
            formData: Object.fromEntries(formData)
        }, {status: 500});
    }
}


export default function RegisterPage() {
    const actionData = useActionData<typeof action>();
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
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="text-3xl font-bold text-green-600 dark:text-green-400">Registration</h1>
                            <Link to="/login"
                                  className="text-green-600 dark:text-green-400 hover:underline hover:text-green-700 dark:hover:text-green-300">
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
                                                           className="w-full focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400">
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
                                        className="input-custom-styles"
                                    />
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
                                            className="input-custom-styles"
                                        />
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
                                            className="input-custom-styles"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="province" className="text-sm font-medium mb-1">
                                            Province<span className="text-red-500">*</span>
                                        </Label>
                                        <Select name="province" required>
                                            <SelectTrigger id="province"
                                                           className="w-full focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400">
                                                <SelectValue placeholder="Select a province"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="AB">Alberta</SelectItem>
                                                <SelectItem value="BC">British Columbia</SelectItem>
                                                <SelectItem value="MB">Manitoba</SelectItem>
                                                <SelectItem value="NB">New Brunswick</SelectItem>
                                                <SelectItem value="NL">Newfoundland and Labrador</SelectItem>
                                                <SelectItem value="NS">Nova Scotia</SelectItem>
                                                <SelectItem value="ON">Ontario</SelectItem>
                                                <SelectItem value="PE">Prince Edward Island</SelectItem>
                                                <SelectItem value="QC">Quebec</SelectItem>
                                                <SelectItem value="SK">Saskatchewan</SelectItem>
                                                <SelectItem value="NT">Northwest Territories</SelectItem>
                                                <SelectItem value="NU">Nunavut</SelectItem>
                                                <SelectItem value="YT">Yukon</SelectItem>
                                            </SelectContent>
                                        </Select>
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
                                            className="input-custom-styles"
                                        />
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
                                            className="input-custom-styles"
                                        />
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
                                            className="input-custom-styles focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400" // Added custom style
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
                                            className="input-custom-styles"
                                        />
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
                                            className="input-custom-styles"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="contact1Type" className="block text-sm font-medium mb-1">
                                            Type<span className="text-red-500">*</span>
                                        </Label>
                                        <Select name="contact1Type" required>
                                            <SelectTrigger id="contact1Type"
                                                           className="w-full focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-400">
                                                <SelectValue placeholder="Select relationship"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Mother">Mother</SelectItem>
                                                <SelectItem value="Father">Father</SelectItem>
                                                <SelectItem value="Guardian">Guardian</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <h3 className="text-lg font-medium text-foreground mt-6 mb-3">HOW CAN WE CONTACT
                                    YOU?</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <Label htmlFor="contact1HomePhone" className="block text-sm font-medium mb-1">
                                            Home Phone<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="tel"
                                            id="contact1HomePhone"
                                            name="contact1HomePhone"
                                            required
                                            // Removed defaultValue={primaryPhone}
                                            className="input-custom-styles"
                                        />
                                    </div>

                                    {/* Removed Work Phone Input */}

                                    <div>
                                        <Label htmlFor="contact1CellPhone" className="block text-sm font-medium mb-1">
                                            Cell #<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="tel"
                                            id="contact1CellPhone"
                                            name="contact1CellPhone"
                                            required
                                            className="input-custom-styles"
                                        />
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
                                            className="input-custom-styles"
                                        />
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
                                            className="input-custom-styles"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="portalPassword" className="block text-sm font-medium mb-1">
                                            Portal Account Password
                                        </Label>
                                        <Input
                                            type="password"
                                            id="portalPassword"
                                            name="portalPassword"
                                            minLength={5}
                                            autoComplete="new-password" // Added autocomplete attribute
                                            className="input-custom-styles"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Minimum number of characters
                                            is 5</p>
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
                                            minLength={5}
                                            autoComplete="new-password" // Added autocomplete attribute
                                            className="input-custom-styles"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Minimum number of characters
                                            is 5</p>
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
                            {actionData?.error && (
                                <div
                                    className="text-red-500 text-sm mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                    Error: {actionData.error}
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
