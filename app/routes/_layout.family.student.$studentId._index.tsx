import {useEffect, useState} from "react";
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect, TypedResponse} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation, useSubmit} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import { createClient } from '@supabase/supabase-js'; // Import createClient
import { getStudentPaymentOptions, type StudentPaymentOptions } from '~/services/enrollment-payment.server';
import { getFamilyIndividualSessions, type IndividualSessionInfo, getStudentPaymentEligibilityData, type PaymentEligibilityData } from '~/services/payment-eligibility.server';
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
import { StudentPaymentSection } from '~/components/StudentPaymentSection';
import { AppBreadcrumb, breadcrumbPatterns } from '~/components/AppBreadcrumb';

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
    paymentOptions: StudentPaymentOptions | null; // Add payment options
    individualSessions: IndividualSessionInfo | null; // Add individual session info
    paymentEligibilityData: PaymentEligibilityData | null; // Add payment eligibility data
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

    // Fetch payment options for the student
    let paymentOptions: StudentPaymentOptions | null = null;
    try {
        paymentOptions = await getStudentPaymentOptions(studentId, supabaseServer);
    } catch (error) {
        console.error('Error fetching payment options:', error);
        // Don't fail the page load, just set to null
    }

    // Fetch individual session information for the family
    let individualSessions: IndividualSessionInfo | null = null;
    try {
        individualSessions = await getFamilyIndividualSessions(studentData.family_id, supabaseServer);
    } catch (error) {
        console.error('Error fetching individual sessions:', error);
        // Don't fail the page load, just set to null
    }

    // Fetch payment eligibility data for the student
    let paymentEligibilityData: PaymentEligibilityData | null = null;
    try {
        paymentEligibilityData = await getStudentPaymentEligibilityData(studentId, supabaseServer);
    } catch (error) {
        console.error('Error fetching payment eligibility data:', error);
        // Don't fail the page load, just set to null
    }
    console.log('eligibility', paymentEligibilityData?.studentPaymentDetails[0]?.eligibility);

    // Return the student data, belt awards, derived current rank, enrollments, payment options, individual sessions, and payment eligibility data
    return json({
        student: studentData as StudentRow,
        beltAwards: beltAwardsData as BeltAwardRow[],
        currentBeltRank: currentBeltRank,
        enrollments: enrollments,
        paymentOptions: paymentOptions,
        individualSessions: individualSessions,
        paymentEligibilityData: paymentEligibilityData
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
    console.log(`[Action/EditStudent] Received form submission for student ID: ${studentId} with intent: ${intent}`);
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
    const {student, beltAwards, currentBeltRank, enrollments, paymentOptions, individualSessions, paymentEligibilityData} = useLoaderData<LoaderData>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const submit = useSubmit(); // Get submit hook
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // State for delete dialog
    const [hasJustSubmitted, setHasJustSubmitted] = useState(false); // Track if we just submitted
    const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null); // Track selected enrollment

    // Sort enrollments: active with monthly payments first
    const sortedEnrollments = [...enrollments].sort((a, b) => {
        const aIsActive = a.status === 'active';
        const bIsActive = b.status === 'active';

        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;

        // Find payment options for each enrollment
        const aPaymentOption = paymentOptions?.enrollments.find(p => p.enrollmentId === a.id);
        const bPaymentOption = paymentOptions?.enrollments.find(p => p.enrollmentId === b.id);

        // Check if monthly payment is supported
        const aHasMonthly = aPaymentOption?.supportedPaymentTypes.includes('monthly_subscription') ?? false;
        const bHasMonthly = bPaymentOption?.supportedPaymentTypes.includes('monthly_subscription') ?? false;

        if (aHasMonthly && !bHasMonthly) return -1;
        if (!aHasMonthly && bHasMonthly) return 1;

        return 0;
    });

    // Auto-select first enrollment on load
    useEffect(() => {
        if (sortedEnrollments && sortedEnrollments.length > 0 && !selectedEnrollmentId) {
            const firstEnrollment = sortedEnrollments[0];
            setSelectedEnrollmentId(firstEnrollment.id);
        }
    }, [sortedEnrollments, selectedEnrollmentId]);

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

    // Helper function to get payment section subtitle
    const getPaymentSubtitle = () => {
        if (!selectedEnrollmentId) {
            return `Manage payments for ${student.first_name} ${student.last_name}`;
        }
        const selectedEnrollment = sortedEnrollments?.find(e => e.id === selectedEnrollmentId);
        const className = selectedEnrollment?.classes?.name || 'selected class';
        return `Make a payment for ${className}`;
    };

    // Helper function to get badge variant for enrollment status
    const getEnrollmentBadgeVariant = (status: string) => {
        switch (status) {
            case 'active': return 'default';
            case 'trial': return 'default';
            case 'waitlist': return 'secondary';
            case 'completed': return 'outline';
            default: return 'destructive';
        }
    };
    // Helper function to render enrollment-specific payment options
    const renderEnrollmentPaymentSection = () => {
        // Check if there are any active or trial enrollments
        const hasActiveEnrollments = sortedEnrollments && sortedEnrollments.some(e => e.status === 'active' || e.status === 'trial');
        
        if (!hasActiveEnrollments) {
            return (
                <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">No Active Enrollments</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Payment options are only available when the student has active or trial enrollments.
                    </p>
                </div>
            );
        }

        // Combined payment section rendering logic
        if (!selectedEnrollmentId) {
            return (
                <div className="space-y-6">
                    <StudentPaymentSection
                        familyId={student.family_id}
                        paymentOptions={paymentOptions}
                        appearance="simplified" 
                        paymentEligibilityData={paymentEligibilityData}
                    />
                    
                    {sortedEnrollments && sortedEnrollments.some(e => e.status === 'active') && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">💡 Select an Enrollment Above</h3>
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                Click on any active enrollment card above to see specific payment options for that class.
                            </p>
                        </div>
                    )}
                </div>
            );
        }
        
        const selectedEnrollment = sortedEnrollments?.find(e => e.id === selectedEnrollmentId);
        if (!selectedEnrollment) return null;
        
        if (selectedEnrollment.status === 'active' || selectedEnrollment.status === 'trial') {
            return (
                <div className="space-y-6">
                    <StudentPaymentSection 
                        familyId={student.family_id}
                        paymentOptions={paymentOptions}
                        enrollmentId={selectedEnrollmentId}
                        appearance="simplified"
                        paymentEligibilityData={paymentEligibilityData}
                    />
                </div>
            );
        }
        
        return (
            <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Enrollment Not Active</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    This enrollment is {selectedEnrollment.status}. Payment options are only available for active and trial enrollments.
                </p>
            </div>
        );
    };


    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl student-payment-page">
            <AppBreadcrumb 
                items={isEditing 
                    ? [
                        { label: "Family Portal", href: "/family" },
                        { label: `${student.first_name} ${student.last_name}`, onClick: () => setIsEditing(false) },
                        { label: "Edit", current: true },
                      ]
                    : breadcrumbPatterns.familyStudentDetail(student.first_name, student.last_name)
                } 
                className="mb-6" 
            />

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {student.first_name} {student.last_name}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Student Profile</p>
            </div>

            {/* Display action feedback */}
            {actionData?.error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}
            {actionData?.success && actionData.message && !isEditing && (
                <Alert variant="default"
                       className="mb-6 bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
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
                                <Input id="first_name" name="first_name" autoComplete="given-name" defaultValue={student.first_name} required className="input-custom-styles"/>
                                {actionData?.fieldErrors?.first_name &&
                                    <p className="text-red-500 text-sm">{actionData.fieldErrors.first_name}</p>}
                            </div>
                            <div>
                                <Label htmlFor="last_name">Last Name</Label>
                                <Input id="last_name" name="last_name" autoComplete="family-name" defaultValue={student.last_name} required className="input-custom-styles"/>
                                {actionData?.fieldErrors?.last_name &&
                                    <p className="text-red-500 text-sm">{actionData.fieldErrors.last_name}</p>}
                            </div>
                            <div>
                                <Label htmlFor="gender">Gender</Label>
                                <Select name="gender" defaultValue={student.gender} required>
                                    <SelectTrigger id="gender" className="input-custom-styles"><SelectValue
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
                                    <SelectTrigger id="t_shirt_size" className="input-custom-styles"><SelectValue
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
                                    <SelectTrigger id="grade_level" className="input-custom-styles"><SelectValue
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
                                <Input id="cell_phone" name="cell_phone" type="tel" autoComplete="mobile tel"
                                       defaultValue={student.cell_phone || ''} className="input-custom-styles"/>
                            </div>
                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" autoComplete="email" defaultValue={student.email || ''} className="input-custom-styles"/>
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
                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        {/* Left Column - Student Info */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Basic Information Card */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Basic Information</h2>
                                </div>
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Gender</span>
                                                <p className="text-gray-900 dark:text-gray-100">{student.gender}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Birth Date</span>
                                                <p className="text-gray-900 dark:text-gray-100">{formatDate(student.birth_date, { formatString: 'P' })}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">T-Shirt Size</span>
                                                <p className="text-gray-900 dark:text-gray-100">{student.t_shirt_size}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">School</span>
                                                <p className="text-gray-900 dark:text-gray-100">{student.school}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Grade Level</span>
                                                <p className="text-gray-900 dark:text-gray-100">{student.grade_level}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact</span>
                                                <div className="space-y-1">
                                                    {student.cell_phone && <p className="text-gray-900 dark:text-gray-100 text-sm">{student.cell_phone}</p>}
                                                    {student.email && <p className="text-gray-900 dark:text-gray-100 text-sm">{student.email}</p>}
                                                    {!student.cell_phone && !student.email && <p className="text-gray-500 dark:text-gray-400 text-sm">No contact info</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Health Information Card */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Health Information</h2>
                                </div>
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Immunizations</span>
                                                <p className="text-gray-900 dark:text-gray-100">{student.immunizations_up_to_date === 'true' ? 'Up-to-Date' : 'Not Current'}</p>
                                                {student.immunization_notes && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{student.immunization_notes}</p>
                                                )}
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Allergies</span>
                                                <p className="text-gray-900 dark:text-gray-100">{student.allergies || 'None reported'}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Medications</span>
                                                <p className="text-gray-900 dark:text-gray-100">{student.medications || 'None reported'}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Special Needs</span>
                                                <p className="text-gray-900 dark:text-gray-100">{student.special_needs || 'None reported'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Current Status */}
                        <div className="space-y-6">
                            {/* Current Belt Status */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Current Status</h2>
                                </div>
                                <div className="p-6">
                                    <div className="text-center">
                                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Belt</span>
                                        {currentBeltRank ? (
                                            <div className="mt-3">
                                                <div className={`h-8 w-16 rounded mx-auto mb-2 ${beltColorMap[currentBeltRank] || 'bg-gray-400'}`}></div>
                                                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">{currentBeltRank}</p>
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 dark:text-gray-400 mt-3">No belt awarded yet</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Actions</h2>
                                </div>
                                <div className="p-6 space-y-3">
                                    <Button 
                                        variant="outline" 
                                        className="w-full justify-start"
                                        onClick={() => {
                                            setIsEditing(true);
                                            setHasJustSubmitted(false);
                                        }}
                                    >
                                        Edit Student Info
                                    </Button>
                                    <Button asChild variant="outline" className="w-full justify-start">
                                        <Link to={`/family/student/${student.id}/attendance`}>View Attendance</Link>
                                    </Button>
                                    <Button asChild variant="outline" className="w-full justify-start">
                                        <Link to={`/family/store/purchase/${student.id}`}>Purchase Gi</Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Section - Full Width */}
                    <div className="space-y-6">
                        {/* Class Enrollments */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Class Enrollments</h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Select an enrollment to view payment options below</p>
                            </div>
                            <div className="p-6">
                                {sortedEnrollments && sortedEnrollments.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {sortedEnrollments.map((enrollment) => (
                                            <div key={enrollment.id}
                                                 className={`bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg p-4 border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                                                     selectedEnrollmentId === enrollment.id 
                                                         ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800' 
                                                         : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                                 }`}
                                                 onClick={() => setSelectedEnrollmentId(enrollment.id)}
                                                 onKeyDown={(e) => {
                                                     if (e.key === 'Enter' || e.key === ' ') {
                                                         e.preventDefault();
                                                         setSelectedEnrollmentId(enrollment.id);
                                                     }
                                                 }}
                                                 role="button"
                                                 tabIndex={0}>
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1">
                                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                                            {enrollment.classes?.name || 'Unknown Class'}
                                                        </h3>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                                            {enrollment.classes?.programs?.name || 'Unknown Program'}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <Badge 
                                                            variant={getEnrollmentBadgeVariant(enrollment.status)}
                                                            className="capitalize"
                                                        >
                                                            {enrollment.status}
                                                        </Badge>
                                                        {selectedEnrollmentId === enrollment.id && (
                                                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                                    <p>Enrolled: {formatDate(enrollment.enrolled_at, { formatString: 'MMM d, yyyy' })}</p>
                                                    {enrollment.completed_at && (
                                                        <p>Completed: {formatDate(enrollment.completed_at, { formatString: 'MMM d, yyyy' })}</p>
                                                    )}
                                                    {enrollment.dropped_at && (
                                                        <p>Dropped: {formatDate(enrollment.dropped_at, { formatString: 'MMM d, yyyy' })}</p>
                                                    )}
                                                    {enrollment.notes && (
                                                        <p className="mt-2 text-gray-700 dark:text-gray-300">Notes: {enrollment.notes}</p>
                                                    )}
                                                    
                                                    {/* Payment Status Information */}
                                                    {enrollment.status === 'active' && (paymentOptions || individualSessions) && (() => {
                                                        const enrollmentPayment = paymentOptions?.enrollments.find(e => e.enrollmentId === enrollment.id);
                                                        const paidUntilDate = enrollmentPayment?.paidUntil && formatDate(enrollmentPayment.paidUntil, {formatString: 'MMM d, yyyy'});
                                                        const currentStatus = enrollmentPayment?.currentStatus;

                                                        return (
                                                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                                                <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                                                                    Payment Status:
                                                                </p>
                                                                
                                                                {/* Subscription Status */}
                                                                {enrollmentPayment && (
                                                                    <>
                                                                        {(currentStatus === 'active_monthly' || currentStatus === 'active_yearly') && (
                                                                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                                                                Subscription active until {paidUntilDate}
                                                                            </p>
                                                                        )}
                                                                        {currentStatus === 'trial' && (
                                                                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                                                                On free trial
                                                                            </p>
                                                                        )}
                                                                        {currentStatus === 'expired' && (
                                                                            <p className="text-xs text-orange-700 dark:text-orange-300">
                                                                                Payment expired - renewal needed
                                                                            </p>
                                                                        )}
                                                                    </>
                                                                )}

                                                                {/* Individual Sessions */}
                                                                {individualSessions && individualSessions.totalRemaining > 0 && (
                                                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                                                        {individualSessions.totalRemaining} individual sessions remaining
                                                                    </p>
                                                                )}
                                                                {individualSessions && individualSessions.totalPurchased > 0 && individualSessions.totalRemaining === 0 && (
                                                                    <p className="text-xs text-orange-700 dark:text-orange-300">
                                                                        All individual sessions used
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500 dark:text-gray-400">No class enrollments found.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payment Section - Only show if student has active or trial enrollments */}
                        {sortedEnrollments && sortedEnrollments.some(e => e.status === 'active' || e.status === 'trial') && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                        Payment Options
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {getPaymentSubtitle()}
                                    </p>
                                </div>
                                <div className="p-6">
                                    {renderEnrollmentPaymentSection()}
                                </div>
                            </div>
                        )}
                        {/* Belt Awards History */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Belt Awards History</h2>
                            </div>
                            <div className="p-6">
                                {beltAwards && beltAwards.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {beltAwards.map((beltAward) => (
                                            <div key={beltAward.id}
                                                 className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600 text-center">
                                                <div className="flex justify-center mb-3">
                                                    <div className={`h-6 w-12 rounded ${beltColorMap[beltAward.type] || 'bg-gray-400'}`}></div>
                                                </div>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100 capitalize mb-2">{beltAward.type}</p>
                                                {beltAward.description && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{beltAward.description}</p>
                                                )}
                                                <Badge variant="secondary" className="text-xs">
                                                    {formatDate(beltAward.awarded_date, { formatString: 'MMM d, yyyy' })}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500 dark:text-gray-400">No belt awards recorded yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6">
                            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Danger Zone</h3>
                            <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                                Once you delete a student, there is no going back. Please be certain.
                            </p>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => setIsDeleteDialogOpen(true)}
                                disabled={isSubmitting && formIntent === 'delete'}
                            >
                                {isSubmitting && formIntent === 'delete' ? 'Deleting...' : 'Delete Student'}
                            </Button>
                        </div>
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
