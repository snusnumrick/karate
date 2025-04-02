import {siteConfig} from "~/config/site"; // Import site config
import type { MetaFunction } from "@remix-run/node"; // Import MetaFunction

export const meta: MetaFunction = () => {
  return [
    { title: "About Sensei Negin | Greenegin Karate" },
    { name: "description", content: "Learn about Sensei Negin, a 5th Dan Black Belt karate instructor with a Master's in Sport Psychology, teaching kids karate in Colwood." },
    // You can override OG tags here too if needed
    { property: "og:title", content: "About Sensei Negin | Greenegin Karate" },
    { property: "og:description", content: "Learn about Sensei Negin, a 5th Dan Black Belt karate instructor." },
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
        "url": "https://www.greenegin.ca/about", // TODO: Replace with actual production URL
        // "image": "URL_TO_SENSEI_NEGIN_PHOTO.jpg", // Optional: Add a URL to a photo
        "worksFor": {
            "@type": "Organization",
            "name": siteConfig.name,
            "url": "https://www.greenegin.ca" // TODO: Replace with actual production URL
        }
      }
    },
    // Add canonical link for the About page
    { tagName: "link", rel: "canonical", href: "https://www.greenegin.ca/about" }, // TODO: Replace with actual production URL
  ];
};

export default function AboutPage() {
    return (
        <div className="bg-amber-50 dark:bg-gray-800 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                        About Sensei Negin
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
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
                                in martial arts.
                                As a 5th Dan Black Belt, she has dedicated her life to mastering the art of karate and
                                sharing its
                                principles with the next generation.
                            </p>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                With a Master&apos;s degree in Sport Psychology, Sensei Negin brings a unique
                                perspective to her teaching,
                                focusing not just on physical techniques but also on mental strength, discipline, and
                                personal growth.
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
                                    <li>Kids Sports Certified Coach</li>
                                    <li>Award Winning Youth Coach</li>
                                    <li>Personal Trainer Certified</li>
                                    <li>Multiple national and international competition medals</li>
                                </ul>
                            </div>
                        </div>
                        <div
                            className="bg-green-600 dark:bg-green-700 p-8 md:p-12 text-white flex flex-col justify-center">
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
                            <div className="mt-8">
                                <h3 className="text-xl font-semibold mb-4">Join us! OSS!</h3>
                                <p>
                                    Experience the transformative power of karate under the guidance of Sensei Negin at
                                    {siteConfig.location.description}. Classes are designed for children
                                    ages {siteConfig.classes.ageRange} and focus on
                                    building a strong foundation in karate techniques while developing character and
                                    life skills. Ready to start? <a href="/contact" className="text-green-500 hover:underline">Contact us</a> to learn more or sign up for a free trial!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
