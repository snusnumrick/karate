import { Link, useActionData, useNavigation } from "@remix-run/react";
import { ActionFunctionArgs, json, TypedResponse } from "@vercel/remix";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { getSupabaseServerClient } from "~/utils/supabase.server";

interface ActionResponse {
    error?: string;
    message?: string;
}

export async function action({ request }: ActionFunctionArgs): Promise<TypedResponse<ActionResponse>> {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const { supabaseServer, response } = getSupabaseServerClient(request);
    const headers = response.headers;

    if (!email) {
        return json({ error: "Email address is required." }, { status: 400, headers });
    }

    // Construct the redirect URL for the password reset link
    const url = new URL(request.url);
    const resetRedirectTo = `${url.origin}/reset-password`;

    const { error } = await supabaseServer.auth.resetPasswordForEmail(email, {
        redirectTo: resetRedirectTo,
    });

    if (error) {
        console.error("Password reset error:", error.message);
        return json({ error: "Failed to send password reset email. Please try again." }, { status: 500, headers });
    }

    return json({
        message: `A password reset link has been sent to ${email}. Please check your inbox and spam folder.`
    }, { headers });
}

export default function ForgotPasswordPage() {
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === 'submitting';

    return (
        <div className="min-h-screen page-background-styles flex flex-col">
            <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        Reset your password
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        Enter your email address and we&apos;ll send you a link to reset your password.
                    </p>
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="form-container-styles py-8 px-4 sm:px-10">
                        <form className="space-y-6" method="post">
                            {/* Display success message */}
                            {actionData?.message && (
                                <Alert variant="default">
                                    <AlertTitle className="dark:text-green-200">Email Sent</AlertTitle>
                                    <AlertDescription className="dark:text-green-300">
                                        {actionData.message}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Display error message */}
                            {actionData?.error && (
                                <Alert variant="destructive">
                                    <AlertTitle className="dark:text-red-200">Error</AlertTitle>
                                    <AlertDescription className="dark:text-red-300">
                                        {actionData.error}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="email" className="dark:text-gray-200">Email address</Label>
                                    <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    placeholder="Enter your email address"
                                    disabled={isSubmitting || !!actionData?.message}
                                    className="input-custom-styles"
                                />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50"
                                    disabled={isSubmitting || !!actionData?.message}
                                >
                                    {isSubmitting ? 'Sending...' : 'Send reset link'}
                                </Button>

                                <div className="text-center">
                                    <Link
                                        to="/login"
                                        className="font-medium text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300"
                                    >
                                        Back to sign in
                                    </Link>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}