// Import types needed for merging parent meta
import type { MetaFunction, MetaArgs, MetaDescriptor } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { MapPin, Clock, Users, Phone, Mail, Award, GraduationCap, Baby, Trophy, Dumbbell, Brain, ShieldCheck, Star, Footprints, Wind } from 'lucide-react'; // Import icons for environment
import { siteConfig } from "~/config/site"; // Import site config

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

    // Merge parent defaults with specific tags for this page
    return mergeMeta(parentMeta, indexMeta);
};

export default function Index() {
    return (
        <div className="bg-amber-50 dark:bg-gray-800">
            {/* Hero Section */}
            <div className="bg-green-600 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div>
                            <div className="mb-6">
                                <h1 className="text-4xl md:text-5xl font-bold">
                                    DISCOVER <br/> THE ART OF <br/> THE &ldquo;EMPTY HAND&rdquo;
                                </h1>
                            </div>
                            <p className="text-xl mb-8">
                                &ldquo;This class is an introduction to one of the most sophisticated martial arts ‒ the
                                Art of Karate.
                                While karate focuses on defence techniques, its teaching goes far beyond fighting&rdquo;
                            </p>
                            <p className="text-lg mb-4 italic">{siteConfig.pricing.freeTrial} available!</p> {/* Add free trial mention */}
                            <Link
                                to="/register"
                                className="inline-block bg-white text-green-600 font-bold py-3 px-8 rounded-lg text-lg hover:bg-gray-100 transition"
                            >
                                Join us! OSS!
                            </Link>
                        </div>
                        <div className="flex justify-center">
                            <div className="relative h-96 w-full">
                                <div
                                    className="absolute left-0 md:left-10 top-0 h-full w-full bg-green-700 transform skew-x-0 md:-skew-x-12 origin-top-right z-0"></div>
                                <div className="absolute h-full w-full flex items-center justify-center z-10">
                                    <img
                                        src="/images/karate-pose.svg"
                                        alt="Karate pose silhouette"
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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
            <div className="bg-white dark:bg-gray-800  pb-16"> {/* Reduced padding from py-16 */}
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
