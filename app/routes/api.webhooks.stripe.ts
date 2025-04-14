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
        // console.log(`Received Stripe event: ${event.type}`);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Webhook signature verification failed: ${errorMessage}`);
        return json({error: `Webhook error: ${errorMessage}`}, {status: 400});
    }

    // --- Handle Payment Intent Events ---
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        // console.log(`Processing payment_intent.succeeded for PI: ${paymentIntent.id}`);

        // Extract metadata - CRITICAL
        const metadata = paymentIntent.metadata;
        const supabasePaymentId = metadata?.paymentId; // Our internal ID from metadata
        const type = metadata?.type as Database['public']['Enums']['payment_type_enum'] | undefined; // Extract 'type'
        const familyId = metadata?.familyId;
        const quantityStr = metadata?.quantity;
        // Extract all amounts from metadata
        const subtotalAmountStr = metadata?.subtotal_amount; // Expecting subtotal from metadata
        // Tax and Total are also expected from metadata now
        const taxAmountStr = metadata?.tax_amount;
        const totalAmountStr = metadata?.total_amount;

        let quantity: number | null = null;
        if (quantityStr) {
            const parsedQuantity = parseInt(quantityStr, 10);
            quantity = !isNaN(parsedQuantity) ? parsedQuantity : null;
        }

        // Parse amounts (expecting cents as strings)
        const subtotalAmountFromMeta = subtotalAmountStr ? parseInt(subtotalAmountStr, 10) : null;
        const taxAmountFromMeta = taxAmountStr ? parseInt(taxAmountStr, 10) : null;
        const totalAmountFromMeta = totalAmountStr ? parseInt(totalAmountStr, 10) : null;

        // Validate required metadata (including amounts)
        if (!supabasePaymentId || !type || !familyId || subtotalAmountFromMeta === null || taxAmountFromMeta === null || totalAmountFromMeta === null) { // Check for 'type' and amounts
            console.error(`CRITICAL: Missing required metadata (paymentId, type, familyId, amounts) in payment_intent.succeeded event ${paymentIntent.id}. Metadata:`, metadata); // Update error message
            // Return 400 - Bad request, missing essential info
            return json({ error: "Missing critical payment metadata (paymentId, type, familyId, amounts)." }, { status: 400 }); // Updated error message
        }

        // Extract other details
        let receiptUrl: string | null = null;
        const paymentMethodType = paymentIntent.payment_method_types?.[0] ?? null; // e.g., 'card'
        const stripePaymentIntentId = paymentIntent.id;
        let cardLast4: string | null = null;
        let cardBrand: string | null = null;

        // --- Retrieve PI again with expanded payment_method to get card details ---
        try {
            // console.log(`[Webhook PI Succeeded] Retrieving Payment Intent ${paymentIntent.id} with expanded payment_method and latest_charge...`);
            const retrievedPI = await stripe.paymentIntents.retrieve(paymentIntent.id, {
                // Expand both payment_method and latest_charge
                expand: ['payment_method', 'latest_charge']
            });

            // Get receipt URL from latest_charge
            if (retrievedPI.latest_charge && typeof retrievedPI.latest_charge !== 'string') {
                receiptUrl = retrievedPI.latest_charge.receipt_url;
                // console.log(`[Webhook PI Succeeded] Found receipt_url on expanded charge: ${receiptUrl}`);
            } else {
                console.warn(`[Webhook PI Succeeded] latest_charge not found or not expanded on retrieved PI ${paymentIntent.id}.`);
            }

            // Get card details from payment_method if it's a card payment
            if (retrievedPI.payment_method && typeof retrievedPI.payment_method === 'object' && retrievedPI.payment_method.card) {
                cardLast4 = retrievedPI.payment_method.card.last4;
                cardBrand = retrievedPI.payment_method.card.brand; // e.g., 'visa', 'mastercard'
                // console.log(`[Webhook PI Succeeded] Found card details: Brand=${cardBrand}, Last4=${cardLast4}`); // Existing log
            } else {
                 console.warn(`[Webhook PI Succeeded] Payment method details or card details not found/expanded on retrieved PI ${paymentIntent.id}. cardLast4 will be null.`);
            }

        } catch (retrieveError) {
            console.error(`[Webhook PI Succeeded] Error retrieving expanded Payment Intent ${paymentIntent.id}:`, retrieveError instanceof Error ? retrieveError.message : retrieveError);
            // Proceed without receipt URL or card details if retrieval fails
        }
        // --- End Retrieve PI ---

        // Verify total amount charged by Stripe matches the total amount from metadata
        const totalAmountChargedByStripe = paymentIntent.amount; // Amount charged by Stripe (should be total)
        if (totalAmountChargedByStripe !== totalAmountFromMeta) {
            console.error(`[Webhook PI Succeeded] CRITICAL: Amount mismatch! Stripe charged ${totalAmountChargedByStripe}, but metadata total was ${totalAmountFromMeta} for PI ${paymentIntent.id}. Check manual tax calculation logic.`);
            // Return 500 - indicates a problem needing investigation
            return json({ error: "Internal calculation error: Amount mismatch." }, { status: 500 });
        }
        // Tax amount is read directly from metadata (taxAmountFromMeta)

        try {
            // Construct payment method string including brand if available
            let paymentMethodString = paymentMethodType;
            if (paymentMethodType === 'card' && cardBrand) {
                paymentMethodString = `${cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1)} card`; // e.g., "Visa card"
            }

            // console.log(`[Webhook PI Succeeded] Calling updatePaymentStatus for Supabase payment ${supabasePaymentId} to succeeded. Amounts from metadata: Subtotal=${subtotalAmountFromMeta}, Tax=${taxAmountFromMeta}, Total=${totalAmountFromMeta}`);
            await updatePaymentStatus(
                supabasePaymentId, // Use the ID from metadata
                "succeeded",
                receiptUrl, // Use the potentially retrieved receiptUrl
                paymentMethodString, // Pass the constructed string (e.g., "Visa card", "interac_present")
                stripePaymentIntentId, // Pass the PI ID
                type, // Pass 'type'
                familyId,
                quantity,
                // Pass amounts from metadata for verification/logging in updatePaymentStatus
                subtotalAmountFromMeta,
                taxAmountFromMeta,
                totalAmountFromMeta,
                // Pass card details
                cardLast4 // Pass the extracted last 4 digits
            );
            // console.log(`[Webhook PI Succeeded] updatePaymentStatus completed for Supabase payment ${supabasePaymentId}`);
        } catch (updateError) {
            console.error(`[Webhook PI Succeeded] Failed to update payment status/session balance for Supabase payment ${supabasePaymentId}: ${updateError instanceof Error ? updateError.message : updateError}`);
            // Return 500 so Stripe retries the webhook
            return json({ error: "Database update failed." }, { status: 500 });
        }

    } else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.warn(`Processing payment_intent.payment_failed for PI: ${paymentIntent.id}`);

        const metadata = paymentIntent.metadata;
        const supabasePaymentId = metadata?.paymentId; // Our internal ID from metadata

        if (!supabasePaymentId) {
             console.error(`CRITICAL: Missing paymentId metadata in payment_intent.payment_failed event ${paymentIntent.id}. Cannot update status.`);
             // Return 400 - cannot process without ID
             return json({ error: "Missing paymentId metadata." }, { status: 400 });
        }

         try {
            console.warn(`[Webhook PI Failed] Calling updatePaymentStatus for Supabase payment ${supabasePaymentId} to failed`);
            // Extract card details even for failed attempts if possible (might not always be available)
            let failedCardLast4: string | null = null;
            let failedCardBrand: string | null = null;
            let failedPaymentMethodString = paymentIntent.payment_method_types?.[0] ?? null;
            try {
                 const retrievedPI = await stripe.paymentIntents.retrieve(paymentIntent.id, { expand: ['payment_method'] });
                 if (retrievedPI.payment_method && typeof retrievedPI.payment_method === 'object' && retrievedPI.payment_method.card) {
                     failedCardLast4 = retrievedPI.payment_method.card.last4;
                     failedCardBrand = retrievedPI.payment_method.card.brand;
                     if (failedPaymentMethodString === 'card' && failedCardBrand) {
                         failedPaymentMethodString = `${failedCardBrand.charAt(0).toUpperCase() + failedCardBrand.slice(1)} card`;
                     }
                 }
            } catch (retrieveError) {
                 console.warn(`[Webhook PI Failed] Could not retrieve expanded PI ${paymentIntent.id} to get card details for failed payment.`);
            }

            await updatePaymentStatus(
                supabasePaymentId,
                "failed",
                null, // No receipt URL
                failedPaymentMethodString, // Store method type (potentially with brand)
                paymentIntent.id, // Store the PI ID
                undefined, // type - not strictly needed for failed
                undefined, // familyId - not strictly needed for failed
                undefined, // quantity - not strictly needed for failed
                undefined, // subtotal - not strictly needed for failed
                undefined, // tax - not strictly needed for failed
                undefined, // total - not strictly needed for failed
                failedCardLast4 // Store last4 if available
            );
            // console.log(`[Webhook PI Failed] updatePaymentStatus completed for Supabase payment ${supabasePaymentId}`);
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
