import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
} from "@remix-run/react";
import { createClient } from '@supabase/supabase-js';
import type { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Textarea } from "~/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { format } from 'date-fns';

// Define types
type StudentInfo = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>;
type AttendanceRecord = Database['public']['Tables']['attendance']['Row'];
type LoaderData = {
  students: StudentInfo[];
  existingRecords: Record<string, Pick<AttendanceRecord, 'present' | 'notes'>>; // studentId -> { present, notes }
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

// Loader: Fetch students and today's existing records
export async function loader({ request }: LoaderFunctionArgs) {
  console.log("Entering /admin/attendance/record loader...");
  const today = getTodayDateString();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Admin attendance record loader: Missing Supabase env variables.");
    throw new Response("Server configuration error.", { status: 500 });
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    console.log("Fetching students and existing attendance for today...");
    const [studentsResponse, attendanceResponse] = await Promise.all([
      supabaseAdmin
        .from('students')
        .select('id, first_name, last_name')
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true }),
      supabaseAdmin
        .from('attendance')
        .select('student_id, present, notes')
        .eq('class_date', today)
    ]);

    if (studentsResponse.error) throw studentsResponse.error;
    if (attendanceResponse.error) throw attendanceResponse.error;

    const students = studentsResponse.data ?? [];
    const existingRecordsMap: LoaderData['existingRecords'] = {};
    (attendanceResponse.data ?? []).forEach(record => {
      existingRecordsMap[record.student_id] = {
        present: record.present,
        notes: record.notes,
      };
    });

    console.log(`Fetched ${students.length} students and ${Object.keys(existingRecordsMap).length} existing records.`);
    return json({ students, existingRecords: existingRecordsMap, attendanceDate: today });

  } catch (error) {
     const message = error instanceof Error ? error.message : "An unknown error occurred.";
     console.error("Error in /admin/attendance/record loader:", message);
     throw new Response(message, { status: 500 });
  }
}

// Action: Save attendance records
export async function action({ request }: ActionFunctionArgs) {
  console.log("Entering /admin/attendance/record action...");
  const formData = await request.formData();
  const attendanceDate = formData.get("attendanceDate") as string || getTodayDateString();
  const studentIds = formData.getAll("studentId") as string[];

  const recordsToUpsert: Database['public']['Tables']['attendance']['Insert'][] = [];

  for (const studentId of studentIds) {
    const status = formData.get(`status-${studentId}`) as string; // "present" or "absent"
    const notes = formData.get(`notes-${studentId}`) as string | null;

    if (status) { // Only include if a status was selected
      recordsToUpsert.push({
        student_id: studentId,
        class_date: attendanceDate,
        present: status === 'present',
        notes: notes || null, // Ensure null if empty string
      });
    }
  }

  if (recordsToUpsert.length === 0) {
    console.log("No attendance data submitted to save.");
    // Redirect back even if nothing changed, or show a message?
    // For now, redirecting seems reasonable.
    return redirect("/admin/attendance");
    // Or return json({ success: true, message: "No changes submitted." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Admin attendance record action: Missing Supabase env variables.");
    return json({ error: "Server configuration error." }, { status: 500 });
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`Upserting ${recordsToUpsert.length} attendance records for date: ${attendanceDate}`);
    const { error } = await supabaseAdmin
      .from('attendance')
      .upsert(recordsToUpsert, {
        onConflict: 'class_date, student_id', // Specify conflict target
        // defaultToNull: false // Keep existing values for unspecified columns if needed (might not be necessary here)
      });

    if (error) {
      console.error("Error upserting attendance:", error.message);
      return json({ error: `Failed to save attendance: ${error.message}` }, { status: 500 });
    }

    console.log("Attendance saved successfully.");
    // Redirect back to the main attendance list after successful save
    return redirect("/admin/attendance");

  } catch (error) {
     const message = error instanceof Error ? error.message : "An unknown error occurred.";
     console.error("Error in /admin/attendance/record action:", message);
     return json({ error: message }, { status: 500 });
  }
}


// Component: Display form to record attendance
export default function RecordAttendancePage() {
  const { students, existingRecords, attendanceDate } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const formattedDate = format(new Date(attendanceDate + 'T00:00:00'), 'MMMM d, yyyy');

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/admin/attendance" className="text-green-600 hover:underline mb-4 inline-block">
        &larr; Back to Attendance List
      </Link>
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">Record Attendance for {formattedDate}</h1>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <Form method="post">
          {/* Hidden input for the date */}
          <input type="hidden" name="attendanceDate" value={attendanceDate} />

          {actionData?.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{actionData.error}</AlertDescription>
            </Alert>
          )}
           {actionData?.success && (
             <Alert variant="success" className="mb-4"> {/* Assuming a success variant exists */}
               <AlertTitle>Success</AlertTitle>
               <AlertDescription>Attendance recorded successfully.</AlertDescription>
             </Alert>
           )}

          <div className="space-y-6">
            {students.map((student) => {
              const existing = existingRecords[student.id];
              const defaultStatus = existing ? (existing.present ? 'present' : 'absent') : undefined;
              const defaultNotes = existing?.notes ?? '';

              return (
                <div key={student.id} className="border-b dark:border-gray-700 pb-4 last:border-b-0">
                  {/* Hidden input to ensure we know which students were displayed */}
                  <input type="hidden" name="studentId" value={student.id} />

                  <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-100">
                    {student.first_name} {student.last_name}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    {/* Status Radio Group */}
                    <div className="md:col-span-1">
                      <Label className="mb-2 block">Status</Label>
                      <RadioGroup
                        name={`status-${student.id}`}
                        defaultValue={defaultStatus}
                        className="flex space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="present" id={`present-${student.id}`} />
                          <Label htmlFor={`present-${student.id}`}>Present</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="absent" id={`absent-${student.id}`} />
                          <Label htmlFor={`absent-${student.id}`}>Absent</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Notes Textarea */}
                    <div className="md:col-span-2">
                      <Label htmlFor={`notes-${student.id}`} className="mb-2 block">Notes (Optional)</Label>
                      <Textarea
                        id={`notes-${student.id}`}
                        name={`notes-${student.id}`}
                        defaultValue={defaultNotes}
                        rows={2}
                        placeholder="e.g., Left early, arrived late"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {students.length === 0 && (
            <p className="text-gray-600 dark:text-gray-400">No students found to record attendance for.</p>
          )}

          {students.length > 0 && (
            <div className="mt-8 flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving Attendance..." : "Save Attendance"}
              </Button>
            </div>
          )}
        </Form>
      </div>
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
    </div>
  );
}
