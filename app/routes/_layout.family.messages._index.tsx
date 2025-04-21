import { json, type LoaderFunctionArgs, type TypedResponse } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Database } from "~/types/database.types";
import ConversationList from "~/components/ConversationList";
import { Button } from "~/components/ui/button"; // Import Button
import { PlusCircle } from "lucide-react"; // Import an icon

// Define the shape of conversation data we expect
// Adjust based on actual query needs (e.g., include participant names)
type ConversationSummary = Pick<Database['public']['Tables']['conversations']['Row'], 'id' | 'subject' | 'last_message_at'> & {
    // Example: Add participant info if needed later
    // participants: { user_id: string, profiles: { email: string } | null }[];
    // last_message_preview: string | null; // Add if fetching last message snippet
};

interface LoaderData {
    conversations: ConversationSummary[];
    error?: string;
}

export async function loader({ request }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const { supabaseServer, response: { headers } } = getSupabaseServerClient(request);
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
        // Should be protected by parent layout, but good practice
        return json({ conversations: [], error: "User not authenticated" }, { status: 401, headers });
    }

    // Fetch conversations where the current user is a participant
    // Order by the most recent message
    const { data: conversationsData, error: conversationsError } = await supabaseServer
        .from('conversations')
        .select(`
            id,
            subject,
            last_message_at
        `)
        // Filter conversations where the user is a participant
        .in('id', (
            await supabaseServer
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', user.id)
        ).data?.map(p => p.conversation_id) ?? []) // Handle potential null data
        .order('last_message_at', { ascending: false });

    if (conversationsError) {
        console.error("Error fetching conversations:", conversationsError.message);
        return json({ conversations: [], error: "Failed to load conversations." }, { status: 500, headers });
    }

    // TODO: Fetch participant names/details if needed for display

    return json({ conversations: conversationsData ?? [] }, { headers });
}


export default function MessagesIndex() {
    const { conversations, error } = useLoaderData<typeof loader>();

    if (error) {
        return <div className="text-red-500 p-4">Error: {error}</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold">Messages</h1>
                {/* Add "New Message" button */}
                <Button asChild>
                    <Link to="/family/messages/new">
                        <PlusCircle className="mr-2 h-4 w-4" /> New Message
                    </Link>
                </Button>
            </div>

            {conversations.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">You have no messages yet.</p>
            ) : (
                <ConversationList conversations={conversations} basePath="/family/messages" />
            )}
        </div>
    );
}
