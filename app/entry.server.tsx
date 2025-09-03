/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.server
 */

import {PassThrough} from "node:stream";
import crypto from "node:crypto"; // Import crypto for nonce generation
import {RemixServer} from "@remix-run/react";
import {isbot} from "isbot";
import {renderToPipeableStream} from "react-dom/server";
import {createReadableStreamFromReadable, EntryContext} from "@remix-run/node";

// Extend EntryContext to include nonce property
interface ExtendedEntryContext extends EntryContext {
    nonce?: string;
}

export const streamTimeout = 5_000;

// Determine strict CSP dev mode and a fixed dev nonce used across SSR/CSR
const STRICT_DEV = process.env.CSP_STRICT_DEV === '1' || process.env.CSP_STRICT_DEV === 'true';
const DEV_FIXED_NONCE = 'dev-fixed-nonce';

// Per-process secret to derive deterministic nonces per request (same within a single invocation)
const NONCE_SECRET = crypto.randomBytes(32);

function deriveNonceForRequest(request: Request) {
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

// Provide load context to all loaders/actions
export function getLoadContext({ request }: { request: Request }) {
    const nonce = deriveNonceForRequest(request);
    return { nonce };
}

// REFACTORED: Moved CSP generation to its own function to avoid duplication
function generateCsp(nonce: string) {
    const supabaseHostname = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : '';
    const supabaseOrigin = supabaseHostname ? `https://${supabaseHostname}` : '';

    const isDevelopment = process.env.NODE_ENV === 'development';
    const strictDev = process.env.CSP_STRICT_DEV === '1' || process.env.CSP_STRICT_DEV === 'true';
    const isLenientDev = isDevelopment && !strictDev;
    const devWebSockets = isDevelopment ? 'ws://localhost:* wss://localhost:* ws://127.0.0.1:* wss://127.0.0.1:*' : '';
    const devHttpOrigins = isDevelopment ? 'http://localhost:* http://127.0.0.1:*' : '';

    const connectSrc = [
        "'self'",
        "https://*.google-analytics.com",
        "https://*.analytics.google.com",
        "https://*.google.com",
        "https://stats.g.doubleclick.net",
        "https://api.stripe.com",
        "https://umami-two-lilac.vercel.app",
        supabaseOrigin ? `${supabaseOrigin} wss://${supabaseHostname}` : '',
        devWebSockets,
        devHttpOrigins,
    ].filter(Boolean).join(" ");

    const imgSrc = [
        "'self'",
        "data:",
        supabaseOrigin,
        isLenientDev ? 'blob:' : '',
        "https://*.google-analytics.com",
        "https://*.googletagmanager.com",
        "https://stats.g.doubleclick.net",
    ].filter(Boolean).join(" ");

    const styleSrc = [
        "'self'",
        `'nonce-${nonce}'`,
        isLenientDev ? "'unsafe-inline'" : '',
        // Add specific hashes for Vite HMR and Tailwind CSS in strict dev mode
        strictDev ? "'sha256-EiOgLoAxcFRdVJdZFcHv/Yp+zfJ5omuJDkY/tMXzd10='" : '',
        strictDev ? "'sha256-40oAvW7ca/qI/9rapLlXiO+wKrmLDJScrYFlb0ePVsU='" : '',
        strictDev ? "'sha256-hT67pHEAagXZWXCR6f0OxilTM/BibRRnzdBjQgTnd5U='" : '',
        "https://fonts.googleapis.com",
    ].filter(Boolean).join(" ");

    const scriptSrc = [
        "'self'",
        `'nonce-${nonce}'`,
        "https://js.stripe.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://tagmanager.google.com",
        "https://umami-two-lilac.vercel.app",
        isLenientDev ? "'unsafe-eval' 'unsafe-inline'" : '',
    ].filter(Boolean).join(" ");

    const fontSrc = [
        "'self'",
        "https://fonts.gstatic.com",
        "data:",
    ].filter(Boolean).join(" ");

    const frameSrc = [
        "'self'",
        "https://js.stripe.com",
        "https://hooks.stripe.com",
        "https://www.youtube.com",
        "https://player.vimeo.com",
    ].filter(Boolean).join(" ");

    const extraCspDirectives = [
        isLenientDev ? "upgrade-insecure-requests" : '',
    ].filter(Boolean);

    const cspDirectives = [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        `style-src ${styleSrc}`,
        `font-src ${fontSrc}`,
        `img-src ${imgSrc}`,
        `connect-src ${connectSrc}`,
        `frame-src ${frameSrc}`,
        "base-uri 'self'",
        "form-action 'self'",
        ...extraCspDirectives,
    ];

    return cspDirectives.join('; ').trim();
}

export default function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    remixContext: EntryContext
) {
    // Derive the same per-request nonce used by getLoadContext
    const nonce = deriveNonceForRequest(request);

    // Add nonce to the response headers via the CSP
    const csp = generateCsp(nonce);
    responseHeaders.set("Content-Security-Policy", csp);

    // Pass the nonce to the React application (for Scripts, etc.)
    (remixContext as ExtendedEntryContext).nonce = nonce;

    return isbot(request.headers.get("user-agent"))
        ? handleBotRequest(
            request,
            responseStatusCode,
            responseHeaders,
            remixContext
        )
        : handleBrowserRequest(
            request,
            responseStatusCode,
            responseHeaders,
            remixContext
        );
}

function handleBotRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    remixContext: EntryContext
) {
    const nonce = (remixContext as ExtendedEntryContext)?.nonce;
    return new Promise((resolve, reject) => {
        let shellRendered = false;
        const {pipe, abort} = renderToPipeableStream(
            <RemixServer
                context={remixContext}
                url={request.url}
                abortDelay={streamTimeout}
            />,
            {
                nonce: nonce || undefined, // Ensure React's inline runtime scripts get the CSP nonce
                bootstrapScriptContent: `window.__remixContext.nonce = ${JSON.stringify(nonce)};`,
                onAllReady() {
                    shellRendered = true;
                    const body = new PassThrough();
                    const stream = createReadableStreamFromReadable(body);
                    responseHeaders.set("Content-Type", "text/html");

                    resolve(
                        new Response(stream, {headers: responseHeaders, status: responseStatusCode})
                    );
                    pipe(body);
                },
                onShellError: reject,
                onError(error: unknown) {
                    responseStatusCode = 500;
                    if (shellRendered) console.error(error);
                },
            }
        );
        setTimeout(abort, streamTimeout + 1_000);
    });
}

function handleBrowserRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    remixContext: EntryContext
) {
    const nonce = (remixContext as ExtendedEntryContext)?.nonce;
    return new Promise((resolve, reject) => {
        let shellRendered = false;
        const {pipe, abort} = renderToPipeableStream(
            <RemixServer
                context={remixContext}
                url={request.url}
                abortDelay={streamTimeout}
            />,
            {
                nonce: nonce || undefined, // Ensure React's inline runtime scripts get the CSP nonce
                bootstrapScriptContent: `window.__remixContext.nonce = ${JSON.stringify(nonce)};`,
                onShellReady() {
                    shellRendered = true;
                    const body = new PassThrough();
                    const stream = createReadableStreamFromReadable(body);
                    responseHeaders.set("Content-Type", "text/html");

                    resolve(
                        new Response(stream, {headers: responseHeaders, status: responseStatusCode})
                    );
                    pipe(body);
                },
                onShellError: reject,
                onError(error: unknown) {
                    responseStatusCode = 500;
                    if (shellRendered) console.error(error);
                },
            }
        );
        setTimeout(abort, streamTimeout + 1_000);
    });
}