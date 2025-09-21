import React, { useEffect } from "react";
import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useRouteLoaderData,
} from "@remix-run/react";
import {
    json,
    LinksFunction,
    LoaderFunctionArgs,
    MetaFunction
} from "@remix-run/node";
import {ThemeProvider} from "~/components/theme-provider";
import {siteConfig} from "~/config/site";
import { NonceProvider } from "~/context/nonce";
import { AuthenticityTokenProvider } from "remix-utils/csrf/react";
import { csrf } from "~/utils/csrf.server";

import "./tailwind.css";

declare global {
  interface Window {
    dataLayer: Array<Record<string, unknown>>;
  }
}

export async function loader({context, request}: LoaderFunctionArgs) {
    let nonce = (context as { nonce?: string } | undefined)?.nonce;
    
    if (!nonce) {
        const { deriveNonceForRequest } = await import('~/utils/nonce.server');
        nonce = deriveNonceForRequest(request);
    }
    
    // Use the incoming request so we reuse any existing CSRF token
    const [csrfToken, csrfCookieHeader] = await csrf.commitToken(request);
    
    return json(
        { nonce, csrfToken },
        {
            headers: csrfCookieHeader ? { "Set-Cookie": csrfCookieHeader } : {},
        }
    );
}

export const links: LinksFunction = () => [
    {rel: "preconnect", href: "https://fonts.googleapis.com"},
    {rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous"},
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
    },
    {rel: "manifest", href: "/manifest.webmanifest"},
    {rel: "canonical", href: siteConfig.url},
    {rel: "apple-touch-icon", href: "/apple-touch-icon.png"},
    {rel: "icon", href: "/favicon.ico", sizes: "any"},
    {rel: "icon", href: "/icon.svg", type: "image/svg+xml"},
];

export const meta: MetaFunction = () => {
    return [
        {title: siteConfig.name},
        {name: "description", content: siteConfig.description},
        {name: "theme-color", content: "#2E7D32"},
        {name: "mobile-web-app-capable", content: "yes"},
        {name: "apple-mobile-web-app-capable", content: "yes"},
        {name: "apple-mobile-web-app-status-bar-style", content: "default"},
        {name: "apple-mobile-web-app-title", content: siteConfig.name},
        {name: "application-name", content: siteConfig.name},
        {name: "msapplication-TileColor", content: "#2E7D32"},
        {name: "msapplication-config", content: "/browserconfig.xml"},
        {property: "og:title", content: siteConfig.name},
        {property: "og:description", content: siteConfig.description},
        {property: "og:type", content: "website"},
        {property: "og:url", content: siteConfig.url},
        {property: "og:image", content: `${siteConfig.url}/android-chrome-512x512.png`},
        {name: "twitter:card", content: "summary_large_image"},
        {name: "twitter:title", content: siteConfig.name},
        {name: "twitter:description", content: siteConfig.description},
        {name: "twitter:image", content: `${siteConfig.url}/android-chrome-512x512.png`},
    ];
};

function ClientGTM({ nonce }: { nonce?: string }) {
    useEffect(() => {
        try {
            const gtmId = 'GTM-P7MZ2KL6';
            const hasExisting = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src^="https://www.googletagmanager.com/gtm.js"]'))
                .some((s) => s.src.includes(`id=${gtmId}`));
            if (hasExisting) return;

            const initScript = document.createElement('script');
            if (nonce) initScript.setAttribute('nonce', nonce);
            initScript.textContent = `
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({ 'gtm.start': ${Date.now()}, event: 'gtm.js' });
            `;
            document.head.appendChild(initScript);

            const j = document.createElement('script');
            j.async = true;
            j.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
            if (nonce) j.setAttribute('nonce', nonce);
            j.setAttribute('data-gtm-injected', 'true');
            const firstScript = document.getElementsByTagName('script')[0];
            if (firstScript && firstScript.parentNode) {
                firstScript.parentNode.insertBefore(j, firstScript);
            } else {
                document.head.appendChild(j);
            }
        } catch (e: unknown) {
            console.error('Failed to load GTM', e);
        }
    }, [nonce]);
    return null;
}

export function Layout({children}: { children: React.ReactNode }) {
    // In error elements, useLoaderData is not allowed. Use useRouteLoaderData('root').
    const loaderData = useRouteLoaderData('root') as { nonce?: string; csrfToken?: string } | undefined;
    const safeNonce = loaderData?.nonce;

    return (
        <html lang="en" className="h-full" suppressHydrationWarning>
        <head>
            <meta charSet="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
            <meta name="google-site-verification" content="u2fl3O-U-93ZYbncQ8drQwMBMNDWPY159eyNaoJO3Kk"/>
            <Meta/>
            <Links/>

            {safeNonce && <meta name="csp-nonce" content={safeNonce} />}
            
            {safeNonce && (
                <script
                    nonce={safeNonce}
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{
                        __html: `window.__vite_nonce__ = ${JSON.stringify(safeNonce)};`
                    }}
                />
            )}
        </head>
        <body className="h-full bg-background text-foreground" suppressHydrationWarning>
        <NonceProvider value={safeNonce}>
        <AuthenticityTokenProvider token={loaderData?.csrfToken ?? ''}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
        </ThemeProvider>
        </AuthenticityTokenProvider>
        <ClientGTM nonce={safeNonce} />
        <script
            src="https://umami-two-lilac.vercel.app/script.js"
            data-website-id="44b178ff-15e3-40b3-a9e5-de32256e4405"
            nonce={safeNonce}
            suppressHydrationWarning
        />
        <ScrollRestoration nonce={safeNonce}/>
        <Scripts nonce={safeNonce} />
        </NonceProvider>
        </body>
        </html>
    );
}

export default function App() {
    return (
        <Outlet/>
    );
}
