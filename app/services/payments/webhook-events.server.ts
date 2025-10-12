/**
 * Webhook Event Service
 * Handles logging, idempotency, and audit trail for payment provider webhooks
 */

import { getSupabaseAdminClient } from '~/utils/supabase.server';
import type { PaymentProviderId } from './types.server';

export interface WebhookEventData {
  provider: PaymentProviderId;
  eventId: string;
  eventType: string;
  rawType?: string;
  rawPayload: Record<string, unknown>;
  parsedMetadata?: Record<string, string>;
  requestId?: string;
  sourceIp?: string;
  signatureVerified?: boolean;
}

export interface WebhookEventRecord {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'duplicate';
  received_at: string;
  processed_at?: string | null;
  error_message?: string | null;
  payment_id?: string | null;
}

/**
 * Check if a webhook event has already been processed
 * @returns Object with isDuplicate flag and existing record if found
 */
export async function checkWebhookIdempotency(
  provider: PaymentProviderId,
  eventId: string
): Promise<{ isDuplicate: boolean; existingEvent?: WebhookEventRecord }> {
  const supabaseAdmin = getSupabaseAdminClient();

  const { data: existingEvent, error } = await supabaseAdmin
    .from('webhook_events')
    .select('*')
    .eq('provider', provider)
    .eq('event_id', eventId)
    .single();

  if (error) {
    // No existing event found or other error
    if (error.code === 'PGRST116') {
      // No rows returned - not a duplicate
      return { isDuplicate: false };
    }
    console.error(`[WebhookEventService] Error checking idempotency:`, error.message);
    return { isDuplicate: false };
  }

  // Event already exists
  console.warn(
    `[WebhookEventService] Duplicate webhook detected: provider=${provider} ` +
    `eventId=${eventId} status=${existingEvent.status} processedAt=${existingEvent.processed_at}`
  );

  return {
    isDuplicate: true,
    existingEvent: existingEvent as WebhookEventRecord,
  };
}

/**
 * Create a new webhook event record
 */
export async function createWebhookEvent(data: WebhookEventData): Promise<string> {
  const supabaseAdmin = getSupabaseAdminClient();

  const { data: event, error } = await supabaseAdmin
    .from('webhook_events')
    .insert({
      provider: data.provider,
      event_id: data.eventId,
      event_type: data.eventType,
      raw_type: data.rawType,
      raw_payload: data.rawPayload as unknown as Record<string, never>,
      parsed_metadata: (data.parsedMetadata || {}) as unknown as Record<string, never>,
      request_id: data.requestId,
      source_ip: data.sourceIp,
      signature_verified: data.signatureVerified ?? true,
      status: 'processing',
      received_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    // Check if it's a unique constraint violation (duplicate event_id)
    if (error.code === '23505') {
      console.warn(`[WebhookEventService] Duplicate event detected during insert: ${data.eventId}`);
      throw new Error('DUPLICATE_EVENT');
    }
    console.error(`[WebhookEventService] Failed to create webhook event:`, error.message);
    throw new Error(`Failed to create webhook event: ${error.message}`);
  }

  return event.id;
}

/**
 * Update webhook event status to succeeded
 */
export async function markWebhookEventSucceeded(
  webhookEventId: string,
  paymentId?: string,
  processingStartTime?: number
): Promise<void> {
  const supabaseAdmin = getSupabaseAdminClient();

  const processingDuration = processingStartTime
    ? Date.now() - processingStartTime
    : null;

  const { error } = await supabaseAdmin
    .from('webhook_events')
    .update({
      status: 'succeeded',
      processed_at: new Date().toISOString(),
      payment_id: paymentId || null,
      processing_duration_ms: processingDuration,
    })
    .eq('id', webhookEventId);

  if (error) {
    console.error(`[WebhookEventService] Failed to mark webhook succeeded:`, error.message);
  }
}

/**
 * Update webhook event status to failed with error details
 */
export async function markWebhookEventFailed(
  webhookEventId: string,
  errorMessage: string,
  errorDetails?: Record<string, unknown>,
  processingStartTime?: number
): Promise<void> {
  const supabaseAdmin = getSupabaseAdminClient();

  const processingDuration = processingStartTime
    ? Date.now() - processingStartTime
    : null;

  const { error } = await supabaseAdmin
    .from('webhook_events')
    .update({
      status: 'failed',
      processed_at: new Date().toISOString(),
      error_message: errorMessage,
      error_details: (errorDetails || null) as unknown as Record<string, never> | null,
      processing_duration_ms: processingDuration,
    })
    .eq('id', webhookEventId);

  if (error) {
    console.error(`[WebhookEventService] Failed to mark webhook failed:`, error.message);
  }
}

/**
 * Mark webhook event as duplicate
 */
export async function markWebhookEventDuplicate(webhookEventId: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdminClient();

  const { error } = await supabaseAdmin
    .from('webhook_events')
    .update({
      status: 'duplicate',
      processed_at: new Date().toISOString(),
    })
    .eq('id', webhookEventId);

  if (error) {
    console.error(`[WebhookEventService] Failed to mark webhook duplicate:`, error.message);
  }
}

/**
 * Increment retry count for a webhook event
 */
export async function incrementWebhookRetryCount(webhookEventId: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdminClient();

  // Fetch current retry count, increment, and update
  const { data: currentEvent } = await supabaseAdmin
    .from('webhook_events')
    .select('retry_count')
    .eq('id', webhookEventId)
    .single();

  if (currentEvent) {
    const { error } = await supabaseAdmin
      .from('webhook_events')
      .update({
        retry_count: (currentEvent.retry_count || 0) + 1,
      })
      .eq('id', webhookEventId);

    if (error) {
      console.error(`[WebhookEventService] Failed to increment retry count:`, error.message);
    }
  }
}
