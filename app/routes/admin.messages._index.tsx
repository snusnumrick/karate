import {useEffect, useRef, useState} from "react"; // Import useRef
import {json, type LoaderFunctionArgs, type TypedResponse} from "@remix-run/node";
import {useLoaderData, useRevalidator, Link} from "@remix-run/react";
import {createClient, SupabaseClient, RealtimeChannel} from "@supabase/supabase-js"; // Import RealtimeChannel
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Database} from "~/types/database.types";
import {AlertCircle, MessageSquarePlus} from "lucide-react";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import AdminConversationList, {AdminConversationSummary} from "~/components/AdminConversationList";
import { Button } from "~/components/ui/button"; // Import Button

interface LoaderData {
    conversations: AdminConversationSummary[];
    error?: string;
    ENV: { // Pass ENV vars for client-side Supabase
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
        // DO NOT PASS SERVICE ROLE KEY TO CLIENT
    };
    accessToken: string | null;
    refreshToken: string | null;
    userId: string | null;
}

export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response: {headers}, ENV} = getSupabaseServerClient(request);
    // Fetch session which includes the access token
    const {data: {session}, error: sessionError} = await supabaseServer.auth.getSession();
    // console.log("[AdminMessagesIndex Loader] Session data:", session);

    // Handle potential error fetching session
    if (sessionError) {
        console.error("Error fetching session:", sessionError.message);
        // Return minimal data, indicating an error state
        return json({
            conversations: [],
            error: "Session fetch error",
            ENV,
            accessToken: null,
            refreshToken: null,
            userId: null
        }, {status: 500, headers});
    }

    const user = session?.user;
    const accessToken = session?.access_token ?? null; // Get access token or null
    const refreshToken = session?.refresh_token ?? null;
    const userId = user?.id ?? null; // Get user ID or null

    if (!user || !accessToken || !userId) { // Check for user, token, and ID
        console.error("User not authenticated:", user, accessToken, userId);
        // Return ENV and null token/userId even on error
        return json({
            conversations: [],
            error: "User not authenticated",
            ENV,
            accessToken: null,
            refreshToken: null,
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
            refreshToken,
            userId
        }, {status: 403, headers});
    }

    // Call the RPC function to get conversation summaries
    // Note: The RPC function handles fetching conversations, participants, profiles,
    // families, and aggregating names in a single database operation.
    // We use supabaseServer here which has the user's context for RLS if the function
    // wasn't SECURITY DEFINER, but since it is, it runs with elevated privileges.
    // However, calling it via supabaseServer is standard practice.
    console.log("[AdminMessagesIndex Loader] Calling RPC function 'get_admin_conversation_summaries'");
    const {data: conversations, error: rpcError} = await supabaseServer.rpc('get_admin_conversation_summaries');

    if (rpcError) {
        console.error("Error calling get_admin_conversation_summaries RPC:", rpcError);
        return json({
            conversations: [],
            error: "Failed to load conversations via RPC.",
            ENV,
            accessToken,
            refreshToken,
            userId
        }, {status: 500, headers});
    }

    // The RPC function returns data in the desired ConversationSummary format.
    // If no conversations are found, it will return an empty array.
    console.log(`[AdminMessagesIndex Loader] RPC returned ${conversations?.length ?? 0} conversations.`);

    // Ensure conversations is an array, even if null/undefined is returned (though unlikely for RPC)
    const safeConversations = conversations || [];

    return json({conversations: safeConversations, ENV, accessToken, refreshToken, userId}, {headers});
}


export default function AdminMessagesIndex() {
    const {conversations, error, ENV, accessToken, refreshToken} = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const supabaseRef = useRef<SupabaseClient<Database> | null>(null); // Use ref for singleton client
    const channelRef = useRef<RealtimeChannel | null>(null); // Ref for the channel
    const isCleaningUpRef = useRef(false); // Ref to prevent race conditions during cleanup
    const [clientInitialized, setClientInitialized] = useState(false); // State to track initialization

    // Effect for Supabase Client Initialization
    useEffect(() => {
        console.log("[AdminMessagesIndex] Client initialization effect running.");
        if (!supabaseRef.current && ENV?.SUPABASE_URL && ENV?.SUPABASE_ANON_KEY) {
            console.log("[AdminMessagesIndex] Initializing Supabase client...");
            supabaseRef.current = createClient<Database>(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
                // Use ANON key for initial client creation
                auth: {
                    persistSession: true, // Allow client to manage session persistence
                    autoRefreshToken: true, // Allow client to manage token refresh
                    // detectSessionInUrl: false, // Optional: Might be useful if session restoration from URL is causing issues
                }
            });
            console.log("[AdminMessagesIndex] Supabase client instance created.");
            setClientInitialized(true); // Signal that the client object exists
        } else if (supabaseRef.current) {
            console.log("[AdminMessagesIndex] Supabase client already initialized.");
            if (!clientInitialized) setClientInitialized(true); // Ensure state is correct if ref exists but state was false
        } else {
            console.warn("[AdminMessagesIndex] Supabase ENV variables not found, cannot create client.");
        }
    }, [clientInitialized, ENV]); // Only depends on ENV

    // Effect to set/update the session on the initialized client
    useEffect(() => {
        console.log("[AdminMessagesIndex] Session update effect running.");
        if (supabaseRef.current && accessToken && refreshToken) {
            console.log("[AdminMessagesIndex] Setting session on Supabase client...");
            supabaseRef.current.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            }).then(({error: sessionError}) => {
                if (sessionError) {
                    console.error("[AdminMessagesIndex] Error setting session:", sessionError.message);
                } else {
                    console.log("[AdminMessagesIndex] Session set successfully.");
                }
            });
        } else if (!accessToken || !refreshToken) {
            console.warn("[AdminMessagesIndex] Access token or refresh token missing, cannot set session.");
        } else {
            console.log("[AdminMessagesIndex] Supabase client ref not ready for session setting.");
        }
    }, [accessToken, refreshToken, clientInitialized]); // Depend on tokens and initialization state

    // Effect for Supabase Realtime Subscription
    useEffect(() => {
        // Ensure cleanup ref is reset when dependencies change
        isCleaningUpRef.current = false;
        console.log("[AdminMessagesIndex] Subscription effect running.");

        if (!clientInitialized || !supabaseRef.current) {
            console.log("[AdminMessagesIndex] Supabase client not ready for real-time. Skipping subscription setup.");
            return; // Exit if client is not initialized
        }

        // Prevent setup if already subscribed or during cleanup
        if (channelRef.current && channelRef.current.state === 'joined') {
             console.log("[AdminMessagesIndex] Already subscribed to channel. Skipping setup.");
             return;
        }

        console.log("[AdminMessagesIndex] Setting up Supabase real-time subscription...");
        const supabase = supabaseRef.current; // Get client from ref
        const channelName = 'admin-messages-list-channel';
        console.log(`[AdminMessagesIndex] Attempting to create/get channel: ${channelName}`);

        // Remove any existing channel before creating a new one (belt-and-suspenders)
        if (channelRef.current) {
            console.warn(`[AdminMessagesIndex] Removing potentially stale channel ${channelName} before creating new one.`);
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        const channel = supabase.channel(channelName);
        channelRef.current = channel; // Store the channel instance
        console.log(`[AdminMessagesIndex] Initial channel state before subscribe: ${channel.state}`);

        channel
            .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'messages'}, (payload) => {
                console.log('[AdminMessagesIndex] *** New message INSERT detected! ***:', payload);
                if (!isCleaningUpRef.current) { // Check cleanup flag
                    console.log('[AdminMessagesIndex] Revalidating conversation list due to new message...');
                    revalidator.revalidate();
                } else {
                    console.log('[AdminMessagesIndex] Cleanup in progress, skipping revalidation.');
                }
            })
            .subscribe((status, err) => {
                console.log(`[AdminMessagesIndex] Channel ${channelName} subscription status update: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log(`[AdminMessagesIndex] Successfully subscribed to channel: ${channelName}`);
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    // Log the actual error object for more details on CHANNEL_ERROR
                    console.error(`[AdminMessagesIndex] Channel ${channelName} issue: Status=${status}`, err || '(No error object provided)');
                    // Optional: Attempt to resubscribe on certain errors? Be cautious of loops.
                }
            });

        console.log(`[AdminMessagesIndex] Channel ${channelName} .subscribe() called. Current state: ${channel.state}`);

        // Return cleanup function
        return () => {
            isCleaningUpRef.current = true; // Set cleanup flag
            console.log(`[AdminMessagesIndex] Cleaning up Supabase real-time subscription for channel: ${channelName}.`);
            const currentChannel = channelRef.current; // Capture ref value
            if (currentChannel) {
                console.log(`[AdminMessagesIndex] Current state before removal: ${currentChannel.state}`);
                supabase.removeChannel(currentChannel)
                    .then(status => console.log(`[AdminMessagesIndex] Removed channel ${channelName} status: ${status}`))
                    .catch(error => console.error(`[AdminMessagesIndex] Error removing channel ${channelName}:`, error))
                    .finally(() => {
                        // Only nullify if it's the same channel we intended to remove
                        if (channelRef.current === currentChannel) {
                            channelRef.current = null;
                        }
                        // Reset cleanup flag after operation attempt
                        // isCleaningUpRef.current = false; // Resetting here might be too soon if effect re-runs immediately
                    });
            } else {
                 console.log(`[AdminMessagesIndex] No channel found in ref during cleanup.`);
            }
        };
        // Depend on client initialization state and revalidator
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
        <div className="container mx-auto px-4 py-8 bg-amber-50 dark:bg-gray-800"> {/* Add background */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-foreground">Admin Messages</h1> {/* Add text color */}
                {/* Add button for admins to start new conversations - Use default variant */}
                <Button asChild>
                    <Link to="/admin/messages/new">
                        <MessageSquarePlus className="mr-2 h-4 w-4" /> New Message
                    </Link>
                </Button>
            </div>

            {conversations.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No conversations found.</p>
            ) : (
                <AdminConversationList conversations={conversations} basePath="/admin/messages"/>
            )}
        </div>
    );
}
