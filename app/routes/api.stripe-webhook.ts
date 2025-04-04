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

            // Extract necessary info from metadata
            const paymentId = session.metadata.paymentId;
            const paymentType = session.metadata.paymentType;
            const familyId = session.metadata.familyId;
            const quantityStr = session.metadata.quantity;
            const quantity = quantityStr ? parseInt(quantityStr, 10) : null;

            if (!paymentId || !paymentType || !familyId) {
                 console.error(`Stripe webhook error: Missing critical metadata (paymentId, paymentType, or familyId) for session ${session.id}`);
                 // Return 400 to indicate bad request due to missing metadata
                 return json({error: "Missing required metadata in Stripe session."}, {status: 400});
            }

            // Validate quantity if it's an individual session
            if (paymentType === 'individual_session' && (!quantity || quantity <= 0)) {
                console.error(`Stripe webhook error: Invalid or missing quantity in metadata for Individual Session payment ${paymentId}`);
                // Return 400 - the metadata was incorrect
                return json({error: "Invalid quantity for Individual Session payment."}, {status: 400});
            }

            console.log(`Webhook received for session ${session.id}, payment ${paymentId}, type ${paymentType}, quantity ${quantity}`);

            // Update payment status in database using our internal paymentId from metadata
            // Pass all necessary details to the updated function
            await updatePaymentStatus(
                session.id, // Pass stripe_session_id for lookup
                'succeeded',
                session.receipt_url,
                session.payment_method_types?.[0], // Pass payment method if available
                paymentType,
                familyId,
                quantity // Pass quantity (will be null/undefined if not 1:1)
            );
            console.log(`Webhook processing complete for payment ${paymentId}`);
        }
        // TODO: Handle other events like payment_intent.succeeded, payment_intent.payment_failed if needed

        return json({received: true});
    } catch (err) {
        console.error('Stripe webhook error:', err);
        return json({error: (err as Error).message}, {status: 400});
    }
}
