import {json} from "@remix-run/node";
import {Link, useLoaderData, useRouteError} from "@remix-run/react";
import {createClient} from '@supabase/supabase-js';
import type {Database} from "~/types/database.types";
import {Button} from "~/components/ui/button";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "~/components/ui/table"; // Assuming you have Table components
import {AppBreadcrumb, breadcrumbPatterns} from "~/components/AppBreadcrumb";

type FamilyWithGuardians = {
    id: string;
    name: string;
    email: string;
    primary_phone: string;
    guardians: {
        first_name: string | null;
        last_name: string | null;
    }[];
};

export async function loader() {
    // console.log("Entering /admin/families loader...");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin families loader: Missing Supabase URL or Service Role Key env variables.");
        throw new Response("Server configuration error.", {status: 500});
    }

    // Use service role client for admin data access
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        // console.log("Admin families loader - Fetching all families and related guardians using service role...");
        // Fetch family data and related guardian names
        const {data: families, error} = await supabaseAdmin
            .from('families')
            .select(`
        *,
        guardians ( first_name, last_name ) 
      `) // Fetch names from the related guardians table
            .order('name', {ascending: true}); // Order by family name

        if (error) {
            console.error("Error fetching families:", error.message);
            throw new Response("Failed to load family data.", {status: 500});
        }

        // console.log(`Admin families loader - Fetched ${families?.length ?? 0} families.`);
        return json({families: families ?? []});

    } catch (error) {
        // Catch potential errors during client creation or network issues
        if (error instanceof Error) {
            console.error("Error in /admin/families loader:", error.message);
            throw new Response(error.message, {status: 500});
        } else {
            console.error("Unknown error in /admin/families loader:", error);
            throw new Response("An unknown error occurred.", {status: 500});
        }
    }
}

export default function FamiliesAdminPage() {
    // Use the specific type for the loader data
    const {families} = useLoaderData<{ families: FamilyWithGuardians[] }>();

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.adminFamilies()} className="mb-6" />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Manage Families</h1>
                <Button asChild>
                    <Link to="/admin/families/new">Add New Family</Link>
                </Button>
            </div>

            {families.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">No families found.</p>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Family Name</TableHead>
                                <TableHead>Primary Contact</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {families.map((family) => (
                                <TableRow key={family.id}>
                                    <TableCell className="font-medium">{family.name}</TableCell>
                                    {/* Display name of the first guardian as primary contact */}
                                    <TableCell>
                                        {family.guardians && family.guardians.length > 0 && family.guardians[0]
                                            ? `${family.guardians[0].first_name || ''} ${family.guardians[0].last_name || ''}`.trim()
                                            : 'N/A'}
                                    </TableCell>
                                    <TableCell>{family.email}</TableCell>
                                    <TableCell>{family.primary_phone}</TableCell>
                                    <TableCell>
                                        {/* Wrap Link inside Button without asChild as a test */}
                                        <Button variant="outline" size="sm"
                                                className="mr-2 p-0"> {/* Remove padding for link */}
                                            <Link to={`/admin/families/${family.id}`}
                                                  className="block w-full h-full px-3 py-1.5"> {/* Make link fill button area */}
                                                View Details
                                            </Link>
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
    console.error("Error caught in FamiliesAdminPage ErrorBoundary:", error);

    // Determine if it's a Response error or a standard Error
    let errorMessage = "An unknown error occurred.";
    let errorStack = undefined;
    if (error instanceof Response) {
        // We might not have a detailed message from Response errors thrown manually
        errorMessage = `Error: ${error.status} - ${error.statusText || 'Failed to load data.'}`;
        // Cannot reliably get stack from Response object
    } else if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
    }


    return (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <h2 className="text-xl font-bold mb-2">Error Loading Families</h2>
            <p>{errorMessage}</p>
            {process.env.NODE_ENV === "development" && errorStack && (
                <pre className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs">
          {errorStack}
        </pre>
            )}
            {/* Display Response details if available and in development */}
            {process.env.NODE_ENV === "development" && error instanceof Response && (
                <pre className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs">
           Status: {error.status} {error.statusText}
                    {/* Attempt to read body if possible, might fail depending on error */}
                    {/* Body: {await error.text().catch(() => 'Could not read body')} */}
         </pre>
            )}
        </div>
    );
}
