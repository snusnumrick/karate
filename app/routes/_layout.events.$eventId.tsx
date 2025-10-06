import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, Outlet, useLocation, useRouteError, isRouteErrorResponse, useRouteLoaderData } from "@remix-run/react";
import { JsonLd } from "~/components/JsonLd";
import { EventService, type EventWithEventType } from "~/services/event.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Calendar, Clock, MapPin, ExternalLink, DollarSign, Users, AlertCircle, Shield, Package } from "lucide-react";
import { siteConfig } from "~/config/site";
import { formatDate, formatTime } from "~/utils/misc";
import { formatMoney, isPositive, toDollars, serializeMoney, deserializeMoney, type MoneyJSON } from "~/utils/money";
import { isLoggedIn as userIsLoggedIn } from "~/utils/auth.server";


export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.event) {
    return [
      { title: "Event Not Found | " + siteConfig.name },
      { name: "description", content: "The requested event could not be found." },
    ];
  }

  const { event } = data;
  const title = `${event.title} | ${siteConfig.name}`;
  const description = event.description || `Join us for ${event.title} at ${siteConfig.name}`;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "event" },
    { property: "og:url", content: `${siteConfig.url}/events/${event.id}` },
  ];
};

type SerializedEventWithEventType = Omit<EventWithEventType, 'registration_fee' | 'late_registration_fee'> & {
  registration_fee: MoneyJSON;
  late_registration_fee: MoneyJSON;
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { eventId } = params;
  
  if (!eventId) {
    throw new Response("Event ID is required", { status: 400 });
  }

  // Check if user is logged in to determine event visibility access
  const isLoggedIn = await userIsLoggedIn(request);

  const event = await EventService.getEventById(eventId, isLoggedIn);
  
  if (!event) {
    throw new Response("Event not found", { status: 404 });
  }

  // Use dynamic color from event_types table instead of hardcoded colors
  const eventTypeColor = event.event_type?.color_class 
    ? `${event.event_type.color_class} ${event.event_type.border_class || ''}`.trim()
    : 'bg-gray-100 text-gray-800 border-gray-200';
  const formattedEventType = event.event_type?.display_name || event.event_type?.name || 'Other';

  const serializedEvent: SerializedEventWithEventType = {
    ...event,
    registration_fee: serializeMoney(event.registration_fee),
    late_registration_fee: serializeMoney(event.late_registration_fee),
  };

  return json({ event: serializedEvent, eventTypeColor, formattedEventType });
}

export default function EventDetail() {
  const { event: serializedEvent, eventTypeColor, formattedEventType } = useLoaderData<typeof loader>();
  const event: EventWithEventType = {
    ...serializedEvent,
    registration_fee: deserializeMoney(serializedEvent.registration_fee),
    late_registration_fee: deserializeMoney(serializedEvent.late_registration_fee),
  };
  const location = useLocation();
  const rootData = useRouteLoaderData('root') as { nonce?: string } | undefined;
  const nonce = rootData?.nonce;

  // Helper function to format date with weekday using the centralized utility
  const formatDateWithWeekday = (dateString: string) => {
    return formatDate(dateString, { 
      formatString: 'EEEE, MMMM d, yyyy',
      type: 'date'
    });
  };

  // formatTime is now imported from ~/utils/misc
  const formatTimeOrNull = (time: string | null) => {
    const formatted = formatTime(time);
    return formatted || null;
  };

  const isRegistrationOpen = event.status === 'registration_open';
  const registrationDeadlinePassed = event.registration_deadline 
    ? new Date(event.registration_deadline) < new Date() 
    : false;
  
  // Registration is available if event is open AND (no deadline OR deadline hasn't passed)
  const canRegister = isRegistrationOpen && !registrationDeadlinePassed;

  const slotTimeRanges = [
    [event.slot_one_start, event.slot_one_end],
    [event.slot_two_start, event.slot_two_end],
  ].filter(([start, end]) => start || end) as Array<[string | null, string | null]>;

  // Build JSON-LD structured data for the event using the same logic as before
  const hasEventLocation = event.location_name || event.street_address || event.locality || event.address;
  const locationName = hasEventLocation 
    ? (event.location_name || event.location || siteConfig.name)
    : siteConfig.name;

  const locationAddress = hasEventLocation ? {
    streetAddress: event.street_address || event.address || siteConfig.location.address,
    addressLocality: event.locality || siteConfig.location.locality,
    addressRegion: event.region || siteConfig.location.region,
    postalCode: event.postal_code || siteConfig.location.postalCode,
    addressCountry: event.country || siteConfig.location.country,
  } : {
    streetAddress: siteConfig.location.address,
    addressLocality: siteConfig.location.locality,
    addressRegion: siteConfig.location.region,
    postalCode: siteConfig.location.postalCode,
    addressCountry: siteConfig.location.country,
  };

  const eventStructuredData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: `${event.start_date}T${event.start_time || "00:00"}`,
    endDate: event.end_date ? `${event.end_date}T${event.end_time || "23:59"}` : undefined,
    location: {
      "@type": "Place",
      name: locationName,
      address: {
        "@type": "PostalAddress",
        ...locationAddress,
      },
    },
    organizer: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    offers: isPositive(event.registration_fee) ? {
      "@type": "Offer",
      price: toDollars(event.registration_fee),
      priceCurrency: siteConfig.localization.currency,
      availability: "https://schema.org/InStock",
      validFrom: event.registration_deadline || event.start_date,
      validThrough: event.registration_deadline || event.start_date,
    } : undefined,
  };

  // Check if we're on a nested route (like /register)
  const isNestedRoute = location.pathname !== `/events/${event.id}`;

  // If we're on a nested route, render the Outlet instead of event details
  if (isNestedRoute) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen page-background-styles py-12">
      {nonce && (<JsonLd data={eventStructuredData} nonce={nonce} />)}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-8">
          <Link to="/" className="hover:text-green-600 dark:hover:text-green-400">Home</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white">Event Details</span>
        </nav>
        
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${eventTypeColor}`}>
              {formattedEventType}
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              event.status === 'registration_open' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
            }`}>
              {event.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl mb-4">
            {event.title}
          </h1>
          {event.description && (
            <p className="mt-3 max-w-3xl mx-auto text-xl text-gray-500 dark:text-gray-400">
              {event.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Date & Time Card */}
            <Card className="bg-white dark:bg-gray-700 shadow-xl">
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  <Calendar className="h-6 w-6 text-green-600 dark:text-green-400 mr-3" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Date & Time</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="flex-1">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatDateWithWeekday(event.start_date)}</p>
                      {event.end_date && event.end_date !== event.start_date && (
                        <p className="text-gray-600 dark:text-gray-300">to {formatDateWithWeekday(event.end_date)}</p>
                      )}
                    </div>
                  </div>
                  {(event.start_time || event.end_time) && (
                    <div className="flex items-center">
                      <Clock className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        {event.start_time && (
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatTimeOrNull(event.start_time)}
                            {event.end_time && ` - ${formatTimeOrNull(event.end_time)}`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {slotTimeRanges.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Available Time Slots
                      </p>
                      <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                        {slotTimeRanges.map(([start, end], index) => (
                          <li key={index} className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>
                              {start ? formatTimeOrNull(start) : 'TBD'}
                              {end ? ` - ${formatTimeOrNull(end)}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Location Card */}
            <Card className="bg-white dark:bg-gray-700 shadow-xl">
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  <MapPin className="h-6 w-6 text-green-600 dark:text-green-400 mr-3" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Location</h2>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {event.location || siteConfig.name}
                  </p>
                  {event.location ? (
                    <>
                      {event.address ? (
                        <>
                          <p className="text-gray-600 dark:text-gray-300 mb-3">
                            {event.address}
                          </p>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                          >
                            View on Google Maps
                            <ExternalLink className="ml-1 h-4 w-4" />
                          </a>
                        </>
                      ) : (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                        >
                          View on Google Maps
                          <ExternalLink className="ml-1 h-4 w-4" />
                        </a>
                      )}
                    </>
                  ) : (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteConfig.location.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                    >
                      View on Google Maps
                      <ExternalLink className="ml-1 h-4 w-4" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>

            {event.external_url && (
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-xl">
                <CardContent className="p-8">
                  <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-400 mb-4">External Event</h2>
                  <p className="text-blue-800 dark:text-blue-300 mb-6">
                    This event is hosted externally. For complete event details, rules, and official registration, 
                    please visit the official event website.
                  </p>
                  <Button asChild variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/30">
                    <a href={event.external_url} target="_blank" rel="noopener noreferrer">
                      Visit Official Event Page
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-8">

            <Card className="bg-white dark:bg-gray-700 shadow-xl">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Registration</h2>
                
                {isPositive(event.registration_fee) && (
                  <div className="mb-6">
                    <div className="flex items-center mb-2">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-300">Registration Fee</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatMoney(event.registration_fee, { trimTrailingZeros: true })}</p>
                  </div>
                )}

                {event.registration_deadline && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Registration Deadline</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatDate(event.registration_deadline)}</p>
                    {registrationDeadlinePassed && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">Registration deadline has passed</p>
                    )}
                  </div>
                )}

                {event.allow_self_participants && (
                  <div className="mb-6 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-800 dark:text-green-300">
                    Adult participants and instructors can register themselves for this event—no family profile required.
                  </div>
                )}

                <div className="space-y-3">
                  {canRegister ? (
                    <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white">
                      <Link to={`/events/${event.id}/register`}>
                        Register for Event
                      </Link>
                    </Button>
                  ) : (
                    <div className="w-full bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 px-4 py-3 rounded-md text-center font-medium">
                      Registration Closed
                    </div>
                  )}

                  <Button asChild variant="outline" className="w-full">
                    <Link to="/contact">
                      Contact Us
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-700 shadow-xl">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Event Info</h2>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm text-gray-600 dark:text-gray-300">Event Type</dt>
                    <dd className="font-semibold text-gray-900 dark:text-white capitalize">
                        {formattedEventType}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600 dark:text-gray-300">Status</dt>
                    <dd className="font-semibold text-gray-900 dark:text-white capitalize">{event.status.replace('_', ' ')}</dd>
                  </div>
                  {event.min_capacity != null && (
                    <div>
                      <dt className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        Minimum Participants
                      </dt>
                      <dd className="font-semibold text-gray-900 dark:text-white">{event.min_capacity}</dd>
                    </div>
                  )}
                  {event.max_participants && (
                    <div>
                      <dt className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        Max Participants
                      </dt>
                      <dd className="font-semibold text-gray-900 dark:text-white">{event.max_participants}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

             {(event.min_age || event.max_age || event.min_belt_rank || event.max_belt_rank || event.requires_waiver || event.requires_equipment) && (
               <Card className="bg-white dark:bg-gray-700 shadow-xl">
                 <CardContent className="p-8">
                   <div className="flex items-center mb-6">
                     <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 mr-3" />
                     <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Eligibility Requirements</h2>
                   </div>
                   <div className="space-y-4">

                     {(event.min_age || event.max_age) && (
                       <div className="flex items-start">
                         <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
                         <div>
                           <h3 className="font-semibold text-gray-900 dark:text-white">Age Requirements</h3>
                           <p className="text-gray-600 dark:text-gray-300">
                             {event.min_age && event.max_age 
                               ? `Ages ${event.min_age} - ${event.max_age} years`
                               : event.min_age 
                               ? `Minimum age: ${event.min_age} years`
                               : `Maximum age: ${event.max_age} years`
                             }
                           </p>
                         </div>
                       </div>
                     )}

                     {(event.min_belt_rank || event.max_belt_rank) && (
                       <div className="flex items-start">
                         <Shield className="h-5 w-5 text-green-600 dark:text-green-400 mr-3 mt-0.5" />
                         <div>
                           <h3 className="font-semibold text-gray-900 dark:text-white">Belt Rank Requirements</h3>
                           <p className="text-gray-600 dark:text-gray-300">
                             {event.min_belt_rank && event.max_belt_rank 
                               ? `${event.min_belt_rank} to ${event.max_belt_rank}`
                               : event.min_belt_rank 
                               ? `Minimum: ${event.min_belt_rank}`
                               : `Maximum: ${event.max_belt_rank}`
                             }
                           </p>
                         </div>
                       </div>
                     )}

                     {event.requires_waiver && (
                       <div className="flex items-start">
                         <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                         <div>
                           <h3 className="font-semibold text-gray-900 dark:text-white">Waiver Required</h3>
                           <p className="text-gray-600 dark:text-gray-300">
                             A signed waiver is required for participation in this event.
                           </p>
                         </div>
                       </div>
                     )}

                     {event.requires_equipment && event.requires_equipment.length > 0 && (
                       <div className="flex items-start">
                         <Package className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-3 mt-0.5" />
                         <div>
                           <h3 className="font-semibold text-gray-900 dark:text-white">Required Equipment</h3>
                           <ul className="text-gray-600 dark:text-gray-300 list-disc list-inside">
                             {event.requires_equipment.map((item, index) => (
                               <li key={index}>{item}</li>
                             ))}
                           </ul>
                         </div>
                       </div>
                     )}
                   </div>
                 </CardContent>
               </Card>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Error Boundary for the event detail route
export function ErrorBoundary() {
  const error = useRouteError();
  console.error("Event Detail Route Error:", error);

  let title = "Event Not Found";
  let message = "The event you're looking for doesn't exist or is no longer available.";
  let status = 404;

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = error.data?.message || error.data || "An error occurred processing your request.";
    status = error.status;
  } else if (error instanceof Error) {
    title = "An Unexpected Error Occurred";
    message = "We encountered an unexpected issue. Please try again later.";
  }

  return (
    <div className="min-h-screen page-background-styles py-12 text-foreground flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md backdrop-blur-lg border dark:border-gray-700 text-center">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            {title}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {message}
          </p>
          <div className="space-y-3">
            <Link 
              to="/" 
              className="block w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Return to Events
            </Link>
            {status === 404 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                If you believe this is an error, please contact us.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
