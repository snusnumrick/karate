import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useRouteError } from "@remix-run/react";
import { createClient } from '@supabase/supabase-js';
import type { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge"; // For displaying 'Required' status
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

// Define type for loader data
type WaiverRow = Database['public']['Tables']['waivers']['Row'];

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("Entering /admin/waivers loader...");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Admin waivers loader: Missing Supabase URL or Service Role Key env variables.");
    throw new Response("Server configuration error.", { status: 500 });
  }

  // Use service role client for admin data access
  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    console.log("Admin waivers loader - Fetching all waivers using service role...");
    const { data: waivers, error } = await supabaseAdmin
      .from('waivers')
      .select('*') // Select all columns
      .order('title', { ascending: true });

    if (error) {
      console.error("Error fetching waivers:", error.message);
      throw new Response("Failed to load waiver data.", { status: 500 });
    }

    console.log(`Admin waivers loader - Fetched ${waivers?.length ?? 0} waivers.`);
    return json({ waivers: waivers ?? [] });

  } catch (error) {
     if (error instanceof Error) {
       console.error("Error in /admin/waivers loader:", error.message);
       throw new Response(error.message, { status: 500 });
     } else {
       console.error("Unknown error in /admin/waivers loader:", error);
       throw new Response("An unknown error occurred.", { status: 500 });
     }
  }
}

export default function WaiversAdminPage() {
  const { waivers } = useLoaderData<{ waivers: WaiverRow[] }>();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Manage Waivers</h1>
        <Button asChild>
          {/* Link to a future add waiver page */}
          <Link to="/admin/waivers/new">Add New Waiver</Link>
        </Button>
      </div>

      {waivers.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No waivers found.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waivers.map((waiver) => (
                <TableRow key={waiver.id}>
                  <TableCell className="font-medium">{waiver.title}</TableCell>
                  <TableCell>{waiver.description}</TableCell>
                  <TableCell>
                    {waiver.required ? (
                      <Badge variant="default">Required</Badge>
                    ) : (
                      <Badge variant="secondary">Optional</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild className="mr-2">
                      {/* Link to a future detail/edit page */}
                      <Link to={`/admin/waivers/${waiver.id}`}>View/Edit</Link>
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
  console.error("Error caught in WaiversAdminPage ErrorBoundary:", error);

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
      <h2 className="text-xl font-bold mb-2">Error Loading Waivers</h2>
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
