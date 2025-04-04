import type {ActionFunctionArgs} from "@remix-run/node";
import {json} from "@remix-run/node";
import {Stripe} from 'stripe';
import {updatePaymentStatus} from '~/utils/supabase.server';

export async function action({request}: ActionFunctionArgs) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-02-24.acacia',
    });

    const payload = await request.text();
    const signature = request.headers.get('stripe-signature') as string;

    try {
        // Verify the webhook signature
        const event = stripe.webhooks.constructEvent(
            payload,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );

        // Handle the checkout.session.completed event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session & {
                receipt_url?: string;
                // Define expected metadata structure more precisely
                // Define expected metadata structure more precisely
                metadata: {
                    paymentId: string; // Our internal DB payment ID
                    paymentType: Database['public']['Enums']['payment_type_enum'];
                    familyId: string;
                    quantity?: string; // Optional, expected for individual sessions
                };
            };

            // Log the entire session object received in the webhook event
            console.log('[Webhook] Full session object received:', JSON.stringify(session, null, 2));

            // Extract necessary info from metadata
            const paymentId = session.metadata.paymentId;
            const paymentType = session.metadata.paymentType;
            const familyId = session.metadata.familyId;
            const quantityStr = session.metadata.quantity; // Get the string from metadata
            console.log(`[Webhook] Raw quantity string from metadata: '${quantityStr}' (type: ${typeof quantityStr})`); // Log raw value

            let quantity: number | null = null; // Initialize as null
            if (quantityStr) {
                const parsedQuantity = parseInt(quantityStr, 10);
                if (!isNaN(parsedQuantity)) {
                    quantity = parsedQuantity; // Assign only if parsing is successful
                } else {
                    console.error(`[Webhook] Failed to parse quantity string '${quantityStr}' to a number.`);
                }
            }
            console.log(`[Webhook] Parsed quantity value: ${quantity} (type: ${typeof quantity})`); // Log parsed value

            if (!paymentId || !paymentType || !familyId) {
                 console.error(`Stripe webhook error: Missing critical metadata (paymentId, paymentType, or familyId) for session ${session.id}`);
                 // Return 400 to indicate bad request due to missing metadata
                 return json({error: "Missing required metadata in Stripe session."}, {status: 400});
            }

            // Validate quantity if it's an individual session (check against the parsed 'quantity' variable)
            if (paymentType === 'individual_session' && (quantity === null || quantity <= 0)) { // Check for null or non-positive
                console.error(`[Webhook] Invalid or missing quantity for Individual Session payment ${paymentId}. Parsed quantity: ${quantity}`);
                return json({error: "Invalid quantity for Individual Session payment."}, {status: 400});
            }

            console.log(`Webhook received for session ${session.id}, payment ${paymentId}, type ${paymentType}, quantity ${quantity}`);

            // Update payment status in database using our internal paymentId from metadata
            // Pass all necessary details to the updated function
            console.log(`[Webhook] Calling updatePaymentStatus for Stripe session ${session.id} with status 'succeeded', type '${paymentType}', quantity ${quantity}`);
            try {
                await updatePaymentStatus(
                    session.id, // Pass stripe_session_id for lookup
                    'succeeded',
                session.receipt_url,
                session.payment_method_types?.[0], // Pass payment method if available
                paymentType,
                    familyId,
                    quantity // Pass the parsed quantity (number or null)
                );
                console.log(`[Webhook] updatePaymentStatus call completed successfully for payment ${paymentId}.`);
            } catch (updateError) {
                console.error(`[Webhook] Error calling updatePaymentStatus for payment ${paymentId}:`, updateError);
                // Return 500 to indicate webhook processing failed internally
                return json({error: "Failed to update payment status internally."}, {status: 500});
            }
            console.log(`Webhook processing complete for payment ${paymentId}`);
        }
        // TODO: Handle other events like payment_intent.succeeded, payment_intent.payment_failed if needed

        return json({received: true});
    } catch (err) {
        console.error('Stripe webhook error:', err);
        return json({error: (err as Error).message}, {status: 400});
    }
}
