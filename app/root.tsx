import {Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError,} from "@remix-run/react";
import type {LinksFunction, MetaFunction} from "@remix-run/node"; // Import MetaFunction
import {ThemeProvider} from "~/components/theme-provider";
import {siteConfig} from "~/config/site"; // Import site config

import "./tailwind.css";

export const links: LinksFunction = () => [
    {rel: "preconnect", href: "https://fonts.googleapis.com"},
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
    },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
    },
];

// Define default meta tags for the entire site
export const meta: MetaFunction = () => {
    return [
        {title: siteConfig.name},
        {name: "description", content: siteConfig.description},
        // Add Open Graph tags for better social sharing
        {property: "og:title", content: siteConfig.name},
        {property: "og:description", content: siteConfig.description},
        {property: "og:type", content: "website"},
        // { property: "og:url", content: "YOUR_WEBSITE_URL" }, // Optional: Add your deployed URL
        // { property: "og:image", content: "YOUR_IMAGE_URL" }, // Optional: Add a preview image URL
    ];
};


// This Layout component now serves as the root structure and renders the Outlet directly.
export function Layout() {
    // Suppress hydration warnings at the root level to handle browser extension interference
    return (
        <html lang="en" className="h-full" suppressHydrationWarning>
        <head>
            <meta charSet="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
            <meta
                httpEquiv="Content-Security-Policy"
                content={`
            default-src 'self';
            script-src 'self' 'unsafe-inline' https://js.stripe.com 'unsafe-eval';
            style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
            font-src 'self' https://fonts.gstatic.com;
            img-src 'self' data:;
            connect-src 'self' https://api.stripe.com ws:;
            frame-src https://js.stripe.com https://hooks.stripe.com;
            base-uri 'self';
            form-action 'self';
          `.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()}
            />
            {/* Add favicon links */}
            <link rel="icon" href="/favicon.ico" sizes="any"/>
            <link rel="icon" href="/icon.svg" type="image/svg+xml"/>
            <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
            <link rel="manifest" href="/manifest.webmanifest"/>
            <Meta/>
            <Links/>
        </head>
        {/* Removed contentEditable attributes as suppressHydrationWarning on <html> handles extension issues */}
        <body className="h-full bg-background text-foreground">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <Outlet/> {/* Render the matched route component directly */}
        </ThemeProvider>
        <ScrollRestoration/>
        <Scripts/>
        </body>
        </html>
    );
} // <-- Add the missing closing brace here

// Make Layout the default export, removing the intermediate App component.
export default Layout;


export function ErrorBoundary() {
    type ExtendedError = {
        status?: number;
        statusText?: string;
        internal?: unknown;
        data?: { message?: string };
        message?: string
    };
    const error = useRouteError() as ExtendedError;
    const status = error?.status || 500;
    const errorMessage = error?.data?.message || error?.message || "Unknown error occurred";

    // Create a consistent error object for display, omitting the potentially problematic nested 'error' property
    const errorForDisplay = {
        status: status,
        statusText: error.statusText, // Access potential statusText
        internal: error.internal,
        data: error.data,
        message: errorMessage, // Use the derived message
    };


    // Render only the error content. The main Layout component (which wraps the Outlet)
    // provides the html, head, body, ThemeProvider, etc.
    // Use bg-amber-50 to match the background of other main pages like login/register.
    return (
        <div
            className="flex flex-col min-h-screen items-center justify-center gap-4 p-4 text-foreground bg-amber-50 dark:bg-gray-800">
            <h1 className="text-4xl font-bold">{status} Error</h1>
            <p className="text-lg text-muted-foreground">{errorMessage}</p>
            {process.env.NODE_ENV === "development" && error && ( // Add check for error existence
                <pre className="mt-4 p-4 bg-accent text-accent-foreground rounded-md max-w-2xl overflow-auto">
          {JSON.stringify(errorForDisplay, null, 2)}
        </pre>
            )}
            {/* Scripts and ScrollRestoration are handled by the main Layout */}
        </div>
    );
}
