import { siteConfig } from "~/config/site"; // Import site config
import type { MetaFunction } from "@remix-run/node"; // Import MetaFunction

export const meta: MetaFunction = () => {
  return [
    { title: "Contact Us | Greenegin Karate" },
    { name: "description", content: "Contact Sensei Negin for kids karate classes in Colwood. Find class schedules, location, phone number, and email address." },
    // You can override OG tags here too if needed
    { property: "og:title", content: "Contact Us | Greenegin Karate" },
    { property: "og:description", content: "Contact Sensei Negin for kids karate classes in Colwood." },
    // Add SportsActivityLocation Schema
    {
        "script:ld+json": {
            "@context": "https://schema.org",
            "@type": "SportsActivityLocation",
            "name": "Greenegin Karate Class Location",
            "description": `Kids Karate Classes (${siteConfig.classes.ageRange}) at Lighthouse Christian Academy.`,
            "address": {
                "@type": "PostalAddress",
                // Use specific address if known, otherwise use locality/region
                // "streetAddress": siteConfig.location.address, // Use if this is the exact class address
                "addressLocality": "Colwood", // Assuming Colwood
                "addressRegion": "BC",
                "addressCountry": "CA"
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
    // Add canonical link for the Contact page
    { tagName: "link", rel: "canonical", href: `${siteConfig.url}/contact` }, // Use siteConfig
  ];
};


export default function ContactPage() {
    return (
        <div className="min-h-screen bg-green-50 dark:bg-gray-900 py-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md dark:text-gray-100">
                    <h1 className="text-3xl font-bold text-green-600 mb-6">Contact Sensei Negin</h1>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div>
                            <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
                            <ul className="space-y-4">
                                <li className="flex items-start">
                                    <span className="text-green-600 mr-3">📞</span>
                                    <div>
                                        <p className="font-medium">Phone</p>
                                        <p>(604) 690-7121</p>
                                    </div>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-600 mr-3">✉️</span>
                                    <div>
                                        <p className="font-medium">Email</p>
                                        <p>info@greenegin.ca</p>
                                    </div>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-600 mr-3">📍</span>
                                    <div>
                                        <p className="font-medium">Location</p>
                                        <p>Lighthouse Christian Academy</p>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="text-xl font-semibold mb-4">
                                <a href="/classes" className="hover:underline hover:text-green-700 dark:hover:text-green-400">
                                    Class Schedule
                                </a>
                            </h2>
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md">
                                <p className="font-medium mb-2">Children&apos;s Classes (Ages 6-12)</p>
                                <ul className="space-y-2">
                                    <li className="flex items-center">
                                        <span className="text-green-600 mr-2">•</span>
                                        <span>Monday: 6:00 PM - 7:00 PM</span>
                                    </li>
                                    <li className="flex items-center">
                                        <span className="text-green-600 mr-2">•</span>
                                        <span>Wednesday: 6:00 PM - 7:00 PM</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                        <h2 className="text-xl font-semibold mb-4">Send a Message</h2>
                        <form className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="name"
                                           className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Your Name
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
                                        placeholder="Enter your name"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="email"
                                           className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
                                        placeholder="Enter your email"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="subject"
                                       className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Subject
                                </label>
                                <input
                                    type="text"
                                    id="subject"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
                                    placeholder="Enter subject"
                                />
                            </div>

                            <div>
                                <label htmlFor="message"
                                       className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Message
                                </label>
                                <textarea
                                    id="message"
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
                                    placeholder="Enter your message"
                                ></textarea>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 transition"
                                >
                                    Send Message
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
