import { useEffect, useState } from "react";
import { json, type LoaderFunctionArgs, type TypedResponse } from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import { createClient, SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Database, Tables } from "~/types/database.types";
import ConversationList from "~/components/ConversationList"; // Re-use existing component
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

// Type for the data fetched in the loader, adapted for ConversationList
type ConversationSummary = Pick<Database['public']['Tables']['conversations']['Row'], 'id' | 'subject' | 'last_message_at'> & {
    // Add participant info for display purposes
    participant_display_name?: string | null;
};

// Helper type for profile data needed
type ParticipantProfileData = Pick<Tables<'profiles'>, 'id' | 'role' | 'family_id'> & {
    families: Pick<Tables<'families'>, 'name'> | null;
};

interface LoaderData {
    conversations: ConversationSummary[];
    error?: string;
    ENV: { // Pass ENV vars for client-side Supabase
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
        SUPABASE_SERVICE_ROLE_KEY: string;
    };
    accessToken: string | null; // Add accessToken
    userId: string | null; // Add userId
}

export async function loader({ request }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const { supabaseServer, response: { headers }, ENV } = getSupabaseServerClient(request);
    // Fetch session which includes the access token
    const { data: { session }, error: sessionError } = await supabaseServer.auth.getSession();

    // Handle potential error fetching session
    if (sessionError) {
        console.error("Error fetching session:", sessionError.message);
        // Return minimal data, indicating an error state
        return json({ conversations: [], error: "Session fetch error", ENV, accessToken: null, userId: null }, { status: 500, headers });
    }

    const user = session?.user;
    const accessToken = session?.access_token ?? null; // Get access token or null
    const userId = user?.id ?? null; // Get user ID or null

    if (!user || !accessToken || !userId) { // Check for user, token, and ID
        // Return ENV and null token/userId even on error
        return json({ conversations: [], error: "User not authenticated", ENV, accessToken: null, userId: null }, { status: 401, headers });
    }
    // const userId = user.id; // userId is already defined above

    // Check if user is admin or instructor
    const { data: profile, error: profileError } = await supabaseServer
        .from('profiles')
        .select('role, family_id') // Fetch family_id too
        .eq('id', user.id)
        .single();

    if (profileError || !profile || !['admin', 'instructor'].includes(profile.role)) {
        console.error("Admin/Instructor access error:", profileError?.message);
        // Return ENV, token, and userId even on error
        return json({ conversations: [], error: "Access Denied: You do not have permission to view this page.", ENV, accessToken, userId }, { status: 403, headers });
    }

    // We'll use type guards instead of type assertions to handle potential errors

    // Fetch all conversations ordered by last message time
    // Include participants and their profiles to determine the family name
    const {data: conversationsData, error: conversationsError}: {
        data: {
            id: string;
            subject: string | null;
            last_message_at: string | null;
            conversation_participants: { user_id: string }[]
        }[] | null;
        error: PostgrestError | null;
    } = await supabaseServer
        .from('conversations')
        .select(`                                                                                                                                                                                                     
            id,                                                                                                                                                                                                       
            subject,                                                                                                                                                                                                  
            last_message_at,                                                                                                                                                                                          
            conversation_participants ( user_id )                                                                                                                                                                     
        `)
        .order('last_message_at', {ascending: false});

    if (conversationsError) {
        console.error("Error fetching admin conversations:", conversationsError.message);
        // Return ENV, token, and userId even on error
        return json({ conversations: [], error: "Failed to load conversations.", ENV, accessToken, userId }, { status: 500, headers });
    }

    // Use the data without type assertion
    const rawConversations = conversationsData ?? [];

    // --- Fetch Participant Profiles Separately ---
    // Safely extract user IDs, handling potential errors in the data structure
    const allParticipantUserIds = [
        ...new Set(
            rawConversations.flatMap(conv => {
                // Check if conversation_participants exists and is an array
                if (conv &&
                    typeof conv === 'object' &&
                    'conversation_participants' in conv &&
                    Array.isArray(conv.conversation_participants)) {
                    return conv.conversation_participants.map(p => {
                        // Check if user_id exists
                        if (p && typeof p === 'object' && 'user_id' in p) {
                            return p.user_id;
                        }
                        return null;
                    });
                }
                return [];
            }).filter(id => id !== null) // Filter out nulls
        )
    ] as string[];

    const profilesMap: Map<string, ParticipantProfileData> = new Map();

    if (allParticipantUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabaseServer
            .from('profiles')
            .select(`                                                                                                                                                                                                 
                id,                                                                                                                                                                                                   
                role,                                                                                                                                                                                                 
                family_id,                                                                                                                                                                                            
                families ( name )                                                                                                                                                                                     
            `)
            .in('id', allParticipantUserIds);

        if (profilesError) {
            console.error("Error fetching participant profiles:", profilesError.message);
            // Proceed without profile data, but log the error
        } else if (profilesData) {
            profilesData.forEach(profile => {
                if (profile.id) {
                    profilesMap.set(profile.id, profile as ParticipantProfileData);
                }
            });
        }
    }

    // --- Combine Conversation and Profile Data ---
    const conversations: ConversationSummary[] = rawConversations.map(conv => {
        // Check if conv is a valid object with the expected properties
        if (!conv || typeof conv !== 'object') {
            // Return a placeholder for invalid conversations
            return {
                id: 'invalid-id',
                subject: 'Invalid Conversation',
                last_message_at: new Date().toISOString(),
                participant_display_name: null
            };
        }

        let participantDisplayName: string | null = null;
        const id = 'id' in conv && typeof conv.id === 'string' ? conv.id : 'unknown-id';
        const subject = 'subject' in conv && typeof conv.subject === 'string' ? conv.subject : null;
        const last_message_at = 'last_message_at' in conv && typeof conv.last_message_at === 'string'
            ? conv.last_message_at
            : new Date().toISOString();

        // Safely access conversation_participants
        if ('conversation_participants' in conv &&
            Array.isArray(conv.conversation_participants)) {

            // Find the first non-admin/instructor participant using the profilesMap
            const familyParticipantUserId = conv.conversation_participants.find(p => {
                if (p && typeof p === 'object' && 'user_id' in p) {
                    const profile = profilesMap.get(p.user_id);
                    return profile && !['admin', 'instructor'].includes(profile.role) && profile.families?.name;
                }
                return false;
            })?.user_id;

            if (familyParticipantUserId) {
                participantDisplayName = profilesMap.get(familyParticipantUserId)?.families?.name ?? null;
            } else {
                // Fallback: find the first non-admin/instructor participant's profile ID
                const otherParticipantUserId = conv.conversation_participants.find(p => {
                    if (p && typeof p === 'object' && 'user_id' in p) {
                        const profile = profilesMap.get(p.user_id);
                        return profile && !['admin', 'instructor'].includes(profile.role);
                    }
                    return false;
                })?.user_id;

                if (otherParticipantUserId) {
                    participantDisplayName = `User ${otherParticipantUserId.substring(0, 8)}`; // Placeholder
                }
            }
        }

        // Construct a display subject if the original is empty
        const displaySubject = subject || `Conversation with ${participantDisplayName || 'Unknown Participant'}`;

        return {
            id,
            subject: displaySubject, // Use the constructed subject
            last_message_at,
            participant_display_name: participantDisplayName // Keep for potential future use
        };
    });


    return json({ conversations, ENV, accessToken, userId }, { headers }); // Pass token and userId
}


export default function AdminMessagesIndex() {
    console.log("[AdminMessagesIndex] Component function executing..."); // Keep this initial log
    const { conversations, error, ENV, accessToken } = useLoaderData<typeof loader>(); // Get ENV, accessToken, and userId back
    const revalidator = useRevalidator(); // Re-enable revalidator
    const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null); // Re-enable supabase state

    // Temporarily remove all useEffect hooks to isolate rendering issues
    // useEffect(() => { ... }); // Render log removed
    // useEffect(() => { ... }); // Conversation data log removed

    // Effect to create the client once ENV and accessToken are available
    useEffect(() => {
        console.log("[AdminMessagesIndex] Client creation effect running.");
        if (ENV?.SUPABASE_URL && ENV?.SUPABASE_SERVICE_ROLE_KEY && accessToken && !supabase) {
            console.log("[AdminMessagesIndex] Creating client-side Supabase client using User Token...");
            // Use the user's access token for initialization
            const client = createClient<Database>(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
                global: {
                    headers: { Authorization: `Bearer ${accessToken}` },
                },
            });
            setSupabase(client);
            console.log("[AdminMessagesIndex] Supabase client state set with user token.");
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
        console.log("[AdminMessagesIndex] Subscription effect running.");
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
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
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
                    <AlertCircle className="h-4 w-4" />
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
                <ConversationList conversations={conversations} basePath="/admin/messages" />
            )}
        </div>
    );
}
