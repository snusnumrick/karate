import type { ActionFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import Stripe from "stripe";
import { updatePaymentStatus } from "~/utils/supabase.server";
import type { Database } from "~/types/database.types"; // Removed unused Tables import
import { getSupabaseAdminClient } from "~/utils/supabase.server";

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
        const type = metadata?.type as Database['public']['Enums']['payment_type_enum'] | undefined;
        const familyId = metadata?.familyId;
        const quantityStr = metadata?.quantity;
        const orderId = metadata?.orderId; // Extract orderId for store purchases
        // Extract all amounts from metadata
        const subtotalAmountStr = metadata?.subtotal_amount;
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

        // Validate required metadata (including amounts and orderId for store)
        if (!supabasePaymentId || !type || !familyId || subtotalAmountFromMeta === null || taxAmountFromMeta === null || totalAmountFromMeta === null || (type === 'store_purchase' && !orderId)) {
            console.error(`CRITICAL: Missing required metadata (paymentId, type, familyId, amounts, orderId for store) in payment_intent.succeeded event ${paymentIntent.id}. Metadata:`, metadata);
            // Return 400 - Bad request, missing essential info
            return json({ error: "Missing critical payment metadata (paymentId, type, familyId, amounts, orderId for store)." }, { status: 400 });
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

            console.log(`[Webhook] Calling updatePaymentStatus for paymentId: ${supabasePaymentId}`);
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
            console.log(`[Webhook] updatePaymentStatus finished successfully for paymentId: ${supabasePaymentId}`);

            // --- Handle Store Purchase Success ---
            if (type === 'store_purchase' && orderId) {
                console.log(`[Webhook] Processing successful store purchase for order ${orderId}`);
                const supabaseAdmin = getSupabaseAdminClient();

                // 1. Update Order Status
                console.log(`[Webhook] Updating order status for orderId: ${orderId}`);
                const { error: orderUpdateError } = await supabaseAdmin
                    .from('orders')
                    .update({ status: 'paid_pending_pickup', updated_at: new Date().toISOString() })
                    .eq('id', orderId);

                if (orderUpdateError) {
                    console.error(`[Webhook] FAILED to update order ${orderId} status:`, orderUpdateError.message);
                    // Log error, but don't fail the webhook for this, payment is already processed. Needs monitoring.
                } else {
                    console.log(`[Webhook] Successfully updated order ${orderId} status to paid_pending_pickup.`);
                }

                // 2. Decrement Stock
                console.log(`[Webhook] Decrementing stock for orderId: ${orderId}`);
                const { data: orderItems, error: itemsError } = await supabaseAdmin
                    .from('order_items')
                    .select('product_variant_id, quantity')
                    .eq('order_id', orderId);

                if (itemsError) {
                     console.error(`[Webhook] FAILED to fetch order items for order ${orderId} to decrement stock:`, itemsError.message);
                     // Log error, needs manual stock adjustment or retry mechanism.
                } else if (orderItems) {
                    for (const item of orderItems) {
                        console.log(`[Webhook] Decrementing stock for variant: ${item.product_variant_id} by ${item.quantity}`);
                        const { error: stockDecrementError } = await supabaseAdmin.rpc('decrement_variant_stock', {
                            variant_id: item.product_variant_id,
                            decrement_quantity: item.quantity
                        });

                        // Check if the RPC function exists and handle potential errors
                        if (stockDecrementError) {
                             if (stockDecrementError.code === '42883') { // Function does not exist
                                console.error(`[Webhook] RPC function 'decrement_variant_stock' not found. Please create it. Stock not decremented for variant ${item.product_variant_id}.`);
                             } else {
                                console.error(`[Webhook] FAILED to decrement stock for variant ${item.product_variant_id} (Order ${orderId}):`, stockDecrementError.message);
                                // Log error, needs manual stock adjustment or retry mechanism.
                             }
                        } else {
                            console.log(`[Webhook] Decremented stock for variant ${item.product_variant_id} by ${item.quantity} (Order ${orderId}).`);
                        }
                    }
                    console.log(`[Webhook] Stock decrement process finished for orderId: ${orderId}`);
                }
            }
            // --- End Handle Store Purchase Success ---

        } catch (updateError) {
            console.error(`[Webhook] Failed during post-payment processing for Supabase payment ${supabasePaymentId}: ${updateError instanceof Error ? updateError.message : updateError}`);
            // Return 500 so Stripe retries the webhook
            return json({ error: "Database update or post-processing failed." }, { status: 500 });
        }

    } else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.warn(`Processing payment_intent.payment_failed for PI: ${paymentIntent.id}`);

        const metadata = paymentIntent.metadata;
        const supabasePaymentId = metadata?.paymentId;
        const orderId = metadata?.orderId; // Get orderId if present
        const type = metadata?.type as Database['public']['Enums']['payment_type_enum'] | undefined; // Get type

        if (!supabasePaymentId) {
             console.error(`CRITICAL: Missing paymentId metadata in payment_intent.payment_failed event ${paymentIntent.id}. Cannot update status.`);
             return json({ error: "Missing paymentId metadata." }, { status: 400 });
        }
        // Also check for orderId if it's a store purchase type
        if (type === 'store_purchase' && !orderId) {
            console.error(`CRITICAL: Missing orderId metadata in payment_intent.payment_failed event for store purchase PI ${paymentIntent.id}. Cannot update order status.`);
            // Proceed with payment status update, but log the missing orderId
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
            } catch {
                 console.warn(`[Webhook PI Failed] Could not retrieve expanded PI ${paymentIntent.id} to get card details for failed payment.`);
            }

            // Update Payment Status
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

            // --- Handle Store Purchase Failure ---
            if (type === 'store_purchase' && orderId) {
                 console.log(`[Webhook PI Failed] Processing failed store purchase for order ${orderId}`);
                 const supabaseAdmin = getSupabaseAdminClient();
                 const { error: orderUpdateError } = await supabaseAdmin
                     .from('orders')
                     .update({ status: 'cancelled', updated_at: new Date().toISOString() }) // Update status to cancelled
                     .eq('id', orderId);

                 if (orderUpdateError) {
                     console.error(`[Webhook PI Failed] FAILED to update order ${orderId} status to cancelled:`, orderUpdateError.message);
                     // Log error, but don't fail webhook. Needs monitoring.
                 } else {
                      console.log(`[Webhook PI Failed] Successfully updated order ${orderId} status to cancelled.`);
                 }
                 // No need to adjust stock on failure
            }
            // --- End Handle Store Purchase Failure ---

        } catch (updateError) {
            console.error(`[Webhook PI Failed] Failed during post-payment processing for Supabase payment ${supabasePaymentId}: ${updateError instanceof Error ? updateError.message : updateError}`);
            // Return 500 so Stripe retries the webhook
            return json({ error: "Database update or post-processing failed." }, { status: 500 });
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
