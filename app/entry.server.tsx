/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.server
 */

import { PassThrough } from "node:stream";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { createReadableStreamFromReadable, EntryContext } from "@remix-run/node";
import { deriveNonceForRequest } from "./utils/nonce.server";

// Extend EntryContext to include nonce property
interface ExtendedEntryContext extends EntryContext {
    nonce?: string;
}

const ABORT_DELAY = 5_000;

function generateCsp(nonce: string) {
    const supabaseHostname = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : '';
    const supabaseOrigin = supabaseHostname ? `https://${supabaseHostname}` : '';

    const isDevelopment = process.env.NODE_ENV === 'development';
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
        "https://*.google-analytics.com",
        "https://*.googletagmanager.com",
        "https://stats.g.doubleclick.net",
        "https://www.google.ca",
    ].filter(Boolean).join(" ");

    const styleSrc = isDevelopment
        ? [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ].join(" ")
        : [
            "'self'",
            `'nonce-${nonce}'`,
            "https://fonts.googleapis.com",
          ].filter(Boolean).join(" ");

    const scriptSrc = [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        "https://js.stripe.com",
        "https://umami-two-lilac.vercel.app",
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
        process.env.CSP_REPORT_URI ? `report-uri ${process.env.CSP_REPORT_URI}` : '',
        process.env.CSP_REPORT_TO ? `report-to ${process.env.CSP_REPORT_TO}` : '',
    ].filter(Boolean);

    const cspDirectives = [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        `style-src ${styleSrc}`,
        `font-src ${fontSrc}`,
        `img-src ${imgSrc}`,
        `connect-src ${connectSrc}`,
        `frame-src ${frameSrc}`,
        "object-src 'none'",
        "base-uri 'none'",
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
    const nonce = deriveNonceForRequest(request);

    const csp = generateCsp(nonce);
    responseHeaders.set("Content-Security-Policy", csp);
    
    responseHeaders.set("X-Frame-Options", "DENY");
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.set("X-XSS-Protection", "1; mode=block");
    responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
    responseHeaders.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    
    if (process.env.NODE_ENV === 'production') {
        responseHeaders.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }

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
                abortDelay={ABORT_DELAY}
                nonce={nonce}
            />,
            {
                nonce: nonce || undefined,
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
        setTimeout(abort, ABORT_DELAY);
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
                abortDelay={ABORT_DELAY}
                nonce={nonce}
            />,
            {
                nonce: nonce || undefined,
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
        setTimeout(abort, ABORT_DELAY);
    });
}
