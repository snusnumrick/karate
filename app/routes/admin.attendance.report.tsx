import {json, type LoaderFunctionArgs} from "@remix-run/node";
import {Form, Link, useLoaderData, useRouteError} from "@remix-run/react";
import {createClient} from '@supabase/supabase-js';
import type {Database} from "~/types/supabase";
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "~/components/ui/table";
import {Card, CardContent, CardHeader, CardTitle} from "~/components/ui/card";
import {endOfMonth, format, isValid, startOfMonth, subMonths} from 'date-fns';

// Define types
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>;

type StudentReport = StudentRow & {
    presentCount: number;
    absentCount: number;
    totalClasses: number;
    attendanceRate: number; // Percentage
};

type LoaderData = {
    reportData: {
        overallPresent: number;
        overallAbsent: number;
        overallTotal: number;
        overallRate: number; // Percentage
        studentReports: StudentReport[];
    };
    filterParams: {
        startDate: string;
        endDate: string;
    };
    allStudents: StudentRow[]; // Keep all students for context, even if they had 0 classes
};

// Helper to get date range for the previous month
function getDefaultDateRange(): { startDate: string, endDate: string } {
    const today = new Date();
    const firstDayLastMonth = startOfMonth(subMonths(today, 1));
    const lastDayLastMonth = endOfMonth(subMonths(today, 1));
    return {
        startDate: format(firstDayLastMonth, 'yyyy-MM-dd'),
        endDate: format(lastDayLastMonth, 'yyyy-MM-dd'),
    };
}

export async function loader({request}: LoaderFunctionArgs): Promise<Response> {
    console.log("Entering /admin/attendance/report loader...");
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const defaultRange = getDefaultDateRange();
    let startDate = searchParams.get("startDate") || defaultRange.startDate;
    let endDate = searchParams.get("endDate") || defaultRange.endDate;

    // Validate dates, fallback to default if invalid
    if (!isValid(new Date(startDate + 'T00:00:00'))) startDate = defaultRange.startDate;
    if (!isValid(new Date(endDate + 'T00:00:00'))) endDate = defaultRange.endDate;

    console.log(`Fetching attendance report for range: ${startDate} to ${endDate}`);

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin attendance report loader: Missing Supabase env variables.");
        throw new Response("Server configuration error.", {status: 500});
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        // Fetch all students first
        const {data: allStudentsData, error: studentsError} = await supabaseAdmin
            .from('students')
            .select('id, first_name, last_name')
            .order('last_name', {ascending: true})
            .order('first_name', {ascending: true});

        if (studentsError) throw new Response("Failed to load student data.", {status: 500});
        const allStudents = allStudentsData ?? [];

        // Fetch attendance records within the date range
        const {data: attendanceRecords, error: attendanceError} = await supabaseAdmin
            .from('attendance')
            .select('student_id, present')
            .gte('class_date', startDate)
            .lte('class_date', endDate);

        if (attendanceError) throw new Response("Failed to load attendance data.", {status: 500});

        // Process data
        let overallPresent = 0;
        let overallAbsent = 0;
        const studentStats: Record<string, { present: number, absent: number }> = {};

        (attendanceRecords ?? []).forEach(record => {
            if (!studentStats[record.student_id]) {
                studentStats[record.student_id] = {present: 0, absent: 0};
            }
            if (record.present) {
                overallPresent++;
                studentStats[record.student_id].present++;
            } else {
                overallAbsent++;
                studentStats[record.student_id].absent++;
            }
        });

        const overallTotal = overallPresent + overallAbsent;
        const overallRate = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;

        const studentReports: StudentReport[] = allStudents.map(student => {
            const stats = studentStats[student.id] || {present: 0, absent: 0};
            const totalClasses = stats.present + stats.absent;
            const attendanceRate = totalClasses > 0 ? Math.round((stats.present / totalClasses) * 100) : 0; // Handle division by zero
            return {
                ...student,
                presentCount: stats.present,
                absentCount: stats.absent,
                totalClasses: totalClasses,
                attendanceRate: attendanceRate,
            };
        });

        // Sort students by attendance rate (lowest first) or total classes if rate is 0
        studentReports.sort((a, b) => {
            if (a.attendanceRate === 0 && b.attendanceRate === 0) {
                return b.totalClasses - a.totalClasses; // Show those with more absences first if rate is 0
            }
            if (a.attendanceRate === 0) return -1; // Put 0% rate first
            if (b.attendanceRate === 0) return 1;
            if (a.attendanceRate !== b.attendanceRate) {
                return a.attendanceRate - b.attendanceRate; // Sort by rate ascending
            }
            // If rates are equal, sort by last name
            return a.last_name.localeCompare(b.last_name);
        });


        const reportData = {overallPresent, overallAbsent, overallTotal, overallRate, studentReports};
        const filterParams = {startDate, endDate};

        console.log(`Report generated: Overall Rate ${overallRate}%, ${studentReports.length} student reports.`);
        return json({reportData, filterParams, allStudents});

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Error in /admin/attendance/report loader:", message);
        throw new Response(message, {status: 500});
    }
}

export default function AttendanceReportPage() {
    const {reportData, filterParams} = useLoaderData<LoaderData>();

    const formattedStartDate = format(new Date(filterParams.startDate + 'T00:00:00'), 'MMM d, yyyy');
    const formattedEndDate = format(new Date(filterParams.endDate + 'T00:00:00'), 'MMM d, yyyy');

    return (
        // Updated container class for consistency
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div>
                    <Link to="/admin/attendance" className="text-green-600 hover:underline mb-2 inline-block">
                        &larr; Back to Attendance History
                    </Link>
                    {/* Updated header classes for consistency */}
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 sm:text-4xl">
                        Attendance Report ({formattedStartDate} - {formattedEndDate})
                    </h1>
                </div>
                {/* Removed variant="outline" for consistency with other primary action buttons */}
                <Button asChild>
                    <Link to="/admin/attendance/record">Record Today&apos;s Attendance</Link>
                </Button>
            </div>

            {/* Filter Form */}
            <Form method="get"
                  className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6 flex flex-wrap items-end gap-4">
                <div>
                    <Label htmlFor="startDate"
                           className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start
                        Date</Label>
                    <Input type="date" id="startDate" name="startDate" defaultValue={filterParams.startDate}
                           className="input-custom-styles w-full md:w-auto"/> {/* Applied custom style, removed redundant */}
                </div>
                <div>
                    <Label htmlFor="endDate"
                           className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</Label>
                    <Input type="date" id="endDate" name="endDate" defaultValue={filterParams.endDate}
                           className="input-custom-styles w-full md:w-auto"/> {/* Applied custom style, removed redundant */}
                </div>
                {/* Renamed button for clarity */}
                <Button type="submit">Update Report</Button>
            </Form>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Added explicit background */}
                <Card className="bg-white dark:bg-gray-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overall Attendance Rate</CardTitle>
                        {/* Icon can go here */}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reportData.overallRate}%</div>
                        <p className="text-xs text-muted-foreground">
                            {reportData.overallPresent} Present / {reportData.overallAbsent} Absent
                            ({reportData.overallTotal} Total Records)
                        </p>
                    </CardContent>
                </Card>
                {/* Add more summary cards if needed (e.g., most absent student, etc.) */}
            </div>


            {/* Student Detail Table */}
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Student Attendance Summary</h2>
            {reportData.studentReports.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">No attendance data found for the selected period.</p>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student Name</TableHead>
                                <TableHead className="text-center">Present</TableHead>
                                <TableHead className="text-center">Absent</TableHead>
                                <TableHead className="text-center">Total Classes</TableHead>
                                <TableHead className="text-right">Attendance Rate</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.studentReports.map((student) => (
                                <TableRow key={student.id}>
                                    <TableCell
                                        className="font-medium">{student.last_name}, {student.first_name}</TableCell>
                                    <TableCell className="text-center">{student.presentCount}</TableCell>
                                    <TableCell className="text-center">{student.absentCount}</TableCell>
                                    <TableCell className="text-center">{student.totalClasses}</TableCell>
                                    <TableCell
                                        className="text-right font-semibold">{student.attendanceRate}%</TableCell>
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
    console.error("Error caught in AttendanceReportPage ErrorBoundary:", error);

    let errorMessage = "An unknown error occurred while generating the report.";
    let errorStack = undefined;
    if (error instanceof Response) {
        errorMessage = `Error: ${error.status} - ${error.statusText || 'Failed to load data.'}`;
    } else if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
    }

    return (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <h2 className="text-xl font-bold mb-2">Error Generating Report</h2>
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
                    &larr; Go back to Attendance History
                </Link>
            </div>
        </div>
    );
}
