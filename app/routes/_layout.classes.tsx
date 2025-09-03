import { Link, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { json, type LoaderFunctionArgs, type MetaFunction, type MetaArgs, type MetaDescriptor } from "@remix-run/node";
import { siteConfig } from "~/config/site";
import { getPrograms } from "~/services/program.server";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import type { Program } from "~/types/multi-class";
import { mergeMeta } from "~/utils/meta";

type ClassWithSchedule = {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    program: {
        name: string;
        description: string | null;
        min_age: number | null;
        max_age: number | null;
        duration_minutes: number | null;
        max_capacity: number | null;
        monthly_fee: number | null;
        yearly_fee: number | null;
    } | null;
    schedules: Array<{
        day_of_week: string;
        start_time: string;
    }>;
};

type LoaderData = {
    programs: Program[];
    classes: ClassWithSchedule[];
};

export const meta: MetaFunction = (args: MetaArgs) => {
    // Find the parent 'root' route match
    const parentMatch = args.matches.find((match) => match.id === "root");
    // Get the already computed meta tags from the parent route match
    const parentMeta = parentMatch?.meta || [];

    // Get loader data for classes
    const loaderData = args.data as { programs: Program[], classes: ClassWithSchedule[] } | undefined;
    const classes = loaderData?.classes || [];

    // Define meta tags specific to this Classes page
    const classesPageTitle = "Karate Classes - Programs & Schedules";
    const classesPageDescription = `Explore our comprehensive karate programs at ${siteConfig.location.address}. Classes for children ages ${siteConfig.classes.ageRange} with experienced instructors. ${siteConfig.pricing.freeTrial} available!`;

    const classesMeta: MetaDescriptor[] = [
        { title: classesPageTitle },
        { name: "description", content: classesPageDescription },
        { name: "keywords", content: "karate, martial arts, classes, children, adults, self-defense, fitness" },
        // Override specific OG tags for the classes page
        { property: "og:title", content: classesPageTitle },
        { property: "og:description", content: classesPageDescription },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${siteConfig.url}/classes` },
        // Override canonical link for the classes page
        { tagName: "link", rel: "canonical", href: `${siteConfig.url}/classes` },
    ];

    // Remove script:ld+json; we'll render JSON-LD scripts in the component with nonce

    // Merge parent defaults with specific tags for this page
    return mergeMeta(parentMeta, classesMeta);
};

export async function loader({ request }: LoaderFunctionArgs) {
    try {
        const supabase = getSupabaseAdminClient();

        // Get active programs for public display
        const programs = await getPrograms({ is_active: true }, supabase);

        // Get active classes with their schedules
        const { data: classesData, error } = await supabase
            .from('classes')
            .select(`
        id,
        name,
        description,
        is_active,
        program:programs!inner(
          name,
          description,
          min_age,
          max_age,
          duration_minutes,
          max_capacity,
          monthly_fee,
          yearly_fee
        )
      `)
            .eq('is_active', true)
            .order('name');

        // Get schedules separately to avoid foreign key issues
        let schedulesData: Array<{ class_id: string; day_of_week: string; start_time: string }> = [];
        if (classesData && classesData.length > 0) {
            const classIds = classesData.map(c => c.id);
            const { data: schedules } = await supabase
                .from('class_schedules')
                .select('class_id, day_of_week, start_time')
                .in('class_id', classIds);
            schedulesData = schedules || [];
        }

        if (error) {
            console.error('Error fetching classes:', error);
        }

        // Transform the data to match our expected type
        const classes: ClassWithSchedule[] = (classesData || []).map(classItem => {
            // Find schedules for this class
            const classSchedules = schedulesData.filter(schedule => schedule.class_id === classItem.id);
            
            return {
                id: classItem.id,
                name: classItem.name,
                description: classItem.description,
                is_active: classItem.is_active,
                program: Array.isArray(classItem.program) ? classItem.program[0] || null : classItem.program,
                schedules: classSchedules.map(schedule => ({
                    day_of_week: schedule.day_of_week,
                    start_time: schedule.start_time
                }))
            };
        });

        return json<LoaderData>(
            { programs, classes },
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
        console.error('Error loading classes and programs:', error);
        return json<LoaderData>(
            { programs: [], classes: [] },
            {
                headers: {
                    // Don't cache error responses
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            }
        );
    }
}

export default function ClassesPage() {
    const { programs, classes } = useLoaderData<typeof loader>();
    const rootData = useRouteLoaderData('root') as { nonce?: string } | undefined;
    const nonce = rootData?.nonce;

    // Helper function to format day names
    const formatDayName = (day: string) => {
        const dayMap: Record<string, string> = {
            'monday': 'Monday',
            'tuesday': 'Tuesday',
            'wednesday': 'Wednesday',
            'thursday': 'Thursday',
            'friday': 'Friday',
            'saturday': 'Saturday',
            'sunday': 'Sunday'
        };
        return dayMap[day.toLowerCase()] || day;
    };

    // Helper to format time for schema (HH:MM)
    const formatTimeForSchema = (time: string) => {
        const parts = time.split(':');
        return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : time;
    };

    // Helper function to format time
    const formatTime = (time: string) => {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    // Get age range from programs or classes
    const getAgeRange = () => {
        if (programs.length > 0) {
            const ages = programs
                .filter(p => p.min_age && p.max_age)
                .map(p => ({ min: p.min_age!, max: p.max_age! }));

            if (ages.length > 0) {
                const minAge = Math.min(...ages.map(a => a.min));
                const maxAge = Math.max(...ages.map(a => a.max));
                return `${minAge}-${maxAge}`;
            }
        }
        return siteConfig.classes.ageRange; // Fallback to static config
    };

    // Get pricing information from programs
    const getPricingTiers = () => {
        const tiers = [];

        // Free trial (always available)
        tiers.push({ label: "Free Trial", description: "Your first class is on us!" });

        // Monthly pricing from programs
        const monthlyPrograms = programs.filter(p => p.monthly_fee && p.monthly_fee > 0);
        if (monthlyPrograms.length > 0) {
            const monthlyFees = monthlyPrograms.map(p => p.monthly_fee!);
            const minMonthly = Math.min(...monthlyFees);
            const maxMonthly = Math.max(...monthlyFees);

            if (minMonthly === maxMonthly) {
                tiers.push({ label: "Monthly", description: `$${minMonthly} - Ongoing` });
            } else {
                tiers.push({ label: "Monthly", description: `$${minMonthly}-$${maxMonthly} - Ongoing` });
            }
        }

        // Yearly pricing from programs
        const yearlyPrograms = programs.filter(p => p.yearly_fee && p.yearly_fee > 0);
        if (yearlyPrograms.length > 0) {
            const yearlyFees = yearlyPrograms.map(p => p.yearly_fee!);
            const minYearly = Math.min(...yearlyFees);
            const maxYearly = Math.max(...yearlyFees);

            if (minYearly === maxYearly) {
                tiers.push({ label: "Yearly", description: `$${minYearly} - Best value` });
            } else {
                tiers.push({ label: "Yearly", description: `$${minYearly}-$${maxYearly} - Best value` });
            }
        }

        return tiers;
    };

    // Build JSON-LD for classes list
    const classesStructuredData = classes && classes.length > 0 ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Karate Classes",
        "description": `Programs and classes offered by ${siteConfig.name}`,
        "itemListElement": classes.map((c, index) => {
            const offers: any[] = [];
            const monthly = c.program?.monthly_fee;
            const yearly = c.program?.yearly_fee;
            if (monthly && monthly > 0) {
                offers.push({
                    "@type": "Offer",
                    "price": monthly,
                    "priceCurrency": siteConfig.localization.currency,
                    "category": "Monthly",
                });
            }
            if (yearly && yearly > 0) {
                offers.push({
                    "@type": "Offer",
                    "price": yearly,
                    "priceCurrency": siteConfig.localization.currency,
                    "category": "Yearly",
                });
            }

            return {
                "@type": "Course",
                "position": index + 1,
                "name": c.name,
                "description": c.description || undefined,
                "provider": {
                    "@type": "Organization",
                    "name": siteConfig.name,
                    "url": siteConfig.url,
                },
                "audience": c.program?.min_age && c.program?.max_age ? {
                    "@type": "EducationalAudience",
                    "audienceType": `Ages ${c.program.min_age}-${c.program.max_age}`,
                } : undefined,
                "timeRequired": c.program?.duration_minutes ? `PT${c.program.duration_minutes}M` : undefined,
                "hasCourseInstance": (c.schedules || []).map(s => ({
                    "@type": "CourseInstance",
                    "courseMode": "InPerson",
                    "courseSchedule": {
                        "@type": "Schedule",
                        "byDay": [formatDayName(s.day_of_week)],
                        "startTime": formatTimeForSchema(s.start_time),
                    }
                })),
                "offers": offers.length > 0 ? offers : undefined,
            };
        }),
    } : null;

    return (
        <div className="min-h-screen page-background-styles py-12">
            {nonce && classesStructuredData && (
                <script
                    type="application/ld+json"
                    nonce={nonce}
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(classesStructuredData) }}
                />
            )}
            {/* Hero Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center">
                    <h1 className="page-header-styles">
                        Karate Programs
                    </h1>
                    <p className="page-subheader-styles">
                        Choose from our diverse range of karate programs designed for all ages and skill levels
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                {/* Programs Section */}
                {programs.length > 0 && programs.some(program =>
                    (program.monthly_fee && program.monthly_fee > 0) ||
                    (program.yearly_fee && program.yearly_fee > 0)
                ) && (
                    <section className="mb-20">

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {programs
                                .filter(program =>
                                    (program.monthly_fee && program.monthly_fee > 0) ||
                                    (program.yearly_fee && program.yearly_fee > 0)
                                )
                                .map((program) => (
                                    <div
                                        key={program.id}
                                        className="page-card-styles"
                                    >
                                        <div className="mb-6">
                                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                                {program.name}
                                            </h3>
                                            {program.description && (
                                                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                                                    {program.description}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            {program.min_age && program.max_age && (
                                                <div className="flex items-center text-gray-700 dark:text-gray-300">
                                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                                                    <span className="font-medium">Age Range:</span>
                                                    <span className="ml-2 text-gray-900 dark:text-white">{program.min_age}-{program.max_age} years</span>
                                                </div>
                                            )}

                                            {program.monthly_fee && (
                                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-gray-700 dark:text-gray-300 font-medium">Monthly:</span>
                                                        <span className="text-green-600 dark:text-green-400 font-bold text-lg">${program.monthly_fee}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {program.yearly_fee && (
                                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-gray-700 dark:text-gray-300 font-medium">Yearly:</span>
                                                        <span className="text-green-600 dark:text-green-400 font-bold text-lg">${program.yearly_fee}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {program.individual_session_fee && (
                                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-gray-700 dark:text-gray-300 font-medium">Per Session:</span>
                                                        <span className="text-green-600 dark:text-green-400 font-bold text-lg">${program.individual_session_fee}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </section>
                )}

                {/* Class Schedule Section */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            Class Schedule
                        </h2>
                        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                            Find the perfect time to join our karate classes
                        </p>
                    </div>

                    <div className="page-card-styles">
                        {(() => {
                            // Filter classes to only show those with programs that have:
                            // 1. max_capacity > 1 (group classes, not 1:1)
                            // 2. At least one of monthly_fee or yearly_fee defined and > 0
                            const filteredClasses = classes.filter(classItem => {
                                if (!classItem.program) return false;
                                
                                const hasGroupCapacity = !classItem.program.max_capacity || classItem.program.max_capacity > 1;
                                const hasMonthlyOrYearlyFee = 
                                    (classItem.program.monthly_fee && classItem.program.monthly_fee > 0) ||
                                    (classItem.program.yearly_fee && classItem.program.yearly_fee > 0);
                                
                                return hasGroupCapacity && hasMonthlyOrYearlyFee;
                            });
                            
                            return filteredClasses.length > 0 ? (
                                <div className="space-y-8">
                                    {filteredClasses.map((classItem) => (
                                        <div
                                            key={classItem.id}
                                            className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 pb-8 last:pb-0"
                                        >
                                            <div className="mb-6">
                                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                                    {classItem.name}
                                                </h3>
                                                {classItem.program && (
                                                    <div className="inline-flex items-center bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-sm font-medium mb-3">
                                                        {classItem.program.name}
                                                        {classItem.program.min_age && classItem.program.max_age && (
                                                            <span className="ml-2 text-green-600 dark:text-green-300">
                                                                (Ages {classItem.program.min_age}-{classItem.program.max_age})
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {classItem.description && (
                                                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                                                        {classItem.description}
                                                    </p>
                                                )}
                                            </div>

                                            {classItem.schedules.length > 0 && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {classItem.schedules.map((schedule, index) => (
                                                        <div
                                                            key={index}
                                                            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                                                                    {formatDayName(schedule.day_of_week)}
                                                                </span>
                                                                <span className="text-gray-900 dark:text-white font-medium">
                                                                    {formatTime(schedule.start_time)}
                                                                </span>
                                                            </div>
                                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                                at {siteConfig.location.address}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                        ) : (
                            <div className="text-center py-8">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                                    Children&apos;s Classes (Ages {getAgeRange()})
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-green-600 dark:text-green-400 font-bold text-lg">Tuesday</span>
                                            <span className="text-gray-900 dark:text-white font-medium">{siteConfig.classes.timeLong}</span>
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">at {siteConfig.location.address}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-green-600 dark:text-green-400 font-bold text-lg">Thursday</span>
                                            <span className="text-gray-900 dark:text-white font-medium">{siteConfig.classes.timeLong}</span>
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">at {siteConfig.location.address}</div>
                                    </div>
                                </div>
                            </div>
                        );
                        })()}
                    </div>
                </section>

                {/* What to Expect Section */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            What to Expect
                        </h2>
                        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                            Your child&apos;s journey in martial arts
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="page-card-styles">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                <span className="text-2xl">🥋</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                Traditional Techniques
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                                Learn authentic karate forms, stances, and techniques passed down through generations.
                            </p>
                        </div>

                        <div className="page-card-styles">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                <span className="text-2xl">💪</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                Physical Fitness
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                                Build strength, flexibility, and coordination through structured training exercises.
                            </p>
                        </div>

                        <div className="page-card-styles">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                <span className="text-2xl">🧠</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                Mental Discipline
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                                Develop focus, self-control, and confidence through mindful practice.
                            </p>
                        </div>

                        <div className="page-card-styles">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                <span className="text-2xl">🤝</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                Respect & Values
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                                Learn the importance of respect, humility, and perseverance in all aspects of life.
                            </p>
                        </div>

                        <div className="page-card-styles">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                <span className="text-2xl">🎯</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                Goal Setting
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                                Work towards belt promotions and personal achievements with clear milestones.
                            </p>
                        </div>

                        <div className="page-card-styles">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                <span className="text-2xl">👥</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                Community
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                                Join a supportive community of students and families sharing the martial arts journey.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            Tuition & Pricing
                        </h2>
                    </div>
                    <div className="page-card-styles">
                        <div className="space-y-4 mb-8">
                            {getPricingTiers().map((tier) => (
                                <div key={tier.label} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                    <span className="font-semibold text-gray-900 dark:text-white">{tier.label}</span>
                                    <span className="text-lg font-bold text-green-600 dark:text-green-400">{tier.description || "Free"}</span>
                                </div>
                            ))}
                        </div>

                        {/* Special pricing highlight for new students */}
                        <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-500/20 dark:to-green-600/20 border border-green-200 dark:border-green-500/30 rounded-lg p-6">
                            <h3 className="text-xl font-bold text-green-700 dark:text-green-400 mb-4">🎉 New Student Benefits</h3>
                            <ul className="space-y-2 text-green-700 dark:text-green-300">
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full mr-3 mt-2"></span>
                                    <strong>Free trial class</strong> - Try before you commit!
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full mr-3 mt-2"></span>
                                    <strong>Automatic discounts</strong> for new students
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full mr-3 mt-2"></span>
                                    <strong>No long-term contracts</strong> - Pay monthly
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full mr-3 mt-2"></span>
                                    <strong>Family discounts</strong> available for multiple children
                                </li>
                            </ul>
                        </div>

                        <div className="mt-6">
                            <p className="text-gray-600 dark:text-gray-400 text-center">
                                Start with a free trial class, then enjoy special introductory pricing automatically applied for new students.
                                Regular monthly tuition is {siteConfig.pricing.currency}{siteConfig.pricing.monthly}/month per student.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Belt Progression Section */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            Belt Progression
                        </h2>
                        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                            Students progress through a traditional belt system that recognizes their growing skills and knowledge.
                            Regular testing opportunities allow students to demonstrate their abilities and advance to the next level.
                        </p>
                    </div>
                    <div className="page-card-styles">
                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-4">
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center border border-gray-200 dark:border-gray-600 rounded-lg">
                                <div className="h-4 bg-white border border-gray-300 rounded mb-3"></div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">White</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center border border-gray-200 dark:border-gray-600 rounded-lg">
                                <div className="h-4 bg-yellow-400 rounded mb-3"></div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">Yellow</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center border border-gray-200 dark:border-gray-600 rounded-lg">
                                <div className="h-4 bg-orange-400 rounded mb-3"></div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">Orange</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center border border-gray-200 dark:border-gray-600 rounded-lg">
                                <div className="h-4 bg-green-500 rounded mb-3"></div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">Green</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center border border-gray-200 dark:border-gray-600 rounded-lg">
                                <div className="h-4 bg-blue-500 rounded mb-3"></div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">Blue</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center border border-gray-200 dark:border-gray-600 rounded-lg">
                                <div className="h-4 bg-purple-500 rounded mb-3"></div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">Purple</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center border border-gray-200 dark:border-gray-600 rounded-lg">
                                <div className="h-4 bg-red-600 rounded mb-3"></div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">Red</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center border border-gray-200 dark:border-gray-600 rounded-lg">
                                <div className="h-4 bg-yellow-800 rounded mb-3"></div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">Brown</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center border border-gray-200 dark:border-gray-600 rounded-lg">
                                <div className="h-4 bg-black rounded mb-3"></div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">Black</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Call to Action Section */}
                <section>
                    <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-500/20 dark:to-green-600/20 rounded-2xl p-8 text-center border border-green-200 dark:border-green-500/30">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Ready to Begin Your Journey?</h2>
                        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-3xl mx-auto">
                            Join our karate family and discover the benefits of traditional martial arts training.
                            Start with a free trial class and see if our program is right for your child.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                to="/contact"
                                className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-center transition-colors duration-200"
                            >
                                Schedule Free Trial
                            </Link>
                            <Link
                                to="/contact"
                                className="inline-block bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-green-600 dark:text-green-400 border-2 border-green-600 dark:border-green-400 font-bold py-3 px-8 rounded-lg text-center transition-colors duration-200"
                            >
                                Ask Questions
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
