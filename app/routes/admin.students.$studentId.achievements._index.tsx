import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect, TypedResponse } from "@remix-run/node";
import { Link, useLoaderData, Form, useNavigation, useParams, useSubmit } from "@remix-run/react";
import { createClient } from '@supabase/supabase-js';
import type { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { format } from 'date-fns';
import { Trash2, Edit } from 'lucide-react'; // Icons for actions

// Define types
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>;
type AchievementRow = Database['public']['Tables']['achievements']['Row'];

type LoaderData = {
  student: StudentRow;
  achievements: AchievementRow[];
  error?: string;
};

type ActionData = {
  success?: boolean;
  message?: string;
  error?: string;
};

// Loader function to fetch student and their achievements
export async function loader({ params }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
  const studentId = params.studentId;
  if (!studentId) {
    throw new Response("Student ID is required", { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Admin achievements loader: Missing Supabase URL or Service Role Key env variables.");
    throw new Response("Server configuration error.", { status: 500 });
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

  // Fetch student basic info
  const { data: studentData, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id, first_name, last_name')
    .eq('id', studentId)
    .single();

  if (studentError || !studentData) {
    console.error("Error fetching student for achievements:", studentError?.message);
    throw new Response("Student not found", { status: 404 });
  }

  // Fetch achievements for the student
  const { data: achievementsData, error: achievementsError } = await supabaseAdmin
    .from('achievements')
    .select('*')
    .eq('student_id', studentId)
    .order('awarded_date', { ascending: false });

  if (achievementsError) {
    console.error("Error fetching achievements:", achievementsError?.message);
    // Return student data even if achievements fail to load
    return json({ student: studentData, achievements: [], error: "Failed to load achievements." });
  }

  return json({ student: studentData, achievements: achievementsData });
}

// Action function to handle achievement deletion
export async function action({ request, params }: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const studentId = params.studentId;
    const formData = await request.formData();
    const intent = formData.get("intent");
    const achievementId = formData.get("achievementId") as string;

    if (intent !== "delete" || !achievementId || !studentId) {
        return json({ error: "Invalid request." }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return json({ error: "Server configuration error." }, { status: 500 });
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Verify achievement belongs to the student before deleting (optional but good practice)
    const { data: achievement, error: fetchError } = await supabaseAdmin
        .from('achievements')
        .select('id')
        .eq('id', achievementId)
        .eq('student_id', studentId)
        .single();

    if (fetchError || !achievement) {
        return json({ error: "Achievement not found or does not belong to this student." }, { status: 404 });
    }

    // Delete the achievement
    const { error: deleteError } = await supabaseAdmin
        .from('achievements')
        .delete()
        .eq('id', achievementId);

    if (deleteError) {
        console.error("Error deleting achievement:", deleteError);
        return json({ error: "Failed to delete achievement. " + deleteError.message }, { status: 500 });
    }

    return json({ success: true, message: "Achievement deleted successfully." });
}


export default function AdminStudentAchievementsPage() {
  const { student, achievements, error } = useLoaderData<LoaderData>();
  const navigation = useNavigation();
  const params = useParams(); // Get studentId from URL params
  const submit = useSubmit();

  const isSubmitting = navigation.state === "submitting";

  const handleDelete = (achievementId: string) => {
      if (!confirm("Are you sure you want to delete this achievement?")) {
          return;
      }
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("achievementId", achievementId);
      submit(formData, { method: "post" });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
            <Link to={`/admin/students/${params.studentId}`} className="text-blue-600 hover:underline mb-2 inline-block text-sm">
                &larr; Back to Student Details
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                Achievements for {student.first_name} {student.last_name}
            </h1>
        </div>
        <Button asChild>
          <Link to={`/admin/students/${student.id}/achievements/new`}>Add New Achievement</Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error Loading Achievements</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {achievements.length === 0 && !error ? (
        <p className="text-gray-600 dark:text-gray-400">No achievements recorded for this student yet.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Awarded Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {achievements.map((achievement) => (
                <TableRow key={achievement.id}>
                  <TableCell className="font-medium">{achievement.type}</TableCell>
                  <TableCell>{achievement.description}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {format(new Date(achievement.awarded_date), 'MMM d, yyyy')}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap">
                    <Button variant="outline" size="icon" asChild title="Edit Achievement">
                      <Link to={`/admin/students/${student.id}/achievements/${achievement.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    {/* Use a Form for delete to trigger the action */}
                    <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(achievement.id)}
                        disabled={isSubmitting && navigation.formData?.get('achievementId') === achievement.id}
                        title="Delete Achievement"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
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

// Optional: Add a specific ErrorBoundary for this route
export function ErrorBoundary() {
  // ... (similar ErrorBoundary as in admin.students._index.tsx, adapted for achievements)
  return <div>Error loading achievements page.</div>;
}
