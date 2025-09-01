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

// REFACTORED: Moved CSP generation to its own function to avoid duplication
function generateCsp(nonce: string) {
    const supabaseHostname = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : '';
    const supabaseOrigin = supabaseHostname ? `https://${supabaseHostname}` : '';

    const isDevelopment = process.env.NODE_ENV === 'development';
    const devWebSockets = isDevelopment ? 'ws://localhost:* wss://localhost:*' : '';

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
        "ws://127.0.0.1:*",
        "wss://127.0.0.1:*"
    ].filter(Boolean).join(" ");

    const imgSrc = [
        "'self'",
        "data:",
        supabaseOrigin,
        "https://*.google.com",
        "https://*.google.ca",
        "https://*.g.doubleclick.net",
        "https://*.google-analytics.com",
    ].filter(Boolean).join(" ");

    // SECURE: Replaced 'unsafe-inline' and 'unsafe-eval' with a nonce
    const scriptSrc = [
        "'self'",
        `'nonce-${nonce}'`,
        "https://js.stripe.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://tagmanager.google.com", // Added for full GTM compatibility
        "https://umami-two-lilac.vercel.app"
    ].filter(Boolean).join(" ");

    // SECURE: Replaced 'unsafe-inline' with a nonce
    const styleSrc = [
        "'self'",
        `'nonce-${nonce}'`,
        "https://fonts.googleapis.com"
    ].filter(Boolean).join(" ");

    const fontSrc = "'self' https://fonts.gstatic.com";

    // FIXED: Added tagmanager.google.com to enable GTM Preview Mode
    const frameSrc = "https://js.stripe.com https://hooks.stripe.com https://tagmanager.google.com";

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
    ];

    return cspDirectives.join('; ').trim();
}

export default function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    remixContext: EntryContext
) {
    // NEW: Generate a nonce for each request
    const nonce = crypto.randomBytes(16).toString("base64");

    // NEW: Add nonce to the response headers via the CSP
    const csp = generateCsp(nonce);
    responseHeaders.set("Content-Security-Policy", csp);

    // NEW: Pass the nonce to the React application
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