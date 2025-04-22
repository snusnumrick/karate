import {json, type LoaderFunctionArgs, type TypedResponse} from "@remix-run/node";
import {Link, useLoaderData} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Tables} from "~/types/database.types";
import ConversationList from "~/components/ConversationList";
import {Button} from "~/components/ui/button"; // Import Button
import {PlusCircle} from "lucide-react"; // Import an icon

// Define the shape of conversation data we expect
type ConversationSummary = Pick<Tables<'conversations'>, 'id' | 'subject' | 'last_message_at'> & {
    participant_display_names: string | null; // Comma-separated names of other participants
};

interface LoaderData {
    conversations: ConversationSummary[];
    userId: string | null; // Add userId to filter self out
    error?: string;
}

export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();
    const userId = user?.id ?? null;

    if (!user || !userId) {
        // Should be protected by parent layout, but good practice
        return json({conversations: [], error: "User not authenticated", userId: null}, {status: 401, headers});
    }

    // Call the RPC function to get conversation summaries for the current user
    // This function handles fetching conversations the user is part of,
    // finding other participants, getting their profiles, and aggregating names.
    // It runs with the user's permissions (SECURITY INVOKER).
    // console.log(`[FamilyMessagesIndex Loader] Calling RPC function 'get_family_conversation_summaries' for user ${userId}`);
    const {data: conversations, error: rpcError} = await supabaseServer.rpc(
        'get_family_conversation_summaries',
        {p_user_id: userId} // Pass the current user's ID as the parameter
    );

    if (rpcError) {
        console.error(`Error calling get_family_conversation_summaries RPC for user ${userId}:`, rpcError);
        return json({
            conversations: [],
            error: "Failed to load conversations via RPC.",
            userId
        }, {status: 500, headers});
    }

    // The RPC function returns data in the desired ConversationSummary format.
    // If no conversations are found, it will return an empty array.
    console.log(`[FamilyMessagesIndex Loader] RPC returned ${conversations?.length ?? 0} conversations for user ${userId}.`);

    // Ensure conversations is an array, even if null/undefined is returned
    const safeConversations = conversations || [];

    return json({conversations: safeConversations, userId}, {headers});
}


export default function MessagesIndex() {
    const {conversations, error} = useLoaderData<typeof loader>();

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
                        <PlusCircle className="mr-2 h-4 w-4"/> New Message
                    </Link>
                </Button>
            </div>

            {conversations.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">You have no messages yet.</p>
            ) : (
                <ConversationList conversations={conversations} basePath="/family/messages"/>
            )}
        </div>
    );
}
