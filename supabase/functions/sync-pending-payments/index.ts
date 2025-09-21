import {serve} from "https://deno.land/std@0.177.0/http/server.ts";
import {getSupabaseAdminClient, SupabaseClient} from '../_shared/supabase.ts';
import Stripe from 'https://esm.sh/stripe@15.7.0?target=deno'; // Use specific version
import {corsHeaders} from '../_shared/cors.ts'; // Assuming you have CORS setup
import type {Database} from '../_shared/database.types.ts'; // Import Database types

// Detect payment provider from environment
const PAYMENT_PROVIDER = Deno.env.get('PAYMENT_PROVIDER') || 'stripe';

// Provider-specific initialization
let stripe: Stripe | null = null;

if (PAYMENT_PROVIDER === 'stripe') {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (stripeSecretKey) {
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16', // Specify API version - KEEP THIS
      httpClient: Stripe.createFetchHttpClient(), // Use Fetch client for Deno
    });
  } else {
    console.warn('STRIPE_SECRET_KEY not found. Stripe functionality disabled.');
  }
}

// Using shared Supabase admin client utility

// Define the threshold for checking pending payments (e.g., 15 minutes)
const PENDING_THRESHOLD_MINUTES = 15;

// Provider-specific payment intent retrieval
async function retrievePaymentIntent(paymentIntentId: string) {
  if (PAYMENT_PROVIDER === 'stripe' && stripe) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'], // Expand to get receipt URL if succeeded
    });
    
    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      receiptUrl: (paymentIntent.latest_charge && typeof paymentIntent.latest_charge === 'object')
        ? paymentIntent.latest_charge.receipt_url
        : null,
      paymentMethod: paymentIntent.payment_method_types?.[0] ?? null,
    };
  }
  
  // Add other providers here
  if (PAYMENT_PROVIDER === 'square') {
    // Square Web SDK payments would need to be tracked differently
    // This is a placeholder - in a real implementation, you'd need to:
    // 1. Store Square payment IDs in the database
    // 2. Use Square Payments API to check payment status
    // 3. Map Square statuses to our internal statuses
    console.warn(`Square payment sync for ${paymentIntentId} - implementation needed`);
    return {
      id: paymentIntentId,
      status: 'pending', // Default to pending since we can't check
      receiptUrl: null,
      paymentMethod: null,
    };
  }
  
  throw new Error(`Unsupported payment provider: ${PAYMENT_PROVIDER}`);
}

// Provider-agnostic status mapping
function mapProviderStatusToDbStatus(providerStatus: string): 'succeeded' | 'failed' | 'pending' {
  if (PAYMENT_PROVIDER === 'stripe') {
    if (providerStatus === 'succeeded') return 'succeeded';
    if (['requires_payment_method', 'canceled'].includes(providerStatus)) return 'failed';
    return 'pending'; // For processing, requires_action, etc.
  }
  
  if (PAYMENT_PROVIDER === 'square') {
    // Map Square payment statuses to our internal statuses
    if (['approved', 'completed'].includes(providerStatus.toLowerCase())) return 'succeeded';
    if (['failed', 'canceled', 'cancelled'].includes(providerStatus.toLowerCase())) return 'failed';
    return 'pending'; // For pending, processing, etc.
  }
  
  return 'pending';
}

// Get database field name for payment intent ID (provider-specific until migration)
function getPaymentIntentFieldName(): string {
  // Now using generic payment_intent_id for all providers
  return 'payment_intent_id';
  }
}

serve(async (req) => {
  // This function is designed to be triggered by a schedule (cron job), not HTTP requests.
  // We might add a check here later to ensure it's triggered correctly if needed.
  console.log(`Starting sync-pending-payments function run for provider: ${PAYMENT_PROVIDER}...`);

  const supabaseAdmin = getSupabaseAdminClient();

  // Calculate the cutoff time
  const cutoffDate = new Date();
  cutoffDate.setMinutes(cutoffDate.getMinutes() - PENDING_THRESHOLD_MINUTES);
  const cutoffIsoString = cutoffDate.toISOString();

  try {
    // 1. Find old pending payments with a payment intent ID
    const paymentIntentField = getPaymentIntentFieldName();
    const { data: pendingPayments, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select(`id, ${paymentIntentField}`)
      .eq('status', 'pending')
      .not(paymentIntentField, 'is', null)
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

    // 2. Check each payment with provider and update DB if necessary
    for (const payment of pendingPayments) {
      const paymentIntentId = (payment as any)[paymentIntentField] as string;
      if (!paymentIntentId) continue; // Should not happen due to query, but safety check

      try {
        console.log(
          `Checking ${PAYMENT_PROVIDER} PI status for ${paymentIntentId} (DB ID: ${(payment as any).id})`,
        );
        const paymentIntentData = await retrievePaymentIntent(paymentIntentId);

        let dbUpdateData: Partial<Database['public']['Tables']['payments']['Update']> | null = null;
        const dbStatus = mapProviderStatusToDbStatus(paymentIntentData.status);

        if (dbStatus === 'succeeded') {
          console.log(`${PAYMENT_PROVIDER} PI ${paymentIntentData.id} status is 'succeeded'. Preparing DB update.`);
          dbUpdateData = {
            status: 'succeeded',
            payment_date: new Date().toISOString(), // Use current time as payment date approximation
            receipt_url: paymentIntentData.receiptUrl,
            payment_method: paymentIntentData.paymentMethod,
          };
        } else if (dbStatus === 'failed') {
          console.log(
            `${PAYMENT_PROVIDER} PI ${paymentIntentData.id} status is '${paymentIntentData.status}'. Preparing DB update to 'failed'.`,
          );
          dbUpdateData = {
            status: 'failed',
            payment_date: new Date().toISOString(), // Use current time as failure date approximation
          };
        } else {
          // For other statuses (processing, requires_action, etc.), leave the DB as pending.
          console.log(
            `${PAYMENT_PROVIDER} PI ${paymentIntentData.id} status is '${paymentIntentData.status}'. No DB update needed.`,
          );
        }

        // Perform DB update if status needs changing
        if (dbUpdateData) {
          const { error: updateError } = await supabaseAdmin
            .from('payments')
            .update(dbUpdateData)
            .eq('id', (payment as any).id);

          if (updateError) {
            console.error(
              `Failed to update payment ${(payment as any).id} status in DB:`,
              updateError.message,
            );
            failedCount++;
            // Continue to next payment
          } else {
            console.log(`Successfully updated payment ${(payment as any).id} status in DB.`);
            updatedCount++;
          }
        }
      } catch (providerError) {
        console.error(
          `Error retrieving or processing ${PAYMENT_PROVIDER} PI ${paymentIntentId} for payment ${(payment as any).id}:`,
          providerError instanceof Error ? providerError.message : providerError,
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
