import { parse, serialize } from "cookie";
import { DEFAULT_RETRY_AFTER_SECONDS, formatRetryDelay } from "./login-rate-limit";

const LOGIN_RATE_LIMIT_COOKIE = "login-rate-limit-until";

function readRetryUntilTimestamp(request: Request): number | null {
  const cookies = parse(request.headers.get("cookie") ?? "");
  const rawValue = cookies[LOGIN_RATE_LIMIT_COOKIE];

  if (!rawValue) {
    return null;
  }

  const timestamp = Number(rawValue);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }

  return timestamp;
}

export function getLoginRateLimitState(request: Request, now = Date.now()) {
  const retryUntil = readRetryUntilTimestamp(request);

  if (!retryUntil || retryUntil <= now) {
    return {
      isLimited: false,
      retryAfterSeconds: 0,
      retryUntil: null as number | null,
    };
  }

  return {
    isLimited: true,
    retryAfterSeconds: Math.ceil((retryUntil - now) / 1000),
    retryUntil,
  };
}

export function setLoginRateLimitCookie(
  headers: Headers,
  retryAfterSeconds = DEFAULT_RETRY_AFTER_SECONDS,
  now = Date.now()
): number {
  const retryUntil = now + retryAfterSeconds * 1000;
  const secure = process.env.NODE_ENV === "production";

  headers.append("Set-Cookie", serialize(LOGIN_RATE_LIMIT_COOKIE, String(retryUntil), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/login",
    maxAge: retryAfterSeconds,
    expires: new Date(retryUntil),
  }));

  return retryUntil;
}

export function clearLoginRateLimitCookie(headers: Headers): void {
  const secure = process.env.NODE_ENV === "production";

  headers.append("Set-Cookie", serialize(LOGIN_RATE_LIMIT_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/login",
    maxAge: 0,
    expires: new Date(0),
  }));
}

export { DEFAULT_RETRY_AFTER_SECONDS };
export { formatRetryDelay };
