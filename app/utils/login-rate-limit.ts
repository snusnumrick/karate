const DEFAULT_RETRY_AFTER_SECONDS = 60;

export function formatRetryDelay(retryAfterSeconds: number): string {
  if (retryAfterSeconds < 60) {
    return `${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}`;
  }

  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export { DEFAULT_RETRY_AFTER_SECONDS };
