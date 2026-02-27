import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ActionFunctionArgs } from '@remix-run/node';
import { CSRFError } from 'remix-utils/csrf/server';
import { action } from '../_layout.family.payment';

const mockCsrfValidate = vi.fn();
const mockGetSupabaseServerClient = vi.fn((_request: Request) => ({
  supabaseServer: {},
  response: new Response(),
}));

vi.mock('~/utils/csrf.server', () => ({
  csrf: {
    validate: (request: Request) => mockCsrfValidate(request),
  },
}));

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseServerClient: (request: Request) => mockGetSupabaseServerClient(request),
  createInitialPaymentRecord: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('~/services/enrollment-payment.server', () => ({
  getStudentPaymentOptions: vi.fn(),
  getFamilyPaymentOptions: vi.fn(),
}));

describe('family payment action CSRF handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCsrfValidate.mockResolvedValue(undefined);
  });

  it('returns a user-facing 403 response when CSRF token is invalid', async () => {
    mockCsrfValidate.mockRejectedValue(
      new CSRFError('mismatched_token', "Can't verify CSRF token authenticity.")
    );

    const request = new Request('http://localhost/family/payment', {
      method: 'POST',
      body: new URLSearchParams({ familyId: 'fam-1' }),
    });

    const response = await action({ request } as ActionFunctionArgs);
    const payload = await response.json();

    expect(mockGetSupabaseServerClient).toHaveBeenCalledWith(request);
    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      errorCode: 'CSRF_TOKEN_INVALID',
      error: 'Your session expired. Please refresh the page and try again.',
    });
  });

  it('rethrows non-CSRF errors from token validation', async () => {
    mockCsrfValidate.mockRejectedValue(new Error('unexpected validation failure'));

    const request = new Request('http://localhost/family/payment', {
      method: 'POST',
      body: new URLSearchParams({ familyId: 'fam-1' }),
    });

    await expect(action({ request } as ActionFunctionArgs)).rejects.toThrow(
      'unexpected validation failure'
    );
  });
});
