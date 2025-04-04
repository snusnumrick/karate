import {useEffect, useState} from "react"; // Import useState and useEffect
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, TypedResponse} from "@remix-run/node"; // Import ActionFunctionArgs, redirect
import {Form, Link, useActionData, useLoaderData, useNavigate, useNavigation, useRouteError} from "@remix-run/react"; // Import Form, useActionData, useNavigation
import {createClient} from '@supabase/supabase-js';
import type {Database} from "~/types/supabase";
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input"; // Import Input
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
} from "~/components/ui/alert-dialog"; // Import AlertDialog
import {format} from 'date-fns';
import {beltColorMap} from "~/utils/constants";

// Define types
type StudentRow = Omit<Database['public']['Tables']['students']['Row'], 'belt_rank'>; // Omit removed column
type FamilyRow = Database['public']['Tables']['families']['Row'];
type BeltRankEnum = Database['public']['Enums']['belt_rank_enum'];

// Extend student type to include family name and current belt
type IndividualSessionRow = Database['public']['Tables']['one_on_one_sessions']['Row']; // Renamed type alias

// Extend student type to include family name, current belt, and family's individual session balance
type StudentWithDetails = StudentRow & {
    families: Pick<FamilyRow, 'id' | 'name'> | null;
    currentBeltRank: BeltRankEnum | null;
    familyIndividualSessionBalance: number; // Renamed balance field
    availableIndividualSessions: Pick<IndividualSessionRow, 'id' | 'quantity_remaining' | 'purchase_date'>[]; // Renamed available sessions field
};

type LoaderData = {
    student: StudentWithDetails; // Update type
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


export async function loader({params}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const studentId = params.studentId;
    if (!studentId) {
        throw new Response("Student ID is required", {status: 400});
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin student detail loader: Missing Supabase URL or Service Role Key env variables.");
        throw new Response("Server configuration error.", {status: 500});
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Fetch student data and related family name using service role
    const {data: studentData, error} = await supabaseAdmin
        .from('students')
        .select(`*, families ( id, name )`)
        .eq('id', studentId)
        .single();

    if (error || !studentData) {
        console.error("Error fetching student for admin view:", error?.message);
        throw new Response("Student not found", {status: 404});
    }

    // Fetch the latest belt award for the student
    const {data: latestBeltAward, error: beltError} = await supabaseAdmin
        .from('belt_awards')
        .select('type')
        .eq('student_id', studentId)
        .order('awarded_date', {ascending: false})
        .limit(1)
        .maybeSingle();

    if (beltError) {
        console.error(`Error fetching latest belt for student ${studentId}:`, beltError.message);
        // Handle error as needed, here we'll proceed with null belt rank
    }

    // Combine student data with the derived belt rank
    const studentWithDetails: StudentWithFamilyAndBelt = {
        ...studentData,
        families: studentData.families ?? null,
        currentBeltRank: latestBeltAward?.type ?? null, // Keep belt rank logic
    };

    // Fetch family's individual session balance
    let familyIndividualSessionBalance = 0;
    if (studentWithDetails.families?.id) {
        const { data: balanceData, error: balanceError } = await supabaseAdmin
            .from('family_one_on_one_balance') // View name remains the same
            .select('total_remaining_sessions')
            .eq('family_id', studentWithDetails.families.id)
            .maybeSingle();

        if (balanceError) {
            console.error(`Error fetching Individual Session balance for family ${studentWithDetails.families.id}:`, balanceError.message);
        } else if (balanceData) {
            familyIndividualSessionBalance = balanceData.total_remaining_sessions ?? 0;
        }
    }

    // Fetch available individual session purchase records for the family (with remaining > 0)
    let availableIndividualSessions: Pick<IndividualSessionRow, 'id' | 'quantity_remaining' | 'purchase_date'>[] = [];
    if (studentWithDetails.families?.id) {
        const { data: sessionsData, error: sessionsError } = await supabaseAdmin
            .from('one_on_one_sessions') // Table name remains the same
            .select('id, quantity_remaining, purchase_date')
            .eq('family_id', studentWithDetails.families.id)
            .gt('quantity_remaining', 0) // Only fetch sessions with a balance
            .order('purchase_date', { ascending: true }); // Use oldest sessions first (FIFO)

        if (sessionsError) {
            console.error(`Error fetching available Individual Sessions for family ${studentWithDetails.families.id}:`, sessionsError.message);
        } else {
            availableIndividualSessions = sessionsData ?? [];
        }
    }


    // Add balance and available sessions to the student object
    const finalStudentData: StudentWithDetails = {
        ...studentWithDetails,
        familyIndividualSessionBalance, // Use renamed field
        availableIndividualSessions, // Use renamed field
    };

    return json({student: finalStudentData}); // Return combined data
}

// Action function to handle student updates
export async function action({request, params}: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const studentId = params.studentId;
    if (!studentId) {
        return json({error: "Student ID is required"}, {status: 400});
    }

    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return json({error: "Server configuration error."}, {status: 500});
    }
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // --- Get Current User ID (for recording who used the session) ---
    // Note: This requires auth context, which might not be directly available here.
    // We might need to adjust how we get the admin user ID.
    // For now, let's assume we can get it or make it nullable.
    // const { data: { user } } = await supabaseAdmin.auth.getUser(); // This uses service key, won't get request user
    // Placeholder - Ideally, pass user ID from a secure context if needed.
    const adminUserId: string | null = null; // TODO: Get actual admin user ID if required by policy/audit trail

    // --- Handle "Record Individual Session Usage" Intent ---
    if (intent === "recordUsage") {
        const sessionPurchaseId = formData.get("sessionPurchaseId") as string;
        const usageDate = formData.get("usageDate") as string || format(new Date(), 'yyyy-MM-dd'); // Default to today
        const notes = formData.get("notes") as string | null;

        if (!sessionPurchaseId) {
            return json({error: "Session purchase ID is required to record usage."}, {status: 400});
        }

        try {
            // Use Supabase Edge Function (RPC) for transactional update if possible,
            // otherwise, perform operations sequentially (less safe).
            // Let's assume sequential for now.

            // 1. Fetch the session to ensure it still has remaining quantity
            const { data: sessionData, error: fetchError } = await supabaseAdmin
                .from('one_on_one_sessions')
                .select('quantity_remaining, family_id') // Fetch family_id for verification if needed
                .eq('id', sessionPurchaseId)
                .single();

            if (fetchError || !sessionData) {
                return json({error: `Session purchase record not found or error fetching: ${fetchError?.message}`}, {status: 404});
            }

            if (sessionData.quantity_remaining <= 0) {
                return json({error: "Selected session has no remaining quantity."}, {status: 400});
            }

            // 2. Decrement the quantity_remaining
            const { error: updateError } = await supabaseAdmin
                .from('one_on_one_sessions')
                .update({ quantity_remaining: sessionData.quantity_remaining - 1, updated_at: new Date().toISOString() })
                .eq('id', sessionPurchaseId);

            if (updateError) {
                console.error(`Error decrementing session ${sessionPurchaseId}:`, updateError.message);
                return json({error: `Failed to update session balance: ${updateError.message}`}, {status: 500});
            }

            // 3. Insert the usage record
            const { error: usageInsertError } = await supabaseAdmin
                .from('one_on_one_session_usage')
                .insert({
                    session_purchase_id: sessionPurchaseId,
                    student_id: studentId,
                    usage_date: usageDate,
                    notes: notes,
                    recorded_by: adminUserId, // Link to admin if available
                });

            if (usageInsertError) {
                console.error(`Error inserting usage record for session ${sessionPurchaseId}:`, usageInsertError.message);
                // Attempt to rollback decrement? Difficult without transactions. Log critical error.
                // For now, return success but maybe with a warning? Or return error? Let's return error.
                // Consider adding the quantity back if usage insert fails.
                 await supabaseAdmin
                    .from('one_on_one_sessions')
                    .update({ quantity_remaining: sessionData.quantity_remaining, updated_at: new Date().toISOString() })
                    .eq('id', sessionPurchaseId); // Attempt rollback
                return json({error: `Failed to record session usage details: ${usageInsertError.message}`}, {status: 500});
            }

            // 4. Fetch the updated balance for the family
            let newBalance: number | null = null;
            if (sessionData.family_id) {
                const { data: balanceData, error: balanceFetchError } = await supabaseAdmin
                    .from('family_one_on_one_balance')
                    .select('total_remaining_sessions')
                    .eq('family_id', sessionData.family_id)
                    .maybeSingle();

                if (balanceFetchError) {
                    console.error(`Error fetching updated balance for family ${sessionData.family_id}:`, balanceFetchError.message);
                    // Proceed without balance in message if fetch fails
                } else {
                    newBalance = balanceData?.total_remaining_sessions ?? 0;
                }
            }

            console.log(`Successfully recorded usage for session ${sessionPurchaseId} by student ${studentId}. New balance: ${newBalance}`);
            // Return success with intent, message, and new balance
            return json({
                intent: "recordUsage",
                success: true,
                message: "Individual Session usage recorded successfully.",
                newBalance: newBalance
            });

        } catch (error) {
            console.error("Admin record Individual Session usage error:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            return json({error: `Failed to record usage: ${errorMessage}`}, {status: 500});
        }
    }

    // --- Handle "Edit Student" Intent ---
    if (intent === "edit") {
        // --- Data Extraction ---
        const updateData: Partial<StudentRow> = {
            first_name: formData.get('first_name') as string,
            last_name: formData.get('last_name') as string,
        gender: formData.get('gender') as string,
        birth_date: formData.get('birth_date') as string,
        cell_phone: formData.get('cell_phone') as string || null,
        email: formData.get('email') as string || null,
        t_shirt_size: formData.get('t_shirt_size') as string,
        school: formData.get('school') as string,
        grade_level: formData.get('grade_level') as string || null,
        special_needs: formData.get('special_needs') as string || null,
        allergies: formData.get('allergies') as string || null,
        medications: formData.get('medications') as string || null,
        immunizations_up_to_date: formData.get('immunizations_up_to_date') === 'on' ? 'true' : 'false',
        immunization_notes: formData.get('immunization_notes') as string || null,
        // belt_rank is removed from updateData
    };

    // --- Basic Validation ---
    const fieldErrors: ActionData['fieldErrors'] = {};
    if (!updateData.first_name) fieldErrors.first_name = "First name is required.";
    if (!updateData.last_name) fieldErrors.last_name = "Last name is required.";
    if (!updateData.gender) fieldErrors.gender = "Gender is required.";
    if (!updateData.birth_date) fieldErrors.birth_date = "Birth date is required.";
    if (!updateData.t_shirt_size) fieldErrors.t_shirt_size = "T-shirt size is required.";
    if (!updateData.school) fieldErrors.school = "School is required.";
    // Add more validation as needed

    if (Object.values(fieldErrors).some(Boolean)) {
        return json({error: "Please correct the errors below.", fieldErrors}, {status: 400});
    }

    // --- Database Interaction ---
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return json({error: "Server configuration error."}, {status: 500});
    }
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        const {error: updateError} = await supabaseAdmin
            .from('students')
            .update(updateData)
            .eq('id', studentId);

        if (updateError) throw updateError;

        return json({success: true, message: "Student details updated successfully."});

    } catch (error) {
        console.error("Admin student update error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return json({error: `Failed to update student: ${errorMessage}`}, {status: 500});
    }
    } // <-- Add missing closing brace for the "if (intent === 'edit')" block

    // Fallback for unknown intent
    return json({error: `Invalid intent: ${intent}`}, {status: 400});
}


export default function AdminStudentDetailPage() {
    const {student} = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const navigate = useNavigate(); // Get navigate function
    const [isEditing, setIsEditing] = useState(false); // State for edit mode

    const isSubmitting = navigation.state === "submitting";

    // Reset edit mode on successful update
    useEffect(() => {
        if (actionData?.success && isEditing && navigation.state === 'idle') {
            setIsEditing(false);
        }
    }, [actionData, isEditing, navigation.state]);

    return (
        <div className="container mx-auto px-4 py-8">
            <Link to="/admin/students" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to
                Student List</Link>

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
            {/* Success message for Record Usage */}
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

            {isEditing ? (
                // --- Edit Form ---
                <Form method="post" className="space-y-6">
                    <input type="hidden" name="intent" value="edit"/>

                    {/* Information Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Edit Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="first_name">First Name <span className="text-red-500">*</span></Label>
                                <Input id="first_name" name="first_name" defaultValue={student.first_name} required/>
                                {actionData?.fieldErrors?.first_name &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.first_name}</p>}
                            </div>
                            <div>
                                <Label htmlFor="last_name">Last Name <span className="text-red-500">*</span></Label>
                                <Input id="last_name" name="last_name" defaultValue={student.last_name} required/>
                                {actionData?.fieldErrors?.last_name &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.last_name}</p>}
                            </div>
                            <div>
                                <Label htmlFor="gender">Gender <span className="text-red-500">*</span></Label>
                                <Select name="gender" defaultValue={student.gender} required>
                                    <SelectTrigger id="gender"><SelectValue
                                        placeholder="Select gender"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                                {actionData?.fieldErrors?.gender &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.gender}</p>}
                            </div>
                            <div>
                                <Label htmlFor="birth_date">Birth Date <span className="text-red-500">*</span></Label>
                                <Input id="birth_date" name="birth_date" type="date" defaultValue={student.birth_date}
                                       required/>
                                {actionData?.fieldErrors?.birth_date &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.birth_date}</p>}
                            </div>
                            {/* Belt Rank Select Removed */}
                            <div>
                                <Label htmlFor="t_shirt_size">T-Shirt Size <span
                                    className="text-red-500">*</span></Label>
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
                                {actionData?.fieldErrors?.t_shirt_size &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.t_shirt_size}</p>}
                            </div>
                            <div>
                                <Label htmlFor="school">School <span className="text-red-500">*</span></Label>
                                <Input id="school" name="school" defaultValue={student.school} required/>
                                {actionData?.fieldErrors?.school &&
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.school}</p>}
                            </div>
                            <div>
                                <Label htmlFor="grade_level">Grade Level</Label>
                                <Select name="grade_level" defaultValue={student.grade_level || ''}>
                                    <SelectTrigger id="grade_level"><SelectValue
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
                            <div className="md:col-span-2">
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
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <p><strong>First Name:</strong> {student.first_name}</p>
                            <p><strong>Last Name:</strong> {student.last_name}</p>
                            <p><strong>Family:</strong> {student.families ?
                                <Link to={`/admin/families/${student.families.id}`}
                                      className="text-blue-600 hover:underline">{student.families.name}</Link> : 'N/A'}
                            </p>
                            <p><strong>Gender:</strong> {student.gender}</p>
                            <p><strong>Birth Date:</strong> {format(new Date(student.birth_date), 'PPP')}
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
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Record Individual Session Usage</h2>
                        {student.familyIndividualSessionBalance > 0 ? ( // Use renamed field
                            <Form method="post" id="record-usage-form" className="space-y-4"> {/* Add form ID */}
                                <input type="hidden" name="intent" value="recordUsage"/>
                                <div>
                                    <Label htmlFor="sessionPurchaseId">Session Batch</Label>
                                    <Select name="sessionPurchaseId" required>
                                        <SelectTrigger id="sessionPurchaseId">
                                            <SelectValue placeholder="Select session batch to use"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {student.availableIndividualSessions.map(session => ( // Use renamed field
                                                <SelectItem key={session.id} value={session.id}>
                                                    Purchased: {format(new Date(session.purchase_date), 'yyyy-MM-dd')} - Remaining: {session.quantity_remaining}
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
                                    <Input id="usageDate" name="usageDate" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
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
                                                Are you sure you want to record the usage of one individual session for this student? This will decrement the family's balance.
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
                                This student's family has no available Individual Sessions.
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

    if (error instanceof Response) {
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
            <Link to="/admin/students" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to
                Student List</Link>
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <h2 className="text-xl font-bold mb-2">Error Loading Student Details ({errorStatus})</h2>
                <p>{errorMessage}</p>
            </div>
        </div>
    );
}
