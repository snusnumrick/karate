import { Link, useLoaderData } from "@remix-run/react";
import { json, type LoaderFunctionArgs, type MetaFunction, type MetaArgs, type MetaDescriptor } from "@remix-run/node";
import { siteConfig } from "~/config/site";
import { getPrograms } from "~/services/program.server";
import { createClient } from "~/utils/supabase.server";
import type { Program } from "~/types/multi-class";

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

// Helper function to merge meta tags from parent and child routes
const mergeMeta = (parentMeta: MetaDescriptor[], childMeta: MetaDescriptor[]): MetaDescriptor[] => {
    const merged: Record<string, MetaDescriptor> = {};
    const getKey = (tag: MetaDescriptor): string | null => {
        if ('title' in tag && tag.title) return 'title';
        if ('name' in tag && tag.name) return `name:${tag.name}`;
        if ('property' in tag && tag.property) return `property:${tag.property}`;
        if ('tagName' in tag && 'rel' in tag && tag.tagName && tag.rel) return `${tag.tagName}:${tag.rel}`;
        if ('script:ld+json' in tag && tag['script:ld+json']) return `script:ld+json:${Date.now()}:${Math.random()}`;
        try { return JSON.stringify(tag); } catch { return null; }
    };
    parentMeta.forEach(tag => { const key = getKey(tag); if (key) merged[key] = tag; });
    childMeta.forEach(tag => { const key = getKey(tag); if (key) merged[key] = tag; });
    return Object.values(merged);
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

    // Add Course structured data for each active class (only if data is available and stable)
    if (classes && classes.length > 0) {
        try {
            const courseStructuredDataArray = classes
                .filter(classItem => classItem && classItem.id && classItem.name) // Ensure required fields exist
                .map((classItem, index) => {
                    const scheduleData = (classItem.schedules || [])
                        .filter(schedule => schedule && schedule.day_of_week && schedule.start_time)
                        .map((schedule) => ({
                            "@type": "Schedule",
                            "byDay": schedule.day_of_week.toUpperCase().slice(0, 2),
                            "startTime": schedule.start_time,
                            "endTime": "18:00"
                        }));

                    // Use index-based course code to avoid ID-based hydration issues
                    const courseCode = `KARATE-${(index + 1).toString().padStart(3, '0')}`;

                    return {
                        "@context": "https://schema.org",
                        "@type": "Course",
                        "name": classItem.name,
                        "description": classItem.description || "Traditional karate training focusing on technique, discipline, and personal development.",
                        "provider": {
                            "@type": "Organization",
                            "name": siteConfig.name,
                            "url": siteConfig.url,
                            "address": {
                                "@type": "PostalAddress",
                                "streetAddress": siteConfig.location.address,
                                "addressLocality": siteConfig.location.locality,
                                "addressRegion": siteConfig.location.region,
                                "postalCode": siteConfig.location.postalCode,
                                "addressCountry": siteConfig.location.country
                            },
                            "telephone": siteConfig.contact.phone,
                            "email": siteConfig.contact.email
                        },
                        "courseCode": courseCode,
                        "educationalLevel": classItem.program?.name || "All Levels",
                        "teaches": [
                            "Karate techniques",
                            "Self-defense",
                            "Discipline and respect",
                            "Physical fitness",
                            "Mental focus"
                        ],
                        "timeRequired": "P3M",
                        "courseSchedule": scheduleData,
                        "offers": {
                            "@type": "Offer",
                            "price": siteConfig.pricing.monthly.toString(),
                            "priceCurrency": siteConfig.localization.currency,
                            "category": "Monthly"
                        },
                        "audience": {
                            "@type": "EducationalAudience",
                            "educationalRole": "student",
                            "audienceType": classItem.program?.min_age && classItem.program?.max_age 
                                ? `Ages ${classItem.program.min_age}-${classItem.program.max_age}`
                                : "Children and Adults"
                        }
                    };
                });

            // Add each course as structured data
            courseStructuredDataArray.forEach((courseData) => {
                classesMeta.push({
                    "script:ld+json": courseData
                });
            });
        } catch (error) {
            console.warn('Error generating course structured data:', error);
            // Continue without structured data to prevent hydration errors
        }
    }

    // Merge parent defaults with specific tags for this page
    return mergeMeta(parentMeta, classesMeta);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function loader(_: LoaderFunctionArgs) {
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
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
          max_age
        ),
        schedules:class_schedules(
          day_of_week,
          start_time
        )
      `)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching classes:', error);
    }

    // Transform the data to match our expected type
    const classes: ClassWithSchedule[] = (classesData || []).map(classItem => ({
      id: classItem.id,
      name: classItem.name,
      description: classItem.description,
      is_active: classItem.is_active,
      program: Array.isArray(classItem.program) ? classItem.program[0] || null : classItem.program,
      schedules: classItem.schedules || []
    }));

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
        tiers.push({ label: "Yearly Membership", description: `$${minYearly} - Paid Annually` });
      } else {
        tiers.push({ label: "Yearly Membership", description: `$${minYearly}-$${maxYearly} - Paid Annually` });
      }
    }
    
    // Individual session pricing - only for 1:1 programs (max_capacity = 1)
    const sessionPrograms = programs.filter(p => 
      p.individual_session_fee && 
      p.individual_session_fee > 0 && 
      p.max_capacity === 1
    );
    if (sessionPrograms.length > 0) {
      const sessionFees = sessionPrograms.map(p => p.individual_session_fee!);
      const minSession = Math.min(...sessionFees);
      const maxSession = Math.max(...sessionFees);
      
      if (minSession === maxSession) {
        tiers.push({ label: "1:1 Session", description: `$${minSession} - Per Session` });
      } else {
        tiers.push({ label: "1:1 Session", description: `$${minSession}-$${maxSession} - Per Session` });
      }
    }
    
    // Fallback to static config if no programs found
    if (tiers.length === 1) {
      return siteConfig.pricing.tiers;
    }
    
    return tiers;
  };
    return (
        <div className="page-background-styles py-12" suppressHydrationWarning>
            {/* Hero Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold page-header-styles sm:text-4xl">
                        Karate Classes
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-xl page-subheader-styles sm:mt-4">
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
                                    className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 hover:border-green-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/10"
                                >
                                    <div className="mb-6">
                                        <h3 className="text-2xl font-bold text-white mb-3">
                                            {program.name}
                                        </h3>
                                        {program.description && (
                                            <p className="text-slate-400 leading-relaxed">
                                                {program.description}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        {program.min_age && program.max_age && (
                                            <div className="flex items-center text-slate-300">
                                                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                                                <span className="font-medium">Age Range:</span>
                                                <span className="ml-2 text-white">{program.min_age}-{program.max_age} years</span>
                                            </div>
                                        )}

                                        {program.monthly_fee && (
                                            <div className="bg-slate-700/50 rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-slate-300 font-medium">Monthly:</span>
                                                    <span className="text-green-400 font-bold text-lg">${program.monthly_fee}</span>
                                                </div>
                                            </div>
                                        )}

                                        {program.yearly_fee && (
                                            <div className="bg-slate-700/50 rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-slate-300 font-medium">Yearly:</span>
                                                    <span className="text-green-400 font-bold text-lg">${program.yearly_fee}</span>
                                                </div>
                                            </div>
                                        )}

                                        {program.individual_session_fee && (
                                            <div className="bg-slate-700/50 rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-slate-300 font-medium">Per Session:</span>
                                                    <span className="text-green-400 font-bold text-lg">${program.individual_session_fee}</span>
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
                        <h2 className="header-2-styles">
                            Class Schedule
                        </h2>
                        <p className="text-lg page-subheader-styles max-w-2xl mx-auto">
                            Find the perfect time to join our karate classes
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                        {classes.length > 0 ? (
                            <div className="space-y-8">
                                {classes.map((classItem) => (
                                    <div
                                        key={classItem.id}
                                        className="border-b border-slate-700 last:border-b-0 pb-8 last:pb-0"
                                    >
                                        <div className="mb-6">
                                            <h3 className="text-2xl font-bold text-white mb-2">
                                                {classItem.name}
                                            </h3>
                                            {classItem.program && (
                                                <div className="inline-flex items-center bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium mb-3">
                                                    {classItem.program.name}
                                                    {classItem.program.min_age && classItem.program.max_age && (
                                                        <span className="ml-2 text-green-300">
                                                            (Ages {classItem.program.min_age}-{classItem.program.max_age})
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {classItem.description && (
                                                <p className="text-slate-400 leading-relaxed">
                                                    {classItem.description}
                                                </p>
                                            )}
                                        </div>

                                        {classItem.schedules.length > 0 && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {classItem.schedules.map((schedule, index) => (
                                                    <div
                                                        key={index}
                                                        className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-green-400 font-bold text-lg">
                                                                {formatDayName(schedule.day_of_week)}
                                                            </span>
                                                            <span className="text-white font-medium">
                                                                {formatTime(schedule.start_time)}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-slate-400">
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
                                <h3 className="text-2xl font-bold text-white mb-4">
                                    Children&apos;s Classes (Ages {getAgeRange()})
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-green-400 font-bold text-lg">Tuesday</span>
                                            <span className="text-white font-medium">{siteConfig.classes.timeLong}</span>
                                        </div>
                                        <div className="text-sm text-slate-400">at {siteConfig.location.address}</div>
                                    </div>
                                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-green-400 font-bold text-lg">Friday</span>
                                            <span className="text-white font-medium">{siteConfig.classes.timeLong}</span>
                                        </div>
                                        <div className="text-sm text-slate-400">at {siteConfig.location.address}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* What to Expect Section */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <h2 className="header-2-styles">
                            What to Expect
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                            <h3 className="text-2xl font-bold text-white mb-6">Class Structure</h3>
                            <ul className="space-y-3 text-slate-300">
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></span>
                                    Warm-up exercises and stretching
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></span>
                                    Basic techniques (kihon) practice
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></span>
                                    Forms (kata) training
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></span>
                                    Partner drills and applications
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></span>
                                    Games and activities to reinforce skills
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></span>
                                    Cool-down and meditation
                                </li>
                            </ul>
                        </div>
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                            <h3 className="text-2xl font-bold text-white mb-6">What to Bring</h3>
                            <ul className="space-y-3 text-slate-300">
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></span>
                                    Comfortable workout clothes (karate gi not required for beginners)
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></span>
                                    Water bottle
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></span>
                                    Positive attitude and willingness to learn
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2"></span>
                                    Completed waiver form (for first-time students)
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <h2 className="header-2-styles">
                            Tuition & Pricing
                        </h2>
                    </div>
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                        <div className="space-y-4 mb-8">
                            {getPricingTiers().map((tier) => (
                                <div key={tier.label} className="flex justify-between items-center bg-slate-700/50 rounded-lg p-4">
                                    <span className="font-semibold text-white">{tier.label}</span>
                                    <span className="text-lg font-bold text-green-400">{tier.description || "Free"}</span>
                                </div>
                            ))}
                        </div>
                        
                        {/* Special pricing highlight for new students */}
                        <div className="bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30 rounded-lg p-6">
                            <h3 className="text-xl font-bold text-green-400 mb-4">🎉 New Student Benefits</h3>
                            <ul className="space-y-2 text-green-300">
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-400 rounded-full mr-3 mt-2"></span>
                                    <strong>Free trial class</strong> - Try before you commit!
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-400 rounded-full mr-3 mt-2"></span>
                                    <strong>Automatic discounts</strong> for new students
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-400 rounded-full mr-3 mt-2"></span>
                                    <strong>No long-term contracts</strong> - Pay monthly
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-400 rounded-full mr-3 mt-2"></span>
                                    <strong>Family discounts</strong> available for multiple children
                                </li>
                            </ul>
                        </div>
                        
                        <div className="mt-6">
                            <p className="text-slate-400 text-center">
                                Start with a free trial class, then enjoy special introductory pricing automatically applied for new students. 
                                Regular monthly tuition is {siteConfig.pricing.currency}{siteConfig.pricing.monthly}/month per student.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Belt Progression Section */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <h2 className="header-2-styles">
                            Belt Progression
                        </h2>
                        <p className="text-lg page-subheader-styles max-w-3xl mx-auto">
                            Students progress through a traditional belt system that recognizes their growing skills and knowledge.
                            Regular testing opportunities allow students to demonstrate their abilities and advance to the next level.
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-4">
                            <div className="bg-slate-700/50 p-4 text-center border border-slate-600 rounded-lg">
                                <div className="h-4 bg-white border border-gray-300 rounded mb-3"></div>
                                <span className="text-sm text-slate-300">White</span>
                            </div>
                            <div className="bg-slate-700/50 p-4 text-center border border-slate-600 rounded-lg">
                                <div className="h-4 bg-yellow-400 rounded mb-3"></div>
                                <span className="text-sm text-slate-300">Yellow</span>
                            </div>
                            <div className="bg-slate-700/50 p-4 text-center border border-slate-600 rounded-lg">
                                <div className="h-4 bg-orange-400 rounded mb-3"></div>
                                <span className="text-sm text-slate-300">Orange</span>
                            </div>
                            <div className="bg-slate-700/50 p-4 text-center border border-slate-600 rounded-lg">
                                <div className="h-4 bg-green-500 rounded mb-3"></div>
                                <span className="text-sm text-slate-300">Green</span>
                            </div>
                            <div className="bg-slate-700/50 p-4 text-center border border-slate-600 rounded-lg">
                                <div className="h-4 bg-blue-500 rounded mb-3"></div>
                                <span className="text-sm text-slate-300">Blue</span>
                            </div>
                            <div className="bg-slate-700/50 p-4 text-center border border-slate-600 rounded-lg">
                                <div className="h-4 bg-purple-500 rounded mb-3"></div>
                                <span className="text-sm text-slate-300">Purple</span>
                            </div>
                            <div className="bg-slate-700/50 p-4 text-center border border-slate-600 rounded-lg">
                                <div className="h-4 bg-red-600 rounded mb-3"></div>
                                <span className="text-sm text-slate-300">Red</span>
                            </div>
                            <div className="bg-slate-700/50 p-4 text-center border border-slate-600 rounded-lg">
                                <div className="h-4 bg-yellow-800 rounded mb-3"></div>
                                <span className="text-sm text-slate-300">Brown</span>
                            </div>
                            <div className="bg-slate-700/50 p-4 text-center border border-slate-600 rounded-lg">
                                <div className="h-4 bg-black rounded mb-3"></div>
                                <span className="text-sm text-slate-300">Black</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Call to Action Section */}
                <section>
                    <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-8 text-center">
                        <h2 className="text-3xl font-bold text-white mb-4">Ready to Join?</h2>
                        <p className="text-xl text-green-100 mb-8 max-w-3xl mx-auto">
                            Whether for transformative or competitive purposes, karate nurtures champions in all aspects of life!
                            Join Sensei Negin&apos;s karate class and begin your journey in the art of karate.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                to="/register"
                                className="inline-block bg-white text-green-600 font-bold py-3 px-8 rounded-lg text-center hover:bg-gray-100 transition-colors duration-200"
                            >
                                Register Now
                            </Link>
                            <Link
                                to="/contact"
                                className="inline-block bg-transparent border-2 border-white text-white font-bold py-3 px-8 rounded-lg text-center hover:bg-white hover:text-green-600 transition-colors duration-200"
                            >
                                Contact Us
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
