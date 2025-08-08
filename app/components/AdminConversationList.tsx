import { Link } from "@remix-run/react";
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { Database } from "~/types/database.types"; // Adjust path if necessary
import { ClientOnly } from "~/components/client-only"; // Adjust path if necessary
import { cn } from "~/lib/utils"; // Import cn utility

// Define the expected shape based on the return type of get_admin_conversation_summaries
// It's best practice to use the generated type if available and accurate.
export type AdminConversationSummary =
    Database["public"]["Functions"]["get_admin_conversation_summaries"]["Returns"][number];

// Define props for the component
interface AdminConversationListProps {
    conversations: AdminConversationSummary[];
    basePath: string; // e.g., "/admin/messages"
}

/**
 * Renders a list of conversations for the admin view.
 * Uses a background/border highlight to indicate conversations unread by any admin.
 */
export default function AdminConversationList({ conversations, basePath }: AdminConversationListProps) {

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
            {conversations.length === 0 ? (
                <div className="text-center py-8 px-6">
                    <p className="text-gray-500 dark:text-gray-400">No conversations found.</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {conversations.map((conversation) => (
                        <Link
                            key={conversation.id}
                            to={`${basePath}/${conversation.id}`}
                            className={cn(
                                "block p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700",
                                conversation.is_unread_by_admin
                                    ? "bg-blue-50 dark:bg-blue-900/20"
                                    : ""
                            )}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h3 className={cn(
                                        "text-lg font-medium",
                                        conversation.is_unread_by_admin
                                            ? "text-blue-900 dark:text-blue-100"
                                            : "text-gray-900 dark:text-white"
                                    )}>
                                        {conversation.subject || "No Subject"}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                        Participants: {conversation.participant_display_names}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <ClientOnly fallback={<span className="text-sm text-gray-500">Loading...</span>}>
                                        {() => (
                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                                {formatDistanceToNow(parseISO(conversation.last_message_at), { addSuffix: true })}
                                            </span>
                                        )}
                                    </ClientOnly>
                                    {conversation.is_unread_by_admin && (
                                        <div className="mt-1">
                                            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
