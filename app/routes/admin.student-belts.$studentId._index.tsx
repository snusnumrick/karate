import { useState } from "react"; // Import useState
import { json, type LoaderFunctionArgs, type ActionFunctionArgs, TypedResponse } from "@remix-run/node";
import { Link, useLoaderData, useNavigation, useParams, useSubmit, useNavigate } from "@remix-run/react"; // Import useNavigate
import { createClient } from '@supabase/supabase-js';
import type { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"; // Import AlertDialog components
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

// Define types (assuming table renamed to 'belt_awards')
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>;
type BeltAwardRow = Database['public']['Tables']['belt_awards']['Row']; // Renamed

type LoaderData = {
  student: StudentRow;
  beltAwards: BeltAwardRow[]; // Renamed
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

  // Fetch belt awards for the student (assuming table renamed)
  const { data: beltAwardsData, error: beltAwardsError } = await supabaseAdmin
    .from('belt_awards') // Renamed from 'achievements'
    .select('*')
    .eq('student_id', studentId)
    .order('awarded_date', { ascending: false });

  if (beltAwardsError) {
    console.error("Error fetching belt awards:", beltAwardsError?.message);
    // Return student data even if belt awards fail to load
    return json({ student: studentData, beltAwards: [], error: "Failed to load belt awards." }); // Renamed
  }

  return json({ student: studentData, beltAwards: beltAwardsData }); // Renamed
}

// Action function to handle belt award deletion
export async function action({ request, params }: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const studentId = params.studentId;
    const formData = await request.formData();
    const intent = formData.get("intent");
    const beltAwardId = formData.get("beltAwardId") as string; // Renamed from achievementId

    if (intent !== "delete" || !beltAwardId || !studentId) { // Renamed variable
        return json({ error: "Invalid request." }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return json({ error: "Server configuration error." }, { status: 500 });
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Verify belt award belongs to the student before deleting (optional but good practice)
    const { data: beltAward, error: fetchError } = await supabaseAdmin // Renamed variable
        .from('belt_awards') // Renamed table
        .select('id')
        .eq('id', beltAwardId) // Renamed variable
        .eq('student_id', studentId)
        .single();

    if (fetchError || !beltAward) { // Renamed variable
        return json({ error: "Belt award not found or does not belong to this student." }, { status: 404 }); // Updated message
    }

    // Delete the belt award
    const { error: deleteError } = await supabaseAdmin
        .from('belt_awards') // Renamed table
        .delete()
        .eq('id', beltAwardId); // Renamed variable

    if (deleteError) {
        console.error("Error deleting belt award:", deleteError); // Updated message
        return json({ error: "Failed to delete belt award. " + deleteError.message }, { status: 500 }); // Updated message
    }

    return json({ success: true, message: "Belt award deleted successfully." }); // Updated message
}


export default function AdminStudentAchievementsPage() { // Function name can stay for now, or rename later
  const { student, beltAwards, error } = useLoaderData<LoaderData>(); // Renamed variable
  const navigation = useNavigation();
  const params = useParams(); // Get studentId from URL params
  const submit = useSubmit();
  const navigate = useNavigate(); // Get navigate function
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null); // State for delete target

  const isSubmitting = navigation.state === "submitting";

  // Function to handle the actual form submission for delete
  const submitDelete = () => {
      if (!deleteTargetId) return; // Should not happen if dialog logic is correct

      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("beltAwardId", deleteTargetId);
      submit(formData, { method: "post" });
      setDeleteTargetId(null); // Reset target ID after submission
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
            <Link to={`/admin/students/${params.studentId}`} className="text-blue-600 hover:underline mb-2 inline-block text-sm">
                &larr; Back to Student Details
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                Belt Awards for {student.first_name} {student.last_name} {/* Renamed title */}
            </h1>
        </div>
        {/* Use onClick with navigate instead of Link/asChild - Update path */}
        <Button onClick={() => navigate(`/admin/student-belts/${student.id}/new`)}>
          Add New Belt Award
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error Loading Belt Awards</AlertTitle> {/* Renamed title */}
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {beltAwards.length === 0 && !error ? ( // Renamed variable
        <p className="text-gray-600 dark:text-gray-400">No belt awards recorded for this student yet.</p> // Updated text
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
              {beltAwards.map((beltAward) => ( // Renamed variable
                <TableRow key={beltAward.id}>
                  {/* Assuming 'type' holds the belt name */}
                  <TableCell className="font-medium">{beltAward.type}</TableCell>
                  {/* Assuming 'description' holds notes */}
                  <TableCell>{beltAward.description}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {format(new Date(beltAward.awarded_date), 'MMM d, yyyy')}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap">
                    {/* Use onClick with navigate for Edit button */}
                    <Button
                        variant="outline"
                        size="icon"
                        title="Edit Belt Award"
                        onClick={() => navigate(`/admin/student-belts/${student.id}/${beltAward.id}/edit`)}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>

                    {/* AlertDialog for Delete Confirmation */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="icon"
                          title="Delete Belt Award"
                          onClick={() => setDeleteTargetId(beltAward.id)} // Set target ID on click
                          disabled={isSubmitting && navigation.formData?.get('beltAwardId') === beltAward.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the belt award record.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeleteTargetId(null)}>Cancel</AlertDialogCancel>
                          {/* Use AlertDialogAction which closes the dialog */}
                          <AlertDialogAction
                            onClick={submitDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isSubmitting} // Disable if a delete is already in progress
                          >
                            {isSubmitting && navigation.formData?.get('beltAwardId') === deleteTargetId ? 'Deleting...' : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    {/* Removed extraneous closing Button tag */}
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
  // ... (similar ErrorBoundary as in admin.students._index.tsx, adapted for belt awards)
  return <div>Error loading belt awards page.</div>; // Updated message
}
