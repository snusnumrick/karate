import { createServerClient } from "@supabase/auth-helpers-remix";
import { createClient } from "@supabase/supabase-js"; // Import standard client
import Stripe from 'stripe'; // Import Stripe
import type { Database } from "~/types/supabase";
import type { Payment } from "~/types/models";

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY is not set. Payment functionality will be disabled.");
}
// Ensure Stripe version compatibility if needed, e.g., apiVersion: '2023-10-16'
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

type SupabaseServerClientReturn = {
    supabaseServer: ReturnType<typeof createServerClient>,
    supabaseClient: ReturnType<typeof createServerClient>,
    response: Response
};

export function getSupabaseServerClient(request: Request) : SupabaseServerClientReturn {
  const response = new Response();
  
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
  }
  
  const supabaseServer = createServerClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    { request, response }
  );
  
  const supabaseClient = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    { request, response }
  );
  
  return { supabaseServer, supabaseClient, response };
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;

  // Use the standard Supabase client with the service role key for admin checks
  // This avoids needing a Request object when checking roles internally.
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables for admin check.');
    return false; // Cannot perform check if env vars are missing
  }

  // Create a temporary client instance with service role privileges
  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
    
  if (error || !data) {
    return false;
  }
  
  return data.role === 'admin';
}

export async function createPaymentSession(
  familyId: string,
  amount: number, // Amount in smallest currency unit (e.g., cents)
  studentIds: string[],
  request: Request // Pass request to get base URL
) {
  if (!stripe) {
    console.error("Stripe is not initialized. Cannot create payment session.");
    return { error: "Payment system not configured.", sessionUrl: null };
  }

  const { supabaseServer } = getSupabaseServerClient(request); // Use request-specific client if needed

  // 1. Create a pending payment record in Supabase
  const { data: paymentRecord, error: insertError } = await supabaseServer
    .from('payments')
    .insert({
      family_id: familyId,
      amount: amount, // Store amount in cents
      student_ids: studentIds,
      status: 'pending',
      // payment_date will be set on success
    })
    .select('id') // Select the ID of the newly created record
    .single();

  if (insertError || !paymentRecord) {
    console.error('Supabase payment insert error:', insertError?.message);
    return { error: 'Failed to create payment record.', sessionUrl: null };
  }

  const supabasePaymentId = paymentRecord.id;

  // 2. Create a Stripe Checkout session
  const successUrl = process.env.STRIPE_SUCCESS_URL || new URL('/payment/success', new URL(request.url).origin).toString();
  const cancelUrl = process.env.STRIPE_CANCEL_URL || new URL('/family', new URL(request.url).origin).toString(); // Redirect back to family portal on cancel

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd', // Or your desired currency
            product_data: {
              name: 'Karate Class Fees', // Customize as needed
              // description: `Payment for student(s): ${studentIds.join(', ')}`, // Optional description
            },
            unit_amount: amount, // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`, // Pass session ID on success
      cancel_url: cancelUrl,
      client_reference_id: supabasePaymentId, // Link Stripe session to Supabase payment record ID
      // You might want to prefill customer email if available
      // customer_email: userEmail,
      metadata: { // Add any other relevant metadata
          familyId: familyId,
          // studentIds: studentIds.join(','), // Metadata values must be strings
      }
    });

    if (!session.url || !session.id) {
       throw new Error('Stripe session creation failed: Missing URL or ID.');
    }

    // 3. Update the Supabase payment record with the Stripe session ID
    const { error: updateError } = await supabaseServer
      .from('payments')
      .update({ stripe_session_id: session.id }) // Store the Stripe session ID
      .eq('id', supabasePaymentId);

    if (updateError) {
      console.error('Supabase payment update error (stripe_session_id):', updateError.message);
      // Consider how to handle this - the user might proceed to pay, but linking fails.
      // Maybe attempt to refund/cancel the Stripe session if possible? Or log for manual reconciliation.
      return { error: 'Failed to link payment session.', sessionUrl: null };
    }

    // 4. Return the Stripe session URL for redirection
    return { sessionUrl: session.url, error: null };

  } catch (stripeError: any) {
    console.error('Stripe Checkout session creation error:', stripeError.message);
    // Optionally delete the pending Supabase payment record here if Stripe fails
    // await supabaseServer.from('payments').delete().eq('id', supabasePaymentId);
    return { error: `Payment initiation failed: ${stripeError.message}`, sessionUrl: null };
  }
}

export async function updatePaymentStatus(
  stripeSessionId: string, // Use Stripe session ID to find the record
  status: Payment['status'],
  receiptUrl?: string // Stripe might provide this in the webhook event
) {
  // Use the standard client with service role for webhooks/server-side updates
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables for payment update.');
    throw new Error('Server configuration error for payment update.');
  }
  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);


  const updateData: Partial<Database['public']['Tables']['payments']['Update']> = {
    status,
    receipt_url: receiptUrl,
  };

  // Set payment_date only when status becomes 'succeeded'
  if (status === 'succeeded') {
    updateData.payment_date = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .update(updateData)
    .eq('stripe_session_id', stripeSessionId) // Find record using the Stripe session ID
    .select()
    .single();

  if (error) {
    console.error(`Payment update failed for Stripe session ${stripeSessionId}:`, error.message);
    // Decide how to handle webhook errors - retry? log?
    throw new Error(`Payment update failed: ${error.message}`);
  }
  if (!data) {
     console.error(`No payment record found for Stripe session ${stripeSessionId} during update.`);
     throw new Error(`Payment record not found for session ${stripeSessionId}.`);
  }

  console.log(`Payment status updated successfully for Stripe session ${stripeSessionId} to ${status}`);
  return data;
}
