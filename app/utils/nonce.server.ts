import { createHmac } from "crypto";

const NONCE_SECRET = process.env.NONCE_SECRET ? 
    Buffer.from(process.env.NONCE_SECRET, 'hex') : 
    createHmac('sha256', process.env.NODE_ENV + (process.env.SESSION_SECRET || 'default-fallback')).digest();

export function deriveNonceForRequest(request: Request): string {
    const ua = request.headers.get('user-agent') || '';
    const al = request.headers.get('accept-language') || '';
    const xfwdHost = request.headers.get('x-forwarded-host') || '';
    const xfwdProto = request.headers.get('x-forwarded-proto') || '';
    
    const protocol = xfwdProto || (new URL(request.url).protocol.replace(':', ''));
    const host = xfwdHost || new URL(request.url).host || 'localhost';
    const baseUrl = `${protocol}://${host}`;
    
    const data = `${baseUrl}|${ua}|${al}|${xfwdHost}|${xfwdProto}`;
    const digest = createHmac('sha256', NONCE_SECRET).update(data).digest('base64');
    return digest.slice(0, 22);
}