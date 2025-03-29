import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link, Form } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import type { Student } from "~/types/models"; // Assuming models are defined

export async function loader({ request, params }: LoaderFunctionArgs) {
  const studentId = params.studentId;
  if (!studentId) {
    throw new Response("Student ID is required", { status: 400 });
  }

  const { supabaseServer, headers } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    // Redirect to login if user is not authenticated
    return redirect("/login?redirectTo=/family", { headers });
  }

  // Fetch the student data
  const { data: studentData, error: studentError } = await supabaseServer
    .from('students')
    .select('*') // Select all student fields
    .eq('id', studentId)
    .single();

  if (studentError || !studentData) {
    console.error("Error fetching student data:", studentError?.message);
    // Throw a 404 if student not found
    throw new Response("Student not found", { status: 404 });
  }

  // Verify the logged-in user belongs to the same family as the student
  const { data: profileData, error: profileError } = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profileData || profileData.family_id !== studentData.family_id) {
    console.error("Authorization error: User", user.id, "tried to access student", studentId, "from different family.");
    // Throw a 403 Forbidden error if user is not part of the student's family
    throw new Response("Forbidden: You do not have permission to view this student.", { status: 403 });
  }

  // Return the student data
  return json({ student: studentData as Student }, { headers });
}

// TODO: Add action function for handling form submissions (edit/delete)
// export async function action({ request, params }: ActionFunctionArgs) { ... }

export default function StudentDetailPage() {
  const { student } = useLoaderData<typeof loader>();
  // const actionData = useActionData<typeof action>(); // For form feedback

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/family" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Family Portal</Link>

      <h1 className="text-3xl font-bold mb-6">Student Details: {student.first_name} {student.last_name}</h1>

      {/* Display Student Information */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p><strong>First Name:</strong> {student.first_name}</p>
          <p><strong>Last Name:</strong> {student.last_name}</p>
          <p><strong>Gender:</strong> {student.gender}</p>
          <p><strong>Birth Date:</strong> {new Date(student.birth_date).toLocaleDateString()}</p>
          <p><strong>Belt Rank:</strong> {student.belt_rank || 'N/A'}</p>
          <p><strong>T-Shirt Size:</strong> {student.t_shirt_size}</p>
          <p><strong>School:</strong> {student.school}</p>
          <p><strong>Grade Level:</strong> {student.grade_level}</p>
          <p><strong>Cell Phone:</strong> {student.cell_phone || 'N/A'}</p>
          <p><strong>Email:</strong> {student.email || 'N/A'}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
         <h2 className="text-xl font-semibold mb-4 border-b pb-2">Health Information</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <p><strong>Immunizations Up-to-Date:</strong> {student.immunizations_up_to_date ? 'Yes' : 'No'}</p>
            <p><strong>Immunization Notes:</strong> {student.immunization_notes || 'None'}</p>
            <p><strong>Allergies:</strong> {student.allergies || 'None'}</p>
            <p><strong>Medications:</strong> {student.medications || 'None'}</p>
            <p><strong>Special Needs:</strong> {student.special_needs || 'None'}</p>
         </div>
      </div>


      {/* TODO: Add Edit Form/Button */}
      <div className="mb-6">
        <Button variant="outline">Edit Student (Coming Soon)</Button>
        {/* Example Edit Form Structure (to be implemented)
        <Form method="post">
          <input type="hidden" name="intent" value="edit" />
          {/* ... form fields ... *\/}
          <Button type="submit">Save Changes</Button>
        </Form>
        */}
      </div>

      {/* TODO: Add Delete Button/Form */}
      <div>
         <Button variant="destructive" disabled>Delete Student (Coming Soon)</Button>
         {/* Example Delete Form Structure (to be implemented with confirmation)
         <Form method="post" onSubmit={(e) => !confirm('Are you sure?') && e.preventDefault()}>
            <input type="hidden" name="intent" value="delete" />
            <Button type="submit" variant="destructive">Delete Student</Button>
         </Form>
         */}
      </div>

      {/* Display action feedback if needed */}
      {/* {actionData?.error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}
      {actionData?.success && (
        <Alert variant="default" className="mt-4">
           <AlertTitle>Success</AlertTitle>
           <AlertDescription>{actionData.message}</AlertDescription>
        </Alert>
      )} */}

    </div>
  );
}

// Add an ErrorBoundary specific to this route if needed
// export function ErrorBoundary() { ... }
