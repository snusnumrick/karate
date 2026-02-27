import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toCents } from '~/utils/money';
import { DiscountService } from '../discount.server';

const mockSupabaseAdmin = {
  from: vi.fn(),
};

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseAdminClient: () => mockSupabaseAdmin,
}));

describe('DiscountService.getAllDiscountCodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns codes with creator metadata and usage summaries', async () => {
    const codesData = [
      {
        id: 'dc-1',
        code: 'WELCOME10',
        name: 'Welcome',
        description: null,
        discount_type: 'fixed_amount',
        discount_value: 10,
        discount_value_cents: 1000,
        usage_type: 'one_time',
        max_uses: null,
        current_uses: 2,
        applicable_to: ['monthly_group'],
        scope: 'per_family',
        family_id: 'fam-1',
        student_id: null,
        is_active: true,
        valid_from: '2026-01-01T00:00:00.000Z',
        valid_until: null,
        created_by: 'user-1',
        created_automatically: false,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        families: { id: 'fam-1', name: 'Doe Family' },
        students: null,
      },
      {
        id: 'dc-2',
        code: 'SPRING5',
        name: 'Spring',
        description: null,
        discount_type: 'fixed_amount',
        discount_value: 5,
        discount_value_cents: 500,
        usage_type: 'ongoing',
        max_uses: null,
        current_uses: 1,
        applicable_to: ['yearly_group'],
        scope: 'per_student',
        family_id: null,
        student_id: 'stu-1',
        is_active: true,
        valid_from: '2026-01-01T00:00:00.000Z',
        valid_until: null,
        created_by: 'user-1',
        created_automatically: false,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        families: null,
        students: { id: 'stu-1', first_name: 'Alex', last_name: 'Doe' },
      },
    ];

    const creatorsData = [
      {
        id: 'user-1',
        email: 'owner@example.com',
        first_name: 'Jane',
        last_name: 'Owner',
      },
    ];

    const usageData = [
      {
        id: 'u-1',
        discount_code_id: 'dc-1',
        payment_id: 'p-1',
        family_id: 'fam-1',
        student_id: null,
        discount_amount: 500,
        original_amount: 10000,
        final_amount: 9500,
        used_at: '2026-02-10T00:00:00.000Z',
      },
      {
        id: 'u-2',
        discount_code_id: 'dc-1',
        payment_id: 'p-2',
        family_id: 'fam-1',
        student_id: null,
        discount_amount: 400,
        original_amount: 9000,
        final_amount: 8600,
        used_at: '2026-02-11T00:00:00.000Z',
      },
      {
        id: 'u-3',
        discount_code_id: 'dc-2',
        payment_id: 'p-3',
        family_id: 'fam-1',
        student_id: 'stu-1',
        discount_amount: 300,
        original_amount: 7000,
        final_amount: 6700,
        used_at: '2026-02-12T00:00:00.000Z',
      },
    ];

    const profilesIn = vi.fn().mockResolvedValue({ data: creatorsData, error: null });
    const usageOrder = vi.fn().mockResolvedValue({ data: usageData, error: null });
    const usageIn = vi.fn(() => ({ order: usageOrder }));

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'discount_codes') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: codesData, error: null }),
          })),
        };
      }

      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            in: profilesIn,
          })),
        };
      }

      if (table === 'discount_code_usage') {
        return {
          select: vi.fn(() => ({
            in: usageIn,
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await DiscountService.getAllDiscountCodes();

    expect(result).toHaveLength(2);
    expect(result[0].creator?.full_name).toBe('Jane Owner');
    expect(result[0].usage_count).toBe(2);
    expect(result[1].usage_count).toBe(1);

    expect(result[0].recent_usage).toBeDefined();
    expect(result[0].recent_usage?.[0]).toBeDefined();
    expect(toCents(result[0].recent_usage![0].discount_amount)).toBe(500);

    expect(profilesIn).toHaveBeenCalledWith('id', ['user-1']);
    expect(usageIn).toHaveBeenCalledWith('discount_code_id', ['dc-1', 'dc-2']);
  });
});
