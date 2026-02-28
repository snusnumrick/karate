const CHUNK_RELOAD_GUARD_KEY = "__karate_chunk_reload_guard__";

const CHUNK_ERROR_PATTERNS = [
  "chunkloaderror",
  "loading chunk",
  "failed to fetch dynamically imported module",
  "dynamically imported module",
  "importing a module script failed",
  "unable to preload css",
];

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message || "";
  }

  if (error && typeof error === "object" && "message" in (error as Record<string, unknown>)) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "";
}

export function isChunkLoadError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function shouldAttemptChunkReload(storage: Pick<Storage, "getItem" | "setItem">, currentUrl: string): boolean {
  const previousUrl = storage.getItem(CHUNK_RELOAD_GUARD_KEY);
  if (previousUrl === currentUrl) {
    return false;
  }

  storage.setItem(CHUNK_RELOAD_GUARD_KEY, currentUrl);
  return true;
}
