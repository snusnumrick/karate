import { describe, expect, it } from "vitest";
import {
  clearLoginRateLimitCookie,
  formatRetryDelay,
  getLoginRateLimitState,
  setLoginRateLimitCookie,
} from "../login-rate-limit.server";

describe("login rate limit helpers", () => {
  it("returns limited state when retry cookie is still in the future", () => {
    const now = Date.UTC(2026, 3, 19, 21, 30, 0);
    const request = new Request("https://example.test/login", {
      headers: {
        cookie: `login-rate-limit-until=${now + 45_000}`,
      },
    });

    expect(getLoginRateLimitState(request, now)).toEqual({
      isLimited: true,
      retryAfterSeconds: 45,
      retryUntil: now + 45_000,
    });
  });

  it("returns unlimited state when retry cookie is missing or expired", () => {
    const now = Date.UTC(2026, 3, 19, 21, 30, 0);
    const expiredRequest = new Request("https://example.test/login", {
      headers: {
        cookie: `login-rate-limit-until=${now - 1_000}`,
      },
    });

    expect(getLoginRateLimitState(new Request("https://example.test/login"), now)).toEqual({
      isLimited: false,
      retryAfterSeconds: 0,
      retryUntil: null,
    });
    expect(getLoginRateLimitState(expiredRequest, now)).toEqual({
      isLimited: false,
      retryAfterSeconds: 0,
      retryUntil: null,
    });
  });

  it("sets and clears the cooldown cookie", () => {
    const headers = new Headers();
    const now = Date.UTC(2026, 3, 19, 21, 30, 0);

    const retryUntil = setLoginRateLimitCookie(headers, 60, now);

    expect(retryUntil).toBe(now + 60_000);
    expect(headers.get("Set-Cookie")).toContain("login-rate-limit-until=");

    clearLoginRateLimitCookie(headers);

    const cookieHeaders = headers.getSetCookie();
    expect(cookieHeaders.at(-1)).toContain("login-rate-limit-until=");
    expect(cookieHeaders.at(-1)).toContain("Max-Age=0");
  });

  it("formats retry delays for seconds and minutes", () => {
    expect(formatRetryDelay(15)).toBe("15 seconds");
    expect(formatRetryDelay(60)).toBe("1 minute");
    expect(formatRetryDelay(61)).toBe("2 minutes");
  });
});
