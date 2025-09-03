import crypto from "node:crypto";

// Determine strict CSP dev mode and a fixed dev nonce used across SSR/CSR
const STRICT_DEV = process.env.CSP_STRICT_DEV === '1' || process.env.CSP_STRICT_DEV === 'true';
const DEV_FIXED_NONCE = 'dev-fixed-nonce';

// Shared per-process secret to derive deterministic nonces per request (same within a single invocation)
const NONCE_SECRET = crypto.randomBytes(32);

export function deriveNonceForRequest(request: Request): string {
    if (STRICT_DEV) return DEV_FIXED_NONCE;
    const ua = request.headers.get('user-agent') || '';
    const al = request.headers.get('accept-language') || '';
    const xfwdHost = request.headers.get('x-forwarded-host') || '';
    const xfwdProto = request.headers.get('x-forwarded-proto') || '';
    const data = `${request.url}|${ua}|${al}|${xfwdHost}|${xfwdProto}`;
    const digest = crypto.createHmac('sha256', NONCE_SECRET).update(data).digest('base64');
    // Keep nonce reasonably short while remaining high entropy
    return digest.slice(0, 22); // ~132 bits of entropy
}

export { STRICT_DEV, DEV_FIXED_NONCE };