/**
 * Test webhook endpoint for local development
 * ONLY works in development mode
 */
import type { ActionFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import { updatePaymentStatus } from '~/utils/supabase.server';
import type { Database } from '~/types/database.types';

export async function action({ request }: ActionFunctionArgs) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return json({ error: 'Not available in production' }, { status: 403 });
  }

  const body = await request.json();
  const {
    paymentId,
    status = 'succeeded',
    type,
    familyId,
    students = []
  } = body;

  if (!paymentId) {
    return json({ error: 'paymentId required in request body' }, { status: 400 });
  }

  console.log(`[Test Webhook] Manually triggering updatePaymentStatus for payment ${paymentId}`);

  try {
    await updatePaymentStatus(
      paymentId,
      status as 'pending' | 'succeeded' | 'failed',
      null, // receiptUrl
      'test_card', // paymentMethod
      'test-intent-' + Date.now(), // paymentIntentId
      type as Database['public']['Enums']['payment_type_enum'], // type
      familyId,
      students.length > 0 ? students.length : undefined,
      undefined, // subtotalAmountFromMeta
      undefined, // taxAmountFromMeta
      undefined, // totalAmountFromMeta
      '4242' // cardLast4
    );

    console.log(`[Test Webhook] Successfully updated payment ${paymentId} to ${status}`);

    return json({
      success: true,
      paymentId,
      status,
      message: 'Payment status updated successfully'
    });
  } catch (error) {
    console.error(`[Test Webhook] Error updating payment:`, error);
    return json({
      error: error instanceof Error ? error.message : 'Unknown error',
      paymentId
    }, { status: 500 });
  }
}
