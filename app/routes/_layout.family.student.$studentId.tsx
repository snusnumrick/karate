import {useEffect, useState} from "react";
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect, TypedResponse} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation, useSubmit} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import { createClient } from '@supabase/supabase-js'; // Import createClient
import {Button} from "~/components/ui/button";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Textarea} from "~/components/ui/textarea";
import {Checkbox} from "~/components/ui/checkbox";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "~/components/ui/alert-dialog"; // Added AlertDialog components
import type {Database} from "~/types/database.types";
import {Badge} from "~/components/ui/badge"; // Import Badge
import {formatDate} from '~/utils/misc'; // Import the new formatDate utility
import {beltColorMap} from "~/utils/constants";

// Define types based on updated Supabase schema
type BeltRankEnum = Database['public']['Enums']['belt_rank_enum'];
type StudentRow = Omit<Database['public']['Tables']['students']['Row'], 'belt_rank'>; // Omit removed column
type BeltAwardRow = Database['public']['Tables']['belt_awards']['Row']; // Use BeltAwardRow
type EnrollmentRow = Database['public']['Tables']['enrollments']['Row'];

// Define enrollment with class and program details
type EnrollmentWithDetails = EnrollmentRow & {
    classes: {
        id: string;
        name: string;
        program_id: string;
        programs: {
            name: string;
        } | null;
    } | null;
};

// Extend loader data type to include derived current belt and enrollments
type LoaderData = {
    student: StudentRow;
    beltAwards: BeltAwardRow[];
    currentBeltRank: BeltRankEnum | null; // Add derived current belt rank
    enrollments: EnrollmentWithDetails[]; // Add enrollments
};

// Define potential action data structure
type ActionData = {
    success?: boolean;
    message?: string;
    error?: string;
    fieldErrors?: { [key: string]: string };
};


export async function loader({request, params}: LoaderFunctionArgs) {
    const studentId = params.studentId;
    if (!studentId) {
        throw new Response("Student ID is required", {status: 400});
    }

    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        // Redirect to login if user is not authenticated
        return redirect("/login?redirectTo=/family", {headers});
    }

    // Fetch the student data
    const {data: studentData, error: studentError} = await supabaseServer
        .from('students')
        .select('*') // Select all student fields
        .eq('id', studentId)
        .single();

    if (studentError || !studentData) {
        console.error("Error fetching student data:", studentError?.message);
        // Throw a 404 if student not found
        throw new Response("Student not found", {status: 404});
    }

    // Verify the logged-in user belongs to the same family as the student
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || profileData.family_id !== studentData.family_id) {
        console.error("Authorization error: User", user.id, "tried to access student", studentId, "from different family.");
        // Throw a 403 Forbidden error if user is not part of the student's family
        throw new Response("Forbidden: You do not have permission to view this student.", {status: 403});
    }

    // Fetch the student's belt awards (assuming table renamed)
    const {data, error: beltAwardsError} = await supabaseServer
        .from('belt_awards') // Renamed from 'achievements'
        .select('*')
        .eq('student_id', studentId)
        .order('awarded_date', {ascending: false});
    let beltAwardsData = data;

    if (beltAwardsError) {
        console.error("Error fetching student belt awards:", beltAwardsError?.message);
        // Don't fail the whole page load, just return an empty array or handle gracefully
        beltAwardsData = [];
    }

    // Determine the current belt rank from the fetched awards
    const currentBeltRank = beltAwardsData && beltAwardsData.length > 0
        ? beltAwardsData[0].type // Assuming awards are sorted descending by date
        : null;

    // Fetch the student's enrollments
    const {data: enrollmentsData, error: enrollmentsError} = await supabaseServer
        .from('enrollments')
        .select(`
            *,
            classes (
                id,
                name,
                program_id,
                programs (
                    name
                )
            )
        `)
        .eq('student_id', studentId)
        .order('enrolled_at', {ascending: false});

    if (enrollmentsError) {
        console.error("Error fetching student enrollments:", enrollmentsError?.message);
        // Don't fail the whole page load, just return an empty array
    }

    const enrollments = enrollmentsData as EnrollmentWithDetails[] || [];

    // Return the student data, belt awards, derived current rank, and enrollments
    return json({
        student: studentData as StudentRow,
        beltAwards: beltAwardsData as BeltAwardRow[],
        currentBeltRank: currentBeltRank,
        enrollments: enrollments
    }, {headers});
}

// Action function for handling form submissions (edit/delete)
export async function action({request, params}: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const studentId = params.studentId;
    if (!studentId) {
        return json({error: "Student ID is required"}, {status: 400});
    }

    const formData = await request.formData();
    const intent = formData.get("intent");
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return redirect("/login?redirectTo=/family", {headers});
    }

    // Authorization check: Fetch student's family ID first
    const {data: studentFamily, error: studentFamilyError} = await supabaseServer
        .from('students')
        .select('family_id')
        .eq('id', studentId)
        .single();

    if (studentFamilyError || !studentFamily) {
        return json({error: "Student not found or error fetching student."}, {status: 404, headers});
    }

    // Verify the logged-in user belongs to the same family
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || profileData.family_id !== studentFamily.family_id) {
        return json({error: "Forbidden: You do not have permission to modify this student."}, {status: 403, headers});
    }

    // --- Handle Delete Intent ---
    if (intent === "delete") {
        console.log(`[Action/DeleteStudent] Attempting to delete student ID: ${studentId} for user ID: ${user.id}`);

        // Explicitly create an admin client to bypass RLS for deletion
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("[Action/DeleteStudent] Missing Supabase URL or Service Role Key");
            return json({ error: "Server configuration error." }, { status: 500, headers });
        }
        const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

        console.log(`[Action/DeleteStudent] Executing delete for student ID: ${studentId}`);
        // Add checks for related data if necessary (e.g., attendance, payments) before deleting
        const deleteResult = await supabaseAdmin // Use explicit admin client
            .from('students')
            .delete()
            .eq('id', studentId);

        console.log(`[Action/DeleteStudent] Delete result for student ID ${studentId}:`, JSON.stringify(deleteResult)); // Log the full result

        if (deleteResult.error) {
            console.error(`[Action/DeleteStudent] Error deleting student ID ${studentId}:`, deleteResult.error);
            return json({error: "Failed to delete student. " + deleteResult.error.message}, {status: 500, headers});
        }

        console.log(`[Action/DeleteStudent] Assumed successful deletion for student ID: ${studentId}. Redirecting...`);
        // Redirect to family page after successful deletion. Rely on default revalidation.
        return redirect("/family"); // Removed {headers}
    }

    // --- Handle Edit Intent ---
    if (intent === "edit") {
        // Retrieve all required fields
        const firstName = formData.get('first_name') as string;
        const lastName = formData.get('last_name') as string;
        const gender = formData.get('gender') as string;
        const birthDate = formData.get('birth_date') as string;
        const tShirtSize = formData.get('t_shirt_size') as string;
        const school = formData.get('school') as string;
        const gradeLevel = formData.get('grade_level') as string;

        // Server-side validation for required fields
        const fieldErrors: { [key: string]: string } = {};
        if (!firstName) fieldErrors.first_name = 'First name is required.';
        if (!lastName) fieldErrors.last_name = 'Last name is required.';
        if (!gender) fieldErrors.gender = 'Gender is required.';
        if (!birthDate) fieldErrors.birth_date = 'Birth date is required.';
        if (!tShirtSize) fieldErrors.t_shirt_size = 'T-Shirt size is required.';
        if (!school) fieldErrors.school = 'School is required.';
        if (!gradeLevel) fieldErrors.grade_level = 'Grade level is required.';

        if (Object.keys(fieldErrors).length > 0) {
            return json({
                error: "Please fill in all required fields.",
                fieldErrors
            }, { status: 400, headers });
        }

        const updateData: Partial<StudentRow> = {
            first_name: firstName, // Already validated
            last_name: lastName, // Already validated
            gender: gender, // Already validated
            birth_date: birthDate, // Already validated
            cell_phone: formData.get('cell_phone') as string || null,
            email: formData.get('email') as string || null,
            t_shirt_size: tShirtSize, // Already validated
            school: school, // Already validated
            grade_level: gradeLevel, // Already validated
            special_needs: formData.get('special_needs') as string || null,
            allergies: formData.get('allergies') as string || null,
            medications: formData.get('medications') as string || null,
            // Handle checkbox - value is 'on' if checked, null otherwise
            immunizations_up_to_date: formData.get('immunizations_up_to_date') === 'on' ? 'true' : 'false',
            immunization_notes: formData.get('immunization_notes') as string || null,
            // belt_rank removed from updateData
        };

        const {error: updateError} = await supabaseServer
            .from('students')
            .update(updateData)
            .eq('id', studentId);

        if (updateError) {
            console.error("Error updating student:", updateError);
            return json({error: "Failed to update student. " + updateError.message}, {status: 500, headers});
        }

        // Return success message
        return json({success: true, message: "Student updated successfully."}, {headers});
    }

    // Invalid intent
    return json({error: "Invalid action."}, {status: 400, headers});
}


export default function StudentDetailPage() {
    // Update to use the extended LoaderData type including currentBeltRank and enrollments
    const {student, beltAwards, currentBeltRank, enrollments} = useLoaderData<LoaderData>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const submit = useSubmit(); // Get submit hook
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // State for delete dialog
    const [hasJustSubmitted, setHasJustSubmitted] = useState(false); // Track if we just submitted

    const isSubmitting = navigation.state === "submitting";
    const formIntent = navigation.formData?.get('intent'); // Get intent for loading state
    
    // Track when form is submitted
    useEffect(() => {
        if (navigation.state === "submitting") {
            setHasJustSubmitted(true);
        }
    }, [navigation.state]);

    // Reset edit mode on successful update (only if we just submitted)
    useEffect(() => {
        if (actionData?.success && isEditing && hasJustSubmitted && navigation.state === 'idle') {
            setIsEditing(false);
            setHasJustSubmitted(false);
        }
    }, [actionData?.success, isEditing, hasJustSubmitted, navigation.state]);


    return (
        <div className="container mx-auto px-4 py-8">
            <Link to="/family" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Family
                Portal</Link>

            <h1 className="text-3xl font-bold mb-6">Student Details</h1>

            {/* Display action feedback */}
            {actionData?.error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}
            {actionData?.success && actionData.message && !isEditing && (
                <Alert variant="default"
                       className="mb-4 bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{actionData.message}</AlertDescription>
                </Alert>
            )}

            {isEditing ? (
                // --- Edit Form ---
                <Form method="post" className="space-y-6">
                    <input type="hidden" name="intent" value="edit"/>

                    {/* Information Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Edit Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="first_name">First Name</Label>
                                <Input id="first_name" name="first_name" defaultValue={student.first_name} required className="input-custom-styles"/>
                                {actionData?.fieldErrors?.first_name &&
                                    <p className="text-red-500 text-sm">{actionData.fieldErrors.first_name}</p>}
                            </div>
                            <div>
                                <Label htmlFor="last_name">Last Name</Label>
                                <Input id="last_name" name="last_name" defaultValue={student.last_name} required className="input-custom-styles"/>
                                {actionData?.fieldErrors?.last_name &&
                                    <p className="text-red-500 text-sm">{actionData.fieldErrors.last_name}</p>}
                            </div>
                            <div>
                                <Label htmlFor="gender">Gender</Label>
                                <Select name="gender" defaultValue={student.gender} required>
                                    <SelectTrigger id="gender"><SelectValue
                                        placeholder="Select gender"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="birth_date">Birth Date</Label>
                                <Input id="birth_date" name="birth_date" type="date" defaultValue={student.birth_date}
                                       required className="input-custom-styles"/>
                            </div>
                            {/* Belt Rank Select Removed */}
                            <div>
                                <Label htmlFor="t_shirt_size">T-Shirt Size</Label>
                                <Select name="t_shirt_size" defaultValue={student.t_shirt_size} required>
                                    <SelectTrigger id="t_shirt_size"><SelectValue
                                        placeholder="Select size"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="YXS">Youth XS</SelectItem>
                                        <SelectItem value="YS">Youth S</SelectItem>
                                        <SelectItem value="YM">Youth M</SelectItem>
                                        <SelectItem value="YL">Youth L</SelectItem>
                                        <SelectItem value="YXL">Youth XL</SelectItem>
                                        <SelectItem value="AS">Adult S</SelectItem>
                                        <SelectItem value="AM">Adult M</SelectItem>
                                        <SelectItem value="AL">Adult L</SelectItem>
                                        <SelectItem value="AXL">Adult XL</SelectItem>
                                        <SelectItem value="A2XL">Adult 2XL</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="school">School</Label>
                                <Input id="school" name="school" defaultValue={student.school} required className="input-custom-styles"/>
                            </div>
                            <div>
                                <Label htmlFor="grade_level">Grade Level</Label>
                                <Select name="grade_level" defaultValue={student.grade_level || undefined} required>
                                    <SelectTrigger id="grade_level"><SelectValue
                                        placeholder="Select grade"/></SelectTrigger>
                                    <SelectContent>
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
                                <Input id="cell_phone" name="cell_phone" type="tel"
                                       defaultValue={student.cell_phone || ''} className="input-custom-styles"/>
                            </div>
                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" defaultValue={student.email || ''} className="input-custom-styles"/>
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
                                />
                                <Label htmlFor="immunizations_up_to_date">Immunizations Up-to-Date?</Label>
                            </div>
                            <div className="md:col-span-2"> {/* Span across columns */}
                                <Label htmlFor="immunization_notes">Immunization Notes</Label>
                                <Textarea id="immunization_notes" name="immunization_notes"
                                          defaultValue={student.immunization_notes || ''} rows={2} className="input-custom-styles"/>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="allergies">Allergies</Label>
                                <Textarea id="allergies" name="allergies" defaultValue={student.allergies || ''}
                                          rows={2} className="input-custom-styles"/>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="medications">Medications</Label>
                                <Textarea id="medications" name="medications" defaultValue={student.medications || ''}
                                          rows={2} className="input-custom-styles"/>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="special_needs">Special Needs</Label>
                                <Textarea id="special_needs" name="special_needs"
                                          defaultValue={student.special_needs || ''} rows={2} className="input-custom-styles"/>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-4 mt-6">
                        <Button type="button" variant="outline" onClick={() => setIsEditing(false)}
                                disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </Form>
            ) : (
                // --- View Mode ---
                <>
                    {/* Display Student Information */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">General</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <p><strong>First Name:</strong> {student.first_name}</p>
                            <p><strong>Last Name:</strong> {student.last_name}</p>
                            <p><strong>Gender:</strong> {student.gender}</p>
                            <p><strong>Birth Date:</strong> {formatDate(student.birth_date, { formatString: 'P' })}</p>
                            {/* Wrap belt display in <p> for consistent styling */}
                            <p className="flex items-center">
                                <strong className="mr-2">Current Belt:</strong> {/* Updated Label */}
                                {currentBeltRank ? (
                                    <span className="flex items-center"> {/* Use span for inline display */}
                                        <div
                                            className={`h-4 w-8 rounded mr-2 ${beltColorMap[currentBeltRank] || 'bg-gray-400'}`}></div>
                     <span className="capitalize">{currentBeltRank}</span>
                   </span>
                                ) : (
                                    'N/A'
                                )}
                            </p>
                            <p><strong>T-Shirt Size:</strong> {student.t_shirt_size}</p>
                            <p><strong>School:</strong> {student.school}</p>
                            <p><strong>Grade Level:</strong> {student.grade_level}</p>
                            <p><strong>Cell Phone:</strong> {student.cell_phone || 'N/A'}</p>
                            <p><strong>Email:</strong> {student.email || 'N/A'}</p>
                        </div>
                    </div>

                    {/* Health Information Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Health</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <p><strong>Immunizations
                                Up-to-Date:</strong> {student.immunizations_up_to_date === 'true' ? 'Yes' : 'No'}</p>
                            <p><strong>Immunization Notes:</strong> {student.immunization_notes || 'None'}</p>
                            <p><strong>Allergies:</strong> {student.allergies || 'None'}</p>
                            <p><strong>Medications:</strong> {student.medications || 'None'}</p>
                            <p><strong>Special Needs:</strong> {student.special_needs || 'None'}</p>
                        </div>
                    </div>

                    {/* Enrollments Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Class Enrollments</h2>
                        {enrollments && enrollments.length > 0 ? (
                            <div className="space-y-4">
                                {enrollments.map((enrollment) => (
                                    <div key={enrollment.id}
                                         className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 shadow">
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <h3 className="font-medium text-gray-800 dark:text-gray-100">
                                                    {enrollment.classes?.name || 'Unknown Class'}
                                                </h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    Program: {enrollment.classes?.programs?.name || 'Unknown Program'}
                                                </p>
                                            </div>
                                            <Badge 
                                                variant={enrollment.status === 'active' ? 'default' : 
                                                        enrollment.status === 'waitlist' ? 'secondary' : 
                                                        enrollment.status === 'completed' ? 'outline' : 'destructive'}
                                                className="capitalize"
                                            >
                                                {enrollment.status}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            <p>Enrolled: {formatDate(enrollment.enrolled_at, { formatString: 'MMM d, yyyy' })}</p>
                                            {enrollment.completed_at && (
                                                <p>Completed: {formatDate(enrollment.completed_at, { formatString: 'MMM d, yyyy' })}</p>
                                            )}
                                            {enrollment.dropped_at && (
                                                <p>Dropped: {formatDate(enrollment.dropped_at, { formatString: 'MMM d, yyyy' })}</p>
                                            )}
                                            {enrollment.notes && (
                                                <p className="mt-2">Notes: {enrollment.notes}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-600 dark:text-gray-400">No class enrollments found.</p>
                        )}
                    </div>

                    {/* Belt Awards Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Belt Awards</h2>
                        {beltAwards && beltAwards.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {beltAwards.map((beltAward) => (
                                    <div key={beltAward.id}
                                         className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 shadow">
                                        <div className="flex items-center mb-2">
                                            {/* Belt Visual */}
                                            <div
                                                className={`h-5 w-10 rounded mr-3 ${beltColorMap[beltAward.type] || 'bg-gray-400'}`}></div>
                                            {/* Belt Name (Capitalized) */}
                                            <p className="font-medium text-gray-800 dark:text-gray-100 capitalize">{beltAward.type}</p>
                                        </div>
                                        {/* Optional Description */}
                                        {beltAward.description && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{beltAward.description}</p>
                                        )}
                                        {/* Awarded Date */}
                                        <Badge variant="secondary"
                                               className="text-xs w-full text-center justify-center">
                                            Awarded: {formatDate(beltAward.awarded_date, { formatString: 'MMM d, yyyy' })}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-600 dark:text-gray-400">No belt awards recorded yet.</p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap justify-between items-center gap-4 mt-6">
                        <div className="flex gap-4">
                            <Button variant="outline" onClick={() => {
                                setIsEditing(true);
                                setHasJustSubmitted(false); // Clear the flag when entering edit mode
                            }}>
                                Edit Student
                            </Button>
                            <Button asChild variant="secondary">
                                <Link to="/family/attendance">View Attendance</Link>
                            </Button>
                            {/* Add Purchase Gi Button */}
                            <Button asChild variant="default">
                                <Link to={`/family/store/purchase/${student.id}`}>Purchase Gi</Link>
                            </Button>
                        </div>

                        {/* Delete Button triggers Dialog */}
                        <Button
                            type="button" // Change type
                            variant="destructive"
                            onClick={() => setIsDeleteDialogOpen(true)} // Open dialog
                            disabled={isSubmitting && formIntent === 'delete'}
                        >
                            {isSubmitting && formIntent === 'delete' ? 'Deleting...' : 'Delete Student'}
                        </Button>
                    </div>

                    {/* Delete Confirmation Dialog */}
                    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the student
                                    <span className="font-semibold"> {student.first_name} {student.last_name}</span> and remove their data from our servers.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isSubmitting && formIntent === 'delete'}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => {
                                        const formData = new FormData();
                                        formData.append('intent', 'delete');
                                        submit(formData, { method: 'post', replace: true });
                                    }}
                                    disabled={isSubmitting && formIntent === 'delete'}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    {isSubmitting && formIntent === 'delete' ? 'Deleting...' : 'Delete Student'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}

            {/* Display action feedback if needed - Moved to top */}
            {/* {actionData?.error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )} */}
        </div>
    );
}

// Add an ErrorBoundary specific to this route if needed
// export function ErrorBoundary() { ... }
