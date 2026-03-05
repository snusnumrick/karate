type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type ServerCacheOptions = {
  defaultTtlMs: number;
};

export type LoadOptions = {
  ttlMs?: number;
};

export type ServerCache<K, V> = {
  get(key: K): V | null;
  set(key: K, value: V, ttlMs?: number): V;
  getOrLoad(key: K, load: () => Promise<V>, options?: LoadOptions): Promise<V>;
  invalidate(key?: K): void;
  clearExpired(): number;
  size(): number;
};

export function createServerCache<K, V>(options: ServerCacheOptions): ServerCache<K, V> {
  const entries = new Map<K, CacheEntry<V>>();
  const inflight = new Map<K, Promise<V>>();

  function getNow() {
    return Date.now();
  }

  function get(key: K): V | null {
    const entry = entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= getNow()) {
      entries.delete(key);
      return null;
    }
    return entry.value;
  }

  function set(key: K, value: V, ttlMs = options.defaultTtlMs): V {
    const expiresAt = getNow() + ttlMs;
    entries.set(key, { value, expiresAt });
    return value;
  }

  async function getOrLoad(key: K, load: () => Promise<V>, loadOptions?: LoadOptions): Promise<V> {
    const cached = get(key);
    if (cached !== null) {
      return cached;
    }

    const existing = inflight.get(key);
    if (existing) {
      return existing;
    }

    const pending = load()
      .then((value) => set(key, value, loadOptions?.ttlMs ?? options.defaultTtlMs))
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, pending);
    return pending;
  }

  function invalidate(key?: K): void {
    if (key === undefined) {
      entries.clear();
      inflight.clear();
      return;
    }
    entries.delete(key);
    inflight.delete(key);
  }

  function clearExpired(): number {
    const now = getNow();
    let deleted = 0;
    for (const [key, entry] of entries.entries()) {
      if (entry.expiresAt <= now) {
        entries.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }

  function size(): number {
    return entries.size;
  }

  return {
    get,
    set,
    getOrLoad,
    invalidate,
    clearExpired,
    size,
  };
}
