import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { EventService } from "~/services/event.server";
import { siteConfig } from "~/config/site";

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
          <Link to="/" className="hover:text-gray-700">Home</Link>
          <span>/</span>
          <Link to={`/events/${event.id}`} className="hover:text-gray-700">Event Details</Link>
          <span>/</span>
          <span className="text-gray-900">Registration</span>
        </nav>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Event Registration</h1>
          
          {/* Event Summary */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{event.title}</h2>
            <div className="space-y-1 text-sm text-gray-600">
              <p><strong>Date:</strong> {formatDate(event.start_date)}</p>
              {event.registration_fee && (
                <p><strong>Fee:</strong> ${event.registration_fee}</p>
              )}
              <p><strong>Location:</strong> {event.location || siteConfig.name}</p>
            </div>
          </div>

          {/* Registration Form Placeholder */}
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Registration Form Coming Soon</h3>
            <p className="text-gray-600 mb-6">
              We&apos;re working on building the registration system. In the meantime, please contact us directly to register for this event.
            </p>
            
            <div className="space-y-3">
              <Link
                to="/contact"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Contact Us to Register
              </Link>
              
              <div className="text-sm text-gray-500">
                <p>Call: {siteConfig.contact.phone}</p>
                <p>Email: {siteConfig.contact.email}</p>
              </div>
            </div>
          </div>

          {/* External Registration Link */}
          {event.external_url && (
            <div className="border-t pt-6 mt-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">External Registration Available</h3>
                <p className="text-sm text-blue-800 mb-3">
                  This event also has external registration available through the official event website.
                </p>
                <a
                  href={event.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Register on Official Site
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}