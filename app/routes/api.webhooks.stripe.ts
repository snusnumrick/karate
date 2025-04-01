import type {ActionFunctionArgs} from "@remix-run/node";
import {json} from "@remix-run/node";
import Stripe from "stripe";
import {updatePaymentStatus} from "~/utils/supabase.server"; // Import the updated function

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey || !webhookSecret) {
    console.error("Stripe secret key or webhook secret is not set.");
    // Consider throwing an error or handling this more gracefully depending on deployment strategy
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export async function action({request}: ActionFunctionArgs) {
    if (!stripe || !webhookSecret) {
        console.error("Stripe not initialized or webhook secret missing in handler.");
        return json({error: "Server configuration error."}, {status: 500});
    }

    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
        console.error("Webhook error: Missing stripe-signature header.");
        return json({error: "Missing signature."}, {status: 400});
    }

    let event: Stripe.Event;

    try {
        // Verify the event signature
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
        console.log(`Received Stripe event: ${event.type}`);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Webhook signature verification failed: ${errorMessage}`);
        return json({error: `Webhook error: ${errorMessage}`}, {status: 400});
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        console.log(`Processing checkout.session.completed for session: ${session.id}`);

        // Extract necessary data
        const stripeSessionId = session.id;
        const paymentStatus = session.payment_status; // 'paid', 'unpaid', 'no_payment_required'
        let receiptUrl: string | null = null;
        let paymentMethod: string | null = null;

        // Determine the final status for your database
        let dbStatus: "pending" | "succeeded" | "failed" = "pending";
        if (paymentStatus === 'paid') {
            dbStatus = "succeeded";
            // Try to get receipt URL and payment method details if payment succeeded
            // This might require fetching the Payment Intent
            if (session.payment_intent && typeof session.payment_intent === 'string') {
                try {
                    const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent, {
                        expand: ['latest_charge'] // Expand to get charge details
                    });
                    // Receipt URL might be on the charge object
                    if (paymentIntent.latest_charge && typeof paymentIntent.latest_charge !== 'string') {
                        receiptUrl = paymentIntent.latest_charge.receipt_url;
                    }
                    // Payment method types are often on the Payment Intent
                    paymentMethod = paymentIntent.payment_method_types?.[0] ?? null; // Get the first type
                    console.log(`Retrieved Payment Intent ${paymentIntent.id}, Receipt URL: ${receiptUrl}, Method: ${paymentMethod}`);
                } catch (piError) {
                    console.error(`Error retrieving Payment Intent ${session.payment_intent}: ${piError instanceof Error ? piError.message : String(piError)}`);
                    // Proceed without receipt/method if PI retrieval fails
                }
            } else {
                console.warn(`Payment Intent ID not found or not a string for session ${session.id}`);
            }

        } else {
            // Handle other payment statuses if necessary (e.g., mark as failed)
            // For simplicity, we might only explicitly handle 'paid' -> 'succeeded'
            // dbStatus = "failed"; // Uncomment if you want to mark unpaid as failed
            console.warn(`Session ${session.id} completed but payment status is ${paymentStatus}.`);
            // Don't update status to failed here unless explicitly desired,
            // as other events might follow. Let's just log for now.
            // We only call updatePaymentStatus if it's 'succeeded'
        }

        // Only update if the status is determined to be 'succeeded'
        if (dbStatus === "succeeded") {
            try {
                console.log(`Updating payment status for Stripe session ${stripeSessionId} to ${dbStatus}`);
                await updatePaymentStatus(stripeSessionId, dbStatus, receiptUrl, paymentMethod);
                console.log(`Successfully updated payment status for Stripe session ${stripeSessionId}`);
            } catch (updateError) {
                console.error(`Failed to update payment status for session ${stripeSessionId}: ${updateError instanceof Error ? updateError.message : updateError}`);
                // Return 500 so Stripe retries the webhook
                return json({error: "Database update failed."}, {status: 500});
            }
        } else {
            console.log(`No database update performed for session ${stripeSessionId} with status ${paymentStatus}.`);
        }

    } else {
        // Handle other event types if needed
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Acknowledge receipt of the event to Stripe
    return json({received: true}, {status: 200});
}
