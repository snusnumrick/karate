import { useState, useEffect, useRef } from "react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type TypedResponse } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Database, Tables } from "~/types/database.types";
import MessageView from "~/components/MessageView"; // We will create this component
import MessageInput from "~/components/MessageInput"; // We will create this component
import { Button } from "~/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createClient, REALTIME_SUBSCRIBE_STATES, type SupabaseClient } from "@supabase/supabase-js"; // Import createClient

// Add TypeScript declaration for the global window.__SUPABASE_SINGLETON_CLIENT property
declare global {
    interface Window {
        __SUPABASE_SINGLETON_CLIENT?: SupabaseClient<Database>;
    }
}

// Define Profile type for sender details
type SenderProfile = Pick<Tables<'profiles'>, 'id' | 'email' | 'first_name' | 'last_name'>;

// Define Message type: Includes original message fields + nested sender profile
type MessageWithSender = Tables<'messages'> & {
    senderProfile: SenderProfile | null; // Nested profile data
};


// Define Conversation details type
type ConversationDetails = Tables<'conversations'> & {
    // Add participants if needed for display
    // conversation_participants: { user_id: string, profiles: { email: string } | null }[];
};

interface LoaderData {
    conversation: ConversationDetails | null;
    messages: MessageWithSender[];
    error?: string;
    userId: string | null; // Pass current user ID for message alignment
    ENV: { // Pass environment variables needed by client
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
        SUPABASE_SERVICE_ROLE_KEY: string;
    };
}

export interface ActionData {
    success?: boolean;
    error?: string;
}

// Loader: Fetch conversation details and messages
export async function loader({ request, params }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const { supabaseServer, response: { headers }, ENV } = getSupabaseServerClient(request);
    const { data: { user } } = await supabaseServer.auth.getUser();
    const conversationId = params.conversationId;

    if (!user) {
        return json({ conversation: null, messages: [], error: "User not authenticated", userId: null, ENV }, { status: 401, headers });
    }
    if (!conversationId) {
        return json({ conversation: null, messages: [], error: "Conversation ID missing", userId: user.id, ENV }, { status: 400, headers });
    }

    // Verify user is a participant in this conversation
    const { data: participantCheck, error: participantError } = await supabaseServer
        .from('conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (participantError || !participantCheck) {
        console.error("Error checking participant or user not participant:", participantError?.message);
        return json({ conversation: null, messages: [], error: "Access denied or conversation not found.", userId: user.id, ENV }, { status: 403, headers });
    }

    // Fetch conversation details
    const { data: conversationData, error: conversationError } = await supabaseServer
        .from('conversations')
        .select('*') // Select necessary fields
        .eq('id', conversationId)
        .single();

    if (conversationError) {
         console.error("Error fetching conversation:", conversationError?.message);
        return json({ conversation: null, messages: [], error: "Failed to load conversation details.", userId: user.id, ENV }, { status: 500, headers });
    }

    // --- Fetch Messages (Step 1) ---
    const { data: rawMessagesData, error: messagesError } = await supabaseServer
        .from('messages')
        .select('*') // Select all message fields, including sender_id UUID
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    if (messagesError) {
        console.error("Error fetching messages:", messagesError.message);
        return json({ conversation: conversationData, messages: [], error: "Failed to load messages.", userId: user.id, ENV }, { status: 500, headers });
    }

    const messagesWithoutProfiles = rawMessagesData ?? [];

    // --- Fetch Sender Profiles (Step 2) ---
    const senderIds = [...new Set(messagesWithoutProfiles.map(msg => msg.sender_id).filter(id => id !== null))] as string[];
    const profilesMap: Map<string, SenderProfile> = new Map();

    if (senderIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabaseServer
            .from('profiles')
            .select('id, email, first_name, last_name')
            .in('id', senderIds);

        if (profilesError) {
            console.error("Error fetching sender profiles:", profilesError.message);
            // Proceed without profiles, but log the error
        } else if (profilesData) {
            profilesData.forEach(profile => {
                if (profile.id) { // Ensure profile and id are not null
                     profilesMap.set(profile.id, profile as SenderProfile);
                }
            });
        }
    }

    // --- Combine Messages and Profiles (Step 3) ---
    const messages: MessageWithSender[] = messagesWithoutProfiles.map(msg => ({
        ...msg,
        senderProfile: msg.sender_id ? profilesMap.get(msg.sender_id) ?? null : null
    }));


    return json({
        conversation: conversationData,
        messages: messages, // Pass the combined messages array
        userId: user.id,
        ENV // Pass necessary env vars to client
    }, { headers });
}

// Action: Send a new message
export async function action({ request, params }: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const { supabaseServer, response: { headers } } = getSupabaseServerClient(request);
    const { data: { user } } = await supabaseServer.auth.getUser();
    const conversationId = params.conversationId;
    const formData = await request.formData();
    const content = formData.get("content") as string;

    if (!user) {
        return json({ error: "User not authenticated" }, { status: 401, headers });
    }
    if (!conversationId) {
        return json({ error: "Conversation ID missing" }, { status: 400, headers });
    }
    if (!content || content.trim().length === 0) {
        return json({ error: "Message content cannot be empty" }, { status: 400, headers });
    }

    // Verify user is a participant before allowing send
    const { data: participantCheck, error: participantError } = await supabaseServer
        .from('conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (participantError || !participantCheck) {
        console.error("Send Message Action: Error checking participant or user not participant:", participantError?.message);
        return json({ error: "You do not have permission to send messages in this conversation." }, { status: 403, headers });
    }

    // Insert the new message
    const { error: insertError } = await supabaseServer
        .from('messages')
        .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: content.trim(),
        });

    if (insertError) {
        console.error("Error sending message:", insertError.message);
        return json({ error: "Failed to send message." }, { status: 500, headers });
    }

    // No need to redirect, fetcher handles UI update
    return json({ success: true }, { headers });
}


export default function ConversationView() {
    const { conversation, messages: initialMessages, userId, error, ENV } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<ActionData>();
    const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);
    const hasSubscribedRef = useRef(false); // Ref to track subscription status

    // Use a more specific ref to track channel subscription by conversation ID
    const channelSubscriptionRef = useRef<{[key: string]: boolean}>({});

    // Create a ref to store profiles from initial messages for reuse with new messages
    const profilesMapRef = useRef<Map<string, SenderProfile>>(new Map());

    // Store the Supabase client in a ref to avoid creating multiple instances
    const supabaseRef = useRef<SupabaseClient<Database> | null>(null);

    // Initialize the Supabase client only once - use a static client for the entire app
    useEffect(() => {
        // Use a module-level singleton pattern to ensure only one client exists
        if (!window.__SUPABASE_SINGLETON_CLIENT) {
            if (ENV.SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
                window.__SUPABASE_SINGLETON_CLIENT = createClient<Database>(
                    ENV.SUPABASE_URL,
                    ENV.SUPABASE_SERVICE_ROLE_KEY,
                    {
                        auth: {
                            persistSession: false,
                            autoRefreshToken: false
                        },
                        realtime: {
                            params: {
                                eventsPerSecond: 10
                            }
                        },
                        global: {
                            headers: {
                                'X-Client-Info': 'family-messaging-client'
                            }
                        }
                    }
                );
                console.log(`[Family] Created global Supabase singleton client`);
            }
        } else {
            console.log(`[Family] Using existing global Supabase singleton client`);
        }

        // Assign the singleton to our ref
        supabaseRef.current = window.__SUPABASE_SINGLETON_CLIENT as SupabaseClient<Database>;

        return () => {
            // We don't destroy the singleton client on unmount
            console.log("[Family] Component unmounting, Supabase client reference will be cleaned up");
        };
    }, [ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY]);

    // Variable to track cleanup state - use ref for stability across renders
    const isCleaningUpRef = useRef(false);

    // Set up subscription using singleton client
    useEffect(() => {
        // Reset cleaning up state on mount
        isCleaningUpRef.current = false;

        const supabase = supabaseRef.current;
        let channel: ReturnType<SupabaseClient<Database>['channel']> | null = null;
        let isMounted = true; // Flag to track if component is mounted

        // Define channelName at the top level for use throughout the effect and cleanup
        let channelName: string | null = null;
        if (conversation?.id) {
            channelName = `family-messages:${conversation.id}`;
        }

        // We're now using the singleton client from the previous useEffect

        console.log(`[Family] useEffect run. Conversation ID: ${conversation?.id}, Supabase Client: ${supabase ? 'obtained' : 'null'}`);

        // Early return if any required data is missing
        if (!conversation?.id || !supabase || !channelName) {
            console.log("[Family] Skipping subscription: conversation ID or Supabase client missing.");
            return;
        }

        // Check if we're already subscribed to this specific channel
        if (channelSubscriptionRef.current[channelName]) {
            console.log(`[Family] Already subscribed to channel ${channelName}, skipping setup.`);
            return;
        }

        // Mark this channel as being set up to prevent race conditions
        // This prevents multiple setup attempts while async operations are in progress
        channelSubscriptionRef.current[channelName] = true;

        console.log(`[Family] Attempting to set up channel: ${channelName}`);

        // Define a function to create and set up the channel
        const setupChannel = async () => {
            console.log(`[Family] Setting up channel: ${channelName}`);
            try {
                // If cleanup started while we were waiting, abort setup
                if (isCleaningUpRef.current) {
                    console.log(`[Family] Cleanup started during setup, aborting channel creation for ${channelName}`);
                    return;
                }

                // Create the channel with configuration options
                channel = supabase.channel(channelName, {
                    config: {
                        broadcast: { self: true },
                        presence: { key: userId || 'anonymous' },
                    }
                });
                console.log(`[Family] Created channel: ${channelName} with reconnection options`);

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

                        console.log('[Family] New message payload received:', payload.new);
                        const rawNewMessage = payload.new as Tables<'messages'>;
                        let fetchedProfile: SenderProfile | null = null;

                        // First check if we already have the profile in our cache
                        if (rawNewMessage.sender_id) {
                            const cachedProfile = profilesMapRef.current.get(rawNewMessage.sender_id);
                            if (cachedProfile) {
                                console.log(`[Family] Using cached profile for sender ID: ${rawNewMessage.sender_id}`);
                                fetchedProfile = cachedProfile;
                            } else {
                                console.log(`[Family] No cached profile found for sender ID: ${rawNewMessage.sender_id}`);

                                // Look for the sender's profile in existing messages
                                console.log(`[Family] Searching for profile in existing messages for sender ID: ${rawNewMessage.sender_id}`);
                                const existingMessage = messages.find(msg => 
                                    msg.sender_id === rawNewMessage.sender_id && msg.senderProfile
                                );

                                if (existingMessage && existingMessage.senderProfile) {
                                    console.log(`[Family] Found profile in existing messages for sender ID: ${rawNewMessage.sender_id}`);
                                    fetchedProfile = existingMessage.senderProfile;

                                    // Add to our cache for future use
                                    profilesMapRef.current.set(rawNewMessage.sender_id, fetchedProfile);
                                } else {
                                    console.log(`[Family] No profile found in existing messages for sender ID: ${rawNewMessage.sender_id}`);

                                    // Only attempt to fetch from Supabase if we have a client and sender_id
                                    // This will likely fail due to CSP, but we'll try anyway as a fallback
                                    if (supabase) {
                                        try {
                                            console.log(`[Family] Attempting to fetch profile for sender ID: ${rawNewMessage.sender_id}`);
                                            const { data: profileData, error: profileError } = await supabase
                                                .from('profiles')
                                                .select('id, email, first_name, last_name')
                                                .eq('id', rawNewMessage.sender_id)
                                                .maybeSingle();

                                            if (profileError) {
                                                console.error("[Family] Error fetching profile for realtime message:", profileError.message);
                                            } else if (profileData) {
                                                console.log("[Family] Successfully fetched profile:", profileData);
                                                fetchedProfile = profileData as SenderProfile;

                                                // Add to our cache for future use
                                                profilesMapRef.current.set(rawNewMessage.sender_id, fetchedProfile);
                                            } else {
                                                console.log("[Family] Profile not found for sender ID:", rawNewMessage.sender_id);
                                            }
                                        } catch (error) {
                                            console.error("[Family] Exception during profile fetch:", error);
                                        }
                                    } else {
                                        console.log("[Family] Skipping profile fetch: supabase client missing.");
                                    }
                                }
                            }
                        } else {
                            console.log("[Family] Skipping profile fetch: sender_id missing.");
                        }

                        // We used to skip state updates during cleanup, but this caused messages to be lost
                        // Now we'll log a warning but still process the message
                        if (isCleaningUpRef.current || !isMounted) {
                            console.log(`Warning: Processing message during ${isCleaningUpRef.current ? 'cleanup' : 'unmounted state'}, but will still update state`);
                        }

                        // Create the new message with profile data (or fallback)
                        const newMessage: MessageWithSender = {
                            ...rawNewMessage,
                            senderProfile: fetchedProfile || {
                                id: rawNewMessage.sender_id || 'unknown',
                                email: '',
                                first_name: null,
                                last_name: null
                            }
                        };
                        console.log("[Family] Adding new message to state:", newMessage);
                        setMessages(currentMessages => [...currentMessages, newMessage]);
                    }
                );

                // Subscribe to the channel
                console.log(`[Family] Subscribing to channel: ${channelName}`);
                channel.subscribe((status: REALTIME_SUBSCRIBE_STATES, err) => {
                    console.log(`[Family] Channel status: ${status}, error: ${err}`);
                    // We used to skip processing if cleanup is in progress, but this could cause issues
                    // Now we'll log a warning but still process the status update
                    if (isCleaningUpRef.current) {
                        console.log('Warning: Received channel status update during cleanup, but will still process it');
                    }

                    console.log(`[Family Channel: ${channelName}] Status: ${status}`, err || '');

                    if (status === 'SUBSCRIBED') {
                        console.log(`[Family] Successfully subscribed to messages channel: ${channelName}`);
                        // Keep track of subscription status in the ref
                        hasSubscribedRef.current = true;
                    }

                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        console.error(`[Family Channel: ${channelName}] Issue: ${status}`, err);
                        // Mark channel as unsubscribed on error
                        hasSubscribedRef.current = false;
                        if (channelName) {
                            channelSubscriptionRef.current[channelName] = false;
                        }
                    }
                });

            } catch (error) {
                console.error(`[Family] Error setting up channel ${channelName}:`, error);
                hasSubscribedRef.current = false;
                channelSubscriptionRef.current[channelName] = false;
            }
        };

        // First remove any existing channel with this name
        const cleanupExistingChannel = async () => {
            console.log(`[Family] starting cleanupExistingChannel`);
            try {
                // Create a temporary channel reference just for removal
                const tempChannel = supabase.channel(channelName);
                await supabase.removeChannel(tempChannel);
                console.log(`[Family] Pre-emptively removed any existing channel: ${channelName}`);

                // If cleanup started while we were waiting, don't proceed to setup
                if (!isCleaningUpRef.current) {
                    await setupChannel();
                } else {
                    console.log(`[Family] Cleanup started during pre-emptive removal, aborting channel creation for ${channelName}`);
                }
            } catch (error) {
                console.error(`[Family] Error during pre-emptive removal of channel ${channelName}:`, error);
                channelSubscriptionRef.current[channelName] = false;
            }
        };

        // Start the cleanup and setup process
        console.log(`[Family] Starting cleanup and setup for channel: ${channelName}`);
        cleanupExistingChannel();

        // Capture the ref's current value for the cleanup function
        const currentChannelSubscriptionRef = channelSubscriptionRef.current;

        // Cleanup function
        return () => {
            isCleaningUpRef.current = true;
            isMounted = false;
            console.log(`[Family] Cleaning up channel: ${channelName}`);

            const cleanup = async () => {
                if (channel && supabase) {
                    try {
                        // First unsubscribe from the channel
                        channel.unsubscribe();
                        console.log(`[Family] Unsubscribed from messages channel: ${channelName}`);

                        // Then remove the channel
                        const status = await supabase.removeChannel(channel);
                        console.log(`[Family] Channel removal status: ${status}`);

                        // Clear the subscription tracking using the captured value
                        if (channelName) {
                            currentChannelSubscriptionRef[channelName] = false;
                        }
                    } catch (error) {
                        console.error("[Family] Error removing channel:", error);
                    }
                }
            };

            // Execute cleanup immediately
            cleanup();
        };
    // Dependencies: Only re-run if conversation ID, userId, or ENV vars change.
    }, [messages, conversation?.id, userId, ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY]);

    // Update messages state if loader data changes (e.g., after navigation)
    // Also populate the profiles map with profiles from initial messages
    useEffect(() => {
        setMessages(initialMessages);

        // Populate the profiles map with profiles from initial messages
        const newProfilesMap = new Map<string, SenderProfile>();
        initialMessages.forEach(message => {
            if (message.senderProfile && message.sender_id) {
                newProfilesMap.set(message.sender_id, message.senderProfile);
            }
        });
        profilesMapRef.current = newProfilesMap;
        console.log(`[Family] Cached ${newProfilesMap.size} profiles from initial messages`);
    }, [initialMessages]);


    if (error) {
        return <div className="text-red-500 p-4">Error: {error}</div>;
    }

    if (!conversation) {
        return <div className="p-4">Conversation not found.</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8 h-[calc(100vh-var(--header-height)-var(--footer-height)-2rem)] flex flex-col"> {/* Adjust height calculation */}
            <div className="flex items-center mb-4">
                <Button variant="ghost" size="icon" asChild className="mr-2">
                    <Link to="/family/messages" aria-label="Back to messages">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold">{conversation.subject || 'Conversation'}</h1>
            </div>

            {/* Message Display Area */}
            <MessageView messages={messages} currentUserId={userId} />

            {/* Message Input Area */}
            <MessageInput fetcher={fetcher} />
            {fetcher.data?.error && (
                <p className="text-red-500 text-sm mt-2">{fetcher.data.error}</p>
            )}
        </div>
    );
}
