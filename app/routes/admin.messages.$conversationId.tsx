import {useEffect, useRef, useState} from "react";
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, type TypedResponse} from "@remix-run/node";
import {Link, useFetcher, useLoaderData} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Database, Tables} from "~/types/database.types";
import MessageView, {MessageWithSender, SenderProfile} from "~/components/MessageView";
import MessageInput from "~/components/MessageInput";
import {Button} from "~/components/ui/button";
import {AlertCircle, ArrowLeft} from "lucide-react";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {createClient, type SupabaseClient} from "@supabase/supabase-js";

// Add global type declaration for the Supabase singleton client
declare global {
    interface Window {
        __SUPABASE_SINGLETON_CLIENT?: SupabaseClient<Database>; // Explicitly type the singleton
    }
}

// Define Conversation details type
type ConversationDetails = Tables<'conversations'> & {
    participant_display_names: string | null; // Comma-separated names of family participants
};

interface LoaderData {
    conversation: ConversationDetails | null; // Updated type
    messages: MessageWithSender[];
    error?: string;
    userId: string | null; // Pass current user ID for message alignment
    ENV: { // Pass environment variables needed by client
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
        // DO NOT PASS SERVICE ROLE KEY TO CLIENT
    };
    accessToken: string | null; // Pass the access token for client-side auth
}

export interface ActionData {
    success?: boolean;
    error?: string;
}

// --- Loader ---
export async function loader({request, params}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response: {headers}, ENV} = getSupabaseServerClient(request);
    // Fetch session to get user and access token
    const {data: {session}} = await supabaseServer.auth.getSession();
    const user = session?.user;
    const accessToken = session?.access_token ?? null; // Get access token
    const conversationId = params.conversationId;

    if (!user || !accessToken) { // Check for user and token
        return json({
            conversation: null,
            messages: [],
            error: "User not authenticated",
            userId: null,
            ENV,
            accessToken: null
        }, {status: 401, headers});
    }
    if (!conversationId) {
        return json({
            conversation: null,
            messages: [],
            error: "Conversation ID missing",
            userId: user.id,
            ENV,
            accessToken
        }, {status: 400, headers});
    }

    // Check if user is admin or instructor
    const {data: profile, error: profileError} = await supabaseServer
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError || !profile || !['admin', 'instructor'].includes(profile.role)) {
        console.error("Admin/Instructor access error:", profileError?.message);
        return json({
            conversation: null,
            messages: [],
            error: "Access Denied: You do not have permission to view this page.",
            userId: user.id,
            ENV,
            accessToken
        }, {status: 403, headers});
    }

    // Verify admin/instructor is a participant (should always be true for family-initiated convos)
    // This also implicitly checks if the conversation exists.
    const {data: participantCheck, error: participantError} = await supabaseServer
        .from('conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id) // Check if the current admin/instructor user is a participant
        .maybeSingle();

    if (participantError || !participantCheck) {
        console.error("Error checking admin participation or conversation not found:", participantError?.message);
        // It's possible an admin tries to access a conversation they aren't part of (e.g., if created differently later)
        return json({
            conversation: null,
            messages: [],
            error: "Access denied or conversation not found.",
            userId: user.id,
            ENV,
            accessToken
        }, {status: 403, headers});
    }

    // Step 1: Fetch conversation details
    const {data: conversationData, error: conversationError} = await supabaseServer
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

    if (conversationError || !conversationData) {
        console.error("Error fetching conversation:", conversationError?.message);
        return json({
            conversation: null,
            messages: [],
            error: "Failed to load conversation details.",
            userId: user.id,
            ENV,
            accessToken
        }, {status: conversationError ? 500 : 404, headers});
    }

    // Step 2: Fetch participants for this conversation
    const {data: participants, error: participantsError} = await supabaseServer
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

    if (participantsError) {
        console.error("Error fetching participants:", participantsError.message);
        return json({
            conversation: null,
            messages: [],
            error: "Failed to load conversation participants.",
            userId: user.id,
            ENV,
            accessToken
        }, {status: 500, headers});
    }

    // Step 3: Get all unique user IDs
    const userIds = participants.map(p => p.user_id);

    // Create an admin client directly using environment variables on the server
    // to ensure service_role privileges for fetching profiles and families
    const supabaseAdmin = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    console.log("[AdminConversationView Loader] Fetching profiles using explicit admin client for IDs:", userIds);

    // Step 4: Fetch profiles for all users using the admin client
    const {data: profilesData, error: profilesError} = await supabaseAdmin // Use supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, role, family_id')
        .in('id', userIds);

    if (profilesError) {
        console.error("Error fetching profiles:", profilesError.message);
        return json({
            conversation: null,
            messages: [],
            error: "Failed to load user profiles.",
            userId: user.id,
            ENV,
            accessToken
        }, {status: 500, headers});
    }

    // Step 5: Get all unique family IDs
    const familyIds = [...new Set(
        profilesData
            .filter(p => p.family_id !== null)
            .map(p => p.family_id)
    )].filter(Boolean) as string[];

    // Step 6: Fetch family names if there are any family IDs
    const familiesMap = new Map<string, { name: string }>();

    if (familyIds.length > 0) {
        // Use the explicit admin client to bypass RLS for fetching families
        console.log("[AdminConversationView Loader] Fetching families using explicit admin client for IDs:", familyIds);
        const {data: familiesData, error: familiesError} = await supabaseAdmin // Use supabaseAdmin
            .from('families')
            .select('id, name')
            .in('id', familyIds);

        if (familiesError) {
            console.error("Error fetching families:", familiesError.message);
            // Continue without family names rather than failing completely
        } else if (familiesData) {
            // Create a map of family IDs to family objects
            familiesData.forEach(family => {
                familiesMap.set(family.id, {name: family.name});
            });
        }
    }

    // Create a map of profiles with their families
    const profilesWithFamilies = profilesData.map(profile => ({
        ...profile,
        families: profile.family_id ? familiesMap.get(profile.family_id) || null : null
    }));

    // Process participant names (focus on family names)
    const familyParticipantNames = profilesWithFamilies
        .filter(profile => !['admin', 'instructor'].includes(profile.role)) // Filter for non-admin/instructor profiles
        .map(profile => {
            if (profile.families?.name) return profile.families.name;
            if (profile.first_name && profile.last_name) return `${profile.first_name} ${profile.last_name}`;
            return `User ${profile.id.substring(0, 6)}`; // Fallback
        })
        .filter((name, index, self) => name && self.indexOf(name) === index) // Unique names
        .join(', ');

    const processedConversation: ConversationDetails = {
        ...conversationData,
        participant_display_names: familyParticipantNames || 'Unknown Participant',
    };


    // --- Fetch Messages (Step 1) ---
    const {data: rawMessagesData, error: messagesError} = await supabaseServer
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', {ascending: true});

    if (messagesError) {
        console.error("Error fetching messages:", messagesError.message);
        return json({
            conversation: processedConversation,
            messages: [],
            error: "Failed to load messages.",
            userId: user.id,
            ENV,
            accessToken
        }, {status: 500, headers});
    }

    const messagesWithoutProfiles = rawMessagesData ?? [];

    // --- Fetch Sender Profiles (Step 2) ---
    const senderIds = [...new Set(messagesWithoutProfiles.map(msg => msg.sender_id).filter(id => id !== null))] as string[];
    const profilesMap: Map<string, SenderProfile> = new Map();

    if (senderIds.length > 0) {
        // First attempt: Get profiles from profiles table
        const {data: profilesData, error: profilesError} = await supabaseServer
            .from('profiles')
            .select('id, email, first_name, last_name')
            .in('id', senderIds);

        if (profilesError) {
            console.error("Error fetching sender profiles:", profilesError.message);
        } else if (profilesData) {
            profilesData.forEach(profile => {
                if (profile.id) {
                    profilesMap.set(profile.id, profile as SenderProfile);
                }
            });
        }

        // For any missing profiles, try to get basic info from auth.users
        const missingSenderIds = senderIds.filter(id => !profilesMap.has(id));

        if (missingSenderIds.length > 0) {
            console.log(`Attempting to fetch ${missingSenderIds.length} missing profiles from auth.users`);

            // We need to fetch these one by one since we can't do an "IN" query on auth.users
            for (const senderId of missingSenderIds) {
                try {
                    const {data: userData, error: userError} = await supabaseServer.auth.admin.getUserById(senderId);

                    if (!userError && userData && userData.user) {
                        profilesMap.set(senderId, {
                            id: userData.user.id,
                            email: userData.user.email || '',
                            first_name: null,
                            last_name: null
                        });
                        console.log(`Successfully fetched fallback user data for ${senderId}`);
                    }
                } catch (error) {
                    console.error(`Error fetching user data for ${senderId}:`, error);
                }
            }
        }
    }

    // --- Combine Messages and Profiles (Step 3) ---
    const messages: MessageWithSender[] = messagesWithoutProfiles.map(msg => ({
        ...msg,
        senderProfile: msg.sender_id ? profilesMap.get(msg.sender_id) ?? null : null
    }));


    // Remove conversation_participants from the final conversation object sent to client if not needed directly
    // delete (processedConversation as any).conversation_participants;

    return json({
        conversation: processedConversation, // Pass processed conversation
        messages: messages,
        userId: user.id,
        ENV,
        accessToken // Pass token to client
    }, {headers});
}

// --- Action ---
export async function action({request, params}: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();
    const conversationId = params.conversationId;
    const formData = await request.formData();
    const content = formData.get("content") as string;

    if (!user) {
        return json({error: "User not authenticated"}, {status: 401, headers});
    }
    if (!conversationId) {
        return json({error: "Conversation ID missing"}, {status: 400, headers});
    }
    if (!content || content.trim().length === 0) {
        return json({error: "Message content cannot be empty"}, {status: 400, headers});
    }

    // Verify user is admin/instructor AND a participant before allowing send

    // Step 1: Check if user is a participant in the conversation
    const {data: participantCheck, error: participantError} = await supabaseServer
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (participantError || !participantCheck) {
        console.error("Admin Send Message Action: Error checking participant or user not participant:", participantError?.message);
        return json({error: "You do not have permission to send messages in this conversation."}, {
            status: 403,
            headers
        });
    }

    // Step 2: Check if user has admin or instructor role
    const {data: profileCheck, error: profileError} = await supabaseServer
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError || !profileCheck || !['admin', 'instructor'].includes(profileCheck.role)) {
        console.error("Admin Send Message Action: Error checking role or user not admin/instructor:", profileError?.message);
        return json({error: "You do not have permission to send messages in this conversation."}, {
            status: 403,
            headers
        });
    }

    // Insert the new message
    const {error: insertError} = await supabaseServer
        .from('messages')
        .insert({
            conversation_id: conversationId,
            sender_id: user.id, // Sender is the admin/instructor user
            content: content.trim(),
        });

    if (insertError) {
        console.error("Error sending admin message:", insertError.message);
        return json({error: "Failed to send message."}, {status: 500, headers});
    }

    return json({success: true}, {headers});
}

// --- Component ---
export default function AdminConversationView() {
    const {conversation, messages: initialMessages, userId, error, ENV, accessToken} = useLoaderData<typeof loader>(); // Get accessToken
    const fetcher = useFetcher<ActionData>();
    const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);
    const hasSubscribedRef = useRef(false); // Ref to track subscription status
    // Use a more specific ref to track channel subscription by conversation ID
    const channelSubscriptionRef = useRef<{ [key: string]: boolean }>({});
    // Create a stable client ID to avoid multiple instances
    // const clientId = useRef(`admin-messages-${Math.random().toString(36).substring(2, 9)}`);

    // Single Supabase client instance with memoization
    const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null); // Use the correct SupabaseClient type

    // Initialize the Supabase client only once - use a static client for the entire app
    useEffect(() => {
        // Use a module-level singleton pattern to ensure only one client exists
        // Initialize with ANON KEY. Authentication relies on the accessToken passed globally.
        if (!window.__SUPABASE_SINGLETON_CLIENT) {
            if (ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY) { // Use ANON KEY
                console.log("[Admin] Creating global Supabase singleton client with ANON KEY.");
                window.__SUPABASE_SINGLETON_CLIENT = createClient<Database>(
                    ENV.SUPABASE_URL,
                    ENV.SUPABASE_ANON_KEY, // Use ANON KEY
                    {
                        // Configure auth persistence as needed, but client is initialized anon
                        auth: {
                            persistSession: true, // Or false, depending on app needs
                            autoRefreshToken: false
                        },
                        realtime: {
                            params: {
                                eventsPerSecond: 10
                            }
                        },
                        global: {
                            headers: {
                                // Pass the access token for authenticated requests
                                'Authorization': `Bearer ${accessToken}`,
                                'X-Client-Info': 'admin-messaging-client'
                            }
                        }
                    }
                );
                console.log(`[Admin] Created global Supabase singleton client with ANON KEY.`);
            } else {
                console.error("[Admin] Missing SUPABASE_URL or SUPABASE_ANON_KEY for client initialization.");
            }
        } else if (window.__SUPABASE_SINGLETON_CLIENT) { // Check if the client exists
            console.log(`[Admin] Using existing global Supabase singleton client. Updating Authorization header.`);
            // Ensure the existing client has the latest token and handle potential missing 'global' or 'headers'
            if (!window.__SUPABASE_SINGLETON_CLIENT.global) {
                // If 'global' is missing, initialize it (though this shouldn't typically happen)
                window.__SUPABASE_SINGLETON_CLIENT.global = {headers: {}};
                console.warn("[Admin] Singleton client was missing 'global' property. Initialized.");
            }
            // Safely update headers, providing default empty object if headers are initially missing
            window.__SUPABASE_SINGLETON_CLIENT.global.headers = {
                ...(window.__SUPABASE_SINGLETON_CLIENT.global.headers || {}), // Use existing headers or empty object
                'Authorization': `Bearer ${accessToken}`,
            };
        }

        // Assign the singleton to our ref
        supabaseRef.current = window.__SUPABASE_SINGLETON_CLIENT as ReturnType<typeof createClient>;

        return () => {
            // We don't destroy the singleton client on unmount
            console.log("[Admin] Component unmounting, Supabase client reference will be cleaned up");
        };
        // Re-run if ENV vars or accessToken change
    }, [ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, accessToken]);

    // Variable to track cleanup state - use ref for stability across renders
    const isCleaningUpRef = useRef(false);

    // Set up subscription using singleton client
    useEffect(() => {
        // Reset cleaning up state on mount
        isCleaningUpRef.current = false;

        const supabase = supabaseRef.current;
        let channel: ReturnType<SupabaseClient<Database>['channel']> | null = null;
        let isMounted = true;
        const channelName = conversation?.id ? `admin-messages:${conversation.id}` : null;
        console.log(`[Admin] useEffect run. Conversation ID: ${conversation?.id}, Supabase Client: ${supabase ? 'obtained' : 'null'}. channelName: ${channelName}`);

        // Early return if any required data is missing
        if (!conversation?.id || !supabase || !channelName) {
            console.log("[Admin] Skipping subscription: conversation ID or Supabase client missing.");
            return;
        }

        // Check if we're already subscribed to this specific channel
        if (channelSubscriptionRef.current[channelName]) {
            console.log(`[Admin] Already subscribed to channel ${channelName}, skipping setup.`);
            return;
        }

        // Mark this channel as being set up to prevent race conditions
        // This prevents multiple setup attempts while async operations are in progress
        channelSubscriptionRef.current[channelName] = true;

        console.log(`[Admin] Attempting to set up channel: ${channelName}`);

        // Define a function to create and set up the channel
        const setupChannel = async () => {
            console.log(`[Admin] Setting up channel: ${channelName}`);
            try {
                // If cleanup started while we were waiting, abort setup
                if (isCleaningUpRef.current) {
                    console.log(`[Admin] Cleanup started during setup, aborting channel creation for ${channelName}`);
                    return;
                }

                // Create the channel with reconnection options
                channel = supabase.channel(channelName, {
                    config: {
                        broadcast: {self: true},
                        presence: {key: userId || 'anonymous'},
                    }
                });
                console.log(`[Admin] Created channel: ${channelName} with reconnection options`);

                // Set up event listener
                channel.on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `conversation_id=eq.${conversation.id}`
                    },
                    async (payload) => {
                        console.log('payload', payload);
                        // We used to skip processing if cleanup is in progress, but this caused messages to be lost
                        // Now we'll log a warning but still process the message
                        if (isCleaningUpRef.current) {
                            console.log('Warning: Received message during cleanup, but will still process it');
                        }

                        console.log('[Admin] New message received via subscription:', payload.new);
                        const rawNewMessage = payload.new as Tables<'messages'>;

                        // SECURITY/SIMPLICITY: Avoid client-side profile fetching with potentially incorrect auth context.
                        // Just add the message with a basic sender profile. The UI can show sender ID or a placeholder.
                        // Revalidation or fetching profiles server-side is more robust.
                        const newMessage: MessageWithSender = {
                            ...rawNewMessage,
                            senderProfile: { // Create a basic profile placeholder
                                id: rawNewMessage.sender_id || 'unknown',
                                email: '', // Don't assume email is available
                                first_name: null,
                                last_name: null
                            }
                        };

                        console.log("[Admin] Adding new message to state (basic profile):", newMessage);
                        // Update state only if the component is still mounted and not cleaning up
                        if (isMounted && !isCleaningUpRef.current) {
                            setMessages(currentMessages => {
                                // Avoid adding duplicates if the message somehow arrives multiple times
                                if (currentMessages.some(msg => msg.id === newMessage.id)) {
                                    return currentMessages;
                                }
                                return [...currentMessages, newMessage];
                            });
                        } else {
                            console.log(`[Admin] Skipping state update for new message because component is ${!isMounted ? 'unmounted' : 'cleaning up'}.`);
                        }
                    }
                );

                // Subscribe to the channel
                console.log(`[Admin] Subscribing to channel: ${channelName}`);
                channel.subscribe((status, err) => {
                    console.log(`[Admin] Channel status: ${status}, error: ${err}`);
                    // We used to skip processing if cleanup is in progress, but this could cause issues
                    // Now we'll log a warning but still process the status update
                    if (isCleaningUpRef.current) {
                        console.log('Warning: Received channel status update during cleanup, but will still process it');
                    }

                    console.log(`[Admin Channel: ${channelName}] Status: ${status}`, err || '');

                    if (status === 'SUBSCRIBED') {
                        console.log(`[Admin] Successfully subscribed to messages channel: ${channelName}`);
                        hasSubscribedRef.current = true;
                    }

                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        console.error(`[Admin Channel: ${channelName}] Issue: ${status}`, err);
                        hasSubscribedRef.current = false;
                        channelSubscriptionRef.current[channelName] = false;
                    }
                });

            } catch (error) {
                console.error(`[Admin] Error setting up channel ${channelName}:`, error);
                hasSubscribedRef.current = false;
                channelSubscriptionRef.current[channelName] = false;
            }
        };

        // First remove any existing channel with this name
        const cleanupExistingChannel = async () => {
            console.log(`[Admin] starting cleanupExistingChannel`);
            try {
                // Create a temporary channel reference just for removal
                const tempChannel = supabase.channel(channelName);
                await supabase.removeChannel(tempChannel);
                console.log(`[Admin] Pre-emptively removed any existing channel: ${channelName}`);

                // If cleanup started while we were waiting, don't proceed to setup
                if (!isCleaningUpRef.current) {
                    await setupChannel();
                } else {
                    console.log(`[Admin] Cleanup started during pre-emptive removal, aborting channel creation for ${channelName}`);
                }
            } catch (error) {
                console.error(`[Admin] Error during pre-emptive removal of channel ${channelName}:`, error);
                channelSubscriptionRef.current[channelName] = false;
            }
        };

        // Start the cleanup and setup process
        console.log(`[Admin] Starting cleanup and setup for channel: ${channelName}`);
        cleanupExistingChannel();

        // Capture the ref's current value for the cleanup function
        const currentChannelSubscriptionRef = channelSubscriptionRef.current;

        // Cleanup function
        return () => {
            isCleaningUpRef.current = true;
            isMounted = false;
            console.log(`[Admin] Cleaning up channel: ${channelName}`);

            const cleanup = async () => {
                if (channel && supabase) {
                    try {
                        // First unsubscribe from the channel
                        channel.unsubscribe();
                        console.log(`[Admin] Unsubscribed from messages channel: ${channelName}`);

                        // Then remove the channel
                        const status = await supabase.removeChannel(channel);
                        console.log(`[Admin] Channel removal status: ${status}`);

                        // Clear the subscription tracking using the captured value
                        if (channelName) {
                            currentChannelSubscriptionRef[channelName] = false;
                        }
                    } catch (error) {
                        console.error("[Admin] Error removing channel:", error);
                    }
                }
            };

            // Execute cleanup immediately
            cleanup();
        };
        // Dependencies: Re-run if conversation ID, client instance, or token changes.
    }, [userId, conversation?.id, supabaseRef, accessToken]); // Use supabaseRef and accessToken

    // Update messages state if loader data changes
    useEffect(() => {
        setMessages(initialMessages);
    }, [initialMessages]);


    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4"/>
                    <AlertTitle>Error Loading Conversation</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                    <Button variant="link" asChild className="mt-2">
                        <Link to="/admin/messages">Back to Messages</Link>
                    </Button>
                </Alert>
            </div>
        );
    }

    if (!conversation) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Alert variant="default">
                    <AlertCircle className="h-4 w-4"/>
                    <AlertTitle>Not Found</AlertTitle>
                    <AlertDescription>Conversation not found.</AlertDescription>
                    <Button variant="link" asChild className="mt-2">
                        <Link to="/admin/messages">Back to Messages</Link>
                    </Button>
                </Alert>
            </div>
        );
    }

    return (
        // Use similar height calculation as family view, adjust if admin layout differs
        <div
            className="container mx-auto px-4 py-8 h-[calc(100vh-var(--admin-header-height,64px)-var(--admin-footer-height,64px)-2rem)] flex flex-col">
            <div className="flex items-center mb-4">
                <Button variant="ghost" size="icon" asChild className="mr-2">
                    <Link to="/admin/messages" aria-label="Back to messages">
                        <ArrowLeft className="h-5 w-5"/>
                    </Link>
                </Button>
                {/* Display Subject and Participant Names */}
                <div className="flex-1 min-w-0 ml-2">
                    <h1 className="text-lg font-semibold truncate">{conversation.subject || 'Conversation'}</h1>
                    {conversation.participant_display_names && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            With: {conversation.participant_display_names}
                        </p>
                    )}
                </div>
            </div>

            {/* Message Display Area */}
            <MessageView messages={messages} currentUserId={userId}/>

            {/* Message Input Area */}
            <MessageInput fetcher={fetcher}/>
            {fetcher.data?.error && (
                <p className="text-red-500 text-sm mt-2">{fetcher.data.error}</p>
            )}
        </div>
    );
}
