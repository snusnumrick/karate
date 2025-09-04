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
import {Textarea} from "~/components/ui/textarea"; // Import Textarea
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import { siteConfig } from "~/config/site"; // Import siteConfig
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";


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
    // Guardian 1 home phone is now optional
    if (!guardian1CellPhone) fieldErrors.guardian1CellPhone = "Guardian 1 cell phone is required.";
    if (!guardian1Email) fieldErrors.guardian1Email = "Guardian 1 email is required.";

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

        // 3. Insert Guardian 2 (if data provided)
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

        // 4. Insert Students (if any provided)
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

                {/* Referral Information Section */}
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Referral Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="referralSource">How did they hear about us? <span className="text-red-500">*</span></Label>
                            <Select name="referralSource" required>
                                <SelectTrigger id="referralSource" className="input-custom-styles" tabIndex={1}>
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
                            {actionData?.fieldErrors?.referralSource &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.referralSource}</p>}
                        </div>
                        <div>
                            <Label htmlFor="referralName">Referral Name</Label>
                            <Input id="referralName" name="referralName" className="input-custom-styles" tabIndex={2}/>
                            {actionData?.fieldErrors?.referralName &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.referralName}</p>}
                        </div>
                    </div>
                </section>

                {/* Family Information Section */}
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Family Information</h2>
                    <div>
                        <Label htmlFor="familyName">Family Last Name <span className="text-red-500">*</span></Label>
                        <Input 
                                id="familyName" 
                                name="familyName" 
                                autoComplete="family-name" 
                                className="input-custom-styles"
                                required 
                                tabIndex={3}
                                ref={familyNameRef}
                            />
                        {actionData?.fieldErrors?.familyName &&
                            <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.familyName}</p>}
                    </div>
                </section>

                {/* Address Information Section */}
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Where Do They Live?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <Label htmlFor="address">Home Address <span className="text-red-500">*</span></Label>
                            <Input id="address" name="address" autoComplete="street-address" className="input-custom-styles" required tabIndex={4}/>
                            {actionData?.fieldErrors?.address &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.address}</p>}
                        </div>
                        <div>
                            <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
                            <Input id="city" name="city" autoComplete="address-level2" className="input-custom-styles" required tabIndex={5}/>
                            {actionData?.fieldErrors?.city &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.city}</p>}
                        </div>
                        <div>
                            <Label htmlFor="province">Province <span className="text-red-500">*</span></Label>
                            <Select name="province" required>
                                <SelectTrigger id="province" className="input-custom-styles" tabIndex={6}>
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
                            <Input id="postalCode" name="postalCode" autoComplete="postal-code" className="input-custom-styles" required tabIndex={7}/>
                            {actionData?.fieldErrors?.postalCode &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.postalCode}</p>}
                        </div>
                        <div>
                            <Label htmlFor="primaryPhone">Primary Phone <span className="text-red-500">*</span></Label>
                            <Input id="primaryPhone" name="primaryPhone" type="tel" autoComplete="tel" className="input-custom-styles" required tabIndex={8}/>
                            {actionData?.fieldErrors?.primaryPhone &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.primaryPhone}</p>}
                        </div>
                    </div>
                </section>

                {/* Additional Information Section */}
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Additional Info</h2>
                    <div className="space-y-6">
                        <div>
                            <Label htmlFor="emergencyContact">Emergency Contact Info <span className="text-red-500">*</span></Label>
                            <Textarea id="emergencyContact" name="emergencyContact" className="input-custom-styles" required rows={3} tabIndex={9}/>
                            {actionData?.fieldErrors?.emergencyContact &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.emergencyContact}</p>}
                        </div>
                        <div>
                            <Label htmlFor="healthInfo">Personal Health Number</Label>
                            <Textarea id="healthInfo" name="healthInfo" className="input-custom-styles" rows={3} tabIndex={10}/>
                            {actionData?.fieldErrors?.healthInfo &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.healthInfo}</p>}
                        </div>
                    </div>
                </section>

                {/* Primary Guardian Section */}
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Primary Guardian</h2>
                    <p className="text-sm text-muted-foreground mb-4">This is the main contact for the family. You can add additional guardians later via the family portal.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <Label htmlFor="guardian1FirstName">First Name <span className="text-red-500">*</span></Label>
                            <Input id="guardian1FirstName" name="guardian1FirstName" autoComplete="given-name" className="input-custom-styles" required tabIndex={11}/>
                            {actionData?.fieldErrors?.guardian1FirstName &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian1FirstName}</p>}
                        </div>
                        <div>
                            <Label htmlFor="guardian1LastName">Last Name <span className="text-red-500">*</span></Label>
                            <Input id="guardian1LastName" name="guardian1LastName" autoComplete="family-name" className="input-custom-styles" required tabIndex={12}/>
                            {actionData?.fieldErrors?.guardian1LastName &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian1LastName}</p>}
                        </div>
                        <div>
                            <Label htmlFor="guardian1Relationship">Type <span className="text-red-500">*</span></Label>
                            <Select name="guardian1Relationship" required>
                                <SelectTrigger id="guardian1Relationship" className="input-custom-styles" tabIndex={13}>
                                    <SelectValue placeholder="Select relationship"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Mother">Mother</SelectItem>
                                    <SelectItem value="Father">Father</SelectItem>
                                    <SelectItem value="Guardian">Guardian</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            {actionData?.fieldErrors?.guardian1Relationship &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian1Relationship}</p>}
                        </div>
                    </div>

                    <h3 className="text-lg font-medium text-foreground mt-6 mb-3">How Can We Contact Them?</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="guardian1HomePhone">Home Phone</Label>
                            <Input id="guardian1HomePhone" name="guardian1HomePhone" type="tel" autoComplete="home tel" className="input-custom-styles" tabIndex={14}/>
                            {actionData?.fieldErrors?.guardian1HomePhone &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian1HomePhone}</p>}
                        </div>
                        <div>
                            <Label htmlFor="guardian1CellPhone">Cell Phone <span className="text-red-500">*</span></Label>
                            <Input id="guardian1CellPhone" name="guardian1CellPhone" type="tel" autoComplete="mobile tel" className="input-custom-styles" required tabIndex={15}/>
                            {actionData?.fieldErrors?.guardian1CellPhone &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian1CellPhone}</p>}
                        </div>
                    </div>

                    <h3 className="text-lg font-medium text-foreground mt-6 mb-3">Portal Access (Email is Login)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="guardian1Email">Email <span className="text-red-500">*</span></Label>
                            <Input id="guardian1Email" name="guardian1Email" type="email" autoComplete="email" className="input-custom-styles" required tabIndex={16}/>
                            {actionData?.fieldErrors?.guardian1Email &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian1Email}</p>}
                            <p className="text-xs text-muted-foreground mt-1">(Emails are kept confidential)</p>
                        </div>
                        <div>
                            <Label htmlFor="familyEmail">Confirm Email <span className="text-red-500">*</span></Label>
                            <Input id="familyEmail" name="familyEmail" type="email" className="input-custom-styles" required tabIndex={17}/>
                            {actionData?.fieldErrors?.familyEmail &&
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.familyEmail}</p>}
                        </div>
                    </div>
                </section>

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
