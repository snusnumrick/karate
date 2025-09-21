import type { Database } from '~/types/database.types';
import { updatePaymentStatus, getSupabaseAdminClient } from '~/utils/supabase.server';
import { toCents } from '~/utils/money';
import type { PaymentProvider, ParsedWebhookEvent } from './types.server';

function parseInteger(metaValue: string | undefined): number | null {
  if (!metaValue) return null;
  const parsed = parseInt(metaValue, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function handlePaymentWebhook(
  provider: PaymentProvider,
  payload: string,
  headers: Headers
): Promise<{ success: boolean; error?: string }> {
  try {
    const event = await provider.parseWebhookEvent(payload, headers);
    const { intent } = event;
    const metadata = intent.metadata ?? {};

    if (event.type === 'payment.succeeded') {
      return await handlePaymentSuccess(provider, event, metadata);
    }

    if (event.type === 'payment.failed') {
      return await handlePaymentFailure(provider, event, metadata);
    }

    if (event.type === 'payment.processing') {
      console.log(`[Webhook ${provider.id}] Received processing event (${event.rawType}) for intent ${intent.id}. No action taken.`);
      return { success: true };
    }

    // Handle additional events that don't require action but should be acknowledged
    if (['mandate.updated', 'charge.succeeded', 'charge.updated'].includes(event.rawType)) {
      console.log(`[Webhook ${provider.id}] Received ${event.rawType} event. No action required - acknowledged.`);
      return { success: true };
    }

    console.log(`[Webhook ${provider.id}] Unhandled event type: ${event.rawType}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Webhook ${provider.id}] Error processing webhook:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function handlePaymentSuccess(
  provider: PaymentProvider,
  event: ParsedWebhookEvent,
  metadata: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const { intent } = event;
  const supabasePaymentId = metadata.paymentId;
  const type = metadata.type as Database['public']['Enums']['payment_type_enum'] | undefined;
  const familyId = metadata.familyId;
  const quantityStr = metadata.quantity;
  const orderId = metadata.orderId;
  const subtotalAmountFromMeta = parseInteger(metadata.subtotal_amount);
  const taxAmountFromMeta = parseInteger(metadata.tax_amount);
  const totalAmountFromMeta = parseInteger(metadata.total_amount);

  let quantity: number | null = null;
  if (quantityStr) {
    const parsedQuantity = parseInt(quantityStr, 10);
    quantity = !Number.isNaN(parsedQuantity) ? parsedQuantity : null;
  }

  if (!supabasePaymentId || !type || !familyId || subtotalAmountFromMeta === null || taxAmountFromMeta === null || totalAmountFromMeta === null || (type === 'store_purchase' && !orderId)) {
    console.error(`[Webhook ${provider.id}] CRITICAL: Missing required metadata in success event ${intent.id}. Metadata:`, metadata);
    return { success: false, error: "Missing critical payment metadata" };
  }

  let receiptUrl: string | null = null;
  let paymentMethodString = intent.paymentMethodType ?? null;
  let cardLast4: string | null = null;
  let totalAmountCharged = intent.amount;

  try {
    const enrichedIntent = await provider.retrievePaymentIntent(intent.id, {
      includePaymentMethod: true,
      includeLatestCharge: true,
    });
    receiptUrl = enrichedIntent.receiptUrl ?? null;
    paymentMethodString = enrichedIntent.paymentMethodType ?? paymentMethodString;
    cardLast4 = enrichedIntent.cardLast4 ?? null;
    totalAmountCharged = toCents(enrichedIntent.amount);
  } catch (retrieveError) {
    console.error(`[Webhook ${provider.id}] Failed to retrieve payment intent ${intent.id} details:`, retrieveError instanceof Error ? retrieveError.message : retrieveError);
  }

  if (totalAmountCharged !== undefined && totalAmountCharged !== totalAmountFromMeta) {
    console.error(`[Webhook ${provider.id}] CRITICAL: Amount mismatch! Provider charged ${totalAmountCharged}, but metadata total was ${totalAmountFromMeta} for intent ${intent.id}.`);
    return { success: false, error: "Amount mismatch detected" };
  }

  try {
    console.log(`[Webhook ${provider.id}] Calling updatePaymentStatus for paymentId: ${supabasePaymentId}`);
    await updatePaymentStatus(
      supabasePaymentId,
      "succeeded",
      receiptUrl,
      paymentMethodString,
      intent.id,
      type,
      familyId,
      quantity,
      subtotalAmountFromMeta,
      taxAmountFromMeta,
      totalAmountFromMeta,
      cardLast4
    );
    console.log(`[Webhook ${provider.id}] updatePaymentStatus finished successfully for paymentId: ${supabasePaymentId}`);

    if (type === 'store_purchase' && orderId) {
      await handleStorePurchaseSuccess(provider.id, orderId);
    }

    if (type === 'event_registration') {
      await handleEventRegistrationSuccess(provider.id, supabasePaymentId);
    }

    return { success: true };
  } catch (updateError) {
    console.error(`[Webhook ${provider.id}] Failed during post-payment processing for Supabase payment ${supabasePaymentId}:`, updateError instanceof Error ? updateError.message : updateError);
    return { success: false, error: "Database update or post-processing failed" };
  }
}

async function handlePaymentFailure(
  provider: PaymentProvider,
  event: ParsedWebhookEvent,
  metadata: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const { intent } = event;
  console.warn(`[Webhook ${provider.id}] Processing payment failure for intent: ${intent.id}`);

  const supabasePaymentId = metadata.paymentId;
  const orderId = metadata.orderId;
  const type = metadata.type as Database['public']['Enums']['payment_type_enum'] | undefined;

  if (!supabasePaymentId) {
    console.error(`[Webhook ${provider.id}] CRITICAL: Missing paymentId metadata in payment failure event ${intent.id}.`);
    return { success: false, error: "Missing paymentId metadata" };
  }

  let failedPaymentMethodString = intent.paymentMethodType ?? null;
  let failedCardLast4: string | null = null;

  try {
    const enrichedIntent = await provider.retrievePaymentIntent(intent.id, { includePaymentMethod: true });
    failedPaymentMethodString = enrichedIntent.paymentMethodType ?? failedPaymentMethodString;
    failedCardLast4 = enrichedIntent.cardLast4 ?? null;
  } catch {
    console.warn(`[Webhook ${provider.id}] Could not retrieve payment intent ${intent.id} to get card details for failed payment.`);
  }

  try {
    await updatePaymentStatus(
      supabasePaymentId,
      "failed",
      null,
      failedPaymentMethodString,
      intent.id,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      failedCardLast4
    );

    if (type === 'store_purchase' && orderId) {
      await handleStorePurchaseFailure(provider.id, orderId);
    }

    return { success: true };
  } catch (updateError) {
    console.error(`[Webhook ${provider.id}] Failed during post-payment processing for Supabase payment ${supabasePaymentId}:`, updateError instanceof Error ? updateError.message : updateError);
    return { success: false, error: "Database update or post-processing failed" };
  }
}

async function handleStorePurchaseSuccess(providerId: string, orderId: string) {
  console.log(`[Webhook ${providerId}] Processing successful store purchase for order ${orderId}`);
  const supabaseAdmin = getSupabaseAdminClient();

  console.log(`[Webhook ${providerId}] Updating order status for orderId: ${orderId}`);
  const { error: orderUpdateError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'paid_pending_pickup', updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (orderUpdateError) {
    console.error(`[Webhook ${providerId}] FAILED to update order ${orderId} status:`, orderUpdateError.message);
  } else {
    console.log(`[Webhook ${providerId}] Successfully updated order ${orderId} status to paid_pending_pickup.`);
  }

  console.log(`[Webhook ${providerId}] Decrementing stock for orderId: ${orderId}`);
  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('product_variant_id, quantity')
    .eq('order_id', orderId);

  if (itemsError) {
    console.error(`[Webhook ${providerId}] FAILED to fetch order items for order ${orderId} to decrement stock:`, itemsError.message);
  } else if (orderItems) {
    for (const item of orderItems) {
      console.log(`[Webhook ${providerId}] Decrementing stock for variant: ${item.product_variant_id} by ${item.quantity}`);
      const { error: stockDecrementError } = await supabaseAdmin.rpc('decrement_variant_stock', {
        variant_id: item.product_variant_id,
        decrement_quantity: item.quantity
      });

      if (stockDecrementError) {
        if (stockDecrementError.code === '42883') {
          console.error(`[Webhook ${providerId}] RPC function 'decrement_variant_stock' not found. Stock not decremented for variant ${item.product_variant_id}.`);
        } else {
          console.error(`[Webhook ${providerId}] FAILED to decrement stock for variant ${item.product_variant_id} (Order ${orderId}):`, stockDecrementError.message);
        }
      } else {
        console.log(`[Webhook ${providerId}] Decremented stock for variant ${item.product_variant_id} by ${item.quantity} (Order ${orderId}).`);
      }
    }
    console.log(`[Webhook ${providerId}] Stock decrement process finished for orderId: ${orderId}`);
  }
}

async function handleStorePurchaseFailure(providerId: string, orderId: string) {
  console.log(`[Webhook ${providerId}] Processing failed store purchase for order ${orderId}`);
  const supabaseAdmin = getSupabaseAdminClient();
  const { error: orderUpdateError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (orderUpdateError) {
    console.error(`[Webhook ${providerId}] FAILED to update order ${orderId} status to cancelled:`, orderUpdateError.message);
  } else {
    console.log(`[Webhook ${providerId}] Successfully updated order ${orderId} status to cancelled.`);
  }
}

async function handleEventRegistrationSuccess(providerId: string, paymentId: string) {
  console.log(`[Webhook ${providerId}] Processing successful event registration payment for paymentId: ${paymentId}`);
  const supabaseAdmin = getSupabaseAdminClient();

  console.log(`[Webhook ${providerId}] Checking for event registrations with paymentId: ${paymentId}`);
  const { data: existingRegistrations, error: checkError } = await supabaseAdmin
    .from('event_registrations')
    .select('id, registration_status')
    .eq('payment_id', paymentId);

  if (checkError) {
    console.error(`[Webhook ${providerId}] ERROR checking event registrations for payment ${paymentId}:`, checkError.message);
  } else if (!existingRegistrations || existingRegistrations.length === 0) {
    console.warn(`[Webhook ${providerId}] No event registrations found for payment ${paymentId}`);
  } else {
    console.log(`[Webhook ${providerId}] Found ${existingRegistrations.length} event registration(s) for payment ${paymentId}:`, existingRegistrations);

    const { error: updateRegistrationError } = await supabaseAdmin
      .from('event_registrations')
      .update({
        registration_status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('payment_id', paymentId);

    if (updateRegistrationError) {
      console.error(`[Webhook ${providerId}] Failed to update event registrations for payment ${paymentId}:`, updateRegistrationError.message);
    } else {
      console.log(`[Webhook ${providerId}] Updated event registrations to confirmed for payment ${paymentId}.`);
    }
  }
}