import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoaderFunctionArgs } from '@remix-run/node';

const mockGetSupabaseServerClient = vi.fn();
const mockGetSupabaseAdminClient = vi.fn();
const mockGetAdultPrograms = vi.fn();
const mockGetUpcomingEvents = vi.fn();

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseServerClient: (...args: unknown[]) => mockGetSupabaseServerClient(...args),
  getSupabaseAdminClient: () => mockGetSupabaseAdminClient(),
}));

vi.mock('~/services/program.server', () => ({
  getAdultPrograms: (...args: unknown[]) => mockGetAdultPrograms(...args),
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

  it('includes adult/mixed program classes and excludes youth/seminar classes', async () => {
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

    const supabaseServer = {};
    mockGetSupabaseServerClient.mockReturnValue({ supabaseServer, response: new Response() });
    mockGetSupabaseAdminClient.mockReturnValue(supabaseAdmin);
    mockGetAdultPrograms
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockGetUpcomingEvents.mockResolvedValue([]);

    const response = await loader({
      request: new Request('http://localhost/curriculum'),
      params: {},
    } as LoaderFunctionArgs);
    const payload = await response.json();

    expect(mockGetAdultPrograms).toHaveBeenNthCalledWith(1, supabaseServer, 'program');
    expect(mockGetAdultPrograms).toHaveBeenNthCalledWith(2, supabaseServer, 'seminar');
    expect(payload.classes.map((classItem: { id: string }) => classItem.id)).toEqual([
      'class-1',
      'class-2',
    ]);
  });
});

