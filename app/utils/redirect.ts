const INTERNAL_REDIRECT_PREFIX = "/";

// Ensures we only redirect to internal paths and fall back to a known-safe default.
export function safeRedirect(
  target: FormDataEntryValue | null | undefined,
  defaultRedirect = "/"
): string {
  if (!target || typeof target !== "string") {
    return defaultRedirect;
  }

  if (!target.startsWith(INTERNAL_REDIRECT_PREFIX)) {
    return defaultRedirect;
  }

  if (target.startsWith("//")) {
    return defaultRedirect;
  }

  return target;
}

// Pulls a redirect target from the request URL without validating it.
export function getRedirectToParam(request: Request, paramName = "redirectTo"): string | null {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get(paramName);
  return redirectTo ?? null;
}
