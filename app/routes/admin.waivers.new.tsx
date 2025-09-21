import {type ActionFunctionArgs, json, redirect} from "@remix-run/node";
import {Form, Link, useActionData, useNavigation, useRouteError} from "@remix-run/react";
import {useEffect, useRef} from "react";
import {getSupabaseAdminClient} from '~/utils/supabase.server';
import {type SupabaseClient} from '@supabase/supabase-js';
import type {Database} from "~/types/database.types";
import {sendEmail} from '~/utils/email.server';
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Textarea} from "~/components/ui/textarea";
import {Checkbox} from "~/components/ui/checkbox";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {AppBreadcrumb, breadcrumbPatterns} from "~/components/AppBreadcrumb";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";

// Action to create a new waiver
export async function action({request}: ActionFunctionArgs) {
    console.log("Entering /admin/waivers/new action...");

    await csrf.validate(request);
    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const content = formData.get("content") as string;
    // Checkbox value is 'on' if checked, null otherwise
    const required = formData.get("required") === "on";

    // Basic validation
    if (!title || !description || !content) {
        return json({error: "Title, Description, and Content are required."}, {status: 400});
    }

    const supabaseAdmin = getSupabaseAdminClient();

    try {
        // Create the new waiver
        const newWaiverData = {
            title,
            description,
            content,
            required,
        };
        
        console.log("Attempting to create new waiver with data:", newWaiverData);
        const {data: newWaiver, error: createError} = await supabaseAdmin
            .from('waivers')
            .insert(newWaiverData)
            .select()
            .single();

        if (createError) {
            console.error("Error creating waiver:", createError.message);
            return json({error: `Failed to create waiver: ${createError.message}`}, {status: 500});
        }

        console.log(`Waiver created successfully with ID: ${newWaiver.id}`);

        // Send notification if waiver is required
        if (required) {
            console.log(`New waiver ${newWaiver.id} is required. Triggering notifications.`);
            await sendNewRequiredWaiverNotification(newWaiver.id, title, supabaseAdmin);
        }

        // Redirect back to the waivers list after successful creation
        return redirect("/admin/waivers");

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Error in /admin/waivers/new action:", message);
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

        // 2. Since this is a new waiver, no one has signed it yet, so notify all users
        const usersToNotify = profiles.filter(p => p.families?.email);

        console.log(`Identified ${usersToNotify.length} users needing notification for new waiver "${waiverTitle}".`);

        // 3. Send email to each user who needs to sign
        const siteUrl = process.env.VITE_SITE_URL || '';

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
        }

    } catch (error) {
        console.error(`General error during new waiver notification process for waiver ${waiverId}:`, error instanceof Error ? error.message : error);
        errorsEncountered++;
    } finally {
        console.log(`Finished notification process for waiver "${waiverTitle}". Emails Sent: ${emailsSent}, Errors: ${errorsEncountered}`);
    }
}

// Component to create a new waiver
export default function NewWaiverPage() {
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    const titleInputRef = useRef<HTMLInputElement>(null);

    // Focus the first input field when the page loads
    useEffect(() => {
        if (titleInputRef.current) {
            titleInputRef.current.focus();
        }
    }, []);

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.adminWaiverNew()} className="mb-6" />
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">Create New Waiver</h1>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
                <Form method="post">
                    <AuthenticityTokenInput />
                    {actionData?.error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{actionData.error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="title">Title<span className="text-destructive">*</span></Label>
                            <Input
                                id="title"
                                ref={titleInputRef}
                                name="title"
                                type="text"
                                placeholder="Enter waiver title"
                                required
                                className="mt-1"
                                tabIndex={1}
                                autoComplete="off"
                                aria-describedby="title-description"
                            />
                            <p id="title-description" className="text-sm text-gray-500 dark:text-gray-400">
                                A clear, descriptive title for the waiver
                            </p>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="description">Description<span className="text-destructive">*</span></Label>
                            <Input
                                id="description"
                                name="description"
                                type="text"
                                placeholder="Brief description of the waiver"
                                required
                                className="mt-1"
                                tabIndex={2}
                                autoComplete="off"
                                aria-describedby="description-description"
                            />
                            <p id="description-description" className="text-sm text-gray-500 dark:text-gray-400">
                                A brief summary of what this waiver covers
                            </p>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="content">Content<span className="text-destructive">*</span></Label>
                            <Textarea
                                id="content"
                                name="content"
                                placeholder="Enter the full waiver content here. You can use Markdown formatting."
                                required
                                rows={10}
                                className="mt-1 font-mono"
                                tabIndex={3}
                                aria-describedby="content-description"
                            />
                            <p id="content-description" className="text-sm text-gray-500 dark:text-gray-400">
                                The full legal text of the waiver. Markdown formatting is supported.
                            </p>
                        </div>

                        <div className="flex items-center space-x-3">
                            <Checkbox
                                id="required"
                                name="required"
                                tabIndex={4}
                                aria-describedby="required-description"
                            />
                            <div className="space-y-1">
                                <Label htmlFor="required" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Required for Registration
                                </Label>
                                <p id="required-description" className="text-sm text-gray-500 dark:text-gray-400">
                                    If checked, all families will be notified and must sign this waiver
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-2">
                        <Button 
                            type="button" 
                            variant="outline" 
                            asChild 
                            tabIndex={6}
                            aria-label="Cancel creating waiver and return to waivers list"
                        >
                            <Link to="/admin/waivers">Cancel</Link>
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSubmitting} 
                            tabIndex={7}
                            aria-label={isSubmitting ? "Creating waiver, please wait" : "Create new waiver"}
                        >
                            {isSubmitting ? "Creating..." : "Create Waiver"}
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
    console.error("Error caught in NewWaiverPage ErrorBoundary:", error);

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
            <h2 className="text-xl font-bold mb-2">Error Creating Waiver</h2>
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
