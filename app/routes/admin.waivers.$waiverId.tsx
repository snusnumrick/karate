import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
} from "@remix-run/react";
import { createClient } from '@supabase/supabase-js';
import type { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"; // For displaying errors

// Loader to fetch a single waiver
export async function loader({ params }: LoaderFunctionArgs) {
  console.log("Entering /admin/waivers/$waiverId loader...");
  const waiverId = params.waiverId;

  if (!waiverId) {
    throw new Response("Waiver ID is required", { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Admin waiver detail loader: Missing Supabase env variables.");
    throw new Response("Server configuration error.", { status: 500 });
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`Fetching waiver with ID: ${waiverId}`);
    const { data: waiver, error } = await supabaseAdmin
      .from('waivers')
      .select('*')
      .eq('id', waiverId)
      .single(); // Expect a single result

    if (error) {
      console.error("Error fetching waiver:", error.message);
      if (error.code === 'PGRST116') { // PostgREST code for "Resource not found"
         throw new Response("Waiver not found.", { status: 404 });
      }
      throw new Response("Failed to load waiver data.", { status: 500 });
    }

    if (!waiver) {
       throw new Response("Waiver not found.", { status: 404 });
    }

    console.log("Waiver data fetched successfully.");
    return json({ waiver });

  } catch (error) {
     // Re-throw Response errors, handle others
     if (error instanceof Response) throw error;

     if (error instanceof Error) {
       console.error("Error in /admin/waivers/$waiverId loader:", error.message);
       throw new Response(error.message, { status: 500 });
     } else {
       console.error("Unknown error in /admin/waivers/$waiverId loader:", error);
       throw new Response("An unknown error occurred.", { status: 500 });
     }
  }
}

// Action to update a waiver
export async function action({ request, params }: ActionFunctionArgs) {
  console.log("Entering /admin/waivers/$waiverId action...");
  const waiverId = params.waiverId;

  if (!waiverId) {
    return json({ error: "Waiver ID is missing." }, { status: 400 });
  }

  const formData = await request.formData();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const content = formData.get("content") as string;
  // Checkbox value is 'on' if checked, null otherwise
  const required = formData.get("required") === "on";

  // Basic validation (consider using Zod for more complex validation)
  if (!title || !description || !content) {
    return json({ error: "Title, Description, and Content are required." }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Admin waiver update action: Missing Supabase env variables.");
    return json({ error: "Server configuration error." }, { status: 500 });
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`Updating waiver with ID: ${waiverId}`);
    const { error } = await supabaseAdmin
      .from('waivers')
      .update({
        title,
        description,
        content,
        required,
      })
      .eq('id', waiverId);

    if (error) {
      console.error("Error updating waiver:", error.message);
      return json({ error: `Failed to update waiver: ${error.message}` }, { status: 500 });
    }

    console.log("Waiver updated successfully.");
    // Redirect back to the waivers list after successful update
    return redirect("/admin/waivers");

  } catch (error) {
     const message = error instanceof Error ? error.message : "An unknown error occurred.";
     console.error("Error in /admin/waivers/$waiverId action:", message);
     return json({ error: message }, { status: 500 });
  }
}


// Component to display and edit the waiver
export default function EditWaiverPage() {
  const { waiver } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/admin/waivers" className="text-green-600 hover:underline mb-4 inline-block">
        &larr; Back to Waivers List
      </Link>
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">Edit Waiver</h1>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <Form method="post">
          {actionData?.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{actionData.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                type="text"
                defaultValue={waiver.title}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                type="text"
                defaultValue={waiver.description}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="content">Content (Markdown supported)</Label>
              <Textarea
                id="content"
                name="content"
                defaultValue={waiver.content}
                required
                rows={10}
                className="mt-1 font-mono" // Use mono font for markdown editing
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="required"
                name="required"
                defaultChecked={waiver.required}
              />
              <Label htmlFor="required">Required for Registration</Label>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// Add a specific ErrorBoundary for this route
export function ErrorBoundary() {
  const error = useRouteError();
  console.error("Error caught in EditWaiverPage ErrorBoundary:", error);

  let statusCode = 500;
  let errorMessage = "An unknown error occurred.";
  let errorStack = undefined;

  if (error instanceof Response) {
     statusCode = error.status;
     errorMessage = `Error: ${error.status} - ${error.statusText || 'Failed to load data.'}`;
     // Try to read body for more details, especially for 404
     // Note: Reading the body might consume it, handle carefully if needed elsewhere
     // const bodyText = await error.text().catch(() => '');
     // if (bodyText) errorMessage += ` Body: ${bodyText}`;
  } else if (error instanceof Error) {
     errorMessage = error.message;
     errorStack = error.stack;
  }

  return (
    <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
      <h2 className="text-xl font-bold mb-2">
        {statusCode === 404 ? "Waiver Not Found" : "Error Loading Waiver"}
      </h2>
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
       <div className="mt-4">
         <Link to="/admin/waivers" className="text-blue-600 hover:underline">
           &larr; Go back to Waivers List
         </Link>
       </div>
    </div>
  );
}
