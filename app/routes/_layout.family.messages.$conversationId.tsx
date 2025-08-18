import {useEffect, useRef, useState} from "react";
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, type TypedResponse} from "@remix-run/node";
import {useFetcher, useLoaderData} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Database, Tables} from "~/types/database.types";
import MessageView from "~/components/MessageView";
import MessageInput from "~/components/MessageInput";
import { REALTIME_SUBSCRIBE_STATES, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { notificationService } from "~/utils/notifications.client";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { getSupabaseClient } from "~/utils/supabase.client";

// Define Profile type for sender details
type SenderProfile = Pick<Tables<'profiles'>, 'id' | 'email' | 'first_name' | 'last_name'>;

// Define Message type: Includes original message fields + nested sender profile
type MessageWithSender = Tables<'messages'> & {
    senderProfile: SenderProfile | null; // Nested profile data
};


// Define Conversation details type
type ConversationDetails = Tables<'conversations'> & {
    participant_display_names: string | null; // Comma-separated names of other participants
};

interface LoaderData {
    conversation: ConversationDetails | null; // Updated type
    messages: MessageWithSender[];
    error?: string;
    userId: string | null; // Pass current user ID for message alignment
    ENV: { // Pass environment variables needed by client
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
    };
    accessToken: string | null,
    refreshToken: string | null
}

export interface ActionData {
    success?: boolean;
    error?: string;
}

// Loader: Fetch conversation details and messages
export async function loader({request, params}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response: {headers}, ENV} = getSupabaseServerClient(request);
    const {data: {session}} = await supabaseServer.auth.getSession();
    const user = session?.user;
    const accessToken = session?.access_token ?? null;
    const refreshToken = session?.refresh_token ?? null;
    const conversationId = params.conversationId;

    const loaderData : LoaderData = {
        conversation: null,
        messages: [],
        userId: null,
        ENV,
        accessToken,
        refreshToken};

    if (!user) {
        loaderData.error = "User not authenticated";
        return json(loaderData, {status: 401, headers});
    }
    loaderData.userId = user.id;

    if (!conversationId || conversationId === 'undefined') {
        console.error("[FamilyConversationView Loader] Invalid conversationId:", conversationId);
        loaderData.error = "Invalid conversation ID";
        return json(loaderData, {status: 400, headers});
    }

    // Verify user is a participant in this conversation
    const {data: participantCheck, error: participantError} = await supabaseServer
        .from('conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();
    if (participantError || !participantCheck) {
        console.error("Error checking participant or user not participant:", participantError?.message);
        loaderData.error = "You do not have permission to view this conversation.";
        return json(loaderData, {status: 403, headers});
    }

    // --- Mark conversation as read BEFORE fetching messages ---
    // Call the RPC function to update last_read_at for this user/conversation
    // We use supabaseServer which has the user's context, and the function is SECURITY INVOKER
    const {error: markReadError} = await supabaseServer.rpc('mark_conversation_as_read', {
        p_conversation_id: conversationId,
        p_user_id: user.id,
    });

    if (markReadError) {
        // Log the error but don't fail the whole loader, just means unread count might not update immediately
        console.error(`Error marking conversation ${conversationId} as read for user ${user.id}:`, markReadError.message);
    } else {
        console.log(`Successfully marked conversation ${conversationId} as read for user ${user.id}`);
    }
    // --- End mark as read ---


    // Fetch conversation details
    const {data: conversationData, error: conversationError} = await supabaseServer
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

    if (conversationError || !conversationData) {
        console.error("Error fetching conversation:", conversationError?.message);
        loaderData.error = "Failed to load conversation details.";
        return json(loaderData, {status: conversationError ? 500 : 404, headers});
    }

    // Fetch participants for this conversation
    const {data: participants, error: participantsError} = await supabaseServer
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);
    console.log("[Fetch participants] for conversation:", conversationId,"Participants data:", participants);

    if (participantsError) {
        console.error("Error fetching participants:", participantsError.message);
        loaderData.error = "Failed to load conversation participants.";
        return json(loaderData, {status: 500, headers});
    }

    // Get all unique user IDs (excluding current user)
    const otherUserIds = participants
        .filter(p => p.user_id !== user.id)
        .map(p => p.user_id);

    // Fetch profiles for all other users
    const {data: profilesData, error: profilesError} = await supabaseServer
        .from('profiles')
        .select('id, first_name, last_name, role')
        .in('id', otherUserIds);

    if (profilesError) {
        console.error("Error fetching profiles:", profilesError.message);
        loaderData.error = "Failed to load user profiles.";
        return json(loaderData, {status: 500, headers});
    }

    // Process participant names
    console.log("[Process participant names] Profiles data:", profilesData);
    const otherParticipantNames = profilesData
        .map(profile => {
            if (profile.first_name && profile.last_name) {
                return `${profile.first_name} ${profile.last_name}`;
            }
            // Capitalize role if name is missing
            if (profile.role === 'admin' || profile.role === 'instructor') {
                return profile.role.charAt(0).toUpperCase() + profile.role.slice(1);
            }
            return 'Staff'; // Generic fallback
        })
        .filter(name => name)
        .join(', ');
    console.log("[Process participant names] Other participant names:", otherParticipantNames);

    const processedConversation: ConversationDetails = {
        ...conversationData,
        participant_display_names: otherParticipantNames || 'Staff',
    };
    console.log("[Process participant names] Processed conversation:", processedConversation);
    loaderData.conversation = processedConversation;

    // --- Fetch Messages (Step 1) ---
    const {data: rawMessagesData, error: messagesError} = await supabaseServer
        .from('messages')
        .select('*') // Select all message fields, including sender_id UUID
        .eq('conversation_id', conversationId)
        .order('created_at', {ascending: true});

    if (messagesError) {
        console.error("Error fetching messages:", messagesError.message);
        loaderData.error = "Failed to load messages.";
        return json(loaderData, {status: 500, headers});
    }

    const messagesWithoutProfiles = rawMessagesData ?? [];

    // --- Fetch Sender Profiles (Step 2) ---
    const senderIds = [...new Set(
        messagesWithoutProfiles.map(msg => msg.sender_id).filter(id => id !== null)
    )] as string[];

    const profilesMap: Map<string, SenderProfile> = new Map();
    if (senderIds.length > 0) {
        const {data: profilesData, error: profilesError} = await supabaseServer
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
    loaderData.messages = messagesWithoutProfiles.map(msg => ({
        ...msg,
        senderProfile: msg.sender_id ? profilesMap.get(msg.sender_id) ?? null : null
    }));


    // Remove conversation_participants from the final conversation object sent to client if not needed directly
    // delete (processedConversation as any).conversation_participants;

    return json(loaderData, {headers});
}

// Action: Send a new message
export async function action({request, params}: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();
    const conversationId = params.conversationId;
    const formData = await request.formData();
    const content = formData.get("content") as string;
    const url = new URL(request.url);

    if (!user) {
        return json({error: "User not authenticated"}, {status: 401, headers});
    }
    if (!conversationId || conversationId === 'undefined') {
        console.error("[FamilyConversationView Action] Invalid conversationId:", conversationId);
        return json({error: "Invalid conversation ID"}, {status: 400, headers});
    }
    if (!content || content.trim().length === 0) {
        return json({error: "Message content cannot be empty"}, {status: 400, headers});
    }

    // Verify user is a participant before allowing send
    const {data: participantCheck, error: participantError} = await supabaseServer
        .from('conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (participantError || !participantCheck) {
        console.error("Send Message Action: Error checking participant or user not participant:", participantError?.message);
        return json({error: "You do not have permission to send messages in this conversation."}, {
            status: 403,
            headers
        });
    }

    // Get sender profile for notification
    const {data: senderProfile, error: senderProfileError} = await supabaseServer
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

    console.log('Sender profile query result:', senderProfile);
    console.log('Sender profile query error:', senderProfileError);
    console.log('Sender user ID:', user.id);

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
        console.error("Error sending message:", insertError.message);
        return json({error: "Failed to send message."}, {status: 500, headers});
    }

    // Send push notifications to other participants
    try {
        // Create an admin client to bypass RLS ---
        const supabaseAdmin = getSupabaseAdminClient();

        // Get other participants in the conversation (excluding the sender)
        const {data: otherParticipants, error: participantsError} = await supabaseAdmin
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversationId)
            .neq('user_id', user.id);

        console.log('Family member sending message. Sender ID:', user.id);
        console.log('Conversation ID:', conversationId);
        console.log('Other participants query result:', otherParticipants);
        console.log('Participants query error:', participantsError);

        if (otherParticipants && otherParticipants.length > 0) {
            const senderName = senderProfile 
                ? `${senderProfile.first_name} ${senderProfile.last_name}`.trim()
                : 'Someone';

            console.log('Constructed sender name:', senderName);
            console.log('Sender profile data:', {
                first_name: senderProfile?.first_name,
                last_name: senderProfile?.last_name,
                full_constructed: senderName
            });

            // Import push notification utilities
            const { 
                sendPushNotificationToMultiple, 
                createMessageNotificationPayload 
            } = await import('~/utils/push-notifications.server');

            // Get push subscriptions for all other participants
            const recipientIds = otherParticipants.map(p => p.user_id);
            console.log('Looking for push subscriptions for participant IDs:', recipientIds);
            
            // Debug: Get user profiles for these participant IDs to see who they are
            const {data: participantProfiles, error: profilesError} = await supabaseAdmin
                .from('profiles')
                .select('id, first_name, last_name, role')
                .in('id', recipientIds);
            
            console.log('Participant profiles:', participantProfiles);
            console.log('Profiles query error:', profilesError);
            
            const {data: pushSubscriptions, error: pushSubscriptionsError} = await supabaseAdmin
                .from('push_subscriptions')
                .select('endpoint, p256dh, auth, user_id')
                .in('user_id', recipientIds);

            if (pushSubscriptionsError) {
                console.error('Error fetching push subscriptions:', pushSubscriptionsError);
            }

            console.log(`Found ${pushSubscriptions?.length || 0} push subscriptions for family messaging`);
            
            // Debug: Show which users have push subscriptions
            if (pushSubscriptions && pushSubscriptions.length > 0) {
                console.log('Push subscriptions by user:');
                pushSubscriptions.forEach(sub => {
                    const profile = participantProfiles?.find(p => p.id === sub.user_id);
                    console.log(`- User ${sub.user_id} (${profile?.first_name} ${profile?.last_name}, role: ${profile?.role}): ${sub.endpoint.substring(0, 50)}...`);
                });
            } else {
                console.log('No push subscriptions found. Checking if participants have any subscriptions at all...');
                // Check if any of the participants have push subscriptions (debugging)
                const {data: allUserSubs} = await supabaseAdmin
                    .from('push_subscriptions')
                    .select('user_id, endpoint')
                    .in('user_id', recipientIds);
                console.log('All subscriptions for these users:', allUserSubs);
            }

            if (pushSubscriptions && pushSubscriptions.length > 0) {
                console.log(`Sending push notifications to ${pushSubscriptions.length} family devices`);
                
                // Send notifications to each subscription with the correct recipient user ID
                for (const subscription of pushSubscriptions) {
                    const payload = createMessageNotificationPayload(
                        senderName,
                        content.trim(),
                        conversationId,
                        newMessage.id,
                        `${url.origin}/admin/messages/${conversationId}`, // Use correct admin URL
                        subscription.user_id // Pass the specific recipient's user ID for quick reply
                    );

                    console.log(`Creating push notification payload for user ${subscription.user_id}:`, payload);

                    const subscriptionData = {
                        endpoint: subscription.endpoint,
                        keys: {
                            p256dh: subscription.p256dh,
                            auth: subscription.auth
                        }
                    };

                    const result = await sendPushNotificationToMultiple([subscriptionData], payload);
                    console.log(`Push notification sent to user ${subscription.user_id}: ${result.successCount} success, ${result.failureCount} failures`);
                    
                    if (result.expiredCount > 0) {
                        console.log(`Cleaned up ${result.expiredCount} expired push subscriptions for user ${subscription.user_id}`);
                    }
                }
            } else {
                console.log('No push subscriptions found for conversation participants');
            }
        }
    } catch (error) {
        console.error('Error sending push notifications:', error);
        // Don't fail the message send if push notifications fail
    }

    // No need to redirect, fetcher handles UI update
    return json({success: true}, {headers});
}


export default function ConversationView() {
    const {
        conversation,
        messages: initialMessages,
        userId,
        error,
        ENV,
        accessToken,
        refreshToken
    } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<ActionData>();
    const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);
    const messageInputRef = useRef<HTMLTextAreaElement>(null); // Ref for the message input
    const hasSubscribedRef = useRef(false); // Ref to track subscription status

    // Use a more specific ref to track channel subscription by conversation ID
    const channelSubscriptionRef = useRef<{ [key: string]: boolean }>({});

    // Create a ref to store profiles from initial messages for reuse with new messages
    const profilesMapRef = useRef<Map<string, SenderProfile>>(new Map());

    // Store the Supabase client in a ref to avoid creating multiple instances
    const supabaseRef = useRef<SupabaseClient<Database> | null>(null);

    // Initialize the Supabase client only once - use a static client for the entire app
    useEffect(() => {
        if (ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY) {
            const client = getSupabaseClient({
                url: ENV.SUPABASE_URL,
                anonKey: ENV.SUPABASE_ANON_KEY,
                accessToken: accessToken ?? undefined,
                refreshToken: refreshToken ?? undefined,
                clientInfo: 'family-messaging-client'
            });

            // Assign the singleton to our ref
            supabaseRef.current = client;
        } else {
            console.error("[Family] Missing SUPABASE_URL or SUPABASE_ANON_KEY for client initialization.");
        }

        return () => {
            // We don't destroy the singleton client on unmount
            console.log("[Family] Component unmounting, Supabase client reference will be cleaned up");
        };
    }, [ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, accessToken, refreshToken]);

    // Variable to track cleanup state - use ref for stability across renders
    const isCleaningUpRef = useRef(false);

    // Set up subscription using singleton client
    useEffect(() => {
        // Reset cleaning up state on mount
        isCleaningUpRef.current = false;

        const supabase = supabaseRef.current;
        let channel: ReturnType<SupabaseClient<Database>['channel']> | null = null;
        // let isMounted = true; // REMOVED isMounted flag

        // Define channelName at the top level for use throughout the effect and cleanup
        let channelName: string | null = null;
        if (conversation?.id) {
            channelName = `conversation-messages:${conversation.id}`; // Standardized channel name
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
                        broadcast: {self: true},
                        presence: {key: userId || 'anonymous'},
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
                                            const {data: profileData, error: profileError} = await supabase
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
                        if (isCleaningUpRef.current) { // REMOVED !isMounted check
                            console.log(`Warning: Processing message during cleanup, but will still update state`);
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

                        // --- Show notification for incoming messages (only if not from current user) ---
                        if (rawNewMessage.sender_id !== userId && typeof window !== 'undefined') {
                            const senderName = fetchedProfile 
                                ? `${fetchedProfile.first_name || ''} ${fetchedProfile.last_name || ''}`.trim() || 'Someone'
                                : 'Someone';
                            
                            // Only show notification if we have a valid conversation ID
                            if (conversation?.id) {
                                await notificationService.showMessageNotification({
                                    conversationId: conversation.id,
                                    senderId: rawNewMessage.sender_id,
                                    senderName: senderName,
                                    messageContent: rawNewMessage.content || 'New message',
                                    timestamp: rawNewMessage.created_at || new Date().toISOString()
                                });
                            } else {
                                console.warn('[Family] Skipping notification: conversation.id is undefined');
                            }
                        }

                        // --- Mark conversation as read immediately since user is viewing it ---
                        if (supabase && userId && conversation?.id && !isCleaningUpRef.current) {
                            console.log(`[Family] New message received while viewing. Marking conversation ${conversation.id} as read for user ${userId}.`);
                            supabase.rpc('mark_conversation_as_read', {
                                p_conversation_id: conversation.id,
                                p_user_id: userId,
                            }).then(({ error: markReadError }) => {
                                if (markReadError) {
                                    console.error(`[Family] Error marking conversation ${conversation.id} as read via RPC after realtime message:`, markReadError.message);
                                } else {
                                    console.log(`[Family] Successfully marked conversation ${conversation.id} as read via RPC after realtime message.`);
                                    // Optionally, trigger a revalidation of the parent list if needed,
                                    // though simply preventing the unread state might be sufficient.
                                    // revalidator.revalidate(); // Consider if this is necessary
                                }
                            });
                        } else {
                            console.log("[Family] Skipping immediate mark-as-read (missing supabase, userId, conversationId, or cleaning up).");
                        }
                        // --- End immediate mark as read ---
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

        // Start the setup process directly
        console.log(`[Family] Starting setup for channel: ${channelName}`);
        setupChannel(); // Call setupChannel directly

        // Capture the ref's current value for the cleanup function
        const currentChannelSubscriptionRef = channelSubscriptionRef.current;

        // Cleanup function
        return () => {
            isCleaningUpRef.current = true;
            // isMounted = false; // REMOVED isMounted flag
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
        // Dependencies: Re-run only if the user or conversation changes.
    }, [messages, userId, conversation?.id]); // Ensure dependencies are minimal and match admin view

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

    // Effect to focus the message input on mount
    useEffect(() => {
        // Use setTimeout to ensure focus occurs after rendering and potential layout shifts
        const timerId = setTimeout(() => {
            messageInputRef.current?.focus();
        }, 100); // Small delay can help ensure the element is ready

        return () => clearTimeout(timerId); // Cleanup timeout on unmount
    }, []); // Empty dependency array ensures this runs only once on mount


    if (error) {
        return <div className="text-red-500 p-4">Error: {error}</div>;
    }

    if (!conversation) {
        return <div className="p-4">Conversation not found.</div>;
    }

    return (
        <div className="min-h-screen page-background-styles py-12 text-foreground">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <AppBreadcrumb 
                    items={breadcrumbPatterns.familyMessageConversation(conversation.subject || 'Conversation')} 
                    className="mb-6" 
                />

                {/* Page Header */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-extrabold page-header-styles sm:text-4xl">
                        {conversation.subject || 'Conversation'}
                    </h1>
                    {conversation.participant_display_names && (
                        <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                            Participants: {conversation.participant_display_names}
                        </p>
                    )}
                </div>

                <div className="form-container-styles p-8 backdrop-blur-lg">
                    <div className="flex flex-col h-[600px]">
                        <MessageView
                            messages={messages}
                            currentUserId={userId}
                        />
                        <MessageInput fetcher={fetcher} ref={messageInputRef} />
                        {fetcher.data?.error && (
                            <p className="text-red-500 text-sm mt-2">{fetcher.data.error}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
