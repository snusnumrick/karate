import { Resend } from 'https://esm.sh/resend@3.2.0';

const resendApiKey = Deno.env.get('RESEND_API_KEY');
const fromEmail = Deno.env.get('FROM_EMAIL');

if (!resendApiKey || !fromEmail) {
    throw new Error("Missing RESEND_API_KEY or FROM_EMAIL environment variables for email function.");
}

const resend = new Resend(resendApiKey);

interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
        console.log(`Attempting to send email via Edge Function to: ${options.to} with subject: "${options.subject}"`);
        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: options.to,
            subject: options.subject,
            html: options.html,
        });

        if (error) {
            console.error(`Resend API Error sending email from Edge Function to ${options.to}:`, error);
            return false;
        }
        console.log(`Email successfully sent from Edge Function to ${options.to}. Resend ID: ${data?.id}`);
        return true;
    } catch (error) {
        console.error(`Failed to send email via Resend from Edge Function to ${options.to}:`, error);
        return false;
    }
}
