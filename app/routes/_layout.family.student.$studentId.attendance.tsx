import {json, type LoaderFunctionArgs, redirect} from "@remix-run/node";
import {Link, useLoaderData, useRouteError} from "@remix-run/react";
import type {Database} from "~/types/database.types";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Badge} from "~/components/ui/badge";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "~/components/ui/table";
import {formatDate} from "~/utils/misc";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

// Define types
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>;
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];

type AttendanceWithStudentName = AttendanceRow & {
    students: Pick<StudentRow, 'first_name' | 'last_name'> | null;
    class_sessions: { session_date: string } | null;
};

type LoaderData = {
    student: StudentRow;
    attendanceRecords: AttendanceWithStudentName[];
    familyName: string | null;
};

export async function loader({request, params}: LoaderFunctionArgs) {
    console.log("Entering /family/student/$studentId/attendance loader...");
    const studentId = params.studentId;
    if (!studentId) {
        throw new Response("Student ID is required", {status: 400});
    }

    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        console.log("User not logged in, redirecting to login.");
        return redirect("/login?redirectTo=/family", {headers});
    }

    // Get user's profile to find their family ID
    const {data: profile, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profile || !profile.family_id) {
        console.error("Error fetching profile or no family ID found for user:", user.id, profileError?.message);
        return redirect("/family", {headers});
    }

    const familyId = profile.family_id;
    console.log(`Fetching data for family ID: ${familyId}`);

    try {
        // Fetch the specific student data
        const {data: studentData, error: studentError} = await supabaseServer
            .from('students')
            .select('id, first_name, last_name, family_id')
            .eq('id', studentId)
            .eq('family_id', familyId) // Ensure student belongs to user's family
            .single();

        if (studentError || !studentData) {
            console.error("Error fetching student data or student not found:", studentError?.message);
            throw new Response("Student not found or access denied", {status: 404});
        }

        // Fetch family name (optional, for display)
        const {data: familyData} = await supabaseServer
            .from('families')
            .select('name')
            .eq('id', familyId)
            .single();
        const familyName = familyData?.name ?? null;

        // Fetch attendance records for this specific student
        const {data: attendanceData, error: attendanceError} = await supabaseServer
            .from('attendance')
            .select(`
                *,
                students ( first_name, last_name ),
                class_sessions ( session_date )
            `)
            .eq('student_id', studentId)
            .not('class_session_id', 'is', null) // Only get records with valid class sessions
            .order('class_sessions(session_date)', {ascending: false}); // Order by session_date from class_sessions

        if (attendanceError) throw attendanceError;
        
        // Ensure students relation is at least null and filter out records without class_sessions
        const attendanceRecords = (attendanceData ?? [])
            .filter(r => r.class_sessions !== null) // Filter out any records without class sessions
            .map(r => ({...r, students: r.students ?? null}));
        
        console.log(`Fetched ${attendanceRecords.length} attendance records for student ${studentData.first_name} ${studentData.last_name}.`);

        return json({
            student: studentData,
            attendanceRecords,
            familyName
        }, {headers});

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Error in /family/student/$studentId/attendance loader:", message);
        // Throw a response to trigger the ErrorBoundary
        throw new Response(`Failed to load attendance data: ${message}`, {status: 500});
    }
}

export default function StudentAttendancePage() {
    const {student, attendanceRecords, familyName} = useLoaderData<LoaderData>();

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.familyStudentAttendance(student.first_name, student.last_name, student.id)} className="mb-6" />
            
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">
                Attendance History for {student.first_name} {student.last_name}
            </h1>

            {attendanceRecords.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md text-center">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">No attendance records found for {student.first_name}.</p>
                    <Link 
                        to={`/family/student/${student.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        ← Back to {student.first_name}&apos;s Profile
                    </Link>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attendanceRecords.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-medium">
                                        {formatDate(record.class_sessions?.session_date || '', { formatString: 'MMM d, yyyy' })}
                                    </TableCell>
                                    <TableCell>
                                        {record.status === 'present' ? (
                                            <Badge variant="default">Present</Badge>
                                        ) : record.status === 'absent' ? (
                                            <Badge variant="destructive">Absent</Badge>
                                        ) : record.status === 'excused' ? (
                                            <Badge variant="secondary">Excused</Badge>
                                        ) : record.status === 'late' ? (
                                            <Badge variant="outline">Late</Badge>
                                        ) : (
                                            <Badge variant="outline">Unknown</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>{record.notes || '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    
                    <div className="p-6 bg-gray-50 dark:bg-gray-700 border-t">
                        <div className="flex justify-between items-center">
                            <Link 
                                to={`/family/student/${student.id}`}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                ← Back to {student.first_name}&apos;s Profile
                            </Link>
                            <Link 
                                to="/family/attendance"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                View Family Attendance →
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Add a specific ErrorBoundary for this route
export function ErrorBoundary() {
    const error = useRouteError();
    console.error("Error caught in StudentAttendancePage ErrorBoundary:", error);

    let errorMessage = "An unknown error occurred while loading attendance data.";

    if (error instanceof Response) {
        errorMessage = `Error: ${error.status} - ${error.statusText || 'Failed to load data.'}`;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <h2 className="text-lg font-semibold mb-2">Error Loading Attendance</h2>
                <p className="mb-4">{errorMessage}</p>
                <Link 
                    to="/family"
                    className="text-blue-600 hover:underline"
                >
                    ← Back to Family Portal
                </Link>
            </div>
        </div>
    );
}