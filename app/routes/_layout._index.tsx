// Import types needed for merging parent meta
import type { MetaFunction, MetaArgs, MetaDescriptor, LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { MapPin, Clock, Users, Phone, Mail, Award, GraduationCap, Baby, Trophy, Dumbbell, Brain, ShieldCheck, Star, Footprints, Wind, Calendar, ExternalLink } from 'lucide-react'; // Import icons for environment
import { siteConfig } from "~/config/site"; // Import site config
import { EventService } from "~/services/event.server";
import type { Database } from "~/types/database.types";

type UpcomingEvent = Pick<Database['public']['Tables']['events']['Row'], 
  'id' | 'title' | 'description' | 'event_type' | 'status' | 'start_date' | 
  'end_date' | 'start_time' | 'end_time' | 'location' | 'address' | 
  'max_participants' | 'registration_fee' | 'registration_deadline' | 
  'external_url' | 'is_public'
>;

// Loader for homepage - fetch upcoming events
export async function loader({ request }: LoaderFunctionArgs) {
    try {
        const upcomingEvents = await EventService.getUpcomingEvents();
        return json(
            { upcomingEvents },
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
        console.error('Error loading upcoming events:', error);
        return json(
            { upcomingEvents: [] },
            {
                headers: {
                    // Don't cache error responses
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            }
        );
    }
}

// Helper function to merge meta tags, giving precedence to child tags
// (Same helper function as in about.tsx/contact.tsx - could be extracted to a util file)
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
        try { return JSON.stringify(tag); } catch { return null; }
    };
    parentMeta.forEach(tag => { const key = getKey(tag); if (key) merged[key] = tag; });
    childMeta.forEach(tag => { const key = getKey(tag); if (key) merged[key] = tag; });
    return Object.values(merged);
}

export const meta: MetaFunction = (args: MetaArgs) => {
    // Find the parent 'root' route match
    const parentMatch = args.matches.find((match) => match.id === "root");
    // Get the already computed meta tags from the parent route match
    const parentMeta = parentMatch?.meta || [];

    // Get loader data for events
    const loaderData = args.data as { upcomingEvents: UpcomingEvent[] } | undefined;
    const upcomingEvents = loaderData?.upcomingEvents || [];

    // Define meta tags specific to this Index page
    const indexPageTitle = "Karate Classes - Sensei Negin";
    // Use siteConfig.location.address for consistency in description
    const indexPageDescription = `Discover the art of karate with Sensei Negin at ${siteConfig.location.address}. Classes for children ages ${siteConfig.classes.ageRange} on ${siteConfig.classes.days}. Free trial available!`;

    const indexMeta: MetaDescriptor[] = [
        { title: indexPageTitle },
        { name: "description", content: indexPageDescription },
        // Override specific OG tags for the index page
        { property: "og:title", content: indexPageTitle },
        { property: "og:description", content: indexPageDescription },
        // og:type="website" and og:url="/" will be inherited correctly from root defaults
        // Override canonical link for the index page (which is the root URL)
        { tagName: "link", rel: "canonical", href: siteConfig.url },
    ];

    // Add structured data for events if we have any
    if (upcomingEvents.length > 0) {
        const eventsStructuredData = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "Upcoming Karate Events",
            "description": "Upcoming karate events and workshops at Sensei Negin's dojo",
            "itemListElement": upcomingEvents.map((event, index) => ({
                "@type": "Event",
                "position": index + 1,
                "name": event.title,
                "description": event.description || `${event.event_type} event at our karate dojo`,
                "startDate": event.start_date + (event.start_time ? `T${event.start_time}` : ''),
                "endDate": event.end_date ? (event.end_date + (event.end_time ? `T${event.end_time}` : '')) : undefined,
                "location": {
                     "@type": "Place",
                     "name": event.location || siteConfig.name,
                     "address": {
                         "@type": "PostalAddress",
                         "streetAddress": event.address || siteConfig.location.address
                     }
                 },
                "organizer": {
                    "@type": "Organization",
                    "name": siteConfig.name,
                    "url": siteConfig.url
                },
                "offers": event.registration_fee ? {
                    "@type": "Offer",
                    "price": event.registration_fee,
                    "priceCurrency": "CAD",
                    "availability": "https://schema.org/InStock"
                } : undefined,
                "eventStatus": "https://schema.org/EventScheduled",
                "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode"
            }))
        };

        indexMeta.push({
            "script:ld+json": eventsStructuredData
        });
    }

    // Add Course structured data for karate classes
    const courseStructuredData = {
        "@context": "https://schema.org",
        "@type": "Course",
        "name": "Karate Classes with Sensei Negin",
        "description": `Learn the art of karate with professional instruction from a 5th Dan Black Belt. Classes for children ages ${siteConfig.classes.ageRange} focusing on discipline, self-defense, and personal growth.`,
        "provider": {
            "@type": "Organization",
            "name": siteConfig.name,
            "url": siteConfig.url,
            "address": {
                "@type": "PostalAddress",
                "streetAddress": siteConfig.location.address,
                "addressLocality": siteConfig.location.locality,
                "addressRegion": siteConfig.location.region,
                "postalCode": siteConfig.location.postalCode,
                "addressCountry": siteConfig.location.country
            },
            "telephone": siteConfig.contact.phone,
            "email": siteConfig.contact.email
        },
        "courseCode": "KARATE-MAIN",
        "educationalLevel": "Beginner to Advanced",
        "teaches": [
            "Karate techniques",
            "Self-defense",
            "Discipline and respect",
            "Physical fitness",
            "Mental focus",
            "Character development"
        ],
        "timeRequired": "P3M", // 3 months duration
        "courseSchedule": {
            "@type": "Schedule",
            "scheduleTimezone": "America/Vancouver",
            "byDay": siteConfig.classes.days.split(' and ').map(day => day.trim()),
            "startTime": siteConfig.classes.time.split(' - ')[0] || "18:30",
            "endTime": siteConfig.classes.time.split(' - ')[1] || "19:30"
        },
        "offers": {
            "@type": "Offer",
            "price": siteConfig.pricing.monthly.toString(),
            "priceCurrency": siteConfig.localization.currency,
            "category": "Monthly",
            "description": `${siteConfig.pricing.freeTrial} available`
        },
        "audience": {
            "@type": "EducationalAudience",
            "educationalRole": "student",
            "audienceType": `Ages ${siteConfig.classes.ageRange}`
        },
        "instructor": {
            "@type": "Person",
            "name": "Sensei Negin",
            "jobTitle": "Karate Instructor",
            "description": "5th Dan Black Belt with M.S. in Sport Psychology, Kids Sports Certified Coach, Award Winning Youth Coach, and Personal Trainer Certified"
        }
    };

    indexMeta.push({
        "script:ld+json": courseStructuredData
    });

    // Merge parent defaults with specific tags for this page
    return mergeMeta(parentMeta, indexMeta);
};

export default function Index() {
    const { upcomingEvents } = useLoaderData<typeof loader>();
    return (
        <div className="page-background-styles">
            {/* Hero Section with Background Image */}
            <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
                {/* Background Image */}
                <div 
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{
                        backgroundImage: `url('/images/karate.jpg')`
                    }}
                >
                </div>
                
                {/* Dark overlay for better text readability */}
                <div className="absolute inset-0 bg-black bg-opacity-60 dark:bg-opacity-50"></div>
                
                {/* Hero Content */}
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center text-white">
                    <div className="max-w-4xl mx-auto">
                        {/* Main Heading */}
                        <div className="mb-8">
                            <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-4">
                                DISCOVER
                                <span className="block text-green-300 dark:text-green-400">THE ART OF</span>
                                <span className="block text-4xl md:text-6xl">THE &ldquo;EMPTY HAND&rdquo;</span>
                            </h1>
                        </div>
                        
                        {/* Subtitle */}
                        <div className="mb-12">
                            <p className="text-xl md:text-2xl mb-6 leading-relaxed max-w-3xl mx-auto">
                                &ldquo;This class is an introduction to one of the most sophisticated martial arts ‒ the
                                Art of Karate. While karate focuses on defence techniques, its teaching goes far beyond fighting&rdquo;
                            </p>
                            <p className="text-lg md:text-xl text-green-300 dark:text-green-400 font-semibold">{siteConfig.pricing.freeTrial} available!</p>
                        </div>
                        
                        {/* Call to Action Buttons */}
                        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
                            <Link
                                to="/register"
                                className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-10 rounded-lg text-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                            >
                                Join us! OSS!
                            </Link>
                            <Link
                                to="/contact"
                                className="inline-block bg-transparent border-2 border-white text-white hover:bg-white hover:text-gray-900 font-bold py-4 px-10 rounded-lg text-lg transition-all duration-300 transform hover:scale-105"
                            >
                                Learn More
                            </Link>
                        </div>
                        
                        {/* Quick Info Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
                                <Clock className="h-8 w-8 text-green-400 mx-auto mb-3" />
                                <h3 className="font-bold text-lg mb-2">Class Schedule</h3>
                                <p className="text-sm">{siteConfig.classes.days}</p>
                                <p className="text-sm">{siteConfig.classes.time}</p>
                            </div>
                            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
                                <Users className="h-8 w-8 text-green-400 mx-auto mb-3" />
                                <h3 className="font-bold text-lg mb-2">Age Range</h3>
                                <p className="text-sm">Ages {siteConfig.classes.ageRange}</p>
                                <p className="text-sm">All skill levels welcome</p>
                            </div>
                            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
                                <Award className="h-8 w-8 text-green-400 mx-auto mb-3" />
                                <h3 className="font-bold text-lg mb-2">Expert Instruction</h3>
                                <p className="text-sm">5th Dan Black Belt</p>
                                <p className="text-sm">Sensei Negin</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Scroll indicator */}
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white animate-bounce">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                </div>
            </div>

            {/* Upcoming Events Section */}
            {upcomingEvents.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 py-16">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-bold text-center text-green-600 dark:text-green-400 mb-12">
                            Upcoming Events
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {upcomingEvents.map((event) => (
                                <div key={event.id} className="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
                                    <div className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                 event.event_type === 'workshop' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                 event.event_type === 'tournament' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                                 event.event_type === 'seminar' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                                 event.event_type === 'testing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                 event.event_type === 'competition' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                                 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
                                             }`}>
                                                {event.event_type?.replace('_', ' ').toUpperCase() || 'EVENT'}
                                            </span>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                event.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                event.status === 'registration_open' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
                                            }`}>
                                                {event.status === 'registration_open' ? 'OPEN' : event.status?.toUpperCase()}
                                            </span>
                                        </div>
                                        
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                            {event.title}
                                        </h3>
                                        
                                        {event.description && (
                                            <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                                                {event.description}
                                            </p>
                                        )}
                                        
                                        <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                                            <div className="flex items-center">
                                                <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                                                <span>
                                                    {new Date(event.start_date).toLocaleDateString('en-CA', {
                                                        weekday: 'short',
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                    {event.end_date && event.end_date !== event.start_date && (
                                                        <> - {new Date(event.end_date).toLocaleDateString('en-CA', {
                                                            weekday: 'short',
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}</>
                                                    )}
                                                </span>
                                            </div>
                                            
                                            {(event.start_time || event.end_time) && (
                                                <div className="flex items-center">
                                                    <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                                                    <span>
                                                        {event.start_time && new Date(`2000-01-01T${event.start_time}`).toLocaleTimeString('en-CA', {
                                                            hour: 'numeric',
                                                            minute: '2-digit',
                                                            hour12: true
                                                        })}
                                                        {event.end_time && (
                                                            <> - {new Date(`2000-01-01T${event.end_time}`).toLocaleTimeString('en-CA', {
                                                                hour: 'numeric',
                                                                minute: '2-digit',
                                                                hour12: true
                                                            })}</>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            
                                            {event.location && (
                                                <div className="flex items-center">
                                                    <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                                                    <span>{event.location}</span>
                                                </div>
                                            )}
                                            
                                            {event.registration_fee && (
                                                <div className="flex items-center">
                                                    <span className="text-green-600 dark:text-green-400 font-semibold">
                                                        ${event.registration_fee} CAD
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {event.status === 'registration_open' && event.registration_deadline && (
                                            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                                    <strong>Registration deadline:</strong> {new Date(event.registration_deadline).toLocaleDateString('en-CA', {
                                                        weekday: 'short',
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </p>
                                            </div>
                                        )}
                                        
                                        <div className="mt-6 flex justify-between items-center">
                                            <Link
                                                to={`/events/${event.id}`}
                                                className="inline-flex items-center text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                                            >
                                                Learn More
                                                <ExternalLink className="h-4 w-4 ml-1" />
                                            </Link>
                                            
                                            {event.status === 'registration_open' && (
                                                <Link
                                                    to={`/events/${event.id}/register`}
                                                    className="inline-flex items-center bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                                                >
                                                    Register
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {upcomingEvents.length >= 6 && (
                            <div className="text-center mt-12">
                                <Link
                                    to="/events"
                                    className="inline-flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
                                >
                                    View All Events
                                    <ExternalLink className="h-5 w-5 ml-2" />
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Class Info Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="bg-white dark:bg-gray-700 p-8 rounded-lg shadow-md">
                        <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-4">Class Details</h2>
                        <ul className="space-y-4 text-lg">
                            <li className="flex items-start"> {/* Use items-start for potentially multi-line addresses */}
                                <MapPin className="mr-2 mt-1 h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteConfig.location.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                >
                                    {siteConfig.location.address}
                                </a>
                            </li>
                            <li className="flex items-center">
                                <Clock className="mr-2 h-5 w-5 flex-shrink-0 text-blue-500 dark:text-blue-400" aria-hidden="true" />
                                <span>{siteConfig.classes.days} at {siteConfig.classes.time}</span>
                            </li>
                            <li className="flex items-center">
                                <Users className="mr-2 h-5 w-5 flex-shrink-0 text-purple-500 dark:text-purple-400" aria-hidden="true" />
                                <span>Ages {siteConfig.classes.ageRange}</span>
                            </li>
                            <li className="flex items-center">
                                <Phone className="mr-2 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
                                <span>{siteConfig.contact.phone}</span>
                            </li>
                            <li className="flex items-center">
                                <Mail className="mr-2 h-5 w-5 flex-shrink-0 text-sky-500 dark:text-sky-400" aria-hidden="true" />
                                <span>{siteConfig.contact.email}</span>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-6">
                            DISCOVER THE HANDS BEHIND THE ART
                        </h2>
                        <div className="bg-green-600 text-white p-8 rounded-lg shadow-md">
                            <h3 className="text-xl font-bold mb-4">SENSEI NEGIN</h3>
                            <ul className="space-y-3">
                                <li className="flex items-center">
                                    <Award className="mr-2 h-5 w-5 flex-shrink-0 text-yellow-400" aria-hidden="true" />
                                    <span>5th Dan Black Belt</span>
                                </li>
                                <li className="flex items-center">
                                    <GraduationCap className="mr-2 h-5 w-5 flex-shrink-0 text-blue-300" aria-hidden="true" />
                                    <span>M.S. of Sport Psychology</span>
                                </li>
                                <li className="flex items-center">
                                    <Baby className="mr-2 h-5 w-5 flex-shrink-0 text-pink-300" aria-hidden="true" />
                                    <span>Kids Sports Certified Coach</span>
                                </li>
                                <li className="flex items-center">
                                    <Trophy className="mr-2 h-5 w-5 flex-shrink-0 text-amber-400" aria-hidden="true" />
                                    <span>Award Winning Youth Coach</span>
                                </li>
                                <li className="flex items-center">
                                    <Dumbbell className="mr-2 h-5 w-5 flex-shrink-0 text-gray-100 dark:text-gray-300" aria-hidden="true" />
                                    <span>Personal Trainer Certified</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Our Studio Section */}
            <div className="bg-white dark:bg-gray-800 py-16"> {/* Increased padding from pb-16 */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-green-600 dark:text-green-400 mb-12">
                        Our Training Environment
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        {/* Floor Info */}
                        <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow-md flex flex-col h-full items-center text-center"> {/* Added items-center, text-center */}
                            <Footprints className="h-10 w-10 text-orange-600 dark:text-orange-400 mb-4" aria-hidden="true" />
                            <h3 className="text-xl font-bold text-green-700 dark:text-green-300 mb-3">Engineered for Safety & Performance</h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-4">
                                Our studio floors are designed to support various martial arts styles.
                                Countless hours went into creating the 3¼″  closed-cell subfloor,
                                providing exceptional comfort and helping prevent injuries.
                            </p>
                            <p className="text-gray-600 dark:text-gray-300 italic">
                                And stay tuned for news about our new tatami mats!
                            </p>
                        </div>
                        {/* Ventilation Info */}
                        <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow-md flex flex-col h-full items-center text-center"> {/* Added items-center, text-center */}
                            <Wind className="h-10 w-10 text-cyan-500 dark:text-cyan-400 mb-4" aria-hidden="true" />
                            <h3 className="text-xl font-bold text-green-700 dark:text-green-300 mb-3">Optimized Air Quality</h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-4">
                                In a high-performance environment, air quality matters. Our space features CO<sub>2</sub> sensors that regulate the ventilation system, ensuring maximum oxygen flow for peak performance and comfort during training.
                            </p>
                            <p className="text-gray-600 dark:text-gray-300">
                                We&apos;re committed to matching the quality of our space with the excellence of our teaching. Come experience the difference!
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Benefits Section */}
            <div className="bg-green-50 dark:bg-gray-700 py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-green-600 dark:text-green-400 mb-12">
                        Benefits of Karate Training
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center"> {/* Updated bg, added text-center */}
                            <Brain className="h-12 w-12 text-blue-500 dark:text-blue-400 mx-auto mb-4" aria-hidden="true" />
                            <h3 className="text-xl font-bold mb-2">Mental Strength</h3>
                            <p className="text-gray-600 dark:text-gray-300">Develop focus, discipline, and confidence through consistent practice and achievement.</p> {/* Adjusted text color */}
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center"> {/* Updated bg, added text-center */}
                            <ShieldCheck className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" aria-hidden="true" />
                            <h3 className="text-xl font-bold mb-2">Self-Defense</h3>
                            <p className="text-gray-600 dark:text-gray-300">Learn practical defense techniques while understanding the responsibility that comes with them.</p> {/* Adjusted text color */}
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md text-center"> {/* Updated bg, added text-center */}
                            <Star className="h-12 w-12 text-yellow-500 dark:text-yellow-400 mx-auto mb-4" aria-hidden="true" />
                            <h3 className="text-xl font-bold mb-2">Personal Growth</h3>
                            <p className="text-gray-600 dark:text-gray-300">Whether for transformative or competitive purposes, karate nurtures champions in all aspects of life!</p> {/* Adjusted text color */}
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="bg-green-600 text-white py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold mb-6">Ready to Begin Your Karate Journey?</h2>
                    <p className="text-xl mb-8 max-w-3xl mx-auto">
                        Join Sensei Negin&apos;s karate class and discover the art of the &ldquo;empty hand&rdquo;
                        while developing discipline,
                        confidence, and physical fitness.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link
                            to="/register"
                            className="inline-block bg-white text-green-600 font-bold py-3 px-8 rounded-lg text-lg hover:bg-gray-100 transition"
                        >
                            Register Now
                        </Link>
                        <Link
                            to="/contact"
                            className="inline-block bg-transparent border-2 border-white text-white font-bold py-3 px-8 rounded-lg text-lg hover:bg-white hover:text-green-600 transition"
                        >
                            Contact Us
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
