import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type TypedResponse } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

// Define types for loader and action data

// LoaderData is now empty as we don't need to load recipients for the form
interface LoaderData {
    error?: string; // Keep error handling
}

interface ActionData {
    success?: boolean;
    error?: string;
    fieldErrors?: {
        recipient?: string;
        subject?: string;
        content?: string;
    };
}

// Loader: No longer needs to fetch recipients
export async function loader({ request }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    // We still need to initialize Supabase to potentially check auth if needed,
    // and to return headers correctly.
    const { response: { headers } } = getSupabaseServerClient(request);

    // Basic check if user is authenticated (though parent layout should handle this)
    // const { supabaseServer } = getSupabaseServerClient(request);
    // const { data: { user } } = await supabaseServer.auth.getUser();
    // if (!user) {
    //     return json({ error: "User not authenticated" }, { status: 401, headers });
    // }

    // Return empty object or just error status if applicable
    return json({}, { headers });
}

// Action: Create a new conversation and the first message
export async function action({ request }: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const { supabaseServer, response: { headers } } = getSupabaseServerClient(request);
    const { data: { user } } = await supabaseServer.auth.getUser();
    const formData = await request.formData();

    // const recipientId = formData.get("recipient") as string; // No longer needed
    const subject = formData.get("subject") as string | null; // Subject is optional
    const content = formData.get("content") as string;

    if (!user) {
        return json({ error: "User not authenticated" }, { status: 401, headers });
    }

    // --- Validation ---
    const fieldErrors: ActionData['fieldErrors'] = {};
    // if (!recipientId) { // No longer needed
    //     fieldErrors.recipient = "Recipient is required.";
    // }
    if (!content || content.trim().length === 0) {
        fieldErrors.content = "Message content cannot be empty.";
    }
    // Optional: Add subject length validation if desired

    if (Object.keys(fieldErrors).length > 0) {
        return json({ fieldErrors }, { status: 400, headers });
    }

    // --- Database Operations using RPC ---
    try {
        // Call the modified RPC function (without recipient_id)
        const { data: newConversationId, error: rpcError } = await supabaseServer
            .rpc('create_new_conversation', {
                p_sender_id: user.id,
                // p_recipient_id: recipientId, // Removed
                p_subject: subject?.trim() || '',
                p_content: content.trim(),
            })
            .single(); // Expecting a single UUID back

        if (rpcError || !newConversationId) {
            console.error("Error calling create_new_conversation RPC:", rpcError?.message);
            // Provide a generic error message as duplicates are less likely with the new approach
            // unless the user rapidly submits the same message twice.
            const detailedError = "Failed to execute conversation creation.";
            throw new Error(detailedError);
        }

        // Redirect to the new conversation
        return redirect(`/family/messages/${newConversationId}`, { headers });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error("Conversation creation RPC failed:", message);
        // Pass the specific error message back to the UI
        return json({ error: `Failed to create conversation: ${message}` }, { status: 500, headers });
    }
}


export default function NewMessageRoute() {
    // const { recipients, error: loaderError } = useLoaderData<typeof loader>(); // No longer loading recipients
    const { error: loaderError } = useLoaderData<typeof loader>(); // Only check for loader error
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === 'submitting';

    if (loaderError) {
        return (
            <div className="container mx-auto px-4 py-8">
                 <Button variant="ghost" size="icon" asChild className="mr-2 mb-4">
                    <Link to="/family/messages" aria-label="Back to messages">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Recipients</AlertTitle>
                    <AlertDescription>{loaderError}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
             <div className="flex items-center mb-6">
                 <Button variant="ghost" size="icon" asChild className="mr-2">
                    <Link to="/family/messages" aria-label="Back to messages">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <h1 className="text-2xl font-semibold">New Message</h1>
            </div>

            {actionData?.error && (
                 <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <Form method="post" className="space-y-6">
                {/* Recipient Selection Removed */}

                {/* Subject Input */}
                <div>
                    <Label htmlFor="subject">Subject (Optional):</Label>
                    <Input
                        type="text"
                        id="subject"
                        name="subject"
                        className="mt-1"
                        disabled={isSubmitting}
                    />
                     {actionData?.fieldErrors?.subject && (
                        <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.subject}</p>
                    )}
                </div>

                {/* Message Content */}
                <div>
                    <Label htmlFor="content">Message:</Label>
                    <Textarea
                        id="content"
                        name="content"
                        required
                        rows={6}
                        className="mt-1"
                        disabled={isSubmitting}
                    />
                     {actionData?.fieldErrors?.content && (
                        <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.content}</p>
                    )}
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                            </>
                        ) : (
                            "Send Message"
                        )}
                    </Button>
                </div>
            </Form>
        </div>
    );
}
