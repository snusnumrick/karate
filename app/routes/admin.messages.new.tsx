import { useState, useRef, useEffect } from "react";
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type TypedResponse } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseAdminClient } from "~/utils/supabase.server";
import { cn } from "~/lib/utils";
import { Tables } from "~/types/database.types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";

// Define the schema for form validation using Zod
const messageSchema = z.object({
    familyId: z.string().uuid("Please select a valid family."),
    subject: z.string().min(1, "Subject cannot be empty.").max(255, "Subject is too long."),
    message: z.string().min(1, "Message body cannot be empty."),
});

type FamilyOption = Pick<Tables<'families'>, 'id' | 'name'>;

interface LoaderData {
    families: FamilyOption[];
    userId: string; // Admin's user ID
    error?: string;
}

interface ActionData {
    errors?: z.ZodIssue[];
    error?: string; // General server error
    fieldErrors?: {
        familyId?: string[];
        subject?: string[];
        message?: string[];
    };
}

export async function loader({ request }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const { supabaseServer, response: { headers } } = getSupabaseServerClient(request);
    const { data: { session }, error: sessionError } = await supabaseServer.auth.getSession();

    if (sessionError || !session?.user) {
        console.error("Admin New Message Loader: Session error or no user", sessionError);
        return redirect("/login", { headers });
    }

    const userId = session.user.id;

    // Verify user is admin or instructor
    const { data: profile, error: profileError } = await supabaseServer
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    if (profileError || !profile || !['admin', 'instructor'].includes(profile.role)) {
        console.error("Admin New Message Loader: Access denied", profileError);
        // Can't return JSON with error easily here as it breaks the form page structure
        // Redirecting might be better, or throw a Response
        throw new Response("Access Denied", { status: 403, headers });
    }

    // --- Fetch families using an explicit Admin client to bypass RLS ---
    const supabaseAdmin = getSupabaseAdminClient();

    const { data: families, error: familiesError } = await supabaseAdmin
        .from('families')
        .select('id, name')
        .order('name', { ascending: true });
    // --- End fetching families ---

    if (familiesError) {
        console.error("Admin New Message Loader: Error fetching families with admin client", familiesError);
        return json({ families: [], userId, error: "Failed to load families." }, { status: 500, headers });
    }

    return json({ families: families ?? [], userId }, { headers });
}

export async function action({ request }: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const { supabaseServer, response: { headers } } = getSupabaseServerClient(request);

    // Create admin client for push notification queries that need to bypass RLS
    const supabaseAdmin = getSupabaseAdminClient();

    const { data: { session }, error: sessionError } = await supabaseServer.auth.getSession();

    if (sessionError || !session?.user) {
        console.error("Admin New Message Action: Session error or no user", sessionError);
        return json({ error: "Authentication required." }, { status: 401, headers });
    }

    const senderId = session.user.id;

    // Verify user is admin or instructor (again, for security)
    const { data: profile, error: profileError } = await supabaseServer
        .from('profiles')
        .select('role')
        .eq('id', senderId)
        .single();

    if (profileError || !profile || !['admin', 'instructor'].includes(profile.role)) {
        console.error("Admin New Message Action: Access denied", profileError);
        return json({ error: "Access Denied." }, { status: 403, headers });
    }

    await csrf.validate(request);
    const formData = await request.formData();
    const rawData = Object.fromEntries(formData);

    const validationResult = messageSchema.safeParse(rawData);

    if (!validationResult.success) {
        console.log("Admin New Message Action: Validation failed", validationResult.error.flatten());
        return json({
            errors: validationResult.error.issues,
            fieldErrors: validationResult.error.flatten().fieldErrors,
        }, { status: 400, headers });
    }

    const { familyId, subject, message } = validationResult.data;

    // --- Call the RPC function ---
    // IMPORTANT: Assumes a function `create_admin_initiated_conversation` exists
    // that takes (sender_id, target_family_id, subject, message_body)
    // and returns a conversation_id.
    // You MUST create this SQL function in your Supabase project.
    console.log(`Admin New Message Action: Calling RPC create_admin_initiated_conversation for family ${familyId}`);
    const { data: newConversationId, error: rpcError } = await supabaseServer.rpc(
        'create_admin_initiated_conversation',
        {
            p_sender_id: senderId,
            p_target_family_id: familyId,
            p_subject: subject,
            p_message_body: message
        }
    );

    if (rpcError || !newConversationId) {
        console.error("Admin New Message Action: RPC error", rpcError);
        return json({ error: `Failed to create conversation: ${rpcError?.message || 'Unknown RPC error'}` }, { status: 500, headers });
    }

    // Type assertion for the RPC response
    const conversationData = newConversationId as { conversation_id: string; message_id: string };
    
    // Additional safety check for conversation_id
    if (!conversationData?.conversation_id || conversationData.conversation_id === 'undefined') {
        console.error("Admin New Message Action: Invalid conversation_id returned from RPC:", conversationData);
        return json({ error: "Failed to create conversation: Invalid conversation ID" }, { status: 500, headers });
    }
    
    console.log(`Admin New Message Action: Conversation ${conversationData.conversation_id} created successfully.`);

    // Send push notifications to family members
    try {
        // Get sender profile info for notification (including role)
        const { data: senderProfile, error: senderProfileError } = await supabaseServer
            .from('profiles')
            .select('first_name, last_name, role')
            .eq('id', senderId)
            .single();

        if (senderProfileError) {
            console.error('Error fetching sender profile for push notification:', senderProfileError);
        }

        console.log('Sender profile data:', senderProfile);

        // Create a more descriptive sender name based on role
        let senderName = senderProfile?.role === 'admin' ? 'Admin' : 'Instructor'; // Role-based fallback

        if (senderProfile) {
            const firstName = senderProfile.first_name?.trim();
            const lastName = senderProfile.last_name?.trim();

            if (firstName && lastName) {
                senderName = `${firstName} ${lastName}`;
            } else if (firstName) {
                senderName = firstName;
            } else if (lastName) {
                senderName = lastName;
            }
            // If both names are null/empty, use role-based fallback
        }

        console.log('Computed sender name:', senderName);

        // Get all family members for the target family using admin client
        console.log(`Getting family members for family ID: ${familyId}`);
        const { data: familyMembers, error: familyMembersError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('family_id', familyId);

        if (familyMembersError) {
            console.error('Error fetching family members:', familyMembersError);
        }

        console.log(`Found ${familyMembers?.length || 0} family members:`, familyMembers);

        if (familyMembers && familyMembers.length > 0) {
            // Import push notification utilities
            const { 
                sendPushNotificationToMultiple, 
                createMessageNotificationPayload 
            } = await import('~/utils/push-notifications.server');

            // Get push subscriptions for all family members using admin client
            const familyMemberIds = familyMembers.map(member => member.id);
            console.log(`Looking for push subscriptions for family member IDs:`, familyMemberIds);

            const { data: pushSubscriptions, error: pushSubscriptionsError } = await supabaseAdmin
                .from('push_subscriptions')
                .select('endpoint, p256dh, auth, user_id')
                .in('user_id', familyMemberIds);

            if (pushSubscriptionsError) {
                console.error('Error fetching push subscriptions:', pushSubscriptionsError);
            }

            console.log(`Found ${pushSubscriptions?.length || 0} push subscriptions:`, pushSubscriptions);

            if (pushSubscriptions && pushSubscriptions.length > 0) {
                // Use the message_id directly from the RPC response
                console.log(`Creating notification payload with message_id: ${conversationData.message_id}`);
                const payload = createMessageNotificationPayload(
                    senderName,
                    message,
                    conversationData.conversation_id,
                    conversationData.message_id,
                    `/family/messages/${conversationData.conversation_id}` // Use correct family URL for family recipients
                );

                console.log(`Notification payload:`, payload);

                const subscriptions = pushSubscriptions.map(sub => ({
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                }));

                console.log(`Sending push notifications to ${subscriptions.length} subscriptions`);
                const result = await sendPushNotificationToMultiple(subscriptions, payload);
                console.log(`Push notifications sent to ${result.successCount} family devices for new conversation`);

                if (result.expiredCount > 0) {
                    console.log(`Cleaned up ${result.expiredCount} expired push subscriptions`);
                }
            } else {
                console.log('No push subscriptions found for family members');
            }
        } else {
            console.log('No family members found for the target family');
        }
    } catch (error) {
        console.error('Error sending push notifications for new conversation:', error);
        // Don't fail the conversation creation if push notifications fail
    }

    // Redirect to the newly created conversation
    return redirect(`/admin/messages/${conversationData.conversation_id}`, { headers });
}


export default function AdminNewMessage() {
    const { families, error: loaderError } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    const familySelectRef = useRef<HTMLButtonElement>(null); // Ref for SelectTrigger

    // State for controlled Select component
    const [selectedFamilyId, setSelectedFamilyId] = useState<string | undefined>(undefined);

    // Focus family select on mount
    useEffect(() => {
        familySelectRef.current?.focus();
    }, []);

    // Find specific field errors
    const familyIdError = actionData?.fieldErrors?.familyId?.[0];
    const subjectError = actionData?.fieldErrors?.subject?.[0];
    const messageError = actionData?.fieldErrors?.message?.[0];

    if (loaderError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Page</AlertTitle>
                <AlertDescription>{loaderError}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="mb-8">
                <AppBreadcrumb items={breadcrumbPatterns.adminMessageNew()} />
                <div className="mt-4">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">New Message</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Send a message to a family</p>
                </div>
            </div>

            {/* Form Container */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-2xl">
                {actionData?.error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{actionData.error}</AlertDescription>
                    </Alert>
                )}

                <Form method="post" className="space-y-6">
                <AuthenticityTokenInput />
                <div>
                    <Label htmlFor="familyId">To Family</Label>
                    <Select
                        name="familyId"
                        value={selectedFamilyId}
                        onValueChange={setSelectedFamilyId}
                        required
                        disabled={isSubmitting}
                    >
                        <SelectTrigger
                            ref={familySelectRef} // Attach ref
                            id="familyId"
                            className={cn("w-full", "mt-1 input-custom-styles", familyIdError ? "border-red-500" : "")}
                            tabIndex={1}
                        >
                            <SelectValue placeholder="Select a family..." />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={5}> {/* Explicitly set position */}
                            {families.length === 0 && <p className="p-4 text-sm text-muted-foreground">No families found.</p>}
                            {families.map((family) => (
                                <SelectItem key={family.id} value={family.id}>
                                    {family.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {familyIdError && <p className="text-sm text-red-600 mt-1">{familyIdError}</p>}
                </div>

                <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                        id="subject"
                        name="subject"
                        type="text"
                        required
                        maxLength={255}
                        disabled={isSubmitting}
                        className={cn("mt-1 input-custom-styles", subjectError ? "border-red-500" : "")}
                        tabIndex={2}
                    />
                    {subjectError && <p className="text-sm text-red-600 mt-1">{subjectError}</p>}
                </div>

                <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                        id="message"
                        name="message"
                        required
                        rows={6}
                        disabled={isSubmitting}
                        className={cn("mt-1 input-custom-styles", messageError ? "border-red-500" : "")}
                        tabIndex={3}
                    />
                    {messageError && <p className="text-sm text-red-600 mt-1">{messageError}</p>}
                </div>

                    {/* Submit Button - aligned right */}
                    <div className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting} tabIndex={4}>
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
        </div>
    );
}
