import { useEffect } from 'react';

interface BackgroundRefreshConfig {
  interval: number; // in milliseconds
  urls: string[];
  onData?: (url: string, data: unknown) => void;
}

export function useBackgroundRefresh({ interval, urls, onData }: BackgroundRefreshConfig) {
  useEffect(() => {
    const fetchData = async (url: string) => {
      try {
        const response = await fetch(url);
        const data = await response.json();
        onData?.(url, data);
      } catch (error) {
        console.error(`Background refresh failed for ${url}:`, error);
      }
    };

    // Initial fetch
    urls.forEach(url => fetchData(url));

    // Set up interval
    const intervalId = setInterval(() => {
      urls.forEach(url => fetchData(url));
    }, interval);

    return () => clearInterval(intervalId);
  }, [interval, urls, onData]);
}
