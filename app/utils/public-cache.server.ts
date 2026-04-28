import { hasSupabaseAuthSignal } from "~/utils/auth-cookies.server";

export const ANONYMOUS_HOMEPAGE_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
export const NO_STORE_CACHE_CONTROL = "no-store, max-age=0, must-revalidate";

function acceptsHtml(request: Request): boolean {
  const accept = request.headers.get("accept");
  return !accept || accept.includes("text/html") || accept.includes("*/*");
}

export function isAnonymousHomepageDocumentRequest(request: Request): boolean {
  const url = new URL(request.url);
  return request.method.toUpperCase() === "GET"
    && url.pathname === "/"
    && acceptsHtml(request)
    && !hasSupabaseAuthSignal(request);
}

export function getDocumentCacheControl(request: Request, responseStatusCode = 200): string {
  if (
    responseStatusCode >= 200
    && responseStatusCode < 300
    && isAnonymousHomepageDocumentRequest(request)
  ) {
    return ANONYMOUS_HOMEPAGE_CACHE_CONTROL;
  }

  return NO_STORE_CACHE_CONTROL;
}
