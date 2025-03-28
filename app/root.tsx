import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import { ThemeProvider } from "~/components/theme-provider";

import "./tailwind.css";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
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

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Outlet />
    </div>
  );
}

export function ErrorBoundary() {
     const error = useRouteError() as { status?: number; data?: { message?: string }; message?: string };
     const status = error.status || 500;
     const errorMessage = error.data?.message || error.message || "Unknown error occurred";

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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
        <title>{`${status} Error`}</title>
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-background text-foreground">
        <div className="flex flex-col min-h-screen items-center justify-center gap-4 p-4">
          <h1 className="text-4xl font-bold">{status} Error</h1>
          <p className="text-lg text-muted-foreground">{errorMessage}</p>
          {process.env.NODE_ENV === "development" && (
            <pre className="mt-4 p-4 bg-accent text-accent-foreground rounded-md max-w-2xl overflow-auto">
              {JSON.stringify(error, null, 2)}
            </pre>
          )}
        </div>
        <Scripts />
      </body>
    </html>
  );
}
