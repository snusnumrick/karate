import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetRequiredWaiversCacheForTests,
  getRequiredWaivers,
  invalidateRequiredWaiversCache,
} from '../required-waivers-cache.server';

const mockGetSupabaseAdminClient = vi.fn();

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseAdminClient: () => mockGetSupabaseAdminClient(),
}));

function buildClient(rows: Array<{ id: string; title: string }>, error: { message: string } | null = null) {
  const eq = vi.fn().mockResolvedValue({ data: rows, error });
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, from, select, eq };
}

describe('required-waivers-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRequiredWaiversCacheForTests();
  });

  it('loads required waivers once and returns cached value on subsequent reads', async () => {
    const first = buildClient([{ id: 'w1', title: 'Registration Waiver' }]);
    mockGetSupabaseAdminClient.mockReturnValue(first.client);

    const a = await getRequiredWaivers();
    const b = await getRequiredWaivers();

    expect(a).toEqual([{ id: 'w1', title: 'Registration Waiver' }]);
    expect(b).toEqual(a);
    expect(first.from).toHaveBeenCalledTimes(1);
    expect(first.select).toHaveBeenCalledWith('id, title');
    expect(first.eq).toHaveBeenCalledWith('required', true);
  });

  it('invalidates cache and reloads latest waiver list', async () => {
    const initial = buildClient([{ id: 'w1', title: 'Old Waiver' }]);
    const updated = buildClient([{ id: 'w2', title: 'Updated Waiver' }]);

    mockGetSupabaseAdminClient
      .mockReturnValueOnce(initial.client)
      .mockReturnValueOnce(updated.client);

    await expect(getRequiredWaivers()).resolves.toEqual([{ id: 'w1', title: 'Old Waiver' }]);

    invalidateRequiredWaiversCache();

    await expect(getRequiredWaivers()).resolves.toEqual([{ id: 'w2', title: 'Updated Waiver' }]);
    expect(initial.from).toHaveBeenCalledTimes(1);
    expect(updated.from).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent loads while first fetch is in-flight', async () => {
    let resolveQuery: ((value: { data: Array<{ id: string; title: string }>; error: null }) => void) | undefined;
    const eq = vi.fn(
      () =>
        new Promise<{ data: Array<{ id: string; title: string }>; error: null }>((resolve) => {
          resolveQuery = resolve;
        })
    );
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    mockGetSupabaseAdminClient.mockReturnValue({ from });

    const p1 = getRequiredWaivers();
    const p2 = getRequiredWaivers();

    await Promise.resolve();
    expect(from).toHaveBeenCalledTimes(1);

    resolveQuery?.({ data: [{ id: 'w3', title: 'Shared Waiver' }], error: null });

    await expect(Promise.all([p1, p2])).resolves.toEqual([
      [{ id: 'w3', title: 'Shared Waiver' }],
      [{ id: 'w3', title: 'Shared Waiver' }],
    ]);
    expect(eq).toHaveBeenCalledTimes(1);
  });

  it('throws with context when fetching waivers fails', async () => {
    const failing = buildClient([], { message: 'db unavailable' });
    mockGetSupabaseAdminClient.mockReturnValue(failing.client);

    await expect(getRequiredWaivers()).rejects.toThrow(
      'Failed to fetch required waivers: db unavailable'
    );
  });
});
