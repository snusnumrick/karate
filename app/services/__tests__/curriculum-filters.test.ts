import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdultPrograms, getUpcomingPublicSeminars } from '../program.server';
import { getSelfEnrollableClasses } from '../class.server';

type QueryResult = { data: unknown; error: unknown };

function createThenableQuery(result: QueryResult) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.or = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.then = (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return query;
}

describe('curriculum filtering queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAdultPrograms applies active + adults/mixed + engagement filters', async () => {
    const query = createThenableQuery({ data: [], error: null });
    const supabase = {
      from: vi.fn(() => query),
    };

    const programs = await getAdultPrograms(supabase as never, 'seminar');

    expect(programs).toEqual([]);
    expect(supabase.from).toHaveBeenCalledWith('programs');
    expect((query.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(['is_active', true]);
    expect((query.in as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      'audience_scope',
      ['adults', 'mixed'],
    ]);
    expect((query.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      'engagement_type',
      'seminar',
    ]);
  });

  it('getAdultPrograms omits engagement filter when not requested', async () => {
    const query = createThenableQuery({ data: [], error: null });
    const supabase = {
      from: vi.fn(() => query),
    };

    await getAdultPrograms(supabase as never);

    const engagementEqUsed = (query.eq as ReturnType<typeof vi.fn>).mock.calls.some(
      (call) => call[0] === 'engagement_type'
    );
    expect(engagementEqUsed).toBe(false);
  });

  it('getSelfEnrollableClasses applies open + active + self-enrollment filters', async () => {
    const query = createThenableQuery({ data: [], error: null });
    const supabase = {
      from: vi.fn(() => query),
    };

    const classes = await getSelfEnrollableClasses('program-1', supabase as never);

    expect(classes).toEqual([]);
    expect(supabase.from).toHaveBeenCalledWith('classes');
    expect((query.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(['program_id', 'program-1']);
    expect((query.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      'allow_self_enrollment',
      true,
    ]);
    expect((query.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(['is_active', true]);
    expect((query.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      'registration_status',
      'open',
    ]);
  });

  it('getUpcomingPublicSeminars returns each upcoming run for the same seminar template', async () => {
    const query = createThenableQuery({
      data: [
        {
          id: 'program-1',
          name: 'Summer Camp 2026',
          description: 'Summer camp',
          duration_minutes: 120,
          engagement_type: 'seminar',
          ability_category: null,
          delivery_format: null,
          seminar_type: null,
          audience_scope: 'youth',
          slug: null,
          min_capacity: null,
          max_capacity: 20,
          sessions_per_week: 1,
          min_sessions_per_week: null,
          max_sessions_per_week: null,
          min_belt_rank: null,
          max_belt_rank: null,
          belt_rank_required: false,
          prerequisite_programs: null,
          min_age: 7,
          max_age: 15,
          gender_restriction: 'none',
          special_needs_support: false,
          monthly_fee_cents: 0,
          registration_fee_cents: 15000,
          yearly_fee_cents: 0,
          individual_session_fee_cents: 0,
          single_purchase_price_cents: null,
          subscription_monthly_price_cents: null,
          subscription_yearly_price_cents: null,
          required_waiver_id: null,
          is_active: true,
          created_at: '2026-04-20T00:00:00+00:00',
          updated_at: '2026-04-20T00:00:00+00:00',
          classes: [
            {
              id: 'run-2',
              name: 'Second Run',
              is_active: true,
              series_start_on: '2099-07-27',
              series_end_on: '2099-08-02',
              registration_status: 'closed',
              price_override_cents: null,
              registration_fee_override_cents: null,
              allow_self_enrollment: true,
            },
            {
              id: 'run-1',
              name: 'First Run',
              is_active: true,
              series_start_on: '2099-07-20',
              series_end_on: '2099-07-26',
              registration_status: 'open',
              price_override_cents: null,
              registration_fee_override_cents: null,
              allow_self_enrollment: true,
            },
          ],
        },
      ],
      error: null,
    });
    const supabase = {
      from: vi.fn(() => query),
    };

    const seminars = await getUpcomingPublicSeminars(supabase as never);

    expect(seminars.map((seminar) => seminar.nextClass.id)).toEqual(['run-1', 'run-2']);
    expect(seminars.map((seminar) => seminar.name)).toEqual(['Summer Camp 2026', 'Summer Camp 2026']);
    expect(seminars[0].nextClass.effective_price_cents).toBe(15000);
    expect((query.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      'engagement_type',
      'seminar',
    ]);
    expect((query.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(['is_active', true]);
  });
});
