import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSupabaseClient = {
  from: vi.fn(),
};

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseAdminClient: vi.fn(() => mockSupabaseClient),
}));

import { EventService } from '../event.server';

type EventRegistrationQueryConfig = {
  maybeSingleResult?: { data: unknown; error: unknown };
  singleResult?: { data: unknown; error: unknown };
};

function createEventRegistrationQuery(config: EventRegistrationQueryConfig = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(config.maybeSingleResult ?? { data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(config.singleResult ?? { data: null, error: null }),
  };
}

function createStudentLookupQuery(studentResult: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(studentResult),
  };
}

describe('EventService.registerAdultForEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks duplicate registration when participant_profile_id already exists', async () => {
    const existingByProfileQuery = createEventRegistrationQuery({
      maybeSingleResult: { data: { id: 'existing-profile-registration' }, error: null },
    });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'event_registrations') {
        return existingByProfileQuery;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      EventService.registerAdultForEvent('event-1', 'profile-1', {
        familyId: 'family-1',
        studentId: 'student-1',
      })
    ).rejects.toThrow('already registered');
  });

  it('blocks duplicate registration when student is already registered', async () => {
    const existingByProfileQuery = createEventRegistrationQuery({
      maybeSingleResult: { data: null, error: null },
    });
    const existingByStudentQuery = createEventRegistrationQuery({
      maybeSingleResult: { data: { id: 'existing-student-registration' }, error: null },
    });
    const eventRegistrationQueries = [existingByProfileQuery, existingByStudentQuery];

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'event_registrations') {
        const query = eventRegistrationQueries.shift();
        if (!query) {
          throw new Error('No event registration query configured');
        }
        return query;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      EventService.registerAdultForEvent('event-1', 'profile-1', {
        familyId: 'family-1',
        studentId: 'student-1',
      })
    ).rejects.toThrow('Student is already registered');
  });

  it('registers adult participant and sets participant_profile_id', async () => {
    const studentLookupQuery = createStudentLookupQuery({
      data: { id: 'student-1', family_id: 'family-1' },
      error: null,
    });
    const existingByProfileQuery = createEventRegistrationQuery({
      maybeSingleResult: { data: null, error: null },
    });
    const existingByStudentQuery = createEventRegistrationQuery({
      maybeSingleResult: { data: null, error: null },
    });
    const insertQuery = createEventRegistrationQuery({
      singleResult: {
        data: {
          id: 'registration-1',
          event_id: 'event-1',
          student_id: 'student-1',
          family_id: 'family-1',
          participant_profile_id: 'profile-1',
        },
        error: null,
      },
    });
    const eventRegistrationQueries = [existingByProfileQuery, existingByStudentQuery, insertQuery];

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'students') {
        return studentLookupQuery;
      }
      if (table === 'event_registrations') {
        const query = eventRegistrationQueries.shift();
        if (!query) {
          throw new Error('No event registration query configured');
        }
        return query;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await EventService.registerAdultForEvent('event-1', 'profile-1');

    expect(insertQuery.insert).toHaveBeenCalledWith({
      event_id: 'event-1',
      family_id: 'family-1',
      student_id: 'student-1',
      participant_profile_id: 'profile-1',
      registration_status: 'pending',
      payment_amount_cents: 0,
    });
    expect(result).toMatchObject({
      id: 'registration-1',
      participant_profile_id: 'profile-1',
    });
  });
});

