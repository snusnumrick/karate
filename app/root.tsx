import React, { useEffect } from "react";
import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLoaderData,
    useRouteError,
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

// Define global typing for GTM dataLayer to avoid any
declare global {
  interface Window {
    dataLayer: Array<Record<string, unknown>>;
  }
}

// Loader to get the nonce from the server context and generate CSRF token
export async function loader({context, request}: LoaderFunctionArgs) {
    // Get nonce from server context (provided by getLoadContext in entry.server.tsx)
    let nonce = (context as { nonce?: string } | undefined)?.nonce;
    
    // In strict dev mode, fallback to fixed dev nonce if no nonce is provided
    const STRICT_DEV = process.env.CSP_STRICT_DEV === '1' || process.env.CSP_STRICT_DEV === 'true';
    // if (!nonce && STRICT_DEV) {
    //     nonce = 'dev-fixed-nonce';
    // }

    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
        console.log('Root loader nonce:', { nonce, STRICT_DEV, contextNonce: context?.nonce });
    }
    
    // Ensure we always have a nonce in production
    if (!nonce) {
        console.error('No nonce provided in context! This will cause CSP violations.');
        // Generate a fallback nonce to prevent CSP errors
        nonce = 'fallback-' + Math.random().toString(36).substring(2, 15);
    }
    
    // Generate CSRF token
    const [csrfToken, csrfCookieHeader] = await csrf.commitToken(request);
    
    return json(
        { nonce, csrfToken },
        {
            headers: csrfCookieHeader ? { "Set-Cookie": csrfCookieHeader } : {},
        }
    );
}

// Error boundary wrapper can remain as is
class ErrorBoundaryWrapper extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = {hasError: false};
    }

    static getDerivedStateFromError(error: Error) {
        return {hasError: true, error};
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("React Error Boundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    className="flex flex-col min-h-screen items-center justify-center gap-4 p-4 text-foreground page-background-styles">
                    <h1 className="text-4xl font-bold">Application Error</h1>
                    <p className="text-lg text-muted-foreground">
                        Something went wrong. Please refresh the page.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                        Refresh Page
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// Schema parsing function can remain as is
const parseClassTimesForSchema = (daysString: string, timeString: string) => {
    const days = daysString.split(' & ').map(day => day.replace(/s$/, ''));
    const timeMatches = timeString.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/gi);
    if (!timeMatches || timeMatches.length < 2) return {dayOfWeek: days, opens: "", closes: ""};
    const startTime12h = timeMatches[0];
    const endTime12h = timeMatches[1];
    const convertTo24Hour = (time12h: string): string => {
        const [timePart, modifier] = time12h.toUpperCase().split(' ');
        if (!timePart || !modifier) return "";
        const [_hours, minutes] = timePart.split(':').map(Number);
        let hours = _hours;
        if (isNaN(hours) || isNaN(minutes)) return "";
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return `${String(hours).padStart(2, '0')}:${minutes}`;
    };
    return {dayOfWeek: days, opens: convertTo24Hour(startTime12h), closes: convertTo24Hour(endTime12h)};
};

export const links: LinksFunction = () => [
    {rel: "preconnect", href: "https://fonts.googleapis.com"},
    {rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous"},
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
    },
    {rel: "manifest", href: "/manifest.webmanifest"},
    // Canonical link should be provided via Links, not Meta
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
        // Removed incorrect link tag from Meta
    ];
};

// Defer GTM injection to client after hydration to avoid head mutations before React hydrates
function ClientGTM({ nonce }: { nonce?: string }) {
    useEffect(() => {
        try {
            const gtmId = 'GTM-P7MZ2KL6';
            // Guard: avoid injecting multiple GTM scripts during HMR or re-mounts
            const hasExisting = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src^="https://www.googletagmanager.com/gtm.js"]'))
                .some((s) => s.src.includes(`id=${gtmId}`));
            if (hasExisting) return;

            // Initialize dataLayer with a nonce-compliant inline script
            const initScript = document.createElement('script');
            if (nonce) initScript.setAttribute('nonce', nonce);
            initScript.textContent = `
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({ 'gtm.start': ${Date.now()}, event: 'gtm.js' });
            `;
            document.head.appendChild(initScript);

            // Load GTM script with nonce
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
    // Access the nonce provided by the loader
    const loaderData = useLoaderData<typeof loader>();
    const loaderNonce = loaderData?.nonce;
    
    // Simplified nonce handling to prevent hydration mismatch
    // Use a consistent approach that works on both server and client
    // const safeNonce = loaderNonce || 'dev-fixed-nonce';
    const safeNonce = loaderNonce;

    // Fix nonce attributes after hydration to avoid hydration mismatch
    useEffect(() => {
        if (typeof window !== 'undefined' && safeNonce) {
            // Fix JSON-LD scripts
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            console.log('Found JSON-LD scripts for nonce fix:', scripts.length);
            scripts.forEach((script, index) => {
                const currentNonce = script.getAttribute('nonce');
                console.log(`Script ${index + 1} current nonce:`, currentNonce);
                if (!currentNonce || currentNonce === '') {
                    script.setAttribute('nonce', safeNonce);
                    console.log(`Set nonce to: ${safeNonce}`);
                }
            });
            
            // Fix inline style elements
            const styles = document.querySelectorAll('style');
            console.log('Found inline style elements for nonce fix:', styles.length);
            styles.forEach((style, index) => {
                const currentNonce = style.getAttribute('nonce');
                console.log(`Style ${index + 1} current nonce:`, currentNonce);
                if (!currentNonce || currentNonce === '') {
                    style.setAttribute('nonce', safeNonce);
                    console.log(`Set nonce to: ${safeNonce}`);
                }
            });
        }
    }, [safeNonce]);
    
    // Debug: log nonce values during development (server-side only)
    if (typeof window === 'undefined') {
        console.log('SSR Layout nonce:', { 
            loaderNonce, 
            safeNonce,
            safeNonceType: typeof safeNonce,
            safeNonceLength: safeNonce?.length
        });
    }

    const classTimes = parseClassTimesForSchema(siteConfig.classes.days, siteConfig.classes.timeLong);

    return (
        <html lang="en" className="h-full" suppressHydrationWarning>
        <head>
            <meta charSet="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>

            {/* Updated all scripts to use the nonce */}
            {/* Umami analytics moved to end of body to avoid head hydration mismatches */}

            {/* Google Tag Manager moved to client-side injection to prevent head DOM mutation during hydration */}

            <meta name="google-site-verification" content="u2fl3O-U-93ZYbncQ8drQwMBMNDWPY159eyNaoJO3Kk"/>
            <Meta/>
            <Links/>

            {/* Provide CSP nonce to Vite dev client via meta tag (Vite reads from content attribute) */}
            {safeNonce && <meta name="csp-nonce" content={safeNonce} />}
            
            {/* Set global nonce for Vite's dynamic CSS injection (similar to webpack's __webpack_nonce__) */}
            {safeNonce && (
                <script
                    nonce={safeNonce}
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{
                        __html: `window.__vite_nonce__ = ${JSON.stringify(safeNonce)};`
                    }}
                />
            )}

            {/* Organization Schema */}
            {safeNonce ? (
                <script
                    type="application/ld+json"
                    suppressHydrationWarning
                    nonce={safeNonce}
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@type': 'Organization',
                            name: siteConfig.name,
                            url: siteConfig.url,
                            logo: `${siteConfig.url}/apple-touch-icon.png`,
                            contactPoint: {
                                '@type': 'ContactPoint',
                                telephone: siteConfig.contact.phone,
                                contactType: 'Customer Service',
                                email: siteConfig.contact.email,
                            },
                            location: {
                                '@type': 'SportsActivityLocation',
                                name: siteConfig.location.description,
                                description: `Karate classes for children aged ${siteConfig.classes.ageRange}. Days: ${siteConfig.classes.days}. Time: ${siteConfig.classes.timeLong}. Located at ${siteConfig.location.address}.`,
                                url: `${siteConfig.url}/contact`,
                                telephone: siteConfig.contact.phone,
                                address: {
                                    '@type': 'PostalAddress',
                                    streetAddress: siteConfig.location.address,
                                    addressLocality: siteConfig.location.locality,
                                    addressRegion: siteConfig.location.region,
                                    postalCode: siteConfig.location.postalCode,
                                    addressCountry: siteConfig.location.country,
                                },
                                openingHoursSpecification: [{
                                    '@type': 'OpeningHoursSpecification',
                                    dayOfWeek: classTimes.dayOfWeek,
                                    opens: classTimes.opens,
                                    closes: classTimes.closes,
                                }],
                            },
                            sameAs: Object.values(siteConfig.socials).filter(Boolean),
                            description: siteConfig.description,
                        }),
                    }}
                />
            ) : (
                <script
                     type="application/ld+json"
                     suppressHydrationWarning
                     nonce={safeNonce}
                     dangerouslySetInnerHTML={{
                         __html: JSON.stringify({
                             '@context': 'https://schema.org',
                             '@type': 'Organization',
                             name: siteConfig.name,
                             url: siteConfig.url,
                             logo: `${siteConfig.url}/apple-touch-icon.png`,
                             contactPoint: {
                                 '@type': 'ContactPoint',
                                 telephone: siteConfig.contact.phone,
                                 contactType: 'Customer Service',
                                 email: siteConfig.contact.email,
                             },
                             location: {
                                    '@type': 'SportsActivityLocation',
                                    name: siteConfig.location.description,
                                    description: `Karate classes for children aged ${siteConfig.classes.ageRange}. Days: ${siteConfig.classes.days}. Time: ${siteConfig.classes.timeLong}. Located at ${siteConfig.location.address}.`,
                                    url: `${siteConfig.url}/contact`,
                                    telephone: siteConfig.contact.phone,
                                    address: {
                                        '@type': 'PostalAddress',
                                        streetAddress: siteConfig.location.address,
                                        addressLocality: siteConfig.location.locality,
                                        addressRegion: siteConfig.location.region,
                                        postalCode: siteConfig.location.postalCode,
                                        addressCountry: siteConfig.location.country,
                                    },
                                 openingHoursSpecification: [{
                                    '@type': 'OpeningHoursSpecification',
                                    dayOfWeek: classTimes.dayOfWeek,
                                    opens: classTimes.opens,
                                    closes: classTimes.closes,
                                }],
                             },
                             sameAs: Object.values(siteConfig.socials).filter(Boolean),
                             description: siteConfig.description,
                         }),
                     }}
                 />
            )}
            {/* FAQPage Schema */}
            <script
                type="application/ld+json"
                suppressHydrationWarning
                nonce={safeNonce}
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "FAQPage",
                        "mainEntity": [
                            {
                                "@type": "Question",
                                "name": "What ages are the karate classes for?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": `Our karate classes are designed for children aged ${siteConfig.classes.ageRange}.`
                                }
                            },
                            {
                                "@type": "Question",
                                "name": "Where are the classes held?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": `Classes are held at ${siteConfig.location.address}, ${siteConfig.location.locality}, ${siteConfig.location.region}.`
                                }
                            },
                            {
                                "@type": "Question",
                                "name": "What are the class times?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": `Classes are on ${siteConfig.classes.days} from ${siteConfig.classes.timeLong}.`
                                }
                            },
                            {
                                "@type": "Question",
                                "name": "How can I contact Sensei Negin?",
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": `You can contact Sensei Negin by phone at ${siteConfig.contact.phone} or by email at ${siteConfig.contact.email}.`
                                }
                            }
                        ]
                    })
                }}
            />
        </head>
        <body className="h-full bg-background text-foreground" suppressHydrationWarning>
        <NonceProvider value={safeNonce}>
        <AuthenticityTokenProvider token={loaderData?.csrfToken}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <ErrorBoundaryWrapper>
                {children} {/* This now correctly renders the nested routes */}
            </ErrorBoundaryWrapper>
        </ThemeProvider>
        </AuthenticityTokenProvider>
        {/* GTM injected after hydration to avoid SSR/CSR mismatch */}
        <ClientGTM nonce={safeNonce} />
        {/* Umami Analytics */}
        <script
            src="https://umami-two-lilac.vercel.app/script.js"
            data-website-id="44b178ff-15e3-40b3-a9e5-de32256e4405"
            nonce={safeNonce}
            suppressHydrationWarning
        />
        {/* Add nonce to Remix's script components */}
        <ScrollRestoration nonce={safeNonce}/>
        <Scripts nonce={safeNonce} key={safeNonce ? `scripts-${safeNonce}` : 'scripts'} />
        </NonceProvider>
        </body>
        </html>
    );
}

// Root component that renders the Layout and Outlet
export default function App() {
    return (
        <Outlet/>
    );
}


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
    const errorForDisplay = {
        status: status,
        statusText: error.statusText,
        internal: error.internal,
        data: error.data,
        message: errorMessage,
    };
    return (
        <div
            className="flex flex-col min-h-screen items-center justify-center gap-4 p-4 text-foreground page-background-styles">
            <h1 className="text-4xl font-bold">{status} Error</h1>
            <p className="text-lg text-muted-foreground">{errorMessage}</p>
            {process.env.NODE_ENV === "development" && error && (
                <pre className="mt-4 p-4 bg-accent text-accent-foreground rounded-md max-w-2xl overflow-auto">
                    {JSON.stringify(errorForDisplay, null, 2)}
                </pre>
            )}
        </div>
    );
}