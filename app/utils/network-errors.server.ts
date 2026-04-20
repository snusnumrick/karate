export function isNetworkFetchError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('enotfound')
    );
  }

  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { message?: unknown; details?: unknown };
    const message = typeof maybeError.message === 'string' ? maybeError.message.toLowerCase() : '';
    const details = typeof maybeError.details === 'string' ? maybeError.details.toLowerCase() : '';
    const combined = `${message} ${details}`;

    return (
      combined.includes('fetch failed') ||
      combined.includes('aborterror') ||
      combined.includes('network') ||
      combined.includes('econnreset') ||
      combined.includes('etimedout') ||
      combined.includes('enotfound')
    );
  }

  return false;
}
