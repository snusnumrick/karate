import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasUsableSupabaseSessionTokens } from "../supabase-session";

function createJwtWithExpiry(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp }))
    .toString("base64url");
  return `${header}.${payload}.signature`;
}

describe("hasUsableSupabaseSessionTokens", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T20:00:00.000Z"));
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, "window");
  });

  it("accepts tokens when the access token is still comfortably valid", () => {
    const accessToken = createJwtWithExpiry(Math.floor(Date.now() / 1000) + 120);

    expect(hasUsableSupabaseSessionTokens(accessToken, "refresh-token")).toBe(true);
  });

  it("rejects tokens that are too close to expiry", () => {
    const accessToken = createJwtWithExpiry(Math.floor(Date.now() / 1000) + 20);

    expect(hasUsableSupabaseSessionTokens(accessToken, "refresh-token")).toBe(false);
  });

  it("rejects malformed or incomplete token pairs", () => {
    expect(hasUsableSupabaseSessionTokens("not-a-jwt", "refresh-token")).toBe(false);
    expect(hasUsableSupabaseSessionTokens(createJwtWithExpiry(Math.floor(Date.now() / 1000) + 120), undefined)).toBe(false);
  });
});
