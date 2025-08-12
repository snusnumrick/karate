import React from "react";
import {Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError,} from "@remix-run/react";
import type {LinksFunction, MetaFunction} from "@remix-run/node"; // Import MetaFunction
import {ThemeProvider} from "~/components/theme-provider";
import {siteConfig} from "~/config/site"; // Import site config

import "./tailwind.css";

// Error boundary wrapper to catch React context errors
class ErrorBoundaryWrapper extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("React Error Boundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col min-h-screen items-center justify-center gap-4 p-4 text-foreground page-background-styles">
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

// Helper function to parse class times for schema.org
const parseClassTimesForSchema = (daysString: string, timeString: string) => {
    const days = daysString.split(' & ').map(day => day.replace(/s$/, '')); // "Tuesdays" -> "Tuesday"

    // Regex to find times like "6:15 PM" or "10:00 AM"
    const timeMatches = timeString.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/gi);

    if (!timeMatches || timeMatches.length < 2) {
        console.warn(`Could not parse time string for schema: "${timeString}". Expected format like "X:XX AM/PM to Y:YY AM/PM".`);
        return { dayOfWeek: days, opens: "", closes: "" };
    }

    const startTime12h = timeMatches[0];
    const endTime12h = timeMatches[1];

    const convertTo24Hour = (time12h: string): string => {
        const parts = time12h.toUpperCase().split(' '); // e.g., ["6:15", "PM"]
        if (parts.length !== 2) {
            console.warn(`Could not parse 12-hour time part: "${time12h}"`);
            return "";
        }
        
        const timePart = parts[0]; // "6:15"
        const modifier = parts[1]; // "PM"

        const [hoursStr, minutesStr] = timePart.split(':');
        let hours = parseInt(hoursStr, 10);
        
        if (isNaN(hours) || isNaN(parseInt(minutesStr, 10))) {
            console.warn(`Could not parse hours/minutes from time part: "${timePart}"`);
            return "";
        }

        if (modifier === 'PM' && hours < 12) {
            hours += 12;
        }
        if (modifier === 'AM' && hours === 12) { // 12 AM (midnight) is 00 hours
            hours = 0;
        }
        return `${String(hours).padStart(2, '0')}:${minutesStr}`;
    };

    const opens = convertTo24Hour(startTime12h);
    const closes = convertTo24Hour(endTime12h);

    if (!opens || !closes) {
        // If time conversion failed, return days but empty times to avoid breaking schema
        return { dayOfWeek: days, opens: "", closes: "" };
    }

    return {
        dayOfWeek: days,
        opens: opens,
        closes: closes,
    };
};

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
    // PWA manifest
    {rel: "manifest", href: "/manifest.webmanifest"},
    // PWA theme color
    {rel: "theme-color", href: "#2E7D32"},
    // Apple touch icon
    {rel: "apple-touch-icon", href: "/apple-touch-icon.png"},
    // Favicon
    {rel: "icon", href: "/favicon.ico", sizes: "any"},
    {rel: "icon", href: "/icon.svg", type: "image/svg+xml"},
];

// Define default meta tags for the entire site
export const meta: MetaFunction = () => {
    return [
        {title: siteConfig.name},
        {name: "description", content: siteConfig.description},
        // PWA meta tags
        {name: "theme-color", content: "#2E7D32"},
        {name: "mobile-web-app-capable", content: "yes"},
        {name: "apple-mobile-web-app-capable", content: "yes"},
        {name: "apple-mobile-web-app-status-bar-style", content: "default"},
        {name: "apple-mobile-web-app-title", content: siteConfig.name},
        {name: "application-name", content: siteConfig.name},
        {name: "msapplication-TileColor", content: "#2E7D32"},
        {name: "msapplication-config", content: "/browserconfig.xml"},
        // Add Open Graph tags for better social sharing
        {property: "og:title", content: siteConfig.name},
        {property: "og:description", content: siteConfig.description},
        {property: "og:type", content: "website"},
        { property: "og:url", content: siteConfig.url }, // Use siteConfig
        {property: "og:image", content: `${siteConfig.url}/android-chrome-512x512.png`},
        // Twitter Card tags
        {name: "twitter:card", content: "summary_large_image"},
        {name: "twitter:title", content: siteConfig.name},
        {name: "twitter:description", content: siteConfig.description},
        {name: "twitter:image", content: `${siteConfig.url}/android-chrome-512x512.png`},
        // Add default canonical link
        { tagName: "link", rel: "canonical", href: siteConfig.url }, // Use siteConfig
    ];
};


// This Layout component now serves as the root structure and renders the Outlet directly.
export function Layout() {
    // Suppress hydration warnings at the root level to handle browser extension interference
    const classTimes = parseClassTimesForSchema(siteConfig.classes.days, siteConfig.classes.timeLong);

    return (
        <html lang="en" className="h-full" suppressHydrationWarning>
        <head>
            <meta charSet="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
            {/*Tracking*/}
            <script defer src="https://umami-two-lilac.vercel.app/script.js" data-website-id="44b178ff-15e3-40b3-a9e5-de32256e4405"></script>
            {/* CSP is now set via HTTP header in entry.server.tsx */}
            {/* Favicon links are now managed solely by the links function */}
            <meta name="google-site-verification" content="u2fl3O-U-93ZYbncQ8drQwMBMNDWPY159eyNaoJO3Kk" />
            <Meta/>
            <Links/>
            {/* Add Organization Schema */}
            <script type="application/ld+json" dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "Organization",
                    "name": siteConfig.name,
                    "url": siteConfig.url, // Use siteConfig
                    "logo": `${siteConfig.url}/apple-touch-icon.png`, // Use siteConfig for logo URL
                    "contactPoint": {
                        "@type": "ContactPoint",
                        "telephone": siteConfig.contact.phone,
                        "contactType": "Customer Service", // Or "Sales", "Technical Support", etc.
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
                        "openingHoursSpecification": [
                            {
                                "@type": "OpeningHoursSpecification",
                                "dayOfWeek": classTimes.dayOfWeek,
                                "opens": classTimes.opens,
                                "closes": classTimes.closes
                            }
                        ]
                    },
                    "sameAs": [ // Add social media links
                        siteConfig.socials.instagram,
                        siteConfig.socials.facebook // Add Facebook link
                    ],
                    "description": siteConfig.description
                })
            }} />
            {/* Add FAQPage Schema */}
            <script type="application/ld+json" dangerouslySetInnerHTML={{
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
            }} />
        </head>
        {/* Removed contentEditable attributes as suppressHydrationWarning on <html> handles extension issues */}
        <body className="h-full bg-background text-foreground">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <ErrorBoundaryWrapper>
                <Outlet/> {/* Render the matched route component directly */}
            </ErrorBoundaryWrapper>
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
            className="flex flex-col min-h-screen items-center justify-center gap-4 p-4 text-foreground page-background-styles">
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
