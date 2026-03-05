import { describe, expect, it, vi } from 'vitest';
import { checkStudentEligibility } from '../supabase.server';

type EnrollmentRow = {
  paid_until: string | null;
  status: 'active' | 'trial';
};

type PaymentLinkRow = {
  payments: {
    payment_date: string;
    type: 'monthly_group' | 'yearly_group';
  };
};

function buildSupabaseMock(
  enrollments: EnrollmentRow[],
  paymentLinks: PaymentLinkRow[]
) {
  const enrollmentsOrder = vi.fn().mockResolvedValue({ data: enrollments, error: null });
  const enrollmentsIn = vi.fn(() => ({ order: enrollmentsOrder }));
  const enrollmentsEq = vi.fn(() => ({ in: enrollmentsIn }));
  const enrollmentsSelect = vi.fn(() => ({ eq: enrollmentsEq }));

  const paymentLimit = vi.fn().mockResolvedValue({ data: paymentLinks, error: null });
  const paymentOrder = vi.fn(() => ({ limit: paymentLimit }));
  const paymentEqStatus = vi.fn(() => ({ order: paymentOrder }));
  const paymentEqStudent = vi.fn(() => ({ eq: paymentEqStatus }));
  const paymentSelect = vi.fn(() => ({ eq: paymentEqStudent }));

  const from = vi.fn((table: string) => {
    if (table === 'enrollments') {
      return { select: enrollmentsSelect };
    }
    if (table === 'payment_students') {
      return { select: paymentSelect };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from },
    from,
    paymentSelect,
  };
}

describe('checkStudentEligibility', () => {
  it('returns paid yearly eligibility while querying payment_students once', async () => {
    const mock = buildSupabaseMock(
      [{ paid_until: '2099-01-01', status: 'active' }],
      [
        {
          payments: {
            payment_date: '2026-02-01T00:00:00.000Z',
            type: 'yearly_group',
          },
        },
      ]
    );

    const result = await checkStudentEligibility('student-1', mock.client as never);

    expect(result).toMatchObject({
      eligible: true,
      reason: 'Paid - Yearly',
      type: 'yearly_group',
      paidUntil: '2099-01-01',
      lastPaymentDate: '2026-02-01T00:00:00.000Z',
    });
    expect(mock.from).toHaveBeenCalledWith('payment_students');
    expect(mock.paymentSelect).toHaveBeenCalledTimes(1);
  });

  it('returns expired status with latest payment metadata and single payment query', async () => {
    const mock = buildSupabaseMock(
      [{ paid_until: '2000-01-01', status: 'active' }],
      [
        {
          payments: {
            payment_date: '2025-01-01T00:00:00.000Z',
            type: 'monthly_group',
          },
        },
      ]
    );

    const result = await checkStudentEligibility('student-2', mock.client as never);

    expect(result).toMatchObject({
      eligible: false,
      reason: 'Expired',
      type: 'monthly_group',
      paidUntil: '2000-01-01',
      lastPaymentDate: '2025-01-01T00:00:00.000Z',
    });
    expect(mock.from).toHaveBeenCalledWith('payment_students');
    expect(mock.paymentSelect).toHaveBeenCalledTimes(1);
  });
});
