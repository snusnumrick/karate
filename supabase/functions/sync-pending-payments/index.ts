import {serve} from "https://deno.land/std@0.177.0/http/server.ts";
import {getSupabaseAdminClient} from '../_shared/supabase.ts';
import Stripe from 'https://esm.sh/stripe@15.7.0?target=deno';
import {corsHeaders} from '../_shared/cors.ts';
import type {Database} from '../_shared/database.types.ts';

type ProviderId = 'stripe' | 'square';

// Stripe configuration
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null;

if (!stripeSecretKey) {
  console.warn('[sync-pending-payments] STRIPE_SECRET_KEY not found. Stripe checks will be skipped.');
}

// Square configuration
const squareAccessToken = Deno.env.get('SQUARE_ACCESS_TOKEN');
const squareEnvironmentRaw = (Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox').toLowerCase();
const squareEnvironment: 'sandbox' | 'production' = squareEnvironmentRaw === 'production' ? 'production' : 'sandbox';
const squareApiBaseUrl = squareEnvironment === 'production'
  ? 'https://connect.squareup.com'
  : 'https://connect.squareupsandbox.com';
const squareApiVersion = '2024-08-15';

if (!squareAccessToken) {
  console.warn('[sync-pending-payments] SQUARE_ACCESS_TOKEN not found. Square checks will be skipped.');
}

// Using shared Supabase admin client utility

// Define the threshold for checking pending payments (e.g., 15 minutes)
const PENDING_THRESHOLD_MINUTES = 15;

interface ProviderIntentInfo {
  id: string;
  status: string;
  receiptUrl: string | null;
  paymentMethod: string | null;
  cardLast4?: string | null;
}

type PendingPaymentRecord = Pick<Database['public']['Tables']['payments']['Row'], 'id' | 'payment_intent_id' | 'created_at'>;

type SquareRetrievePaymentResponse = {
  payment?: {
    id?: string;
    status?: string;
    receipt_url?: string;
    source_type?: string;
    amount_money?: {
      amount?: number | null;
      currency?: string | null;
    };
    card_details?: {
      card?: {
        last_4?: string;
      };
    };
  };
  errors?: Array<{
    code?: string;
    detail?: string;
  }>;
};

type StripeChargeLike = {
  receipt_url?: string | null;
  payment_method_details?: {
    type?: string | null;
    card?: {
      last4?: string | null;
    };
  };
};

function detectProvider(paymentIntentId: string | null): ProviderId | null {
  if (!paymentIntentId) return null;

  if (paymentIntentId.startsWith('pi_')) {
    return 'stripe';
  }

  if (paymentIntentId.startsWith('karate_')) {
    return squareAccessToken ? 'square' : stripe ? 'stripe' : null;
  }

  if (squareAccessToken) {
    return 'square';
  }

  if (stripe) {
    return 'stripe';
  }

  return null;
}

async function retrievePaymentIntent(provider: ProviderId, paymentIntentId: string): Promise<ProviderIntentInfo> {
  if (provider === 'stripe') {
    if (!stripe) {
      throw new Error('Stripe client not configured');
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });

    let receiptUrl: string | null = null;
    let paymentMethod: string | null = paymentIntent.payment_method_types?.[0] ?? null;
    let cardLast4: string | null = null;

    if (paymentIntent.latest_charge && typeof paymentIntent.latest_charge === 'object') {
      const latestCharge = paymentIntent.latest_charge as StripeChargeLike;
      receiptUrl = latestCharge.receipt_url ?? receiptUrl;
      const details = latestCharge.payment_method_details;
      if (details) {
        paymentMethod = details.type ?? paymentMethod;
        if (details.card && details.card.last4) {
          cardLast4 = details.card.last4 ?? null;
        }
      }
    }

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      receiptUrl,
      paymentMethod,
      cardLast4,
    };
  }

  if (provider === 'square') {
    if (!squareAccessToken) {
      throw new Error('Square access token not configured');
    }

    if (paymentIntentId.startsWith('karate_')) {
      return {
        id: paymentIntentId,
        status: 'PENDING',
        receiptUrl: null,
        paymentMethod: null,
      };
    }

    const url = `${squareApiBaseUrl}/v2/payments/${paymentIntentId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${squareAccessToken}`,
        'Square-Version': squareApiVersion,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      console.warn(`[sync-pending-payments] Square payment ${paymentIntentId} not found (404). Treating as pending.`);
      return {
        id: paymentIntentId,
        status: 'PENDING',
        receiptUrl: null,
        paymentMethod: null,
      };
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Square API responded with ${response.status}: ${errorBody || 'No body'}`);
    }

    const payload = (await response.json()) as SquareRetrievePaymentResponse;

    if (!payload.payment) {
      if (payload.errors?.length) {
        console.warn('[sync-pending-payments] Square API returned errors:', payload.errors);
      }
      return {
        id: paymentIntentId,
        status: 'PENDING',
        receiptUrl: null,
        paymentMethod: null,
      };
    }

    const payment = payload.payment;
    const status = typeof payment.status === 'string' ? payment.status : 'PENDING';
    const receiptUrl = typeof payment.receipt_url === 'string' ? payment.receipt_url : null;
    const paymentMethod = typeof payment.source_type === 'string' ? payment.source_type.toLowerCase() : null;
    const cardLast4 = payment.card_details?.card?.last_4 ?? null;

    return {
      id: payment.id ?? paymentIntentId,
      status,
      receiptUrl,
      paymentMethod,
      cardLast4,
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

function mapProviderStatusToDbStatus(provider: ProviderId, providerStatus: string): 'succeeded' | 'failed' | 'pending' {
  const normalizedStatus = providerStatus.toLowerCase();

  if (provider === 'stripe') {
    if (normalizedStatus === 'succeeded') return 'succeeded';
    if (['requires_payment_method', 'canceled', 'cancelled'].includes(normalizedStatus)) return 'failed';
    return 'pending';
  }

  if (provider === 'square') {
    if (['approved', 'completed', 'captured'].includes(normalizedStatus)) return 'succeeded';
    if (['failed', 'canceled', 'cancelled', 'declined'].includes(normalizedStatus)) return 'failed';
    return 'pending';
  }

  return 'pending';
}

serve(async (req) => {
  // This function is designed to be triggered by a schedule (cron job), not HTTP requests.
  // We might add a check here later to ensure it's triggered correctly if needed.
  const enabledProviders: string[] = [];
  if (stripe) enabledProviders.push('stripe');
  if (squareAccessToken) enabledProviders.push(`square (${squareEnvironment})`);

  console.log(
    `[sync-pending-payments] Starting function run. Enabled providers: ` +
      `${enabledProviders.length > 0 ? enabledProviders.join(', ') : 'none'}.`
  );

  const supabaseAdmin = getSupabaseAdminClient();

  // Calculate the cutoff time
  const cutoffDate = new Date();
  cutoffDate.setMinutes(cutoffDate.getMinutes() - PENDING_THRESHOLD_MINUTES);
  const cutoffIsoString = cutoffDate.toISOString();

  try {
    // 1. Find old pending payments with a payment intent ID
    const { data: pendingPayments, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('id, payment_intent_id, created_at')
      .eq('status', 'pending')
      .not('payment_intent_id', 'is', null)
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

    const statusBreakdown: Record<ProviderId, Record<string, number>> = {
      stripe: {},
      square: {},
    };
    const skippedRecords: Array<{ id: string; intentId: string | null; reason: string }> = [];

    if (!pendingPayments || pendingPayments.length === 0) {
      console.log('[sync-pending-payments] No old pending payments found requiring sync.');
      const responseBody = {
        message: 'No old pending payments found.',
        totals: {
          checked: 0,
          updated: 0,
          failed: 0,
        },
        statusBreakdown,
        skipped: skippedRecords,
      };
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pendingPaymentRecords = (pendingPayments ?? []) as PendingPaymentRecord[];

    console.log(`[sync-pending-payments] Found ${pendingPaymentRecords.length} old pending payment(s) to check.`);
    let updatedCount = 0;
    let failedCount = 0;

    // 2. Check each payment with provider and update DB if necessary
    for (const paymentRecord of pendingPaymentRecords) {
      const paymentIntentId = paymentRecord.payment_intent_id;
      if (!paymentIntentId) continue; // Should not happen due to query, but safety check

      const provider = detectProvider(paymentIntentId);
      if (!provider) {
        console.warn(
          `[sync-pending-payments] Unable to determine provider for payment ${paymentRecord.id} (intent ${paymentIntentId}). Skipping.`
        );
        failedCount++;
        skippedRecords.push({
          id: paymentRecord.id,
          intentId: paymentIntentId,
          reason: 'unknown-provider',
        });
        continue;
      }

      if (provider === 'stripe' && !stripe) {
        console.warn(
          `[sync-pending-payments] Stripe client not configured. Cannot check payment ${paymentRecord.id} (intent ${paymentIntentId}).`
        );
        failedCount++;
        skippedRecords.push({
          id: paymentRecord.id,
          intentId: paymentIntentId,
          reason: 'stripe-client-missing',
        });
        continue;
      }

      if (provider === 'square' && !squareAccessToken) {
        console.warn(
          `[sync-pending-payments] Square credentials not configured. Cannot check payment ${paymentRecord.id} (intent ${paymentIntentId}).`
        );
        failedCount++;
        skippedRecords.push({
          id: paymentRecord.id,
          intentId: paymentIntentId,
          reason: 'square-credentials-missing',
        });
        continue;
      }

      try {
        const createdAtIso = paymentRecord.created_at;

        console.log(
          `[sync-pending-payments] Checking ${provider} intent ${paymentIntentId} (payment ${paymentRecord.id}) createdAt=${createdAtIso ?? 'unknown'}.`
        );

        const isSquareReference = provider === 'square' && paymentIntentId.startsWith('karate_');

        if (isSquareReference) {
          console.log(
            `[sync-pending-payments] Expiring stale Square reference ${paymentIntentId} for payment ${paymentRecord.id}.`
          );

          const expirationUpdate: Database['public']['Tables']['payments']['Update'] = {
            status: 'failed',
            payment_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { error: expireError } = await supabaseAdmin
            .from('payments')
            .update(expirationUpdate)
            .eq('id', paymentRecord.id);

          if (expireError) {
            console.error(
              `[sync-pending-payments] Failed to expire placeholder Square intent ${paymentIntentId} for payment ${paymentRecord.id}:`,
              expireError.message,
            );
            failedCount++;
          } else {
            statusBreakdown.square.reference = (statusBreakdown.square.reference ?? 0) + 1;
            console.log(
              `[sync-pending-payments] Marked placeholder Square intent ${paymentIntentId} as failed for payment ${paymentRecord.id}.`
            );
            updatedCount++;
          }

          continue;
        }

        const paymentIntentData = await retrievePaymentIntent(provider, paymentIntentId);

        const rawStatus = paymentIntentData.status ?? 'unknown';
        const normalizedStatus = rawStatus.toString().toLowerCase();
        statusBreakdown[provider][normalizedStatus] =
          (statusBreakdown[provider][normalizedStatus] ?? 0) + 1;

        let dbUpdateData: Partial<Database['public']['Tables']['payments']['Update']> | null = null;
        const dbStatus = mapProviderStatusToDbStatus(provider, rawStatus);

        if (dbStatus === 'succeeded') {
          console.log(
            `[sync-pending-payments] ${provider} intent ${paymentIntentData.id} succeeded. Preparing DB update for payment ${paymentRecord.id}.`
          );
          dbUpdateData = {
            status: 'succeeded',
            payment_date: new Date().toISOString(),
          };
        } else if (dbStatus === 'failed') {
          console.log(
            `[sync-pending-payments] ${provider} intent ${paymentIntentData.id} failed (${paymentIntentData.status}). Preparing DB update for payment ${paymentRecord.id}.`
          );
          dbUpdateData = {
            status: 'failed',
            payment_date: new Date().toISOString(),
          };
        } else {
          console.log(
            `[sync-pending-payments] ${provider} intent ${paymentIntentData.id} still ${paymentIntentData.status}. Leaving payment ${paymentRecord.id} as pending.`
          );
          if (provider === 'square' && paymentIntentId.startsWith('karate_')) {
            console.log(
              `[sync-pending-payments] Square intent ${paymentIntentId} remains a client reference (no Square payment created yet).`
            );
          }
        }

        if (dbUpdateData) {
          if (paymentIntentData.receiptUrl) {
            dbUpdateData.receipt_url = paymentIntentData.receiptUrl;
          }
          if (paymentIntentData.paymentMethod) {
            dbUpdateData.payment_method = paymentIntentData.paymentMethod;
          }
          if (paymentIntentData.cardLast4) {
            dbUpdateData.card_last4 = paymentIntentData.cardLast4;
          }
          if (paymentIntentData.id && paymentIntentData.id !== paymentIntentId) {
            dbUpdateData.payment_intent_id = paymentIntentData.id;
          }

          const { error: updateError } = await supabaseAdmin
            .from('payments')
            .update(dbUpdateData)
            .eq('id', paymentRecord.id);

          if (updateError) {
            console.error(
              `[sync-pending-payments] Failed to update payment ${paymentRecord.id} status in DB:`,
              updateError.message,
            );
            failedCount++;
          } else {
            console.log(`[sync-pending-payments] Successfully updated payment ${paymentRecord.id} status to ${dbUpdateData.status}.`);
            updatedCount++;
          }
        }
      } catch (providerError) {
        console.error(
          `[sync-pending-payments] Error retrieving or processing ${provider} intent ${paymentIntentId} for payment ${paymentRecord.id}:`,
          providerError instanceof Error ? providerError.message : providerError,
        );
        failedCount++;
        // Continue to next payment
      }
    } // End for loop

    const summary =
      `Sync completed. Checked: ${pendingPaymentRecords.length}, Updated: ${updatedCount}, Failed checks/updates: ${failedCount}.`;
    console.log(summary);
    console.log('[sync-pending-payments] Status breakdown:', statusBreakdown);
    if (skippedRecords.length > 0) {
      console.log('[sync-pending-payments] Skipped records:', skippedRecords);
    }

    const responseBody = {
      message: summary,
      totals: {
        checked: pendingPaymentRecords.length,
        updated: updatedCount,
        failed: failedCount,
      },
      statusBreakdown,
      skipped: skippedRecords,
    };

    return new Response(JSON.stringify(responseBody), {
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
