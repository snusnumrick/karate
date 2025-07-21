import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect} from "@remix-run/node";
import {
    Form,
    Link,
    useActionData,
    useLoaderData,
    useNavigate,
    useNavigation,
    useRouteError,
    useSearchParams,
} from "@remix-run/react";
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import type {Database} from "~/types/database.types";
import type {ClassSession} from "~/types/multi-class";
import {getClassSessions} from "~/services/class.server";
import {getEnrollmentsByClass} from "~/services/enrollment.server";
import {getAttendanceBySession, recordSessionAttendance} from "~/services/attendance.server";
import {getFamilyPaymentEligibilityData} from "~/services/payment-eligibility.server";
import {checkStudentEligibility} from "~/utils/supabase.server";
import {sendEmail} from '~/utils/email.server';
import {Badge} from "~/components/ui/badge";
import {Label} from "~/components/ui/label";
import {Input} from "~/components/ui/input";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {RadioGroup, RadioGroupItem} from "~/components/ui/radio-group";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "~/components/ui/select";
import {format, isValid, parse} from 'date-fns';
import {formatDate} from "~/utils/misc";
import React from "react";
import {Textarea} from "~/components/ui/textarea";
import {Button} from "~/components/ui/button";
import {AppBreadcrumb, breadcrumbPatterns} from "~/components/AppBreadcrumb";

// Define types
type SessionWithClass = ClassSession & {
    class: {
        id: string;
        name: string;
        program: {
            name: string;
        };
    };
};

type EnrolledStudent = {
    id: string;
    first_name: string;
    last_name: string;
    enrollment_id: string;
    enrollment_status: string;
    program_name: string;
    family_id: string;
    eligibility?: {
        eligible: boolean;
        reason: 'Trial' | 'Paid - Monthly' | 'Paid - Yearly' | 'Expired';
        lastPaymentDate?: string;
        type?: string;
        paidUntil?: string;
    };
    individualSessions?: {
        totalRemaining: number;
        purchases: Array<{
            id: string;
            quantityRemaining: number;
        }>;
    };
};

type AttendanceRecord = {
    id?: string;
    student_id: string;
    class_session_id: string;
    status: 'present' | 'absent' | 'excused' | 'late';
    notes?: string;
};

type LoaderData = {
    sessions: SessionWithClass[];
    selectedSession: SessionWithClass | null;
    enrolledStudents: EnrolledStudent[];
    existingAttendance: Record<string, AttendanceRecord>;
    attendanceDate: string;
};

type ActionData = {
    error?: string;
    success?: boolean;
};

// Helper to get today's date in YYYY-MM-DD format
function getTodayDateString(): string {
    return format(new Date(), 'yyyy-MM-dd');
}

// Loader: Fetch sessions and enrolled students for attendance recording
export async function loader({request}: LoaderFunctionArgs) {
    console.log("Entering /admin/attendance/record loader...");
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    const sessionParam = url.searchParams.get("session");

    // Validate dateParam or default to today
    let attendanceDate = getTodayDateString();
    if (dateParam) {
        const parsedDate = parse(dateParam, 'yyyy-MM-dd', new Date());
        if (isValid(parsedDate)) {
            attendanceDate = dateParam;
        } else {
            console.warn(`Invalid date parameter received: ${dateParam}. Defaulting to today.`);
        }
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin attendance record loader: Missing Supabase env variables.");
        throw new Response("Server configuration error.", {status: 500});
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        // Get all sessions for the selected date
        const sessions = await getClassSessions({
            session_date_from: attendanceDate,
            session_date_to: attendanceDate
        }, supabaseAdmin) as SessionWithClass[];

        let selectedSession: SessionWithClass | null = null;
        let enrolledStudents: EnrolledStudent[] = [];
        const existingAttendance: Record<string, AttendanceRecord> = {};

        // If a specific session is selected, get enrolled students and existing attendance
        if (sessionParam && sessions.length > 0) {
            selectedSession = sessions.find(s => s.id === sessionParam) || null;
            
            if (selectedSession) {
                // Get enrolled students for this class
                const enrollments = await getEnrollmentsByClass(selectedSession.class_id, supabaseAdmin);
                
                const activeEnrollments = enrollments.filter(enrollment => enrollment.status === 'active' || enrollment.status === 'trial');
                
                // Get payment eligibility data for each student
                enrolledStudents = await Promise.all(
                    activeEnrollments.map(async (enrollment) => {
                        const student = enrollment.student!;
                        
                        // Get student eligibility status
                        const eligibility = await checkStudentEligibility(student.id, supabaseAdmin);
                        
                        // Get family individual sessions
                        const { data: sessionsData } = await supabaseAdmin
                            .from('one_on_one_sessions')
                            .select('id, quantity_remaining')
                            .eq('family_id', student.family_id)
                            .gt('quantity_remaining', 0);
                        
                        const individualSessions = {
                            totalRemaining: sessionsData?.reduce((sum, s) => sum + s.quantity_remaining, 0) || 0,
                            purchases: sessionsData?.map(s => ({
                                id: s.id,
                                quantityRemaining: s.quantity_remaining
                            })) || []
                        };
                        
                        return {
                            id: student.id,
                            first_name: student.first_name,
                            last_name: student.last_name,
                            enrollment_id: enrollment.id,
                            enrollment_status: enrollment.status,
                            program_name: enrollment.class?.program?.name || 'Unknown Program',
                            family_id: student.family_id,
                            eligibility,
                            individualSessions
                        };
                    })
                );

                // Get existing attendance for this session using the new service
                const attendanceRecords = await getAttendanceBySession(selectedSession.id, supabaseAdmin);

                // Convert to a map for easy lookup
                attendanceRecords.forEach(record => {
                    existingAttendance[record.student_id] = record;
                });
            }
        }

        console.log(`Fetched ${sessions.length} sessions for ${attendanceDate}`);
        if (selectedSession) {
            console.log(`Selected session: ${selectedSession.class?.name} with ${enrolledStudents.length} enrolled students`);
        }

        return json({
            sessions,
            selectedSession,
            enrolledStudents,
            existingAttendance,
            attendanceDate
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Error in /admin/attendance/record loader:", message);
        throw new Response(message, {status: 500});
    }
}

// Action: Save session attendance records
export async function action({request}: ActionFunctionArgs) {
    console.log("Entering /admin/attendance/record action...");
    const formData = await request.formData();
    const sessionId = formData.get("sessionId") as string;
    const studentIds = formData.getAll("studentId") as string[];

    if (!sessionId) {
        return json({error: "Session ID is required"}, {status: 400});
    }

    const recordsToUpsert: Database['public']['Tables']['attendance']['Insert'][] = [];

    for (const studentId of studentIds) {
        const status = formData.get(`status-${studentId}`) as 'present' | 'absent' | 'excused' | 'late';
        const notes = formData.get(`notes-${studentId}`) as string | null;

        if (status) {
            recordsToUpsert.push({
                student_id: studentId,
                class_session_id: sessionId,
                status: status,
                notes: notes || null
                // Note: class_date and present are not stored in the current attendance table schema
            });
        }
    }

    if (recordsToUpsert.length === 0) {
        console.log("No attendance data submitted to save.");
        return redirect("/admin/attendance");
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin attendance record action: Missing Supabase env variables.");
        return json({error: "Server configuration error."}, {status: 500});
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        console.log(`Upserting ${recordsToUpsert.length} attendance records for session: ${sessionId}`);
        
        // Record attendance using the new service function
        await recordSessionAttendance(
            sessionId,
            recordsToUpsert.map(record => ({
                student_id: record.student_id,
                status: record.status as 'present' | 'absent' | 'excused' | 'late',
                notes: record.notes || undefined
            })),
            supabaseAdmin
        );

        // Handle individual session usage for present students
        for (const studentId of studentIds) {
            const status = formData.get(`status-${studentId}`) as string;
            const useIndividualSession = formData.get(`useIndividualSession_${studentId}`) === 'on';
            
            if ((status === 'present' || status === 'late') && useIndividualSession) {
                // Get student's family_id
                const { data: student } = await supabaseAdmin
                    .from('students')
                    .select('family_id')
                    .eq('id', studentId)
                    .single();
                
                if (student) {
                    // Check if student has active monthly/yearly payments
                    const eligibility = await checkStudentEligibility(studentId, supabaseAdmin);
                    const hasActivePayment = eligibility?.eligible && 
                        (eligibility.reason === 'Paid - Monthly' || eligibility.reason === 'Paid - Yearly');
                    
                    // Only decrement individual sessions if no active monthly/yearly payment
                    if (!hasActivePayment) {
                        // Find and decrement one individual session
                        const { data: sessions } = await supabaseAdmin
                            .from('one_on_one_sessions')
                            .select('id, quantity_remaining')
                            .eq('family_id', student.family_id)
                            .gt('quantity_remaining', 0)
                            .order('created_at', { ascending: true })
                            .limit(1);
                        
                        if (sessions && sessions.length > 0) {
                            const session = sessions[0];
                            await supabaseAdmin
                                .from('one_on_one_sessions')
                                .update({ 
                                    quantity_remaining: session.quantity_remaining - 1,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', session.id);
                        }
                    }
                }
            }
        }

        console.log("Attendance saved successfully.");

        // Send absence notifications
        await sendAbsenceNotifications(sessionId, supabaseAdmin);

        return redirect("/admin/attendance");

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Error in /admin/attendance/record action:", message);
        return json({error: message}, {status: 500});
    }
}

// Helper function to send absence notifications
async function sendAbsenceNotifications(
    sessionId: string,
    supabaseAdmin: SupabaseClient<Database>
) {
    // Get absent students from the attendance records
    const attendanceRecords = await getAttendanceBySession(sessionId, supabaseAdmin);
    const absentStudents = attendanceRecords.filter(record => record.status === 'absent');
    
    if (absentStudents.length === 0) {
        console.log("No absent students found, skipping notifications.");
        return;
    }

    console.log(`Found ${absentStudents.length} absent students. Preparing notifications...`);

    // Get session details for the email
    const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from('class_sessions')
        .select(`
            session_date,
            start_time,
            end_time,
            class:classes(
                name,
                program:programs(name)
            )
        `)
        .eq('id', sessionId)
        .single();

    if (sessionError || !sessionData) {
        console.error(`Error fetching session data for session ID ${sessionId}:`, sessionError?.message ?? 'Session not found');
        return;
    }

    const formattedDate = formatDate(sessionData.session_date, { formatString: 'MMMM d, yyyy' });
    const className = sessionData.class?.name || 'Karate Class';
    const programName = sessionData.class?.program?.name || '';

    for (const record of absentStudents) {
        try {
            // Fetch student name and their family's email
            const {data: studentData, error: studentError} = await supabaseAdmin
                .from('students')
                .select(`
                    first_name,
                    last_name,
                    families ( email )
                `)
                .eq('id', record.student_id)
                .single();

            if (studentError || !studentData || !studentData.families?.email) {
                console.error(`Error fetching student/family data for student ID ${record.student_id}:`, studentError?.message ?? 'Data not found or email missing');
                continue;
            }

            const studentName = `${studentData.first_name} ${studentData.last_name}`;
            const familyEmail = studentData.families.email;

            // Send the email
            const subject = `Absence Notification for ${studentName}`;
            const htmlBody = `
                <p>Hello,</p>
                <p>This email is to inform you that <strong>${studentName}</strong> was marked absent for the <strong>${className}</strong> ${programName ? `(${programName}) ` : ''}class on <strong>${formattedDate}</strong> at ${sessionData.start_time}.</p>
                ${record.notes ? `<p><strong>Instructor Notes:</strong> ${record.notes}</p>` : ''}
                <p>If you believe this is an error, please contact us.</p>
                <p>Thank you,<br/>Sensei Negin's Karate Class</p>
            `;

            await sendEmail({
                to: familyEmail,
                subject: subject,
                html: htmlBody,
            });

        } catch (emailError) {
            console.error(`Failed to process or send absence notification for student ID ${record.student_id}.`);
        }
    }
    console.log("Finished processing absence notifications.");
}


// Component: Display form to record attendance
export default function RecordAttendancePage() {
    const {sessions, selectedSession, enrolledStudents, existingAttendance, attendanceDate} = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const isSubmitting = navigation.state === "submitting";
    const formattedDateForDisplay = formatDate(attendanceDate, { formatString: 'MMMM d, yyyy' });

    const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = event.target.value;
        if (newDate) {
            navigate(`/admin/attendance/record?date=${newDate}`, {replace: true});
        }
    };

    const handleSessionChange = (sessionId: string) => {
        const params = new URLSearchParams(searchParams);
        params.set('session', sessionId);
        navigate(`/admin/attendance/record?${params.toString()}`, {replace: true});
    };

    // Helper to determine badge variant based on enrollment status
    const getEnrollmentBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'active':
                return 'default';
            case 'trial':
                return 'default';
            case 'waitlist':
                return 'secondary';
            case 'dropped':
                return 'destructive';
            default:
                return 'outline';
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.adminAttendanceRecord()} className="mb-4" />
            
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Record Attendance</h1>
                <div className="flex items-center gap-2">
                    <Label htmlFor="attendance-date-picker" className="text-sm font-medium whitespace-nowrap">Select Date:</Label>
                    <Input
                        type="date"
                        id="attendance-date-picker"
                        value={attendanceDate}
                        onChange={handleDateChange}
                        className="w-auto input-custom-styles"
                        tabIndex={1}
                    />
                </div>
            </div>

            {/* Date Display Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">Selected Date</h2>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                    {formattedDateForDisplay}
                </p>
            </div>

            {/* Session Selection */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">Select Class Session</h2>
                {sessions.length === 0 ? (
                    <p className="text-gray-600 dark:text-gray-400">
                        No class sessions found for {formattedDateForDisplay}.
                    </p>
                ) : (
                    <div className="space-y-4">
                        <Select
                            value={selectedSession?.id || ''}
                            onValueChange={handleSessionChange}
                        >
                            <SelectTrigger className="input-custom-styles w-full">
                            <SelectValue placeholder="Choose a class session to record attendance" />
                            </SelectTrigger>
                            <SelectContent>
                                {sessions.map((session) => (
                                    <SelectItem key={session.id} value={session.id}>
                                        {session.class?.name} ({session.class?.program?.name}) - {session.start_time} to {session.end_time}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        
                        {selectedSession && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                                    {selectedSession.class?.name}
                                </h3>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    {selectedSession.class?.program?.name} • {selectedSession.start_time} - {selectedSession.end_time}
                                </p>
                                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                                    {enrolledStudents.length} enrolled student{enrolledStudents.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Attendance Recording Form */}
            {selectedSession && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2">Record Attendance</h2>
                        <Form method="post">
                            <input type="hidden" name="sessionId" value={selectedSession.id} />
                    <input type="hidden" name="classDate" value={attendanceDate} />

                            {actionData?.error && (
                                <Alert variant="destructive" className="mb-4">
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{actionData.error}</AlertDescription>
                                </Alert>
                            )}
                            {actionData?.success && (
                                <Alert variant="default" className="mb-4">
                                    <AlertTitle>Success</AlertTitle>
                                    <AlertDescription>Attendance recorded successfully.</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-6">
                                {enrolledStudents.map((student) => {
                                    const existing = existingAttendance[student.id];
                                    const defaultStatus = existing?.status || undefined;
                                    const defaultNotes = existing?.notes || '';

                                    // Determine payment status
                                    const hasActivePayment = student.eligibility?.eligible && 
                                        (student.eligibility.reason === 'Paid - Monthly' || student.eligibility.reason === 'Paid - Yearly');
                                    const hasIndividualSessions = (student.individualSessions?.totalRemaining || 0) > 0;
                                    const isPaid = hasActivePayment;
                                    
                                    let paymentStatus = 'Not Paid';
                                    if (isPaid) {
                                        paymentStatus = student.eligibility?.reason === 'Paid - Monthly' ? 'Paid (Monthly)' : 'Paid (Yearly)';
                                    } else if (hasIndividualSessions) {
                                        paymentStatus = `Individual Sessions (${student.individualSessions?.totalRemaining})`;
                                    }
                                    
                                    // Determine if student should be highlighted in red
                                    const shouldHighlight = !isPaid && !hasIndividualSessions;

                                    return (
                                        <div key={student.id} className={`border-b dark:border-gray-700 pb-4 last:border-b-0 ${shouldHighlight ? 'border-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg' : ''}`}>
                                            <input type="hidden" name="studentId" value={student.id} />

                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
                                                    {student.first_name} {student.last_name}
                                                </h3>
                                                <div className="flex gap-2">
                                                    <Badge variant={getEnrollmentBadgeVariant(student.enrollment_status)} className="text-xs">
                                                        {student.enrollment_status}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                        {student.program_name}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <span className={`text-sm font-medium ${
                                                    isPaid ? 'text-green-600 dark:text-green-400' : 
                                                    hasIndividualSessions ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                    Payment Status: {paymentStatus}
                                                </span>
                                                {hasIndividualSessions && !isPaid && (
                                                    <div className="mt-1">
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input 
                                                                type="checkbox" 
                                                                name={`useIndividualSession_${student.id}`}
                                                                className="rounded"
                                                            />
                                                            Use individual session for this attendance
                                                        </label>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                                                {/* Status Radio Group */}
                                                <div className="md:col-span-1">
                                                    <Label className="mb-2 block">Status</Label>
                                                    <RadioGroup
                                                        name={`status-${student.id}`}
                                                        defaultValue={defaultStatus}
                                                        className="grid grid-cols-2 gap-2"
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="present" id={`present-${student.id}`} />
                                                            <Label htmlFor={`present-${student.id}`}>Present</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="absent" id={`absent-${student.id}`} />
                                                            <Label htmlFor={`absent-${student.id}`}>Absent</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="excused" id={`excused-${student.id}`} />
                                                            <Label htmlFor={`excused-${student.id}`}>Excused</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="late" id={`late-${student.id}`} />
                                                            <Label htmlFor={`late-${student.id}`}>Late</Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>

                                                {/* Notes Textarea */}
                                                <div className="md:col-span-2">
                                                    <Label htmlFor={`notes-${student.id}`} className="mb-2 block">
                                                        Notes (Optional)
                                                    </Label>
                                                    <Textarea
                                                        id={`notes-${student.id}`}
                                                        name={`notes-${student.id}`}
                                                        defaultValue={defaultNotes}
                                                        rows={2}
                                                        placeholder="e.g., Left early, arrived late, makeup class"
                                                        className="mt-1"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {enrolledStudents.length === 0 && (
                                <p className="text-gray-600 dark:text-gray-400">
                                    No enrolled students found for this class session.
                                </p>
                            )}

                            {enrolledStudents.length > 0 && (
                                <div className="mt-8 flex justify-end">
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? "Saving Attendance..." : "Save Attendance"}
                                    </Button>
                                </div>
                            )}
                        </Form>
                </div>
            )}
        </div>
    );
}

// Add a specific ErrorBoundary for this route
export function ErrorBoundary() {
    const error = useRouteError();
    console.error("Error caught in RecordAttendancePage ErrorBoundary:", error);

    let errorMessage = "An unknown error occurred.";
    let errorStack = undefined;

    if (error instanceof Response) {
        errorMessage = `Error: ${error.status} - ${error.statusText || 'Failed to load data.'}`;
    } else if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
    }

    return (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <h2 className="text-xl font-bold mb-2">Error Recording Attendance</h2>
            <p>{errorMessage}</p>
            {process.env.NODE_ENV === "development" && errorStack && (
                <pre className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs">
          {errorStack}
        </pre>
            )}
            {process.env.NODE_ENV === "development" && error instanceof Response && (
                <pre className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs">
           Status: {error.status} {error.statusText}
         </pre>
            )}
            <div className="mt-4">
                <Link to="/admin/attendance" className="text-blue-600 hover:underline">
                    &larr; Go back to Attendance List
                </Link>
            </div>
            
            <script dangerouslySetInnerHTML={{
                __html: `
                    // Handle dynamic highlighting based on checkbox state
                    document.addEventListener('change', function(e) {
                        if (e.target.name && e.target.name.startsWith('useIndividualSession_')) {
                            const studentId = e.target.name.replace('useIndividualSession_', '');
                            const container = e.target.closest('.border-b, .border');
                            const paymentStatusSpan = container.querySelector('span[class*="text-"]');
                            
                            if (container && paymentStatusSpan) {
                                const isChecked = e.target.checked;
                                const hasIndividualSessions = paymentStatusSpan.textContent.includes('Individual Sessions');
                                const isPaid = paymentStatusSpan.textContent.includes('Paid (');
                                
                                // Update highlighting
                                if (!isPaid && hasIndividualSessions) {
                                    if (isChecked) {
                                        container.classList.remove('border-red-500', 'bg-red-50', 'dark:bg-red-900/20');
                                    } else {
                                        container.classList.add('border-red-500', 'bg-red-50', 'dark:bg-red-900/20');
                                    }
                                }
                            }
                        }
                    });
                    
                    // Initial highlighting on page load
                    document.addEventListener('DOMContentLoaded', function() {
                        const checkboxes = document.querySelectorAll('input[name^="useIndividualSession_"]');
                        checkboxes.forEach(checkbox => {
                            const container = checkbox.closest('.border-b, .border');
                            const paymentStatusSpan = container.querySelector('span[class*="text-"]');
                            
                            if (container && paymentStatusSpan) {
                                const hasIndividualSessions = paymentStatusSpan.textContent.includes('Individual Sessions');
                                const isPaid = paymentStatusSpan.textContent.includes('Paid (');
                                
                                if (!isPaid && hasIndividualSessions && !checkbox.checked) {
                                    container.classList.add('border-red-500', 'bg-red-50', 'dark:bg-red-900/20');
                                }
                            }
                        });
                    });
                `
            }} />
        </div>
    );
}
