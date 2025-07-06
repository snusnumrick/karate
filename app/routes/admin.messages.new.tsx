import { useState, useRef, useEffect } from "react";
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type TypedResponse } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js'; // Import createClient
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { cn } from "~/lib/utils";
import { Database, Tables } from "~/types/database.types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react"; // Import ArrowLeft

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
    // Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in your .env
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin New Message Loader: Missing Supabase URL or Service Role Key env vars.");
        return json({ families: [], userId, error: "Server configuration error." }, { status: 500, headers });
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

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
    // and returns the new conversation_id (UUID).
    // You MUST create this SQL function in your Supabase project.
    console.log(`Admin New Message Action: Calling RPC create_admin_initiated_conversation for family ${familyId}`);
    const { data: newConversationId, error: rpcError } = await supabaseServer.rpc(
        'create_admin_initiated_conversation',
        {
            p_sender_id: senderId,
            p_target_family_id: familyId,
            p_subject: subject,
            p_message_body: message,
        }
    );

    if (rpcError || !newConversationId) {
        console.error("Admin New Message Action: RPC error", rpcError);
        return json({ error: `Failed to create conversation: ${rpcError?.message || 'Unknown RPC error'}` }, { status: 500, headers });
    }

    console.log(`Admin New Message Action: Conversation ${newConversationId} created successfully.`);
    // Redirect to the newly created conversation
    return redirect(`/admin/messages/${newConversationId}`, { headers });
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
        // Apply standard admin background colors and container padding
        <div className="container mx-auto px-4 py-8 max-w-2xl bg-amber-50 dark:bg-gray-800 rounded-lg shadow">
             <div className="flex items-center mb-6">
                 <Button variant="ghost" size="icon" asChild className="mr-2">
                    <Link to="/admin/messages" aria-label="Back to admin messages">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <h1 className="text-2xl font-semibold text-foreground">New Message</h1>
            </div>

            {actionData?.error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <Form method="post" className="space-y-6">
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
                            className={cn("w-full", "mt-1", familyIdError ? "border-red-500" : "")} // Use w-full for width, remove input-custom-styles
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
                        className={cn("input-custom-styles", "mt-1", subjectError ? "border-red-500" : "")} // Apply custom styles + conditional error
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
                        className={cn("input-custom-styles", "mt-1", messageError ? "border-red-500" : "")} // Apply custom styles + conditional error
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
                </div> {/* Close the flex justify-end div */}
            </Form> {/* Close the form */}
        </div> // Close the main container div
    );
}
