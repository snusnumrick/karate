import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetMainPageScheduleCacheForTests,
  getMainPageScheduleData,
} from '../class.server';

describe('getMainPageScheduleData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T00:00:00.000Z'));
    __resetMainPageScheduleCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetMainPageScheduleCacheForTests();
  });

  it('maps RPC schedule summary to the public contract', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          days: 'Monday, Wednesday',
          time_range: '6:00 PM - 7:00 PM',
          age_range: '6-12',
          duration: '60 minutes',
          max_students: 18,
          min_age: 6,
          max_age: 12,
        },
      ],
      error: null,
    });

    const summary = await getMainPageScheduleData({ rpc } as never);

    expect(summary).toEqual({
      days: 'Monday, Wednesday',
      time: '6:00 PM - 7:00 PM',
      ageRange: '6-12',
      duration: '60 minutes',
      maxStudents: 18,
      minAge: 6,
      maxAge: 12,
    });
    expect(rpc).toHaveBeenCalledWith('get_main_page_schedule_summary');
  });

  it('uses fallback defaults when RPC values are partially null', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          days: null,
          time_range: null,
          age_range: null,
          duration: null,
          max_students: null,
          min_age: null,
          max_age: null,
        },
      ],
      error: null,
    });

    const summary = await getMainPageScheduleData({ rpc } as never);

    expect(summary).toEqual({
      days: 'Tuesday & Thursday',
      time: '5:45 PM - 7:15 PM',
      ageRange: '4+',
      duration: '60 minutes',
      maxStudents: 20,
      minAge: 4,
      maxAge: 12,
    });
  });

  it('returns null on RPC error and caches null within TTL', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'rpc failed' },
    });

    const first = await getMainPageScheduleData({ rpc } as never);
    const second = await getMainPageScheduleData({ rpc } as never);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent requests while RPC fetch is in flight', async () => {
    let resolveRpc:
      | ((value: {
          data: Array<{
            days: string;
            time_range: string;
            age_range: string;
            duration: string;
            max_students: number;
            min_age: number;
            max_age: number;
          }>;
          error: null;
        }) => void)
      | undefined;

    const rpc = vi.fn(
      () =>
        new Promise<{
          data: Array<{
            days: string;
            time_range: string;
            age_range: string;
            duration: string;
            max_students: number;
            min_age: number;
            max_age: number;
          }>;
          error: null;
        }>((resolve) => {
          resolveRpc = resolve;
        })
    );

    const p1 = getMainPageScheduleData({ rpc } as never);
    const p2 = getMainPageScheduleData({ rpc } as never);

    await Promise.resolve();
    expect(rpc).toHaveBeenCalledTimes(1);

    resolveRpc?.({
      data: [
        {
          days: 'Tuesday',
          time_range: '5:00 PM - 6:00 PM',
          age_range: '4-8',
          duration: '60 minutes',
          max_students: 10,
          min_age: 4,
          max_age: 8,
        },
      ],
      error: null,
    });

    const [first, second] = await Promise.all([p1, p2]);
    expect(first).toEqual(second);
  });

  it('refreshes cache after TTL expires', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            days: 'Monday',
            time_range: '5:00 PM - 6:00 PM',
            age_range: '5-10',
            duration: '60 minutes',
            max_students: 12,
            min_age: 5,
            max_age: 10,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            days: 'Wednesday',
            time_range: '6:00 PM - 7:00 PM',
            age_range: '7-13',
            duration: '60 minutes',
            max_students: 16,
            min_age: 7,
            max_age: 13,
          },
        ],
        error: null,
      });

    const first = await getMainPageScheduleData({ rpc } as never);
    const cached = await getMainPageScheduleData({ rpc } as never);

    expect(first).toEqual(cached);
    expect(rpc).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    const refreshed = await getMainPageScheduleData({ rpc } as never);
    expect(refreshed?.days).toBe('Wednesday');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
