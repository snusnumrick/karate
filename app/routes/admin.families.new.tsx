import {type ActionFunctionArgs, json, redirect, TypedResponse} from "@remix-run/node";
import {Form, Link, useActionData, useNavigation} from "@remix-run/react";
import {AuthenticityTokenInput} from "remix-utils/csrf/react";
import {csrf} from "~/utils/csrf.server";
import {getSupabaseAdminClient} from '~/utils/supabase.server';
import type {Database} from "~/types/database.types";
import {Button} from "~/components/ui/button";
import {useRef, useEffect} from "react";
import {isValid, parse} from 'date-fns'; // Import date-fns functions
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import { siteConfig } from "~/config/site"; // Import siteConfig
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import {
    FamilyBasicsSection,
    GuardianInfoSection,
    OptionalInfoSection
} from "~/components/family-registration";


// Define potential action data structure
type ActionData = {
    success?: boolean;
    message?: string;
    error?: string;
    fieldErrors?: { [key: string]: string | undefined }; // Allow undefined for easier checking
};

// Action function to handle admin family creation
export async function action({request}: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    // Validate CSRF token
    await csrf.validate(request);
    
    const formData = await request.formData();

    // --- Data Extraction ---
    const familyName = formData.get("familyName") as string;
    const address = formData.get("address") as string;
    const city = formData.get("city") as string;
    const province = formData.get("province") as string;
    const postalCode = formData.get("postalCode") as string;
    const primaryPhone = formData.get("primaryPhone") as string;
    const familyEmail = formData.get("familyEmail") as string; // Use a separate email for the family record if needed

    const guardian1FirstName = formData.get("guardian1FirstName") as string;
    const guardian1LastName = formData.get("guardian1LastName") as string;
    const guardian1Relationship = formData.get("guardian1Relationship") as string;
    const guardian1HomePhone = formData.get("guardian1HomePhone") as string;
    const guardian1CellPhone = formData.get("guardian1CellPhone") as string;
    const guardian1Email = formData.get("guardian1Email") as string; // This might be the primary login email later

    // Guardian 2 Data Extraction (Optional)
    const guardian2FirstName = formData.get("guardian2FirstName") as string | null;
    const guardian2LastName = formData.get("guardian2LastName") as string | null;
    const guardian2Relationship = formData.get("guardian2Relationship") as string | null;
    const guardian2HomePhone = formData.get("guardian2HomePhone") as string | null;
    const guardian2CellPhone = formData.get("guardian2CellPhone") as string | null;
    const guardian2Email = formData.get("guardian2Email") as string | null;

    // --- Basic Validation ---
    const fieldErrors: ActionData['fieldErrors'] = {};
    if (!familyName) fieldErrors.familyName = "Family name is required.";
    if (!address) fieldErrors.address = "Address is required.";
    if (!city) fieldErrors.city = "City is required.";
    if (!province) fieldErrors.province = "Province is required.";
    if (!postalCode) fieldErrors.postalCode = "Postal code is required.";
    if (!primaryPhone) fieldErrors.primaryPhone = "Primary phone is required.";
    if (!familyEmail) fieldErrors.familyEmail = "Family email is required."; // Validate family email if used

    if (!guardian1FirstName) fieldErrors.guardian1FirstName = "Guardian 1 first name is required.";
    if (!guardian1LastName) fieldErrors.guardian1LastName = "Guardian 1 last name is required.";
    if (!guardian1Relationship) fieldErrors.guardian1Relationship = "Guardian 1 relationship is required.";
    // Guardian 1 home phone is optional
    if (!guardian1CellPhone) fieldErrors.guardian1CellPhone = "Guardian 1 cell phone is required.";
    if (!guardian1Email) fieldErrors.guardian1Email = "Guardian 1 email is required.";

    // Referral and emergency contact are now optional (no validation needed)

    // Validate email confirmation match
    if (guardian1Email && familyEmail && guardian1Email !== familyEmail) {
        fieldErrors.familyEmail = "Email addresses do not match.";
    }

    // --- Guardian 2 Conditional Validation ---
    const hasGuardian2Data = [
        guardian2FirstName, guardian2LastName, guardian2Relationship,
        guardian2HomePhone, guardian2CellPhone, guardian2Email
    ].some(Boolean); // Check if any Guardian 2 field is filled

    if (hasGuardian2Data) {
        if (!guardian2FirstName) fieldErrors.guardian2FirstName = "Guardian 2 first name is required if adding Guardian 2.";
        if (!guardian2LastName) fieldErrors.guardian2LastName = "Guardian 2 last name is required if adding Guardian 2.";
        if (!guardian2Relationship) fieldErrors.guardian2Relationship = "Guardian 2 relationship is required if adding Guardian 2.";
        // Guardian 2 home phone is now optional
        if (!guardian2CellPhone) fieldErrors.guardian2CellPhone = "Guardian 2 cell phone is required if adding Guardian 2."; // Cell phone is already required
        if (!guardian2Email) fieldErrors.guardian2Email = "Guardian 2 email is required if adding Guardian 2."; // Make email required
    }

    if (Object.values(fieldErrors).some(Boolean)) {
        return json({error: "Please correct the errors below.", fieldErrors}, {status: 400});
    }

    // --- Database Interaction ---
    const supabaseAdmin = getSupabaseAdminClient();

    try {
        // 1. Insert Family
        const {data: familyData, error: familyError} = await supabaseAdmin
            .from('families')
            .insert({
                name: familyName,
                address,
                city,
                province,
                postal_code: postalCode,
                primary_phone: primaryPhone,
                email: familyEmail, // Use the dedicated family email field
                // Add other optional family fields if needed (referral, etc.)
            })
            .select('id')
            .single();

        if (familyError) throw new Error(`Failed to create family: ${familyError.message}`);
        const familyId = familyData.id;

        // 2. Insert Guardian 1
        const {error: guardian1Error} = await supabaseAdmin
            .from('guardians')
            .insert({
                family_id: familyId,
                first_name: guardian1FirstName,
                last_name: guardian1LastName,
                relationship: guardian1Relationship,
                home_phone: guardian1HomePhone,
                cell_phone: guardian1CellPhone,
                email: guardian1Email,
                // Add other optional guardian fields if needed
            });

        if (guardian1Error) throw new Error(`Failed to create guardian 1: ${guardian1Error.message}`);

        // 3. Check if user already exists before creating auth user
        console.log(`[Admin Family Creation] Checking if user exists for email: ${guardian1Email}`);

        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) {
            console.error(`[Admin Family Creation] Failed to list users:`, listError.message);
            throw new Error(`Failed to check existing users: ${listError.message}`);
        }

        const existingUser = users.find(u => u.email === guardian1Email);
        let userId: string;

        if (existingUser) {
            console.log(`[Admin Family Creation] Found existing user ${existingUser.id} for email: ${guardian1Email}`);

            // Check if this user already has a profile/family
            const { data: existingProfile } = await supabaseAdmin
                .from('profiles')
                .select('id, family_id')
                .eq('id', existingUser.id)
                .maybeSingle();

            if (existingProfile && existingProfile.family_id) {
                console.error(`[Admin Family Creation] User ${existingUser.id} already has a family: ${existingProfile.family_id}`);
                return json({
                    error: `The email ${guardian1Email} is already registered and linked to a family. Please use a different email or contact support.`,
                    fieldErrors: {
                        guardian1Email: 'This email is already registered in the system'
                    }
                }, { status: 400 });
            }

            // User exists but has no family - we can reuse this user
            console.log(`[Admin Family Creation] User ${existingUser.id} exists but has no family, reusing user account`);
            userId = existingUser.id;
        } else {
            // User doesn't exist, create new auth user
            console.log(`[Admin Family Creation] Creating new auth user for: ${guardian1Email}`);

            // Generate a random secure password (user will set their own via password reset)
            const tempPassword = crypto.randomUUID() + crypto.randomUUID(); // Strong random password

            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: guardian1Email,
                password: tempPassword,
                email_confirm: false, // Will be confirmed when they set their password
                user_metadata: {
                    first_name: guardian1FirstName,
                    last_name: guardian1LastName,
                    created_by_admin: true,
                }
            });

            if (authError) {
                console.error(`[Admin Family Creation] Failed to create auth user for ${guardian1Email}:`, authError.message);
                throw new Error(`Failed to create portal login for guardian: ${authError.message}`);
            }

            if (!authData.user) {
                throw new Error('Auth user creation succeeded but no user object returned');
            }

            userId = authData.user.id;
            console.log(`[Admin Family Creation] Successfully created auth user ${userId} for: ${guardian1Email}`);
        }

        // 4. Create or Update Profile Record (Link Auth User to Family)
        console.log(`[Admin Family Creation] Creating/updating profile record for User ID: ${userId}, Family ID: ${familyId}`);

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: userId,
                family_id: familyId,
                email: guardian1Email,
                role: 'user', // Default role for family portal access
            }, {
                onConflict: 'id'
            });

        if (profileError) {
            console.error(`[Admin Family Creation] Failed to create/update profile for user ${userId}:`, profileError.message);
            throw new Error(`Failed to link user to family: ${profileError.message}`);
        }
        console.log(`[Admin Family Creation] Successfully created/updated profile record for User ID: ${userId}`);

        // 5. Send Password Reset Email (Acts as Welcome Email)
        console.log(`[Admin Family Creation] Sending password setup email to: ${guardian1Email}`);

        const url = new URL(request.url);
        const resetRedirectTo = `${url.origin}/reset-password`;

        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(guardian1Email, {
            redirectTo: resetRedirectTo,
        });

        if (resetError) {
            console.error(`[Admin Family Creation] Failed to send password setup email to ${guardian1Email}:`, resetError.message);
            // Don't throw here - the account is created, admin can manually resend
            console.warn(`[Admin Family Creation] Family created successfully but password setup email failed. Admin may need to manually trigger password reset.`);
        } else {
            console.log(`[Admin Family Creation] Successfully sent password setup email to: ${guardian1Email}`);
        }

        // 6. Insert Guardian 2 (if data provided)
        if (hasGuardian2Data && guardian2FirstName && guardian2LastName && guardian2Relationship) { // Ensure required fields are present
            const {error: guardian2Error} = await supabaseAdmin
                .from('guardians')
                .insert({
                    family_id: familyId,
                    first_name: guardian2FirstName!,
                    last_name: guardian2LastName!,
                    relationship: guardian2Relationship!,
                    home_phone: guardian2HomePhone!, // Can be null
                    cell_phone: guardian2CellPhone!,
                    email: guardian2Email!,         // Can be null
                });

            if (guardian2Error) throw new Error(`Failed to create guardian 2: ${guardian2Error.message}`);
        }

        // 7. Insert Students (if any provided)
        const studentFirstNames = formData.getAll("studentFirstName[]") as string[];
        const studentLastNames = formData.getAll("studentLastName[]") as string[];
        const studentDobs = formData.getAll("studentDob[]") as string[];
        // Extract new student fields
        const studentGenders = formData.getAll("studentGender[]") as string[];
        const studentSchools = formData.getAll("studentSchool[]") as string[];
        const studentTShirtSizes = formData.getAll("studentTShirtSize[]") as string[];
        const studentCellPhones = formData.getAll("studentCellPhone[]") as string[]; // Optional
        const studentEmails = formData.getAll("studentEmail[]") as string[]; // Optional
        const studentGradeLevels = formData.getAll("studentGradeLevel[]") as string[]; // Optional
        const studentAllergies = formData.getAll("studentAllergies[]") as string[]; // Optional
        const studentMedications = formData.getAll("studentMedications[]") as string[]; // Optional
        const studentSpecialNeeds = formData.getAll("studentSpecialNeeds[]") as string[]; // Optional
        const studentImmunizationsUpToDate = formData.getAll("studentImmunizationsUpToDate[]") as string[]; // Optional
        const studentImmunizationNotes = formData.getAll("studentImmunizationNotes[]") as string[]; // Optional


        const studentsToInsert = [];
        for (let i = 0; i < studentFirstNames.length; i++) {
            const firstName = studentFirstNames[i]?.trim();
            const lastName = studentLastNames[i]?.trim();
            const dob = studentDobs[i]?.trim();
            // Get new field values, trimming and setting null if empty for optional fields
            const gender = studentGenders[i]?.trim();
            const school = studentSchools[i]?.trim();
            const tShirtSize = studentTShirtSizes[i]?.trim();
            const cellPhone = studentCellPhones[i]?.trim() || null;
            const email = studentEmails[i]?.trim() || null;
            const gradeLevel = studentGradeLevels[i]?.trim() || null;
            const allergies = studentAllergies[i]?.trim() || null;
            const medications = studentMedications[i]?.trim() || null;
            const specialNeeds = studentSpecialNeeds[i]?.trim() || null;
            const immunizationsUpToDate = studentImmunizationsUpToDate[i]?.trim() || null;
            const immunizationNotes = studentImmunizationNotes[i]?.trim() || null;


            // Basic validation for each student
            if (firstName && lastName && dob && gender && school && tShirtSize) { // Check all required fields
                // Validate date format first
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
                    fieldErrors[`studentDob[${i}]`] = `Invalid date format for student ${i + 1}. Use YYYY-MM-DD.`;
                    continue; // Skip this student
                }
                // Validate date value using date-fns
                const parsedDate = parse(dob, 'yyyy-MM-dd', new Date());
                if (!isValid(parsedDate)) {
                    fieldErrors[`studentDob[${i}]`] = `Invalid date value for student ${i + 1}. Please enter a real date.`;
                    continue; // Skip this student
                }

                studentsToInsert.push({
                    family_id: familyId,
                    first_name: firstName,
                    last_name: lastName,
                    birth_date: dob, // Renamed from date_of_birth
                    gender: gender, // Required
                    school: school, // Required
                    t_shirt_size: tShirtSize as Database['public']['Enums']['t_shirt_size_enum'], // Required
                    cell_phone: cellPhone, // Optional
                    email: email, // Optional
                    grade_level: gradeLevel, // Optional
                    allergies: allergies, // Optional
                    medications: medications, // Optional
                    special_needs: specialNeeds, // Optional
                    immunizations_up_to_date: immunizationsUpToDate, // Optional
                    immunization_notes: immunizationNotes, // Optional
                    // belt_rank is likely set later, not during initial creation
                });
            } else if (firstName || lastName || dob || gender || school || tShirtSize || cellPhone || email || gradeLevel || allergies || medications || specialNeeds || immunizationsUpToDate || immunizationNotes) {
                // If any field for a student is filled, require the core fields
                if (!firstName) fieldErrors[`studentFirstName[${i}]`] = `First name required for student ${i + 1}.`;
                if (!lastName) fieldErrors[`studentLastName[${i}]`] = `Last name required for student ${i + 1}.`;
                if (!dob) fieldErrors[`studentDob[${i}]`] = `Date of birth required for student ${i + 1}.`;
                if (!gender) fieldErrors[`studentGender[${i}]`] = `Gender required for student ${i + 1}.`; // Add validation message
                if (!school) fieldErrors[`studentSchool[${i}]`] = `School required for student ${i + 1}.`; // Add validation message
                if (!tShirtSize) fieldErrors[`studentTShirtSize[${i}]`] = `T-Shirt size required for student ${i + 1}.`; // Add validation message
            }
        }

        // Re-check for errors after student validation
        if (Object.values(fieldErrors).some(Boolean)) {
            // Need to return fieldErrors related to students if any validation failed
            return json({error: "Please correct the errors below.", fieldErrors}, {status: 400});
        }


        if (studentsToInsert.length > 0) {
            const {error: studentError} = await supabaseAdmin
                .from('students')
                .insert(studentsToInsert)
                .select();

            if (studentError) throw new Error(`Failed to create students: ${studentError.message}`);
        }

        // Redirect to the main families list on success
        return redirect(`/admin/families`);

    } catch (error) {
        console.error("Admin family creation error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return json({error: errorMessage}, {status: 500});
    }
}


export default function AdminNewFamilyPage() {
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // Ref for the Family Last Name field to enable focus
    const familyNameRef = useRef<HTMLInputElement>(null);

    // Focus on Family Last Name field when component mounts
    useEffect(() => {
        if (familyNameRef.current) {
            familyNameRef.current.focus();
        }
    }, []);


    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <AppBreadcrumb 
                items={breadcrumbPatterns.adminFamilyNew()} 
                className="mb-6"
            />
            
            <h1 className="text-3xl font-bold mb-6">Register New Family (Admin)</h1>

            {actionData?.error && !actionData.fieldErrors && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}
            {actionData?.error && actionData.fieldErrors && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Validation Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <Form method="post" className="space-y-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <AuthenticityTokenInput />

                {/* Family Information Section */}
                <FamilyBasicsSection
                    ref={familyNameRef}
                    fieldErrors={actionData?.fieldErrors}
                    tabIndex={1}
                />

                {/* Address Information Section - Now includes postal code and primary phone */}
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Where Do They Live?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <Label htmlFor="address">Home Address <span className="text-red-500">*</span></Label>
                            <Input id="address" name="address" autoComplete="street-address" className="input-custom-styles" required tabIndex={2}/>
                            {actionData?.fieldErrors?.address &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.address}</p>}
                        </div>
                        <div>
                            <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
                            <Input id="city" name="city" autoComplete="address-level2" className="input-custom-styles" required tabIndex={3}/>
                            {actionData?.fieldErrors?.city &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.city}</p>}
                        </div>
                        <div>
                            <Label htmlFor="province">Province <span className="text-red-500">*</span></Label>
                            <Select name="province" required>
                                <SelectTrigger id="province" className="input-custom-styles" tabIndex={4}>
                                    <SelectValue placeholder="Select province"/>
                                </SelectTrigger>
                                <SelectContent>
                                    {siteConfig.provinces.map((prov) => (
                                        <SelectItem key={prov.value} value={prov.value}>
                                            {prov.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {actionData?.fieldErrors?.province &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.province}</p>}
                        </div>
                        <div>
                            <Label htmlFor="postalCode">Postal Code <span className="text-red-500">*</span></Label>
                            <Input id="postalCode" name="postalCode" autoComplete="postal-code" className="input-custom-styles" required tabIndex={5}/>
                            {actionData?.fieldErrors?.postalCode &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.postalCode}</p>}
                        </div>
                        <div>
                            <Label htmlFor="primaryPhone">Primary Phone <span className="text-red-500">*</span></Label>
                            <Input id="primaryPhone" name="primaryPhone" type="tel" autoComplete="tel" className="input-custom-styles" required tabIndex={6}/>
                            {actionData?.fieldErrors?.primaryPhone &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.primaryPhone}</p>}
                        </div>
                    </div>
                </section>

                {/* Primary Guardian Section */}
                <GuardianInfoSection
                    fieldErrors={actionData?.fieldErrors}
                    showEmailConfirmation={true}
                    showSubheadings={true}
                    fieldPrefix="guardian1"
                    startTabIndex={7}
                />

                {/* Optional Information - Collapsible Accordions */}
                <OptionalInfoSection
                    fieldErrors={actionData?.fieldErrors}
                    isCollapsible={true}
                    showReferral={true}
                    showGuardianInfo={false}
                    showEmergencyContact={true}
                    showHealthInfo={true}
                    startTabIndex={13}
                />

                {/* Submit Button */}
                <div className="flex justify-end gap-4 pt-4 border-t border-border">
                    <Button type="button" variant="outline" asChild tabIndex={19}>
                        <Link to="/admin/families">Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={isSubmitting} tabIndex={20}>
                        {isSubmitting ? 'Creating Family...' : 'Create Family'}
                    </Button>
                </div>
            </Form>
        </div>
    );
}

// Optional: Add ErrorBoundary
export function ErrorBoundary() {
    // Basic error boundary, can be enhanced
    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <Link to="/admin/families" className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Back to Families List
            </Link>
            <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>There was an error loading or processing the new family form.</AlertDescription>
            </Alert>
        </div>
    );
}
