import { Link, useSearchParams } from "@remix-run/react";
import { siteConfig } from "~/config/site";
import type { MetaArgs, MetaDescriptor, MetaFunction } from "@remix-run/node";
import { Button } from "~/components/ui/button";
import { mergeMeta } from "~/utils/meta";
import { Baby, Clock, MapPin, Mail, Phone, Globe, CheckCircle, Star, Smile } from 'lucide-react';

export const meta: MetaFunction = (args: MetaArgs) => {
    const parentMatch = args.matches.find((match) => match.id === "root");
    const parentMeta = parentMatch?.meta || [];

    const daycareMeta: MetaDescriptor[] = [
        { title: "GREENEGIN KARATE - Daycare Program" },
        {
            name: "description",
            content: "Bring the transformative power of karate to your daycare with our specialized 8-session program. Building character, confidence, and focus in young learners aged 4-6."
        },
        { property: "og:title", content: "GREENEGIN KARATE - Daycare Program" },
        { property: "og:description", content: "Fun and engaging 8-session introductory karate program designed for day care centers." },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${siteConfig.url}/intro/daycare` },
        { tagName: "link", rel: "canonical", href: `${siteConfig.url}/intro/daycare` },
    ];

    return mergeMeta(parentMeta, daycareMeta);
};

export default function DaycareIntroPage() {
    const [searchParams] = useSearchParams();
    
    // Template variables from URL params or defaults
    const templateVars = {
        startDates: {
            september: searchParams.get('sept') || "September 9-26, 2024",
            february: searchParams.get('feb') || "February 3-20, 2025"
        },
        price: `$${searchParams.get('price') || "89"} + PST`,
        sessions: `${searchParams.get('sessions') || "8"} sessions`,
        duration: `${searchParams.get('duration') || "45"} minutes each`,
        frequency: `${searchParams.get('frequency') || "2"} classes per week`
    };

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
                        Day Care Program
                    </h1>
                    <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-6">
                        Introductory Karate Program for Day Cares
                    </h2>
                    <div className="flex flex-wrap justify-center gap-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
                        <span className="flex items-center"><Baby className="mr-2 h-5 w-5 text-pink-500" />Early Development</span>
                        <span className="flex items-center"><Smile className="mr-2 h-5 w-5 text-yellow-500" />Fun Learning</span>
                        <span className="flex items-center"><Star className="mr-2 h-5 w-5 text-purple-500" />Character Building</span>
                    </div>
                </div>

                {/* What is it Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        🥋 What is it?
                    </h2>
                    <div className="space-y-4 text-gray-700 dark:text-gray-300">
                        <p className="text-lg leading-relaxed">
                            The Greenegin Introductory Karate Program for Day Cares is a playful, age-appropriate
                            martial arts series designed to introduce young children to the foundational principles of
                            karate through fun, engaging activities. Our program combines traditional karate movements
                            with games, storytelling, and interactive exercises that capture young imaginations
                            while building essential life skills.
                        </p>
                        <p className="text-lg leading-relaxed">
                            This program focuses on
                            <strong>motor skill development, following directions, sharing, respect, and self-control</strong>
                            —all presented through exciting karate-themed activities that keep children engaged
                            and eager to participate.
                        </p>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border-l-4 border-yellow-500">
                            <p className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
                                Offered as an {templateVars.sessions} series ({templateVars.frequency},
                                {templateVars.duration}), this program brings the excitement of martial arts directly
                                to your day care in a safe, structured, and developmentally appropriate format.
                            </p>
                        </div>
                        <div className="bg-pink-50 dark:bg-pink-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-3 text-pink-800 dark:text-pink-200">Age-Appropriate Features:</h3>
                            <ul className="space-y-2 text-pink-700 dark:text-pink-300">
                                <li>• Simple, easy-to-follow movements and techniques</li>
                                <li>• Interactive games and storytelling elements</li>
                                <li>• Short attention span considerations</li>
                                <li>• Positive reinforcement and celebration of effort</li>
                                <li>• Group activities that promote cooperation</li>
                            </ul>
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
                                    <CheckCircle className="mr-3 mt-1 h-5 w-5 text-green-500 flex-shrink-0" />
                                    <span>Children ages 3-6 in day care settings</span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle className="mr-3 mt-1 h-5 w-5 text-green-500 flex-shrink-0" />
                                    <span>Day care centers seeking engaging physical activities</span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle className="mr-3 mt-1 h-5 w-5 text-green-500 flex-shrink-0" />
                                    <span>Early childhood educators looking for character-building programs</span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle className="mr-3 mt-1 h-5 w-5 text-green-500 flex-shrink-0" />
                                    <span>Centers focused on social-emotional development</span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle className="mr-3 mt-1 h-5 w-5 text-green-500 flex-shrink-0" />
                                    <span>Programs wanting to offer unique, enriching activities</span>
                                </li>
                            </ul>
                        </div>
                        <div className="bg-pink-600 dark:bg-pink-700 p-6 rounded-lg text-white">
                            <h3 className="text-xl font-semibold mb-4">Led by Sensei Negin</h3>
                            <p className="mb-4">
                                A 5th Dan Black Belt with 25 years of experience, M.S. in Sport Psychology,
                                and Kids Play and Sports Certificate, specializing in early childhood development
                                through martial arts.
                            </p>
                            <p className="text-pink-100 mb-4">
                                Our instructor understands the unique needs of young children and creates magical
                                learning experiences that feel like play while building important life skills.
                            </p>
                            <div className="bg-pink-500/20 p-4 rounded">
                                <p className="text-pink-100 text-sm">
                                    <strong>Special Expertise:</strong> Early childhood development, play-based learning,
                                    and creating positive first experiences with physical activity and martial arts.
                                </p>
                            </div>
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
                                <MapPin className="mr-2 h-5 w-5 text-red-500" />
                                Location
                            </h3>
                            <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                                Your day care&apos;s play area, gymnasium, or large multipurpose room
                            </p>
                            
                            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
                                <Clock className="mr-2 h-5 w-5 text-blue-500" />
                                Flexible Schedule
                            </h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• {templateVars.frequency} (adaptable to your schedule)</li>
                                <li>• {templateVars.duration} (can be adjusted for younger groups)</li>
                                <li>• {templateVars.sessions} per cycle</li>
                                <li>• Morning or afternoon time slots available</li>
                                <li>• Small group sizes for optimal engagement</li>
                            </ul>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-orange-800 dark:text-orange-200">
                                Available Start Dates:
                            </h3>
                            <div className="space-y-3">
                                <div className="bg-white dark:bg-gray-800 p-4 rounded border-l-4 border-orange-500">
                                    <h4 className="font-semibold text-orange-700 dark:text-orange-300">September Series</h4>
                                    <p className="text-gray-600 dark:text-gray-400">{templateVars.startDates.september}</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-4 rounded border-l-4 border-orange-500">
                                    <h4 className="font-semibold text-orange-700 dark:text-orange-300">February Series</h4>
                                    <p className="text-gray-600 dark:text-gray-400">{templateVars.startDates.february}</p>
                                </div>
                            </div>
                            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 italic">
                                We work around nap times, meal schedules, and your day care&apos;s daily routine
                                to find the perfect fit.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Why Offer Karate Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        💡 Why Offer Karate at Your Day Care?
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-pink-50 dark:bg-pink-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-pink-700 dark:text-pink-300">For Children:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Develops gross motor skills and coordination</li>
                                <li>• Builds confidence and self-esteem</li>
                                <li>• Teaches following directions and listening skills</li>
                                <li>• Promotes respect for others and self-control</li>
                                <li>• Provides fun, active play experiences</li>
                            </ul>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-yellow-700 dark:text-yellow-300">For Educators:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Provides structured physical activity option</li>
                                <li>• Supports behavior management goals</li>
                                <li>• Offers professional development insights</li>
                                <li>• Creates positive group dynamics</li>
                                <li>• Gives educators a well-deserved break</li>
                            </ul>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-green-700 dark:text-green-300">For the Day Care:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Differentiates your program from competitors</li>
                                <li>• Provides unique enrichment offering</li>
                                <li>• Enhances reputation for quality programming</li>
                                <li>• Creates positive parent feedback opportunities</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Developmental Benefits Section */}
                <div className="mb-12 page-card-styles bg-gradient-to-r from-pink-50 to-yellow-50 dark:from-pink-900/20 dark:to-yellow-900/20">
                    <h2 className="text-3xl font-bold text-pink-600 dark:text-pink-400 mb-6 flex items-center">
                        🌟 Early Childhood Development Benefits
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-pink-800 dark:text-pink-200">Physical Development:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Gross motor skill enhancement</li>
                                <li>• Balance and coordination improvement</li>
                                <li>• Spatial awareness development</li>
                                <li>• Strength and flexibility building</li>
                                <li>• Body awareness and control</li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-yellow-800 dark:text-yellow-200">Social-Emotional Development:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Self-regulation and impulse control</li>
                                <li>• Cooperation and turn-taking</li>
                                <li>• Confidence and self-esteem building</li>
                                <li>• Respect for others and boundaries</li>
                                <li>• Emotional expression and management</li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-6 bg-white dark:bg-gray-800 p-6 rounded-lg">
                        <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Cognitive Benefits:</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Following multi-step instructions, memory development through movement patterns, problem-solving through martial arts challenges, and enhanced focus and attention span through structured activities.
                        </p>
                    </div>
                </div>

                {/* Pricing Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        💰 Pricing & Enrollment
                    </h2>
                    <div className="bg-gradient-to-r from-pink-600 to-yellow-600 dark:from-pink-700 dark:to-yellow-700 p-8 rounded-lg text-white text-center">
                        <h3 className="text-2xl font-bold mb-4">Day Care Series Price:</h3>
                        <div className="text-4xl font-extrabold mb-6">{templateVars.price} for {templateVars.sessions} per child</div>
                        <div className="grid md:grid-cols-2 gap-6 text-left">
                            <div>
                                <h4 className="font-semibold mb-3 text-pink-100">✅ What&apos;s Included:</h4>
                                <ul className="space-y-2 text-pink-100">
                                    <li>• Age-appropriate materials and props</li>
                                    <li>• Early childhood specialized instructor</li>
                                    <li>• Flexible scheduling around your routine</li>
                                    <li>• Small group instruction for optimal engagement</li>
                                    <li>• Parent communication and progress updates</li>
                                </ul>
                            </div>
                            <div className="bg-pink-500/20 p-4 rounded">
                                <h4 className="font-semibold mb-2 text-pink-100">Special Day Care Features:</h4>
                                <p className="text-pink-100 text-sm">
                                    Programs designed specifically for day care environments, including shorter
                                    attention spans, group management strategies, and integration with your existing
                                    curriculum and values.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sample Activities Section */}
                <div className="mb-12 page-card-styles bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
                    <h2 className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-6 flex items-center">
                        🎯 Sample Activities & Games
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-yellow-800 dark:text-yellow-200">Fun Karate Games:</h3>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                <li className="flex items-start">
                                    <Star className="mr-2 mt-1 h-4 w-4 text-yellow-500 flex-shrink-0" />
                                    <span><strong>&quot;Ninja Animals&ldquo;</strong> - Moving like different animals with karate poses</span>
                                </li>
                                <li className="flex items-start">
                                    <Star className="mr-2 mt-1 h-4 w-4 text-yellow-500 flex-shrink-0" />
                                    <span><strong>&quot;Karate Simon Says&quot;</strong> - Following directions with martial arts movements</span>
                                </li>
                                <li className="flex items-start">
                                    <Star className="mr-2 mt-1 h-4 w-4 text-yellow-500 flex-shrink-0" />
                                    <span><strong>&quot;Balance Challenge&quot;</strong> - Fun balance games with karate stances</span>
                                </li>
                                <li className="flex items-start">
                                    <Star className="mr-2 mt-1 h-4 w-4 text-yellow-500 flex-shrink-0" />
                                    <span><strong>&quot;Respect Circle&quot;</strong> - Learning to bow and show respect</span>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-orange-800 dark:text-orange-200">Learning Through Play:</h3>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                <li className="flex items-start">
                                    <Smile className="mr-2 mt-1 h-4 w-4 text-orange-500 flex-shrink-0" />
                                    <span>Story-based movements and adventures</span>
                                </li>
                                <li className="flex items-start">
                                    <Smile className="mr-2 mt-1 h-4 w-4 text-orange-500 flex-shrink-0" />
                                    <span>Music and rhythm integration</span>
                                </li>
                                <li className="flex items-start">
                                    <Smile className="mr-2 mt-1 h-4 w-4 text-orange-500 flex-shrink-0" />
                                    <span>Cooperative group challenges</span>
                                </li>
                                <li className="flex items-start">
                                    <Smile className="mr-2 mt-1 h-4 w-4 text-orange-500 flex-shrink-0" />
                                    <span>Positive reinforcement and celebration</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Let's Build Together Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        🤝 Let&apos;s Build Together
                    </h2>
                    <div className="bg-green-50 dark:bg-green-900/20 p-8 rounded-lg">
                        <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                            By bringing this program to your day care, we are planting seeds of confidence, respect,
                            and joy in movement that will grow with these children throughout their lives.
                            We understand that every day care has its own culture and values, and we work collaboratively
                            to ensure our program enhances and supports your existing goals for the children in your care.
                        </p>
                        <blockquote className="border-l-4 border-green-500 pl-6 italic text-xl text-green-700 dark:text-green-300">
                            &quot;The youngest students often show us the purest joy in movement and learning.
                            Through karate, we nurture their natural curiosity while building the foundation for
                            a lifetime of confidence and respect.&quot;
                            <footer className="mt-2 text-base font-semibold">— Sensei Negin</footer>
                        </blockquote>
                    </div>
                </div>

                {/* Contact Section */}
                <div className="page-card-styles bg-gradient-to-r from-gray-900 to-gray-800 text-white">
                    <h2 className="text-3xl font-bold mb-8 text-center">Contact</h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-pink-400">Valeriya Guseva</h3>
                            <p className="text-gray-300 mb-6">Academy Administrator</p>
                            <div className="space-y-3">
                                <div className="flex items-center">
                                    <Mail className="mr-3 h-5 w-5 text-pink-400" />
                                    <a href="mailto:info@greenegin.ca" className="hover:text-pink-400 transition-colors">
                                        info@greenegin.ca
                                    </a>
                                </div>
                                <div className="flex items-center">
                                    <Phone className="mr-3 h-5 w-5 text-pink-400" />
                                    <a href="tel:(604) 690-7121" className="hover:text-pink-400 transition-colors">
                                        (604) 690-7121
                                    </a>
                                </div>
                                <div className="flex items-center">
                                    <Globe className="mr-3 h-5 w-5 text-pink-400" />
                                    <a href="https://karate.greenegin.ca" className="hover:text-pink-400 transition-colors">
                                        karate.greenegin.ca
                                    </a>
                                </div>
                                <div className="flex items-start">
                                    <MapPin className="mr-3 mt-1 h-5 w-5 text-pink-400 flex-shrink-0" />
                                    <span>GREENEGIN KARATE, 650 Allandale Rd Suite A101, Victoria, BC V9C 0S2</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-semibold mb-6 text-pink-400">Ready to Bring Joy & Learning Together?</h3>
                            <Button asChild size="lg" className="bg-pink-600 hover:bg-pink-700 text-white">
                                <Link to="/contact?program=daycare">Plan Your Program</Link>
                            </Button>
                            <p className="mt-4 text-sm text-gray-400">
                                Contact us to discuss scheduling options that work perfectly with your day care routine.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}