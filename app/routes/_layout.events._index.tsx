import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useMemo } from "react";
import { Calendar, Clock, MapPin, ExternalLink, CalendarCheck } from "lucide-react";
import { EventService, type UpcomingEvent } from "~/services/event.server";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { formatDate } from "~/utils/misc";
import { formatTime } from "~/utils/schedule";
import { formatMoney, isPositive, serializeMoney, deserializeMoney, type MoneyJSON } from "~/utils/money";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { Button } from "~/components/ui/button";

export const meta: MetaFunction = () => [
    { title: "Upcoming Events | Karate Greenegin" },
    { name: "description", content: "Browse upcoming karate events and workshops at Greenegin Karate." },
];

type SerializedEvent = Omit<UpcomingEvent, 'registration_fee' | 'late_registration_fee'> & {
    registration_fee: MoneyJSON;
    late_registration_fee: MoneyJSON;
};

export async function loader({ request }: LoaderFunctionArgs) {
    const { supabaseServer } = getSupabaseServerClient(request);

    let isLoggedIn = false;
    try {
        const { data: { user } } = await supabaseServer.auth.getUser();
        isLoggedIn = !!user;
    } catch {
        // treat as not logged in
    }

    const events = isLoggedIn
        ? await EventService.getAllEventsForLoggedInUsers()
        : await EventService.getAllUpcomingEvents();

    const serializedEvents: SerializedEvent[] = events.map(event => ({
        ...event,
        registration_fee: serializeMoney(event.registration_fee),
        late_registration_fee: serializeMoney(event.late_registration_fee),
    }));

    return json({ events: serializedEvents, isLoggedIn });
}

export default function EventsIndexPage() {
    const { events: serializedEvents, isLoggedIn } = useLoaderData<typeof loader>();

    const events = useMemo<UpcomingEvent[]>(() =>
        serializedEvents.map(event => ({
            ...event,
            registration_fee: deserializeMoney(event.registration_fee),
            late_registration_fee: deserializeMoney(event.late_registration_fee),
        })),
        [serializedEvents]
    );

    return (
        <div className="page-styles">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Breadcrumb */}
                <div className="mb-6">
                    <AppBreadcrumb items={breadcrumbPatterns.publicEvents()} />
                </div>

                {/* Page Header + Toolbar */}
                <div className="family-page-header-section-styles">
                    <div>
                        <h1 className="page-header-styles">Upcoming Events</h1>
                        <p className="page-subheader-styles">
                            Browse and register for upcoming karate events and workshops.
                        </p>
                    </div>
                    {isLoggedIn && (
                        <Button asChild variant="outline">
                            <Link to="/family/events">
                                <CalendarCheck className="h-4 w-4 mr-2" />
                                My Registrations
                            </Link>
                        </Button>
                    )}
                </div>

                {/* Events Grid */}
                {events.length === 0 ? (
                    <div className="form-container-styles p-8 text-center py-16">
                        <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 text-lg">No upcoming events at this time.</p>
                        <p className="text-gray-400 dark:text-gray-500 mt-2">Check back soon for new events!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {events.map((event) => (
                            <div key={event.id} className="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${event.event_type?.color_class || 'bg-gray-100 text-gray-800'}`}>
                                            {(event.event_type?.display_name || event.event_type?.name || 'Other').toUpperCase()}
                                        </span>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            event.status === 'registration_open'
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                        }`}>
                                            {event.status === 'registration_open' ? 'OPEN' : event.status?.toUpperCase()}
                                        </span>
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                        {event.title}
                                    </h3>

                                    {event.description && (
                                        <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                                            {event.description}
                                        </p>
                                    )}

                                    <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                                        <div className="flex items-center">
                                            <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                                            <span>
                                                {formatDate(event.start_date)}
                                                {event.end_date && event.end_date !== event.start_date && (
                                                    <> - {formatDate(event.end_date)}</>
                                                )}
                                            </span>
                                        </div>

                                        {(event.start_time || event.end_time) && (
                                            <div className="flex items-center">
                                                <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                                                <span>
                                                    {event.start_time && formatTime(event.start_time)}
                                                    {event.end_time && <> - {formatTime(event.end_time)}</>}
                                                </span>
                                            </div>
                                        )}

                                        {event.location && (
                                            <div className="flex items-center">
                                                <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                                                <span>{event.location}</span>
                                            </div>
                                        )}

                                        {isPositive(event.registration_fee) && (
                                            <div className="flex items-center">
                                                <span className="text-green-600 dark:text-green-400 font-semibold">
                                                    {formatMoney(event.registration_fee, { showCurrency: true, trimTrailingZeros: true })}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {event.status === 'registration_open' && event.registration_deadline && (
                                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                                <strong>Registration deadline:</strong> {formatDate(event.registration_deadline)}
                                            </p>
                                        </div>
                                    )}

                                    <div className="mt-6 flex justify-between items-center">
                                        <Link
                                            to={`/events/${event.id}`}
                                            className="inline-flex items-center text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                                        >
                                            Learn More
                                            <ExternalLink className="h-4 w-4 ml-1" />
                                        </Link>

                                        {event.status === 'registration_open' && (
                                            <Link
                                                to={isLoggedIn
                                                    ? `/events/${event.id}/register`
                                                    : `/login?redirectTo=${encodeURIComponent(`/events/${event.id}/register`)}`}
                                                className="inline-flex items-center bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                                            >
                                                Register
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
