import {serve} from "https://deno.land/std@0.177.0/http/server.ts";
import {createClient, SupabaseClient} from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@15.7.0?target=deno'; // Use specific version
import {corsHeaders} from '../_shared/cors.ts'; // Assuming you have CORS setup
import type {Database} from '../_shared/database.types.ts'; // Import Database types

// Initialize Stripe (ensure STRIPE_SECRET_KEY is set in Supabase Function env vars)
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16', // Specify API version - KEEP THIS
  httpClient: Stripe.createFetchHttpClient(), // Use Fetch client for Deno
});

// Function to get Supabase admin client
function getSupabaseAdmin(): SupabaseClient<Database> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase URL or Service Role Key environment variables.');
  }
  // Ensure you use the SERVICE ROLE KEY for admin tasks
  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

// Define the threshold for checking pending payments (e.g., 15 minutes)
const PENDING_THRESHOLD_MINUTES = 15;

serve(async (req) => {
  // This function is designed to be triggered by a schedule (cron job), not HTTP requests.
  // We might add a check here later to ensure it's triggered correctly if needed.
  console.log('Starting sync-pending-payments function run...');

  const supabaseAdmin = getSupabaseAdmin();

  // Calculate the cutoff time
  const cutoffDate = new Date();
  cutoffDate.setMinutes(cutoffDate.getMinutes() - PENDING_THRESHOLD_MINUTES);
  const cutoffIsoString = cutoffDate.toISOString();

  try {
    // 1. Find old pending payments with a Stripe PI ID
    const { data: pendingPayments, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('id, stripe_payment_intent_id')
      .eq('status', 'pending')
      .not('stripe_payment_intent_id', 'is', null)
      .lt('created_at', cutoffIsoString); // Check payments created *before* the cutoff

    if (fetchError) {
      console.error('Error fetching pending payments:', fetchError.message);
      return new Response(
        JSON.stringify({ error: `Failed to fetch pending payments: ${fetchError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      console.log('No old pending payments found requiring sync.');
      return new Response(JSON.stringify({ message: 'No old pending payments found.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingPayments.length} old pending payment(s) to check.`);
    let updatedCount = 0;
    let failedCount = 0;

    // 2. Check each payment with Stripe and update DB if necessary
    for (const payment of pendingPayments) {
      if (!payment.stripe_payment_intent_id) continue; // Should not happen due to query, but safety check

      try {
        console.log(
          `Checking Stripe PI status for ${payment.stripe_payment_intent_id} (DB ID: ${payment.id})`,
        );
        const paymentIntent = await stripe.paymentIntents.retrieve(
          payment.stripe_payment_intent_id,
          {
            expand: ['latest_charge'], // Expand to get receipt URL if succeeded
          },
        );

        let dbUpdateData: Partial<Database['public']['Tables']['payments']['Update']> | null = null;

        if (paymentIntent.status === 'succeeded') {
          console.log(`Stripe PI ${paymentIntent.id} status is 'succeeded'. Preparing DB update.`);
          const receiptUrl =
            (paymentIntent.latest_charge && typeof paymentIntent.latest_charge === 'object')
              ? paymentIntent.latest_charge.receipt_url
              : null;
          const paymentMethod = paymentIntent.payment_method_types?.[0] ?? null;
          dbUpdateData = {
            status: 'succeeded',
            payment_date: new Date().toISOString(), // Use current time as payment date approximation
            receipt_url: receiptUrl,
            payment_method: paymentMethod,
          };
        } else if (['requires_payment_method', 'canceled'].includes(paymentIntent.status)) {
          console.log(
            `Stripe PI ${paymentIntent.id} status is '${paymentIntent.status}'. Preparing DB update to 'failed'.`,
          );
          dbUpdateData = {
            status: 'failed',
            payment_date: new Date().toISOString(), // Use current time as failure date approximation
          };
        } else {
          // For other statuses (processing, requires_action, etc.), leave the DB as pending.
          console.log(
            `Stripe PI ${paymentIntent.id} status is '${paymentIntent.status}'. No DB update needed.`,
          );
        }

        // Perform DB update if status needs changing
        if (dbUpdateData) {
          const { error: updateError } = await supabaseAdmin
            .from('payments')
            .update(dbUpdateData)
            .eq('id', payment.id);

          if (updateError) {
            console.error(
              `Failed to update payment ${payment.id} status in DB:`,
              updateError.message,
            );
            failedCount++;
            // Continue to next payment
          } else {
            console.log(`Successfully updated payment ${payment.id} status in DB.`);
            updatedCount++;
          }
        }
      } catch (stripeError) {
        console.error(
          `Error retrieving or processing Stripe PI ${payment.stripe_payment_intent_id} for payment ${payment.id}:`,
          stripeError instanceof Error ? stripeError.message : stripeError,
        );
        failedCount++;
        // Continue to next payment
      }
    } // End for loop

    const summary =
      `Sync completed. Checked: ${pendingPayments.length}, Updated: ${updatedCount}, Failed checks/updates: ${failedCount}.`;
    console.log(summary);
    return new Response(JSON.stringify({ message: summary }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) { // Catch as unknown
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    console.error('Unhandled error in sync-pending-payments:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
