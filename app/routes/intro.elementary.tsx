import {Link, useSearchParams} from "@remix-run/react";
import {siteConfig} from "~/config/site";
import type {MetaArgs, MetaDescriptor, MetaFunction} from "@remix-run/node";
import {Button} from "~/components/ui/button";
import {mergeMeta} from "~/utils/meta";
import {Award, CheckCircle, Clock, Globe, GraduationCap, Mail, MapPin, Phone, Users} from 'lucide-react';

export const meta: MetaFunction = (args: MetaArgs) => {
    const parentMatch = args.matches.find((match) => match.id === "root");
    const parentMeta = parentMatch?.meta || [];

    const elementaryMeta: MetaDescriptor[] = [
        {title: "GREENEGIN KARATE - Elementary School Program"},
        {
            name: "description",
            content: "Transform your elementary school with our 8-session introductory karate program. " +
                "Building character, enhancing academic success, creating lifelong excellence. " +
                "Led by Sensei Negin, 5th Dan Black Belt."
        },
        {property: "og:title", content: "GREENEGIN KARATE - Elementary School Program"},
        {
            property: "og:description",
            content: "Transform your elementary school with our 8-session introductory karate program. " +
                "Building character, enhancing academic success, creating lifelong excellence."
        },
        {property: "og:type", content: "website"},
        {property: "og:url", content: `${siteConfig.url}/intro/elementary`},
        {tagName: "link", rel: "canonical", href: `${siteConfig.url}/intro/elementary`},
    ];

    return mergeMeta(parentMeta, elementaryMeta);
};

export default function ElementaryIntroPage() {
    const [searchParams] = useSearchParams();

    // Generate series names based on entered dates
    const generateSeriesName = (dateString: string): string => {
        if (!dateString.trim()) return "Program Series";
        
        // Extract month from various date formats
        const monthRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)/i;
        const match = dateString.match(monthRegex);
        
        if (match) {
            return `${match[1]} Series`;
        }
        
        // Fallback: try to extract month abbreviations
        const monthAbbrevRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
        const abbrevMatch = dateString.match(monthAbbrevRegex);
        
        if (abbrevMatch) {
            const monthMap: { [key: string]: string } = {
                'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
                'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
                'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
            };
            return `${monthMap[abbrevMatch[1]]} Series`;
        }
        
        // If no month found, return a generic name
        return "Program Series";
    };

    // Template variables from URL params or defaults
    const templateVars = {
        price: `$${searchParams.get("price") || "89"} + PST`,
        sessions: `${searchParams.get("sessions") || "8"} sessions`,
        duration: `${searchParams.get("duration") || "45"} minutes each`,
        frequency: `${searchParams.get("frequency") || "2"} classes per week`
    };

    // Get dynamic series data from URL parameters
    const seriesData = [];
    let seriesIndex = 1;
    while (searchParams.get(`series${seriesIndex}`)) {
        seriesData.push({
            id: `series${seriesIndex}`,
            dates: searchParams.get(`series${seriesIndex}`) || ""
        });
        seriesIndex++;
    }
    
    // If no series data from URL, use defaults
    if (seriesData.length === 0) {
        seriesData.push(
            { id: "series1", dates: "September 9-26, 2024" },
            { id: "series2", dates: "February 3-20, 2025" }
        );
    }

    return (
        <div className="page-background-styles">
            {/* Minimal Header */}
            <div className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-center">
                        <Link to="/" className="flex items-center">
                            <div className="relative h-10 w-53 mr-4">
                                <img
                                    src="/logo-light.svg"
                                    alt="Karate Greenegin Logo - Kids Martial Arts Victoria BC"
                                    className="h-10 w-53 dark:hidden"
                                />
                                <img
                                    src="/logo-dark.svg"
                                    alt="Karate Greenegin Logo - Kids Martial Arts Victoria BC, Dark Mode"
                                    className="h-10 w-53 hidden dark:block"
                                />
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    High-Performance Martial Arts Academy
                                </p>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header Section */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-extrabold page-header-styles sm:text-5xl mb-4">
                        Elementary School Program
                    </h1>
                    <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-6">
                        Introduction to Karate
                    </h2>
                    <div
                        className="flex flex-wrap justify-center gap-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
                        <span className="flex items-center"><Award className="mr-2 h-5 w-5 text-green-500"/>Building Character</span>
                        <span className="flex items-center"><GraduationCap className="mr-2 h-5 w-5 text-blue-500"/>Enhancing Academic Success</span>
                        <span className="flex items-center"><Users className="mr-2 h-5 w-5 text-purple-500"/>Creating Lifelong Excellence</span>
                    </div>
                </div>

                {/* What is it Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        🥋 What is it?
                    </h2>
                    <div className="space-y-4 text-gray-700 dark:text-gray-300">
                        <p className="text-lg leading-relaxed">
                            The Greenegin Introductory Karate Program is an engaging, school-based martial arts series
                            designed to introduce students to one of the world&apos;s most transformative arts—the Art of
                            Karate. Unlike traditional martial arts programs that focus primarily on physical
                            techniques, our approach integrates sports psychology with traditional karate training to
                            create lasting transformation in young learners.
                        </p>
                        <p className="text-lg leading-relaxed">
                            This program goes beyond the well-known benefits of focus and confidence: it
                            nurtures <strong>resilience{','} diligence{','} accountability{','} and above all
                            gratitude</strong> —values that are highly complementary to academic performance and
                            classroom behavior.
                        </p>
                        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border-l-4 border-green-500">
                            <p className="text-lg font-semibold text-green-800 dark:text-green-200">
                                Offered as an {templateVars.sessions} series
                                ({templateVars.frequency}, {templateVars.duration}), this program is structured to make
                                martial arts accessible, safe, and inspiring within the school environment.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Who is it for Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        👩‍🏫 Who is it for? Who is it by?
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Perfect for:</h3>
                            <ul className="space-y-3">
                                <li className="flex items-start">
                                    <CheckCircle className="mr-3 mt-1 h-5 w-5 text-green-500 flex-shrink-0"/>
                                    <span>Students aged 6-12</span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle className="mr-3 mt-1 h-5 w-5 text-green-500 flex-shrink-0"/>
                                    <span>Teachers seeking to shape self-disciplined, polite, and engaged students</span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle className="mr-3 mt-1 h-5 w-5 text-green-500 flex-shrink-0"/>
                                    <span>Schools willing to benefit from the synergy between academics and sports</span>
                                </li>
                            </ul>
                        </div>
                        <div className="bg-green-600 dark:bg-green-700 p-6 rounded-lg text-white">
                            <h3 className="text-xl font-semibold mb-4">Led by Sensei Negin</h3>
                            <p className="mb-4">
                                A 5th Dan Black Belt with 25 years of experience backed by an M.S. in Sport Psychology,
                                NCCP Training, and Kids Play and Sports Certificate.
                            </p>
                            <p className="text-green-100">
                                Our coach is a unique fusion of artistic insight and scientific precision, weaving
                                together performance psychology, injury prevention, and traditional values to cultivate
                                both champions and deeply grounded human beings.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Where & When Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        📍 Where & When?
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
                                <MapPin className="mr-2 h-5 w-5 text-red-500"/>
                                Location
                            </h3>
                            <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                                Your school&apos;s gymnasium or multipurpose room
                            </p>

                            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
                                <Clock className="mr-2 h-5 w-5 text-blue-500"/>
                                Schedule
                            </h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• {templateVars.frequency} (e.g.{','} Tue/Thu or Mon/Wed)</li>
                                <li>• {templateVars.duration}</li>
                                <li>• {templateVars.sessions} per cycle</li>
                            </ul>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-amber-800 dark:text-amber-200">
                                Available Start Dates:
                            </h3>
                            <div className="space-y-3">
                                {seriesData.map((series, index) => (
                                    <div key={series.id} className="bg-white dark:bg-gray-800 p-4 rounded border-l-4 border-amber-500">
                                        <h4 className="font-semibold text-amber-700 dark:text-amber-300">
                                            {generateSeriesName(series.dates)}
                                        </h4>
                                        <p className="text-gray-600 dark:text-gray-400">{series.dates}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 italic">
                                We encourage continuous collaboration by offering two seasonal series each school year.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Why Offer Karate Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        💡 Why Offer Karate at Your School?
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-blue-700 dark:text-blue-300">For
                                Students:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Develops coordination, flexibility, physical endurance</li>
                                <li>• Enhances confidence yet teaches emotional intelligence</li>
                                <li>• Sparks long-term interest in high-performance athletics</li>
                            </ul>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-purple-700 dark:text-purple-300">For
                                Teachers:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Reinforces classroom discipline and attentiveness</li>
                                <li>• Offers a structured outlet for excess energy, promoting classroom harmony</li>
                                <li>• Supports students with social-emotional learning</li>
                            </ul>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-green-700 dark:text-green-300">For the School
                                Community:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Cultivates a respect-based culture</li>
                                <li>• Strengthens school reputation through innovation and wellness</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Pricing Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        💰 Pricing & Enrollment
                    </h2>
                    <div
                        className="bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 p-8 rounded-lg text-white text-center">
                        <h3 className="text-2xl font-bold mb-4">Introductory Series Price:</h3>
                        <div
                            className="text-4xl font-extrabold mb-6">{templateVars.price} for {templateVars.sessions} per
                            student
                        </div>
                        <div className="grid md:grid-cols-2 gap-6 text-left">
                            <div>
                                <h4 className="font-semibold mb-3 text-green-100">✅ What&apos;s Included:</h4>
                                <ul className="space-y-2 text-green-100">
                                    <li>• All materials provided</li>
                                    <li>• Certified instructors</li>
                                    <li>• Flexible scheduling</li>
                                    <li>• Optional follow-up connection to GREENEGIN&apos;s High-Performance Academy
                                    </li>
                                </ul>
                            </div>
                            <div className="bg-green-500/20 p-4 rounded">
                                <p className="text-green-100">
                                    Following the intro class, students demonstrating strong interest or talent may be
                                    invited to pursue advanced training at our Langford studio.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Let's Build Together Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        🤝 Let&apos;s Build Together
                    </h2>
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-8 rounded-lg">
                        <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                            By bringing this program to your school, we are not just adding another extracurricular
                            activity—we are offering your students a life-changing experience that will enhance both
                            their academic performance and social development. We see this as a co-creative journey,
                            where your feedback is valued as we work together to build strong characters that will serve
                            students far beyond their school years.
                        </p>
                        <blockquote
                            className="border-l-4 border-green-500 pl-6 italic text-xl text-green-700 dark:text-green-300">
                            &ldquo;Karate is more than a sport&mdash; it is a tool for shaping empowered yet humble,
                            ambitious yet balanced personalities&rdquo;
                            <footer className="mt-2 text-base font-semibold">&mdash; Sensei Negin</footer>
                        </blockquote>
                    </div>
                </div>

                {/* Contact Section */}
                <div className="page-card-styles bg-gradient-to-r from-gray-900 to-gray-800 text-white">
                    <h2 className="text-3xl font-bold mb-8 text-center">Contact</h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-green-400">Valeriya Guseva</h3>
                            <p className="text-gray-300 mb-6">Academy Administrator</p>
                            <div className="space-y-3">
                                <div className="flex items-center">
                                    <Mail className="mr-3 h-5 w-5 text-green-400"/>
                                    <a href="mailto:info@greenegin.ca"
                                       className="hover:text-green-400 transition-colors">
                                        info@greenegin.ca
                                    </a>
                                </div>
                                <div className="flex items-center">
                                    <Phone className="mr-3 h-5 w-5 text-green-400"/>
                                    <a href="tel:(604) 690-7121" className="hover:text-green-400 transition-colors">
                                        (604) 690-7121
                                    </a>
                                </div>
                                <div className="flex items-center">
                                    <Globe className="mr-3 h-5 w-5 text-green-400"/>
                                    <a href="https://karate.greenegin.ca"
                                       className="hover:text-green-400 transition-colors">
                                        karate.greenegin.ca
                                    </a>
                                </div>
                                <div className="flex items-start">
                                    <MapPin className="mr-3 mt-1 h-5 w-5 text-green-400 flex-shrink-0"/>
                                    <span>GREENEGIN KARATE, 650 Allandale Rd Suite A101, Victoria, BC V9C 0S2</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-semibold mb-6 text-green-400">Ready to Transform Your
                                School?</h3>
                            <Button asChild size="lg" className="bg-green-600 hover:bg-green-700 text-white">
                                <Link to="/contact?program=elementary">Schedule a Consultation</Link>
                            </Button>
                            <p className="mt-4 text-sm text-gray-400">
                                Contact us to discuss scheduling and customization options for your elementary school.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}