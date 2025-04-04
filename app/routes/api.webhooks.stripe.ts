import type {ActionFunctionArgs} from "@remix-run/node";
import {json} from "@remix-run/node";
import Stripe from "stripe";
import {updatePaymentStatus} from "~/utils/supabase.server";
import type {Database} from "~/types/supabase"; // Import Database types

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
        const sessionFromEvent = event.data.object as Stripe.Checkout.Session; // Session from webhook event
        console.log(`Processing checkout.session.completed for session: ${sessionFromEvent.id}`);

        // --- Retrieve the session again with payment_intent expanded ---
        let session: Stripe.Checkout.Session;
        try {
            console.log(`[Webhook ${request.url}] Retrieving session ${sessionFromEvent.id} with payment_intent expanded...`);
            session = await stripe.checkout.sessions.retrieve(sessionFromEvent.id, {
                expand: ['payment_intent'],
            });
            console.log(`[Webhook ${request.url}] Full session object RETRIEVED with expansion.`);
        } catch (retrieveError) {
            console.error(`[Webhook ${request.url}] Failed to retrieve session ${sessionFromEvent.id} with expansion:`, retrieveError);
            return json({ error: "Failed to retrieve full session details." }, { status: 500 });
        }

        // Extract necessary data
        const stripeSessionId = session.id;
        const paymentStatus = session.payment_status; // 'paid', 'unpaid', 'no_payment_required'
        let receiptUrl: string | null = null;
        let paymentMethod: string | null = null;

        // --- Attempt to retrieve metadata from the EXPANDED Payment Intent ---
        const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null; // Should be object or null
        let metadataSource: {
            paymentId?: string; // Keep internal payment ID for logging/reference if needed
            paymentType?: Database['public']['Enums']['payment_type_enum'];
            familyId?: string;
            quantity?: string;
        } | null = null;

        if (paymentIntent && paymentIntent.metadata) {
             console.log(`[Webhook ${request.url}] Found metadata on expanded Payment Intent object:`, JSON.stringify(paymentIntent.metadata, null, 2));
             // Log the keys present in the metadata object
             console.log(`[Webhook ${request.url}] Keys in payment_intent.metadata:`, Object.keys(paymentIntent.metadata));
             metadataSource = paymentIntent.metadata;
        } else {
             console.warn(`[Webhook ${request.url}] Metadata not found on expanded Payment Intent object. Payment Intent:`, paymentIntent);
             // Fallback to session metadata (unlikely to work)
             metadataSource = session.metadata;
             console.log(`[Webhook ${request.url}] Falling back to session metadata:`, metadataSource);
        }

        if (!metadataSource) {
            console.error(`[Webhook ${request.url}] CRITICAL: Could not find required metadata for session ${session.id}.`);
            return json({error: "Missing critical payment metadata."}, {status: 400});
        }

        // Extract values from the determined metadata source
        const paymentType = metadataSource.paymentType ?? null;
        const familyId = metadataSource.familyId ?? null; // Needed for updatePaymentStatus
        const quantityStr = metadataSource.quantity;
        let quantity: number | null = null;
        if (quantityStr) {
            const parsedQuantity = parseInt(quantityStr, 10);
            if (!isNaN(parsedQuantity)) {
                quantity = parsedQuantity;
            } else {
                 console.error(`[Webhook ${request.url}] Failed to parse quantity string '${quantityStr}' from metadata.`);
            }
        }
        console.log(`[Webhook ${request.url}] Extracted: paymentType=${paymentType}, familyId=${familyId}, quantity=${quantity}`);

        // Determine the final status for your database
        let dbStatus: Database['public']['Enums']['payment_status'] = "pending"; // Use the enum type
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
        // AND we have a valid payment type from metadata
        if (dbStatus === "succeeded" && paymentType && familyId) { // Also ensure familyId is present
            try {
                console.log(`[Webhook ${request.url}] Calling updatePaymentStatus for Stripe session ${stripeSessionId} to ${dbStatus} with type ${paymentType}, quantity ${quantity}, familyId ${familyId}`);
                // Pass paymentType, familyId, and quantity to the updated function
                await updatePaymentStatus(
                    stripeSessionId,
                    dbStatus,
                    receiptUrl,
                    paymentMethod,
                    paymentType,
                    familyId, // Pass familyId
                    quantity  // Pass quantity (will be null if not applicable or parsing failed)
                );
                console.log(`[Webhook ${request.url}] Successfully updated payment status and potentially session balance for Stripe session ${stripeSessionId}`);
            } catch (updateError) {
                console.error(`[Webhook ${request.url}] Failed to update payment status/session balance for session ${stripeSessionId}: ${updateError instanceof Error ? updateError.message : updateError}`);
                // Return 500 so Stripe retries the webhook
                return json({error: "Database update failed."}, {status: 500});
            }
        } else {
            console.log(`[Webhook ${request.url}] No database update performed for session ${stripeSessionId}. Conditions: dbStatus='${dbStatus}', paymentType='${paymentType}', familyId='${familyId}'.`);
        }

    } else {
        // Handle other event types if needed
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Acknowledge receipt of the event to Stripe
    return json({received: true}, {status: 200});
}
