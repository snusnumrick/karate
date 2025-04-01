import { useState } from "react";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Link, Form, useActionData, useNavigation } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { Database } from "~/types/supabase"; // Use Supabase generated types

// Define the type for the student data returned by the loader more accurately
type StudentRow = Database['public']['Tables']['students']['Row'];

// Define potential action data structure
type ActionData = {
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: { [key: string]: string };
};


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

      {/* Display action feedback */}
      {actionData?.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}
      {actionData?.success && actionData.message && (
         <Alert variant="default" className="mb-4 bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{actionData.message}</AlertDescription>
         </Alert>
      )}

      {isEditing ? (
        // --- Edit Form ---
        <Form method="post" className="space-y-6">
          <input type="hidden" name="intent" value="edit" />

          {/* Information Section */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">Edit Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" name="first_name" defaultValue={student.first_name} required />
                {actionData?.fieldErrors?.first_name && <p className="text-red-500 text-sm">{actionData.fieldErrors.first_name}</p>}
              </div>
              <div>
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" name="last_name" defaultValue={student.last_name} required />
                 {actionData?.fieldErrors?.last_name && <p className="text-red-500 text-sm">{actionData.fieldErrors.last_name}</p>}
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select name="gender" defaultValue={student.gender} required>
                  <SelectTrigger id="gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="birth_date">Birth Date</Label>
                <Input id="birth_date" name="birth_date" type="date" defaultValue={student.birth_date} required />
              </div>
              <div>
                <Label htmlFor="belt_rank">Belt Rank</Label>
                 <Select name="belt_rank" defaultValue={student.belt_rank || ''}>
                    <SelectTrigger id="belt_rank"><SelectValue placeholder="Select belt rank" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="white">White</SelectItem>
                        <SelectItem value="yellow">Yellow</SelectItem>
                        <SelectItem value="orange">Orange</SelectItem>
                        <SelectItem value="green">Green</SelectItem>
                        <SelectItem value="blue">Blue</SelectItem>
                        <SelectItem value="purple">Purple</SelectItem>
                        <SelectItem value="brown">Brown</SelectItem>
                        <SelectItem value="black">Black</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="t_shirt_size">T-Shirt Size</Label>
                <Select name="t_shirt_size" defaultValue={student.t_shirt_size} required>
                  <SelectTrigger id="t_shirt_size"><SelectValue placeholder="Select size" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YXS">Youth XS</SelectItem>
                    <SelectItem value="YS">Youth S</SelectItem>
                    <SelectItem value="YM">Youth M</SelectItem>
                    <SelectItem value="YL">Youth L</SelectItem>
                    <SelectItem value="YXL">Youth XL</SelectItem>
                    <SelectItem value="AS">Adult S</SelectItem>
                    <SelectItem value="AM">Adult M</SelectItem>
                    <SelectItem value="AL">Adult L</SelectItem>
                    <SelectItem value="AXL">Adult XL</SelectItem>
                    <SelectItem value="A2XL">Adult 2XL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="school">School</Label>
                <Input id="school" name="school" defaultValue={student.school} required />
              </div>
              <div>
                <Label htmlFor="grade_level">Grade Level</Label>
                 <Select name="grade_level" defaultValue={student.grade_level} required>
                    <SelectTrigger id="grade_level"><SelectValue placeholder="Select grade" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="K">Kindergarten</SelectItem>
                        <SelectItem value="1">1st Grade</SelectItem>
                        <SelectItem value="2">2nd Grade</SelectItem>
                        <SelectItem value="3">3rd Grade</SelectItem>
                        <SelectItem value="4">4th Grade</SelectItem>
                        <SelectItem value="5">5th Grade</SelectItem>
                        <SelectItem value="6">6th Grade</SelectItem>
                        <SelectItem value="7">7th Grade</SelectItem>
                        <SelectItem value="8">8th Grade</SelectItem>
                        <SelectItem value="9">9th Grade</SelectItem>
                        <SelectItem value="10">10th Grade</SelectItem>
                        <SelectItem value="11">11th Grade</SelectItem>
                        <SelectItem value="12">12th Grade</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cell_phone">Cell Phone</Label>
                <Input id="cell_phone" name="cell_phone" type="tel" defaultValue={student.cell_phone || ''} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={student.email || ''} />
              </div>
            </div>
          </div>

          {/* Health Information Section */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">Edit Health Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex items-center space-x-2">
                 <Checkbox
                    id="immunizations_up_to_date"
                    name="immunizations_up_to_date"
                    defaultChecked={student.immunizations_up_to_date}
                 />
                 <Label htmlFor="immunizations_up_to_date">Immunizations Up-to-Date?</Label>
               </div>
               <div className="md:col-span-2"> {/* Span across columns */}
                 <Label htmlFor="immunization_notes">Immunization Notes</Label>
                 <Textarea id="immunization_notes" name="immunization_notes" defaultValue={student.immunization_notes || ''} rows={2} />
               </div>
               <div className="md:col-span-2">
                 <Label htmlFor="allergies">Allergies</Label>
                 <Textarea id="allergies" name="allergies" defaultValue={student.allergies || ''} rows={2} />
               </div>
               <div className="md:col-span-2">
                 <Label htmlFor="medications">Medications</Label>
                 <Textarea id="medications" name="medications" defaultValue={student.medications || ''} rows={2} />
               </div>
               <div className="md:col-span-2">
                 <Label htmlFor="special_needs">Special Needs</Label>
                 <Textarea id="special_needs" name="special_needs" defaultValue={student.special_needs || ''} rows={2} />
               </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 mt-6">
            <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Form>
      ) : (
        // --- View Mode ---
        <>
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

          {/* Action Buttons */}
          <div className="flex justify-between items-center mt-6">
             <Button variant="outline" onClick={() => setIsEditing(true)}>
               Edit Student
             </Button>

             {/* Delete Form */}
             <Form
                method="post"
                onSubmit={(e) => {
                  if (!confirm(`Are you sure you want to delete student ${student.first_name} ${student.last_name}? This cannot be undone.`)) {
                    e.preventDefault();
                  }
                }}
             >
                <input type="hidden" name="intent" value="delete" />
                <Button type="submit" variant="destructive" disabled={isSubmitting}>
                  {isSubmitting ? 'Deleting...' : 'Delete Student'}
                </Button>
             </Form>
          </div>
        </>
      )}

      {/* Display action feedback if needed - Moved to top */}
      {/* {actionData?.error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )} */}
    </div>
  );
}

// Add an ErrorBoundary specific to this route if needed
// export function ErrorBoundary() { ... }
