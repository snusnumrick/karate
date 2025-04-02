import invariant from "tiny-invariant"; // Use tiny-invariant instead
import node from "@remix-run/node"; // Import default
const { json } = node; // Destructure only json
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"; // Keep type imports separate
// Import isRouteErrorResponse from @remix-run/react
import { Link, useLoaderData, useParams, useRouteError, isRouteErrorResponse } from "@remix-run/react";
// Import createClient directly
import { createClient } from "@supabase/supabase-js";
// Import the missing helper function
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { format } from 'date-fns'; // For formatting dates if needed

type FamilyRow = Database['public']['Tables']['families']['Row'];
type GuardianRow = Database['public']['Tables']['guardians']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];

// Define the shape of the data returned by the loader
type LoaderData = {
  family: FamilyRow & {
    guardians: GuardianRow[];
    students: StudentRow[];
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const familyName = data?.family?.name ?? "Family Details";
  return [
    { title: `${familyName} | Admin Dashboard` },
    { name: "description", content: `Details for the ${familyName} family.` },
  ];
};


export async function loader({ params, request }: LoaderFunctionArgs) {
  invariant(params.familyId, "Missing familyId parameter");
  const familyId = params.familyId;
  console.log(`[Loader] Fetching family details for ID: ${familyId}`); // Log the ID

  // Use the correct function and destructure the server client
  const { supabaseServer, response } = getSupabaseServerClient(request); // Use supabaseServer

  console.log('[Loader] Supabase client initialized. Fetching data...'); // Log before query
  const { data: familyData, error: familyError } = await supabaseServer // Use the server client
    .from('families')
    .select(`
      *,
      guardians (*),
      students (*)
    `)
    .eq('id', familyId); // Remove .single() - fetch potential multiple rows

  // Log the result from Supabase
  console.log('[Loader] Supabase query result:', { familyData, familyError });

  if (familyError) {
      console.error(`[Loader] Supabase error fetching family ${familyId}:`, familyError.message);
      // Throw a 500 for actual DB errors, keeping response headers
      throw new Response(`Database error: ${familyError.message}`, { status: 500, headers: response.headers });
  }

  // Check if any data was returned
  if (!familyData || familyData.length === 0) {
      console.warn(`[Loader] No family data found for ID: ${familyId}. Throwing 404.`);
      // Throw 404 specifically if no data is returned
      throw new Response("Family not found", { status: 404, headers: response.headers });
  }

  // Warn if multiple families found with the same ID (data integrity issue)
  if (familyData.length > 1) {
      console.warn(`[Loader] Multiple families found for ID: ${familyId}. Using the first result. Please check database for duplicates.`);
  }

  // Use the first family found
  const firstFamilyData = familyData[0];

  // Ensure guardians and students are arrays even if null/undefined from query
  const family = {
      ...firstFamilyData, // Use the first result
      guardians: firstFamilyData.guardians ?? [],
      students: firstFamilyData.students ?? [],
  };


  return json({ family }, { headers: response.headers });
}

export default function FamilyDetailPage() {
  const { family } = useLoaderData<LoaderData>();
  const params = useParams(); // Get params again for edit link if needed

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Family: {family.name}</h1>
        {/* Add Edit button later if an edit route exists */}
        {/* <Button asChild variant="outline">
          <Link to={`/admin/families/${params.familyId}/edit`}>Edit Family</Link>
        </Button> */}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Family Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><strong>Email:</strong> {family.email}</p>
          <p><strong>Primary Phone:</strong> {family.primary_phone ?? 'N/A'}</p>
          <p><strong>Secondary Phone:</strong> {family.secondary_phone ?? 'N/A'}</p>
          <p><strong>Address:</strong> {family.address ?? 'N/A'}</p>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Guardians</CardTitle>
        </CardHeader>
        <CardContent>
          {family.guardians.length > 0 ? (
            <ul className="space-y-2">
              {family.guardians.map((guardian) => (
                <li key={guardian.id} className="border-b pb-2 last:border-b-0">
                  <p><strong>Name:</strong> {guardian.first_name} {guardian.last_name}</p>
                  <p><strong>Relationship:</strong> {guardian.relationship ?? 'N/A'}</p>
                  <p><strong>Phone:</strong> {guardian.phone ?? 'N/A'}</p>
                  <p><strong>Email:</strong> {guardian.email ?? 'N/A'}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No guardians associated with this family.</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
        </CardHeader>
        <CardContent>
          {family.students.length > 0 ? (
            <ul className="space-y-4">
              {family.students.map((student) => (
                <li key={student.id} className="border p-4 rounded-md shadow-sm">
                   <div className="flex justify-between items-center">
                     <div>
                        <p className="font-semibold">{student.first_name} {student.last_name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            DOB: {student.dob ? format(new Date(student.dob), 'PPP') : 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Belt: {student.belt_rank ?? 'N/A'}
                        </p>
                     </div>
                     <Button asChild variant="secondary" size="sm">
                        <Link to={`/admin/students/${student.id}`}>View Details</Link>
                     </Button>
                   </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No students associated with this family.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Basic Error Boundary for this route
export function ErrorBoundary() {
    const error = useRouteError();
    const params = useParams();

    // Log the error to the console for debugging
    console.error(`Error loading family ${params.familyId}:`, error);

    let status = 500;
    let message = "An unexpected error occurred.";

    if (isRouteErrorResponse(error)) {
        status = error.status;
        if (status === 404) {
            message = `Family with ID "${params.familyId}" not found.`;
        } else {
            message = error.data?.message || error.statusText || "Error loading family data.";
        }
    } else if (error instanceof Error) {
        message = error.message;
    }

    return (
        <div className="container mx-auto p-4">
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive">Error Loading Family</CardTitle>
                    <CardDescription>Status Code: {status}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>{message}</p>
                    <div className="mt-4">
                        <Button variant="outline" asChild>
                            <Link to="/admin/families">Back to Families List</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
