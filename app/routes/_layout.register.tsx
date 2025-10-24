import { useState } from "react";
import {Form, isRouteErrorResponse, Link, Outlet, useActionData, useLoaderData, useLocation, useRouteError, useSearchParams} from "@remix-run/react";
import type {ActionFunctionArgs, LoaderFunctionArgs} from "@remix-run/node";
import {json, redirect} from "@remix-run/node";
import {EventService} from "~/services/event.server";
import {formatDate} from "~/utils/misc";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {AuthenticityTokenInput} from "remix-utils/csrf/react";
import {csrf} from "~/utils/csrf.server";
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Checkbox} from "~/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { siteConfig } from "~/config/site";
import { safeRedirect } from "~/utils/redirect";
import { PasswordStrengthIndicator } from "~/components/PasswordStrengthIndicator";
import { AddressSection, OptionalInfoSection } from "~/components/family-registration";

type ActionData = {
  errors?: {
    _form?: string;
    referralSource?: string;
    familyName?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    primaryPhone?: string;
    contact1FirstName?: string;
    contact1LastName?: string;
    contact1Type?: string;
    contact1CellPhone?: string;
    contact1Email?: string;
    contact1EmailConfirm?: string;
    portalPassword?: string;
    portalPasswordConfirm?: string;
    [key: string]: string | undefined;
  };
  error?: string;
};
// Removed unused BELT_RANKS import

type RegistrationContext = {
  type: 'general' | 'event' | 'class';
  eventDetails?: {
    id: string;
    title: string;
    start_date: string | null;
    location: string | null;
  } | null;
  requiresFullAddress: boolean;
};

type LoaderData = {
  context: RegistrationContext;
  redirectTo: string | null;
};

// Loader function to detect registration context from redirectTo parameter
export async function loader({request}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirectTo');

  const context: RegistrationContext = {
    type: 'general',
    eventDetails: null,
    requiresFullAddress: true
  };

  // Detect event registration
  if (redirectTo?.includes('/events/')) {
    const eventIdMatch = redirectTo.match(/\/events\/([^/]+)/);
    if (eventIdMatch) {
      const eventId = eventIdMatch[1];
      try {
        const event = await EventService.getEventById(eventId, false);
        if (event) {
          context.type = 'event';
          context.eventDetails = {
            id: event.id,
            title: event.title,
            start_date: event.start_date,
            location: event.location
          };
          context.requiresFullAddress = false; // Events don't require full address
        }
      } catch (error) {
        console.error('Failed to fetch event details:', error);
        // Fall back to general context
      }
    }
  }

  // Detect class enrollment
  if (redirectTo?.includes('/classes/')) {
    context.type = 'class';
    context.requiresFullAddress = true; // Classes need full address
  }

  return json<LoaderData>({ context, redirectTo });
}

// Action function to handle form submission
export async function action({request}: ActionFunctionArgs) {
    try {
        // Validate CSRF token
        await csrf.validate(request);
    } catch (error) {
        console.error('CSRF validation failed:', error);
        return json({ errors: { _form: 'Security validation failed. Please try again.' } }, { status: 403 });
    }
    
    const formData = await request.formData();
    const redirectToParam = formData.get('redirectTo') as string | null;
    const {supabaseServer} = getSupabaseServerClient(request);

    // Detect registration context from redirectTo parameter

    // Extract form values
    const contact1Email = formData.get('contact1Email') as string;
    const portalPassword = formData.get('portalPassword') as string;
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

    // --- Context-Aware Server-Side Validation ---
    const errors: { [key: string]: string } = {};

    // Core required fields for ALL registrations (event and general)
    const requiredFields: { [key: string]: string } = {
        contact1FirstName,
        contact1LastName,
        contact1Email,
        portalPassword,
        contact1CellPhone,
        postalCode,
    };

    // Validate required fields
    for (const [key, value] of Object.entries(requiredFields)) {
        if (!value || String(value).trim() === '') {
            errors[key] = "This field is required";
        }
    }

    // Password validation
    if (portalPassword && portalPassword.length < 8) {
        errors.portalPassword = 'Password must be at least 8 characters';
    }

    // Conditional address validation: if any address field is provided, all must be provided
    const hasAnyAddressField = !!(address || city || province);
    if (hasAnyAddressField) {
        if (!address || address.trim() === '') {
            errors.address = 'Address is required if providing address details';
        }
        if (!city || city.trim() === '') {
            errors.city = 'City is required if providing address details';
        }
        if (!province || province.trim() === '') {
            errors.province = 'Province is required if providing address details';
        }
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
        // For event context, use last name as family name and cell phone as primary
        // Note: Parameter order changed in migration 031 - required params first, then optional
        const rpcParams = {
            // Required parameters
            p_user_id: user.id,
            p_family_name: familyName || contact1LastName,
            p_postal_code: postalCode,
            p_primary_phone: primaryPhone || contact1CellPhone,
            p_user_email: contact1Email,
            // Optional parameters (must be undefined, not empty string, to pass DB constraints)
            p_address: address || undefined,
            p_city: city || undefined,
            p_province: province || undefined,
            p_referral_source: referralSource || undefined,
            p_referral_name: (formData.get('referralName') as string) || undefined,
            p_emergency_contact: (formData.get('emergencyContact') as string) || undefined,
            p_health_info: (formData.get('healthNumber') as string) || undefined,
            p_contact1_first_name: contact1FirstName,
            p_contact1_last_name: contact1LastName,
            p_contact1_type: contact1Type || 'Guardian',
            p_contact1_home_phone: (formData.get('contact1HomePhone') as string) || undefined,
            p_contact1_work_phone: (formData.get('contact1WorkPhone') as string) || undefined,
            p_contact1_cell_phone: contact1CellPhone
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

        const redirectTarget = redirectToParam ? safeRedirect(redirectToParam, '/family') : null;
        const successLocation = redirectTarget ? `/register/success?redirectTo=${encodeURIComponent(redirectTarget)}` : '/register/success';

        return redirect(successLocation);

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
    const actionData = useActionData<ActionData>();
    const { context, redirectTo: loaderRedirectTo } = useLoaderData<LoaderData>();
    const errors = actionData && "errors" in actionData ? actionData.errors : null;
    const error = actionData && "error" in actionData ? actionData.error : null;

    const location = useLocation(); // Get the current location
    const [searchParams] = useSearchParams();
    const redirectTo = searchParams.get('redirectTo') || loaderRedirectTo || undefined;

    // Determine if we are on the base /register route or a child route
    const isBaseRegisterRoute = location.pathname === '/register';

    const isEventContext = context.type === 'event';

    // State for password strength indicator
    const [password, setPassword] = useState('');

    return (
        <div className="min-h-screen page-background-styles py-12 text-foreground">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {isBaseRegisterRoute ? (
                    <>
                        {/* Context-Aware Page Header */}
                        <div className="text-center mb-12">
                            {isEventContext && context.eventDetails ? (
                                <>
                                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                                        Register for {context.eventDetails.title}
                                    </h1>
                                    <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                                        {context.eventDetails.start_date && formatDate(context.eventDetails.start_date, { formatString: 'EEEE, MMMM d, yyyy' })}
                                        {context.eventDetails.location && ` · ${context.eventDetails.location}`}
                                    </p>
                                    <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                                        Quick registration - we&apos;ll get you signed up in under 2 minutes
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                                        Registration
                                    </h1>
                                    <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                                        Join our karate family and start your martial arts journey
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Registration Form */}
                        <div className="form-container-styles p-8 backdrop-blur-lg">
                            {/* Form Header */}
                            <div className="flex flex-col items-start space-y-2 mb-6 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                                <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Registration Form</h2>
                                <Link to={redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login'}
                                      data-testid="login-link"
                                      className="text-sm text-green-600 dark:text-green-400 hover:underline hover:text-green-700 dark:hover:text-green-300 sm:text-base">
                                    Already a customer? Click here to login.
                                </Link>
                            </div>

                        {/* Only show for non-event registrations */}
                        {!isEventContext && (
                            <>
                                <div
                                    className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md text-center">
                                    <p className="font-semibold text-green-800 dark:text-green-200">Your first class is a <span
                                        className="font-bold">{siteConfig.promotions.freeTrialLabel}</span>!</p>
                                </div>

                                <p className="mb-6 text-muted-foreground">
                                    Welcome to Karate Greenegin! We are so excited to meet your performer and
                                    family! Please complete the following registration form. Afterwards you will be able to
                                    enroll in the classes of your choice!
                                </p>
                            </>
                        )}

                        {/* Removed Step Indicator */}

                        <Form method="post" noValidate className="space-y-8">
                            <AuthenticityTokenInput />
                            {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

                            {/* Core Account Section - Always Visible */}
                            <div className="space-y-6">
                                {/* Guardian Name */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label htmlFor="contact1FirstName" className="block text-sm font-medium mb-1">
                                            First Name<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="text"
                                            id="contact1FirstName"
                                            name="contact1FirstName"
                                            required
                                            data-testid="first-name-input"
                                            className={`input-custom-styles ${errors?.contact1FirstName ? 'border-red-500' : ''}`}
                                            tabIndex={1}
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
                                            data-testid="last-name-input"
                                            className={`input-custom-styles ${errors?.contact1LastName ? 'border-red-500' : ''}`}
                                            tabIndex={2}
                                        />
                                        {errors?.contact1LastName && (
                                            <p className="text-red-500 text-sm mt-1">{errors.contact1LastName}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <Label htmlFor="contact1Email" className="block text-sm font-medium mb-1">
                                        Email<span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="email"
                                        id="contact1Email"
                                        name="contact1Email"
                                        required
                                        autoComplete="username"
                                        data-testid="email-input"
                                        className={`input-custom-styles ${errors?.contact1Email ? 'border-red-500' : ''}`}
                                        tabIndex={3}
                                    />
                                    {errors?.contact1Email && (
                                        <p className="text-red-500 text-sm mt-1">{errors.contact1Email}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">(Emails are kept confidential)</p>
                                </div>

                                {/* Password with Strength Indicator */}
                                <div>
                                    <Label htmlFor="portalPassword" className="block text-sm font-medium mb-1">
                                        Password<span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="password"
                                        id="portalPassword"
                                        name="portalPassword"
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        data-testid="password-input"
                                        className={`input-custom-styles ${errors?.portalPassword ? 'border-red-500' : ''}`}
                                        tabIndex={4}
                                    />
                                    {errors?.portalPassword && (
                                        <p className="text-red-500 text-sm mt-1">{errors.portalPassword}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
                                    {!isEventContext && <PasswordStrengthIndicator password={password} />}
                                </div>

                                {/* Phone and Postal Code */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label htmlFor="contact1CellPhone" className="block text-sm font-medium mb-1">
                                            Phone Number<span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="tel"
                                            id="contact1CellPhone"
                                            name="contact1CellPhone"
                                            required
                                            autoComplete="mobile tel"
                                            data-testid="phone-input"
                                            className={`input-custom-styles ${errors?.contact1CellPhone ? 'border-red-500' : ''}`}
                                            tabIndex={5}
                                        />
                                        {errors?.contact1CellPhone && (
                                            <p className="text-red-500 text-sm mt-1">{errors.contact1CellPhone}</p>
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
                                            data-testid="postal-code-input"
                                            className={`input-custom-styles ${errors?.postalCode ? 'border-red-500' : ''}`}
                                            tabIndex={6}
                                        />
                                        {errors?.postalCode && (
                                            <p className="text-red-500 text-sm mt-1">{errors.postalCode}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Collapsible Sections for General Registration Only */}
                            {!isEventContext && (
                                <>
                                    {/* Hidden family name field - auto-populated from last name */}
                                    <input type="hidden" name="familyName" id="familyName" />

                                    {/* Address Details Section */}
                                    <AddressSection
                                        fieldErrors={errors || undefined}
                                        isCollapsible={true}
                                        showPrimaryPhone={true}
                                        startTabIndex={7}
                                        className="mt-6"
                                    />

                                    {/* Optional Information Section */}
                                    <OptionalInfoSection
                                        fieldErrors={errors || undefined}
                                        isCollapsible={true}
                                        showReferral={true}
                                        showGuardianInfo={true}
                                        showEmergencyContact={true}
                                        showHealthInfo={true}
                                        startTabIndex={11}
                                        className="mt-6"
                                    />
                                </>
                            )}

                            {/* Marketing Emails Checkbox */}
                            <div className="mt-6">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="marketingEmails"
                                            name="marketingEmails"
                                            defaultChecked={true}
                                            className="dark:border-gray-400 dark:data-[state=checked]:bg-green-400"
                                            tabIndex={20}
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

                            {/* Step 3: Contact 2 (Removed) */}

                            {/* Final Submit Button */}
                            <div className="mt-8">
                                <Button
                                    type="submit"
                                    data-testid="register-submit-button"
                                    className="w-full font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700"
                                    tabIndex={21}
                                >
                                    {isEventContext ? 'CREATE ACCOUNT & CONTINUE TO EVENT' : 'CREATE ACCOUNT & GET STARTED'}
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
                    </>
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
            className="min-h-screen page-background-styles py-12 text-foreground flex items-center justify-center">
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
