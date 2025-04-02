import {useEffect, useState} from "react";
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect, TypedResponse} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Button} from "~/components/ui/button";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Textarea} from "~/components/ui/textarea";
import {Checkbox} from "~/components/ui/checkbox";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import type {Database} from "~/types/supabase";
import {Badge} from "~/components/ui/badge"; // Import Badge
import {format} from 'date-fns'; // Import date-fns
import {beltColorMap} from "~/utils/constants";

// Define types based on updated Supabase schema
type BeltRankEnum = Database['public']['Enums']['belt_rank_enum'];
type StudentRow = Omit<Database['public']['Tables']['students']['Row'], 'belt_rank'>; // Omit removed column
type BeltAwardRow = Database['public']['Tables']['belt_awards']['Row']; // Use BeltAwardRow

// Extend loader data type to include derived current belt
type LoaderData = {
    student: StudentRow;
    beltAwards: BeltAwardRow[];
    currentBeltRank: BeltRankEnum | null; // Add derived current belt rank
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

    // Return the student data, belt awards, and derived current rank
    return json({
        student: studentData as StudentRow,
        beltAwards: beltAwardsData as BeltAwardRow[],
        currentBeltRank: currentBeltRank
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
        // Add checks for related data if necessary (e.g., attendance, payments) before deleting
        const {error: deleteError} = await supabaseServer
            .from('students')
            .delete()
            .eq('id', studentId);

        if (deleteError) {
            console.error("Error deleting student:", deleteError);
            return json({error: "Failed to delete student. " + deleteError.message}, {status: 500, headers});
        }

        // Redirect to family page after successful deletion
        return redirect("/family", {headers});
    }

    // --- Handle Edit Intent ---
    if (intent === "edit") {
        // Basic validation example (enhance with Zod if needed)
        const firstName = formData.get('first_name') as string;
        const lastName = formData.get('last_name') as string;
        // Add validation for other required fields...

        if (!firstName || !lastName) {
            return json({
                error: "First name and last name are required.",
                fieldErrors: {first_name: !firstName ? 'Required' : '', last_name: !lastName ? 'Required' : ''}
            }, {status: 400, headers});
        }

        const updateData: Partial<StudentRow> = {
            first_name: firstName,
            last_name: lastName,
            gender: formData.get('gender') as string,
            birth_date: formData.get('birth_date') as string,
            cell_phone: formData.get('cell_phone') as string || null,
            email: formData.get('email') as string || null,
            t_shirt_size: formData.get('t_shirt_size') as string,
            school: formData.get('school') as string,
            grade_level: formData.get('grade_level') as string,
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
            .eq('id', studentId)
            .select() // Optionally select the updated data
            .single();

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
    // Update to use the extended LoaderData type including currentBeltRank
    const {student, beltAwards, currentBeltRank} = useLoaderData<LoaderData>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const [isEditing, setIsEditing] = useState(false);

    const isSubmitting = navigation.state === "submitting";

    // Reset edit mode on successful update
    useEffect(() => {
        if (actionData?.success && isEditing) {
            setIsEditing(false);
        }
    }, [actionData, isEditing]);


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
            {actionData?.success && actionData.message && (
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
                                <Input id="first_name" name="first_name" defaultValue={student.first_name} required/>
                                {actionData?.fieldErrors?.first_name &&
                                    <p className="text-red-500 text-sm">{actionData.fieldErrors.first_name}</p>}
                            </div>
                            <div>
                                <Label htmlFor="last_name">Last Name</Label>
                                <Input id="last_name" name="last_name" defaultValue={student.last_name} required/>
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
                                       required/>
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
                                <Input id="school" name="school" defaultValue={student.school} required/>
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
                                       defaultValue={student.cell_phone || ''}/>
                            </div>
                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" defaultValue={student.email || ''}/>
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
                                          defaultValue={student.immunization_notes || ''} rows={2}/>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="allergies">Allergies</Label>
                                <Textarea id="allergies" name="allergies" defaultValue={student.allergies || ''}
                                          rows={2}/>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="medications">Medications</Label>
                                <Textarea id="medications" name="medications" defaultValue={student.medications || ''}
                                          rows={2}/>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="special_needs">Special Needs</Label>
                                <Textarea id="special_needs" name="special_needs"
                                          defaultValue={student.special_needs || ''} rows={2}/>
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
                            <p><strong>Birth Date:</strong> {new Date(student.birth_date).toLocaleDateString()}</p>
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
                                Up-to-Date:</strong> {student.immunizations_up_to_date ? 'Yes' : 'No'}</p>
                            <p><strong>Immunization Notes:</strong> {student.immunization_notes || 'None'}</p>
                            <p><strong>Allergies:</strong> {student.allergies || 'None'}</p>
                            <p><strong>Medications:</strong> {student.medications || 'None'}</p>
                            <p><strong>Special Needs:</strong> {student.special_needs || 'None'}</p>
                        </div>
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
                                            Awarded: {format(new Date(beltAward.awarded_date), 'MMM d, yyyy')}
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
                            <Button variant="outline" onClick={() => setIsEditing(true)}>
                                Edit Student
                            </Button>
                            <Button asChild variant="secondary">
                                <Link to="/family/attendance">View Attendance</Link>
                            </Button>
                        </div>

                        {/* Delete Form */}
                        <Form
                            method="post"
                            onSubmit={(e) => {
                                if (!confirm(`Are you sure you want to delete student ${student.first_name} ${student.last_name}? This cannot be undone.`)) {
                                    e.preventDefault();
                                }
                            }}
                        >
                            <input type="hidden" name="intent" value="delete"/>
                            <Button type="submit" variant="destructive" disabled={isSubmitting}>
                                {isSubmitting ? 'Deleting...' : 'Delete Student'}
                            </Button>
                        </Form>
                    </div>
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
