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

    // --- Handle Checkout Session Event (Legacy/Optional) ---
    // Keep this block if you might still use Checkout Sessions elsewhere,
    // otherwise, it can be removed. Mark it clearly if keeping.
    } else if (event.type === 'checkout.session.completed') {
        console.warn(`[Webhook] Received legacy 'checkout.session.completed' event. Processing, but prefer 'payment_intent.succeeded'.`);
        const sessionFromEvent = event.data.object as Stripe.Checkout.Session;

        // --- Retrieve the session again with payment_intent expanded ---
        let session: Stripe.Checkout.Session;
        try {
            // console.log(`[Webhook ${request.url}] Retrieving session ${sessionFromEvent.id} with payment_intent expanded...`); // Removed log
            session = await stripe.checkout.sessions.retrieve(sessionFromEvent.id, {
                expand: ['payment_intent'],
            });
            // console.log(`[Webhook ${request.url}] Full session object RETRIEVED with expansion.`); // Removed log
        } catch (retrieveError) {
            console.error(`[Webhook ${request.url}] Failed to retrieve session ${sessionFromEvent.id} with expansion:`, retrieveError);
            return json({ error: "Failed to retrieve full session details." }, { status: 500 });
        }

        // Extract necessary data
        const stripeSessionId = session.id;
        const paymentStatus = session.payment_status; // 'paid', 'unpaid', 'no_payment_required'
        let receiptUrl: string | null = null;
        let paymentMethod: string | null = null;

        // --- Attempt to retrieve metadata from the EXPANDED Payment Intent (if available) ---
        const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;
        let metadataSource: {
            paymentId?: string; // Supabase Payment ID
            type?: Database['public']['Enums']['payment_type_enum']; // Use 'type'
            familyId?: string;
            // Note: stripe_session_id is NOT typically in metadata, it's the session.id itself
            quantity?: string;
        } | null = null;

        if (paymentIntent && paymentIntent.metadata) {
             // console.log(`[Webhook ${request.url}] Found metadata on expanded Payment Intent object:`, JSON.stringify(paymentIntent.metadata, null, 2)); // Removed log
             // console.log(`[Webhook ${request.url}] Keys in payment_intent.metadata:`, Object.keys(paymentIntent.metadata)); // Removed log
             metadataSource = paymentIntent.metadata;
        } else {
             console.warn(`[Webhook ${request.url}] Metadata not found on expanded Payment Intent object. Payment Intent:`, paymentIntent);
             // Fallback to session metadata (unlikely to work)
             metadataSource = session.metadata; // Fallback to session metadata
             console.warn(`[Webhook Checkout Session] Metadata not found on expanded Payment Intent. Falling back to session metadata for session ${session.id}. Metadata:`, metadataSource);
        }

        // CRITICAL: Get the Supabase Payment ID from metadata
        const supabasePaymentId = metadataSource?.paymentId;

        if (!supabasePaymentId) {
            console.error(`[Webhook Checkout Session] CRITICAL: Could not find required 'paymentId' in metadata for session ${session.id}. Cannot update database.`);
            // Return 400 - cannot proceed without our internal ID
            return json({ error: "Missing critical payment metadata (paymentId)." }, { status: 400 });
        }

        // Extract other values from the determined metadata source
        const type = metadataSource?.type ?? null; // Extract 'type'
        const familyId = metadataSource?.familyId ?? null;
        const quantityStr = metadataSource?.quantity;
        let quantity: number | null = null;
        if (quantityStr) {
            const parsedQuantity = parseInt(quantityStr, 10);
            if (!isNaN(parsedQuantity)) {
                quantity = parsedQuantity;
            } else {
                 console.error(`[Webhook ${request.url}] Failed to parse quantity string '${quantityStr}' from metadata.`);
            }
        }
        // console.log(`[Webhook ${request.url}] Extracted: paymentType=${paymentType}, familyId=${familyId}, quantity=${quantity}`); // Removed log

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
                    // console.log(`Retrieved Payment Intent ${paymentIntent.id}, Receipt URL: ${receiptUrl}, Method: ${paymentMethod}`); // Removed log
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
        // AND we have a valid type and familyId from metadata
        if (dbStatus === "succeeded" && type && familyId) { // Check for 'type'
            try {
                console.log(`[Webhook Checkout Session] Calling updatePaymentStatus for Supabase payment ${supabasePaymentId} (from session ${stripeSessionId}) to ${dbStatus}`);
                // Call the MODIFIED updatePaymentStatus with supabasePaymentId
                await updatePaymentStatus(
                    supabasePaymentId, // Use the ID from metadata
                    dbStatus,
                    receiptUrl,
                    paymentMethod,
                    paymentIntent?.id, // Pass the Payment Intent ID if available
                    type, // Pass 'type'
                    familyId, // Pass familyId
                    quantity // Pass quantity
                );
                console.log(`[Webhook Checkout Session] updatePaymentStatus completed for Supabase payment ${supabasePaymentId}`);
            } catch (updateError) {
                console.error(`[Webhook Checkout Session] Failed to update payment status/session balance for Supabase payment ${supabasePaymentId} (from session ${stripeSessionId}): ${updateError instanceof Error ? updateError.message : updateError}`);
                // Return 500 so Stripe retries the webhook
                return json({ error: "Database update failed." }, { status: 500 });
            }
        } else if (dbStatus === "failed") { // Handle failed checkout session payment status
             try {
                console.log(`[Webhook Checkout Session] Calling updatePaymentStatus for Supabase payment ${supabasePaymentId} (from session ${stripeSessionId}) to failed`);
                await updatePaymentStatus(
                    supabasePaymentId,
                    "failed",
                    null,
                    paymentMethod,
                    paymentIntent?.id // Pass the Payment Intent ID if available
                    // paymentType, familyId, quantity are omitted for failed status
                );
                console.log(`[Webhook Checkout Session] updatePaymentStatus (failed) completed for Supabase payment ${supabasePaymentId}`);
            } catch (updateError) {
                 console.error(`[Webhook Checkout Session] Failed to update payment status (failed) for Supabase payment ${supabasePaymentId} (from session ${stripeSessionId}): ${updateError instanceof Error ? updateError.message : updateError}`);
                 return json({ error: "Database update failed." }, { status: 500 });
            }
        } else {
            // Keep this log for cases where update is skipped
             console.log(`[Webhook Checkout Session] No database update performed for Supabase payment ${supabasePaymentId} (from session ${stripeSessionId}). Conditions: dbStatus='${dbStatus}', type='${type}', familyId='${familyId}'.`); // Log 'type'
        }

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
