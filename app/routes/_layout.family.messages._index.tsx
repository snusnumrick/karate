import {useEffect, useRef, useState} from "react"; // Import useEffect, useRef, useState
import {json, type LoaderFunctionArgs, type TypedResponse} from "@remix-run/node";
import {Link, useLoaderData, useRevalidator} from "@remix-run/react"; // Import useRevalidator
import {createClient, SupabaseClient, RealtimeChannel} from "@supabase/supabase-js"; // Import createClient, SupabaseClient, RealtimeChannel
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Database} from "~/types/database.types"; // Import Database
import ConversationList from "~/components/ConversationList";
import {Button} from "~/components/ui/button"; // Import Button
import {AlertCircle, MessageCircle, Plus} from "lucide-react"; // Import an icon
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

// Remove global singleton declaration

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
    const supabaseRef = useRef<SupabaseClient<Database> | null>(null); // Use ref for local client instance
    const channelRef = useRef<RealtimeChannel | null>(null); // Ref for the channel
    const isCleaningUpRef = useRef(false); // Ref to prevent race conditions during cleanup
    const [clientInitialized, setClientInitialized] = useState(false); // State to track initialization

    // Effect for Supabase Client Initialization
    useEffect(() => {
        console.log("[FamilyMessagesIndex] Client initialization effect running.");
        // Initialize local client instance if needed
        if (!supabaseRef.current && ENV?.SUPABASE_URL && ENV?.SUPABASE_ANON_KEY) {
            console.log("[FamilyMessagesIndex] Initializing Supabase client...");
            supabaseRef.current = createClient<Database>(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: true, // Allow client to manage session persistence
                    autoRefreshToken: true, // Allow client to manage token refresh
                },
                realtime: { params: { eventsPerSecond: 10 } } // Keep existing realtime config
            });
            console.log("[FamilyMessagesIndex] Supabase client instance created.");
            setClientInitialized(true); // Signal that the client object exists
        } else if (supabaseRef.current) {
            console.log("[FamilyMessagesIndex] Supabase client already initialized.");
            if (!clientInitialized) setClientInitialized(true); // Ensure state is correct if ref exists but state was false
        } else {
            console.warn("[FamilyMessagesIndex] Supabase ENV variables not found, cannot create client.");
        }
    }, [clientInitialized, ENV]); // Only depends on ENV

    // Effect to set/update the session on the initialized client
    useEffect(() => {
        console.log("[FamilyMessagesIndex] Session update effect running.");
        if (supabaseRef.current && accessToken && refreshToken) {
            console.log("[FamilyMessagesIndex] Setting session on Supabase client...");
            supabaseRef.current.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            }).then(({error: sessionError}) => {
                if (sessionError) {
                    console.error("[FamilyMessagesIndex] Error setting session:", sessionError.message);
                } else {
                    console.log("[FamilyMessagesIndex] Session set successfully.");
                }
            });
        } else if (!accessToken || !refreshToken) {
            console.warn("[FamilyMessagesIndex] Access token or refresh token missing, cannot set session.");
        } else {
            console.log("[FamilyMessagesIndex] Supabase client ref not ready for session setting.");
        }
    }, [accessToken, refreshToken, clientInitialized]); // Depend on tokens and initialization state

    // Effect for Supabase Realtime Subscription
    useEffect(() => {
        // Ensure cleanup ref is reset when dependencies change
        isCleaningUpRef.current = false;
        console.log("[FamilyMessagesIndex] Subscription effect running.");

        if (!clientInitialized || !supabaseRef.current) {
            console.log("[FamilyMessagesIndex] Supabase client not ready for real-time. Skipping subscription setup.");
            return; // Exit if client is not initialized
        }

        // Prevent setup if already subscribed or during cleanup
        if (channelRef.current && channelRef.current.state === 'joined') {
             console.log("[FamilyMessagesIndex] Already subscribed to channel. Skipping setup.");
             return;
        }

        console.log("[FamilyMessagesIndex] Setting up Supabase real-time subscription...");
        const supabase = supabaseRef.current; // Get client from ref
        const channelName = 'family-messages-list-channel';
        console.log(`[FamilyMessagesIndex] Attempting to create/get channel: ${channelName}`);

        // Remove any existing channel before creating a new one
        if (channelRef.current) {
            console.warn(`[FamilyMessagesIndex] Removing potentially stale channel ${channelName} before creating new one.`);
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        const channel = supabase.channel(channelName);
        channelRef.current = channel; // Store the channel instance
        console.log(`[FamilyMessagesIndex] Initial channel state before subscribe: ${channel.state}`);

        channel
            .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'messages'}, (payload) => {
                console.log('[FamilyMessagesIndex] *** New message INSERT detected! ***:', payload);
                if (!isCleaningUpRef.current) { // Check cleanup flag
                    console.log('[FamilyMessagesIndex] Revalidating conversation list due to new message...');
                    revalidator.revalidate();
                } else {
                    console.log('[FamilyMessagesIndex] Cleanup in progress, skipping revalidation.');
                }
            })
            .subscribe((status, err) => {
                console.log(`[FamilyMessagesIndex] Channel ${channelName} subscription status update: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log(`[FamilyMessagesIndex] Successfully subscribed to channel: ${channelName}`);
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    console.error(`[FamilyMessagesIndex] Channel ${channelName} issue: Status=${status}`, err || '(No error object provided)');
                    // Optional: Attempt to resubscribe on certain errors? Be cautious of loops.
                }
            });

        console.log(`[FamilyMessagesIndex] Channel ${channelName} .subscribe() called. Current state: ${channel.state}`);

        // Return cleanup function
        return () => {
            isCleaningUpRef.current = true; // Set cleanup flag
            console.log(`[FamilyMessagesIndex] Cleaning up Supabase real-time subscription for channel: ${channelName}.`);
            const currentChannel = channelRef.current; // Capture ref value
            if (currentChannel && supabase) { // Ensure supabase client still exists
                console.log(`[FamilyMessagesIndex] Current state before removal: ${currentChannel.state}`);
                supabase.removeChannel(currentChannel)
                    .then(status => console.log(`[FamilyMessagesIndex] Removed channel ${channelName} status: ${status}`))
                    .catch(error => console.error(`[FamilyMessagesIndex] Error removing channel ${channelName}:`, error))
                    .finally(() => {
                        // Only nullify if it's the same channel we intended to remove
                        if (channelRef.current === currentChannel) {
                            channelRef.current = null;
                        }
                    });
            } else {
                 console.log(`[FamilyMessagesIndex] Cleanup: No channel found in ref for ${channelName} or supabase client missing.`);
            }
        };
        // Depend only on client initialization state and revalidator
    }, [clientInitialized, revalidator]);


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
        <div className="min-h-screen page-background-styles py-12 text-foreground">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <AppBreadcrumb items={breadcrumbPatterns.familyMessages()} className="mb-6" />

                {/* Page Header */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-extrabold page-header-styles sm:text-4xl">
                        Messages
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                        Communicate with your instructors and stay updated on your progress
                    </p>
                </div>

                <div className="form-container-styles p-8 backdrop-blur-lg">
                    {conversations.length === 0 ? (
                         <div className="text-center py-12">
                             <div className="max-w-md mx-auto">
                                 <div className="mb-6">
                                     <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                                 </div>
                                 <h3 className="text-lg font-medium text-foreground mb-2">No messages yet</h3>
                                 <p className="text-muted-foreground mb-6">
                                     Start a conversation with your instructors or check back later for updates.
                                 </p>
                                 <Button asChild>
                                     <Link to="/family/messages/new">
                                         <Plus className="h-4 w-4 mr-2" />
                                         New Message
                                     </Link>
                                 </Button>
                             </div>
                         </div>
                     ) : (
                         <div>
                             <div className="flex justify-between items-center mb-6">
                                 <h2 className="text-2xl font-bold form-header-styles">Your Conversations</h2>
                                 <Button asChild>
                                     <Link to="/family/messages/new">
                                         <Plus className="h-4 w-4 mr-2" />
                                         New Message
                                     </Link>
                                 </Button>
                             </div>
                             <ConversationList conversations={conversations} basePath="/family/messages" />
                         </div>
                     )}
                </div>
            </div>
        </div>
    );
}
