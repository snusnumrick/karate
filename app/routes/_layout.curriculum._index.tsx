import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { getSupabaseServerClient, getSupabaseAdminClient } from "~/utils/supabase.server";
import { getPrograms, getSeminars } from "~/services/program.server";
import { buildScheduleSummaryFromClasses } from "~/services/class.server";
import { EventService } from "~/services/event.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatMoney, fromCents, toCents } from "~/utils/money";
import { siteConfig } from "~/config/site";
import { DEFAULT_SCHEDULE, getDefaultAgeRangeLabel } from "~/constants/schedule";

type ClassWithSchedule = {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    program: {
        id: string;
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

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);
  const supabaseAdmin = getSupabaseAdminClient();

  // Fetch active programs, seminars, events, and classes with schedules
  const [programs, seminars, events] = await Promise.all([
    getPrograms({ is_active: true, engagement_type: 'program' }, supabaseServer),
    getSeminars({ is_active: true }, supabaseServer),
    EventService.getUpcomingEvents(),
  ]);

  // Get active classes with their schedules (like /classes page does)
  const { data: classesData, error } = await supabaseAdmin
    .from('classes')
    .select(`
      id,
      name,
      description,
      is_active,
      program:programs!inner(
        id,
        name,
        description,
        min_age,
        max_age,
        duration_minutes,
        max_capacity,
        monthly_fee_cents,
        yearly_fee_cents
      )
    `)
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching classes:', error);
  }

  let schedulesByClassId: Record<string, Array<{ day_of_week: string; start_time: string }>> = {};
  if (classesData && classesData.length > 0) {
    const classIds = classesData.map(classItem => classItem.id);
    const { data: schedulesData, error: schedulesError } = await supabaseAdmin
      .from('class_schedules')
      .select('class_id, day_of_week, start_time')
      .in('class_id', classIds)
      .order('day_of_week')
      .order('start_time');

    if (schedulesError) {
      console.error('Error fetching class schedules:', schedulesError);
    }

    schedulesByClassId = (schedulesData || []).reduce<Record<string, Array<{ day_of_week: string; start_time: string }>>>(
      (acc, schedule) => {
        const key = schedule.class_id;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push({
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
        });
        return acc;
      },
      {}
    );
  }

  // Transform the data to match our expected type
  const classes: ClassWithSchedule[] = (classesData || []).map(classItem => {
    const rawProgram = Array.isArray(classItem.program)
      ? classItem.program[0]
      : classItem.program;

    const normalizedProgram = rawProgram
      ? {
        id: rawProgram.id,
        name: rawProgram.name,
        description: rawProgram.description,
        min_age: rawProgram.min_age,
        max_age: rawProgram.max_age,
        duration_minutes: rawProgram.duration_minutes,
        max_capacity: rawProgram.max_capacity,
        monthly_fee: rawProgram.monthly_fee_cents ?? null,
        yearly_fee: rawProgram.yearly_fee_cents ?? null,
      }
      : null;

    const schedules = schedulesByClassId[classItem.id] || [];

    return {
      id: classItem.id,
      name: classItem.name,
      description: classItem.description,
      is_active: classItem.is_active,
      program: normalizedProgram,
      schedules,
    };
  });

  const scheduleSummary = buildScheduleSummaryFromClasses(classes);

  // Convert Money objects in programs to cents for JSON serialization
  const programsWithCents = programs.map(program => ({
    ...program,
    monthly_fee: program.monthly_fee ? toCents(program.monthly_fee) : null,
    registration_fee: program.registration_fee ? toCents(program.registration_fee) : null,
    yearly_fee: program.yearly_fee ? toCents(program.yearly_fee) : null,
    individual_session_fee: program.individual_session_fee ? toCents(program.individual_session_fee) : null,
  }));

  return json({ programs: programsWithCents, seminars, events, classes, scheduleSummary });
}

export default function CurriculumIndex() {
  const { programs, seminars, events, classes, scheduleSummary } = useLoaderData<typeof loader>();

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
    return scheduleSummary?.ageRange ?? getDefaultAgeRangeLabel();
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
      const minLabel = formatMoney(fromCents(minMonthly), { showCurrency: true, trimTrailingZeros: true });
      const maxLabel = formatMoney(fromCents(maxMonthly), { showCurrency: true, trimTrailingZeros: true });

      if (minMonthly === maxMonthly) {
        tiers.push({ label: "Monthly", description: `${minLabel} - Ongoing` });
      } else {
        tiers.push({ label: "Monthly", description: `${minLabel} - ${maxLabel} - Ongoing` });
      }
    }

    // Yearly pricing from programs
    const yearlyPrograms = programs.filter(p => p.yearly_fee && p.yearly_fee > 0);
    if (yearlyPrograms.length > 0) {
      const yearlyFees = yearlyPrograms.map(p => p.yearly_fee!);
      const minYearly = Math.min(...yearlyFees);
      const maxYearly = Math.max(...yearlyFees);
      const minLabel = formatMoney(fromCents(minYearly), { showCurrency: true, trimTrailingZeros: true });
      const maxLabel = formatMoney(fromCents(maxYearly), { showCurrency: true, trimTrailingZeros: true });

      if (minYearly === maxYearly) {
        tiers.push({ label: "Yearly", description: `${minLabel} - Best value` });
      } else {
        tiers.push({ label: "Yearly", description: `${minLabel} - ${maxLabel} - Best value` });
      }
    }

    return tiers;
  };

  return (
    <div className="min-h-screen page-background-styles py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="page-header-styles">Pathways</h1>
          <p className="page-subheader-styles">
            Explore our programs, seminars, and upcoming events
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Tabs defaultValue="programs" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="programs">Programs</TabsTrigger>
            <TabsTrigger value="seminars">Seminars</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="programs" className="mt-6">
            {/* Tab Header */}
            <div className="text-center mb-12">
{/*              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Our Programs
              </h2>*/}
              <p className="text-lg text-gray-600 dark:text-gray-400 mx-auto">
                  Join our regular training programs and embark on a transformative journey toward lasting results
              </p>
            </div>

            {/* Programs Pricing Section */}
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
                    .map((program) => {
                      const monthlyLabel =
                        program.monthly_fee && program.monthly_fee > 0
                          ? formatMoney(fromCents(program.monthly_fee), {
                            showCurrency: true,
                            trimTrailingZeros: true,
                          })
                          : null;
                      const yearlyLabel =
                        program.yearly_fee && program.yearly_fee > 0
                          ? formatMoney(fromCents(program.yearly_fee), {
                            showCurrency: true,
                            trimTrailingZeros: true,
                          })
                          : null;
                      const sessionLabel =
                        program.individual_session_fee && program.individual_session_fee > 0
                          ? formatMoney(fromCents(program.individual_session_fee), {
                            showCurrency: true,
                            trimTrailingZeros: true,
                          })
                          : null;

                      return (
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

                            {monthlyLabel && (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-gray-700 dark:text-gray-300 font-medium">Monthly:</span>
                                  <span className="text-green-600 dark:text-green-400 font-bold text-lg">{monthlyLabel}</span>
                                </div>
                              </div>
                            )}

                            {yearlyLabel && (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-gray-700 dark:text-gray-300 font-medium">Yearly:</span>
                                  <span className="text-green-600 dark:text-green-400 font-bold text-lg">{yearlyLabel}</span>
                                </div>
                              </div>
                            )}

                            {sessionLabel && (
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-gray-700 dark:text-gray-300 font-medium">Per Session:</span>
                                  <span className="text-green-600 dark:text-green-400 font-bold text-lg">{sessionLabel}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                    (() => {
                      const fallbackDays = (scheduleSummary?.days ?? DEFAULT_SCHEDULE.days)
                        .split(/\s*[&,/]+\s*/)
                        .map((day: string) => day.trim())
                        .filter(Boolean);
                      const fallbackTime = scheduleSummary?.time ?? DEFAULT_SCHEDULE.timeRange;
                      return (
                        <div className="text-center py-8">
                          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            Children&apos;s Classes (Ages {getAgeRange()})
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                            {fallbackDays.map((day: string) => (
                              <div
                                key={day}
                                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-green-600 dark:text-green-400 font-bold text-lg">{day}</span>
                                  <span className="text-gray-900 dark:text-white font-medium">{fallbackTime}</span>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">at {siteConfig.location.address}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()
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
          </TabsContent>

        <TabsContent value="seminars" className="mt-6">
          {/* Tab Header */}
          <div className="text-center mb-12">
{/*            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Seminars & Workshops
            </h2>*/}
            <p className="text-lg text-gray-600 dark:text-gray-400 mx-auto">
                Take part in our special seminars to deepen your karate knowledge or discover the art for the first time.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {seminars.length === 0 ? (
              <p className="col-span-full text-center text-muted-foreground py-12">
                No active seminars available
              </p>
            ) : (
              seminars.map((seminar) => (
                <div key={seminar.id} className="page-card-styles">
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                      {seminar.name}
                    </h3>
                    <div className="flex gap-1 flex-wrap mb-3">
                      {seminar.ability_category && (
                        <Badge variant="outline">
                          {seminar.ability_category}
                        </Badge>
                      )}
                      {seminar.audience_scope && (
                        <Badge variant="secondary">
                          {seminar.audience_scope}
                        </Badge>
                      )}
                    </div>
                    {seminar.description && (
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
                        {seminar.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    {seminar.delivery_format && (
                      <div className="flex items-center text-gray-700 dark:text-gray-300">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                        <span className="font-medium">Format:</span>
                        <span className="ml-2 text-gray-900 dark:text-white capitalize">
                          {seminar.delivery_format.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    {seminar.duration_minutes && (
                      <div className="flex items-center text-gray-700 dark:text-gray-300">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                        <span className="font-medium">Duration:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">{seminar.duration_minutes} minutes</span>
                      </div>
                    )}
                    {seminar.single_purchase_price_cents && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 dark:text-gray-300 font-medium">Price:</span>
                          <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                            ${(seminar.single_purchase_price_cents / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6">
                    <Button asChild className="w-full">
                      <Link to={`/curriculum/seminars/${seminar.slug || seminar.id}`}>
                        View Details
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          {/* Tab Header */}
          <div className="text-center mb-12">
{/*            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Upcoming Events
            </h2>*/}
            <p className="text-lg text-gray-600 dark:text-gray-400 mx-auto">
                Join our academy events to experience our spirit, connect with the community, and learn what we stand for
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.length === 0 ? (
              <p className="col-span-full text-center text-muted-foreground py-12">
                No upcoming events
              </p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="page-card-styles">
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                      {event.title}
                    </h3>
                    {event.event_type && (
                      <div className="mb-3">
                        <Badge variant="outline">{event.event_type.display_name}</Badge>
                      </div>
                    )}
                    {event.description && (
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
                        {event.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center text-gray-700 dark:text-gray-300">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      <span className="font-medium">Date:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        {new Date(event.start_date).toLocaleDateString()}
                      </span>
                    </div>
                    {event.location && (
                      <div className="flex items-center text-gray-700 dark:text-gray-300">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                        <span className="font-medium">Location:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">{event.location}</span>
                      </div>
                    )}
                    {event.registration_fee && typeof event.registration_fee === 'object' && 'getAmount' in event.registration_fee && 'toFormat' in event.registration_fee && (event.registration_fee as { getAmount: () => number; toFormat: () => string }).getAmount() > 0 ? (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 dark:text-gray-300 font-medium">Fee:</span>
                          <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                            {(event.registration_fee as { toFormat: () => string }).toFormat()}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6">
                    <Button asChild className="w-full">
                      <Link to={`/events/${event.id}`}>View Event</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
