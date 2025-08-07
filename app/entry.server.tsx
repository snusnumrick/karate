/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.server
 */

import {PassThrough} from "node:stream";
import {RemixServer} from "@remix-run/react";
import {isbot} from "isbot";
import {renderToPipeableStream} from "react-dom/server";
import {createReadableStreamFromReadable, EntryContext} from "@remix-run/node";

export const streamTimeout = 5_000;

export default function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    remixContext: EntryContext
) {
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

                    // Construct Content Security Policy header
                    const supabaseHostname = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : '';
                    const supabaseOrigin = supabaseHostname ? `https://${supabaseHostname}` : '';
                    
                    // In development, allow WebSocket connections to local dev servers
                    const isDevelopment = process.env.NODE_ENV === 'development';
                    const devWebSockets = isDevelopment ? 'ws://localhost:* wss://localhost:*' : '';
                    
                    const connectSrc = `'self' https://api.stripe.com ${supabaseOrigin ? `${supabaseOrigin} wss://${supabaseHostname}` : ''} ${devWebSockets} ws://127.0.0.1:* wss://127.0.0.1:*`.trim();
                    const imgSrc = `'self' data: ${supabaseOrigin}`; // Add Supabase origin for images
                    const scriptSrc = `'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com`; // Add 'unsafe-eval' and stripe js
                    const styleSrc = `'self' 'unsafe-inline' https://fonts.googleapis.com`;
                    const fontSrc = `'self' https://fonts.gstatic.com`;
                    const frameSrc = `https://js.stripe.com https://hooks.stripe.com`;
                    const baseUri = `'self'`;
                    const formAction = `'self'`;

                    const csp = `
                        default-src 'self';
                        script-src ${scriptSrc};
                        style-src ${styleSrc};
                        font-src ${fontSrc};
                        img-src ${imgSrc};
                        connect-src ${connectSrc};
                        frame-src ${frameSrc};
                        base-uri ${baseUri};
                        form-action ${formAction};
                    `.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

                    responseHeaders.set("Content-Security-Policy", csp);

                    resolve(
                        new Response(stream, {
                            headers: responseHeaders,
                            status: responseStatusCode,
                        })
                    );

                    pipe(body);
                },
                onShellError(error: unknown) {
                    reject(error);
                },
                onError(error: unknown) {
                    responseStatusCode = 500;
                    // Log streaming rendering errors from inside the shell.  Don't log
                    // errors encountered during initial shell rendering since they'll
                    // reject and get logged in handleDocumentRequest.
                    if (shellRendered) {
                        console.error(error);
                    }
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

                    // Construct Content Security Policy header (ensure this logic matches the one in handleBotRequest)
                    const supabaseHostname = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : '';
                    const supabaseOrigin = supabaseHostname ? `https://${supabaseHostname}` : '';
                    
                    // In development, allow WebSocket connections to local dev servers
                    const isDevelopment = process.env.NODE_ENV === 'development';
                    const devWebSockets = isDevelopment ? 'ws://localhost:* wss://localhost:*' : '';
                    
                    const connectSrc = `'self' https://api.stripe.com ${supabaseOrigin ? `${supabaseOrigin} wss://${supabaseHostname}` : ''} ${devWebSockets} ws://127.0.0.1:* wss://127.0.0.1:*`.trim();
                    const imgSrc = `'self' data: ${supabaseOrigin}`; // Add Supabase origin for images
                    const scriptSrc = `'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com`; // Add 'unsafe-eval' and stripe js
                    const styleSrc = `'self' 'unsafe-inline' https://fonts.googleapis.com`;
                    const fontSrc = `'self' https://fonts.gstatic.com`;
                    const frameSrc = `https://js.stripe.com https://hooks.stripe.com`;
                    const baseUri = `'self'`;
                    const formAction = `'self'`;

                    const csp = `
                        default-src 'self';
                        script-src ${scriptSrc};
                        style-src ${styleSrc};
                        font-src ${fontSrc};
                        img-src ${imgSrc};
                        connect-src ${connectSrc};
                        frame-src ${frameSrc};
                        base-uri ${baseUri};
                        form-action ${formAction};
                    `.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

                    responseHeaders.set("Content-Security-Policy", csp);

                    resolve(
                        new Response(stream, {
                            headers: responseHeaders,
                            status: responseStatusCode,
                        })
                    );

                    pipe(body);
                },
                onShellError(error: unknown) {
                    reject(error);
                },
                onError(error: unknown) {
                    responseStatusCode = 500;
                    // Log streaming rendering errors from inside the shell.  Don't log
                    // errors encountered during initial shell rendering since they'll
                    // reject and get logged in handleDocumentRequest.
                    if (shellRendered) {
                        console.error(error);
                    }
                },
            }
        );

        setTimeout(abort, streamTimeout + 1_000);
    });
}
