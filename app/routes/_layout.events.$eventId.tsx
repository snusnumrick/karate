import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, Outlet, useLocation } from "@remix-run/react";
import { EventService } from "~/services/event.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Calendar, Clock, MapPin, ExternalLink, DollarSign, Users, AlertCircle, Shield, Package } from "lucide-react";
import { siteConfig } from "~/config/site";
import { formatDate } from "~/utils/misc";
import { getEventTypeColorWithBorder } from "~/utils/event-helpers.server";
import {formatEventTypeName} from "~/utils/event-helpers.client";
// Server-side imports moved to loader function


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

  // Determine location for metadata - prioritize event's structured location or basic address
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

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "event" },
    { property: "og:url", content: `${siteConfig.url}/events/${event.id}` },
    {
      "script:ld+json": {
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
        offers: event.registration_fee ? {
          "@type": "Offer",
          price: event.registration_fee,
          priceCurrency: "CAD",
          availability: "https://schema.org/InStock",
          validFrom: new Date().toISOString(),
          validThrough: event.registration_deadline || event.start_date,
        } : undefined,
      },
    },
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { eventId } = params;
  
  if (!eventId) {
    throw new Response("Event ID is required", { status: 400 });
  }

  const event = await EventService.getEventById(eventId);
  
  if (!event) {
    throw new Response("Event not found", { status: 404 });
  }

  const eventTypeColor = await getEventTypeColorWithBorder(event.event_type?.name || 'other', request);
  const formattedEventType = formatEventTypeName(event.event_type?.name || 'other');

  return json({ event, eventTypeColor, formattedEventType });
}

export default function EventDetail() {
  const { event, eventTypeColor, formattedEventType } = useLoaderData<typeof loader>();
  const location = useLocation();

  // Helper function to format date with weekday using the centralized utility
  const formatDateWithWeekday = (dateString: string) => {
    return formatDate(dateString, { 
      formatString: 'EEEE, MMMM d, yyyy',
      type: 'date'
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return null;
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isRegistrationOpen = event.status === 'registration_open';
  const registrationDeadlinePassed = event.registration_deadline 
    ? new Date(event.registration_deadline) < new Date() 
    : false;
  
  // Registration is available if event is open AND (no deadline OR deadline hasn't passed)
  const canRegister = isRegistrationOpen && !registrationDeadlinePassed;

  // Check if we're on a nested route (like /register)
  const isNestedRoute = location.pathname !== `/events/${event.id}`;

  // If we're on a nested route, render the Outlet instead of event details
  if (isNestedRoute) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen page-background-styles py-12">
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
                            {formatTime(event.start_time)}
                            {event.end_time && ` - ${formatTime(event.end_time)}`}
                          </p>
                        )}
                      </div>
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
                    // Event has its own location
                    event.address ? (
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
                    )
                  ) : (
                    // Use site default location
                    <>
                      <p className="text-gray-600 dark:text-gray-300 mb-3">
                        {siteConfig.location.address}<br />
                        {siteConfig.location.locality}, {siteConfig.location.region} {siteConfig.location.postalCode}
                      </p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteConfig.location.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                      >
                        View on Google Maps
                        <ExternalLink className="ml-1 h-4 w-4" />
                      </a>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* External Event Info */}
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

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Registration Card */}
            <Card className="bg-white dark:bg-gray-700 shadow-xl">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Registration</h2>
                
                {event.registration_fee && (
                  <div className="mb-6">
                    <div className="flex items-center mb-2">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-300">Registration Fee</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">${event.registration_fee}</p>
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

            {/* Event Info Card */}
            <Card className="bg-white dark:bg-gray-700 shadow-xl">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Event Info</h2>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm text-gray-600 dark:text-gray-300">Event Type</dt>
                    <dd className="font-semibold text-gray-900 dark:text-white capitalize">{event.event_type_id.replace('_', ' ')}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600 dark:text-gray-300">Status</dt>
                    <dd className="font-semibold text-gray-900 dark:text-white capitalize">{event.status.replace('_', ' ')}</dd>
                  </div>
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

            {/* Eligibility Requirements Card */}
             {(event.min_age || event.max_age || event.min_belt_rank || event.max_belt_rank || event.requires_waiver || event.requires_equipment) && (
               <Card className="bg-white dark:bg-gray-700 shadow-xl">
                 <CardContent className="p-8">
                   <div className="flex items-center mb-6">
                     <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 mr-3" />
                     <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Eligibility Requirements</h2>
                   </div>
                   <div className="space-y-4">
                     {/* Age Requirements */}
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

                     {/* Belt Rank Requirements */}
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

                     {/* Waiver Requirements */}
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

                     {/* Equipment Requirements */}
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