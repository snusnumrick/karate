import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleWebhook, handleWebhookLoader } from '../webhook-route.server';

const mockGetPaymentProvider = vi.fn();
const mockHandlePaymentWebhook = vi.fn();

vi.mock('~/services/payments/index.server', () => ({
  getPaymentProvider: () => mockGetPaymentProvider(),
}));

vi.mock('~/services/payments/webhook.server', () => ({
  handlePaymentWebhook: (...args: unknown[]) => mockHandlePaymentWebhook(...args),
}));

describe('webhook route helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 from loader with Allow header', async () => {
    const response = await handleWebhookLoader('stripe', new Request('http://localhost/api.webhooks.stripe', { method: 'GET' }));

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
  });

  it('rejects provider mismatch', async () => {
    mockGetPaymentProvider.mockReturnValue({ id: 'square' });

    const response = await handleWebhook('stripe', new Request('http://localhost/api.webhooks.stripe', {
      method: 'POST',
      body: '{"type":"test"}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'sig_12345678',
      },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'PAYMENT_PROVIDER_MISMATCH', message: 'Payment provider mismatch.' },
    });
  });

  it('acknowledges duplicate events', async () => {
    mockGetPaymentProvider.mockReturnValue({ id: 'stripe' });
    mockHandlePaymentWebhook.mockResolvedValue({ success: true, isDuplicate: true });

    const response = await handleWebhook('stripe', new Request('http://localhost/api.webhooks.stripe', {
      method: 'POST',
      body: '{"id":"evt_1"}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'sig_abcdef12',
      },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(mockHandlePaymentWebhook).toHaveBeenCalledTimes(1);
  });

  it('returns success for valid processed webhook', async () => {
    mockGetPaymentProvider.mockReturnValue({ id: 'square' });
    mockHandlePaymentWebhook.mockResolvedValue({ success: true });

    const response = await handleWebhook('square', new Request('http://localhost/api.webhooks.square', {
      method: 'POST',
      body: '{"id":"evt_2"}',
      headers: {
        'content-type': 'application/json',
        'x-square-hmacsha256-signature': 'sqsig_12345678',
      },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
  });
});
