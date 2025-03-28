import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { Stripe } from 'stripe';
import { updatePaymentStatus } from '~/utils/supabase.server';

export async function action({ request }: ActionFunctionArgs) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
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
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Update payment status in database
      await updatePaymentStatus(
        session.id,
        'completed',
        (session as any).receipt_url
      );
    }
    
    return json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    return json({ error: (err as Error).message }, { status: 400 });
  }
}
