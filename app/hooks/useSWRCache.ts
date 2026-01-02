import { useState, useEffect, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry<unknown>>();

export function useSWRCache<T>(
  key: string,
  url: string,
  options: {
    refreshInterval?: number;
    dedupingInterval?: number;
  } = {}
) {
  const { refreshInterval = 300000 } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true);

    try {
      const cached = cache.get(key);
      const now = Date.now();

      // Return cached data if fresh
      if (cached && now - cached.timestamp < CACHE_DURATION) {
        setData(cached.data as T);
        setIsLoading(false);
        return cached.data as T;
      }

      // Fetch from server
      const response = await fetch(url, {
        headers: cached?.etag ? {
          'If-None-Match': cached.etag!
        } : {}
      });

      if (response.status === 304 && cached) {
        // Not modified, use cached
        setData(cached.data as T);
        setIsLoading(false);
        return cached.data as T;
      }

      const newData = await response.json() as T;
      const etag = response.headers.get('ETag') || undefined;

      cache.set(key, {
        data: newData,
        timestamp: now,
        etag
      });

      setData(newData);
      setError(null);
    } catch (err) {
      setError(err as Error);
      // Fallback to cache on error
      const cached = cache.get(key);
      if (cached) setData(cached.data as T);
    } finally {
      setIsLoading(false);
    }

    return null;
  }, [key, url]);

  useEffect(() => {
    fetchData(true);

    const interval = setInterval(() => {
      fetchData(false);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  const revalidate = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return { data, isLoading, error, revalidate };
}
