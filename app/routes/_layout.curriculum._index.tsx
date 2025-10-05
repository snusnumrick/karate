import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { getPrograms, getSeminars } from "~/services/program.server";
import { EventService } from "~/services/event.server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { isMoneyJSON } from "~/utils/money";

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);

  // Fetch active programs, seminars, and upcoming events
  const [programs, seminars, events] = await Promise.all([
    getPrograms({ is_active: true, engagement_type: 'program' }, supabaseServer),
    getSeminars({ is_active: true }, supabaseServer),
    EventService.getUpcomingEvents(),
  ]);

  // Money objects need to be converted to plain numbers for JSON serialization
  // When serialized, they lose their methods like getAmount()
  return json({ programs, seminars, events });
}

export default function CurriculumIndex() {
  const { programs, seminars, events } = useLoaderData<typeof loader>();

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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {programs.length === 0 ? (
              <p className="col-span-full text-center text-muted-foreground py-12">
                No active programs available
              </p>
            ) : (
              programs.map((program) => (
                <div key={program.id} className="page-card-styles">
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                      {program.name}
                    </h3>
                    <div className="flex gap-1 flex-wrap mb-3">
                      {program.ability_category && (
                        <Badge variant="outline">
                          {program.ability_category}
                        </Badge>
                      )}
                      {program.audience_scope && program.audience_scope !== 'youth' && (
                        <Badge variant="secondary">
                          {program.audience_scope}
                        </Badge>
                      )}
                    </div>
                    {program.description && (
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
                        {program.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    {program.delivery_format && (
                      <div className="flex items-center text-gray-700 dark:text-gray-300">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                        <span className="font-medium">Format:</span>
                        <span className="ml-2 text-gray-900 dark:text-white capitalize">
                          {program.delivery_format.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    {program.min_age !== undefined && program.max_age !== undefined && (
                      <div className="flex items-center text-gray-700 dark:text-gray-300">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                        <span className="font-medium">Age Range:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">{program.min_age}-{program.max_age} years</span>
                      </div>
                    )}
                    {program.monthly_fee && typeof program.monthly_fee === 'object' && 'toFormat' in program.monthly_fee ? (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 dark:text-gray-300 font-medium">Monthly Fee:</span>
                          <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                            {(program.monthly_fee as { toFormat: () => string }).toFormat()}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Only show View Classes button if program would appear on /classes page */}
                  {(() => {
                    // Program must have group capacity (not 1:1) AND have monthly or yearly fee
                    const hasGroupCapacity = !program.max_capacity || program.max_capacity > 1;

                    // Check if program has fees using MoneyJSON structure (serialized Money objects)
                    const hasMonthlyFee = isMoneyJSON(program.monthly_fee) && program.monthly_fee.amount > 0;
                    const hasYearlyFee = isMoneyJSON(program.yearly_fee) && program.yearly_fee.amount > 0;

                    const shouldShowButton = hasGroupCapacity && (hasMonthlyFee || hasYearlyFee);

                    return shouldShowButton ? (
                      <div className="mt-6">
                        <Button asChild className="w-full">
                          <Link to={`/classes`}>View Classes</Link>
                        </Button>
                      </div>
                    ) : null;
                  })()}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="seminars" className="mt-6">
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
