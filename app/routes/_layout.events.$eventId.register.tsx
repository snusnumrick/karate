import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { EventService } from "~/services/event.server";
import { siteConfig } from "~/config/site";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Calendar, Clock, MapPin, DollarSign, UserPlus, ExternalLink, Mail, Phone, FileText } from "lucide-react";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.event) {
    return [
      { title: "Event Registration | " + siteConfig.name },
      { name: "description", content: "Register for this event." },
    ];
  }

  const { event } = data;
  const title = `Register for ${event.title} | ${siteConfig.name}`;

  return [
    { title },
    { name: "description", content: `Register for ${event.title} at ${siteConfig.name}` },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const { eventId } = params;
  
  if (!eventId) {
    throw new Response("Event ID is required", { status: 400 });
  }

  const event = await EventService.getEventById(eventId);
  
  if (!event) {
    throw new Response("Event not found", { status: 404 });
  }

  return json({ event });
}

export default function EventRegistration() {
  const { event } = useLoaderData<typeof loader>();

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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

  return (
    <div className="min-h-screen page-background-styles py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-8">
          <Link to="/" className="hover:text-green-600 dark:hover:text-green-400">Home</Link>
          <span>/</span>
          <Link to={`/events/${event.id}`} className="hover:text-green-600 dark:hover:text-green-400">Event Details</Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white">Registration</span>
        </nav>

        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="page-header-styles text-3xl font-extrabold sm:text-4xl mb-4">
            Event Registration
          </h1>
          <p className="page-subheader-styles mt-3 max-w-2xl mx-auto text-xl">
            Complete your registration for {event.title}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Event Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="form-container-styles">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-600 rounded-lg">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="form-header-styles text-xl font-semibold">Event Details</h2>
                </div>
                
                <div className="form-card-styles p-4 rounded-lg border-l-4 border-green-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{event.title}</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(event.start_date)}</span>
                    </div>
                    {(event.start_time || event.end_time) && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Clock className="h-4 w-4" />
                        <span>
                          {formatTime(event.start_time)}
                          {event.end_time && ` - ${formatTime(event.end_time)}`}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location_name || event.location || siteConfig.name}</span>
                    </div>
                    {event.registration_fee && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">${event.registration_fee}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Registration Content */}
          <div className="lg:col-span-2">
            <Card className="form-container-styles">
              <CardContent className="p-8">

                {/* Registration Form Placeholder */}
                <div className="text-center py-12">
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="form-header-styles text-2xl font-bold">Registration Form Coming Soon</h3>
                  </div>
                  
                  <div className="form-card-styles p-6 rounded-lg border-l-4 border-blue-600 mb-8">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      We're currently working on the registration system. Please check back soon or contact us directly for assistance.
                    </p>
                    
                    <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">System launching soon</span>
                    </div>
                  </div>
                  
                  <div className="form-card-styles p-6 rounded-lg">
                    <h4 className="form-header-styles text-lg font-semibold mb-4">Need Immediate Assistance?</h4>
                    <div className="space-y-3">
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                        For immediate registration assistance, please contact:
                      </p>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <p className="font-medium text-gray-900 dark:text-white">{siteConfig.name}</p>
                        {siteConfig.contact?.email && (
                          <div className="flex items-center gap-2 mt-2">
                            <Mail className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-600 dark:text-gray-400 text-sm">{siteConfig.contact.email}</span>
                          </div>
                        )}
                        {siteConfig.contact?.phone && (
                          <div className="flex items-center gap-2 mt-2">
                            <Phone className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-600 dark:text-gray-400 text-sm">{siteConfig.contact.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* External Registration Link */}
                {event.external_url && (
                  <div className="form-card-styles p-6 rounded-lg border-l-4 border-green-600">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                        <ExternalLink className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="form-header-styles text-lg font-semibold">External Registration Available</h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      You can register for this event through our external registration system.
                    </p>
                    <Button asChild className="w-full sm:w-auto">
                      <a
                        href={event.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2"
                      >
                        Register Now
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}