import invariant from "tiny-invariant";
import { type ActionFunctionArgs, json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import {
    isRouteErrorResponse,
    Link,
    Outlet,
    useFetcher,
    useLoaderData,
    useOutlet,
    useParams,
    useRouteError,
} from "@remix-run/react";
import React from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Trash2, Edit, Plus } from "lucide-react";
import { formatDate } from "~/utils/misc";
import { getFamilyDetails, type FamilyDetails } from "~/services/family.server";
import { getGuardiansByFamily } from "~/services/guardian.server";
import { deleteStudent } from "~/services/student.server";
import { requireAdminUser } from "~/utils/auth.server";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import type { Database } from "~/types/database.types";

type GuardianRow = Database['public']['Tables']['guardians']['Row'];

// Define the shape of the data returned by the loader using the imported type
type LoaderData = {
    family: FamilyDetails;
    guardians: GuardianRow[];
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    // Access family name via the nested structure
    const familyName = data?.family?.name ?? "Family Details";
    return [
        {title: `${familyName} | Admin Dashboard`},
        {name: "description", content: `Details for the ${familyName} family.`},
    ];
};


export async function loader({ request, params }: LoaderFunctionArgs) {
    const user = await requireAdminUser(request);
    
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId;
    console.log(`[Loader] Requesting family details for ID: ${familyId}`);

    // Create a response object for potential header setting (if needed later)
    const response = new Response();

    try {
        // Call the service functions to get family details and guardians
        const [familyDetails, guardians] = await Promise.all([
            getFamilyDetails(familyId),
            getGuardiansByFamily(familyId, user.id)
        ]);

        // Return the data using Remix's json helper
        return json({ family: familyDetails, guardians }, { headers: response.headers });

    } catch (error) {
        console.error(`[Loader] Error caught while fetching family ${familyId}:`, error);
        // Re-throw the error if it's already a Response (like 404 or 500 from the service)
        if (error instanceof Response) {
            throw error;
        }
        // Otherwise, wrap it in a generic 500 response
        throw new Response("An unexpected error occurred while loading family details.", { status: 500, headers: response.headers });
    }
}

// Action function to handle deletions etc.
export async function action({request, params}: ActionFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId; // Keep familyId for potential redirects/context
    const formData = await request.formData();
    const intent = formData.get("intent") as string; // Use 'as string' for simplicity here

    if (intent === "deleteStudent") {
        const studentId = formData.get("studentId") as string;
        invariant(studentId, "Missing studentId for deletion");

        console.log(`[Action] Attempting to delete student ${studentId} from family ${familyId}`);

        try {
            // Call the service function to delete the student
            // No need to create supabaseAdmin here, service function handles it
            await deleteStudent(studentId);

            console.log(`[Action] Successfully deleted student ${studentId}`);
            // Return success, fetcher will cause UI update via revalidation
            return json({ success: true });

        } catch (error) {
            console.error(`[Action Delete Student] Error deleting student ${studentId}:`, error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            // Return error in JSON format for the fetcher
            // Use 500 for server-side errors from the service
            return json({ error: `Failed to delete student: ${errorMessage}` }, { status: 500 });
        }
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
    // Destructure the nested family object which now contains oneOnOneBalance
    const { family, guardians } = useLoaderData<LoaderData>();
    const params = useParams();
    const outlet = useOutlet();

    return (
        // Added standard page container
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Render child routes (like the edit page) here */}
            <Outlet/>

            {/* Only render the detail view if no child route (like edit) is active */}
            {!outlet && (
                <>
                    <AppBreadcrumb items={breadcrumbPatterns.adminFamilyDetail(family.name)} className="mb-6" />
                    
                    {/* Updated header to match standard site styling */}
                    <div className="text-center mb-10">
                        {/* Adjusted header classes to match payments page */}
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 sm:text-4xl">
                            Family: {family.name}
                        </h1>
                        <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                            View and manage family details, students, and balances.
                        </p>
                    </div>
                    {/* Removed original header div */}

                    {/* Added explicit background to match payments page table container */}
                    <Card className="bg-white dark:bg-gray-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle>Family Details</CardTitle>
                            {/* Reverting to outline variant for consistency with Add Student button */}
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
                                At:</strong> {formatDate(family.created_at, { formatString: 'PPP p' })}
                            </p>
                            <p><strong>Updated
                                At:</strong> {formatDate(family.updated_at, { formatString: 'PPP p' })}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Individual Session Balance Card */}
                    {/* Added explicit background */}
                    <Card className="bg-white dark:bg-gray-800">
                        <CardHeader>
                            <CardTitle>Individual Session Balance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Access balance from the family object */}
                            <p className="text-2xl font-bold">{family.oneOnOneBalance ?? 0}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Remaining Sessions</p>
                            {/* Optional: Link to record usage */}
                        </CardContent>
                    </Card>

                    {/* Waiver Signatures Card */}
                    <Card className="bg-white dark:bg-gray-800">
                        <CardHeader>
                            <CardTitle>Waiver Signatures</CardTitle>
                            <CardDescription>
                                Signed waivers for all family members
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {family.waiverSignatures && family.waiverSignatures.length > 0 ? (
                                <div className="space-y-4">
                                    {family.waiverSignatures.map((signature) => (
                                        <div key={signature.id} className="border p-4 rounded-md shadow-sm">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <p className="font-semibold text-lg">{signature.waiver_title}</p>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        Signed by: <span className="font-medium">{signature.signer_name}</span>
                                                    </p>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        Date: {formatDate(signature.signed_at, { formatString: 'PPP p' })}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                                        Agreement Version: {signature.agreement_version}
                                                    </p>
                                                    {/* Signature Image */}
                                                    {signature.signature_data && (
                                                        <div className="mt-3">
                                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Signature:</p>
                                                            <div className="border border-gray-200 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700 max-w-md">
                                                                <img 
                                                                    src={signature.signature_data} 
                                                                    alt={`Signature by ${signature.signer_name}`}
                                                                    className="max-w-full h-auto max-h-24 object-contain dark:invert"
                                                                    style={{ imageRendering: 'crisp-edges' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="ml-4">
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link to={`/admin/waivers/${signature.waiver_id}`} className="text-green-600 hover:underline dark:text-green-400">
                                                            View Waiver
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400">No waiver signatures found for this family.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Guardians Card */}
                     <Card className="bg-white dark:bg-gray-800">
                         <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                             <CardTitle>Guardians</CardTitle>
                         </CardHeader>
                         <CardContent className="pt-4">
                             {guardians && guardians.length > 0 ? (
                                 <ul className="space-y-4">
                                     {guardians.map((guardian) => (
                                         <li key={guardian.id} className="border p-4 rounded-md shadow-sm">
                                             <div className="flex justify-between items-center">
                                                 <div>
                                                     <p className="font-semibold">{guardian.first_name} {guardian.last_name}</p>
                                                     <p className="text-sm text-gray-600 dark:text-gray-400">
                                                         Email: {guardian.email || 'N/A'}
                                                     </p>
                                                     <p className="text-sm text-gray-600 dark:text-gray-400">
                                                         Phone: {guardian.cell_phone || guardian.home_phone || 'N/A'}
                                                     </p>
                                                     <p className="text-sm text-gray-600 dark:text-gray-400">
                                                         Relationship: {guardian.relationship || 'N/A'}
                                                     </p>
                                                 </div>
                                                 <div className="flex space-x-2">
                                                     <Button asChild variant="outline" size="sm">
                                                         <Link to={`/admin/families/${params.familyId}/guardians/edit`}>
                                                             <Edit className="h-4 w-4 mr-1" />
                                                             Edit Guardians
                                                         </Link>
                                                     </Button>
                                                 </div>
                                             </div>
                                         </li>
                                     ))}
                                 </ul>
                             ) : (
                                 <div className="text-center py-4">
                                     <p className="text-gray-500 dark:text-gray-400 mb-4">No guardians associated with this family.</p>
                                     <Button asChild variant="outline" size="sm">
                                         <Link to={`/admin/families/${params.familyId}/guardians/edit`}>
                                             <Plus className="h-4 w-4 mr-1" />
                                             Manage Guardians
                                         </Link>
                                     </Button>
                                 </div>
                             )}
                         </CardContent>
                     </Card>

                    {/* Students Card */}
                    <Card className="bg-white dark:bg-gray-800">
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
                                                        DOB: {formatDate(student.birth_date, { formatString: 'PPP' })}
                                                    </p>
                                                    {/* Belt display removed - view on student detail page */}
                                                </div>
                                                <div className="flex space-x-2">
                                                    {/* Changed variant to outline to match other non-destructive actions */}
                                                    <Button asChild variant="outline" size="sm">
                                                        {/* Added green link styling */}
                                                        <Link to={`/admin/students/${student.id}`}
                                                              className="text-green-600 hover:underline dark:text-green-400">
                                                            View Details
                                                        </Link>
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
