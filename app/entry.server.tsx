/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.server
 */

import {PassThrough} from "node:stream";
import crypto from "node:crypto"; // NEW: Import crypto for nonce generation
import {RemixServer} from "@remix-run/react";
import {isbot} from "isbot";
import {renderToPipeableStream} from "react-dom/server";
import {createReadableStreamFromReadable, EntryContext} from "@remix-run/node";

export const streamTimeout = 5_000;

// Determine strict CSP dev mode and a fixed dev nonce used across SSR/CSR
const STRICT_DEV = process.env.CSP_STRICT_DEV === '1' || process.env.CSP_STRICT_DEV === 'true';
const DEV_FIXED_NONCE = 'dev-fixed-nonce';

// Maintain per-request nonce so getLoadContext and handleRequest share the same value
const requestNonceMap = new WeakMap<Request, string>();

// Provide load context to all loaders/actions
export function getLoadContext({ request }: { request: Request }) {
    const existing = requestNonceMap.get(request);
    if (existing) return { nonce: existing };
    // In strict dev, use a fixed nonce so Vite-injected tags and SSR CSP match
    const nonce = STRICT_DEV ? DEV_FIXED_NONCE : crypto.randomBytes(16).toString("base64");
    requestNonceMap.set(request, nonce);
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
        "https://*.google.com",
        "https://*.google.ca",
        "https://*.g.doubleclick.net",
        "https://*.google-analytics.com",
        isDevelopment ? 'blob:' : '',
    ].filter(Boolean).join(" ");

    // In lenient development, do NOT include a nonce for script-src because 'unsafe-inline' is ignored when nonce/hash present
    const scriptSrcArr = isLenientDev
        ? [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            'blob:',
            "https://js.stripe.com",
            "https://www.googletagmanager.com",
            "https://www.google-analytics.com",
            "https://tagmanager.google.com",
            "https://umami-two-lilac.vercel.app",
        ]
        : [
            "'self'",
            `'nonce-${nonce}'`,
            "https://js.stripe.com",
            "https://www.googletagmanager.com",
            "https://www.google-analytics.com",
            "https://tagmanager.google.com",
            "https://umami-two-lilac.vercel.app",
        ];

    const scriptSrc = scriptSrcArr.filter(Boolean).join(" ");

    // In lenient development, do NOT include a nonce for style-src because 'unsafe-inline' is ignored when nonce/hash present
    const styleSrcArr = isLenientDev
        ? [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
        ]
        : [
            "'self'",
            `'nonce-${nonce}'`,
            "https://fonts.googleapis.com",
        ];

    const styleSrc = styleSrcArr.filter(Boolean).join(" ");

    const fontSrc = "'self' https://fonts.gstatic.com data:";

    // FIXED: Added tagmanager.google.com to enable GTM Preview Mode
    const frameSrc = "https://js.stripe.com https://hooks.stripe.com https://tagmanager.google.com";

    const extraCspDirectives: string[] = [];
    // Permit style attributes in strict dev to reduce dev-only noise without allowing inline <style> without nonce
    if (strictDev) {
        extraCspDirectives.push("style-src-attr 'unsafe-inline'");
    }

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
    // Generate or reuse per-request nonce
    const existing = requestNonceMap.get(request);
    // In strict dev, ensure we always use the fixed dev nonce
    const generated = STRICT_DEV ? DEV_FIXED_NONCE : crypto.randomBytes(16).toString("base64");
    const nonce = existing ?? generated;
    if (!existing) requestNonceMap.set(request, nonce);

    // NEW: Add nonce to the response headers via the CSP
    const csp = generateCsp(nonce);
    responseHeaders.set("Content-Security-Policy", csp);

    // NEW: Pass the nonce to the React application (for Scripts, etc.)
    remixContext.nonce = nonce;

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
    return new Promise((resolve, reject) => {
        let shellRendered = false;
        const {pipe, abort} = renderToPipeableStream(
            <RemixServer
                context={remixContext}
                url={request.url}
                abortDelay={streamTimeout}
            />,
            {
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
    return new Promise((resolve, reject) => {
        let shellRendered = false;
        const {pipe, abort} = renderToPipeableStream(
            <RemixServer
                context={remixContext}
                url={request.url}
                abortDelay={streamTimeout}
            />,
            {
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