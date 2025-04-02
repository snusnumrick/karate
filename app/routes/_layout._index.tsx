import type {MetaFunction} from "@remix-run/node";
import {Link} from "@remix-run/react";
import {siteConfig} from "~/config/site"; // Import site config

export const meta: MetaFunction = () => {
    return [
        {title: "Karate Classes - Sensei Negin"},
        {
            name: "description",
            content: `Discover the art of karate with Sensei Negin at ${siteConfig.location.address}. ` +
                `Classes for children ages ${siteConfig.classes.ageRange} on ${siteConfig.classes.days}.`
        },
    ];
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
                            <li className="flex items-center">
                                <span className="mr-2">📍</span>
                                <span>{siteConfig.location.address}</span>
                            </li>
                            <li className="flex items-center">
                                <span className="mr-2">🕕</span>
                                <span>{siteConfig.classes.days} at {siteConfig.classes.time}</span>
                            </li>
                            <li className="flex items-center">
                                <span className="mr-2">👧👦</span>
                                <span>Ages {siteConfig.classes.ageRange}</span>
                            </li>
                            <li className="flex items-center">
                                <span className="mr-2">📞</span>
                                <span>{siteConfig.contact.phone}</span>
                            </li>
                            <li className="flex items-center">
                                <span className="mr-2">✉️</span>
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
                                    <span className="mr-2">🥋</span>
                                    <span>5th Dan Black Belt</span>
                                </li>
                                <li className="flex items-center">
                                    <span className="mr-2">🎓</span>
                                    <span>M.S. of Sport Psychology</span>
                                </li>
                                <li className="flex items-center">
                                    <span className="mr-2">👶</span>
                                    <span>Kids Sports Certified Coach</span>
                                </li>
                                <li className="flex items-center">
                                    <span className="mr-2">🏆</span>
                                    <span>Award Winning Youth Coach</span>
                                </li>
                                <li className="flex items-center">
                                    <span className="mr-2">💪</span>
                                    <span>Personal Trainer Certified</span>
                                </li>
                            </ul>
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
                        <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
                            <div className="text-4xl text-green-600 dark:text-green-400 mb-4">🧠</div>
                            <h3 className="text-xl font-bold mb-2">Mental Strength</h3>
                            <p>Develop focus, discipline, and confidence through consistent practice and
                                achievement.</p>
                        </div>
                        <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
                            <div className="text-4xl text-green-600 dark:text-green-400 mb-4">🥋</div>
                            <h3 className="text-xl font-bold mb-2">Self-Defense</h3>
                            <p>Learn practical defense techniques while understanding the responsibility that comes with
                                them.</p>
                        </div>
                        <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
                            <div className="text-4xl text-green-600 dark:text-green-400 mb-4">🏆</div>
                            <h3 className="text-xl font-bold mb-2">Personal Growth</h3>
                            <p>Whether for transformative or competitive purposes, karate nurtures champions in all
                                aspects of life!</p>
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
