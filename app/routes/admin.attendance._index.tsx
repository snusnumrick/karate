import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useRouteError } from "@remix-run/react";
import { createClient } from '@supabase/supabase-js';
import type { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { format } from 'date-fns'; // For formatting date

// Define types for loader data
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type StudentName = Pick<Database['public']['Tables']['students']['Row'], 'first_name' | 'last_name'> | null;

type AttendanceWithStudentName = AttendanceRow & {
  students: StudentName; // Supabase nests related data under the table name
};

// Helper to get today's date in YYYY-MM-DD format
function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("Entering /admin/attendance loader...");
  const today = getTodayDateString();
  console.log(`Fetching attendance for date: ${today}`);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Admin attendance loader: Missing Supabase env variables.");
    throw new Response("Server configuration error.", { status: 500 });
  }

  // Use service role client for admin data access
  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    console.log("Admin attendance loader - Fetching attendance records for today...");
    // Fetch attendance data and related student name for today
    const { data: attendanceRecords, error } = await supabaseAdmin
      .from('attendance')
      .select(`
        *,
        students ( first_name, last_name )
      `)
      .eq('class_date', today);
      // Removed: .order('created_at', { ascending: false }); - Column doesn't exist
      // We will sort by student name after fetching

    if (error) {
      console.error("Error fetching attendance records:", error.message);
      throw new Response("Failed to load attendance data.", { status: 500 });
    }

    console.log(`Admin attendance loader - Fetched ${attendanceRecords?.length ?? 0} records for today.`);
    // Ensure students relation is at least null and sort by student name
    const typedRecords = attendanceRecords?.map(r => ({ ...r, students: r.students ?? null })) ?? [];

    // Sort by student last name, then first name
    typedRecords.sort((a, b) => {
       const nameA = `${a.students?.last_name ?? ''} ${a.students?.first_name ?? ''}`.toLowerCase().trim();
       const nameB = `${b.students?.last_name ?? ''} ${b.students?.first_name ?? ''}`.toLowerCase().trim();
       if (nameA < nameB) return -1;
       if (nameA > nameB) return 1;
       return 0;
    });

    return json({ attendanceRecords: typedRecords, attendanceDate: today });

  } catch (error) {
     if (error instanceof Error) {
       console.error("Error in /admin/attendance loader:", error.message);
       throw new Response(error.message, { status: 500 });
     } else {
       console.error("Unknown error in /admin/attendance loader:", error);
       throw new Response("An unknown error occurred.", { status: 500 });
     }
  }
}

export default function AttendanceAdminPage() {
  const { attendanceRecords, attendanceDate } = useLoaderData<{ attendanceRecords: AttendanceWithStudentName[], attendanceDate: string }>();
  const formattedDate = format(new Date(attendanceDate + 'T00:00:00'), 'MMMM d, yyyy'); // Display friendly date

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Attendance for {formattedDate}</h1>
        <Button asChild>
          {/* Link to a future record attendance page */}
          <Link to="/admin/attendance/record">Record Attendance</Link>
        </Button>
      </div>

      {attendanceRecords.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No attendance records found for today.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {record.students ? `${record.students.first_name} ${record.students.last_name}` : 'Unknown Student'}
                  </TableCell>
                  <TableCell>
                    {record.present ? (
                      <Badge variant="success">Present</Badge> // Assuming you have a 'success' variant or use 'default'
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
  console.error("Error caught in AttendanceAdminPage ErrorBoundary:", error);

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
