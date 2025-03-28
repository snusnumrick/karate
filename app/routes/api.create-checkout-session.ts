import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { Stripe } from 'stripe';
import { getSupabaseServerClient, createPaymentSession } from '~/utils/supabase.server';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const familyId = formData.get('familyId') as string;
  const amount = Number(formData.get('amount'));
  const studentIds = JSON.parse(formData.get('studentIds') as string);

  // Create initial payment record
  const payment = await createPaymentSession(familyId, amount, studentIds);

  // Initialize Stripe
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
  });

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Karate Class Fees',
          description: `Students: ${studentIds.length}`,
        },
        unit_amount: amount * 100,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.BASE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/payment/cancel`,
    metadata: {
      paymentId: payment.id,
      familyId,
    }
  });

  return json({ sessionId: session.id });
}
