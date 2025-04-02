import {json, type LoaderFunctionArgs} from "@remix-run/node";
import {Form, Link, useLoaderData, useRouteError} from "@remix-run/react";
import {createClient} from '@supabase/supabase-js';
import type {Database} from "~/types/supabase";
import {Button} from "~/components/ui/button";
import {Badge} from "~/components/ui/badge";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "~/components/ui/select";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "~/components/ui/table";
import {format} from 'date-fns'; // For formatting date

// Define types for loader data
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type StudentName = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>; // Add id for filtering
type AllStudents = StudentName[];

type AttendanceWithStudentName = AttendanceRow & {
    students: Pick<StudentName, 'first_name' | 'last_name'> | null; // Keep nested structure for display
};

type LoaderData = {
    attendanceRecords: AttendanceWithStudentName[];
    filterParams: {
        startDate?: string;
        endDate?: string;
        studentId?: string;
    };
    allStudents: AllStudents;
};

// Helper to get today's date in YYYY-MM-DD format
// function getTodayDateString(): string {
//   return format(new Date(), 'yyyy-MM-dd');
// }

export async function loader({request}: LoaderFunctionArgs): Promise<Response> {
    console.log("Entering /admin/attendance loader...");
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const studentId = searchParams.get("studentId") || undefined;
    console.log(`Fetching attendance with filters: startDate=${startDate}, endDate=${endDate}, studentId=${studentId}`);

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin attendance loader: Missing Supabase env variables.");
        throw new Response("Server configuration error.", {status: 500});
    }

    // Use service role client for admin data access
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        console.log("Admin attendance loader - Fetching all students for filter...");
        const {data: allStudentsData, error: studentsError} = await supabaseAdmin
            .from('students')
            .select('id, first_name, last_name')
            .order('last_name', {ascending: true})
            .order('first_name', {ascending: true});

        if (studentsError) {
            console.error("Error fetching students:", studentsError.message);
            throw new Response("Failed to load student data for filtering.", {status: 500});
        }
        const allStudents = allStudentsData ?? [];
        console.log(`Fetched ${allStudents.length} students.`);

        console.log("Admin attendance loader - Fetching attendance records with filters...");
        let query = supabaseAdmin
            .from('attendance')
            .select(`
        *,
        students ( first_name, last_name )
      `)
            .order('class_date', {ascending: false}); // Order by date descending by default

        // Apply filters
        if (startDate) {
            query = query.gte('class_date', startDate);
        }
        if (endDate) {
            // Add time component to ensure inclusivity if needed, or adjust based on DB type
            query = query.lte('class_date', endDate);
        }
        if (studentId) {
            query = query.eq('student_id', studentId);
        }

        const {data: attendanceRecords, error: attendanceError} = await query;

        if (attendanceError) {
            console.error("Error fetching attendance records:", attendanceError.message);
            throw new Response("Failed to load attendance data.", {status: 500});
        }

        console.log(`Admin attendance loader - Fetched ${attendanceRecords?.length ?? 0} records.`);
        // Ensure students relation is at least null
        const typedRecords = attendanceRecords?.map(r => ({...r, students: r.students ?? null})) ?? [];

        // Sorting can be complex with filters, maybe sort client-side or refine DB query later
        // For now, rely on default date sorting from query

        const filterParams = {startDate, endDate, studentId};
        return json({attendanceRecords: typedRecords, filterParams, allStudents});

    } catch (error) {
        if (error instanceof Error) {
            console.error("Error in /admin/attendance loader:", error.message);
            throw new Response(error.message, {status: 500});
        } else {
            console.error("Unknown error in /admin/attendance loader:", error);
            throw new Response("An unknown error occurred.", {status: 500});
        }
    }
}

export default function AttendanceHistoryPage() { // Renamed component
    const {attendanceRecords, filterParams, allStudents} = useLoaderData<LoaderData>();
    // const [searchParams] = useSearchParams(); // To get current params for display/links if needed

    // Determine the title based on filters
    let title = "Attendance History";
    if (filterParams.startDate && filterParams.endDate) {
        title = `Attendance from ${format(new Date(filterParams.startDate + 'T00:00:00'), 'MMM d, yyyy')} to ${format(new Date(filterParams.endDate + 'T00:00:00'), 'MMM d, yyyy')}`;
    } else if (filterParams.startDate) {
        title = `Attendance since ${format(new Date(filterParams.startDate + 'T00:00:00'), 'MMM d, yyyy')}`;
    } else if (filterParams.endDate) {
        title = `Attendance until ${format(new Date(filterParams.endDate + 'T00:00:00'), 'MMM d, yyyy')}`;
    }
    if (filterParams.studentId) {
        const student = allStudents.find(s => s.id === filterParams.studentId);
        if (student) {
            title += ` for ${student.first_name} ${student.last_name}`;
        }
    }


    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{title}</h1>
                <div className="flex gap-2">
                    <Button asChild variant="secondary">
                        <Link to="/admin/attendance/report">View Reports</Link>
                    </Button>
                    <Button asChild variant="outline">
                        {/* Link to record attendance page - still relevant */}
                        <Link to="/admin/attendance/record">Record Today&apos;s Attendance</Link>
                    </Button>
                </div>
            </div>

            {/* Filter Form */}
            <Form method="get"
                  className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6 flex flex-wrap items-end gap-4">
                <div>
                    <Label htmlFor="startDate"
                           className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start
                        Date</Label>
                    <Input type="date" id="startDate" name="startDate" defaultValue={filterParams.startDate}
                           className="w-full md:w-auto dark:bg-gray-700"/>
                </div>
                <div>
                    <Label htmlFor="endDate"
                           className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</Label>
                    <Input type="date" id="endDate" name="endDate" defaultValue={filterParams.endDate}
                           className="w-full md:w-auto dark:bg-gray-700"/>
                </div>
                <div>
                    <Label htmlFor="studentId"
                           className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student</Label>
                    <Select name="studentId" defaultValue={filterParams.studentId}>
                        <SelectTrigger id="studentId" className="w-full md:w-[200px] dark:bg-gray-700">
                            <SelectValue placeholder="All Students"/>
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-700">
                            {/* Removed the explicit "All Students" item with value="" */}
                            {allStudents.map(student => (
                                <SelectItem key={student.id} value={student.id}>
                                    {student.last_name}, {student.first_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button type="submit">Filter</Button>
                {/* Optional: Clear filters button */}
                {(filterParams.startDate || filterParams.endDate || filterParams.studentId) && (
                    <Button type="button" variant="ghost" onClick={() => window.location.href = '/admin/attendance'}>
                        Clear Filters
                    </Button>
                )}
            </Form>

            {/* Attendance Table */}
            {attendanceRecords.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">No attendance records found matching the criteria.</p>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead> {/* Add Date column */}
                                <TableHead>Student Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attendanceRecords.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell>{format(new Date(record.class_date + 'T00:00:00'), 'MMM d, yyyy')}</TableCell> {/* Format date */}
                                    <TableCell className="font-medium">
                                        {record.students ? `${record.students.first_name} ${record.students.last_name}` : 'Unknown Student'}
                                    </TableCell>
                                    <TableCell>
                                        {record.present ? (
                                            <Badge variant="default">Present</Badge>
                                        ) : (
                                            <Badge variant="destructive">Absent</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>{record.notes || '-'}</TableCell>
                                    {/* Add edit/delete actions later if needed */}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}

// Add a specific ErrorBoundary for this route
export function ErrorBoundary() {
    const error = useRouteError();
    console.error("Error caught in AttendanceHistoryPage ErrorBoundary:", error); // Updated component name

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
            <h2 className="text-xl font-bold mb-2">Error Loading Attendance</h2>
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
        </div>
    );
}
