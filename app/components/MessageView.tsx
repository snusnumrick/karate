import {useEffect, useRef} from 'react';
import {Tables} from "~/types/database.types"; // Import Database for SupabaseClient type hint
import {format} from 'date-fns';
import {cn} from '~/lib/utils'; // For conditional classes

// Add global type declaration for the profile logging tracker
declare global {
    interface Window {
        __LOGGED_MISSING_PROFILES?: Record<string, boolean>;
    }
}

// Define Profile type for sender details
export type SenderProfile = Pick<Tables<'profiles'>, 'id' | 'email' | 'first_name' | 'last_name'>;

// Define Message type matching the loader in $conversationId.tsx
export type MessageWithSender = Tables<'messages'> & {
    senderProfile: SenderProfile | null; // Nested profile data
};


interface MessageViewProps {
    messages: MessageWithSender[];
    currentUserId: string | null;
}

export default function MessageView({messages, currentUserId}: MessageViewProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for scrolling

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
    }, [messages]);

    return (
        <div
            className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900 rounded-md mb-4 border border-gray-200 dark:border-gray-700">
            {messages.map((message) => {
                // Check the original sender_id UUID against the current user ID
                const isCurrentUser = message.sender_id === currentUserId;
                const senderProfile = message.senderProfile; // Get the nested profile object

                // Construct sender display name (First Last, fallback to email, fallback to Unknown)
                let senderDisplay = 'Unknown User';
                if (senderProfile) {
                    if (senderProfile.first_name && senderProfile.last_name) {
                        senderDisplay = `${senderProfile.first_name} ${senderProfile.last_name}`;
                    } else if (senderProfile.email) {
                        senderDisplay = senderProfile.email;
                    } else if (senderProfile.id) {
                        // If we have a profile but no name or email, show the ID as a last resort
                        senderDisplay = `User ${senderProfile.id.substring(0, 8)}...`;
                    }
                } else if (message.sender_id) {
                    // If we have a sender_id but no profile, use the ID directly
                    senderDisplay = `User ${message.sender_id.substring(0, 8)}...`;
                    // Log this once to avoid console spam
                    if (!window.__LOGGED_MISSING_PROFILES) {
                        window.__LOGGED_MISSING_PROFILES = {};
                    }
                    if (!window.__LOGGED_MISSING_PROFILES[message.sender_id]) {
                        console.warn(`Message from ${message.sender_id} has no profile data`);
                        window.__LOGGED_MISSING_PROFILES[message.sender_id] = true;
                    }
                }

                return (
                    <div
                        key={message.id}
                        className={cn(
                            "flex flex-col",
                            isCurrentUser ? "items-end" : "items-start"
                        )}
                    >
                        <div
                            className={cn(
                                "max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg shadow-sm",
                                isCurrentUser
                                    ? "bg-green-100 dark:bg-green-800 text-green-900 dark:text-green-100"
                                    : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            )}
                        >
                            <p className="text-sm">{message.content}</p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
                            {isCurrentUser ? "You" : senderDisplay} - {format(new Date(message.created_at), 'p, MMM d')}
                        </p>
                    </div>
                );
            })}
            {/* Empty div to mark the end of messages for scrolling */}
            <div ref={messagesEndRef}/>
        </div>
    );
}
