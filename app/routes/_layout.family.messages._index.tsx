import {useEffect, useRef, useState} from "react"; // Import useEffect, useRef, useState
import {json, type LoaderFunctionArgs, type TypedResponse} from "@remix-run/node";
import {Link, useLoaderData, useRevalidator, useOutletContext} from "@remix-run/react"; // Import useRevalidator, useOutletContext
import {SupabaseClient, RealtimeChannel} from "@supabase/supabase-js"; // Import SupabaseClient, RealtimeChannel
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
    const {conversations, error, accessToken, refreshToken} = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const { supabase } = useOutletContext<{ supabase: SupabaseClient<Database> }>(); // Get Supabase client from context
    const channelRef = useRef<RealtimeChannel | null>(null); // Ref for the channel
    const isCleaningUpRef = useRef(false); // Ref to prevent race conditions during cleanup
    const [sessionReady, setSessionReady] = useState(false); // True only after session is authenticated

    // Effect for Supabase Client Initialization + Session setup
    useEffect(() => {
        if (!supabase) {
            console.warn("[FamilyMessagesIndex] Supabase client not available from context.");
            return;
        }
        if (!accessToken || !refreshToken) {
            console.warn("[FamilyMessagesIndex] Access token or refresh token missing, cannot set session.");
            return;
        }
        supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        }).then(({error: sessionError}) => {
            if (sessionError) {
                console.error("[FamilyMessagesIndex] Error setting session:", sessionError.message);
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

        const channelName = 'family-messages-list-channel';

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
                if (status === 'SUBSCRIBED') {
                    console.log(`[FamilyMessagesIndex] Subscribed to ${channelName}`);
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    // Real errors — report to Sentry via console.error
                    console.error(`[FamilyMessagesIndex] Channel ${channelName} issue: Status=${status}`, err || '(No error object provided)');
                } else if (status === 'CLOSED' && !isCleaningUpRef.current) {
                    // CLOSED during cleanup is expected (removeChannel call). Only warn if unexpected.
                    console.warn(`[FamilyMessagesIndex] Channel ${channelName} closed unexpectedly`);
                }
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
        <div className="page-styles">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <AppBreadcrumb items={breadcrumbPatterns.familyMessages()} className="mb-6" />

                {/* Page Header */}
                <div className="family-page-header-section-styles">
                    <h1 className="page-header-styles">
                        Messages
                    </h1>
                    <p className="page-subheader-styles">
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
                                         New
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
                                         New
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
