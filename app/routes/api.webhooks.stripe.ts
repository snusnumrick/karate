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

    // --- Handle Payment Intent Events ---
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Processing payment_intent.succeeded for PI: ${paymentIntent.id}`);

        // Extract metadata - CRITICAL
        const metadata = paymentIntent.metadata;
        const supabasePaymentId = metadata?.paymentId; // Our internal ID from metadata
        const type = metadata?.type as Database['public']['Enums']['payment_type_enum'] | undefined; // Extract 'type'
        const familyId = metadata?.familyId;
        const quantityStr = metadata?.quantity;
        let quantity: number | null = null;
        if (quantityStr) {
            const parsedQuantity = parseInt(quantityStr, 10);
            quantity = !isNaN(parsedQuantity) ? parsedQuantity : null;
        }

        if (!supabasePaymentId || !type || !familyId) { // Check for 'type'
            console.error(`CRITICAL: Missing required metadata (paymentId, type, familyId) in payment_intent.succeeded event ${paymentIntent.id}. Metadata:`, metadata); // Update error message
            // Return 400 - Bad request, missing essential info
            return json({ error: "Missing critical payment metadata." }, { status: 400 });
        }

        // Extract other details
        let receiptUrl: string | null = null; // Initialize receiptUrl
        const paymentMethod = paymentIntent.payment_method_types?.[0] ?? null;
        const stripePaymentIntentId = paymentIntent.id; // The ID of the payment intent itself

        // --- Retrieve PI again to get latest_charge.receipt_url ---
        try {
            console.log(`[Webhook PI Succeeded] Retrieving Payment Intent ${paymentIntent.id} with expanded charge...`);
            const retrievedPI = await stripe.paymentIntents.retrieve(paymentIntent.id, {
                expand: ['latest_charge']
            });
            if (retrievedPI.latest_charge && typeof retrievedPI.latest_charge !== 'string') {
                receiptUrl = retrievedPI.latest_charge.receipt_url;
                console.log(`[Webhook PI Succeeded] Found receipt_url on expanded charge: ${receiptUrl}`);
            } else {
                console.warn(`[Webhook PI Succeeded] latest_charge not found or not expanded on retrieved PI ${paymentIntent.id}.`);
            }
        } catch (retrieveError) {
            console.error(`[Webhook PI Succeeded] Error retrieving expanded Payment Intent ${paymentIntent.id}:`, retrieveError instanceof Error ? retrieveError.message : retrieveError);
            // Proceed without receipt URL if retrieval fails
        }
        // --- End Retrieve PI ---


        try {
            console.log(`[Webhook PI Succeeded] Calling updatePaymentStatus for Supabase payment ${supabasePaymentId} to succeeded`);
            await updatePaymentStatus(
                supabasePaymentId, // Use the ID from metadata
                "succeeded",
                receiptUrl, // Use the potentially retrieved receiptUrl
                paymentMethod,
                stripePaymentIntentId, // Pass the PI ID
                type, // Pass 'type'
                familyId,
                quantity
            );
            console.log(`[Webhook PI Succeeded] updatePaymentStatus completed for Supabase payment ${supabasePaymentId}`);
        } catch (updateError) {
            console.error(`[Webhook PI Succeeded] Failed to update payment status/session balance for Supabase payment ${supabasePaymentId}: ${updateError instanceof Error ? updateError.message : updateError}`);
            // Return 500 so Stripe retries the webhook
            return json({ error: "Database update failed." }, { status: 500 });
        }

    } else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Processing payment_intent.payment_failed for PI: ${paymentIntent.id}`);

        const metadata = paymentIntent.metadata;
        const supabasePaymentId = metadata?.paymentId; // Our internal ID from metadata

        if (!supabasePaymentId) {
             console.error(`CRITICAL: Missing paymentId metadata in payment_intent.payment_failed event ${paymentIntent.id}. Cannot update status.`);
             // Return 400 - cannot process without ID
             return json({ error: "Missing paymentId metadata." }, { status: 400 });
        }

         try {
            console.log(`[Webhook PI Failed] Calling updatePaymentStatus for Supabase payment ${supabasePaymentId} to failed`);
            // Note: We don't pass quantity/type/familyId here as they aren't strictly needed for 'failed' status update
            // and might not be present if the PI failed very early.
            await updatePaymentStatus(
                supabasePaymentId,
                "failed",
                null, // No receipt URL
                paymentIntent.payment_method_types?.[0] ?? null, // Still useful to store method type
                paymentIntent.id // Store the PI ID
                // paymentType, familyId, quantity are omitted
            );
            console.log(`[Webhook PI Failed] updatePaymentStatus completed for Supabase payment ${supabasePaymentId}`);
        } catch (updateError) {
            console.error(`[Webhook PI Failed] Failed to update payment status for Supabase payment ${supabasePaymentId}: ${updateError instanceof Error ? updateError.message : updateError}`);
            // Return 500 so Stripe retries the webhook
            return json({ error: "Database update failed." }, { status: 500 });
        }

    // --- Other Event Types ---
    } else if (event.type === 'charge.succeeded' || event.type === 'charge.updated') {
        // Often accompanies payment_intent events. Log receipt but take no DB action based on charge alone.
        console.log(`[Webhook] Received ${event.type} event. No action taken based on charge event alone.`);
    } else {
        // Handle other event types if needed
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    // Acknowledge receipt of the event to Stripe
    return json({received: true}, {status: 200});
}
