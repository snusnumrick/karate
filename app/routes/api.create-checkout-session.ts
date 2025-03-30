import { json, type ActionFunctionArgs } from "@remix-run/node";
import { createClient } from "@supabase/supabase-js"; // Import standard client
import Stripe from 'stripe';
import { createInitialPaymentRecord } from '~/utils/supabase.server'; // Use the renamed utility
import type { Database } from "~/types/supabase";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const familyId = formData.get('familyId') as string;
  // Ensure amount is treated as cents (smallest currency unit)
  const amountInCents = Number(formData.get('amountInCents'));
  const studentIdsString = formData.get('studentIds') as string; // Expect comma-separated string

  if (!familyId || !amountInCents || !studentIdsString || amountInCents <= 0) {
    return json({ error: "Missing or invalid required information (familyId, amountInCents, studentIds)." }, { status: 400 });
  }

  const studentIds = studentIdsString.split(',');

  // 1. Create initial payment record in Supabase
  const { data: paymentData, error: paymentError } = await createInitialPaymentRecord(
    familyId,
    amountInCents,
    studentIds
  );

  if (paymentError || !paymentData?.id) {
    console.error("Failed to create initial payment record:", paymentError);
    return json({ error: "Failed to initialize payment. Please try again." }, { status: 500 });
  }
  const supabasePaymentId = paymentData.id;


  // 2. Initialize Stripe
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error("STRIPE_SECRET_KEY is not set.");
    // Optionally delete the pending payment record here
    return json({ error: "Payment processing is not configured." }, { status: 500 });
  }
  // Ensure Stripe version compatibility if needed, e.g., apiVersion: '2023-10-16'
  const stripe = new Stripe(stripeSecretKey);


  // 3. Create Stripe checkout session
  // Use request.url to build absolute URLs if BASE_URL is not reliable
  const requestUrl = new URL(request.url);
  const successUrl = process.env.STRIPE_SUCCESS_URL || new URL('/payment/success', requestUrl.origin).toString();
  const cancelUrl = process.env.STRIPE_CANCEL_URL || new URL('/family', requestUrl.origin).toString(); // Redirect back to family portal

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd', // Or your desired currency
          product_data: {
            name: 'Karate Class Fees', // Customize as needed
            description: `Payment for family ID: ${familyId}`, // Optional
          },
          unit_amount: amountInCents, // Amount in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`, // Pass session ID on success
      cancel_url: cancelUrl,
      client_reference_id: supabasePaymentId, // Link Stripe session to Supabase payment record ID
      metadata: { // Optional: Add other non-critical metadata
        familyId: familyId,
        // studentIds: studentIds.join(','), // Metadata values must be strings < 500 chars total
      }
      // Consider adding customer_email if available from user session
    });

    if (!session.id) {
      throw new Error('Stripe session creation failed: Missing session ID.');
    }

    // 4. Update Supabase payment record with Stripe session ID (important for webhook lookup)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase credentials for update.");
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({ stripe_session_id: session.id })
      .eq('id', supabasePaymentId);

    if (updateError) {
      console.error(`Failed to update payment record ${supabasePaymentId} with Stripe session ID ${session.id}:`, updateError.message);
      // Critical error: Payment might proceed but won't be trackable via webhook easily.
      // Consider logging this for manual intervention. Return error to user.
      return json({ error: "Failed to link payment session. Please contact support." }, { status: 500 });
    }

    // 5. Return the Stripe session ID to the client
    return json({ sessionId: session.id });

  } catch (error: any) {
    console.error("Stripe Checkout session creation error:", error.message);
    // Optionally delete the pending Supabase payment record here if Stripe fails
    // await supabaseAdmin.from('payments').delete().eq('id', supabasePaymentId);
    return json({ error: `Payment initiation failed: ${error.message}` }, { status: 500 });
  }
}
