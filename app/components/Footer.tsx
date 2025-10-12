import { Link } from "@remix-run/react";
import type { Session } from "@supabase/auth-helpers-remix";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { getScheduleData, getContactData, getBusinessData } from "~/utils/site-data.client";
import { siteConfig } from "~/config/site";
import { DEFAULT_SCHEDULE, getDefaultAgeRangeLabel } from "~/constants/schedule";
import { MapPin, Phone, Mail, Clock } from 'lucide-react'; // Import icons
import { useEffect, useState } from "react";

export default function Footer({ user }: { user?: Session['user'] | null }) {
    // Use fallback data initially for SSR
    const [scheduleData, setScheduleData] = useState({
        days: DEFAULT_SCHEDULE.days,
        times: DEFAULT_SCHEDULE.timeRange,
        ageRange: getDefaultAgeRangeLabel(),
    });
    const [contactData, setContactData] = useState({
        phone: siteConfig.contact.phone,
        email: siteConfig.contact.email,
        address: siteConfig.location.address,
        locality: siteConfig.location.locality,
        region: siteConfig.location.region,
        postalCode: siteConfig.location.postalCode,
    });
    const [businessData, setBusinessData] = useState({
        name: siteConfig.name,
        description: siteConfig.description,
        url: siteConfig.url,
        socials: {
            facebook: siteConfig.socials.facebook || '',
            instagram: siteConfig.socials.instagram || '',
        },
    });

    // Load client data after hydration, but only if cache is available
    useEffect(() => {
        // Small delay to ensure setSiteData has been called from _layout.tsx
        const timer = setTimeout(() => {
            try {
                setScheduleData(getScheduleData());
                setContactData(getContactData());
                const businessInfo = getBusinessData();
                setBusinessData({
                    name: businessInfo.name,
                    description: businessInfo.description,
                    url: businessInfo.url,
                    socials: {
                        facebook: businessInfo.socials.facebook || '',
                        instagram: businessInfo.socials.instagram || '',
                    },
                });
            } catch (error) {
                // Keep fallback data if there's an error
                console.warn('Failed to load client site data:', error);
            }
        }, 100); // Small delay to allow cache to be populated

        return () => clearTimeout(timer);
    }, []);

    // Define base links
    const baseLinks = [
        {path: "/", label: "Home"},
        {path: "/about", label: "About"},
        {path: "/classes", label: "Classes"},
        {path: "/contact", label: "Contact"},
    ];

    // Conditionally add/remove links based on user state
    const quickLinks = [...baseLinks];
    if (!user) {
        // Add Register for logged-out users
        quickLinks.push({path: "/register", label: "Register"});
    }

    return (
        <footer className="bg-green-600 text-white dark:bg-gray-800">
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {/* Main Grid: 1 col mobile, 3 cols md+ */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Social Links Section (Column 1) */}
                    {/* Align content: center mobile, left md+ */}
                    <div className="space-y-3 text-center md:text-left">
                        <Button variant="ghost" className="text-lg font-semibold p-0 text-white">
                            KARATE GREENEGIN
                        </Button>
                        <p className="text-green-100 dark:text-gray-300 text-sm">
                            Discover the art of the &ldquo;empty hand&rdquo;
                            with Sensei Negin&apos;s karate classes for children ages <span>{scheduleData.ageRange}</span>.
                        </p>
                        {/* Justify icons: center mobile, start md+ */}
                        <div className="flex items-center justify-center md:justify-start gap-2">
                            <span className="text-sm text-green-100 dark:text-gray-300">Follow Us:</span>
                            <Button variant="secondary" size="icon" asChild
                                    className="bg-[#E1306C] hover:bg-[#C1355B] text-white">
                                <a href={businessData.socials.instagram} target="_blank" rel="noopener noreferrer">
                                    <span className="sr-only">Instagram</span>
                                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        {/* Instagram Icon SVG Path */}
                                        <path fillRule="evenodd"
                                              d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                                              clipRule="evenodd"/>
                                    </svg>
                                </a>
                            </Button>
                            {/* Facebook Button */}
                            <Button variant="secondary" size="icon" asChild
                                    className="bg-[#1877F2] hover:bg-[#166FE5] text-white">
                                <a href={businessData.socials.facebook} target="_blank" rel="noopener noreferrer">
                                    <span className="sr-only">Facebook</span>
                                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        {/* Facebook Icon SVG Path */}
                                        <path fillRule="evenodd"
                                              d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                                              clipRule="evenodd"/>
                                    </svg>
                                </a>
                            </Button>
                        </div>
                    </div>

                    {/* Wrapper for Quick Links & Contact Info */}
                    {/* Spans 1 col mobile (as part of parent's col-1), spans 2 cols md+ */}
                    {/* Internal Grid: 2 cols always (mobile and md+) */}
                    <div className="grid grid-cols-2 gap-6 md:col-span-2 md:grid-cols-2">

                        {/* Quick Links Column (Col 1 of 2 mobile, Col 1 of 2 in md+) */}
                        <div className="text-left"> {/* Align text left */}
                            <Button variant="ghost" className="text-lg font-semibold p-0 text-white">
                                Quick Links
                            </Button>
                            {/* Links List: Align items start. Add margin top and consistent spacing (space-y-2). */}
                            <div className="mt-3 space-y-2 flex flex-col items-start"> {/* Align items start, added space-y-2 */}
                                {quickLinks.map((linkItem) => (
                                    <Button
                                        key={linkItem.path}
                                    asChild
                                    variant="link"
                                    // Justify button content: start. Remove default button padding/height for tighter spacing.
                                    className="text-green-100 justify-start hover:text-white p-0 h-auto text-sm" /* Justify start, removed padding/height, ensure text-sm */
                                >
                                    <Link to={linkItem.path} className="py-0"> {/* Adjust link padding if needed, py-0 ensures minimal vertical space */}
                                        {linkItem.label}
                                    </Link>
                                </Button>
                            ))}
                            </div> {/* Closes Links List div */}
                        </div> {/* Closes Quick Links Alignment container */}

                        {/* Contact Info Column (Col 2 of 2 mobile, Col 2 of 2 in md+) */}
                        <div className="text-right pr-4"> {/* Align text right, add padding right */}
                            <Button variant="ghost" className="text-lg font-semibold p-0 text-white">
                                Contact Us
                            </Button>
                            {/* Contact List: Align items end. Add margin top. Apply text-sm */}
                            <div className="mt-3 space-y-2 text-sm text-green-100 dark:text-gray-300 flex flex-col items-end"> {/* Align items end, added text-sm */}
                                {/* Address */}
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactData.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start justify-end text-right hover:text-white transition-colors" /* Use items-start for multi-line */
                                >
                                    <span className="flex-grow hover:underline">{contactData.address}</span>
                                    <MapPin className="ml-2 mt-1 h-5 w-5 flex-shrink-0 text-green-100" aria-hidden="true" />
                                </a>
                                {/* Phone */}
                                <a href={`tel:${contactData.phone.replace(/\D/g, '')}`} className="flex items-center justify-end hover:text-white transition-colors">
                                    <span>{contactData.phone}</span>
                                    <Phone className="ml-2 h-5 w-5 flex-shrink-0 text-green-100" aria-hidden="true" />
                                </a>
                                {/* Email */}
                                <a href={`mailto:${contactData.email}`} className="flex items-center justify-end hover:text-white transition-colors">
                                    <span>{contactData.email}</span>
                                    <Mail className="ml-2 h-5 w-5 flex-shrink-0 text-green-100" aria-hidden="true" />
                                </a>
                                {/* Class Time */}
                                <div className="flex items-center justify-end">
                                    <span>Multiple Training Sessions Each Week</span>
                                    <Clock className="ml-2 h-5 w-5 flex-shrink-0 text-green-100" aria-hidden="true" />
                                </div>
                            </div> {/* Closes Contact List div */}
                        </div> {/* Closes Contact Info Alignment container */}
                    </div> {/* Closes the 2-column wrapper grid */}

                <Separator className="bg-green-700 dark:bg-gray-700"/>

                {/* Territory Acknowledgement Section */}
{/*                <div className="mt-6 mb-6 text-center">
                    <h3 className="text-lg font-semibold text-green-100 dark:text-gray-300 mb-3">
                        {siteConfig.territoryAcknowledgement.title}
                    </h3>
                    <p className="text-green-200 dark:text-gray-400 text-sm leading-relaxed px-4 md:px-12">
                        {siteConfig.territoryAcknowledgement.text}
                    </p>
                </div>

                <Separator className="bg-green-700 dark:bg-gray-700"/>*/}

                <div className="text-center text-green-200 dark:text-gray-400 text-sm mt-6">
                    <Button variant="link" className="text-green-200">
                        <Link to="https://www.ponto.studio/">&copy; {new Date().getFullYear()}
                            Ponto Studio. All rights reserved.
                        </Link>
                    </Button>
                </div>
            </div> {/* This closes the main grid div */}
            </div> {/* This closes the max-w-7xl div */}
        </footer>
    );
}
