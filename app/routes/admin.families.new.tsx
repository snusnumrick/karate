import { json, type ActionFunctionArgs, redirect, TypedResponse } from "@remix-run/node";
import { Link, Form, useActionData, useNavigation } from "@remix-run/react";
import { createClient } from '@supabase/supabase-js';
import type { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import { isValid, parse } from 'date-fns'; // Import date-fns functions
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea"; // Import Textarea
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

// Define potential action data structure
type ActionData = {
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: { [key: string]: string | undefined }; // Allow undefined for easier checking
};

// Action function to handle admin family creation
export async function action({ request }: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
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
    if (!guardian1HomePhone) fieldErrors.guardian1HomePhone = "Guardian 1 home phone is required.";
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
        if (!guardian2HomePhone) fieldErrors.guardian2HomePhone = "Guardian 2 home phone is required if adding Guardian 2."; // Make home phone required
        if (!guardian2CellPhone) fieldErrors.guardian2CellPhone = "Guardian 2 cell phone is required if adding Guardian 2."; // Cell phone is already required
        if (!guardian2Email) fieldErrors.guardian2Email = "Guardian 2 email is required if adding Guardian 2."; // Make email required
    }

    if (Object.values(fieldErrors).some(Boolean)) {
        return json({ error: "Please correct the errors below.", fieldErrors }, { status: 400 });
    }

    // --- Database Interaction ---
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return json({ error: "Server configuration error." }, { status: 500 });
    }
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Insert Family
        const { data: familyData, error: familyError } = await supabaseAdmin
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
        const { error: guardian1Error } = await supabaseAdmin
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
             const { error: guardian2Error } = await supabaseAdmin
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
        const studentNotes = formData.getAll("studentNotes[]") as string[]; // Optional

        const studentsToInsert = [];
        for (let i = 0; i < studentFirstNames.length; i++) {
            const firstName = studentFirstNames[i]?.trim();
            const lastName = studentLastNames[i]?.trim();
            const dob = studentDobs[i]?.trim();
            const notes = studentNotes[i]?.trim() || null; // Handle optional notes

           // Basic validation for each student
           if (firstName && lastName && dob) {
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
                    date_of_birth: dob,
                    notes: notes,
                    // Add other student fields if needed (e.g., grade, medical_info)
                });
            } else if (firstName || lastName || dob || notes) {
                // If any field for a student is filled, require the core fields
                if (!firstName) fieldErrors[`studentFirstName[${i}]`] = `First name required for student ${i + 1}.`;
                if (!lastName) fieldErrors[`studentLastName[${i}]`] = `Last name required for student ${i + 1}.`;
                if (!dob) fieldErrors[`studentDob[${i}]`] = `Date of birth required for student ${i + 1}.`;
            }
        }

        // Re-check for errors after student validation
        if (Object.values(fieldErrors).some(Boolean)) {
            // Need to return fieldErrors related to students if any validation failed
             return json({ error: "Please correct the errors below.", fieldErrors }, { status: 400 });
        }


        if (studentsToInsert.length > 0) {
            const { error: studentError } = await supabaseAdmin
                .from('students')
                .insert(studentsToInsert);

            if (studentError) throw new Error(`Failed to create students: ${studentError.message}`);
        }

        // Redirect to the main families list on success
        return redirect(`/admin/families`);

    } catch (error) {
        console.error("Admin family creation error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return json({ error: errorMessage }, { status: 500 });
    }
}


// Interface for student state
interface StudentFormEntry {
    id: number; // Unique key for React list rendering
    firstName?: string;
    lastName?: string;
    dob?: string;
    notes?: string;
}

export default function AdminNewFamilyPage() {
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // State for dynamic student forms
    const [students, setStudents] = useState<StudentFormEntry[]>([{ id: Date.now() }]); // Start with one student form

    // Function to add a new student form entry
    const addStudent = () => {
        setStudents([...students, { id: Date.now() }]); // Add new entry with unique id
    };

    // Function to remove a student form entry by id
    const removeStudent = (idToRemove: number) => {
        setStudents(students.filter(student => student.id !== idToRemove));
    };


    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <Link to="/admin/families" className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Back to Families List
            </Link>
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

                {/* Family Information Section */}
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Family Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="familyName">Family Last Name <span className="text-red-500">*</span></Label>
                            <Input id="familyName" name="familyName" required />
                            {actionData?.fieldErrors?.familyName && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.familyName}</p>}
                        </div>
                         <div>
                            <Label htmlFor="familyEmail">Family Email <span className="text-red-500">*</span></Label>
                            <Input id="familyEmail" name="familyEmail" type="email" required />
                            {actionData?.fieldErrors?.familyEmail && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.familyEmail}</p>}
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="address">Home Address <span className="text-red-500">*</span></Label>
                            <Input id="address" name="address" required />
                            {actionData?.fieldErrors?.address && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.address}</p>}
                        </div>
                        <div>
                            <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
                            <Input id="city" name="city" required />
                            {actionData?.fieldErrors?.city && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.city}</p>}
                        </div>
                        <div>
                            <Label htmlFor="province">Province <span className="text-red-500">*</span></Label>
                            <Select name="province" required>
                                <SelectTrigger id="province"><SelectValue placeholder="Select province" /></SelectTrigger>
                                <SelectContent>
                                    {/* Add all provinces/territories */}
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
                            {actionData?.fieldErrors?.province && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.province}</p>}
                        </div>
                        <div>
                            <Label htmlFor="postalCode">Postal Code <span className="text-red-500">*</span></Label>
                            <Input id="postalCode" name="postalCode" required />
                            {actionData?.fieldErrors?.postalCode && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.postalCode}</p>}
                        </div>
                        <div>
                            <Label htmlFor="primaryPhone">Primary Phone <span className="text-red-500">*</span></Label>
                            <Input id="primaryPhone" name="primaryPhone" type="tel" required />
                            {actionData?.fieldErrors?.primaryPhone && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.primaryPhone}</p>}
                        </div>
                        {/* Add optional family fields here if needed (referral, etc.) */}
                    </div>
                </section>

                {/* Guardian 1 Section */}
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Guardian #1 Information</h2>
                     <p className="text-sm text-muted-foreground mb-4">Note: The email provided here can be used later to invite this guardian to create their portal login.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="guardian1FirstName">First Name <span className="text-red-500">*</span></Label>
                            <Input id="guardian1FirstName" name="guardian1FirstName" required />
                            {actionData?.fieldErrors?.guardian1FirstName && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian1FirstName}</p>}
                        </div>
                        <div>
                            <Label htmlFor="guardian1LastName">Last Name <span className="text-red-500">*</span></Label>
                            <Input id="guardian1LastName" name="guardian1LastName" required />
                            {actionData?.fieldErrors?.guardian1LastName && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian1LastName}</p>}
                        </div>
                        <div>
                            <Label htmlFor="guardian1Relationship">Relationship to Student(s) <span className="text-red-500">*</span></Label>
                             <Select name="guardian1Relationship" required>
                                <SelectTrigger id="guardian1Relationship"><SelectValue placeholder="Select relationship" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Mother">Mother</SelectItem>
                                    <SelectItem value="Father">Father</SelectItem>
                                    <SelectItem value="Guardian">Guardian</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            {actionData?.fieldErrors?.guardian1Relationship && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian1Relationship}</p>}
                        </div>
                         <div>
                            <Label htmlFor="guardian1Email">Email (for Portal Invite) <span className="text-red-500">*</span></Label>
                            <Input id="guardian1Email" name="guardian1Email" type="email" required />
                            {actionData?.fieldErrors?.guardian1Email && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian1Email}</p>}
                        </div>
                        <div>
                            <Label htmlFor="guardian1HomePhone">Home Phone <span className="text-red-500">*</span></Label>
                            <Input id="guardian1HomePhone" name="guardian1HomePhone" type="tel" required />
                            {actionData?.fieldErrors?.guardian1HomePhone && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian1HomePhone}</p>}
                        </div>
                        <div>
                            <Label htmlFor="guardian1CellPhone">Cell Phone <span className="text-red-500">*</span></Label>
                            <Input id="guardian1CellPhone" name="guardian1CellPhone" type="tel" required />
                            {actionData?.fieldErrors?.guardian1CellPhone && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian1CellPhone}</p>}
                        </div>
                        {/* Add optional guardian fields here (work phone, employer, etc.) */}
                    </div>
                </section>

                {/* Guardian 2 Section (Optional) */}
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Guardian #2 Information (Optional)</h2>
                    <p className="text-sm text-muted-foreground mb-4">Fill this section only if there is a second guardian.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="guardian2FirstName">First Name <span className="text-red-500">*</span></Label> {/* Add indicator */}
                            <Input id="guardian2FirstName" name="guardian2FirstName" />
                            {actionData?.fieldErrors?.guardian2FirstName && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian2FirstName}</p>}
                        </div>
                        <div>
                            <Label htmlFor="guardian2LastName">Last Name <span className="text-red-500">*</span></Label> {/* Add indicator */}
                            <Input id="guardian2LastName" name="guardian2LastName" />
                            {actionData?.fieldErrors?.guardian2LastName && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian2LastName}</p>}
                        </div>
                        <div>
                            <Label htmlFor="guardian2Relationship">Relationship to Student(s) <span className="text-red-500">*</span></Label> {/* Add indicator */}
                             <Select name="guardian2Relationship">
                                <SelectTrigger id="guardian2Relationship"><SelectValue placeholder="Select relationship" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Mother">Mother</SelectItem>
                                    <SelectItem value="Father">Father</SelectItem>
                                    <SelectItem value="Guardian">Guardian</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            {actionData?.fieldErrors?.guardian2Relationship && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian2Relationship}</p>}
                        </div>
                         <div>
                            <Label htmlFor="guardian2Email">Email <span className="text-red-500">*</span></Label> {/* Add indicator */}
                            <Input id="guardian2Email" name="guardian2Email" type="email" />
                            {actionData?.fieldErrors?.guardian2Email && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian2Email}</p>}
                        </div>
                        <div>
                            <Label htmlFor="guardian2HomePhone">Home Phone <span className="text-red-500">*</span></Label> {/* Add indicator */}
                            <Input id="guardian2HomePhone" name="guardian2HomePhone" type="tel" />
                            {actionData?.fieldErrors?.guardian2HomePhone && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian2HomePhone}</p>}
                        </div>
                        <div>
                            {/* Add required indicator - server validation enforces the rule */}
                            <Label htmlFor="guardian2CellPhone">Cell Phone <span className="text-red-500">*</span></Label>
                            <Input id="guardian2CellPhone" name="guardian2CellPhone" type="tel" /> {/* Removed non-functional required attribute */}
                            {actionData?.fieldErrors?.guardian2CellPhone && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.guardian2CellPhone}</p>}
                        </div>
                        {/* Add optional guardian fields here (work phone, employer, etc.) */}
                    </div>
                </section>

                {/* Student Section(s) (Dynamic) */}
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Student Information</h2>
                    <p className="text-sm text-muted-foreground mb-4">Add one or more students associated with this family.</p>

                    {students.map((student, index) => (
                        <div key={student.id} className="mb-6 p-4 border border-dashed border-border rounded relative">
                             {students.length > 1 && ( // Show remove button only if more than one student
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute top-2 right-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900"
                                    onClick={() => removeStudent(student.id)}
                                    aria-label={`Remove Student ${index + 1}`}
                                >
                                    &times; Remove
                                </Button>
                            )}
                            <h3 className="text-lg font-medium mb-3">Student #{index + 1}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    {/* Use indexed names like studentFirstName[] */}
                                    <Label htmlFor={`studentFirstName-${student.id}`}>First Name <span className="text-red-500">*</span></Label>
                                    <Input id={`studentFirstName-${student.id}`} name="studentFirstName[]" required />
                                    {actionData?.fieldErrors?.[`studentFirstName[${index}]`] && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors[`studentFirstName[${index}]`]}</p>}
                                </div>
                                <div>
                                    <Label htmlFor={`studentLastName-${student.id}`}>Last Name <span className="text-red-500">*</span></Label>
                                    <Input id={`studentLastName-${student.id}`} name="studentLastName[]" required />
                                     {actionData?.fieldErrors?.[`studentLastName[${index}]`] && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors[`studentLastName[${index}]`]}</p>}
                                </div>
                                <div>
                                    <Label htmlFor={`studentDob-${student.id}`}>Date of Birth (YYYY-MM-DD) <span className="text-red-500">*</span></Label>
                                    <Input id={`studentDob-${student.id}`} name="studentDob[]" type="date" required placeholder="YYYY-MM-DD" />
                                     {actionData?.fieldErrors?.[`studentDob[${index}]`] && <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors[`studentDob[${index}]`]}</p>}
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor={`studentNotes-${student.id}`}>Notes (Optional)</Label>
                                    <Textarea id={`studentNotes-${student.id}`} name="studentNotes[]" placeholder="Any relevant notes about the student (allergies, etc.)" />
                                    {/* No error display needed for optional field unless specific validation added */}
                                </div>
                                {/* Add other student fields here if needed */}
                            </div>
                        </div>
                    ))}

                    <Button type="button" variant="outline" onClick={addStudent} className="mt-2">
                        + Add Another Student
                    </Button>
                </section>


                {/* Submit Button */}
                <div className="flex justify-end gap-4 pt-4 border-t border-border">
                    <Button type="button" variant="outline" asChild>
                        <Link to="/admin/families">Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
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
