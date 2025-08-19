import {useEffect, useRef, useState} from "react";
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, type TypedResponse} from "@remix-run/node";
import {Link, useFetcher, useLoaderData} from "@remix-run/react";
import {getSupabaseServerClient, getSupabaseAdminClient} from "~/utils/supabase.server";
import {Database, Tables} from "~/types/database.types";
import MessageView, {MessageWithSender, SenderProfile} from "~/components/MessageView";
import MessageInput from "~/components/MessageInput";
import {Button} from "~/components/ui/button";
import {AlertCircle} from "lucide-react";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import { type SupabaseClient } from "@supabase/supabase-js";
import { notificationService } from "~/utils/notifications.client";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { getSupabaseClient } from "~/utils/supabase.client";

// Define Conversation details type
type ConversationDetails = Tables<'conversations'> & {
    participant_display_names: string | null; // Comma-separated names of family participants
};

type ProfileWithFamily = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    role: string | null;
    family_id: string | null;
    families: { name: string } | null;
};

interface LoaderData {
    conversation: ConversationDetails | null; // Updated type
    messages: MessageWithSender[];
    error?: string;
    userId: string | null; // Pass current user ID for message alignment
    userFirstName: string | null;
    userLastName: string | null;
    ENV: { // Pass environment variables needed by client
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
        // DO NOT PASS SERVICE ROLE KEY TO CLIENT
    };
    accessToken: string | null; // Pass the access token for client-side auth
    refreshToken: string | null;
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
    const accessToken = session?.access_token ?? null;
    const refreshToken = session?.refresh_token ?? null;
    const conversationId = params.conversationId;
    
    // Debug logging
    console.log("[AdminConversationView Loader] URL:", request.url);
    console.log("[AdminConversationView Loader] Params:", params);
    console.log("[AdminConversationView Loader] ConversationId:", conversationId);

    if (!user || !accessToken) { // Check for user and token
        return json({
            conversation: null,
            messages: [],
            error: "User not authenticated",
            userId: null,
            userFirstName: null,
            userLastName: null,
            ENV,
            accessToken: null,
            refreshToken: null
        }, {status: 401, headers});
    }
    if (!conversationId || conversationId === 'undefined') {
        console.error("[AdminConversationView Loader] Invalid conversationId:", conversationId);
        return json({
            conversation: null,
            messages: [],
            error: "Invalid conversation ID",
            userId: user.id,
            userFirstName: null,
            userLastName: null,
            ENV,
            accessToken,
            refreshToken
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
            userFirstName: null,
            userLastName: null,
            ENV,
            accessToken,
            refreshToken
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
        console.error("Error checking admin participation or conversation not found:", {
            conversationId,
            error: participantError?.message,
            participantCheck
        });
        // It's possible an admin tries to access a conversation they aren't part of (e.g., if created differently later)
        return json({
            conversation: null,
            messages: [],
            error: `Access denied or conversation not found. ConversationId: ${conversationId}`,
            userId: user.id,
            userFirstName: null,
            userLastName: null,
            ENV,
            accessToken,
            refreshToken
        }, {status: 403, headers});
    }

    // --- Mark conversation as read BEFORE fetching messages ---
    // Call the RPC function to update last_read_at for this user/conversation
    // We use supabaseServer which has the user's context, and the function is SECURITY INVOKER
    const { error: markReadError } = await supabaseServer.rpc('mark_conversation_as_read', {
        p_conversation_id: conversationId,
        p_user_id: user.id, // The current admin/instructor user
    });

    if (markReadError) {
        // Log the error but don't fail the whole loader
        console.error(`Error marking conversation ${conversationId} as read for admin ${user.id}:`, markReadError.message);
    } else {
        console.log(`Successfully marked conversation ${conversationId} as read for admin ${user.id}`);
    }
    // --- End mark as read ---


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
            userFirstName: null,
            userLastName: null,
            ENV,
            accessToken,
            refreshToken
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
            userFirstName: null,
            userLastName: null,
            ENV,
            accessToken,
            refreshToken
        }, {status: 500, headers});
    }

    // Step 3: Get all unique user IDs
    const userIds = participants.map(p => p.user_id);

    // Create an admin client directly using environment variables on the server
    // to ensure service_role privileges for fetching profiles and families
    const supabaseAdmin = getSupabaseAdminClient();
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
            userFirstName: null,
            userLastName: null,
            ENV,
            accessToken,
            refreshToken
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
        .map((profile: ProfileWithFamily) => {
            if (profile.families?.name) return profile.families.name;
            if (profile.first_name && profile.last_name) return `${profile.first_name} ${profile.last_name}`;
            return `User ${profile.id.substring(0, 6)}`; // Fallback
        })
        .filter((name: string, index: number, self: string[]) => name && self.indexOf(name) === index) // Unique names
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
            userFirstName: null,
            userLastName: null,
            ENV,
            accessToken,
            refreshToken
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

    const {data: userName} = await supabaseServer
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();
    console.log("[AdminConversationView Loader] User name:", userName);

    return json({
        conversation: processedConversation, // Pass processed conversation
        messages: messages,
        userId: user.id,
        userFirstName: userName?.first_name ?? null,
        userLastName: userName?.last_name ?? null,
        ENV,
        accessToken, // Pass token to client
        refreshToken
    }, {headers});
}

// --- Action ---
export async function action({request, params}: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();
    const conversationId = params.conversationId;
    const url = new URL(request.url);

    // --- START: MODIFIED LOGIC ---
    // Handle both JSON (from quick reply) and FormData (from web form)
    let content: string | null = null;
    const contentType = request.headers.get("Content-Type");

    if (contentType && contentType.includes("application/json")) {
        const jsonPayload = await request.json();
        content = jsonPayload.content;
    } else {
        const formData = await request.formData();
        content = formData.get("content") as string;
    }
    // --- END: MODIFIED LOGIC ---

    if (!user) {
        return json({error: "User not authenticated"}, {status: 401, headers});
    }
    if (!conversationId) {
        return json({error: "Conversation ID missing"}, {status: 400, headers});
    }
    if (!content || content.trim().length === 0) {
        return json({error: "Message content cannot be empty"}, {status: 400, headers});
    }

    // --- The rest of your action function remains the same ---

    // Verify user is admin/instructor AND a participant before allowing send
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

    const {data: profileCheck, error: profileError} = await supabaseServer
        .from('profiles')
        .select('role, first_name, last_name')
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
    const {data: newMessage, error: insertError} = await supabaseServer
        .from('messages')
        .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: content.trim(),
        })
        .select()
        .single();

    if (insertError) {
        console.error("Error sending admin message:", insertError.message);
        return json({error: "Failed to send message."}, {status: 500, headers});
    }

    // The push notification logic for notifying families...
    try {
        const {data: otherParticipants} = await supabaseServer
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversationId)
            .neq('user_id', user.id);

        if (otherParticipants && otherParticipants.length > 0) {
            let senderName = profileCheck?.role === 'admin' ? 'Admin' : 'Instructor';
            if (profileCheck?.first_name) {
                senderName = `${profileCheck.first_name} ${profileCheck.last_name || ''}`.trim();
            }

            const {
                sendPushNotificationToMultiple,
                createMessageNotificationPayload
            } = await import('~/utils/push-notifications.server');

            const recipientIds = otherParticipants.map(p => p.user_id);
            const {data: pushSubscriptions} = await supabaseServer
                .from('push_subscriptions')
                .select('endpoint, p256dh, auth, user_id')
                .in('user_id', recipientIds);

            if (pushSubscriptions && pushSubscriptions.length > 0) {
                for (const subscription of pushSubscriptions) {
                    const payload = createMessageNotificationPayload(
                        senderName,
                        content.trim(),
                        conversationId,
                        newMessage.id,
                        `${url.origin}/family/messages/${conversationId}`,
                        subscription.user_id
                    );

                    const subscriptionData = {
                        endpoint: subscription.endpoint,
                        keys: { p256dh: subscription.p256dh, auth: subscription.auth }
                    };

                    await sendPushNotificationToMultiple([subscriptionData], payload);
                }
            }
        }
    } catch (error) {
        console.error('Error sending push notifications:', error);
    }


    return json({success: true}, {headers});
}

// --- Component ---
export default function AdminConversationView() {
    const {conversation, messages: initialMessages, userId, error, ENV, accessToken, refreshToken} = useLoaderData<typeof loader>();
    const fetcher = useFetcher<ActionData>();
    const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);
    const messageInputRef = useRef<HTMLTextAreaElement>(null); // Ref for the message input
    const hasSubscribedRef = useRef(false); // Ref to track subscription status
    // Use a more specific ref to track channel subscription by conversation ID
    const channelSubscriptionRef = useRef<{ [key: string]: boolean }>({});
    // Create a stable client ID to avoid multiple instances
    // const clientId = useRef(`admin-messages-${Math.random().toString(36).substring(2, 9)}`);

    // Single Supabase client instance with memoization
    const supabaseRef = useRef<SupabaseClient<Database> | null>(null); // Use the correct SupabaseClient type

    // Initialize the Supabase client only once - use a static client for the entire app
    useEffect(() => {
        if (ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY) {
            const client = getSupabaseClient({
                url: ENV.SUPABASE_URL,
                anonKey: ENV.SUPABASE_ANON_KEY,
                accessToken: accessToken ?? undefined,
                refreshToken: refreshToken ?? undefined,
                clientInfo: 'admin-messaging-client'
            });

            // Assign the singleton to our ref
            supabaseRef.current = client;
        } else {
            console.error("[Admin] Missing SUPABASE_URL or SUPABASE_ANON_KEY for client initialization.");
        }

        return () => {
            // We don't destroy the singleton client on unmount
            console.log("[Admin] Component unmounting, Supabase client reference will be cleaned up");
        };
        // Re-run if ENV vars or accessToken change
    }, [ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, accessToken, refreshToken]);

    // Variable to track cleanup state - use ref for stability across renders
    const isCleaningUpRef = useRef(false);

    // Set up subscription using singleton client
    useEffect(() => {
        // Reset cleaning up state on mount
        isCleaningUpRef.current = false;

        const supabase = supabaseRef.current;
        let channel: ReturnType<SupabaseClient<Database>['channel']> | null = null;
        const channelName = conversation?.id ? `conversation-messages:${conversation.id}` : null; // Standardized channel name
        console.log(`[Admin Subscription Effect] Run. ConvID: ${conversation?.id}, Client: ${supabase ? 'OK' : 'NULL'}, ChannelName: ${channelName}`);

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
                console.log(`[Admin] Attaching 'postgres_changes' listener to channel: ${channelName}`); // Added log
                channel?.on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `conversation_id=eq.${conversation.id}`
                    },
                    async (payload) => {
                        console.log('[Admin Subscription Callback] Received payload:', payload);

                        if (isCleaningUpRef.current) {
                            console.warn('[Admin Subscription Callback] Warning: Received message during cleanup, processing anyway.');
                        }
                        // REMOVED isMounted check - let React handle updates to unmounted components if necessary

                        console.log('[Admin Subscription Callback] Processing new message:', payload.new);
                        const rawNewMessage = payload.new as Tables<'messages'>;

                        // Create the new message object with a basic sender profile placeholder.
                        // The full profile will be loaded on subsequent page loads/revalidations.
                        const newMessage: MessageWithSender = {
                            ...rawNewMessage,
                            senderProfile: {
                                id: rawNewMessage.sender_id || 'unknown', // Use sender ID if available
                                email: '', // Don't assume email is available
                                first_name: null, // Placeholder
                                last_name: null // Placeholder
                            }
                        };

                        console.log("[Admin Subscription Callback] Adding new message to state:", newMessage);

                        setMessages(currentMessages => {
                            // Avoid adding duplicates
                            if (currentMessages.some(msg => msg.id === newMessage.id)) {
                                console.log(`[Admin Subscription Callback] Message ID ${newMessage.id} already exists in state, skipping add.`);
                                return currentMessages;
                            }
                            console.log(`[Admin Subscription Callback] Appending message ID ${newMessage.id} to state.`);
                            return [...currentMessages, newMessage];
                        });

                        // --- Show notification for incoming messages (only if not from current user) ---
                        if (rawNewMessage.sender_id !== userId && typeof window !== 'undefined') {

                            // Find the sender's profile from the existing messages list to get their name.
                            let senderName = 'Family Member'; // Default name

                            // The 'messages' state variable contains the profiles from the initial load.
                            const messageWithProfile = messages.find(msg =>
                                msg.sender_id === rawNewMessage.sender_id && msg.senderProfile
                            );

                            if (messageWithProfile && messageWithProfile.senderProfile) {
                                const profile = messageWithProfile.senderProfile;
                                const firstName = profile.first_name;
                                const lastName = profile.last_name;

                                if (firstName && lastName) {
                                    senderName = `${firstName} ${lastName}`;
                                } else if (firstName) {
                                    senderName = firstName;
                                } else if (lastName) {
                                    senderName = lastName;
                                }
                                // If no name, it will default to 'Family Member'
                            }

                            // Only show notification if we have a valid conversation ID
                            if (conversation?.id) {
                                await notificationService.showMessageNotification({
                                    conversationId: conversation.id,
                                    senderId: rawNewMessage.sender_id,
                                    senderName: senderName, // Use the dynamically found name
                                    messageContent: rawNewMessage.content || 'New message',
                                    timestamp: rawNewMessage.created_at || new Date().toISOString()
                                });
                            } else {
                                console.warn('[Admin] Skipping notification: conversation.id is undefined');
                            }
                        }

                        // --- Mark conversation as read immediately since admin is viewing it ---
                        if (supabase && userId && conversation?.id && !isCleaningUpRef.current) {
                            console.log(`[Admin] New message received while viewing. Marking conversation ${conversation.id} as read for user ${userId}.`);
                            supabase.rpc('mark_conversation_as_read', {
                                p_conversation_id: conversation.id,
                                p_user_id: userId,
                            }).then(({ error: markReadError }: { error: Error | null }) => {
                                if (markReadError) {
                                    console.error(`[Admin] Error marking conversation ${conversation.id} as read via RPC after realtime message:`, markReadError.message);
                                } else {
                                    console.log(`[Admin] Successfully marked conversation ${conversation.id} as read via RPC after realtime message.`);
                                    // Optionally, trigger a revalidation of the parent list if needed,
                                    // though simply preventing the unread state might be sufficient.
                                    // revalidator.revalidate(); // Consider if this is necessary
                                }
                            });
                        } else {
                            console.log("[Admin] Skipping immediate mark-as-read (missing supabase, userId, conversationId, or cleaning up).");
                        }
                        // --- End immediate mark as read ---
                    }
                );

                // Subscribe to the channel
                console.log(`[Admin Subscription Effect] Attempting to subscribe to channel: ${channelName}`);
                channel?.subscribe((status, err) => {
                    // Log all status changes, including potential errors
                    // console.log(`[Admin Subscription Status Callback] Channel: ${channelName}, Status: ${status}`, err || ''); // Redundant log

                    if (isCleaningUpRef.current) {
                        console.warn(`[Admin Subscription Status Callback] Warning: Received status '${status}' during cleanup.`); // Renamed log
                        // Potentially stop processing further if status indicates closure/error during cleanup
                        if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                           console.log(`[Admin Subscription Status Callback] Acknowledged final status '${status}' during cleanup.`); // Renamed log
                           return;
                        }
                    }

                    // Renamed logs for clarity
                    switch (status) {
                        case 'SUBSCRIBED':
                            console.log(`[Admin Subscription Status Callback] Successfully SUBSCRIBED to channel: ${channelName}`);
                            hasSubscribedRef.current = true;
                            // Ensure tracking ref is correct
                            channelSubscriptionRef.current[channelName] = true;
                            break;
                        case 'CHANNEL_ERROR':
                            // Log the actual error object for more details
                            console.error(`[Admin Subscription Status Callback] CHANNEL_ERROR on channel ${channelName}:`, err);
                            hasSubscribedRef.current = false;
                            channelSubscriptionRef.current[channelName] = false;
                            // Consider adding retry logic or user notification here
                            break;
                        case 'TIMED_OUT':
                            console.warn(`[Admin Subscription Status Callback] TIMED_OUT on channel ${channelName}. Retrying may happen automatically.`);
                            hasSubscribedRef.current = false;
                            channelSubscriptionRef.current[channelName] = false;
                            break;
                        case 'CLOSED':
                            console.log(`[Admin Subscription Status Callback] Channel ${channelName} CLOSED.`);
                            hasSubscribedRef.current = false;
                            // Only clear the tracking ref if not during intentional cleanup
                            if (!isCleaningUpRef.current && channelName) {
                                channelSubscriptionRef.current[channelName] = false;
                            }
                            break;
                        default:
                            console.log(`[Admin Subscription Status Callback] Unhandled status: ${status}`);
                    }
                });

            } catch (error) {
                console.error(`[Admin] Error setting up channel ${channelName}:`, error);
                hasSubscribedRef.current = false;
                channelSubscriptionRef.current[channelName] = false;
            }
        };

        // Start the setup process: First try to remove existing, then setup.
        console.log(`[Admin] Starting setup process for channel: ${channelName}`);

        const setupProcess = async () => {
            // 1. Log Auth State (Async)
            await logAuthState();

            // 2. Setup Channel (if not cleaning up)
            if (!isCleaningUpRef.current) {
                await setupChannel(); // Call the main setup function
            } else {
                console.log(`[Admin] Cleanup started during setupProcess, aborting setupChannel call for ${channelName}`);
            }
        };


        // Asynchronously log client auth state for debugging purposes.
        // This helps verify the client-side Supabase instance's authentication
        // state immediately before attempting to establish the real-time channel.
        const logAuthState = async () => {
            if (supabase) {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const sessionUser = session?.user;
                    console.log(`[Admin] Client auth state before setupChannel: User ID = ${sessionUser?.id ?? 'N/A'}`);
                } catch (error) {
                    console.error("[Admin] Error getting session for auth state log:", error);
                }
            } else {
                console.log("[Admin] Cannot log auth state: Supabase client not available yet.");
            }
            // Logging finished (or failed)
        };

        // Execute the async setup process.
        // We define an async function within useEffect and call it immediately,
        // as the useEffect hook itself cannot be async.
        setupProcess();

        // Capture the ref's current value for the cleanup function
        const currentChannelSubscriptionRef = channelSubscriptionRef.current;

        // Cleanup function
        return () => {
            isCleaningUpRef.current = true;
            console.log(`[Admin] Cleaning up channel: ${channelName}`);

            const cleanup = async () => {
                if (channel && supabase) {
                    try {
                        // First unsubscribe from the channel
                        await channel.unsubscribe();
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

            // Execute cleanup immediately when the effect dependencies change or component unmounts
            cleanup();
        };
        // Dependencies: Re-run only if the user or conversation changes.
        // The Supabase client should handle internal token refreshes for the subscription.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, conversation?.id]); // Ensure dependencies are minimal

    // Update messages state if loader data changes
    // Note: 'messages' is intentionally excluded from deps to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        setMessages(initialMessages);
    }, [initialMessages]);

    // Effect to focus the message input on mount
    useEffect(() => {
        // Use setTimeout to ensure focus occurs after rendering and potential layout shifts
        const timerId = setTimeout(() => {
            messageInputRef.current?.focus();
        }, 100); // Small delay can help ensure the element is ready

        return () => clearTimeout(timerId); // Cleanup timeout on unmount
    }, []); // Empty dependency array ensures this runs only once on mount


    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-6">
                        <AppBreadcrumb items={breadcrumbPatterns.adminMessages()} />
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-4">Error Loading Conversation</h1>
                    </div>
                    <Alert variant="destructive" className="mb-6">
                        <AlertCircle className="h-4 w-4"/>
                        <AlertTitle>Error Loading Conversation</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                        <Button variant="link" asChild className="mt-2">
                            <Link to="/admin/messages">Back to Messages</Link>
                        </Button>
                    </Alert>
                </div>
            </div>
        );
    }

    if (!conversation) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-6">
                        <AppBreadcrumb items={breadcrumbPatterns.adminMessages()} />
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-4">Conversation Not Found</h1>
                    </div>
                    <Alert variant="default" className="mb-6">
                        <AlertCircle className="h-4 w-4"/>
                        <AlertTitle>Not Found</AlertTitle>
                        <AlertDescription>Conversation not found.</AlertDescription>
                        <Button variant="link" asChild className="mt-2">
                            <Link to="/admin/messages">Back to Messages</Link>
                        </Button>
                    </Alert>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <AppBreadcrumb items={breadcrumbPatterns.adminMessageConversation(conversation.subject || undefined)} />
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-4">
                        {conversation.subject || 'Conversation'}
                    </h1>
                    {conversation.participant_display_names && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Participants: {conversation.participant_display_names}
                        </p>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <div className="flex flex-col h-[600px]">
                        <MessageView messages={messages} currentUserId={userId}/>
                        <MessageInput fetcher={fetcher} ref={messageInputRef} />
                        {fetcher.data?.error && (
                            <p className="text-destructive text-sm mt-2">{fetcher.data.error}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
