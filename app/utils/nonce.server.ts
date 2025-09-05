import crypto from "node:crypto";

// Determine strict CSP dev mode and a fixed dev nonce used across SSR/CSR
const STRICT_DEV = process.env.CSP_STRICT_DEV === '1' || process.env.CSP_STRICT_DEV === 'true';
const DEV_FIXED_NONCE = 'dev-fixed-nonce';

// Shared per-process secret to derive deterministic nonces per request (same within a single invocation)
// Use a deterministic secret based on process environment to ensure consistency across server.js and entry.server.tsx
const NONCE_SECRET = process.env.NONCE_SECRET ? 
    Buffer.from(process.env.NONCE_SECRET, 'hex') : 
    crypto.createHash('sha256').update(process.env.NODE_ENV + (process.env.SESSION_SECRET || 'default-fallback')).digest();

export function deriveNonceForRequest(request: Request): string {
    // if (STRICT_DEV) return DEV_FIXED_NONCE;
    
    // For production, generate nonce based on session-level data, not request-specific URL
    // This ensures the same nonce is used for the main page and all its assets
    const ua = request.headers.get('user-agent') || '';
    const al = request.headers.get('accept-language') || '';
    const xfwdHost = request.headers.get('x-forwarded-host') || '';
    const xfwdProto = request.headers.get('x-forwarded-proto') || '';
    
    // Extract base URL without path/query to ensure consistency across asset requests
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    const data = `${baseUrl}|${ua}|${al}|${xfwdHost}|${xfwdProto}`;
    console.log('Nonce.server.ts nonce data:', { baseUrl, ua: ua.substring(0, 50), al, xfwdHost, xfwdProto, data: data.substring(0, 100) });
    const digest = crypto.createHmac('sha256', NONCE_SECRET).update(data).digest('base64');
    // Keep nonce reasonably short while remaining high entropy
    return digest.slice(0, 22); // ~132 bits of entropy
}

export { STRICT_DEV, DEV_FIXED_NONCE };