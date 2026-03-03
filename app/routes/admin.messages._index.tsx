import {useEffect, useRef, useState} from "react"; // Import useRef
import {json, type LoaderFunctionArgs, type TypedResponse} from "@remix-run/node";
import {useLoaderData, useRevalidator, Link, useOutletContext} from "@remix-run/react";
import {classifyRealtimeStatus} from "~/utils/realtime-channel";
import {SupabaseClient, RealtimeChannel} from "@supabase/supabase-js"; // Import RealtimeChannel
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Database} from "~/types/database.types";
import {AlertCircle, PlusCircle} from "lucide-react";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import AdminConversationList, {AdminConversationSummary} from "~/components/AdminConversationList";
import { Button } from "~/components/ui/button"; // Import Button
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

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


export default function AdminMessagesIndex() {
    const {conversations, error, accessToken, refreshToken} = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const { supabase } = useOutletContext<{ supabase: SupabaseClient<Database> }>(); // Get Supabase client from context
    const channelRef = useRef<RealtimeChannel | null>(null); // Ref for the channel
    const isCleaningUpRef = useRef(false); // Ref to prevent race conditions during cleanup
    const [sessionReady, setSessionReady] = useState(false); // True only after session is authenticated

    // Effect for Supabase Client Initialization + Session setup
    useEffect(() => {
        if (!supabase) {
            console.warn("[AdminMessagesIndex] Supabase client not available from context.");
            return;
        }
        if (!accessToken || !refreshToken) {
            console.warn("[AdminMessagesIndex] Access token or refresh token missing, cannot set session.");
            return;
        }
        supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        }).then(({error: sessionError}) => {
            if (sessionError) {
                console.error("[AdminMessagesIndex] Error setting session:", sessionError.message);
            } else {
                setSessionReady(true);
            }
        });
    }, [accessToken, refreshToken, supabase]);

    // Effect for Supabase Realtime Subscription — only runs after session is authenticated
    useEffect(() => {
        isCleaningUpRef.current = false;

        if (!sessionReady || !supabase) {
            return;
        }

        // Prevent setup if already subscribed
        if (channelRef.current && channelRef.current.state === 'joined') {
            return;
        }

        const channelName = 'admin-messages-list-channel';

        // Remove any existing channel before creating a new one
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        const channel = supabase.channel(channelName);
        channelRef.current = channel;

        channel
            .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'messages'}, () => {
                if (!isCleaningUpRef.current) {
                    revalidator.revalidate();
                }
            })
            .subscribe((status: string, err?: Error) => {
                const level = classifyRealtimeStatus(status, isCleaningUpRef.current);
                if (level === 'subscribed') {
                    console.log(`[AdminMessagesIndex] Subscribed to ${channelName}`);
                } else if (level === 'error') {
                    console.error(`[AdminMessagesIndex] Channel ${channelName} issue: Status=${status}`, err || '(No error object provided)');
                } else if (level === 'warn') {
                    console.warn(`[AdminMessagesIndex] Channel ${channelName} closed unexpectedly`);
                }
                // 'ignore' → CLOSED during cleanup; no log
            });

        return () => {
            isCleaningUpRef.current = true;
            const currentChannel = channelRef.current;
            if (currentChannel && supabase) {
                supabase.removeChannel(currentChannel)
                    .finally(() => {
                        if (channelRef.current === currentChannel) {
                            channelRef.current = null;
                        }
                    });
            }
        };
    }, [sessionReady, revalidator, supabase]);


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
                <AppBreadcrumb items={breadcrumbPatterns.adminMessages()} />
                <div className="flex justify-between items-center mt-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Messages</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage conversations with families and students</p>
                    </div>
                    <Button asChild>
                        <Link to="/admin/messages/new">
                            <PlusCircle className="w-4 h-4 mr-2" />
                            New Message
                        </Link>
                    </Button>
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
            <AdminConversationList conversations={conversations} basePath="/admin/messages"/>
        </div>
    );
}
