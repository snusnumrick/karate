/**
 * Test webhook endpoint that goes through the full webhook flow
 * ONLY works in development mode
 */
import type { ActionFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import { getPaymentProvider } from '~/services/payments/index.server';
import { handlePaymentWebhook } from '~/services/payments/webhook.server';

export async function action({ request }: ActionFunctionArgs) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return json({ error: 'Not available in production' }, { status: 403 });
  }

  const body = await request.json();
  const {
    paymentId,
    status = 'COMPLETED',
  } = body;

  // Use consistent IDs based on paymentId for idempotency testing
  // This ensures the same paymentId always generates the same Square payment ID
  const squarePaymentId = `test-square-${paymentId}`;

  if (!paymentId) {
    return json({ error: 'paymentId required in request body' }, { status: 400 });
  }

  // Fetch actual payment details from database
  const { getSupabaseAdminClient } = await import('~/utils/supabase.server');
  const supabase = getSupabaseAdminClient();

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('type, family_id, subtotal_amount, total_amount, discount_amount')
    .eq('id', paymentId)
    .single();

  if (paymentError) {
    console.error(`[Test Full Webhook] Database error:`, paymentError);
    return json({
      error: `Payment query failed: ${paymentError.message}`,
      code: paymentError.code,
      details: paymentError.details
    }, { status: 500 });
  }

  if (!payment) {
    return json({ error: `Payment not found: ${paymentId}` }, { status: 404 });
  }

  const type = payment.type;
  const familyId = payment.family_id;
  const subtotal_amount = String(payment.subtotal_amount || 0);
  const total_amount = String(payment.total_amount || 0);
  // Calculate tax as total - subtotal (since tax_amount column doesn't exist)
  const tax_amount = String((payment.total_amount || 0) - (payment.subtotal_amount || 0));

  // Create a mock Square webhook payload
  // Note: Square webhooks don't have an event_id at the root level
  const mockPayload = JSON.stringify({
    type: 'payment.updated',
    data: {
      object: {
        payment: {
          id: squarePaymentId,
          status: status,
          reference_id: paymentId,
          note: JSON.stringify({
            paymentId: paymentId,
            type: type,
            familyId: familyId,
            subtotal_amount: subtotal_amount,
            total_amount: total_amount,
            tax_amount: tax_amount,
          })
        }
      }
    }
  });

  console.log(`[Test Full Webhook] Simulating full webhook flow for payment ${paymentId}`);

  try {
    const provider = getPaymentProvider();

    if (provider.id !== 'square') {
      return json({ error: 'This test only works with Square provider' }, { status: 400 });
    }

    // Create mock headers (skip signature verification by using parseWebhookEvent internals)
    const mockHeaders = new Headers({
      'content-type': 'application/json',
      'x-square-hmacsha256-signature': 'bypass',
      'x-request-id': 'test-' + Date.now(),
    });

    // Call handlePaymentWebhook with bypass header for dev mode
    const result = await handlePaymentWebhook(
      provider,
      mockPayload,
      mockHeaders,
      request.url
    );

    console.log(`[Test Full Webhook] Result:`, result);

    if (result.success) {
      return json({
        success: true,
        paymentId,
        isDuplicate: result.isDuplicate,
        message: result.isDuplicate
          ? 'Webhook event already processed (idempotency working!)'
          : 'Webhook processed successfully'
      });
    } else {
      return json({
        success: false,
        error: result.error,
        paymentId
      }, { status: 400 });
    }
  } catch (error) {
    console.error(`[Test Full Webhook] Error:`, error);
    return json({
      error: error instanceof Error ? error.message : 'Unknown error',
      paymentId
    }, { status: 500 });
  }
}
