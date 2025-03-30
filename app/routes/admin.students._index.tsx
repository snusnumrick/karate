import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useRouteError } from "@remix-run/react";
import { createClient } from '@supabase/supabase-js';
import type { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

// Define types for loader data
type StudentRow = Database['public']['Tables']['students']['Row'];
type FamilyName = Pick<Database['public']['Tables']['families']['Row'], 'name'> | null; // Family might be null if relationship allows

type StudentWithFamilyName = StudentRow & {
  families: FamilyName; // Supabase nests related data under the table name
};

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("Entering /admin/students loader...");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Admin students loader: Missing Supabase URL or Service Role Key env variables.");
    throw new Response("Server configuration error.", { status: 500 });
  }

  // Use service role client for admin data access
  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    console.log("Admin students loader - Fetching all students and related family names using service role...");
    // Fetch student data and related family name
    const { data: students, error } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        families ( name ) 
      `) // Fetch name from the related families table
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (error) {
      console.error("Error fetching students:", error.message);
      throw new Response("Failed to load student data.", { status: 500 });
    }

    console.log(`Admin students loader - Fetched ${students?.length ?? 0} students.`);
    // Ensure families is at least null if not found, matching the type
    const typedStudents = students?.map(s => ({ ...s, families: s.families ?? null })) ?? [];
    return json({ students: typedStudents });

  } catch (error) {
     if (error instanceof Error) {
       console.error("Error in /admin/students loader:", error.message);
       throw new Response(error.message, { status: 500 });
     } else {
       console.error("Unknown error in /admin/students loader:", error);
       throw new Response("An unknown error occurred.", { status: 500 });
     }
  }
}

export default function StudentsAdminPage() {
  const { students } = useLoaderData<{ students: StudentWithFamilyName[] }>();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Manage Students</h1>
        <Button asChild>
          {/* Link to a future add student page */}
          <Link to="/admin/students/new">Add New Student</Link>
        </Button>
      </div>

      {students.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No students found.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Family Name</TableHead>
                <TableHead>Belt Rank</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{`${student.first_name} ${student.last_name}`}</TableCell>
                  <TableCell>{student.families?.name ?? 'N/A'}</TableCell>
                  <TableCell>{student.belt_rank}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild className="mr-2">
                      {/* Link to a future detail/edit page */}
                      <Link to={`/admin/students/${student.id}`}>View/Edit</Link>
                    </Button>
                    {/* Add delete button/logic later */}
                  </TableCell>
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
  console.error("Error caught in StudentsAdminPage ErrorBoundary:", error);

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
      <h2 className="text-xl font-bold mb-2">Error Loading Students</h2>
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
