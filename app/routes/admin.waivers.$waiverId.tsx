import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation, useRouteError,} from "@remix-run/react";
import {createClient, type SupabaseClient} from '@supabase/supabase-js'; // Import SupabaseClient
import type {Database} from "~/types/database.types";
import {sendEmail} from '~/utils/email.server'; // Import email utility
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Textarea} from "~/components/ui/textarea";
import {Checkbox} from "~/components/ui/checkbox";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert"; // For displaying errors

// Loader to fetch a single waiver
export async function loader({params}: LoaderFunctionArgs) {
    console.log("Entering /admin/waivers/$waiverId loader...");
    const waiverId = params.waiverId;

    if (!waiverId) {
        throw new Response("Waiver ID is required", {status: 400});
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin waiver detail loader: Missing Supabase env variables.");
        throw new Response("Server configuration error.", {status: 500});
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        console.log(`Fetching waiver with ID: ${waiverId}`);
        const {data: waiver, error} = await supabaseAdmin
            .from('waivers')
            .select('*')
            .eq('id', waiverId)
            .single(); // Expect a single result

        if (error) {
            console.error("Error fetching waiver:", error.message);
            if (error.code === 'PGRST116') { // PostgREST code for "Resource not found"
                throw new Response("Waiver not found.", {status: 404});
            }
            throw new Response("Failed to load waiver data.", {status: 500});
        }

        if (!waiver) {
            throw new Response("Waiver not found.", {status: 404});
        }

        console.log("Waiver data fetched successfully.");
        return json({waiver});

    } catch (error) {
        // Re-throw Response errors, handle others
        if (error instanceof Response) throw error;

        if (error instanceof Error) {
            console.error("Error in /admin/waivers/$waiverId loader:", error.message);
            throw new Response(error.message, {status: 500});
        } else {
            console.error("Unknown error in /admin/waivers/$waiverId loader:", error);
            throw new Response("An unknown error occurred.", {status: 500});
        }
    }
}

// Action to update a waiver
export async function action({request, params}: ActionFunctionArgs) {
    console.log("Entering /admin/waivers/$waiverId action...");
    const waiverId = params.waiverId;

    if (!waiverId) {
        return json({error: "Waiver ID is missing."}, {status: 400});
    }

    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const content = formData.get("content") as string;
    // Checkbox value is 'on' if checked, null otherwise
    const required = formData.get("required") === "on";

    // Basic validation (consider using Zod for more complex validation)
    if (!title || !description || !content) {
        return json({error: "Title, Description, and Content are required."}, {status: 400});
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin waiver update action: Missing Supabase env variables.");
        return json({error: "Server configuration error."}, {status: 500});
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        // Fetch the current state of the waiver BEFORE updating
        console.log(`Fetching current state of waiver ID: ${waiverId} before update.`);
        const {data: currentWaiver, error: fetchError} = await supabaseAdmin
            .from('waivers')
            .select('required')
            .eq('id', waiverId)
            .single();

        if (fetchError || !currentWaiver) {
            console.error("Error fetching current waiver state before update:", fetchError?.message);
            return json({error: `Failed to retrieve current waiver state: ${fetchError?.message ?? 'Not found'}`}, {status: fetchError?.code === 'PGRST116' ? 404 : 500});
        }
        const originalRequired = currentWaiver.required;
        console.log(`Original 'required' status for waiver ${waiverId}: ${originalRequired}`);


        // Perform the update
        const newWaiverData = {
            title,
            description,
            content,
            required, // The new value from the form
        };
        console.log(`Attempting to update waiver ID: ${waiverId} with new data.`);
        const {error: updateError} = await supabaseAdmin
            .from('waivers')
            .update(newWaiverData)
            .eq('id', waiverId);

        if (updateError) {
            console.error("Error updating waiver:", updateError.message);
            return json({error: `Failed to update waiver: ${updateError.message}`}, {status: 500});
        }

        console.log(`Waiver ${waiverId} updated successfully.`);

        // --- Send Notification if waiver became required ---
        const newRequired = required; // Use the value from formData
        if (!originalRequired && newRequired) {
            console.log(`Waiver ${waiverId} changed to required. Triggering notifications.`);
            await sendNewRequiredWaiverNotification(waiverId, title, supabaseAdmin);
        } else {
            console.log(`Waiver ${waiverId} 'required' status did not change from false to true (Original: ${originalRequired}, New: ${newRequired}). No notification needed.`);
        }
        // --- End Notification ---

        // Redirect back to the waivers list after successful update
        return redirect("/admin/waivers");

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Error in /admin/waivers/$waiverId action:", message);
        return json({error: message}, {status: 500});
    }
}


// Helper function to notify users about a newly required waiver
async function sendNewRequiredWaiverNotification(
    waiverId: string,
    waiverTitle: string,
    supabaseAdmin: SupabaseClient<Database>
) {
    console.log(`Starting notification process for newly required waiver: "${waiverTitle}" (ID: ${waiverId})`);
    let emailsSent = 0;
    let errorsEncountered = 0;

    try {
        // 1. Fetch all active users (profiles) linked to a family with an email
        const {data: profiles, error: profilesError} = await supabaseAdmin
            .from('profiles')
            .select(`
        id,
        families ( name, email )
      `)
            .not('family_id', 'is', null)
            .not('families', 'is', null)
            .not('families.email', 'is', null);

        if (profilesError) throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
        if (!profiles || profiles.length === 0) {
            console.log("No relevant users found to notify.");
            return;
        }
        console.log(`Found ${profiles.length} potential users to check for notification.`);

        // 2. Fetch users who have *already* signed this specific waiver
        const {data: signatures, error: signaturesError} = await supabaseAdmin
            .from('waiver_signatures')
            .select('user_id')
            .eq('waiver_id', waiverId);

        if (signaturesError) throw new Error(`Failed to fetch signatures for waiver ${waiverId}: ${signaturesError.message}`);

        const usersWhoSigned = new Set(signatures?.map(s => s.user_id) ?? []);
        console.log(`Found ${usersWhoSigned.size} users who have already signed waiver ${waiverId}.`);

        // 3. Filter users who need notification (haven't signed yet)
        const usersToNotify = profiles.filter(p => !usersWhoSigned.has(p.id) && p.families?.email);

        console.log(`Identified ${usersToNotify.length} users needing notification for waiver "${waiverTitle}".`);

        // 4. Send email to each user who needs to sign
        const siteUrl = process.env.VITE_SITE_URL || ''; // Get site URL for the link (Use VITE_ prefix)

        for (const profile of usersToNotify) {
            // Type guard for family email
            if (!profile.families?.email) continue;

            const familyName = profile.families.name || 'Family';
            const familyEmail = profile.families.email;

            try {
                const subject = `Action Required: New Karate Waiver "${waiverTitle}"`;
                const htmlBody = `
          <p>Hello ${familyName},</p>
          <p>A new waiver, "<strong>${waiverTitle}</strong>", now requires your signature for participation in karate class.</p>
          <p>Please log in to your family portal to review and sign the waiver at your earliest convenience.</p>
          ${siteUrl ? `<p><a href="${siteUrl}/waivers">Sign Waiver Now</a></p>` : '<p>Please visit the website to sign the waiver.</p>'}
          <p>Thank you,<br/>Sensei Negin's Karate Class</p>
        `;

                const emailSent = await sendEmail({
                    to: familyEmail,
                    subject: subject,
                    html: htmlBody,
                });

                if (emailSent) {
                    emailsSent++;
                } else {
                    errorsEncountered++;
                }
            } catch (emailError) {
                console.error(`Error sending new waiver notification email to ${familyEmail} (User ID: ${profile.id}):`, emailError instanceof Error ? emailError.message : emailError);
                errorsEncountered++;
            }
        } // End user loop

    } catch (error) {
        console.error(`General error during new waiver notification process for waiver ${waiverId}:`, error instanceof Error ? error.message : error);
        errorsEncountered++; // Increment general error count
    } finally {
        console.log(`Finished notification process for waiver "${waiverTitle}". Emails Sent: ${emailsSent}, Errors: ${errorsEncountered}`);
    }
}


// Component to display and edit the waiver
export default function EditWaiverPage() {
    const {waiver} = useLoaderData<typeof loader>();
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
