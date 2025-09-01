import React from "react";
import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLoaderData, // NEW: Import useLoaderData
    useRouteError,
} from "@remix-run/react";
import {
    json,
    LinksFunction,
    LoaderFunctionArgs, // NEW: Import loader types
    MetaFunction
} from "@remix-run/node";
import {ThemeProvider} from "~/components/theme-provider";
import {siteConfig} from "~/config/site";

import "./tailwind.css";

// NEW: Loader to get the nonce from the server context
export async function loader({context}: LoaderFunctionArgs) {
    // The nonce is passed from entry.server.tsx
    return json({nonce: context.nonce as string});
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
        let [hours, minutes] = timePart.split(':').map(Number);
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
    {rel: "theme-color", href: "#2E7D32"},
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
        {tagName: "link", rel: "canonical", href: siteConfig.url},
    ];
};

export function Layout({children}: { children: React.ReactNode }) {
    // NEW: Access the nonce provided by the loader
    const {nonce} = useLoaderData<typeof loader>();
    const classTimes = parseClassTimesForSchema(siteConfig.classes.days, siteConfig.classes.timeLong);

    return (
        <html lang="en" className="h-full" suppressHydrationWarning>
        <head>
            <meta charSet="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>

            {/* MODIFIED: Updated all scripts to use the nonce */}
            <script
                nonce={nonce}
                defer
                src="https://umami-two-lilac.vercel.app/script.js"
                data-website-id="44b178ff-15e3-40b3-a9e5-de32256e4405"
            ></script>

            {/* MODIFIED: Replaced gtag.js with the recommended Google Tag Manager container snippet */}
            <script
                nonce={nonce}
                dangerouslySetInnerHTML={{
                    __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;j.setAttribute('nonce','${nonce}');f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-P7MZ2KL6');`,
                }}
            />

            <meta name="google-site-verification" content="u2fl3O-U-93ZYbncQ8drQwMBMNDWPY159eyNaoJO3Kk"/>
            <Meta/>
            <Links/>

            {/* Add Organization Schema with nonce */}
            <script
                nonce={nonce}
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Organization",
                        "name": siteConfig.name,
                        "url": siteConfig.url,
                        "logo": `${siteConfig.url}/apple-touch-icon.png`,
                        "contactPoint": {
                            "@type": "ContactPoint",
                            "telephone": siteConfig.contact.phone,
                            "contactType": "Customer Service",
                            "email": siteConfig.contact.email
                        },
                        "location": {
                            "@type": "SportsActivityLocation",
                            "name": siteConfig.location.description || siteConfig.name,
                            "description": `Karate classes for children aged ${siteConfig.classes.ageRange}. Days: ${siteConfig.classes.days}. Time: ${siteConfig.classes.timeLong}. Located at ${siteConfig.location.address}.`,
                            "url": `${siteConfig.url}/contact`,
                            "telephone": siteConfig.contact.phone,
                            "address": {
                                "@type": "PostalAddress",
                                "streetAddress": siteConfig.location.address,
                                "addressLocality": siteConfig.location.locality,
                                "addressRegion": siteConfig.location.region,
                                "postalCode": siteConfig.location.postalCode,
                                "addressCountry": siteConfig.location.country
                            },
                            "openingHoursSpecification": [{
                                "@type": "OpeningHoursSpecification",
                                "dayOfWeek": classTimes.dayOfWeek,
                                "opens": classTimes.opens,
                                "closes": classTimes.closes
                            }]
                        },
                        "sameAs": [siteConfig.socials.instagram, siteConfig.socials.facebook],
                        "description": siteConfig.description
                    })
                }}
            />
            {/* Add FAQPage Schema with nonce */}
            <script
                nonce={nonce}
                type="application/ld+json"
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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <ErrorBoundaryWrapper>
                {children} {/* This now correctly renders the nested routes */}
            </ErrorBoundaryWrapper>
        </ThemeProvider>
        {/* MODIFIED: Add nonce to Remix's script components */}
        <ScrollRestoration nonce={nonce}/>
        <Scripts nonce={nonce}/>
        </body>
        </html>
    );
}

// NEW: Root component that renders the Layout and Outlet
export default function App() {
    return (
        <Layout>
            <Outlet/>
        </Layout>
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
        <Layout> {/* NEW: Wrap ErrorBoundary in Layout to maintain page structure */}
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
        </Layout>
    );
}