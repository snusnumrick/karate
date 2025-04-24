import React, { useRef, useEffect, forwardRef } from 'react'; // Import forwardRef
import { type FetcherWithComponents } from '@remix-run/react';
import { cn } from '~/lib/utils'; // Import cn utility
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Send } from 'lucide-react';
import { type ActionData } from '~/routes/_layout.family.messages.$conversationId'; // Import action data type

interface MessageInputProps {
    fetcher: FetcherWithComponents<ActionData>; // Use the specific fetcher type
    // autoFocus prop is removed
}

// Use forwardRef to pass the ref to the Textarea
const MessageInput = forwardRef<HTMLTextAreaElement, MessageInputProps>(
    ({ fetcher }, ref) => {
        const formRef = useRef<HTMLFormElement>(null);
        // The textareaRef is now passed in via the `ref` argument
        const isSubmitting = fetcher.state === 'submitting';

        // Reset form after successful submission
        useEffect(() => {
            if (fetcher.state === 'idle' && fetcher.data?.success && formRef.current) {
                formRef.current.reset();
                // Focus the textarea using the passed ref if it's an object with 'current'
                if (ref && typeof ref === 'object' && ref.current) {
                    ref.current.focus();
                }
            }
        }, [fetcher.state, fetcher.data, ref]);

        // The useEffect for autoFocus is removed

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
            <fetcher.Form ref={formRef} method="post" className="flex items-start space-x-2 p-2 border-t border-border"> {/* Use border-border */}
                <Textarea
                    ref={ref} // Pass the forwarded ref here
                    name="content"
                    placeholder="Type your message..."
                    required
                    rows={1} // Start with 1 row, auto-expands with content
                    className={cn(
                        "input-custom-styles", // Apply custom styles
                        "flex-grow resize-none min-h-[40px] max-h-[150px] overflow-y-auto" // Existing styles
                    )}
                    disabled={isSubmitting}
                    onKeyDown={handleKeyDown} // Add keydown handler
                />
                <Button type="submit" size="icon" disabled={isSubmitting} aria-label="Send message">
                    <Send className="h-5 w-5" />
                </Button>
            </fetcher.Form>
        );
    }
);

// Add display name for better debugging
MessageInput.displayName = "MessageInput";

export default MessageInput;
