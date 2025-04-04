import invariant from "tiny-invariant"; // Use tiny-invariant instead
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, type MetaFunction} from "@remix-run/node"; // Use named imports
// Import isRouteErrorResponse from @remix-run/react
import {
    isRouteErrorResponse,
    Link,
    Outlet,
    useFetcher,
    useLoaderData,
    useOutlet,
    useParams,
    useRouteError
} from "@remix-run/react";
// Import createClient directly
import {createClient} from "@supabase/supabase-js";
// No longer need getSupabaseServerClient here
import {Database} from "~/types/supabase";
import {Button} from "~/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "~/components/ui/card";
import {Separator} from "~/components/ui/separator";
import {format} from 'date-fns';
import React from "react";

type FamilyRow = Database['public']['Tables']['families']['Row'];
type GuardianRow = Database['public']['Tables']['guardians']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];

// Define the shape of the data returned by the loader
type LoaderData = {
    family: FamilyRow & {
        guardians: GuardianRow[];
        students: StudentRow[];
    };
    oneOnOneBalance: number; // Add balance
};

export const meta: MetaFunction<typeof loader> = ({data}) => {
    const familyName = data?.family?.name ?? "Family Details";
    return [
        {title: `${familyName} | Admin Dashboard`},
        {name: "description", content: `Details for the ${familyName} family.`},
    ];
};


export async function loader({params}: LoaderFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId;
    console.log(`[Loader] Fetching family details for ID: ${familyId}`); // Log the ID

    // Retrieve and validate environment variables first
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Loader] Missing Supabase URL or Service Role Key env vars.");
        // Throw a standard Response for Remix loaders
        throw new Response("Server configuration error: Missing Supabase credentials.", {status: 500});
    }

    // Now TypeScript knows supabaseUrl and supabaseServiceKey are strings
    const response = new Response(); // Create a response object for potential header setting
    const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey);

    console.log('[Loader] Supabase client initialized. Fetching data...'); // Log before query
    const {data: familyData, error: familyError} = await supabaseServer // Use the server client
        .from('families')
        .select(`
      *,
      guardians (*),
      students (*)
    `)
        .eq('id', familyId)
        .single();

    // Log the result from Supabase
    console.log('[Loader] Supabase query result:', {familyData, familyError});

    if (familyError) {
        console.error(`[Loader] Supabase error fetching family ${familyId}:`, familyError.message);
        // Throw a 500 for actual DB errors, keeping response headers
        throw new Response(`Database error: ${familyError.message}`, {status: 500, headers: response.headers});
    }

    // Check if any data was returned
    if (!familyData) {
        console.warn(`[Loader] No family data found for ID: ${familyId}. Throwing 404.`);
        // Throw 404 specifically if no data is returned
        throw new Response("Family not found", {status: 404, headers: response.headers});
    }

    // Ensure guardians and students are arrays even if null/undefined from query
    const family = {
        ...familyData, // Use the first result
        guardians: familyData.guardians ?? [],
        students: familyData.students ?? [],
    };

    // Fetch 1:1 balance
    let oneOnOneBalance = 0;
    const { data: balanceData, error: balanceError } = await supabaseServer
        .from('family_one_on_one_balance')
        .select('total_remaining_sessions')
        .eq('family_id', familyId)
        .maybeSingle();

    if (balanceError) {
        console.error(`[Loader] Error fetching 1:1 balance for family ${familyId}:`, balanceError.message);
        // Don't fail load, just show 0
    } else if (balanceData) {
        oneOnOneBalance = balanceData.total_remaining_sessions ?? 0;
    }

    console.log(`[Loader] Family ${familyId} 1:1 balance: ${oneOnOneBalance}`);

    return json({family, oneOnOneBalance}, {headers: response.headers});
}

// Action function to handle deletions etc.
export async function action({request, params}: ActionFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId; // Keep familyId for potential redirects/context
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "deleteStudent") {
        const studentId = formData.get("studentId") as string;
        invariant(studentId, "Missing studentId for deletion");

        console.log(`[Action] Attempting to delete student ${studentId} from family ${familyId}`);

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("[Action Delete Student] Missing Supabase URL or Service Role Key env vars.");
            return json({error: "Server configuration error"}, {status: 500});
        }
        const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey);

        const {error} = await supabaseServer
            .from('students')
            .delete()
            .eq('id', studentId);

        if (error) {
            console.error(`[Action Delete Student] Supabase error deleting student ${studentId}:`, error.message);
            // Return error in JSON format for the fetcher
            return json({error: `Database error: ${error.message}`}, {status: 500});
        }

        console.log(`[Action] Successfully deleted student ${studentId}`);
        // Return success, fetcher will cause UI update via revalidation
        return json({success: true});
        // Or redirect if preferred, though fetcher works better without full reload:
        // return redirect(`/admin/families/${familyId}`);
    }

    // Handle other intents or return error if intent is unknown
    return json({error: `Unknown intent: ${intent}`}, {status: 400});
}

// Helper component for the delete button/form
function DeleteStudentButton({studentId, studentName}: { studentId: string, studentName: string }) {
    const fetcher = useFetcher<{ error?: string }>();
    const isDeleting = fetcher.state !== 'idle';

    const handleDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
        console.log('[handleDelete] Clicked delete button.'); // Add log
        if (!window.confirm(`Are you sure you want to delete ${studentName}? This cannot be undone.`)) {
            console.log('[handleDelete] User cancelled. Preventing default.'); // Add log
            event.preventDefault(); // Prevent form submission if user cancels
        } else {
            // If user confirms, default submission proceeds.
            console.log('[handleDelete] User confirmed. Allowing default submission.'); // Add log
        }
    };

    return (
        <fetcher.Form method="post">
            <input type="hidden" name="intent" value="deleteStudent"/>
            <input type="hidden" name="studentId" value={studentId}/>
            <Button
                type="submit"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
            >
                {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
            {/* Optionally display fetcher errors */}
            {fetcher.data?.error && <p className="text-xs text-destructive mt-1">{fetcher.data.error}</p>}
        </fetcher.Form>
    );
}

export default function FamilyDetailPage() {
    const {family, oneOnOneBalance} = useLoaderData<LoaderData>(); // Destructure oneOnOneBalance here
    const params = useParams(); // Get params again for edit link if needed
    const outlet = useOutlet(); // Check if a child route is being rendered

    return (
        <div className="space-y-6">
            {/* Render child routes (like the edit page) here */}
            <Outlet/>

            {/* Only render the detail view if no child route (like edit) is active */}
            {!outlet && (
                <>
                    {/* Keep the detail view content below for now,
                           or adjust structure if edit should replace details */}
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold">Family: {family.name}</h1>
                        {/* Top-level Edit button removed */}
                    </div>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle>Family Details</CardTitle>
                            <Button asChild variant="outline" size="sm">
                                <Link to={`/admin/families/${params.familyId}/edit`}>Edit Details</Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-2 pt-4"> {/* Add padding top if needed */}
                            <p><strong>Name:</strong> {family.name}</p>
                            <p><strong>Email:</strong> {family.email}</p>
                            <p><strong>Primary Phone:</strong> {family.primary_phone ?? 'N/A'}</p>
                            <p><strong>Address:</strong> {family.address ?? 'N/A'}</p>
                            <p><strong>City:</strong> {family.city ?? 'N/A'}</p>
                            <p><strong>Province:</strong> {family.province ?? 'N/A'}</p>
                            <p><strong>Postal Code:</strong> {family.postal_code ?? 'N/A'}</p>
                            <p><strong>Emergency Contact:</strong> {family.emergency_contact ?? 'N/A'}</p>
                            <p><strong>Health Info:</strong> {family.health_info ?? 'N/A'}</p>
                            <p><strong>Notes:</strong> {family.notes ?? 'N/A'}</p>
                            <p><strong>Referral Source:</strong> {family.referral_source ?? 'N/A'}</p>
                            <p><strong>Referral Name:</strong> {family.referral_name ?? 'N/A'}</p>
                            <p><strong>Created
                                At:</strong> {family.created_at ? format(new Date(family.created_at), 'PPP p') : 'N/A'}
                            </p>
                            <p><strong>Updated
                                At:</strong> {family.updated_at ? format(new Date(family.updated_at), 'PPP p') : 'N/A'}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Individual Session Balance Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Individual Session Balance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{oneOnOneBalance ?? 0}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Remaining Sessions</p>
                            {/* Optional: Link to record usage (might be better on student page) */}
                        </CardContent>
                    </Card>

                    <Separator/>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle>Guardians</CardTitle>
                            <Button asChild variant="outline" size="sm">
                                <Link to={`/admin/families/${params.familyId}/guardians/edit`}>Edit Guardians</Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="pt-4"> {/* Add padding top if needed */}
                            {family.guardians.length > 0 ? (
                                <ul className="space-y-4"> {/* Changed space-y from 1 to 4 */}
                                    {family.guardians.map((guardian) => (
                                        <li key={guardian.id}
                                            className="border p-4 rounded-md shadow-sm"> {/* Applied student list item classes */}
                                            {/* Removed flex justify-between as there's no button here */}
                                            <div>
                                                <p className="font-semibold">{guardian.first_name} {guardian.last_name}</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    <strong>Relationship:</strong> {guardian.relationship}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    <strong>Email:</strong> {guardian.email}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    <strong>Cell Phone:</strong> {guardian.cell_phone}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    <strong>Home Phone:</strong> {guardian.home_phone}
                                                </p>
                                                {guardian.work_phone && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        <strong>Work Phone:</strong> {guardian.work_phone}
                                                    </p>
                                                )}
                                                {guardian.employer && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        <strong>Employer:</strong> {guardian.employer}
                                                    </p>
                                                )}
                                                {guardian.employer_phone && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        <strong>Employer Phone:</strong> {guardian.employer_phone}
                                                    </p>
                                                )}
                                                {guardian.employer_notes && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        <strong>Employer Notes:</strong> {guardian.employer_notes}
                                                    </p>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No guardians associated with this family.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Separator/>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle>Students</CardTitle>
                            {/* Link to add a new student for this family */}
                            <Button asChild variant="outline" size="sm">
                                <Link to={`/admin/families/${params.familyId}/students/new`}>Add Student</Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="pt-4"> {/* Add padding top if needed */}
                            {family.students.length > 0 ? (
                                <ul className="space-y-4"> {/* Keep space-y-4 for students */}
                                    {family.students.map((student) => (
                                        <li key={student.id}
                                            className="border p-4 rounded-md shadow-sm"> {/* Keep p-4 for students */}
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold">{student.first_name} {student.last_name}</p>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        DOB: {student.birth_date ? format(new Date(student.birth_date), 'PPP') : 'N/A'}
                                                    </p>
                                                    {/* Belt display removed - view on student detail page */}
                                                </div>
                                                <div className="flex space-x-2">
                                                    <Button asChild variant="secondary" size="sm">
                                                        <Link to={`/admin/students/${student.id}`}>View Details</Link>
                                                    </Button>
                                                    <DeleteStudentButton studentId={student.id}
                                                                         studentName={`${student.first_name} ${student.last_name}`}/>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No students associated with this family.</p>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
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
