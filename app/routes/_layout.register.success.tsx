import {Link, useLoaderData} from "@remix-run/react";
import {json, type LoaderFunctionArgs} from "@remix-run/node";
import {Button} from "~/components/ui/button";
import {Users, Shield, Calendar, CheckCircle, Ticket, Mail} from 'lucide-react';
import {EventService} from "~/services/event.server";

type LoaderData = {
    event?: {
        id: string;
        title: string;
    } | null;
    redirectTo?: string;
};

export async function loader({request}: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirectTo');

    // Check if redirectTo contains an event registration URL
    if (redirectTo) {
        const eventMatch = redirectTo.match(/\/events\/([^/]+)\/register/);
        if (eventMatch) {
            const eventId = eventMatch[1];
            try {
                const fullEvent = await EventService.getEventById(eventId);
                if (fullEvent) {
                    return json<LoaderData>({
                        event: {
                            id: fullEvent.id,
                            title: fullEvent.title
                        },
                        redirectTo
                    });
                }
            } catch (error) {
                console.error('Error fetching event for success page:', error);
                // Fall through to default success page
            }
        }
    }

    return json<LoaderData>({event: null, redirectTo: redirectTo || undefined});
}

export default function RegistrationSuccessPage() {
    const {event, redirectTo} = useLoaderData<LoaderData>();

    return (
        <div
            className="min-h-screen page-background-styles py-12 text-foreground flex items-center justify-center">
            <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
                    {/* Success Icon */}
                    <div className="text-center mb-8">
                        <div
                            className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-green-100 dark:bg-green-900 rounded-full">
                            <svg className="w-8 h-8 text-green-600 dark:text-green-300" fill="none" stroke="currentColor"
                                 viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                      d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">Registration
                            Complete!</h1>
                        <p className="text-muted-foreground">
                            Thank you for registering! Your family account has been created.
                        </p>
                    </div>

                    {/* Next Steps Section */}
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Next Steps:</h2>
                        <div className="space-y-3">
                            {/* Step 1: Account Created */}
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                <div className="flex-shrink-0 mt-0.5">
                                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400"/>
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">Account Created</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Your family account has been set up</p>
                                </div>
                            </div>

                            {/* Step 2: Email Confirmation - HIGHLIGHTED AS NEXT ACTION */}
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500">
                                <div className="flex-shrink-0 mt-0.5">
                                    <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400"/>
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                                        Check Your Email
                                    </p>
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        We've sent you a confirmation email. Click the link to verify your email address before logging in.
                                    </p>
                                </div>
                            </div>

                            {/* Step 3: Add Students */}
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                <div className="flex-shrink-0 mt-0.5">
                                    <Users className="h-5 w-5 text-gray-600 dark:text-gray-400"/>
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">
                                        Add Your Student(s)
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {event
                                            ? `Add the students who will participate in ${event.title}`
                                            : 'After logging in, add your student(s) to get started with class enrollment'
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Step 3: Complete Event Registration (event only) */}
                            {event && (
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                    <div className="flex-shrink-0 mt-0.5">
                                        <Ticket className="h-5 w-5 text-gray-600 dark:text-gray-400"/>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900 dark:text-gray-100">Complete Event Registration</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Select participants for <strong>{event.title}</strong> and complete registration
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Sign Waivers */}
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                <div className="flex-shrink-0 mt-0.5">
                                    <Shield className="h-5 w-5 text-gray-600 dark:text-gray-400"/>
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">Complete Waivers</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {event ? 'Sign required waivers during event registration' : 'Sign required waivers to complete registration'}
                                    </p>
                                </div>
                            </div>

                            {/* Step 5: Browse Classes or Payment */}
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                <div className="flex-shrink-0 mt-0.5">
                                    <Calendar className="h-5 w-5 text-gray-600 dark:text-gray-400"/>
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">
                                        {event ? 'Complete Payment' : 'Enroll in Classes'}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {event ? 'Finalize your event registration with payment' : 'Browse our schedule and register your students for classes'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <div className="text-center">
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                                ⚠️ Important: You must confirm your email before you can log in
                            </p>
                        </div>
                        <Button asChild className="bg-blue-600 text-white hover:bg-blue-700 w-full sm:w-auto px-8">
                            <Link to={event
                                ? `/login?redirectTo=${encodeURIComponent(`/family/add-student?returnTo=${encodeURIComponent(redirectTo || '')}`)}`
                                : '/login'
                            }>
                                I've Confirmed My Email - Continue to Login
                            </Link>
                        </Button>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                            {event
                                ? `After logging in and adding a student, you'll continue to ${event.title} registration`
                                : "After logging in, you'll be able to add students and enroll in classes"
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
