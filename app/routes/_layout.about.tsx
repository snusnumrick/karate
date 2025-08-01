import {Link} from "@remix-run/react"; // Import Link for the button
import {siteConfig} from "~/config/site"; // Import site config
// Import types needed for merging parent meta
import type {MetaArgs, MetaDescriptor, MetaFunction} from "@remix-run/node";
import {Button} from "~/components/ui/button"; // Import Button component

// Helper function to merge meta tags, giving precedence to child tags
function mergeMeta(
    parentMeta: MetaDescriptor[],
    childMeta: MetaDescriptor[]
): MetaDescriptor[] {
    const merged: Record<string, MetaDescriptor> = {};
    const getKey = (tag: MetaDescriptor): string | null => {
        if ('title' in tag) return 'title';
        if ('name' in tag) return `name=${tag.name}`;
        if ('property' in tag) return `property=${tag.property}`;
        // Handle canonical link specifically
        if ('tagName' in tag && tag.tagName === 'link' && tag.rel === 'canonical') return 'canonical';
        // Key for JSON-LD script
        if ('script:ld+json' in tag) return 'script:ld+json';
        // Fallback for other potential tags (less common)
        try {
            return JSON.stringify(tag);
        } catch {
            return null; // Cannot stringify
        }
    };

    parentMeta.forEach(tag => {
        const key = getKey(tag);
        if (key) merged[key] = tag;
    });

    childMeta.forEach(tag => {
        const key = getKey(tag);
        if (key) merged[key] = tag; // Child overwrites parent
    });

    return Object.values(merged);
}


export const meta: MetaFunction = (args: MetaArgs) => {
    // Find the parent 'root' route match
    const parentMatch = args.matches.find((match) => match.id === "root");
    // Get the already computed meta tags from the parent route match
    const parentMeta = parentMatch?.meta || [];

    // Define meta tags specific to this About page
    const aboutMeta: MetaDescriptor[] = [
        {title: "About Sensei Negin | Greenegin Karate"},
        {
            name: "description",
            content: "Learn about Sensei Negin, a 5th Dan Black Belt karate instructor with a Master's in Sport Psychology, teaching kids karate in Colwood."
        },
        // You can override OG tags here too if needed
        // Override specific OG tags
        {property: "og:title", content: "About Sensei Negin | Greenegin Karate"},
        {property: "og:description", content: "Learn about Sensei Negin, a 5th Dan Black Belt karate instructor."},
        {property: "og:type", content: "profile"}, // Specific OG type for this page
        {property: "og:url", content: `${siteConfig.url}/about`}, // Specific OG URL for this page

        // Add Person Schema for Sensei Negin
        {
            "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "Person",
                "name": "Sensei Negin",
                "jobTitle": "Karate Instructor",
                "alumniOf": { // Example if applicable, adjust as needed
                    "@type": "EducationalOrganization",
                    "name": "University/Institution for Sport Psychology" // Replace with actual institution if known
                },
                "knowsAbout": ["Karate", "Martial Arts", "Sport Psychology", "Child Development"],
                "description": "5th Dan Black Belt karate instructor with a Master's in Sport Psychology, specializing in teaching children.",
                "url": `${siteConfig.url}/about`, // Use siteConfig
                // "image": "URL_TO_SENSEI_NEGIN_PHOTO.jpg", // Optional: Add a URL to a photo
                "worksFor": {
                    "@type": "Organization",
                    "name": siteConfig.name,
                    "url": siteConfig.url // Use siteConfig
                }
            }
        },
        // Override canonical link for this page
        {tagName: "link", rel: "canonical", href: `${siteConfig.url}/about`},
    ];

    // Merge parent defaults with specific tags for this page
    return mergeMeta(parentMeta, aboutMeta);
};

export default function AboutPage() {
    return (
        <div className="page-background-styles py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold page-header-styles sm:text-4xl">
                        About Sensei Negin
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-xl page-subheader-styles sm:mt-4">
                        Discover the hands behind the art
                    </p>
                </div>

                <div className="mt-12 bg-white dark:bg-gray-700 rounded-lg shadow-xl overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <div className="p-8 md:p-12">
                            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-4">
                                5th Dan Black Belt Instructor
                            </h2>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                Sensei Negin is a highly accomplished karate instructor with over 20 years of experience
                                in martial arts, including coaching at provincial and national levels and holding
                                leadership roles within karate federations.
                                As a 5th Dan Black Belt, she has dedicated her life to mastering the art of karate and
                                sharing its
                                principles with the next generation.
                            </p>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                With a Master&apos;s degree in Sport Psychology, Sensei Negin brings a unique
                                perspective to her teaching,
                                focusing not just on physical techniques but also on mental strength, discipline, and
                                personal growth. She has applied this expertise directly, serving as a sport
                                psychologist for university athletes.
                            </p>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                As a certified Kids Sports Coach and award-winning youth instructor, she specializes in
                                creating
                                engaging, age-appropriate training programs that help children develop confidence,
                                respect, and
                                self-discipline through martial arts.
                            </p>
                            <div className="mt-8">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Certifications
                                    & Achievements</h3>
                                <ul className="list-disc pl-5 space-y-2 text-gray-600 dark:text-gray-300">
                                    <li>5th Dan Black Belt in Karate</li>
                                    <li>M.S. of Sport Psychology</li>
                                    <li>A Grade Degree of Coaching</li>
                                    <li>Kids Sports Certified Coach</li>
                                    <li>Award Winning Youth Coach</li>
                                    <li>Certified Karate Referee (Kata & Kumite)</li>
                                    <li>Personal Trainer Certified</li>
                                    <li>Multiple national and international competition medals</li>
                                </ul>
                            </div>
                        </div>
                        <div
                            className="bg-green-600 dark:bg-green-700 p-8 md:p-12 text-white flex flex-col justify-center">
                            {/* Haiku - Moved to top right */}
                            <div className="mb-6 text-right italic text-green-100">
                                <p>Silent dojo waits<br/>
                                    Empty hands shape formless air<br/>
                                    Warriors emerge</p>
                            </div>
                            <h2 className="text-2xl font-bold mb-4">Teaching Philosophy</h2>
                            <p className="mb-6">
                                &ldquo;This class is an introduction to one of the most sophisticated martial arts ‒ the
                                Art of Karate.
                                While karate focuses on defence techniques, its teaching goes far beyond
                                fighting.&rdquo;
                            </p>
                            <p className="mb-6">
                                &ldquo;Whether for transformative or competitive purposes,
                                karate nurtures champions in all aspects of life!&rdquo;
                            </p>
                            <p className="mb-6">
                                &ldquo;My goal is to help each student develop not just physical skills, but also mental
                                strength,
                                discipline, respect, and confidence that will serve them throughout their lives.&rdquo;
                            </p>
                            {/* Inline Q&A */}
                            <div className="mt-6 mb-6 p-4 bg-green-50 dark:bg-green-800 rounded-md">
                                <p className="text-gray-700 dark:text-green-100">
                                    <span className="font-semibold">Q: What is the main focus of the classes?</span>
                                    <br/>
                                    A: Classes introduce karate as a sophisticated martial art, emphasizing defense
                                    techniques, mental strength, discipline, and personal growth. We aim to nurture
                                    champions in all aspects of life!
                                </p>
                            </div>
                            {/* Haiku removed from here */}
                            <div className="mt-8">
                                <h3 className="text-xl font-semibold mb-4">Join us! OSS!</h3>
                                <p className="mb-6"> {/* Added margin-bottom */}
                                    Experience the transformative power of karate under the guidance of Sensei Negin at
                                    {siteConfig.location.description}. Classes are designed for children
                                    ages {siteConfig.classes.ageRange} and focus on
                                    building a strong foundation in karate techniques while developing character and
                                    life skills. Ready to start? <a href="/contact"
                                                                    className="text-green-100 hover:underline font-semibold">Contact
                                        us</a> to learn more or sign up for a free trial!
                                </p>
                                {/* Add Register Button */}
                                <div className="mt-6 text-center">
                                    <Button asChild size="lg" variant="secondary"
                                            className="bg-white text-green-700 hover:bg-gray-100 dark:bg-gray-200 dark:text-green-800 dark:hover:bg-gray-300">
                                        <Link to="/contact">Register Now</Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Territory Acknowledgement Section */}
                <div
                    className="mt-12 bg-green-600 dark:bg-green-700 rounded-lg shadow-xl p-8 md:p-12 text-white text-center">
                    <h2 className="text-2xl font-bold mb-6">{siteConfig.territoryAcknowledgement.title}</h2>
                    <p className="text-green-100 dark:text-green-200 leading-relaxed max-w-4xl mx-auto">
                        {siteConfig.territoryAcknowledgement.text}
                    </p>
                </div>
            </div>
        </div>
    );
}
