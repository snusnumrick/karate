import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionFunctionArgs } from '@remix-run/node';

const mockGetSupabaseServerClient = vi.fn();
const mockGetSupabaseAdminClient = vi.fn();
const mockCreateSelfRegistrant = vi.fn();
const mockCalculateTaxesForPayment = vi.fn();
const mockSendEmail = vi.fn();
const mockDeleteIncompleteRegistration = vi.fn();

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseServerClient: (...args: unknown[]) => mockGetSupabaseServerClient(...args),
  getSupabaseAdminClient: () => mockGetSupabaseAdminClient(),
}));

vi.mock('~/services/self-registration.server', () => ({
  createSelfRegistrant: (...args: unknown[]) => mockCreateSelfRegistrant(...args),
}));

vi.mock('~/services/tax-rates.server', () => ({
  calculateTaxesForPayment: (...args: unknown[]) => mockCalculateTaxesForPayment(...args),
}));

vi.mock('~/utils/email.server', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('~/services/incomplete-registration.server', () => ({
  deleteIncompleteRegistration: (...args: unknown[]) => mockDeleteIncompleteRegistration(...args),
}));

import { action } from '../_layout.events.$eventId_.register';

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
  query.not = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.single = vi.fn().mockResolvedValue(config.singleResult ?? config.result ?? { data: null, error: null });
  query.maybeSingle = vi.fn().mockResolvedValue(config.maybeSingleResult ?? config.result ?? { data: null, error: null });
  query.then = (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(config.result ?? { data: null, error: null }).then(onFulfilled, onRejected);
  return query;
}

describe('event registration action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSelfRegistrant.mockResolvedValue({
      family: { id: 'family-self-1' },
      student: { id: 'student-self-1' },
    });
    mockCalculateTaxesForPayment.mockResolvedValue({
      paymentTaxes: [],
      totalTaxAmount: { amount: 0, currency: 'USD', precision: 2 },
    });
    mockSendEmail.mockResolvedValue(undefined);
    mockDeleteIncompleteRegistration.mockResolvedValue(undefined);
  });

  it('handles household registration flow and creates family-linked registration', async () => {
    const user = { id: 'user-1', email: 'household@example.com' };

    const serverTableQueries: Record<string, Array<Record<string, unknown>>> = {
      events: [
        makeQuery({
          singleResult: {
            data: { registration_fee: null, registration_fee_cents: 0, allow_self_participants: false },
            error: null,
          },
        }),
      ],
      profiles: [
        makeQuery({
          singleResult: {
            data: { family_id: 'family-1', first_name: 'Pat', last_name: 'Lee', email: 'household@example.com' },
            error: null,
          },
        }),
      ],
      students: [
        makeQuery({
          result: { data: [{ id: 'student-1', cell_phone: null }], error: null },
        }),
      ],
      event_waivers: [
        makeQuery({
          result: { data: [], error: null },
        }),
      ],
      event_registrations: [
        makeQuery({
          result: { data: [], error: null },
        }),
      ],
    };

    const insertRegistrationsQuery = makeQuery({
      result: {
        data: [{ id: 'event-registration-1' }],
        error: null,
      },
    });
    const updateRegistrationsQuery = makeQuery({
      result: { data: null, error: null },
    });

    const adminTableQueries: Record<string, Array<Record<string, unknown>>> = {
      event_registrations: [insertRegistrationsQuery, updateRegistrationsQuery],
      events: [
        makeQuery({
          singleResult: {
            data: { title: 'Open Seminar', description: null, start_date: '2026-04-01', end_date: null, location: null },
            error: null,
          },
        }),
      ],
      students: [
        makeQuery({
          result: { data: [{ first_name: 'Ari', last_name: 'Kim' }], error: null },
        }),
      ],
      families: [
        makeQuery({
          singleResult: {
            data: { name: 'Lee Family', email: null },
            error: null,
          },
        }),
      ],
    };

    const supabaseServer = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
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
        const queue = adminTableQueries[table];
        if (!queue || queue.length === 0) {
          throw new Error(`No admin query configured for ${table}`);
        }
        return queue.shift();
      }),
    };

    mockGetSupabaseServerClient.mockReturnValue({ supabaseServer, response: new Response() });
    mockGetSupabaseAdminClient.mockReturnValue(supabaseAdmin);

    const registrationPayload = {
      students: [
        {
          existingStudentId: 'student-1',
          firstName: 'Ari',
          lastName: 'Kim',
          dateOfBirth: '2012-06-01',
        },
      ],
      registerSelf: false,
    };

    const formData = new FormData();
    formData.set('intent', 'register');
    formData.set('registrationData', JSON.stringify(registrationPayload));

    const response = await action({
      request: new Request('http://localhost/events/event-1/register', {
        method: 'POST',
        body: formData,
      }),
      params: { eventId: 'event-1' },
    } as unknown as ActionFunctionArgs);

    const payload = await response.json() as Awaited<ReturnType<typeof response.json>>;
    if (!('success' in payload) || !payload.success) {
      throw new Error('Expected successful household registration response');
    }
    expect(payload.paymentRequired).toBe(false);
    expect(payload.studentIds).toEqual(['student-1']);
    expect(insertRegistrationsQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        student_id: 'student-1',
        family_id: 'family-1',
        participant_profile_id: null,
      }),
    ]);
  });

  it('handles self registration flow and sets participant_profile_id', async () => {
    const user = { id: 'user-2', email: 'self@example.com' };

    const serverTableQueries: Record<string, Array<Record<string, unknown>>> = {
      events: [
        makeQuery({
          singleResult: {
            data: { registration_fee: null, registration_fee_cents: 0, allow_self_participants: true },
            error: null,
          },
        }),
      ],
      profiles: [
        makeQuery({
          singleResult: {
            data: { family_id: null, first_name: 'Self', last_name: 'User', email: 'self@example.com' },
            error: null,
          },
        }),
      ],
      event_waivers: [
        makeQuery({
          result: { data: [], error: null },
        }),
      ],
      event_registrations: [
        makeQuery({
          result: { data: [], error: null },
        }),
        makeQuery({
          maybeSingleResult: { data: null, error: null },
        }),
      ],
    };

    const insertRegistrationsQuery = makeQuery({
      result: {
        data: [{ id: 'event-registration-self-1' }],
        error: null,
      },
    });
    const updateRegistrationsQuery = makeQuery({
      result: { data: null, error: null },
    });
    const adminTableQueries: Record<string, Array<Record<string, unknown>>> = {
      event_registrations: [insertRegistrationsQuery, updateRegistrationsQuery],
      events: [
        makeQuery({
          singleResult: {
            data: { title: 'Self Event', description: null, start_date: '2026-04-01', end_date: null, location: null },
            error: null,
          },
        }),
      ],
      students: [
        makeQuery({
          result: { data: [{ first_name: 'Self', last_name: 'User' }], error: null },
        }),
      ],
      families: [
        makeQuery({
          singleResult: {
            data: { name: 'Self User', email: null },
            error: null,
          },
        }),
      ],
    };

    const supabaseServer = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
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
        const queue = adminTableQueries[table];
        if (!queue || queue.length === 0) {
          throw new Error(`No admin query configured for ${table}`);
        }
        return queue.shift();
      }),
    };

    mockGetSupabaseServerClient.mockReturnValue({ supabaseServer, response: new Response() });
    mockGetSupabaseAdminClient.mockReturnValue(supabaseAdmin);

    const formData = new FormData();
    formData.set('intent', 'register');
    formData.set(
      'registrationData',
      JSON.stringify({
        students: [],
        registerSelf: true,
        selfParticipant: { firstName: 'Self', lastName: 'User', email: 'self@example.com' },
      })
    );

    const response = await action({
      request: new Request('http://localhost/events/event-2/register', {
        method: 'POST',
        body: formData,
      }),
      params: { eventId: 'event-2' },
    } as unknown as ActionFunctionArgs);

    const payload = await response.json() as Awaited<ReturnType<typeof response.json>>;
    if (!('success' in payload) || !payload.success) {
      throw new Error('Expected successful self registration response');
    }
    expect(payload.paymentRequired).toBe(false);
    expect(payload.studentIds).toEqual(['student-self-1']);
    expect(mockCreateSelfRegistrant).toHaveBeenCalled();
    expect(insertRegistrationsQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        student_id: 'student-self-1',
        family_id: 'family-self-1',
        participant_profile_id: 'user-2',
      }),
    ]);
  });
});
