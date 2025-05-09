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
    // Optional: Log for debugging
    // console.log(`[AdminConversationList] Rendering ${conversations.length} conversations.`);
    // console.log(conversations);

    if (!conversations || conversations.length === 0) {
        return <p className="p-4 text-gray-500 dark:text-gray-400">No conversations found.</p>;
    }

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {conversations.map((convo) => (
                    <li key={convo.id}
                        className={cn(
                            "transition-colors", // Base class for smooth hover
                            // Conditional classes for unread status
                            convo.is_unread_by_admin
                                ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 border-l-4 border-blue-500"
                                : "hover:bg-gray-50 dark:hover:bg-gray-700" // Default hover style if read
                        )}
                    >
                        <Link to={`${basePath}/${convo.id}`} className="block p-4">
                            <div className="flex justify-between items-start">
                                {/* Main content area */}
                                <div className="flex-1 min-w-0 pr-2"> {/* Added padding-right */}
                                    {/* Subject */}
                                    {convo.subject && (
                                        <p className="text-md font-medium text-gray-900 dark:text-gray-100 truncate">
                                            {convo.subject}
                                        </p>
                                    )}
                                    {/* Participant Names */}
                                    <p className={`text-sm ${convo.subject ? 'text-gray-600 dark:text-gray-400' : 'text-md font-medium text-gray-900 dark:text-gray-100'} truncate`}>
                                        {convo.participant_display_names || `Conversation ${convo.id.substring(0, 6)}...`}
                                    </p>
                                </div>
                                {/* Timestamp Area */}
                                <div className="ml-2 flex-shrink-0 flex flex-col items-end space-y-1">
                                    {/* Time - using ClientOnly */}
                                    <ClientOnly fallback={<p className="text-xs text-gray-500 dark:text-gray-400">&nbsp;</p>}>
                                        {() => (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatDistanceToNow(parseISO(convo.last_message_at), { addSuffix: true })}
                                            </p>
                                        )}
                                    </ClientOnly>
                                    {/* No Badge needed for admin view */}
                                    <div className="h-4"></div> {/* Placeholder to maintain alignment if needed, adjust height */}
                                </div>
                            </div>
                            {/* Optional: Last message preview (if data available) */}
                            {/* <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 truncate">
                                {convo.last_message_preview || 'No messages yet'}
                            </p> */}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
