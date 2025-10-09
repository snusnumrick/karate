/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

declare global {
  interface Window {
    __REMIX_DEV_TOOLS?: {
      suppressHydrationWarning: boolean;
      suppressExtraHydrationErrors: boolean;
    };
  }
}

import {RemixBrowser, useLocation, useMatches} from "@remix-run/react";
import {startTransition, StrictMode, useEffect} from "react";
import {hydrateRoot} from "react-dom/client";
import * as Sentry from "@sentry/remix";

// Only set dev tools in development (check for window to ensure client-side)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.__REMIX_DEV_TOOLS = {
        suppressHydrationWarning: true,
        suppressExtraHydrationErrors: true
    };
}

// Initialize Sentry for client-side error tracking
if (typeof window !== 'undefined' && window.ENV?.SENTRY_DSN) {
    Sentry.init({
        dsn: window.ENV.SENTRY_DSN,
        environment: window.ENV.NODE_ENV || 'development',
        integrations: [
            Sentry.browserTracingIntegration({
                useEffect,
                useLocation,
                useMatches,
            }),
            // Automatically capture console.error calls
            Sentry.captureConsoleIntegration({
                levels: ['error'] // Only capture console.error, not log/warn
            }),
        ],
        tracesSampleRate: window.ENV.NODE_ENV === 'production' ? 0.1 : 1.0,
        replaysSessionSampleRate: 0, // Disable session replay to avoid recording sensitive data
        replaysOnErrorSampleRate: 0, // Disable error replays
        beforeSend(event) {
            // Strip sensitive data from error reports
            if (event.request) {
                // Remove cookies and auth headers
                delete event.request.cookies;
                if (event.request.headers) {
                    delete event.request.headers['authorization'];
                    delete event.request.headers['cookie'];
                }
            }

            // Redact user email and PII
            if (event.user) {
                if (event.user.email) {
                    event.user.email = '[REDACTED]';
                }
                if (event.user.ip_address) {
                    event.user.ip_address = '[REDACTED]';
                }
            }

            // Remove payment-related sensitive data from contexts
            if (event.contexts) {
                Object.keys(event.contexts).forEach(key => {
                    const context = event.contexts?.[key];
                    if (context && typeof context === 'object') {
                        ['amount', 'total', 'subtotal', 'tax', 'email', 'name', 'phone', 'address'].forEach(field => {
                            if (field in context) {
                                delete (context as Record<string, unknown>)[field];
                            }
                        });
                    }
                });
            }

            return event;
        },
    });
}

// Add error handling for hydration
function hydrate() {
    try {
        startTransition(() => {
            hydrateRoot(
                document,
                <StrictMode>
                    <RemixBrowser/>
                </StrictMode>,
                {
                    onRecoverableError: (error) => {
                        console.warn("Recoverable hydration error:", error);
                    }
                }
            );
        });
    } catch (error) {
        console.error("Hydration failed:", error);
        // Fallback: force a full page reload if hydration fails
        window.location.reload();
    }
}

// Ensure DOM is ready before hydrating
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
} else {
    hydrate();
}
