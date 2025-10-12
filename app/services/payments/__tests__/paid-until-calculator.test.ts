import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculatePaidUntil } from '../paid-until-calculator.server';

// Mock Supabase
const mockSupabaseAdmin = {
  from: vi.fn(),
};

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseAdminClient: () => mockSupabaseAdmin,
}));

// Mock site config
vi.mock('~/config/site', () => ({
  siteConfig: {
    payment: {
      gracePeriodDays: 7,
      attendanceLookbackDays: 30,
    },
  },
}));

type EnrollmentRecord = {
  id: string;
  student_id: string;
  paid_until: string | null;
  status: string;
};

describe('calculatePaidUntil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rule 1: Grace Period (within 7 days after expiration)', () => {
    it('should extend from expiration date when payment is 3 days late', async () => {
      const paymentDate = new Date('2025-10-15T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: '2025-10-12T16:00:00Z', // Expired 3 days ago
        status: 'active',
      };

      // Mock no attendance after expiration
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null, // No attendance
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      expect(result.ruleApplied).toBe('grace_period');
      expect(result.newPaidUntil.toISOString()).toBe('2025-11-12T16:00:00.000Z'); // 1 month from expiration
      expect(result.reason).toContain('Within 7-day grace period');
      expect(result.reason).toContain('3 days after expiration');
    });

    it('should extend from expiration when payment is exactly 7 days late (edge of grace)', async () => {
      const paymentDate = new Date('2025-10-19T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: '2025-10-12T16:00:00Z', // Expired exactly 7 days ago
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      expect(result.ruleApplied).toBe('grace_period');
      expect(result.newPaidUntil.toISOString()).toBe('2025-11-12T16:00:00.000Z');
    });

    it('should NOT apply grace period when payment is 8 days late', async () => {
      const paymentDate = new Date('2025-10-20T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: '2025-10-12T16:00:00Z', // Expired 8 days ago
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null, // No attendance
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      expect(result.ruleApplied).toBe('default');
      expect(result.newPaidUntil.toISOString()).toBe('2025-11-20T16:00:00.000Z'); // 1 month from payment date
    });
  });

  describe('Rule 2: Attendance Credit (student attended after expiration)', () => {
    it('should extend from expiration when student attended after expiration', async () => {
      const paymentDate = new Date('2025-10-25T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: '2025-10-12T16:00:00Z', // Expired 13 days ago (outside grace)
        status: 'active',
      };

      // Mock attendance found after expiration
      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          class_sessions: {
                            session_date: '2025-10-17', // Attended 5 days after expiration
                          },
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      expect(result.ruleApplied).toBe('attendance_credit');
      expect(result.newPaidUntil.toISOString()).toBe('2025-11-12T16:00:00.000Z'); // 1 month from expiration
      expect(result.reason).toContain('Student attended on 2025-10-17 after expiration');
    });

    it('should NOT apply attendance credit if no attendance after expiration', async () => {
      const paymentDate = new Date('2025-10-25T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: '2025-10-12T16:00:00Z', // Expired 13 days ago
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null, // No attendance
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      expect(result.ruleApplied).toBe('default');
      expect(result.newPaidUntil.toISOString()).toBe('2025-11-25T16:00:00.000Z'); // 1 month from payment date
    });

    it('should handle database errors gracefully when checking attendance', async () => {
      const paymentDate = new Date('2025-10-25T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: '2025-10-12T16:00:00Z',
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'Database connection error' },
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      // Should fall back to default rule
      expect(result.ruleApplied).toBe('default');
    });
  });

  describe('Rule 3: Default (no grace, no attendance)', () => {
    it('should extend from payment date for long overdue payment with no attendance', async () => {
      const paymentDate = new Date('2025-11-01T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: '2025-10-01T16:00:00Z', // Expired 31 days ago
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      expect(result.ruleApplied).toBe('default');
      expect(result.newPaidUntil.toISOString()).toBe('2025-12-01T16:00:00.000Z'); // 1 month from payment date
      expect(result.reason).toContain('31 days after expiration');
    });

    it('should extend from now for new enrollment (no prior paid_until)', async () => {
      const paymentDate = new Date('2025-10-12T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: null, // New enrollment
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      expect(result.ruleApplied).toBe('default');
      expect(result.newPaidUntil.toISOString()).toBe('2025-11-12T16:00:00.000Z'); // 1 month from now
      expect(result.reason).toContain('New enrollment');
    });
  });

  describe('Future paid_until (not expired)', () => {
    it('should extend from future paid_until date if not expired', async () => {
      const paymentDate = new Date('2025-10-12T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: '2025-11-15T16:00:00Z', // Already paid ahead
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      expect(result.ruleApplied).toBe('default');
      expect(result.newPaidUntil.toISOString()).toBe('2025-12-15T16:00:00.000Z'); // 1 month from future date
      expect(result.reason).toContain('not expired');
    });
  });

  describe('Payment Types', () => {
    it('should add 1 month for monthly_group payment', async () => {
      const paymentDate = new Date('2025-10-12T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: null,
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      expect(result.newPaidUntil.toISOString()).toBe('2025-11-12T16:00:00.000Z');
    });

    it('should add 1 year for yearly_group payment', async () => {
      const paymentDate = new Date('2025-10-12T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: null,
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'yearly_group');

      expect(result.newPaidUntil.toISOString()).toBe('2026-10-12T16:00:00.000Z');
    });
  });

  describe('Edge Cases', () => {
    it('should handle month-end dates correctly (Jan 31 -> Feb 28)', async () => {
      const paymentDate = new Date('2025-01-31T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: null,
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      // JavaScript automatically adjusts: Jan 31 + 1 month = March 3
      expect(result.newPaidUntil.getUTCMonth()).toBe(2); // March (0-indexed)
      expect(result.newPaidUntil.getUTCDate()).toBe(3); // 3rd
    });

    it('should use UTC methods to avoid timezone issues', async () => {
      const paymentDate = new Date('2025-10-12T23:00:00Z'); // Late UTC time
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: null,
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      // Should be exactly 1 month later in UTC, same time
      expect(result.newPaidUntil.toISOString()).toBe('2025-11-12T23:00:00.000Z');
    });
  });

  describe('Business Logic Verification', () => {
    it('should prevent "free months" for 30-day overdue payment with no attendance', async () => {
      const paymentDate = new Date('2025-11-12T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: '2025-10-12T16:00:00Z', // Expired 31 days ago
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: null, // No attendance
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      // Should extend from payment date (Nov 12), NOT from expired date (Oct 12)
      expect(result.newPaidUntil.toISOString()).toBe('2025-12-12T16:00:00.000Z');
      expect(result.ruleApplied).toBe('default');
    });

    it('should give credit for 30-day overdue payment WITH attendance', async () => {
      const paymentDate = new Date('2025-11-12T16:00:00Z');
      const enrollment: EnrollmentRecord = {
        id: 'enr-1',
        student_id: 'stu-1',
        paid_until: '2025-10-12T16:00:00Z', // Expired 31 days ago
        status: 'active',
      };

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          class_sessions: {
                            session_date: '2025-10-15', // Attended after expiration
                          },
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await calculatePaidUntil(enrollment, paymentDate, 'monthly_group');

      // Should extend from expiration date (Oct 12), giving them credit for attending
      expect(result.newPaidUntil.toISOString()).toBe('2025-11-12T16:00:00.000Z');
      expect(result.ruleApplied).toBe('attendance_credit');
    });
  });
});
