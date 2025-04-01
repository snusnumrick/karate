import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useRouteError } from "@remix-run/react";
import type { Database } from "~/types/supabase";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { format } from 'date-fns';

// Define types
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>;
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];

type AttendanceWithStudentName = AttendanceRow & {
  students: Pick<StudentRow, 'first_name' | 'last_name'> | null;
};

type LoaderData = {
  students: StudentRow[];
  attendanceRecords: AttendanceWithStudentName[];
  familyName: string | null;
};

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("Entering /family/attendance loader...");
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    console.log("User not logged in, redirecting to login.");
    return redirect("/login?redirectTo=/family/attendance", { headers });
  }

  // Get user's profile to find their family ID
  const { data: profile, error: profileError } = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.family_id) {
    console.error("Error fetching profile or no family ID found for user:", user.id, profileError?.message);
    // Redirect to main family page, maybe they need to create/join a family
    return redirect("/family", { headers });
  }

  const familyId = profile.family_id;
  console.log(`Fetching data for family ID: ${familyId}`);

  try {
    // Fetch family name (optional, for display)
    const { data: familyData } = await supabaseServer
      .from('families')
      .select('name')
      .eq('id', familyId)
      .single();
    const familyName = familyData?.name ?? null;

    // Fetch students in the family
    const { data: studentsData, error: studentsError } = await supabaseServer
      .from('students')
      .select('id, first_name, last_name')
      .eq('family_id', familyId)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (studentsError) throw studentsError;
    const students = studentsData ?? [];
    const studentIds = students.map(s => s.id);
    console.log(`Found ${students.length} students for family.`);

    // Fetch attendance records for these students
    let attendanceRecords: AttendanceWithStudentName[] = [];
    if (studentIds.length > 0) {
      const { data: attendanceData, error: attendanceError } = await supabaseServer
        .from('attendance')
        .select(`
          *,
          students ( first_name, last_name )
        `)
        .in('student_id', studentIds)
        .order('class_date', { ascending: false }); // Show most recent first

      if (attendanceError) throw attendanceError;
      // Ensure students relation is at least null
      attendanceRecords = (attendanceData ?? []).map(r => ({ ...r, students: r.students ?? null }));
      console.log(`Fetched ${attendanceRecords.length} attendance records.`);
    } else {
      console.log("No students in family, skipping attendance fetch.");
    }

    return json({ students, attendanceRecords, familyName }, { headers });

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("Error in /family/attendance loader:", message);
    // Throw a response to trigger the ErrorBoundary
    throw new Response(`Failed to load attendance data: ${message}`, { status: 500 });
  }
}

export default function FamilyAttendancePage() {
  const { students, attendanceRecords, familyName } = useLoaderData<LoaderData>();

  // Optional: Group records by student client-side if needed, or rely on sorting
  // const recordsByStudent = attendanceRecords.reduce((acc, record) => {
  //   const studentId = record.student_id;
  //   if (!acc[studentId]) {
  //     acc[studentId] = {
  //       name: record.students ? `${record.students.first_name} ${record.students.last_name}` : 'Unknown Student',
  //       records: []
  //     };
  //   }
  //   acc[studentId].records.push(record);
  //   return acc;
  // }, {} as Record<string, { name: string; records: AttendanceWithStudentName[] }>);

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/family" className="text-blue-600 hover:underline mb-4 inline-block">
        &larr; Back to Family Portal
      </Link>
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">
        Attendance History {familyName ? `for ${familyName}` : ''}
      </h1>

      {students.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No students found in this family.</p>
      ) : attendanceRecords.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No attendance records found for your student(s).</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{format(new Date(record.class_date + 'T00:00:00'), 'MMM d, yyyy')}</TableCell>
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
      <h2 className="text-xl font-bold mb-2">Error Loading Attendance</h2>
      <p>{errorMessage}</p>
      {process.env.NODE_ENV === "development" && errorStack && (
        <pre className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs">
          {errorStack}
        </pre>
      )}
       <div className="mt-4">
         <Link to="/family" className="text-blue-600 hover:underline">
           &larr; Go back to Family Portal
         </Link>
       </div>
    </div>
  );
}
