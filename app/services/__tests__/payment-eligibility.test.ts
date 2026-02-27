import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fromCents, toCents } from '~/utils/money';
import { getFamilyPaymentEligibilityData } from '../payment-eligibility.server';

const mockCheckStudentEligibility = vi.fn();
const mockGetFamilyPaymentOptions = vi.fn();

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseAdminClient: vi.fn(),
  checkStudentEligibility: (...args: unknown[]) => mockCheckStudentEligibility(...args),
}));

vi.mock('~/services/enrollment-payment.server', () => ({
  getFamilyPaymentOptions: (...args: unknown[]) => mockGetFamilyPaymentOptions(...args),
}));

vi.mock('~/utils/misc', async () => ({
  getCurrentDateTimeInTimezone: () => new Date('2026-02-27T12:00:00.000Z'),
}));

describe('getFamilyPaymentEligibilityData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds payment eligibility with pricing, history, sessions, and discounts', async () => {
    const familiesSingle = vi.fn().mockResolvedValue({
      data: { name: 'Doe Family' },
      error: null,
    });
    const studentsEq = vi.fn().mockResolvedValue({
      data: [
        { id: 'stu-1', first_name: 'Alex', last_name: 'Doe' },
        { id: 'stu-2', first_name: 'Sam', last_name: 'Doe' },
      ],
      error: null,
    });
    const paymentsEqStatus = vi.fn().mockResolvedValue({
      data: [{ id: 'pay-1', status: 'succeeded' }],
      error: null,
    });
    const paymentsEqFamily = vi.fn(() => ({ eq: paymentsEqStatus }));
    const paymentStudentsIn = vi.fn().mockResolvedValue({
      data: [{ student_id: 'stu-1', payment_id: 'pay-1' }],
      error: null,
    });
    const sessionsOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'sess-1',
          purchase_date: '2026-02-01',
          quantity_purchased: 4,
          quantity_remaining: 2,
        },
      ],
      error: null,
    });
    const discountLimit = vi.fn().mockResolvedValue({
      data: [{ id: 'disc-1' }],
      error: null,
    });

    const supabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'families') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({ single: familiesSingle })),
            })),
          };
        }

        if (table === 'students') {
          return {
            select: vi.fn(() => ({
              eq: studentsEq,
            })),
          };
        }

        if (table === 'payments') {
          return {
            select: vi.fn(() => ({
              eq: paymentsEqFamily,
            })),
          };
        }

        if (table === 'payment_students') {
          return {
            select: vi.fn(() => ({
              in: paymentStudentsIn,
            })),
          };
        }

        if (table === 'one_on_one_sessions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({ order: sessionsOrder })),
            })),
          };
        }

        if (table === 'discount_codes') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                or: vi.fn(() => ({
                  or: vi.fn(() => ({
                    limit: discountLimit,
                  })),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockGetFamilyPaymentOptions.mockResolvedValue([
      {
        studentId: 'stu-1',
        studentName: 'Alex Doe',
        enrollments: [{ monthlyAmount: fromCents(12000) }],
        hasAnyActiveSubscription: false,
      },
      {
        studentId: 'stu-2',
        studentName: 'Sam Doe',
        enrollments: [{ yearlyAmount: fromCents(100000) }],
        hasAnyActiveSubscription: false,
      },
    ]);

    mockCheckStudentEligibility.mockImplementation(async (studentId: string) => {
      if (studentId === 'stu-1') {
        return { eligible: false, reason: 'Expired' };
      }
      return { eligible: true, reason: 'Paid - Monthly', paidUntil: '2026-03-01' };
    });

    const result = await getFamilyPaymentEligibilityData('fam-1', supabaseClient as never);

    expect(result.error).toBeUndefined();
    expect(result.familyName).toBe('Doe Family');
    expect(result.hasAvailableDiscounts).toBe(true);
    expect(result.studentPaymentDetails).toHaveLength(2);

    const student1 = result.studentPaymentDetails.find((detail) => detail.studentId === 'stu-1');
    const student2 = result.studentPaymentDetails.find((detail) => detail.studentId === 'stu-2');

    expect(student1).toBeDefined();
    expect(student2).toBeDefined();

    expect(student1?.pastPaymentCount).toBe(1);
    expect(student1?.needsPayment).toBe(true);
    expect(student1?.nextPaymentTierLabel).toBe('Monthly');
    expect(toCents(student1!.nextPaymentAmount)).toBe(12000);

    expect(student2?.pastPaymentCount).toBe(0);
    expect(student2?.needsPayment).toBe(false);
    expect(student2?.nextPaymentTierLabel).toBe('Yearly');
    expect(toCents(student2!.nextPaymentAmount)).toBe(100000);

    expect(mockCheckStudentEligibility).toHaveBeenCalledTimes(2);
    expect(supabaseClient.from).toHaveBeenCalledWith('discount_codes');
  });
});
