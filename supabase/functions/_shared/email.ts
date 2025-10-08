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
    retryAttempts?: number;
    retryDelayMs?: number;
}

/**
 * Send email with exponential backoff retry logic
 * @param options - Email options including retry configuration
 * @returns true if email sent successfully, false otherwise
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
    const maxRetries = options.retryAttempts ?? 3;
    const initialDelayMs = options.retryDelayMs ?? 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`Attempting to send email via Edge Function to: ${options.to} with subject: "${options.subject}" (attempt ${attempt + 1}/${maxRetries})`);

            const { data, error } = await resend.emails.send({
                from: fromEmail!,
                to: options.to,
                subject: options.subject,
                html: options.html,
            });

            if (error) {
                // Check if it's a rate limit error
                const isRateLimit = error.message?.toLowerCase().includes('too many requests') ||
                                  error.message?.toLowerCase().includes('rate limit');

                if (isRateLimit && attempt < maxRetries - 1) {
                    const delayMs = initialDelayMs * Math.pow(2, attempt);
                    console.warn(`Rate limit hit for ${options.to}. Retrying in ${delayMs}ms...`);
                    await sleep(delayMs);
                    continue;
                }

                console.error(`Resend API Error sending email from Edge Function to ${options.to}:`, error);
                return false;
            }

            console.log(`Email successfully sent from Edge Function to ${options.to}. Resend ID: ${data?.id}`);
            return true;
        } catch (error) {
            const isLastAttempt = attempt === maxRetries - 1;

            if (!isLastAttempt) {
                const delayMs = initialDelayMs * Math.pow(2, attempt);
                console.warn(`Failed to send email to ${options.to} (attempt ${attempt + 1}). Retrying in ${delayMs}ms...`, error);
                await sleep(delayMs);
                continue;
            }

            console.error(`Failed to send email via Resend from Edge Function to ${options.to} after ${maxRetries} attempts:`, error);
            return false;
        }
    }

    return false;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
