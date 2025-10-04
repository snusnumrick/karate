import { useEffect, useState, useRef } from "react";
// Response is globally available or comes from web fetch API, not @remix-run/node
import { type ActionFunctionArgs, json, type LoaderFunctionArgs, TypedResponse } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigate, useNavigation, useRouteError, isRouteErrorResponse } from "@remix-run/react"; // Added isRouteErrorResponse
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
// createClient is only needed for admin actions until fully refactored
// Removed unused createClient import
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Database } from "~/types/database.types";
// Removed unused Database import
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {Label} from "~/components/ui/label"; // Import Label
import {Textarea} from "~/components/ui/textarea"; // Import Textarea
import {Checkbox} from "~/components/ui/checkbox"; // Import Checkbox
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select"; // Import Select components
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert"; // Import Alert components
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { format } from 'date-fns'; // format is still used for new Date() formatting
import { formatDate } from "~/utils/misc"; // Import formatDate utility
import { beltColorMap } from "~/utils/constants";
import {
    getStudentDetails,
    updateStudent,
    recordIndividualSessionUsage,
    type StudentDetails, // Import service types
    type StudentUpdateData
} from "~/services/student.server"; // Import service functions
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb"; // Import breadcrumb component
import { T_SHIRT_SIZE_OPTIONS } from "~/constants/tShirtSizes";

// Define types using imported service types
type LoaderData = {
    student: StudentDetails; // Use the imported type
};

// Define potential action data structure
type ActionData = {
    intent?: 'edit' | 'recordUsage'; // Add intent to distinguish actions
    success?: boolean;
    message?: string;
    error?: string;
    fieldErrors?: { [key: string]: string | undefined };
    newBalance?: number | null; // Add field for remaining balance after usage
};


export async function loader({ params }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const studentId = params.studentId;
    if (!studentId) {
        throw new Response("Student ID is required", { status: 400 });
    }
    console.log(`[Loader] Requesting student details for ID: ${studentId}`);

    // Create a response object for potential header setting (if needed later)
    const response = new Response();

    try {
        // Call the service function to get student details
        // No need to create supabaseAdmin here, service function handles it
        const studentDetails = await getStudentDetails(studentId);

        // Return the data using Remix's json helper
        return json({ student: studentDetails }, { headers: response.headers });

    } catch (error) {
        console.error(`[Loader] Error caught while fetching student ${studentId}:`, error);
        // Re-throw the error if it's already a Response (like 404 or 500 from the service)
        if (error instanceof Response) {
            throw error;
        }
        // Otherwise, wrap it in a generic 500 response
        throw new Response("An unexpected error occurred while loading student details.", { status: 500, headers: response.headers });
    }
}

// Action function to handle student updates
export async function action({request, params}: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const studentId = params.studentId;
    if (!studentId) {
        return json({error: "Student ID is required"}, {status: 400});
    }

    try {
        await csrf.validate(request);
    } catch (error) {
        console.error('CSRF validation failed:', error);
        return json({ error: 'Security validation failed. Please try again.' }, { status: 403 });
    }

    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    // --- Authentication Check (Remains the same) ---
    const { supabaseClient, response } = getSupabaseServerClient(request);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        console.error("Admin student action: Auth error or no user found.", authError?.message);
        return json({ error: "Authentication required." }, { status: 401, headers: response.headers });
    }
    const adminUserId = user.id;
    // --- End Authentication Check ---

    // --- Handle "Record Individual Session Usage" Intent ---
    if (intent === "recordUsage") {
        const sessionPurchaseId = formData.get("sessionPurchaseId") as string;
        const usageDate = formData.get("usageDate") as string || format(new Date(), 'yyyy-MM-dd');
        const notes = formData.get("notes") as string | null;

        if (!sessionPurchaseId) {
            return json({ intent, error: "Session purchase ID is required to record usage." }, { status: 400, headers: response.headers });
        }

        try {
            // Call the service function
            // No need to create supabaseAdmin here, service function handles it
            const newBalance = await recordIndividualSessionUsage(
                sessionPurchaseId,
                studentId,
                usageDate,
                adminUserId,
                notes
            );

            console.log(`[Action] Successfully recorded usage for session ${sessionPurchaseId} by student ${studentId}. New balance: ${newBalance}`);
            return json({
                intent: "recordUsage",
                success: true,
                message: "Individual Session usage recorded successfully.",
                newBalance: newBalance
            }, { headers: response.headers });

        } catch (error) {
            console.error("[Action] Admin record Individual Session usage error:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            // Return specific error message from service if available
            return json({ intent, error: `Failed to record usage: ${errorMessage}` }, { status: 500, headers: response.headers });
        }
    }

    // --- Handle "Edit Student" Intent ---
    if (intent === "edit") {
        // --- Data Extraction (Remains the same) ---
        const updateData: StudentUpdateData = {
            first_name: formData.get('first_name') as string,
            last_name: formData.get('last_name') as string,
            gender: formData.get('gender') as string,
            birth_date: formData.get('birth_date') as string,
            height: formData.get('height') ? parseInt(formData.get('height') as string) : null,
            cell_phone: formData.get('cell_phone') as string || null,
            email: formData.get('email') as string || null,
            t_shirt_size: formData.get('t_shirt_size') as Database['public']['Enums']['t_shirt_size_enum'],
            school: formData.get('school') as string,
            grade_level: formData.get('grade_level') as string || null,
            special_needs: formData.get('special_needs') as string || null,
            allergies: formData.get('allergies') as string || null,
            medications: formData.get('medications') as string || null,
            immunizations_up_to_date: formData.get('immunizations_up_to_date') === 'on' ? 'true' : 'false',
            immunization_notes: formData.get('immunization_notes') as string || null,
        };

        // --- Basic Validation (Remains the same) ---
        const fieldErrors: ActionData['fieldErrors'] = {};
        if (!updateData.first_name) fieldErrors.first_name = "First name is required.";
        if (!updateData.last_name) fieldErrors.last_name = "Last name is required.";
        if (!updateData.gender) fieldErrors.gender = "Gender is required.";
        if (!updateData.birth_date) fieldErrors.birth_date = "Birth date is required.";
        if (!updateData.t_shirt_size) fieldErrors.t_shirt_size = "T-shirt size is required.";
        if (!updateData.school) fieldErrors.school = "School is required.";
        if (updateData.height !== null && updateData.height !== undefined && (updateData.height < 50 || updateData.height > 250)) {
            fieldErrors.height = "Height must be between 50 and 250 cm.";
        }
        // Add more validation as needed

        if (Object.values(fieldErrors).some(Boolean)) {
            return json({ intent, error: "Please correct the errors below.", fieldErrors }, { status: 400, headers: response.headers });
        }

        // --- Database Interaction via Service ---
        try {
            // Call the service function
            // No need to create supabaseAdmin here, service function handles it
            await updateStudent(studentId, updateData);

            return json({ intent: "edit", success: true, message: "Student details updated successfully." }, { headers: response.headers });

        } catch (error) {
            console.error("[Action] Admin student update error:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            return json({ intent, error: `Failed to update student: ${errorMessage}` }, { status: 500, headers: response.headers });
        }
    }

    // Fallback for unknown intent
    return json({ error: `Invalid intent: ${intent}` }, { status: 400, headers: response.headers });
}


export default function AdminStudentDetailPage() {
    const {student} = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const navigate = useNavigate(); // Get navigate function
    const [isEditing, setIsEditing] = useState(false); // State for edit mode
    const firstNameRef = useRef<HTMLInputElement>(null);

    const isSubmitting = navigation.state === "submitting";

    // Reset edit mode on successful update
    useEffect(() => {
        if (actionData?.success && isEditing && navigation.state === 'idle') {
            setIsEditing(false);
        }
    }, [actionData, isEditing, navigation.state]);

    // Focus first name field when entering edit mode
    useEffect(() => {
        if (isEditing && firstNameRef.current) {
            firstNameRef.current.focus();
        }
    }, [isEditing]);

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.adminStudentDetail(student.first_name, student.last_name)} className="mb-4" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Student Details: {student.first_name} {student.last_name}</h1>
                {/* Enable Edit Button */}
                {!isEditing && (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>Edit Student</Button>
                )}
            </div>

            {/* Display action feedback */}
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
                    {/* Optionally list field errors */}
                </Alert>
            )}
            {/* Success message for Edit */}
            {actionData?.intent === 'edit' && actionData?.success && actionData.message && !isEditing && (
                <Alert variant="default" className="mb-4 bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{actionData.message}</AlertDescription>
                </Alert>
            )}
            {/* Success message for Record Usage - MOVED BELOW */}

            {isEditing ? (
                // --- Edit Form ---
                <Form method="post" className="space-y-6">
                    <AuthenticityTokenInput />
                    <input type="hidden" name="intent" value="edit"/>

                    {/* Information Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Edit Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="first_name">First Name <span className="text-red-500">*</span></Label>
                                <Input ref={firstNameRef} id="first_name" name="first_name" autoComplete="given-name" defaultValue={student.first_name} required tabIndex={1} className="input-custom-styles"/>
                                {actionData?.fieldErrors?.first_name &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.first_name}</p>}
                            </div>
                            <div>
                                <Label htmlFor="last_name">Last Name <span className="text-red-500">*</span></Label>
                                <Input id="last_name" name="last_name" autoComplete="family-name" defaultValue={student.last_name} required tabIndex={2} className="input-custom-styles"/>
                                {actionData?.fieldErrors?.last_name &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.last_name}</p>}
                            </div>
                            <div>
                                <Label htmlFor="gender">Gender <span className="text-red-500">*</span></Label>
                                <Select name="gender" defaultValue={student.gender} required>
                                    <SelectTrigger id="gender" tabIndex={3} className="input-custom-styles"><SelectValue
                                        placeholder="Select gender"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                                {actionData?.fieldErrors?.gender &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.gender}</p>}
                            </div>
                            <div>
                                <Label htmlFor="birth_date">Birth Date <span className="text-red-500">*</span></Label>
                                <Input id="birth_date" name="birth_date" type="date" defaultValue={student.birth_date || ''}
                                       required tabIndex={4} className="input-custom-styles"/>
                                {actionData?.fieldErrors?.birth_date &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.birth_date}</p>}
                            </div>
                            {/* Belt Rank Select Removed */}
                            <div>
                                <Label htmlFor="t_shirt_size">T-Shirt Size <span
                                    className="text-red-500">*</span></Label>
                                <Select name="t_shirt_size" defaultValue={student.t_shirt_size || undefined} required>
                                    <SelectTrigger id="t_shirt_size" tabIndex={5} className="input-custom-styles"><SelectValue
                                        placeholder="Select size"/></SelectTrigger>
                                    <SelectContent>
                                        {T_SHIRT_SIZE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {actionData?.fieldErrors?.t_shirt_size &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.t_shirt_size}</p>}
                            </div>
                            <div>
                                <Label htmlFor="height">Height (cm)</Label>
                                <Input id="height" name="height" type="number" min="50" max="250" 
                                       defaultValue={student.height || ''} tabIndex={6} className="input-custom-styles"
                                       placeholder="e.g. 150"/>
                                {actionData?.fieldErrors?.height &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.height}</p>}
                            </div>
                            <div>
                                <Label htmlFor="school">School <span className="text-red-500">*</span></Label>
                                <Input id="school" name="school" defaultValue={student.school || ''} required tabIndex={7} className="input-custom-styles"/>
                                {actionData?.fieldErrors?.school &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.school}</p>}
                            </div>
                            <div>
                                <Label htmlFor="grade_level">Grade Level</Label>
                                <Select name="grade_level" defaultValue={student.grade_level || ''}>
                                    <SelectTrigger id="grade_level" tabIndex={8} className="input-custom-styles"><SelectValue
                                        placeholder="Select grade"/></SelectTrigger>
                                    <SelectContent>
                                        {/* Removed SelectItem with value="" */}
                                        <SelectItem value="K">Kindergarten</SelectItem>
                                        <SelectItem value="1">1st Grade</SelectItem>
                                        <SelectItem value="2">2nd Grade</SelectItem>
                                        <SelectItem value="3">3rd Grade</SelectItem>
                                        <SelectItem value="4">4th Grade</SelectItem>
                                        <SelectItem value="5">5th Grade</SelectItem>
                                        <SelectItem value="6">6th Grade</SelectItem>
                                        <SelectItem value="7">7th Grade</SelectItem>
                                        <SelectItem value="8">8th Grade</SelectItem>
                                        <SelectItem value="9">9th Grade</SelectItem>
                                        <SelectItem value="10">10th Grade</SelectItem>
                                        <SelectItem value="11">11th Grade</SelectItem>
                                        <SelectItem value="12">12th Grade</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="cell_phone">Cell Phone</Label>
                                <Input id="cell_phone" name="cell_phone" type="tel" autoComplete="mobile tel"
                                       defaultValue={student.cell_phone || ''} tabIndex={9} className="input-custom-styles"/>
                            </div>
                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" autoComplete="email" defaultValue={student.email || ''} tabIndex={9} className="input-custom-styles"/>
                            </div>
                        </div>
                    </div>

                    {/* Health Information Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Edit Health Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="immunizations_up_to_date"
                                    name="immunizations_up_to_date"
                                    defaultChecked={student.immunizations_up_to_date === 'true'}
                                    tabIndex={10}
                                />
                                <Label htmlFor="immunizations_up_to_date">Immunizations Up-to-Date?</Label>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="immunization_notes">Immunization Notes</Label>
                                <Textarea id="immunization_notes" name="immunization_notes"
                                          defaultValue={student.immunization_notes || ''} rows={2} tabIndex={11} className="input-custom-styles"/>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="allergies">Allergies</Label>
                                <Textarea id="allergies" name="allergies" defaultValue={student.allergies || ''}
                                          rows={2} tabIndex={12} className="input-custom-styles"/>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="medications">Medications</Label>
                                <Textarea id="medications" name="medications" defaultValue={student.medications || ''}
                                          rows={2} tabIndex={13} className="input-custom-styles"/>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="special_needs">Special Needs</Label>
                                <Textarea id="special_needs" name="special_needs"
                                          defaultValue={student.special_needs || ''} rows={2} tabIndex={14} className="input-custom-styles"/>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-4 mt-6">
                        <Button type="button" variant="outline" onClick={() => setIsEditing(false)}
                                disabled={isSubmitting} tabIndex={15}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} tabIndex={16}>
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </Form>
            ) : (
                // --- View Mode ---
                <>
                    {/* Display Student Information */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <p><strong>First Name:</strong> {student.first_name}</p>
                            <p><strong>Last Name:</strong> {student.last_name}</p>
                            <p><strong>Family:</strong> {student.families ?
                                <Link to={`/admin/families/${student.families.id}`}
                                      className="text-blue-600 hover:underline">{student.families.name}</Link> : 'N/A'}
                            </p>
                            <p><strong>Gender:</strong> {student.gender}</p>
                            <p><strong>Birth Date:</strong> {formatDate(student.birth_date, { formatString: 'PPP' })}
                            </p> {/* Use PPP for readable date */}
                            <div className="flex items-center">
                                <strong className="mr-2">Current Belt:</strong> {/* Updated Label */}
                                {student.currentBeltRank ? (
                                    <>
                                        <div
                                            className={`h-4 w-8 rounded mr-2 ${beltColorMap[student.currentBeltRank] || 'bg-gray-400'}`}></div>
                                        <span className="capitalize">{student.currentBeltRank}</span>
                                    </>
                                ) : (
                                    'N/A'
                                )}
                            </div>
                            <p><strong>T-Shirt Size:</strong> {student.t_shirt_size}</p>
                            <p><strong>Height:</strong> {student.height ? `${student.height} cm` : 'N/A'}</p>
                            <p><strong>School:</strong> {student.school}</p>
                            <p><strong>Grade Level:</strong> {student.grade_level || 'N/A'}</p>
                            <p><strong>Cell Phone:</strong> {student.cell_phone || 'N/A'}</p>
                            <p><strong>Email:</strong> {student.email || 'N/A'}</p>
                        </div>
                    </div>

                    {/* Health Information Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Health Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Display boolean 'true'/'false' as Yes/No */}
                            <p><strong>Immunizations
                                Up-to-Date:</strong> {student.immunizations_up_to_date === 'true' ? 'Yes' : student.immunizations_up_to_date === 'false' ? 'No' : 'N/A'}
                            </p>
                            <p><strong>Immunization Notes:</strong> {student.immunization_notes || 'None'}</p>
                            <p><strong>Allergies:</strong> {student.allergies || 'None'}</p>
                            <p><strong>Medications:</strong> {student.medications || 'None'}</p>
                            <p><strong>Special Needs:</strong> {student.special_needs || 'None'}</p>
                        </div>
                    </div>

                    {/* Links to other related admin sections */}
                    <div className="mt-8 space-x-4">
                        {/* Use onClick with navigate instead of asChild/Link - Update path */}
                        <Button variant="secondary" onClick={() => navigate(`/admin/student-belts/${student.id}`)}>
                            Manage Belt Awards
                        </Button>
                        {/* Use onClick with navigate here too */}
                        <Button variant="secondary"
                                onClick={() => navigate(`/admin/attendance?studentId=${student.id}`)}>
                            View Attendance
                        </Button>
                    </div>

                    {/* Individual Session Usage Recording Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mt-6">
                        {/* Success message for Record Usage - MOVED HERE */}
                        {actionData?.intent === 'recordUsage' && actionData?.success && actionData.message && (
                             <Alert variant="default" className="mb-4 bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
                                <AlertTitle>Success</AlertTitle>
                                <AlertDescription>
                                    {actionData.message}
                                    {actionData.newBalance !== null && actionData.newBalance !== undefined && (
                                        ` Remaining family balance: ${actionData.newBalance}.`
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Record Individual Session Usage</h2>
                        {student.familyIndividualSessionBalance > 0 ? ( // Use renamed field
                            <Form method="post" id="record-usage-form" className="space-y-4"> {/* Add form ID */}
                                <AuthenticityTokenInput />
                                <input type="hidden" name="intent" value="recordUsage"/>
                                <div>
                                    <Label htmlFor="sessionPurchaseId">Session Batch</Label>
                                    <Select name="sessionPurchaseId" required>
                                        <SelectTrigger id="sessionPurchaseId" className="input-custom-styles">
                                            <SelectValue placeholder="Select session batch to use"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {student.availableIndividualSessions.map(session => ( // Use renamed field
                                                <SelectItem key={session.id} value={session.id}>
                                                    Purchased: {formatDate(session.purchase_date, { formatString: 'yyyy-MM-dd' })} - Remaining: {session.quantity_remaining}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {/* Display potential action error specific to usage recording */}
                                    {actionData?.intent === 'recordUsage' && actionData.fieldErrors?.sessionPurchaseId && (
                                        <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.sessionPurchaseId}</p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="usageDate">Usage Date</Label>
                                    <Input id="usageDate" name="usageDate" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required className="input-custom-styles" />
                                </div>
                                <div>
                                    <Label htmlFor="notes">Notes (Optional)</Label>
                                    <Textarea id="notes" name="notes" rows={2} placeholder="e.g., Focus on kata"/>
                                </div>

                                {/* Confirmation Dialog */}
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        {/* Change original button type to "button" to only trigger dialog */}
                                        <Button type="button" disabled={isSubmitting}>
                                            {isSubmitting && navigation.formData?.get('intent') === 'recordUsage' ? 'Recording...' : 'Record Usage'}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirm Session Usage</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to record the usage of one individual session for this student?
                                                This will decrement the family&apos;s balance.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            {/* This button submits the form */}
                                            <AlertDialogAction
                                                type="submit"
                                                form="record-usage-form" // Reference the form ID
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting && navigation.formData?.get('intent') === 'recordUsage' ? 'Recording...' : 'Confirm & Record'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                                {/* Display general usage recording errors */}
                                {actionData?.intent === 'recordUsage' && actionData.error && !actionData.fieldErrors && (
                                     <p className="text-red-500 text-sm mt-2">{actionData.error}</p>
                                )}
                            </Form>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400">
                                This student&apos;s family has no available Individual Sessions.
                                <Link to={`/admin/payments/new?familyId=${student.families?.id}&type=individual_session`} className="text-blue-600 hover:underline ml-2">
                                    Record a purchase?
                                </Link>
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// Add a specific ErrorBoundary for this route
export function ErrorBoundary() {
    const error = useRouteError();
    console.error("Error caught in AdminStudentDetailPage ErrorBoundary:", error);

    let errorMessage = "An unknown error occurred loading the student details.";
    let errorStatus = 500;

    // Use isRouteErrorResponse for errors thrown from loaders/actions
    if (isRouteErrorResponse(error)) {
        errorMessage = `Error: ${error.status} - ${error.statusText || 'Failed to load data.'}`;
        errorStatus = error.status;
        // Handle 404 specifically
        if (error.status === 404) {
            errorMessage = "Student not found.";
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.adminStudents()} />
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <h2 className="text-xl font-bold mb-2">Error Loading Student Details ({errorStatus})</h2>
                <p>{errorMessage}</p>
            </div>
        </div>
    );
}
