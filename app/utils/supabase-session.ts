function decodeJwtExpiry(accessToken: string): number | null {
  try {
    const [, payload] = accessToken.split(".");
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch {
    return null;
  }
}

export function hasUsableSupabaseSessionTokens(
  accessToken?: string,
  refreshToken?: string
): accessToken is string {
  if (!accessToken || !refreshToken || typeof window === "undefined") {
    return false;
  }

  const exp = decodeJwtExpiry(accessToken);
  if (!exp) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const refreshSafetyWindowSeconds = 30;
  return exp - now > refreshSafetyWindowSeconds;
}
