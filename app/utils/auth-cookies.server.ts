import { parse, serialize } from "cookie";

export function isSupabaseAuthCookieName(cookieName: string): boolean {
  return cookieName.startsWith("sb-")
    || cookieName.startsWith("sb:")
    || cookieName.endsWith("-token");
}

export function hasSupabaseAuthCookie(request: Request): boolean {
  const cookies = parse(request.headers.get("cookie") ?? "");
  return Object.keys(cookies).some(isSupabaseAuthCookieName);
}

export function hasSupabaseAuthSignal(request: Request): boolean {
  return hasSupabaseAuthCookie(request) || Boolean(request.headers.get("authorization"));
}

export function clearSupabaseAuthCookies(request: Request, headers: Headers): void {
  const cookies = parse(request.headers.get("cookie") ?? "");
  const cookieNames = Object.keys(cookies).filter(isSupabaseAuthCookieName);

  if (cookieNames.length === 0) {
    return;
  }

  const secure = process.env.NODE_ENV === "production";

  for (const cookieName of cookieNames) {
    headers.append("Set-Cookie", serialize(cookieName, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    }));
  }
}

type AuthErrorLike = {
  code?: string;
  message?: string;
};

export function isRefreshTokenNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const { code, message } = error as AuthErrorLike;
  return code === "refresh_token_not_found"
    || (typeof message === "string" && message.includes("Invalid Refresh Token"));
}

export function isAuthSessionMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const { message } = error as AuthErrorLike;
  return typeof message === "string" && message.includes("Auth session missing");
}
