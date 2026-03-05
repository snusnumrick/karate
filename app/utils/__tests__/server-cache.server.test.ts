import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServerCache } from '../server-cache.server';

describe('createServerCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores values with TTL and expires them', () => {
    const cache = createServerCache<string, string>({ defaultTtlMs: 1_000 });
    cache.set('key', 'value');

    expect(cache.get('key')).toBe('value');

    vi.advanceTimersByTime(1_001);
    expect(cache.get('key')).toBeNull();
  });

  it('deduplicates concurrent getOrLoad calls for the same key', async () => {
    const cache = createServerCache<string, string>({ defaultTtlMs: 10_000 });
    const load = vi.fn(async () => 'loaded');

    const [a, b, c] = await Promise.all([
      cache.getOrLoad('k1', load),
      cache.getOrLoad('k1', load),
      cache.getOrLoad('k1', load),
    ]);

    expect(a).toBe('loaded');
    expect(b).toBe('loaded');
    expect(c).toBe('loaded');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reuses cached value without calling loader', async () => {
    const cache = createServerCache<string, string>({ defaultTtlMs: 10_000 });
    const load = vi.fn(async () => 'loaded');

    await cache.getOrLoad('k1', load);
    const second = await cache.getOrLoad('k1', load);

    expect(second).toBe('loaded');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('invalidates a specific key and all keys', async () => {
    const cache = createServerCache<string, string>({ defaultTtlMs: 10_000 });
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');

    cache.invalidate('k1');
    expect(cache.get('k1')).toBeNull();
    expect(cache.get('k2')).toBe('v2');

    cache.invalidate();
    expect(cache.get('k2')).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('clears expired entries and returns the deleted count', () => {
    const cache = createServerCache<string, string>({ defaultTtlMs: 1_000 });
    cache.set('k1', 'v1', 500);
    cache.set('k2', 'v2', 2_000);

    vi.advanceTimersByTime(800);

    const deleted = cache.clearExpired();
    expect(deleted).toBe(1);
    expect(cache.get('k1')).toBeNull();
    expect(cache.get('k2')).toBe('v2');
  });
});
