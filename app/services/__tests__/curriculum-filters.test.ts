import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdultPrograms } from '../program.server';
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
});

