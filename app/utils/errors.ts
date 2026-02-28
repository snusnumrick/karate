export function toErrorMessage(error: unknown, fallback = "An unexpected error occurred."): string {
  if (error instanceof Error) {
    const message = error.message?.trim();
    return message || fallback;
  }

  if (typeof error === "string") {
    const message = error.trim();
    return message || fallback;
  }

  if (error && typeof error === "object") {
    const candidate = (error as { message?: unknown; error?: unknown; statusText?: unknown });
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message.trim();
    }
    if (typeof candidate.error === "string" && candidate.error.trim()) {
      return candidate.error.trim();
    }
    if (typeof candidate.statusText === "string" && candidate.statusText.trim()) {
      return candidate.statusText.trim();
    }
  }

  return fallback;
}

export function toErrorLogDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  if (error && typeof error === "object") {
    return { ...(error as Record<string, unknown>) };
  }

  return { value: error };
}

export function logStructuredError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  console.error(context, {
    ...metadata,
    error: toErrorLogDetails(error),
  });
}

export type AppErrorEnvelope = {
  code: string;
  message: string;
  details?: unknown;
};

export function buildAppError(
  code: string,
  message: string,
  details?: unknown
): AppErrorEnvelope {
  return {
    code,
    message,
    ...(details === undefined ? {} : { details }),
  };
}
