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
      status: 'pending',
      // payment_date and payment_method are nullable and set later
      // stripe_session_id and receipt_url are nullable and set later
    })
    .select('id') // Select the ID of the newly created record
    .single();

  if (insertError || !paymentRecord) {
    console.error('Supabase payment insert error:', insertError?.message);
    return { data: null, error: `Failed to create payment record: ${insertError.message}` };
  }

  const paymentId = paymentRecord.id;

  // 2. Insert records into the payment_students junction table
  const studentInserts = studentIds.map(studentId => ({
    payment_id: paymentId,
    student_id: studentId,
  }));

  const { error: junctionError } = await supabaseAdmin
    .from('payment_students')
    .insert(studentInserts);

  if (junctionError) {
    console.error('Supabase payment_students insert error:', junctionError.message);
    // Attempt to delete the payment record if linking students fails? Or just log?
    // For now, log the error and return failure. The payment record exists but isn't linked.
    // await supabaseAdmin.from('payments').delete().eq('id', paymentId); // Optional cleanup
    return { data: null, error: `Failed to link students to payment: ${junctionError.message}` };
  }

  // Return the newly created payment record ID and null error
  return { data: { id: paymentId }, error: null };
}

// --- Student Eligibility Check ---

export type EligibilityStatus = {
  eligible: boolean;
  reason: 'Trial' | 'Paid' | 'Not Paid';
  paidThrough?: string; // Optional: YYYY-MM for the month they are paid through
};

/**
 * Checks if a student is eligible to attend class based on payment status.
 * Eligibility rules:
 * 1. Eligible if on Free Trial (zero successful payments linked).
 * 2. Eligible if paid for the current calendar month.
 * @param studentId The ID of the student to check.
 * @param supabaseAdmin A Supabase client instance with service_role privileges.
 * @returns Promise<EligibilityStatus>
 */
export async function checkStudentEligibility(
  studentId: string,
  supabaseAdmin: ReturnType<typeof createClient<Database>> // Use the specific client type
): Promise<EligibilityStatus> {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed (0 = January)

  // 1. Fetch successful payments linked to this student
  const { data: paymentLinks, error: linkError } = await supabaseAdmin
    .from('payment_students')
    .select(`
      payment_id,
      payments ( id, payment_date, status )
    `)
    .eq('student_id', studentId)
    // Ensure we only join with successful payments
    .eq('payments.status', 'succeeded');

  if (linkError) {
    console.error(`Error fetching payment links for student ${studentId}:`, linkError.message);
    // Default to not eligible if we can't verify payments
    return { eligible: false, reason: 'Not Paid' };
  }

  const successfulPayments = paymentLinks
    ?.map(link => link.payments) // Extract the payment object
    .filter(payment => payment !== null && payment.payment_date !== null) as Array<{ id: string, payment_date: string, status: string }> ?? []; // Type assertion after filtering nulls


  // 2. Check for Free Trial (zero successful payments)
  if (successfulPayments.length === 0) {
    return { eligible: true, reason: 'Trial' };
  }

  // 3. Check if paid for the current calendar month
  for (const payment of successfulPayments) {
    const paymentDate = new Date(payment.payment_date); // Assumes payment_date is YYYY-MM-DD or ISO string
    if (paymentDate.getFullYear() === currentYear && paymentDate.getMonth() === currentMonth) {
      return {
        eligible: true,
        reason: 'Paid',
        paidThrough: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}` // YYYY-MM
      };
    }
  }

  // 4. If not on trial and no payment for the current month found
  return { eligible: false, reason: 'Not Paid' };
}


export async function updatePaymentStatus(
  stripeSessionId: string, // Use Stripe session ID to find the record
  status: "pending" | "succeeded" | "failed", // Use the specific enum values
  receiptUrl?: string | null, // Stripe might provide this in the webhook event
  paymentMethod?: string | null // Added parameter for payment method
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
    payment_method: paymentMethod, // Add paymentMethod to the update object
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
