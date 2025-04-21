import { useRef, useEffect } from 'react';
import { type FetcherWithComponents } from '@remix-run/react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Send } from 'lucide-react';
import { type ActionData } from '~/routes/_layout.family.messages.$conversationId'; // Import action data type

interface MessageInputProps {
    fetcher: FetcherWithComponents<ActionData>; // Use the specific fetcher type
}

export default function MessageInput({ fetcher }: MessageInputProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isSubmitting = fetcher.state === 'submitting';

    // Reset form after successful submission
    useEffect(() => {
        if (fetcher.state === 'idle' && fetcher.data?.success && formRef.current) {
            formRef.current.reset();
            textareaRef.current?.focus(); // Keep focus on textarea
        }
    }, [fetcher.state, fetcher.data]);

    // Handle Enter key press to submit, Shift+Enter for newline
    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent default newline behavior
            if (!isSubmitting && formRef.current) {
                // Trigger form submission programmatically
                fetcher.submit(formRef.current);
            }
        }
    };

    return (
        <fetcher.Form ref={formRef} method="post" className="flex items-start space-x-2 p-2 border-t border-gray-200 dark:border-gray-700">
            <Textarea
                ref={textareaRef}
                name="content"
                placeholder="Type your message..."
                required
                rows={1} // Start with 1 row, auto-expands with content
                className="flex-grow resize-none min-h-[40px] max-h-[150px] overflow-y-auto" // Allow vertical resizing up to a max height
                disabled={isSubmitting}
                onKeyDown={handleKeyDown} // Add keydown handler
            />
            <Button type="submit" size="icon" disabled={isSubmitting} aria-label="Send message">
                <Send className="h-5 w-5" />
            </Button>
        </fetcher.Form>
    );
}
