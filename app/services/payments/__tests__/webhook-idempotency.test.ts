import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkWebhookIdempotency, createWebhookEvent } from '../webhook-events.server';

// Mock Supabase
const mockSupabaseAdmin = {
  from: vi.fn(),
};

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseAdminClient: () => mockSupabaseAdmin,
}));

describe('Webhook Idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkWebhookIdempotency', () => {
    it('should return isDuplicate=false for new event', async () => {
      // Mock: No existing event found
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }, // Not found error
              }),
            }),
          }),
        }),
      });

      const result = await checkWebhookIdempotency('square', 'evt_test_123');

      expect(result.isDuplicate).toBe(false);
      expect(result.existingEvent).toBeUndefined();
    });

    it('should return isDuplicate=true for existing event', async () => {
      const existingEvent = {
        id: 'webhook-uuid-123',
        provider: 'square',
        event_id: 'evt_test_123',
        status: 'succeeded',
        received_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: existingEvent,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await checkWebhookIdempotency('square', 'evt_test_123');

      expect(result.isDuplicate).toBe(true);
      expect(result.existingEvent).toEqual(existingEvent);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'CONNECTION_ERROR', message: 'DB timeout' },
              }),
            }),
          }),
        }),
      });

      const result = await checkWebhookIdempotency('square', 'evt_test_123');

      // Should not consider it a duplicate if we can't check
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('createWebhookEvent', () => {
    it('should create webhook event record', async () => {
      const eventData = {
        provider: 'square' as const,
        eventId: 'evt_test_123',
        eventType: 'payment.succeeded',
        rawType: 'payment.updated',
        rawPayload: { type: 'payment.updated', data: {} },
        parsedMetadata: { paymentId: 'pay-123', familyId: 'fam-456' },
        requestId: 'req-789',
        sourceIp: '192.168.1.1',
      };

      const mockWebhookId = 'webhook-uuid-123';

      mockSupabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: mockWebhookId },
              error: null,
            }),
          }),
        }),
      });

      const result = await createWebhookEvent(eventData);

      expect(result).toBe(mockWebhookId);
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('webhook_events');
    });

    it('should detect duplicate event on unique constraint violation', async () => {
      const eventData = {
        provider: 'square' as const,
        eventId: 'evt_test_123',
        eventType: 'payment.succeeded',
        rawType: 'payment.updated',
        rawPayload: { type: 'payment.updated', data: {} },
      };

      mockSupabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: '23505' }, // Unique constraint violation
            }),
          }),
        }),
      });

      await expect(createWebhookEvent(eventData)).rejects.toThrow('DUPLICATE_EVENT');
    });
  });
});
