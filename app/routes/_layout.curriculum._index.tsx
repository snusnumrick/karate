import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { getPrograms, getSeminars } from "~/services/program.server";
import { EventService } from "~/services/event.server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);

  // Fetch active programs, seminars, and upcoming events
  const [programs, seminars, events] = await Promise.all([
    getPrograms({ is_active: true, engagement_type: 'program' }, supabaseServer),
    getSeminars({ is_active: true }, supabaseServer),
    EventService.getUpcomingEvents(),
  ]);

  return json({ programs, seminars, events });
}

export default function CurriculumIndex() {
  const { programs, seminars, events } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Curriculum</h1>
        <p className="text-lg text-muted-foreground">
          Explore our programs, seminars, and upcoming events
        </p>
      </div>

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
                <Card key={program.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-xl">{program.name}</CardTitle>
                      <div className="flex gap-1 flex-wrap justify-end">
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
                    </div>
                    {program.description && (
                      <CardDescription className="line-clamp-3">
                        {program.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {program.delivery_format && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Format:</span>
                          <span className="font-medium capitalize">
                            {program.delivery_format.replace(/_/g, ' ')}
                          </span>
                        </div>
                      )}
                      {program.min_age !== undefined && program.max_age !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Age Range:</span>
                          <span className="font-medium">{program.min_age}-{program.max_age} years</span>
                        </div>
                      )}
                      {program.monthly_fee && typeof program.monthly_fee === 'object' && 'toFormat' in program.monthly_fee ? (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monthly Fee:</span>
                          <span className="font-medium">{(program.monthly_fee as { toFormat: () => string }).toFormat()}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4">
                      <Button asChild className="w-full">
                        <Link to={`/classes`}>View Classes</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
                <Card key={seminar.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-xl">{seminar.name}</CardTitle>
                      <div className="flex gap-1 flex-wrap justify-end">
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
                    </div>
                    {seminar.description && (
                      <CardDescription className="line-clamp-3">
                        {seminar.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {seminar.delivery_format && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Format:</span>
                          <span className="font-medium capitalize">
                            {seminar.delivery_format.replace(/_/g, ' ')}
                          </span>
                        </div>
                      )}
                      {seminar.duration_minutes && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="font-medium">{seminar.duration_minutes} minutes</span>
                        </div>
                      )}
                      {seminar.single_purchase_price_cents && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price:</span>
                          <span className="font-medium">
                            ${(seminar.single_purchase_price_cents / 100).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      <Button asChild className="w-full">
                        <Link to={`/curriculum/seminars/${seminar.slug || seminar.id}`}>
                          View Details
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
                <Card key={event.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-xl">{event.title}</CardTitle>
                      {event.event_type && (
                        <Badge variant="outline">{event.event_type.display_name}</Badge>
                      )}
                    </div>
                    {event.description && (
                      <CardDescription className="line-clamp-3">
                        {event.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date:</span>
                        <span className="font-medium">
                          {new Date(event.start_date).toLocaleDateString()}
                        </span>
                      </div>
                      {event.location && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Location:</span>
                          <span className="font-medium">{event.location}</span>
                        </div>
                      )}
                      {event.registration_fee && typeof event.registration_fee === 'object' && 'getAmount' in event.registration_fee && 'toFormat' in event.registration_fee && (event.registration_fee as { getAmount: () => number; toFormat: () => string }).getAmount() > 0 ? (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fee:</span>
                          <span className="font-medium">{(event.registration_fee as { toFormat: () => string }).toFormat()}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4">
                      <Button asChild className="w-full">
                        <Link to={`/events/${event.id}`}>View Event</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
