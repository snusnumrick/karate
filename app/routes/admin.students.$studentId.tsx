import { json, type LoaderFunctionArgs, TypedResponse } from "@remix-run/node";
import { Link, useLoaderData, useRouteError } from "@remix-run/react";
import { createClient } from '@supabase/supabase-js';
import type { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { format } from 'date-fns';

// Define types
type StudentRow = Database['public']['Tables']['students']['Row'];
type FamilyRow = Database['public']['Tables']['families']['Row'];
type BeltRankEnum = Database['public']['Enums']['belt_rank_enum'];

// Extend student type to include family name and use enum
type StudentWithFamily = Omit<StudentRow, 'belt_rank'> & {
    belt_rank: BeltRankEnum | null;
    families: Pick<FamilyRow, 'id' | 'name'> | null; // Include family ID and name
};

type LoaderData = {
    student: StudentWithFamily;
};

// Helper mapping for belt colors (copied from family student detail)
const beltColorMap: Record<string, string> = {
  white: 'bg-white border border-gray-300',
  yellow: 'bg-yellow-200',
  orange: 'bg-orange-300',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  red: 'bg-red-600',
  brown: 'bg-yellow-800',
  black: 'bg-black',
};


export async function loader({ params }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const studentId = params.studentId;
    if (!studentId) {
        throw new Response("Student ID is required", { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin student detail loader: Missing Supabase URL or Service Role Key env variables.");
        throw new Response("Server configuration error.", { status: 500 });
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Fetch student data and related family name using service role
    const { data: studentData, error } = await supabaseAdmin
        .from('students')
        .select(`
            *,
            families ( id, name )
        `)
        .eq('id', studentId)
        .single();

    if (error || !studentData) {
        console.error("Error fetching student for admin view:", error?.message);
        throw new Response("Student not found", { status: 404 });
    }

    // Explicitly cast to ensure type safety, especially with the nested family object and enum
    const typedStudentData = studentData as StudentWithFamily;

    return json({ student: typedStudentData });
}

export default function AdminStudentDetailPage() {
    const { student } = useLoaderData<LoaderData>();

    // TODO: Add Edit functionality later with useState and Form

    return (
        <div className="container mx-auto px-4 py-8">
            <Link to="/admin/students" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Student List</Link>

            <div className="flex justify-between items-center mb-6">
                 <h1 className="text-3xl font-bold">Student Details: {student.first_name} {student.last_name}</h1>
                 {/* TODO: Add Edit Button */}
                 <Button variant="outline" disabled>Edit Student (WIP)</Button>
            </div>


            {/* Display Student Information */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p><strong>First Name:</strong> {student.first_name}</p>
                    <p><strong>Last Name:</strong> {student.last_name}</p>
                    <p><strong>Family:</strong> {student.families ? <Link to={`/admin/families/${student.families.id}`} className="text-blue-600 hover:underline">{student.families.name}</Link> : 'N/A'}</p>
                    <p><strong>Gender:</strong> {student.gender}</p>
                    <p><strong>Birth Date:</strong> {format(new Date(student.birth_date), 'PPP')}</p> {/* Use PPP for readable date */}
                    <div className="flex items-center">
                        <strong className="mr-2">Belt Rank:</strong>
                        {student.belt_rank ? (
                            <>
                                <div className={`h-4 w-8 rounded mr-2 ${beltColorMap[student.belt_rank] || 'bg-gray-400'}`}></div>
                                <span className="capitalize">{student.belt_rank}</span>
                            </>
                        ) : (
                            'N/A'
                        )}
                    </div>
                    <p><strong>T-Shirt Size:</strong> {student.t_shirt_size}</p>
                    <p><strong>School:</strong> {student.school}</p>
                    <p><strong>Grade Level:</strong> {student.grade_level || 'N/A'}</p>
                    <p><strong>Cell Phone:</strong> {student.cell_phone || 'N/A'}</p>
                    <p><strong>Email:</strong> {student.email || 'N/A'}</p>
                </div>
            </div>

            {/* Health Information Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">Health Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Display boolean 'true'/'false' as Yes/No */}
                    <p><strong>Immunizations Up-to-Date:</strong> {student.immunizations_up_to_date === 'true' ? 'Yes' : student.immunizations_up_to_date === 'false' ? 'No' : 'N/A'}</p>
                    <p><strong>Immunization Notes:</strong> {student.immunization_notes || 'None'}</p>
                    <p><strong>Allergies:</strong> {student.allergies || 'None'}</p>
                    <p><strong>Medications:</strong> {student.medications || 'None'}</p>
                    <p><strong>Special Needs:</strong> {student.special_needs || 'None'}</p>
                </div>
            </div>

             {/* Links to other related admin sections */}
             <div className="mt-8 space-x-4">
                 {/* Restore asChild for correct Button/Link integration */}
                 <Button asChild variant="secondary">
                     <Link to={`/admin/students/${student.id}/belts`}>Manage Belt Awards</Link>
                 </Button>
                 {/* Add link to attendance history filtered for this student */}
                 {/* Restore asChild here too */}
                 <Button asChild variant="secondary">
                     <Link to={`/admin/attendance?studentId=${student.id}`}>View Attendance</Link>
                 </Button>
             </div>

        </div>
    );
}

// Add a specific ErrorBoundary for this route
export function ErrorBoundary() {
  const error = useRouteError();
  console.error("Error caught in AdminStudentDetailPage ErrorBoundary:", error);

  let errorMessage = "An unknown error occurred loading the student details.";
  let errorStatus = 500;

  if (error instanceof Response) {
     errorMessage = `Error: ${error.status} - ${error.statusText || 'Failed to load data.'}`;
     errorStatus = error.status;
     // Handle 404 specifically
     if (error.status === 404) {
         errorMessage = "Student not found.";
     }
  } else if (error instanceof Error) {
     errorMessage = error.message;
  }

  return (
    <div className="container mx-auto px-4 py-8">
        <Link to="/admin/students" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Student List</Link>
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h2 className="text-xl font-bold mb-2">Error Loading Student Details ({errorStatus})</h2>
          <p>{errorMessage}</p>
        </div>
    </div>
  );
}
