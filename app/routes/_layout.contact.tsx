import {siteConfig} from "~/config/site"; // Import site config
import { JsonLd } from "~/components/JsonLd";
import {Mail, MapPin, Phone} from 'lucide-react'; // Import icons
// Import types needed for merging parent meta
import type {MetaDescriptor, MetaFunction, LoaderFunctionArgs, ActionFunctionArgs} from "@remix-run/node";
import {json} from "@remix-run/node";
import {useLoaderData, useRouteLoaderData, Form, useActionData} from "@remix-run/react";
import {AuthenticityTokenInput} from "remix-utils/csrf/react";
import {csrf} from "~/utils/csrf.server";
// Import shadcn components
import {Card, CardContent} from "~/components/ui/card";
import {Input} from "~/components/ui/input";
import {Textarea} from "~/components/ui/textarea";
import {Button} from "~/components/ui/button";
import {Label} from "~/components/ui/label";
// Import database utilities
import {getSupabaseServerClient} from "~/utils/supabase.server";
import type {Database} from "~/types/database.types";
import {mergeMeta} from "~/utils/meta";
import {
    getScheduleInfo,
    getAgeRange,
    getOpeningHoursSpecification
} from "~/utils/schedule";

type ActionData = {
    success?: boolean;
    error?: string;
    fieldErrors?: {
        name?: string;
        email?: string;
        subject?: string;
        message?: string;
    };
};

// Type definitions
type Session = Database['public']['Tables']['class_sessions']['Row'];
type PartialSession = Pick<Session, 'class_id' | 'session_date' | 'start_time' | 'end_time'>;
type Program = Database['public']['Tables']['programs']['Row'];
type ClassWithSchedule = Database['public']['Tables']['classes']['Row'] & {
  class_sessions: PartialSession[];
};

type LoaderData = {
  programs: Program[];
  classes: ClassWithSchedule[];
};

export async function action({request}: ActionFunctionArgs): Promise<Response> {
    try {
        // Validate CSRF token
        await csrf.validate(request);
        
        const formData = await request.formData();
        const name = formData.get("name")?.toString();
        const email = formData.get("email")?.toString();
        const phone = formData.get("phone")?.toString();
        const subject = formData.get("subject")?.toString();
        const message = formData.get("message")?.toString();
        
        // Basic validation
        const fieldErrors: ActionData["fieldErrors"] = {};
        
        if (!name || name.trim().length < 2) {
            fieldErrors.name = "Name must be at least 2 characters long";
        }
        
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            fieldErrors.email = "Please enter a valid email address";
        }
        
        if (!subject || subject.trim().length < 3) {
            fieldErrors.subject = "Subject must be at least 3 characters long";
        }
        
        if (!message || message.trim().length < 10) {
            fieldErrors.message = "Message must be at least 10 characters long";
        }
        
        if (Object.keys(fieldErrors).length > 0) {
            return json<ActionData>({ fieldErrors }, { status: 400 });
        }
        
        // Here you would typically send the email or save to database
        // For now, we'll just simulate success
        console.log("Contact form submission:", { name, email, phone, subject, message });
        
        return json<ActionData>({ success: true });
        
    } catch (error) {
        console.error("Contact form error:", error);
        return json<ActionData>({ error: "Failed to send message. Please try again." }, { status: 500 });
    }
}

// Loader function to fetch dynamic data
export async function loader({request}: LoaderFunctionArgs) {
    try {
        const {supabaseServer} = getSupabaseServerClient(request);

        // Fetch programs
        const {data: programs, error: programsError} = await supabaseServer
            .from('programs')
            .select('*')
            .eq('is_active', true);

        if (programsError) {
            console.error('Error fetching programs:', programsError);
        }

        // Fetch classes and schedules separately to avoid foreign key issues
        const {data: classesData, error: classesError} = await supabaseServer
            .from('classes')
            .select('*')
            .eq('is_active', true);

        // Get sessions separately to avoid foreign key issues
        let sessionsData: PartialSession[] = [];
        if (classesData && classesData.length > 0) {
            const classIds = classesData.map(c => c.id);
            const { data: sessions } = await supabaseServer
                .from('class_sessions')
                .select('class_id, session_date, start_time, end_time')
                .in('class_id', classIds);
            sessionsData = sessions || [];
        }

        if (classesError) {
            console.error('Error fetching classes:', classesError);
        }

        // Transform the data to match our expected type
        const classes = (classesData || []).map(classItem => {
            // Find sessions for this class
            const classSessions = sessionsData.filter(session => session.class_id === classItem.id);
            
            return {
                ...classItem,
                class_sessions: classSessions
            };
        });

        // console.log('[contact loader] classes', classes);
        return json<LoaderData>(
            {
                programs: programs || [],
                classes: classes || []
            },
            {
                headers: {
                    // Cache for 5 minutes (300 seconds) to match server-side cache duration
                    // public: can be cached by browsers and CDNs
                    // max-age: cache duration in seconds
                    // stale-while-revalidate: serve stale content while fetching fresh data
                    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
                }
            }
        );
    } catch (error) {
        console.error('Error loading contact page data:', error);
        return json<LoaderData>(
            { programs: [], classes: [] },
            {
                headers: {
                    // Don't cache error responses
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            }
        );
    }
}



export const meta: MetaFunction<typeof loader> = ({matches, data}) => {
    // Find the parent 'root' route match
    const parentMatch = matches.find((match) => match.id === "root");
    // Get the already computed meta tags from the parent route match
    const parentMeta = parentMatch?.meta || [];

    // Use dynamic data from database for meta description
    const loaderData = data as LoaderData | undefined;
    const classes = loaderData?.classes || [];
    const programs = loaderData?.programs || [];
    
    // Get dynamic schedule and age information
    const scheduleInfo = getScheduleInfo(classes);
    const ageRange = getAgeRange(programs);
    
    const contactPageTitle = "Contact Us | Greenegin Karate";
    const contactPageDescription = `Contact Sensei Negin for kids karate classes (ages ${ageRange}) in Colwood. Classes ${scheduleInfo.days} ${scheduleInfo.times}.`;

    // Define meta tags specific to this Contact page
    const contactMeta: MetaDescriptor[] = [
        {title: contactPageTitle},
        {
            name: "description",
            content: contactPageDescription
        },
        // Override specific OG tags
        {property: "og:title", content: contactPageTitle},
        {property: "og:description", content: contactPageDescription},
        {property: "og:url", content: `${siteConfig.url}/contact`},
        // Override canonical link for this page
        {tagName: "link", rel: "canonical", href: `${siteConfig.url}/contact`},
    ];

    // Merge parent defaults with specific tags for this page
    return mergeMeta(parentMeta, contactMeta);
};



export default function ContactPage() {
    const {programs, classes} = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    // console.log('[ContactPage] classes', classes);

    // Use dynamic data from database
    const scheduleInfo = getScheduleInfo(classes);
    // console.log('[ContactPage] scheduleInfo', scheduleInfo);
    const ageRange = getAgeRange(programs);
    // console.log('[ContactPage] ageRange', ageRange);

    const rootData = useRouteLoaderData('root') as { nonce?: string } | undefined;
    const nonce = rootData?.nonce;

    const contactStructuredData = {
        "@context": "https://schema.org",
        "@type": siteConfig.seo.structuredData.organizationType,
        "name": siteConfig.name,
        "description": `Kids Karate Classes (ages ${ageRange}) in Colwood. Classes ${scheduleInfo.days} ${scheduleInfo.times}.`,
        "address": {
            "@type": "PostalAddress",
            "streetAddress": siteConfig.location.address,
            "addressLocality": siteConfig.location.locality,
            "addressRegion": siteConfig.location.region,
            "postalCode": siteConfig.location.postalCode,
            "addressCountry": siteConfig.location.country
        },
        "telephone": siteConfig.contact.phone,
        "email": siteConfig.contact.email,
        "url": siteConfig.url,
        "sport": "Karate",
        "openingHoursSpecification": getOpeningHoursSpecification(classes),
        "location": {
            "@type": "Place",
            "name": "Greenegin Karate Class Location",
            "address": {
                "@type": "PostalAddress",
                "streetAddress": siteConfig.location.address,
                "addressLocality": siteConfig.location.locality,
                "addressRegion": siteConfig.location.region,
                "postalCode": siteConfig.location.postalCode,
                "addressCountry": siteConfig.location.country
            }
        }
    };

    return (
        <div className="min-h-screen page-background-styles py-12 text-foreground">
            {nonce && (<JsonLd data={contactStructuredData} nonce={nonce} />)}
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
                            <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                                CONTACT INFORMATION
                            </h2>
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
                                        (Ages {ageRange})</p>
                                    <ul className="space-y-2">
                                        {classes.length > 0 && (
                                            <li className="flex items-center">
                                                <span className="text-green-600 mr-2">•</span>
                                                <span>{classes.length} active class{classes.length !== 1 ? 'es' : ''} available</span>
                                            </li>
                                        )}
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
                                        A: Multiple weekly sessions. See our <a href="/classes" className="underline hover:text-green-700 dark:hover:text-green-400">Programs</a> page for complete schedule details.
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
                                        aged {ageRange}.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div className="border-t border-border pt-8">
                        <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">SEND A
                            MESSAGE</h2>
                        
                        {actionData?.success && (
                            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                                <p className="text-green-800 dark:text-green-200">Thank you! Your message has been sent successfully.</p>
                            </div>
                        )}
                        
                        {actionData?.error && (
                            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                                <p className="text-red-800 dark:text-red-200">{actionData.error}</p>
                            </div>
                        )}
                        
                        <Form method="post" className="space-y-4">
                            <AuthenticityTokenInput />
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
                                    {actionData?.fieldErrors?.name && (
                                        <p className="text-sm text-red-600 dark:text-red-400">{actionData.fieldErrors.name}</p>
                                    )}
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
                                    {actionData?.fieldErrors?.email && (
                                        <p className="text-sm text-red-600 dark:text-red-400">{actionData.fieldErrors.email}</p>
                                    )}
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
                                {actionData?.fieldErrors?.subject && (
                                    <p className="text-sm text-red-600 dark:text-red-400">{actionData.fieldErrors.subject}</p>
                                )}
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
                                {actionData?.fieldErrors?.message && (
                                    <p className="text-sm text-red-600 dark:text-red-400">{actionData.fieldErrors.message}</p>
                                )}
                            </div>

                            <div>
                                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                                    Send Message
                                </Button>
                            </div>
                        </Form>
                    </div>
                </div>
            </div>
        </div>
    );
}
