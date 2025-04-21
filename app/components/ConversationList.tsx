import { Link } from "@remix-run/react";
import { formatDistanceToNow } from 'date-fns';
import { Database } from "~/types/database.types"; // Assuming types are here
import { ClientOnly } from "~/components/client-only"; // Import ClientOnly

// Define the expected props shape based on the loader in messages._index.tsx
type ConversationSummary = Pick<Database['public']['Tables']['conversations']['Row'], 'id' | 'subject' | 'last_message_at'> & {
    // Add other fields if included in the loader's select statement
};

interface ConversationListProps {
    conversations: ConversationSummary[];
    basePath: string; // e.g., "/family/messages" or "/admin/messages"
}

export default function ConversationList({ conversations, basePath }: ConversationListProps) {
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {conversations.map((convo) => (
                    <li key={convo.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <Link to={`${basePath}/${convo.id}`} className="block p-4">
                            <div className="flex justify-between items-center">
                                <p className="text-md font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {convo.subject || `Conversation ${convo.id.substring(0, 6)}...`}
                                </p>
                                {/* Wrap the relative time in ClientOnly to prevent hydration mismatch */}
                                <ClientOnly fallback={<p className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">&nbsp;</p>}>
                                    {() => (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                                            {formatDistanceToNow(new Date(convo.last_message_at), { addSuffix: true })}
                                        </p>
                                    )}
                                </ClientOnly>
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
