import {useEffect, useRef} from "react"; // Import useEffect and useState
import {json, type LoaderFunctionArgs, type TypedResponse} from "@remix-run/node";
import {Link, useLoaderData, useRevalidator} from "@remix-run/react"; // Import useRevalidator
import {createClient, SupabaseClient} from "@supabase/supabase-js"; // Import createClient and SupabaseClient
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Database} from "~/types/database.types"; // Import Database
import ConversationList from "~/components/ConversationList";
import {Button} from "~/components/ui/button"; // Import Button
import {PlusCircle} from "lucide-react"; // Import an icon

// Add TypeScript declaration for the global window.__SUPABASE_SINGLETON_CLIENT property
declare global {
    interface Window {
        __SUPABASE_SINGLETON_CLIENT?: SupabaseClient<Database>;
    }
}

// Define the shape of conversation data we expect from the RPC function
type ConversationSummary = {
    id: string;
    subject: string | null;
    last_message_at: string;
    participant_display_names: string | null;
    unread_count: number; // Added field
};

interface LoaderData {
    conversations: ConversationSummary[];
    userId: string | null;
    error?: string;
    ENV: { // Pass ENV vars for client-side Supabase
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
    };
    accessToken: string | null;
    refreshToken: string | null;
}

export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response: {headers}, ENV} = getSupabaseServerClient(request);
    // Fetch session which includes the access token
    const {data: {session}, error: sessionError} = await supabaseServer.auth.getSession();

    // Handle potential error fetching session
    if (sessionError) {
        console.error("[FamilyMessagesIndex Loader] Error fetching session:", sessionError.message);
        return json({
            conversations: [],
            error: "Session fetch error",
            userId: null,
            ENV,
            accessToken: null,
            refreshToken: null
        }, {status: 500, headers});
    }

    const user = session?.user;
    const accessToken = session?.access_token ?? null; // Get access token or null
    const refreshToken = session?.refresh_token ?? null; // Get access token or null
    const userId = user?.id ?? null; // Get user ID or null

    if (!user || !accessToken || !userId) { // Check for user, token, and ID
        console.error("[FamilyMessagesIndex Loader] User not authenticated:", user, accessToken, userId);
        return json({
            conversations: [],
            error: "User not authenticated",
            userId: null,
            ENV,
            accessToken: null,
            refreshToken: null
        }, {status: 401, headers});
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
            userId,
            ENV,
            accessToken,
            refreshToken
        }, {status: 500, headers});
    }

    // The RPC function returns data in the desired ConversationSummary format.
    // If no conversations are found, it will return an empty array.
    console.log(`[FamilyMessagesIndex Loader] RPC returned ${conversations?.length ?? 0} conversations for user ${userId}.`);

    // Ensure conversations is an array, even if null/undefined is returned
    const safeConversations = conversations || [];

    return json({conversations: safeConversations, userId, ENV, accessToken, refreshToken}, {headers});
}


export default function MessagesIndex() {
    const {conversations, error, ENV, accessToken, refreshToken} = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    // Remove useState for supabase client
    // const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null);
    const supabaseRef = useRef<SupabaseClient<Database> | null>(null); // Use ref for singleton client
    const channelRef = useRef<ReturnType<SupabaseClient<Database>['channel']> | null>(null); // Ref for the channel
    const isCleaningUpRef = useRef(false); // Ref to prevent race conditions during cleanup

    // Effect for Supabase Client Initialization and Realtime Subscription
    useEffect(() => {
        isCleaningUpRef.current = false; // Reset cleanup flag on effect run

        // Initialize singleton client if needed
        if (!window.__SUPABASE_SINGLETON_CLIENT) {
            if (ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY) {
                console.log("[FamilyMessagesIndex] Creating global Supabase singleton client with ANON KEY.");
                const client = createClient<Database>(
                    ENV.SUPABASE_URL,
                    ENV.SUPABASE_ANON_KEY,
                    {
                        auth: { persistSession: true, autoRefreshToken: false }, // Adjust as needed
                        realtime: { params: { eventsPerSecond: 10 } }
                    }
                );
                window.__SUPABASE_SINGLETON_CLIENT = client;
            } else {
                console.error("[FamilyMessagesIndex] Missing SUPABASE_URL or SUPABASE_ANON_KEY for client initialization.");
                return; // Cannot proceed without client
            }
        } else {
            console.log("[FamilyMessagesIndex] Using existing global Supabase singleton client.");
        }

        // Assign singleton to ref
        supabaseRef.current = window.__SUPABASE_SINGLETON_CLIENT;

        // Update Authorization header if accessToken is available
        if (accessToken && supabaseRef.current) {
            console.log("[FamilyMessagesIndex] Setting Authorization header with current token.");
            // Set headers directly on the client
            // Use auth.setSession instead of setAuth
            supabaseRef.current.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
            });
        } else if (!accessToken) {
            console.warn("[FamilyMessagesIndex] Access token not available for setting header.");
        }

        // --- Realtime Subscription Setup ---
        const supabase = supabaseRef.current; // Use the client from the ref
        if (!supabase) {
            console.log("[FamilyMessagesIndex] Supabase client not available for real-time setup.");
            return; // Exit if client is somehow still null
        }

        const channelName = 'family-messages-list-channel'; // Keep channel name consistent
        console.log(`[FamilyMessagesIndex] Attempting to set up channel: ${channelName}`);

        // Clean up previous channel instance if it exists in the ref
        if (channelRef.current) {
            console.log(`[FamilyMessagesIndex] Removing existing channel reference before creating new one: ${channelName}`);
            supabase.removeChannel(channelRef.current)
                .catch(err => console.error(`[FamilyMessagesIndex] Error removing previous channel ${channelName}:`, err));
            channelRef.current = null;
        }

        // supabase.auth.getSession().then(r => {console.log(r);});

        // Create new channel instance
        const channel = supabase.channel(channelName);
        channelRef.current = channel; // Store the new channel instance in the ref

        console.log(`[FamilyMessagesIndex] Created new channel instance: ${channelName}`);

        channel
            .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'messages'}, (payload) => {
                if (isCleaningUpRef.current) {
                    console.log('[FamilyMessagesIndex] Received message during cleanup, skipping revalidation.');
                    return;
                }
                console.log('[FamilyMessagesIndex] *** New message INSERT detected! ***:', payload);
                console.log('[FamilyMessagesIndex] Revalidating conversation list due to new message...');
                revalidator.revalidate();
            })
            .subscribe((status, err) => {
                if (isCleaningUpRef.current) {
                    console.log(`[FamilyMessagesIndex] Received status update '${status}' during cleanup, ignoring.`);
                    return;
                }
                console.log(`[FamilyMessagesIndex] Channel ${channelName} subscription status update: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log(`[FamilyMessagesIndex] Successfully subscribed to channel: ${channelName}`);
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    console.error(`[FamilyMessagesIndex] Channel ${channelName} issue: Status=${status}`, err || '');
                    // Attempt to remove the problematic channel ref on error/closure
                    if (channelRef.current === channel) { // Ensure we're removing the correct channel instance
                        supabase.removeChannel(channel)
                            .catch(removeErr => console.error(`[FamilyMessagesIndex] Error removing channel ${channelName} after error/closure:`, removeErr));
                        channelRef.current = null;
                    }
                }
            });

        // Return cleanup function
        return () => {
            isCleaningUpRef.current = true; // Set cleanup flag
            console.log(`[FamilyMessagesIndex] Cleaning up Supabase real-time subscription for channel: ${channelName}.`);
            const currentChannel = channelRef.current; // Capture channel from ref
            if (currentChannel && supabase) {
                supabase.removeChannel(currentChannel)
                    .then(status => console.log(`[FamilyMessagesIndex] Removed channel ${channelName} status: ${status}`))
                    .catch(error => console.error(`[FamilyMessagesIndex] Error removing channel ${channelName}:`, error));
                channelRef.current = null; // Clear the ref
            } else {
                console.log(`[FamilyMessagesIndex] Cleanup: No channel found in ref for ${channelName} or supabase client missing.`);
            }
        };
        // Dependencies: Re-run if ENV vars or accessToken change.
    }, [ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, accessToken, refreshToken, revalidator]);


    if (error) {
        return <div className="text-red-500 p-4">Error: {error}</div>; // Display error if loader failed
    }

    return (
        <div className="container mx-auto px-4 py-8 bg-amber-50 dark:bg-gray-800"> {/* Add background */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-foreground">Messages</h1> {/* Add text color */}
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
