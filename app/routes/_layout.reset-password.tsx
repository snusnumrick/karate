import { Link, useActionData, useNavigation, useLoaderData } from "@remix-run/react";
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect, TypedResponse } from "@vercel/remix";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";

interface ActionResponse {
    error?: string;
    success?: boolean;
}

interface LoaderData {
    isValidSession: boolean;
    error?: string;
}

export async function loader({ request }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const url = new URL(request.url);
    const tokenHash = url.searchParams.get("token_hash");
    const otpToken = url.searchParams.get("token");
    const accessToken = url.searchParams.get("access_token");
    const refreshToken = url.searchParams.get("refresh_token");
    const authCode = url.searchParams.get("code");
    const rawEmail = url.searchParams.get("email");
    const emailParam = rawEmail ? decodeURIComponent(rawEmail) : null;
    const type = url.searchParams.get("type");
    const { supabaseServer, response } = getSupabaseServerClient(request);
    const headers = response.headers;

    // Debug logging
    console.log("Reset password loader - URL params:", {
        tokenHash,
        otpToken,
        accessToken: accessToken ? "present" : "missing",
        refreshToken: refreshToken ? "present" : "missing",
        authCode,
        email: emailParam,
        type,
        fullUrl: url.toString()
    });

    const ensureSession = async () => {
        const { data: { user } } = await supabaseServer.auth.getUser();
        if (!user) {
            return json({ isValidSession: false, error: "Failed to authenticate reset session." }, { headers });
        }
        return json({ isValidSession: true }, { headers });
    };

    const { data: { user } } = await supabaseServer.auth.getUser();
    if (user) {
        return json({ isValidSession: true }, { headers });
    }

    // If there's a token_hash and type=recovery, verify the OTP (password recovery flow)
    if (tokenHash && type === "recovery") {
        const { error } = await supabaseServer.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
        });
        
        if (error) {
            console.error("Password reset verification error:", error.message);
            return json({ isValidSession: false, error: "Invalid or expired reset link." }, { headers });
        }
        return ensureSession();
    }

    // Handle PKCE flow - token parameter (used by Supabase email links)
    if (otpToken && type === "recovery") {
        const { error } = await supabaseServer.auth.exchangeCodeForSession(otpToken);
        if (error) {
            console.error("Password reset PKCE exchangeCode error:", error.message);
            return json({ isValidSession: false, error: "Invalid or expired reset link." }, { headers });
        }
        return ensureSession();
    }

    // Handle auth code (PKCE flow) - type parameter may not be present after redirect
    if (authCode) {
        const { error } = await supabaseServer.auth.exchangeCodeForSession(authCode);
        if (error) {
            console.error("Password reset exchangeCode error:", error.message);
            return json({ isValidSession: false, error: "Invalid or expired reset link." }, { headers });
        }
        return ensureSession();
    }

    if (accessToken && refreshToken && type === "recovery") {
        const { error } = await supabaseServer.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        });
        if (error) {
            console.error("Password reset setSession error:", error.message);
            return json({ isValidSession: false, error: "Invalid or expired reset link." }, { headers });
        }
        return ensureSession();
    }

    return json({ isValidSession: false, error: "Invalid or expired reset link." }, { headers });
}

export async function action({ request }: ActionFunctionArgs): Promise<TypedResponse<ActionResponse>> {
    await csrf.validate(request);
    const formData = await request.formData();
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const { supabaseServer, response } = getSupabaseServerClient(request);
    const headers = response.headers;

    if (!password || !confirmPassword) {
        return json({ error: "Both password fields are required." }, { status: 400, headers });
    }

    if (password !== confirmPassword) {
        return json({ error: "Passwords do not match." }, { status: 400, headers });
    }

    if (password.length < 6) {
        return json({ error: "Password must be at least 6 characters long." }, { status: 400, headers });
    }

    // Check if user is authenticated (they should be after clicking the reset link)
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
        return json({ error: "Invalid or expired reset link. Please request a new password reset." }, { status: 401, headers });
    }

    // Update the user's password
    const { error } = await supabaseServer.auth.updateUser({
        password: password
    });

    if (error) {
        console.error("Password update error:", error.message);
        return json({ error: "Failed to update password. Please try again." }, { status: 500, headers });
    }

    // Redirect to login page with success message
    return redirect("/login?message=Password updated successfully. Please sign in with your new password.", { headers });
}

export default function ResetPasswordPage() {
    const actionData = useActionData<typeof action>();
    const loaderData = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === 'submitting';
    const { isValidSession, error: loaderError } = loaderData;

    if (!isValidSession) {
        return (
            <div className="min-h-screen page-background-styles flex flex-col justify-center items-center">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="form-container-styles py-8 px-4 sm:px-10">
                        <Alert variant="destructive">
                            <AlertTitle className="dark:text-red-200">Invalid Reset Link</AlertTitle>
                            <AlertDescription className="dark:text-red-300">
                                {loaderError || "This password reset link is invalid or has expired. Please request a new one."}
                            </AlertDescription>
                        </Alert>
                        <div className="mt-6 text-center">
                            <Link
                                to="/forgot-password"
                                className="font-medium text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300"
                            >
                                Request new reset link
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen page-background-styles flex flex-col">
            <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        Set new password
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        Enter your new password below.
                    </p>
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="form-container-styles py-8 px-4 sm:px-10">
                        <form className="space-y-6" method="post">
                            <AuthenticityTokenInput />
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
                                    <Label htmlFor="password" className="dark:text-gray-200">New Password</Label>
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        minLength={6}
                                        placeholder="Enter your new password"
                                        disabled={isSubmitting}
                                        className="input-custom-styles"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="confirmPassword" className="dark:text-gray-200">Confirm New Password</Label>
                                    <Input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        minLength={6}
                                        placeholder="Confirm your new password"
                                        disabled={isSubmitting}
                                        className="input-custom-styles"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Updating...' : 'Update password'}
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
