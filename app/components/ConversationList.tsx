import { Link } from "@remix-run/react";
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ClientOnly } from "~/components/client-only";
import { Badge } from "~/components/ui/badge"; // Import Badge

// Define the expected props shape based on the RPC function return type
type ConversationSummary = {
    id: string;
    subject: string | null;
    last_message_at: string;
    participant_display_names: string | null;
    unread_count: number; // Added field
};

interface ConversationListProps {
    conversations: ConversationSummary[];
    basePath: string; // e.g., "/family/messages" or "/admin/messages"
}

export default function ConversationList({ conversations, basePath }: ConversationListProps) {
    console.log(`[ConversationList] Rendering ${conversations.length} conversations.`);
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {conversations.map((convo) => (
                    <li key={convo.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <Link to={`${basePath}/${convo.id}`} className="block p-4">
                            <div className="flex justify-between items-start"> {/* Align items start for multi-line */}
                                <div className="flex-1 min-w-0"> {/* Allow text to wrap */}
                                    {/* Display Subject if available */}
                                    {convo.subject && (
                                        <p className="text-md font-medium text-gray-900 dark:text-gray-100 truncate">
                                            {convo.subject}
                                        </p>
                                    )}
                                    {/* Display Participant Names */}
                                    <p className={`text-sm ${convo.subject ? 'text-gray-600 dark:text-gray-400' : 'text-md font-medium text-gray-900 dark:text-gray-100'} truncate`}>
                                        {convo.participant_display_names || `Conversation ${convo.id.substring(0, 6)}...`}
                                    </p>
                                </div>
                                <div className="ml-2 flex-shrink-0 flex flex-col items-end space-y-1"> {/* Container for time and badge */}
                                    {/* Wrap the relative time in ClientOnly to prevent hydration mismatch */}
                                    <ClientOnly fallback={<p className="text-xs text-gray-500 dark:text-gray-400">&nbsp;</p>}>
                                        {() => (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatDistanceToNow(parseISO(convo.last_message_at), { addSuffix: true })}
                                            </p>
                                        )}
                                    </ClientOnly>
                                    {/* Unread Count Badge */}
                                    {convo.unread_count > 0 && (
                                        <Badge variant="destructive" className="px-2 py-0.5 text-xs">
                                            {convo.unread_count}
                                        </Badge>
                                    )}
                                </div> {/* Close the flex container for time/badge */}
                            </div>
                            {/* Optional: Add last message preview here if fetched */}
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
