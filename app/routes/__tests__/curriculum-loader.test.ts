import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSupabaseAdminClient = vi.fn();
const mockGetPrograms = vi.fn();
const mockGetUpcomingEvents = vi.fn();

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseServerClient: vi.fn(),
  getSupabaseAdminClient: () => mockGetSupabaseAdminClient(),
}));

vi.mock('~/services/program.server', () => ({
  getPrograms: (...args: unknown[]) => mockGetPrograms(...args),
}));

vi.mock('~/services/event.server', () => ({
  EventService: {
    getUpcomingEvents: (...args: unknown[]) => mockGetUpcomingEvents(...args),
  },
}));

import { loader } from '../_layout.curriculum._index';

function makeQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.then = (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return query;
}

describe('curriculum loader filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes program-type classes (all audience scopes) and excludes seminar classes', async () => {
    const classesQuery = makeQuery({
      data: [
        {
          id: 'class-1',
          name: 'Adult Fundamentals',
          description: null,
          is_active: true,
          program: {
            id: 'program-1',
            name: 'Adults Program',
            description: null,
            engagement_type: 'program',
            audience_scope: 'adults',
            min_age: 18,
            max_age: null,
            duration_minutes: 60,
            max_capacity: 20,
            monthly_fee_cents: 12000,
            yearly_fee_cents: null,
          },
        },
        {
          id: 'class-2',
          name: 'Mixed Open Class',
          description: null,
          is_active: true,
          program: {
            id: 'program-2',
            name: 'Mixed Program',
            description: null,
            engagement_type: 'program',
            audience_scope: 'mixed',
            min_age: 14,
            max_age: null,
            duration_minutes: 60,
            max_capacity: 20,
            monthly_fee_cents: 12000,
            yearly_fee_cents: null,
          },
        },
        {
          id: 'class-3',
          name: 'Youth Class',
          description: null,
          is_active: true,
          program: {
            id: 'program-3',
            name: 'Youth Program',
            description: null,
            engagement_type: 'program',
            audience_scope: 'youth',
            min_age: 6,
            max_age: 12,
            duration_minutes: 60,
            max_capacity: 20,
            monthly_fee_cents: 10000,
            yearly_fee_cents: null,
          },
        },
        {
          id: 'class-4',
          name: 'Adult Seminar Series',
          description: null,
          is_active: true,
          program: {
            id: 'program-4',
            name: 'Seminar Program',
            description: null,
            engagement_type: 'seminar',
            audience_scope: 'adults',
            min_age: 18,
            max_age: null,
            duration_minutes: 90,
            max_capacity: 16,
            monthly_fee_cents: null,
            yearly_fee_cents: null,
          },
        },
      ],
      error: null,
    });

    const schedulesQuery = makeQuery({
      data: [
        { class_id: 'class-1', day_of_week: 'monday', start_time: '18:00:00' },
        { class_id: 'class-2', day_of_week: 'wednesday', start_time: '19:00:00' },
      ],
      error: null,
    });

    const supabaseAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'classes') {
          return classesQuery;
        }
        if (table === 'class_schedules') {
          return schedulesQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    mockGetSupabaseAdminClient.mockReturnValue(supabaseAdmin);
    mockGetPrograms
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockGetUpcomingEvents.mockResolvedValue([]);

    const response = await loader();
    const payload = await response.json();

    expect(mockGetPrograms).toHaveBeenNthCalledWith(1, { is_active: true, engagement_type: 'program' });
    expect(mockGetPrograms).toHaveBeenNthCalledWith(2, { is_active: true, engagement_type: 'seminar' });
    expect(payload.classes.map((classItem: { id: string }) => classItem.id)).toEqual([
      'class-1',
      'class-2',
      'class-3',
    ]);
  });
});
