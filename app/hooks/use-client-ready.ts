import { useState, useEffect } from 'react';

/**
 * Custom hook to handle client-side hydration and loading states
 * Returns true when the component is ready to render client-side content
 */
export function useClientReady() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

/**
 * Custom hook with additional delay for components that need extra time
 * Useful for components that depend on browser APIs or external resources
 */
export function useClientReadyWithDelay(delay: number = 100) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClient(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return isClient;
}