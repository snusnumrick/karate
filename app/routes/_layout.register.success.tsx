import {Link} from "@remix-run/react";
import {Button} from "~/components/ui/button";

export default function RegistrationSuccessPage() {
    return (
        <div
            className="min-h-screen page-background-styles py-12 text-foreground flex items-center justify-center">
            <div className="max-w-md w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md text-center">
                    <div
                        className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-green-100 dark:bg-green-900 rounded-full">
                        <svg className="w-8 h-8 text-green-600 dark:text-green-300" fill="none" stroke="currentColor"
                             viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-4">Registration
                        Submitted!</h1>
                    <p className="text-muted-foreground mb-6">
                        Thank you for registering! Your information has been received. You can now log in to your
                        account.
                    </p>
                    <Button asChild className="bg-green-600 text-white hover:bg-green-700">
                        <Link to="/login">Go to Login</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
