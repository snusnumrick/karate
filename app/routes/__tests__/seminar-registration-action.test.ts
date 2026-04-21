import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionFunctionArgs } from '@remix-run/node';
import { ZERO_MONEY } from '~/utils/money';

const mockGetOptionalUser = vi.fn();
const mockGetSupabaseAdminClient = vi.fn();
const mockCreateSelfRegistrant = vi.fn();
const mockGetSelfRegistrantByProfileId = vi.fn();
const mockEnrollStudent = vi.fn();
const mockCalculateTaxesForPayment = vi.fn();
const mockGetFamilyRegistrationWaiverStatus = vi.fn();

vi.mock('~/utils/auth.server', () => ({
  getOptionalUser: (...args: unknown[]) => mockGetOptionalUser(...args),
}));

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseAdminClient: () => mockGetSupabaseAdminClient(),
}));

vi.mock('~/services/self-registration.server', () => ({
  createSelfRegistrant: (...args: unknown[]) => mockCreateSelfRegistrant(...args),
  getSelfRegistrantByProfileId: (...args: unknown[]) => mockGetSelfRegistrantByProfileId(...args),
}));

vi.mock('~/services/enrollment.server', () => ({
  EnrollmentValidationError: class EnrollmentValidationError extends Error {
    validation = { errors: ['Enrollment validation failed'] };
  },
  enrollStudent: (...args: unknown[]) => mockEnrollStudent(...args),
}));

vi.mock('~/services/tax-rates.server', () => ({
  calculateTaxesForPayment: (...args: unknown[]) => mockCalculateTaxesForPayment(...args),
}));

vi.mock('~/utils/service-errors.server', () => ({
  isServiceError: () => false,
}));

vi.mock('~/services/waiver.server', () => ({
  getFamilyRegistrationWaiverStatus: (...args: unknown[]) => mockGetFamilyRegistrationWaiverStatus(...args),
}));

import {
  action,
  buildSeminarWaiverSignHref,
  buildEnrollmentPendingPaymentNotes,
  buildSeminarPaymentNotes,
  getDefaultSeminarRegistrationType,
  extractSeminarPendingPaymentId,
  shouldRequireStudentProfileForSeminar,
  shouldShowAddStudentCtaForSeminar,
  shouldShowSeminarRegistrationTypeSelector,
} from '../_layout.curriculum.seminars.$slug.register';

function makeQuery(config: {
  result?: { data: unknown; error: unknown };
  singleResult?: { data: unknown; error: unknown };
  maybeSingleResult?: { data: unknown; error: unknown };
}) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.insert = vi.fn(() => query);
  query.update = vi.fn(() => query);
  query.delete = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.single = vi.fn().mockResolvedValue(config.singleResult ?? config.result ?? { data: null, error: null });
  query.maybeSingle = vi.fn().mockResolvedValue(config.maybeSingleResult ?? config.result ?? { data: null, error: null });
  query.then = (
    onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(config.result ?? { data: null, error: null }).then(onFulfilled, onRejected);
  return query;
}

describe('seminar registration action', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetSelfRegistrantByProfileId.mockResolvedValue(null);
    mockCreateSelfRegistrant.mockResolvedValue({
      family: { id: 'family-self-1' },
      student: { id: 'student-self-1' },
    });
    mockEnrollStudent.mockResolvedValue({ id: 'enrollment-1' });
    mockCalculateTaxesForPayment.mockResolvedValue({
      paymentTaxes: [],
      totalTaxAmount: ZERO_MONEY,
    });
    mockGetFamilyRegistrationWaiverStatus.mockResolvedValue({
      is_complete: true,
      missing_waivers: [],
      signed_waivers: [],
    });
  });

  it('allows youth seminar student registration and redirects to payment', async () => {
    const serverTableQueries: Record<string, Array<Record<string, unknown>>> = {
      classes: [
        makeQuery({
          singleResult: {
            data: {
              id: 'series-1',
              program_id: 'program-1',
              allow_self_enrollment: true,
              price_override_cents: 15000,
              programs: {
                audience_scope: 'youth',
                single_purchase_price_cents: null,
                registration_fee_cents: null,
              },
            },
            error: null,
          },
        }),
      ],
      profiles: [
        makeQuery({
          singleResult: {
            data: { family_id: 'family-1' },
            error: null,
          },
        }),
      ],
      students: [
        makeQuery({
          maybeSingleResult: {
            data: { id: 'student-1' },
            error: null,
          },
        }),
      ],
    };

    const paymentInsertQuery = makeQuery({
      singleResult: {
        data: { id: 'payment-1' },
        error: null,
      },
    });
    const enrollmentUpdateQuery = makeQuery({
      result: { data: null, error: null },
    });
    const paymentStudentInsertQuery = makeQuery({
      result: { data: null, error: null },
    });
    const existingEnrollmentQuery = makeQuery({
      maybeSingleResult: {
        data: null,
        error: null,
      },
    });

    const supabaseServer = {
      from: vi.fn((table: string) => {
        const queue = serverTableQueries[table];
        if (!queue || queue.length === 0) {
          throw new Error(`No server query configured for ${table}`);
        }
        return queue.shift();
      }),
    };

    const supabaseAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'payments') {
          return paymentInsertQuery;
        }
        if (table === 'payment_students') {
          return paymentStudentInsertQuery;
        }
        if (table === 'enrollments') {
          if (!(existingEnrollmentQuery.maybeSingle as ReturnType<typeof vi.fn>).mock.calls.length) {
            return existingEnrollmentQuery;
          }
          return enrollmentUpdateQuery;
        }
        throw new Error(`No admin query configured for ${table}`);
      }),
    };

    mockGetOptionalUser.mockResolvedValue({
      supabaseServer,
      user: { id: 'user-1' },
      response: { headers: new Headers() },
    });
    mockGetSupabaseAdminClient.mockReturnValue(supabaseAdmin);

    const formData = new FormData();
    formData.set('intent', 'register');
    formData.set('seriesId', 'series-1');
    formData.set('registrationType', 'student');
    formData.set('studentId', 'student-1');

    const response = await action({
      request: new Request('http://localhost/curriculum/seminars/summer-camp/register?seriesId=series-1', {
        method: 'POST',
        body: formData,
      }),
      params: { slug: 'summer-camp' },
    } as unknown as ActionFunctionArgs);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/pay/payment-1');
    expect(mockCreateSelfRegistrant).not.toHaveBeenCalled();
    expect(mockEnrollStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        class_id: 'series-1',
        student_id: 'student-1',
        program_id: 'program-1',
        status: 'pending_payment',
      }),
      supabaseAdmin,
    );
    expect(paymentInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        family_id: 'family-1',
        notes: buildSeminarPaymentNotes({
          seriesId: 'series-1',
          studentId: 'student-1',
        }),
        type: 'individual_session',
        status: 'pending',
      }),
    );
    expect(paymentStudentInsertQuery.insert).toHaveBeenCalledWith({
      payment_id: 'payment-1',
      student_id: 'student-1',
    });
    expect(enrollmentUpdateQuery.update).toHaveBeenCalledWith({
      notes: buildEnrollmentPendingPaymentNotes({
        existingNotes: null,
        paymentId: 'payment-1',
        seriesId: 'series-1',
        studentId: 'student-1',
      }),
    });
    expect(mockGetFamilyRegistrationWaiverStatus).toHaveBeenCalledWith('family-1', supabaseServer);
  });

  it('redirects back to an existing pending payment when the student is already waitlisted for the seminar', async () => {
    const serverTableQueries: Record<string, Array<Record<string, unknown>>> = {
      classes: [
        makeQuery({
          singleResult: {
            data: {
              id: 'series-1',
              program_id: 'program-1',
              allow_self_enrollment: true,
              price_override_cents: 15000,
              programs: {
                audience_scope: 'youth',
                single_purchase_price_cents: null,
                registration_fee_cents: null,
              },
            },
            error: null,
          },
        }),
      ],
      profiles: [
        makeQuery({
          singleResult: {
            data: { family_id: 'family-1' },
            error: null,
          },
        }),
      ],
      students: [
        makeQuery({
          maybeSingleResult: {
            data: { id: 'student-1' },
            error: null,
          },
        }),
      ],
    };

    const existingEnrollmentQuery = makeQuery({
      maybeSingleResult: {
        data: {
          id: 'enrollment-1',
          status: 'pending_payment',
          notes: null,
          created_at: '2026-04-20T10:00:00.000Z',
        },
        error: null,
      },
    });
    const pendingPaymentsQuery = makeQuery({
      result: {
        data: [
          {
            id: 'payment-existing',
            created_at: '2026-04-20T10:05:00.000Z',
            notes: null,
            total_amount: 15000,
            payment_students: [],
          },
        ],
        error: null,
      },
    });
    const enrollmentUpdateQuery = makeQuery({
      result: { data: null, error: null },
    });

    const supabaseServer = {
      from: vi.fn((table: string) => {
        const queue = serverTableQueries[table];
        if (!queue || queue.length === 0) {
          throw new Error(`No server query configured for ${table}`);
        }
        return queue.shift();
      }),
    };

    const supabaseAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'enrollments') {
          if (!(existingEnrollmentQuery.maybeSingle as ReturnType<typeof vi.fn>).mock.calls.length) {
            return existingEnrollmentQuery;
          }
          return enrollmentUpdateQuery;
        }
        if (table === 'payments') {
          return pendingPaymentsQuery;
        }
        throw new Error(`No admin query configured for ${table}`);
      }),
    };

    mockGetOptionalUser.mockResolvedValue({
      supabaseServer,
      user: { id: 'user-1' },
      response: { headers: new Headers() },
    });
    mockGetSupabaseAdminClient.mockReturnValue(supabaseAdmin);

    const formData = new FormData();
    formData.set('intent', 'register');
    formData.set('seriesId', 'series-1');
    formData.set('registrationType', 'student');
    formData.set('studentId', 'student-1');

    const response = await action({
      request: new Request('http://localhost/curriculum/seminars/summer-camp/register?seriesId=series-1', {
        method: 'POST',
        body: formData,
      }),
      params: { slug: 'summer-camp' },
    } as unknown as ActionFunctionArgs);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/pay/payment-existing');
    expect(mockEnrollStudent).not.toHaveBeenCalled();
    expect(enrollmentUpdateQuery.update).toHaveBeenCalledWith({
      notes: buildEnrollmentPendingPaymentNotes({
        existingNotes: null,
        paymentId: 'payment-existing',
        seriesId: 'series-1',
        studentId: 'student-1',
      }),
    });
  });

  it('redirects household users into the waiver signing flow when family waivers are missing', async () => {
    mockGetFamilyRegistrationWaiverStatus.mockResolvedValue({
      is_complete: false,
      missing_waivers: [{ id: 'waiver-1', title: 'Liability Release' }],
      signed_waivers: [],
    });

    const serverTableQueries: Record<string, Array<Record<string, unknown>>> = {
      profiles: [
        makeQuery({
          singleResult: {
            data: { family_id: 'family-1' },
            error: null,
          },
        }),
      ],
    };

    const supabaseServer = {
      from: vi.fn((table: string) => {
        const queue = serverTableQueries[table];
        if (!queue || queue.length === 0) {
          throw new Error(`No server query configured for ${table}`);
        }
        return queue.shift();
      }),
    };

    mockGetOptionalUser.mockResolvedValue({
      supabaseServer,
      user: { id: 'user-1' },
      response: { headers: new Headers() },
    });
    mockGetSupabaseAdminClient.mockReturnValue({});

    const formData = new FormData();
    formData.set('intent', 'register');
    formData.set('seriesId', 'series-1');
    formData.set('registrationType', 'student');
    formData.set('studentId', 'student-1');

    const response = await action({
      request: new Request('http://localhost/curriculum/seminars/summer-camp/register?seriesId=series-1', {
        method: 'POST',
        body: formData,
      }),
      params: { slug: 'summer-camp' },
    } as unknown as ActionFunctionArgs);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(
      buildSeminarWaiverSignHref({
        waiverId: 'waiver-1',
        returnTo: '/curriculum/seminars/summer-camp/register?seriesId=series-1',
      }),
    );
    expect(mockEnrollStudent).not.toHaveBeenCalled();
  });

  it('rejects adult self registration for youth seminars before creating a self registrant', async () => {
    const serverTableQueries: Record<string, Array<Record<string, unknown>>> = {
      profiles: [
        makeQuery({
          singleResult: {
            data: { family_id: null },
            error: null,
          },
        }),
      ],
      waivers: [
        makeQuery({
          result: { data: [], error: null },
        }),
      ],
      classes: [
        makeQuery({
          singleResult: {
            data: {
              id: 'series-1',
              program_id: 'program-1',
              allow_self_enrollment: true,
              price_override_cents: 15000,
              programs: {
                audience_scope: 'youth',
              },
            },
            error: null,
          },
        }),
      ],
    };

    const supabaseServer = {
      from: vi.fn((table: string) => {
        const queue = serverTableQueries[table];
        if (!queue || queue.length === 0) {
          throw new Error(`No server query configured for ${table}`);
        }
        return queue.shift();
      }),
    };

    mockGetOptionalUser.mockResolvedValue({
      supabaseServer,
      user: { id: 'user-1' },
      response: { headers: new Headers() },
    });
    mockGetSupabaseAdminClient.mockReturnValue({});

    const formData = new FormData();
    formData.set('intent', 'register');
    formData.set('seriesId', 'series-1');
    formData.set('registrationType', 'self');
    formData.set('firstName', 'Pat');
    formData.set('lastName', 'Lee');
    formData.set('email', 'pat@example.com');
    formData.set('phone', '555-0100');

    const response = await action({
      request: new Request('http://localhost/curriculum/seminars/summer-camp/register', {
        method: 'POST',
        body: formData,
      }),
      params: { slug: 'summer-camp' },
    } as unknown as ActionFunctionArgs);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'This seminar series is not available for adult registration',
    });
    expect(mockGetSelfRegistrantByProfileId).not.toHaveBeenCalled();
    expect(mockCreateSelfRegistrant).not.toHaveBeenCalled();
    expect(mockEnrollStudent).not.toHaveBeenCalled();
  });
});

describe('seminar registration helpers', () => {
  it('builds waiver signing links that return to the seminar page', () => {
    expect(
      buildSeminarWaiverSignHref({
        waiverId: 'waiver-1',
        returnTo: '/curriculum/seminars/summer-camp/register?seriesId=series-1',
      }),
    ).toBe(
      '/family/waivers/waiver-1/sign?redirectTo=%2Fcurriculum%2Fseminars%2Fsummer-camp%2Fregister%3FseriesId%3Dseries-1',
    );
  });

  it('extracts the stored pending payment marker for the same seminar/student pair', () => {
    expect(
      extractSeminarPendingPaymentId({
        notes: buildEnrollmentPendingPaymentNotes({
          existingNotes: 'Needs follow-up',
          paymentId: 'payment-1',
          seriesId: 'series-1',
          studentId: 'student-1',
        }),
        seriesId: 'series-1',
        studentId: 'student-1',
      }),
    ).toBe('payment-1');
  });

  it('defaults youth seminars without students to student registration so the page can prompt for a child profile', () => {
    expect(
      getDefaultSeminarRegistrationType({
        audienceScope: 'youth',
        hasSelfRegistrant: false,
        hasStudents: false,
      }),
    ).toBe('student');
  });

  it('defaults youth seminars to student registration when household students exist', () => {
    expect(
      getDefaultSeminarRegistrationType({
        audienceScope: 'youth',
        hasSelfRegistrant: true,
        hasStudents: true,
      }),
    ).toBe('student');
  });

  it('shows the registration type selector only when adult self-registration is supported and students exist', () => {
    expect(
      shouldShowSeminarRegistrationTypeSelector({
        audienceScope: 'mixed',
        hasStudents: true,
      }),
    ).toBe(true);

    expect(
      shouldShowSeminarRegistrationTypeSelector({
        audienceScope: 'youth',
        hasStudents: true,
      }),
    ).toBe(false);
  });

  it('requires a student profile for youth seminars without children on file', () => {
    expect(
      shouldRequireStudentProfileForSeminar({
        audienceScope: 'youth',
        hasStudents: false,
      }),
    ).toBe(true);

    expect(
      shouldRequireStudentProfileForSeminar({
        audienceScope: 'mixed',
        hasStudents: false,
      }),
    ).toBe(false);
  });

  it('shows the add-student call to action only when a family profile can add children to a non-adult seminar', () => {
    expect(
      shouldShowAddStudentCtaForSeminar({
        audienceScope: 'mixed',
        hasStudents: false,
        hasFamilyProfile: true,
      }),
    ).toBe(true);

    expect(
      shouldShowAddStudentCtaForSeminar({
        audienceScope: 'adults',
        hasStudents: false,
        hasFamilyProfile: true,
      }),
    ).toBe(false);

    expect(
      shouldShowAddStudentCtaForSeminar({
        audienceScope: 'youth',
        hasStudents: true,
        hasFamilyProfile: true,
      }),
    ).toBe(false);
  });
});
