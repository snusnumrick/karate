import {json, type LoaderFunctionArgs, redirect} from "@remix-run/node";
import {useLoaderData, useRouteError} from "@remix-run/react";
import type {Database} from "~/types/database.types";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Badge} from "~/components/ui/badge";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "~/components/ui/table";
import {formatDate} from "~/utils/misc"; // Import formatDate utility
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

// Define types
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>;
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];

type AttendanceWithStudentName = AttendanceRow & {
    students: Pick<StudentRow, 'first_name' | 'last_name'> | null;
    class_sessions: { session_date: string } | null;
};

type LoaderData = {
    students: StudentRow[];
    attendanceRecords: AttendanceWithStudentName[];
    familyName: string | null;
};

export async function loader({request}: LoaderFunctionArgs) {
    console.log("Entering /family/attendance loader...");
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        console.log("User not logged in, redirecting to login.");
        return redirect("/login?redirectTo=/family/attendance", {headers});
    }

    // Get user's profile to find their family ID
    const {data: profile, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profile || !profile.family_id) {
        console.error("Error fetching profile or no family ID found for user:", user.id, profileError?.message);
        // Redirect to main family page, maybe they need to create/join a family
        return redirect("/family", {headers});
    }

    const familyId = profile.family_id;
    console.log(`Fetching data for family ID: ${familyId}`);

    try {
        // Fetch family name (optional, for display)
        const {data: familyData} = await supabaseServer
            .from('families')
            .select('name')
            .eq('id', familyId)
            .single();
        const familyName = familyData?.name ?? null;

        // Fetch students in the family
        const {data: studentsData, error: studentsError} = await supabaseServer
            .from('students')
            .select('id, first_name, last_name')
            .eq('family_id', familyId)
            .order('last_name', {ascending: true})
            .order('first_name', {ascending: true});

        if (studentsError) throw studentsError;
        const students = studentsData ?? [];
        const studentIds = students.map(s => s.id);
        console.log(`Found ${students.length} students for family.`);

        // Fetch attendance records for these students
        let attendanceRecords: AttendanceWithStudentName[] = [];
        if (studentIds.length > 0) {
            const {data: attendanceData, error: attendanceError} = await supabaseServer
                .from('attendance')
                .select(`
          *,
          students ( first_name, last_name ),
          class_sessions ( session_date )
        `)
                .in('student_id', studentIds)
                .not('class_session_id', 'is', null) // Only get records with valid class sessions
                .order('class_sessions(session_date)', {ascending: false}); // Order by session_date from class_sessions

            if (attendanceError) throw attendanceError;
            // Ensure students relation is at least null and filter out records without class_sessions
            attendanceRecords = (attendanceData ?? [])
                .filter(r => r.class_sessions !== null) // Filter out any records without class sessions
                .map(r => ({...r, students: r.students ?? null}));
            console.log(`Fetched ${attendanceRecords.length} attendance records.`);
        } else {
            console.log("No students in family, skipping attendance fetch.");
        }

        return json({students, attendanceRecords, familyName}, {headers});

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Error in /family/attendance loader:", message);
        // Throw a response to trigger the ErrorBoundary
        throw new Response(`Failed to load attendance data: ${message}`, {status: 500});
    }
}

export default function FamilyAttendancePage() {
    const {students, attendanceRecords, familyName} = useLoaderData<LoaderData>();

    return (
        <div className="page-styles">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <AppBreadcrumb items={breadcrumbPatterns.familyAttendance()} />
                </div>

                {/* Page Header */}
                <div className="family-page-header-section-styles">
                    <h1 className="page-header-styles">
                        Attendance History
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                        {familyName ? `View ${familyName} family's attendance records` : 'View your family attendance records'}
                    </p>
                </div>

                {/* Attendance Records */}
                <div className="form-container-styles p-8 backdrop-blur-lg">
                    <div className="flex flex-col items-start space-y-2 mb-6 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                        <h2 className="text-2xl font-bold form-header-styles ">Attendance Records</h2>
                    </div>

                    {students.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-600 dark:text-gray-400 text-lg">No students found in this family.</p>
                        </div>
                    ) : attendanceRecords.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-600 dark:text-gray-400 text-lg">No attendance records found for your student(s).</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 dark:bg-gray-700">
                                        <TableHead className="font-semibold text-gray-900 dark:text-gray-100">Date</TableHead>
                                        <TableHead className="font-semibold text-gray-900 dark:text-gray-100">Student</TableHead>
                                        <TableHead className="font-semibold text-gray-900 dark:text-gray-100">Status</TableHead>
                                        <TableHead className="font-semibold text-gray-900 dark:text-gray-100">Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {attendanceRecords.map((record) => (
                                        <TableRow key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <TableCell className="text-gray-900 dark:text-gray-100">
                                                {formatDate(record.class_sessions?.session_date || '', { formatString: 'MMM d, yyyy' })}
                                            </TableCell>
                                            <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                                                {record.students ? `${record.students.first_name} ${record.students.last_name}` : 'Unknown Student'}
                                            </TableCell>
                                            <TableCell>
                                                {record.status === 'present' ? (
                                                    <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Present</Badge>
                                                ) : record.status === 'absent' ? (
                                                    <Badge variant="destructive">Absent</Badge>
                                                ) : record.status === 'excused' ? (
                                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Excused</Badge>
                                                ) : record.status === 'late' ? (
                                                    <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400">Late</Badge>
                                                ) : (
                                                    <Badge variant="outline">Unknown</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-gray-600 dark:text-gray-400">
                                                {record.notes || '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Add a specific ErrorBoundary for this route
export function ErrorBoundary() {
    const error = useRouteError();
    console.error("Error caught in FamilyAttendancePage ErrorBoundary:", error);

    let errorMessage = "An unknown error occurred while loading attendance data.";
    let errorStack = undefined;

    if (error instanceof Response) {
        errorMessage = `Error: ${error.status} - ${error.statusText || 'Failed to load data.'}`;
        // Attempt to read the response body if it's text
        // Note: This might not always work depending on the response type
        // const bodyText = await error.text().catch(() => '');
        // if (bodyText) errorMessage += `\nDetails: ${bodyText}`;
    } else if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
    }

    return (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <AppBreadcrumb items={breadcrumbPatterns.familyAttendance()} />
            
            <h2 className="text-xl font-bold mb-2">Error Loading Attendance</h2>
            <p>{errorMessage}</p>
            {process.env.NODE_ENV === "development" && errorStack && (
                <pre className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs">
          {errorStack}
        </pre>
            )}
        </div>
    );
}
