import {useEffect, useRef, useState} from "react"; // Import useRef
import {json, type LoaderFunctionArgs, type TypedResponse} from "@vercel/remix";
import {useLoaderData, useRevalidator, useOutletContext} from "@remix-run/react";
import {RealtimeChannel} from "@supabase/supabase-js"; // Import RealtimeChannel
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {AlertCircle} from "lucide-react";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import AdminConversationList, {AdminConversationSummary} from "~/components/AdminConversationList";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import type { InstructorOutletContext } from "~/routes/instructor";

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

    // NOTE: Admin/Instructor role check is handled by the parent layout loader (_admin.tsx).
    // We only need the session details (accessToken, refreshToken, userId) and ENV
    // to pass to the client for Supabase initialization.

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


export default function InstructorMessagesIndex() {
    const {conversations, error, accessToken, refreshToken} = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const { supabase } = useOutletContext<InstructorOutletContext>(); // Get Supabase client from context
    const channelRef = useRef<RealtimeChannel | null>(null); // Ref for the channel
    const isCleaningUpRef = useRef(false); // Ref to prevent race conditions during cleanup
    const [clientInitialized, setClientInitialized] = useState(false); // State to track initialization

    // Effect for Supabase Client Initialization
    useEffect(() => {
        console.log("[AdminMessagesIndex] Using Supabase client from context.");
        if (supabase) {
            console.log("[AdminMessagesIndex] Supabase client available from context.");
            setClientInitialized(true); // Signal that the client object exists
        } else {
            console.warn("[AdminMessagesIndex] Supabase client not available from context.");
        }
    }, [supabase]); // Depend on supabase from context

    // Effect to set/update the session on the initialized client
    useEffect(() => {
        console.log("[AdminMessagesIndex] Session update effect running.");
        if (supabase && accessToken && refreshToken) {
            console.log("[AdminMessagesIndex] Setting session on Supabase client...");
            supabase.auth.setSession({
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
            console.log("[AdminMessagesIndex] Supabase client not ready for session setting.");
        }
    }, [accessToken, refreshToken, supabase]); // Depend on tokens and supabase client

    // Effect for Supabase Realtime Subscription
    useEffect(() => {
        // Ensure cleanup ref is reset when dependencies change
        isCleaningUpRef.current = false;
        console.log("[AdminMessagesIndex] Subscription effect running.");

        if (!clientInitialized || !supabase) {
            console.log("[AdminMessagesIndex] Supabase client not ready for real-time. Skipping subscription setup.");
            return; // Exit if client is not initialized
        }

        // Prevent setup if already subscribed or during cleanup
        if (channelRef.current && channelRef.current.state === 'joined') {
             console.log("[AdminMessagesIndex] Already subscribed to channel. Skipping setup.");
             return;
        }

        console.log("[AdminMessagesIndex] Setting up Supabase real-time subscription...");
        const channelName = 'instructor-messages-list-channel';
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
            .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'messages'}, (payload: { new: Record<string, unknown>; old: Record<string, unknown> | null; eventType: string }) => {
                console.log('[AdminMessagesIndex] *** New message INSERT detected! ***:', payload);
                if (!isCleaningUpRef.current) { // Check cleanup flag
                    console.log('[AdminMessagesIndex] Revalidating conversation list due to new message...');
                    revalidator.revalidate();
                } else {
                    console.log('[AdminMessagesIndex] Cleanup in progress, skipping revalidation.');
                }
            })
            .subscribe((status: string, err?: Error) => {
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
                    .then((status: string) => console.log(`[AdminMessagesIndex] Removed channel ${channelName} status: ${status}`))
                    .catch((error: Error) => console.error(`[AdminMessagesIndex] Error removing channel ${channelName}:`, error))
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
        // Depend on client initialization state, revalidator, and supabase
    }, [clientInitialized, revalidator, supabase]);


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
        <div className="max-w-7xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="mb-8">
                <AppBreadcrumb items={breadcrumbPatterns.instructorMessages()} />
                <div className="mt-4">
                    <h1 className="instructor-page-header-styles">Messages</h1>
                    <p className="instructor-subheader-styles mt-1">Keep in touch with families and students.</p>
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="mb-6">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4"/>
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </div>
            )}

            {/* Main Content */}
            <AdminConversationList conversations={conversations} basePath="/instructor/messages"/>
        </div>
    );
}
