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

// Renamed from createPaymentSession - This function ONLY creates the initial DB record.
export async function createInitialPaymentRecord(
  familyId: string,
  amount: number, // Amount in smallest currency unit (e.g., cents)
  studentIds: string[],
  // No longer needs request object or Stripe logic here
) {
  // Use the standard client with service role for creating payment records server-side
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables for payment record creation.');
    return { data: null, error: 'Server configuration error for payment record creation.' };
  }
  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);


  // Create a pending payment record in Supabase
  const { data: paymentRecord, error: insertError } = await supabaseAdmin // Use supabaseAdmin here
    .from('payments')
    .insert({
      family_id: familyId,
      amount: amount, // Store amount in cents
      student_ids: studentIds,
      status: 'pending',
      // payment_date will be set on success by webhook/updatePaymentStatus
    })
    .select('id') // Select the ID of the newly created record
    .single();

  if (insertError || !paymentRecord) {
    console.error('Supabase payment insert error:', insertError?.message);
    return { data: null, error: `Failed to create payment record: ${insertError.message}` };
  }

  // Return the newly created payment record ID and null error
  return { data: { id: paymentRecord.id }, error: null };
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
