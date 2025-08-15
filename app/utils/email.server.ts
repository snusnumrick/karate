import {Resend} from 'resend';
import invariant from 'tiny-invariant';

invariant(process.env.RESEND_API_KEY, 'RESEND_API_KEY must be set');
invariant(process.env.FROM_EMAIL, 'FROM_EMAIL must be set for sending emails');

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.FROM_EMAIL;

interface EmailAttachment {
    filename: string;
    content: Buffer;
    contentType?: string;
}

interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string; // Use HTML for email body
    from?: string; // Optional custom from email, defaults to FROM_EMAIL
    attachments?: EmailAttachment[];
    // text?: string; // Optional plain text version
}

/**
 * Sends an email using the Resend service.
 * Logs success or failure.
 *
 * @param options - Email options including to, subject, html body, and optional attachments.
 * @returns True if the email was sent successfully (or accepted by Resend), false otherwise.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
        console.log(`Attempting to send email to: ${options.to} with subject: "${options.subject}"`);
        
        // Prepare email data
        const emailData: {
            from: string;
            to: string | string[];
            subject: string;
            html: string;
            attachments?: Array<{
                filename: string;
                content: Buffer;
                type: string;
            }>;
        } = {
            from: options.from || fromEmail, // Use custom from email or default FROM_EMAIL
            to: options.to,
            subject: options.subject,
            html: options.html,
            // text: options.text, // Include if providing plain text version
        };

        // Add attachments if provided
        if (options.attachments && options.attachments.length > 0) {
            emailData.attachments = options.attachments.map(attachment => ({
                filename: attachment.filename,
                content: attachment.content,
                type: attachment.contentType || 'application/octet-stream',
            }));
        }

        const {data, error} = await resend.emails.send(emailData);

        if (error) {
            console.error(`Resend API Error sending email to ${options.to}:`, error);
            return false;
        }

        console.log(`Email successfully sent (or queued) to ${options.to}. Resend ID: ${data?.id}`);
        return true;
    } catch (error) {
        // Catch potential errors during the API call itself (e.g., network issues)
        console.error(`Failed to send email via Resend to ${options.to}:`, error);
        return false;
    }
}
