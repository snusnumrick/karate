import {Resend} from 'resend';
import invariant from 'tiny-invariant';

invariant(process.env.RESEND_API_KEY, 'RESEND_API_KEY must be set');
invariant(process.env.FROM_EMAIL, 'FROM_EMAIL must be set for sending emails');

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.FROM_EMAIL;

interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string; // Use HTML for email body
    // text?: string; // Optional plain text version
}

/**
 * Sends an email using the Resend service.
 * Logs success or failure.
 *
 * @param options - Email options including to, subject, and html body.
 * @returns True if the email was sent successfully (or accepted by Resend), false otherwise.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
        console.log(`Attempting to send email to: ${options.to} with subject: "${options.subject}"`);
        const {data, error} = await resend.emails.send({
            from: fromEmail, // Use the configured FROM_EMAIL
            to: options.to,
            subject: options.subject,
            html: options.html,
            // text: options.text, // Include if providing plain text version
        });

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
