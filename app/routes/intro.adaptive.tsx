import { Link, useSearchParams } from "@remix-run/react";
import { siteConfig } from "~/config/site";
import type { MetaArgs, MetaDescriptor, MetaFunction } from "@remix-run/node";
import { Button } from "~/components/ui/button";
import { mergeMeta } from "~/utils/meta";
import { Heart, Users, Clock, MapPin, Mail, Phone, Globe, CheckCircle, Shield } from 'lucide-react';

export const meta: MetaFunction = (args: MetaArgs) => {
    const parentMatch = args.matches.find((match) => match.id === "root");
    const parentMeta = parentMatch?.meta || [];

    const adaptiveMeta: MetaDescriptor[] = [
        { title: "GREENEGIN KARATE - Adaptive Program" },
        {
            name: "description",
            content: "Inclusive karate program designed for students with diverse abilities. Building confidence, " +
                "motor skills, and social connections through adaptive martial arts instruction."
        },
        { property: "og:title", content: "GREENEGIN KARATE - Adaptive Program" },
        { property: "og:description", content: "Inclusive 8-session introductory karate program designed for " +
                "adaptive programs and special needs students." },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${siteConfig.url}/intro/adaptive` },
        { tagName: "link", rel: "canonical", href: `${siteConfig.url}/intro/adaptive` },
    ];

    return mergeMeta(parentMeta, adaptiveMeta);
};

export default function AdaptiveIntroPage() {
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
                        Adaptive Program
                    </h1>
                    <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-6">
                        Adaptive Introductory Karate Program
                    </h2>
                    <div className="flex flex-wrap justify-center gap-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
                        <span className="flex items-center"><Heart className="mr-2 h-5 w-5 text-red-500" />Building Confidence</span>
                        <span className="flex items-center"><Shield className="mr-2 h-5 w-5 text-blue-500" />Adaptive Learning</span>
                        <span className="flex items-center"><Users className="mr-2 h-5 w-5 text-purple-500" />Inclusive Excellence</span>
                    </div>
                </div>

                {/* What is it Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        🥋 What is it?
                    </h2>
                    <div className="space-y-4 text-gray-700 dark:text-gray-300">
                        <p className="text-lg leading-relaxed">
                            The Greenegin Adaptive Introductory Karate Program is a specially designed, inclusive martial arts series that introduces students with diverse learning needs to the transformative Art of Karate. Our adaptive approach combines traditional karate principles with specialized teaching methods that accommodate different learning styles, physical abilities, and sensory needs.
                        </p>
                        <p className="text-lg leading-relaxed">
                            This program emphasizes <strong>individual progress, self-acceptance, emotional regulation, and personal empowerment</strong> —creating a safe, supportive environment where every student can experience success and build confidence through martial arts.
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border-l-4 border-blue-500">
                            <p className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                                Offered as an {templateVars.sessions} series ({templateVars.frequency}, {templateVars.duration}), this program is structured to provide accessible, therapeutic, and empowering martial arts training in a familiar environment.
                            </p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-3 text-green-800 dark:text-green-200">Adaptive Features:</h3>
                            <ul className="space-y-2 text-green-700 dark:text-green-300">
                                <li>• Modified techniques for different physical abilities</li>
                                <li>• Sensory-friendly environment considerations</li>
                                <li>• Individualized pacing and goals</li>
                                <li>• Visual, auditory, and kinesthetic learning approaches</li>
                                <li>• Emphasis on personal achievement over competition</li>
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
                                    <span>Students with diverse learning needs and abilities</span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle className="mr-3 mt-1 h-5 w-5 text-green-500 flex-shrink-0" />
                                    <span>Adaptive programs seeking inclusive physical activities</span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle className="mr-3 mt-1 h-5 w-5 text-green-500 flex-shrink-0" />
                                    <span>Special education teachers and support staff</span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle className="mr-3 mt-1 h-5 w-5 text-green-500 flex-shrink-0" />
                                    <span>Students who benefit from structured, therapeutic movement</span>
                                </li>
                                <li className="flex items-start">
                                    <CheckCircle className="mr-3 mt-1 h-5 w-5 text-green-500 flex-shrink-0" />
                                    <span>Programs focused on social-emotional learning and self-regulation</span>
                                </li>
                            </ul>
                        </div>
                        <div className="bg-blue-600 dark:bg-blue-700 p-6 rounded-lg text-white">
                            <h3 className="text-xl font-semibold mb-4">Led by Sensei Negin</h3>
                            <p className="mb-4">
                                A 5th Dan Black Belt with 25 years of experience, M.S. in Sport Psychology, and specialized training in adaptive sports and inclusive teaching methods.
                            </p>
                            <p className="text-blue-100 mb-4">
                                Our instructor combines deep martial arts knowledge with psychological understanding to create meaningful, accessible experiences for students of all abilities.
                            </p>
                            <div className="bg-blue-500/20 p-4 rounded">
                                <p className="text-blue-100 text-sm">
                                    <strong>Special Focus:</strong> Trauma-informed teaching, sensory processing considerations, and individualized adaptation strategies.
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
                                Your program&apos;s familiar space - gymnasium, multipurpose room, or adapted classroom
                            </p>
                            
                            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
                                <Clock className="mr-2 h-5 w-5 text-blue-500" />
                                Flexible Schedule
                            </h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• {templateVars.frequency} (customizable to your program needs)</li>
                                <li>• {templateVars.duration} (adjustable based on group needs)</li>
                                <li>• {templateVars.sessions} per cycle</li>
                                <li>• Smaller group sizes for optimal support</li>
                            </ul>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-purple-800 dark:text-purple-200">
                                Available Start Dates:
                            </h3>
                            <div className="space-y-3">
                                <div className="bg-white dark:bg-gray-800 p-4 rounded border-l-4 border-purple-500">
                                    <h4 className="font-semibold text-purple-700 dark:text-purple-300">September Series</h4>
                                    <p className="text-gray-600 dark:text-gray-400">{templateVars.startDates.september}</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-4 rounded border-l-4 border-purple-500">
                                    <h4 className="font-semibold text-purple-700 dark:text-purple-300">February Series</h4>
                                    <p className="text-gray-600 dark:text-gray-400">{templateVars.startDates.february}</p>
                                </div>
                            </div>
                            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 italic">
                                Flexible scheduling available to accommodate your program&apos;s unique needs and student requirements.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Why Offer Adaptive Karate Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        💡 Why Offer Adaptive Karate in Your Program?
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-red-700 dark:text-red-300">For Students:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Builds self-confidence and body awareness</li>
                                <li>• Develops emotional regulation and focus</li>
                                <li>• Provides therapeutic movement and stress relief</li>
                                <li>• Enhances social skills in a supportive environment</li>
                                <li>• Celebrates individual progress and achievements</li>
                            </ul>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-blue-700 dark:text-blue-300">For Educators & Support Staff:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Provides structured physical activity option</li>
                                <li>• Supports therapeutic and educational goals</li>
                                <li>• Offers new tools for behavior management</li>
                                <li>• Creates positive group dynamics</li>
                                <li>• Enhances program diversity and inclusion</li>
                            </ul>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
                            <h3 className="text-xl font-semibold mb-4 text-green-700 dark:text-green-300">For the Program:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Demonstrates commitment to inclusive programming</li>
                                <li>• Provides evidence-based therapeutic intervention</li>
                                <li>• Enhances program reputation for innovation</li>
                                <li>• Creates opportunities for family engagement</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Therapeutic Benefits Section */}
                <div className="mb-12 page-card-styles bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                    <h2 className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-6 flex items-center">
                        🧠 Therapeutic Benefits of Adaptive Karate
                    </h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-blue-800 dark:text-blue-200">Physical Benefits:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Improved motor planning and coordination</li>
                                <li>• Enhanced proprioceptive awareness</li>
                                <li>• Increased strength and flexibility</li>
                                <li>• Better balance and spatial orientation</li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-purple-800 dark:text-purple-200">Cognitive & Emotional Benefits:</h3>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                                <li>• Enhanced focus and attention span</li>
                                <li>• Improved emotional regulation skills</li>
                                <li>• Increased self-esteem and confidence</li>
                                <li>• Better stress management and coping strategies</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Pricing Section */}
                <div className="mb-12 page-card-styles">
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-6 flex items-center">
                        💰 Pricing & Enrollment
                    </h2>
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 p-8 rounded-lg text-white text-center">
                        <h3 className="text-2xl font-bold mb-4">Adaptive Program Series Price:</h3>
                        <div className="text-4xl font-extrabold mb-6">{templateVars.price} for {templateVars.sessions} per student</div>
                        <div className="grid md:grid-cols-2 gap-6 text-left">
                            <div>
                                <h4 className="font-semibold mb-3 text-blue-100">✅ What&apos;s Included:</h4>
                                <ul className="space-y-2 text-blue-100">
                                    <li>• Adaptive materials and equipment</li>
                                    <li>• Specialized instructor training</li>
                                    <li>• Individualized progress tracking</li>
                                    <li>• Flexible scheduling options</li>
                                    <li>• Family/caregiver resources</li>
                                </ul>
                            </div>
                            <div className="bg-blue-500/20 p-4 rounded">
                                <h4 className="font-semibold mb-2 text-blue-100">Special Considerations:</h4>
                                <p className="text-blue-100 text-sm">
                                    Smaller group sizes, additional support staff coordination, and customized curriculum adaptations to meet individual student needs and program goals.
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
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-8 rounded-lg">
                        <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                            By bringing this adaptive program to your organization, we are creating an inclusive space
                            where every student can experience the transformative power of martial arts.
                            We believe that karate&apos;s principles of respect, perseverance,
                            and self-improvement are universal and can benefit students of all abilities
                            when presented in an accessible, supportive format.
                        </p>
                        <blockquote className="border-l-4 border-purple-500 pl-6 italic text-xl text-purple-700 dark:text-purple-300">
                            &ldquo;Every student has the potential to grow and succeed.
                            Adaptive karate creates pathways for that growth, honoring each individual&apos;s
                            unique journey while building strength, confidence, and joy.&rdquo;
                            <footer className="mt-2 text-base font-semibold">— Sensei Negin</footer>
                        </blockquote>
                    </div>
                </div>

                {/* Contact Section */}
                <div className="page-card-styles bg-gradient-to-r from-gray-900 to-gray-800 text-white">
                    <h2 className="text-3xl font-bold mb-8 text-center">Contact</h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xl font-semibold mb-4 text-blue-400">Valeriya Guseva</h3>
                            <p className="text-gray-300 mb-6">Academy Administrator</p>
                            <div className="space-y-3">
                                <div className="flex items-center">
                                    <Mail className="mr-3 h-5 w-5 text-blue-400" />
                                    <a href="mailto:info@greenegin.ca" className="hover:text-blue-400 transition-colors">
                                        info@greenegin.ca
                                    </a>
                                </div>
                                <div className="flex items-center">
                                    <Phone className="mr-3 h-5 w-5 text-blue-400" />
                                    <a href="tel:(604) 690-7121" className="hover:text-blue-400 transition-colors">
                                        (604) 690-7121
                                    </a>
                                </div>
                                <div className="flex items-center">
                                    <Globe className="mr-3 h-5 w-5 text-blue-400" />
                                    <a href="https://karate.greenegin.ca" className="hover:text-blue-400 transition-colors">
                                        karate.greenegin.ca
                                    </a>
                                </div>
                                <div className="flex items-start">
                                    <MapPin className="mr-3 mt-1 h-5 w-5 text-blue-400 flex-shrink-0" />
                                    <span>GREENEGIN KARATE, 650 Allandale Rd Suite A101, Victoria, BC V9C 0S2</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-semibold mb-6 text-blue-400">Ready to Create Inclusive Excellence?</h3>
                            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                                <Link to="/contact?program=adaptive">Discuss Adaptive Program</Link>
                            </Button>
                            <p className="mt-4 text-sm text-gray-400">
                                Contact us to discuss adaptive modifications and specialized support for your program.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}