export function shouldRevalidateRootForAnonymousCsrf(currentUrl: URL, nextUrl: URL): boolean {
  return currentUrl.pathname === "/" && nextUrl.pathname !== "/";
}
