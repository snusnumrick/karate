import { randomBytes } from "crypto";

export const STRICT_DEV = process.env.STRICT_DEV === "true";
export const DEV_FIXED_NONCE = "dev-nonce-123";

/**
 * Generates a unique nonce for the given request.
 * In development with STRICT_DEV=false, uses a fixed nonce for easier debugging.
 * Otherwise, generates a cryptographically secure random nonce.
 */
export function deriveNonceForRequest(request: Request): string {
    if (process.env.NODE_ENV === "development" && !STRICT_DEV) {
        return DEV_FIXED_NONCE;
    }

    // Generate a cryptographically secure random nonce
    // 12 bytes = 16 base64 characters (good balance of security and length)
    const nonceBytes = randomBytes(12);
    return nonceBytes.toString("base64");
}