import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoDiscountService } from '../auto-discount.server';

const mockGetSupabaseAdminClient = vi.fn();

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseAdminClient: () => mockGetSupabaseAdminClient(),
}));

describe('AutoDiscountService Supabase client lifetime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests an admin client per recordEvent call (no module-level sticky client)', async () => {
    const eventRow = {
      id: 'evt-1',
      event_type: 'student_enrollment',
      student_id: null,
      family_id: 'fam-1',
      event_data: null,
    };

    const single = vi.fn().mockResolvedValue({ data: eventRow, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));

    mockGetSupabaseAdminClient.mockReturnValue({ from });

    const processSpy = vi
      .spyOn(AutoDiscountService, 'processEventForAutomation')
      .mockResolvedValue(undefined);

    await AutoDiscountService.recordEvent({
      event_type: 'student_enrollment',
      family_id: 'fam-1',
    });

    await AutoDiscountService.recordEvent({
      event_type: 'student_enrollment',
      family_id: 'fam-1',
    });

    expect(mockGetSupabaseAdminClient).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenCalledWith('discount_events');
    expect(processSpy).toHaveBeenCalledTimes(2);
  });
});
