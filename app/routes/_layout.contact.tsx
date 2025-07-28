import {siteConfig} from "~/config/site"; // Import site config
import {Mail, MapPin, Phone} from 'lucide-react'; // Import icons
// Import types needed for merging parent meta
import type {MetaArgs, MetaDescriptor, MetaFunction} from "@remix-run/node";
// Import shadcn components
import {Card, CardContent} from "~/components/ui/card";
import {Input} from "~/components/ui/input";
import {Textarea} from "~/components/ui/textarea";
import {Button} from "~/components/ui/button";
import {Label} from "~/components/ui/label";

// Helper function to merge meta tags, giving precedence to child tags
// (Same helper function as in about.tsx - could be extracted to a util file)
function mergeMeta(
    parentMeta: MetaDescriptor[],
    childMeta: MetaDescriptor[]
): MetaDescriptor[] {
    const merged: Record<string, MetaDescriptor> = {};
    const getKey = (tag: MetaDescriptor): string | null => {
        if ('title' in tag) return 'title';
        if ('name' in tag) return `name=${tag.name}`;
        if ('property' in tag) return `property=${tag.property}`;
        if ('tagName' in tag && tag.tagName === 'link' && tag.rel === 'canonical') return 'canonical';
        if ('script:ld+json' in tag) return 'script:ld+json';
        try {
            return JSON.stringify(tag);
        } catch {
            return null;
        }
    };
    parentMeta.forEach(tag => {
        const key = getKey(tag);
        if (key) merged[key] = tag;
    });
    childMeta.forEach(tag => {
        const key = getKey(tag);
        if (key) merged[key] = tag;
    });
    return Object.values(merged);
}

export const meta: MetaFunction = (args: MetaArgs) => {
    // Find the parent 'root' route match
    const parentMatch = args.matches.find((match) => match.id === "root");
    // Get the already computed meta tags from the parent route match
    const parentMeta = parentMatch?.meta || [];

    // Define meta tags specific to this Contact page
    const contactMeta: MetaDescriptor[] = [
        {title: "Contact Us | Greenegin Karate"},
        {
            name: "description",
            content: "Contact Sensei Negin for kids karate classes in Colwood. Find class schedules, location, phone number, and email address."
        },
        // You can override OG tags here too if needed
        // Override specific OG tags
        {property: "og:title", content: "Contact Us | Greenegin Karate"},
        {property: "og:description", content: "Contact Sensei Negin for kids karate classes in Colwood."},
        // { property: "og:type", content: "website" }, // Default 'website' is fine, no need to override unless different
        {property: "og:url", content: `${siteConfig.url}/contact`}, // Specific OG URL for this page

        // Add SportsActivityLocation Schema
        {
            "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "SportsActivityLocation",
                "name": "Greenegin Karate Class Location",
                // Use siteConfig.location.address in the description
                "description": `Kids Karate Classes (${siteConfig.classes.ageRange}) at ${siteConfig.location.address}.`,
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": siteConfig.location.address,
                    "addressLocality": siteConfig.location.locality, // Use siteConfig
                    "addressRegion": siteConfig.location.region, // Use siteConfig
                    "postalCode": siteConfig.location.postalCode, // Use siteConfig
                    "addressCountry": siteConfig.location.country // Use siteConfig
                },
                "telephone": siteConfig.contact.phone,
                "url": `${siteConfig.url}/contact`, // Use siteConfig
                "openingHoursSpecification": [ // Define class times
                    {
                        "@type": "OpeningHoursSpecification",
                        "dayOfWeek": [
                            "Tuesday", // Assuming Tue & Fri from siteConfig
                            "Friday"
                        ],
                        "opens": "18:15", // Use 24hr format HH:MM
                        "closes": "19:15"
                    }
                    // Add more specifications if classes run on other days/times
                ],
                "provider": { // Link back to the main organization
                    "@type": "Organization",
                    "name": siteConfig.name,
                    "url": siteConfig.url // Use siteConfig
                }
            }
        },
        // Override canonical link for this page
        {tagName: "link", rel: "canonical", href: `${siteConfig.url}/contact`},
    ];

    // Merge parent defaults with specific tags for this page
    return mergeMeta(parentMeta, contactMeta);
};


export default function ContactPage() {
    return (
        <div className="min-h-screen page-background-styles py-12 text-foreground">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                        Contact Us
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                        Get in touch for class info, registration, or questions
                    </p>
                </div>

                <div className="mt-12 form-container-styles p-8 backdrop-blur-lg">
                    {/* Header section with register link */}
                    <div
                        className="flex flex-col items-start space-y-2 mb-6 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                        <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Get In Touch</h2>
                        <a href="/register"
                           className="text-sm text-green-600 dark:text-green-400 hover:underline hover:text-green-700 dark:hover:text-green-300 sm:text-base">
                            Ready to start? Click here to register.
                        </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div>
                            <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">CONTACT
                                INFORMATION</h2>
                            <ul className="space-y-4">
                                <li className="flex items-start">
                                    <Phone
                                        className="mr-3 mt-1 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400"
                                        aria-hidden="true"/>
                                    <div>
                                        <p className="font-medium">Phone</p>
                                        <a href={`tel:${siteConfig.contact.phone.replace(/\D/g, '')}`}
                                           className="hover:underline hover:text-green-700 dark:hover:text-green-400">
                                            {siteConfig.contact.phone}
                                        </a>
                                    </div>
                                </li>
                                <li className="flex items-start">
                                    <Mail className="mr-3 mt-1 h-5 w-5 flex-shrink-0 text-sky-500 dark:text-sky-400"
                                          aria-hidden="true"/>
                                    <div>
                                        <p className="font-medium">Email</p>
                                        <a href={`mailto:${siteConfig.contact.email}`}
                                           className="hover:underline hover:text-green-700 dark:hover:text-green-400">
                                            {siteConfig.contact.email}
                                        </a>
                                    </div>
                                </li>
                                <li className="flex items-start">
                                    <MapPin className="mr-3 mt-1 h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-400"
                                            aria-hidden="true"/>
                                    <div>
                                        <p className="font-medium">Location</p>
                                        {/* Use the address from siteConfig and make it a link */}
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteConfig.location.address)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:underline hover:text-green-700 dark:hover:text-green-400"
                                        >
                                            {siteConfig.location.address}
                                        </a>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                                <a href="/classes"
                                   className="hover:underline hover:text-green-700 dark:hover:text-green-400">
                                    CLASS SCHEDULE
                                </a>
                            </h2>
                            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                                <CardContent className="p-4">
                                    <p className="font-medium mb-2">Children&apos;s Classes
                                        (Ages {siteConfig.classes.ageRange})</p>
                                    <ul className="space-y-2">
                                        <li className="flex items-center">
                                            <span className="text-green-600 mr-2">•</span>
                                            {/* Use siteConfig for days and time */}
                                            <span>{siteConfig.classes.days}: {siteConfig.classes.timeLong}</span>
                                        </li>
                                        {/* Remove hardcoded second list item if siteConfig.classes.days covers all days */}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Quick Answers Section */}
                    <div className="my-8 pt-8 border-t border-border">
                        <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">QUICK
                            ANSWERS</h2>
                        <div className="space-y-4">
                            <Card className="bg-muted/50">
                                <CardContent className="p-4">
                                    <p className="text-foreground">
                                        <span className="font-semibold">Q: What&apos;s the class schedule?</span>
                                        <br/>
                                        A: Classes are on {siteConfig.classes.days}, {siteConfig.classes.timeLong}.
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="bg-muted/50">
                                <CardContent className="p-4">
                                    <p className="text-foreground">
                                        <span className="font-semibold">Q: Where are the classes held?</span>
                                        <br/>
                                        A: Classes are held
                                        at {siteConfig.location.address}, {siteConfig.location.locality}, {siteConfig.location.region}.
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="bg-muted/50">
                                <CardContent className="p-4">
                                    <p className="text-foreground">
                                        <span className="font-semibold">Q: What ages are the classes for?</span>
                                        <br/>
                                        A: Our karate classes are designed for children
                                        aged {siteConfig.classes.ageRange}.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div className="border-t border-border pt-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">SEND A
                            MESSAGE</h2>
                        <form className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-sm font-medium mb-1">Your Name</Label>
                                    <Input
                                        type="text"
                                        id="name"
                                        name="name"
                                        required
                                        autoComplete="name"
                                        placeholder="Your full name"
                                        className="input-custom-styles"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-sm font-medium mb-1">Email Address</Label>
                                    <Input
                                        type="email"
                                        id="email"
                                        name="email"
                                        required
                                        autoComplete="email"
                                        placeholder="your.email@example.com"
                                        className="input-custom-styles"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone (optional)</Label>
                                <Input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    placeholder="(555) 123-4567"
                                    className="input-custom-styles"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="subject" className="text-sm font-medium mb-1">Subject</Label>
                                <Input
                                    type="text"
                                    id="subject"
                                    name="subject"
                                    placeholder="Enter subject"
                                    className="input-custom-styles"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message" className="text-sm font-medium mb-1">Message</Label>
                                <Textarea
                                    id="message"
                                    name="message"
                                    rows={4}
                                    required
                                    placeholder="Enter your message"
                                    className="input-custom-styles"
                                />
                            </div>

                            <div>
                                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                                    Send Message
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
