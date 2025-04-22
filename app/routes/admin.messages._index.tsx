import {useEffect, useState} from "react";
import {json, type LoaderFunctionArgs, type TypedResponse} from "@remix-run/node";
import {useLoaderData, useRevalidator} from "@remix-run/react";
import {createClient, SupabaseClient} from "@supabase/supabase-js";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Database, Tables} from "~/types/database.types";
import ConversationList from "~/components/ConversationList"; // Re-use existing component
import {AlertCircle} from "lucide-react";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";

// Type for the data fetched in the loader, adapted for ConversationList
type ConversationSummary = Pick<Tables<'conversations'>, 'id' | 'subject' | 'last_message_at'> & {
    participant_display_names: string | null; // Comma-separated names of family participants
};


interface LoaderData {
    conversations: ConversationSummary[];
    error?: string;
    ENV: { // Pass ENV vars for client-side Supabase
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
        // DO NOT PASS SERVICE ROLE KEY TO CLIENT
    };
    accessToken: string | null; // Add accessToken
    userId: string | null; // Add userId
}

export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response: {headers}, ENV} = getSupabaseServerClient(request);
    // Fetch session which includes the access token
    const {data: {session}, error: sessionError} = await supabaseServer.auth.getSession();

    // Handle potential error fetching session
    if (sessionError) {
        console.error("Error fetching session:", sessionError.message);
        // Return minimal data, indicating an error state
        return json({
            conversations: [],
            error: "Session fetch error",
            ENV,
            accessToken: null,
            userId: null
        }, {status: 500, headers});
    }

    const user = session?.user;
    const accessToken = session?.access_token ?? null; // Get access token or null
    const userId = user?.id ?? null; // Get user ID or null

    if (!user || !accessToken || !userId) { // Check for user, token, and ID
        console.error("User not authenticated:", user, accessToken, userId);
        // Return ENV and null token/userId even on error
        return json({
            conversations: [],
            error: "User not authenticated",
            ENV,
            accessToken: null,
            userId: null
        }, {status: 401, headers});
    }
    // const userId = user.id; // userId is already defined above

    // Check if user is admin or instructor
    const {data: profile, error: profileError} = await supabaseServer
        .from('profiles')
        .select('role, family_id') // Fetch family_id too
        .eq('id', user.id)
        .single();

    if (profileError || !profile || !['admin', 'instructor'].includes(profile.role)) {
        console.error("Admin/Instructor access error:", profileError?.message);
        // Return ENV, token, and userId even on error
        return json({
            conversations: [],
            error: "Access Denied: You do not have permission to view this page.",
            ENV,
            accessToken,
            userId
        }, {status: 403, headers});
    }

    // Call the RPC function to get conversation summaries
    // Note: The RPC function handles fetching conversations, participants, profiles,
    // families, and aggregating names in a single database operation.
    // We use supabaseServer here which has the user's context for RLS if the function
    // wasn't SECURITY DEFINER, but since it is, it runs with elevated privileges.
    // However, calling it via supabaseServer is standard practice.
    // console.log("[AdminMessagesIndex Loader] Calling RPC function 'get_admin_conversation_summaries'");
    const {data: conversations, error: rpcError} = await supabaseServer.rpc('get_admin_conversation_summaries');

    if (rpcError) {
        console.error("Error calling get_admin_conversation_summaries RPC:", rpcError);
        return json({
            conversations: [],
            error: "Failed to load conversations via RPC.",
            ENV,
            accessToken,
            userId
        }, {status: 500, headers});
    }

    // The RPC function returns data in the desired ConversationSummary format.
    // If no conversations are found, it will return an empty array.
    console.log(`[AdminMessagesIndex Loader] RPC returned ${conversations?.length ?? 0} conversations.`);

    // Ensure conversations is an array, even if null/undefined is returned (though unlikely for RPC)
    const safeConversations = conversations || [];

    return json({conversations: safeConversations, ENV, accessToken, userId}, {headers}); // Pass token and userId
}


export default function AdminMessagesIndex() {
    // console.log("[AdminMessagesIndex] Component function executing..."); // Keep this initial log
    const {conversations, error, ENV, accessToken} = useLoaderData<typeof loader>(); // Get ENV, accessToken, and userId back
    const revalidator = useRevalidator(); // Re-enable revalidator
    const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null); // Re-enable supabase state

    // Temporarily remove all useEffect hooks to isolate rendering issues
    // useEffect(() => { ... }); // Render log removed
    // useEffect(() => { ... }); // Conversation data log removed

    // Effect to create the client once ENV and accessToken are available
    useEffect(() => {
        // console.log("[AdminMessagesIndex] Client creation effect running.");
        // Use ANON_KEY for client-side initialization
        if (ENV?.SUPABASE_URL && ENV?.SUPABASE_ANON_KEY && accessToken && !supabase) {
            // console.log("[AdminMessagesIndex] Creating client-side Supabase client using ANON KEY and User Token...");
            // Use the ANON key for client-side initialization
            const client = createClient<Database>(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
                global: {
                    // Pass the user's access token for authenticated requests
                    headers: {Authorization: `Bearer ${accessToken}`},
                },
            });
            setSupabase(client);
            // console.log("[AdminMessagesIndex] Supabase client state set with user token.");
        } else if (supabase) {
            console.log("[AdminMessagesIndex] Supabase client already exists.");
        } else if (!accessToken) {
            console.warn("[AdminMessagesIndex] Access token not available, cannot create authenticated client-side client.");
        } else {
            console.warn("[AdminMessagesIndex] Supabase ENV variables not found, cannot create client-side client.");
        }
        // Re-run if ENV or accessToken changes (accessToken should be stable from loader unless session expires/renews) or supabase state changes
    }, [ENV, accessToken, supabase]); // Add supabase to dependency array

    // Effect for Supabase Realtime Subscription
    useEffect(() => {
        // console.log("[AdminMessagesIndex] Subscription effect running.");
        // Now this effect correctly waits until supabase client is created
        if (!supabase) {
            console.log("[AdminMessagesIndex] Supabase client not yet initialized for real-time. Skipping subscription setup.");
            return; // Exit if supabase client is not ready
        }

        console.log("[AdminMessagesIndex] Setting up Supabase real-time subscription...");
        const channelName = 'admin-messages-list-channel';
        console.log(`[AdminMessagesIndex] Attempting to create/get channel: ${channelName}`);

        // Get the channel instance. Client is already authenticated.
        const channel = supabase.channel(channelName);
        console.log(`[AdminMessagesIndex] Initial channel state before subscribe: ${channel.state}`); // Log state before subscribe

        channel
            // Listen for new messages specifically, as this updates last_message_at
            .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'messages'}, (payload) => {
                console.log('[AdminMessagesIndex] *** New message INSERT detected! ***:', payload); // Make log prominent
                console.log('[AdminMessagesIndex] Revalidating conversation list due to new message...');
                revalidator.revalidate();
            })
            // Optional: Listen for conversation updates if needed (e.g., subject change)
            // .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
            //     console.log('[AdminMessagesIndex] *** Conversation UPDATE detected! ***:', payload);
            //     console.log('[AdminMessagesIndex] Revalidating conversation list due to conversation update...');
            //     revalidator.revalidate();
            // })
            // .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, (payload) => { // Temporarily disable conversations listener
            //     console.log('[AdminMessagesIndex] Conversations table change detected:', payload);
            //     console.log('[AdminMessagesIndex] Revalidating data due to conversation change...');
            //     revalidator.revalidate();
            // })
            .subscribe((status, err) => {
                // Log ALL status changes, not just the initial ones
                console.log(`[AdminMessagesIndex] Channel ${channelName} subscription status update: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log(`[AdminMessagesIndex] Successfully subscribed to channel: ${channelName}`);
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { // Log errors and closure
                    console.error(`[AdminMessagesIndex] Channel ${channelName} issue: Status=${status}`, err || '');
                }
            });

        console.log(`[AdminMessagesIndex] Channel ${channelName} .subscribe() called. Current state: ${channel.state}`); // Log state after calling subscribe

        // Return cleanup function
        return () => {
            // Add channel state log before removal
            console.log(`[AdminMessagesIndex] Cleaning up Supabase real-time subscription for channel: ${channelName}. Current state before removal: ${channel.state}`);
            // Only remove the specific channel for this component
            supabase.removeChannel(channel)
                .then(status => console.log(`[AdminMessagesIndex] Removed channel ${channelName} status: ${status}`))
                .catch(error => console.error(`[AdminMessagesIndex] Error removing channel ${channelName}:`, error));
        };
    }, [supabase, revalidator]); // Re-run effect if supabase client or revalidator changes


    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4"/>
                    <AlertTitle>Error Loading Messages</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold">Admin Messages</h1>
                {/* Optional: Add button for admins to start new conversations later */}
                {/* <Button asChild variant="outline">
                    <Link to="/admin/messages/new">
                        <MessageSquarePlus className="mr-2 h-4 w-4" /> New Message
                    </Link>
                </Button> */}
            </div>

            {conversations.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No conversations found.</p>
            ) : (
                <ConversationList conversations={conversations} basePath="/admin/messages"/>
            )}
        </div>
    );
}
