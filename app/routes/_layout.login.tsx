import { Link, useActionData, useFetcher, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import { ActionFunctionArgs, json, LoaderFunctionArgs, redirect, TypedResponse } from "@vercel/remix";
import { AuthApiError } from "@supabase/supabase-js"; // Import AuthApiError
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Checkbox} from "~/components/ui/checkbox";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import { clearSupabaseAuthCookies } from "~/utils/auth-cookies.server";
import { DEFAULT_RETRY_AFTER_SECONDS, formatRetryDelay } from "~/utils/login-rate-limit";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import type {ResendActionData} from "~/routes/api.resend-confirmation"; // Import the type
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { resolveLoginCopy } from "~/utils/login-page-copy";
import { resolvePostLoginRedirect } from "~/utils/post-login-redirect";
import { getSupabaseBrowserAuthClient } from "~/utils/supabase.client";

interface ActionResponse {
    error?: string;
    email?: string;
    retryAfterSeconds?: number;
}

export async function loader({request}: LoaderFunctionArgs) {
    const { ENV } = getSupabaseServerClient(request);
    return json({ ENV });
}

export async function action({request}: ActionFunctionArgs)
    : Promise<TypedResponse<ActionResponse>> {
    const {
        clearLoginRateLimitCookie,
        getLoginRateLimitState,
        setLoginRateLimitCookie,
    } = await import("~/utils/login-rate-limit.server");

    try {
        await csrf.validate(request);
    } catch (error) {
        console.error("CSRF validation failed:", error);
        return json({error: "Security token validation failed. Please refresh the page and try again."}, {status: 403});
    }
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const rateLimitState = getLoginRateLimitState(request);

    console.log(`[Login Action] Triggered at ${new Date().toISOString()} for email: ${email || 'N/A'}`); // Add logging here

    if (!email || !password) {
        console.log("[Login Action] Failed: Missing email or password."); // Add logging
        return json({error: "Email and password are required.", email: email}, {status: 400, headers});
    }

    if (rateLimitState.isLimited) {
        return json({
            error: `Too many login attempts. Please wait ${formatRetryDelay(rateLimitState.retryAfterSeconds)} before trying again.`,
            email,
            retryAfterSeconds: rateLimitState.retryAfterSeconds,
        }, { status: 429, headers });
    }

    // If the browser is carrying stale Supabase auth cookies, clear them before issuing a fresh sign-in.
    clearSupabaseAuthCookies(request, headers);

    console.log("[Login Action] Attempting supabaseServer.auth.signInWithPassword..."); // Add logging
    const {data: authData, error: authError} = await supabaseServer.auth.signInWithPassword({
        email,
        password,
    });
    // console.log("Login attempt for:", email, "Result:", authData?.user, "Error:", authError); // Log the full error

    if (authError || !authData.user) {
        console.error("Login error:", authError?.message, "Status:", (authError as AuthApiError)?.status); // Log status if available

        // Check for Rate Limit Error (HTTP 429)
        if (authError instanceof AuthApiError && authError.status === 429) {
            setLoginRateLimitCookie(headers, DEFAULT_RETRY_AFTER_SECONDS);
             return json({
                error: `Too many login attempts. Supabase is temporarily rate limiting sign-ins from this connection. Please wait ${formatRetryDelay(DEFAULT_RETRY_AFTER_SECONDS)} and try once.`,
                email,
                retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS,
            }, { status: 429, headers });
        }

        // Check for specific "Email not confirmed" error
        // Note: Relying on the exact error message string might be fragile if Supabase changes it.
        // Consider checking a specific error code if Supabase provides one in the future.
        if (authError?.message === 'Email not confirmed') {
            // Return the specific error and the email address
            return json({
                error: "Please check your inbox and confirm your email address before logging in.",
                email: email // Include email for the resend action
            }, {status: 401, headers});
        }
        // Generic error for other auth issues
        return json({error: "Invalid login credentials."}, {status: 401, headers});
    }

    // If signInWithPassword succeeded, double-check if the email is confirmed on the user object.
    // There might be a slight delay, or the error check above might miss an edge case.
    if (!authData.user.email_confirmed_at) {
        console.warn(`Login successful for ${email}, but email_confirmed_at is still missing on the returned user object.`);
        // Re-trigger the "Email not confirmed" flow
        return json({
            error: "Please check your inbox and confirm your email address before logging in.",
            email: email // Include email for the resend action
        }, {status: 401, headers});
    }

    // Fetch user profile to check role
    // Use maybeSingle() to handle potential duplicate profiles gracefully
    const {data: profile, error: profileError} = await supabaseServer
        .from('profiles') // Make sure 'profiles' is the correct table name
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();

    // Handle database errors (but not missing profiles)
    if (profileError) {
        console.error("Profile fetch error:", profileError?.message);
        // Log the error but allow login to proceed - they might need to complete setup
    }

    // Determine redirect target
    const redirectTo = resolvePostLoginRedirect(formData.get('redirectTo'), profile?.role);

    clearLoginRateLimitCookie(headers);

    return redirect(redirectTo, {headers});
}
export default function LoginPage() {
    const actionData = useActionData<typeof action>();
    const { ENV } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<ResendActionData>(); // Use the imported type
    const navigation = useNavigation(); // Get navigation state
    const [searchParams] = useSearchParams();
    const successMessage = searchParams.get('message');
    const redirectTo = searchParams.get('redirectTo') || undefined;
    const { heading, linkPrefix, linkLabel, linkHref, linkSuffix, extraMessage } = resolveLoginCopy(redirectTo);
    const supabase = useMemo(() => {
        if (typeof window === "undefined") {
            return null;
        }

        return getSupabaseBrowserAuthClient({
            url: ENV.SUPABASE_URL,
            anonKey: ENV.SUPABASE_ANON_KEY,
        });
    }, [ENV.SUPABASE_ANON_KEY, ENV.SUPABASE_URL]);
    const [clientActionData, setClientActionData] = useState<ActionResponse | null>(null);
    const [isClientSubmitting, setIsClientSubmitting] = useState(false);
    const displayActionData = clientActionData ?? actionData;
    const isSubmitting = navigation.state === 'submitting' || isClientSubmitting;
    const [retryAfterSeconds, setRetryAfterSeconds] = useState(displayActionData?.retryAfterSeconds ?? 0);

    useEffect(() => {
        setRetryAfterSeconds(displayActionData?.retryAfterSeconds ?? 0);
    }, [displayActionData?.retryAfterSeconds]);

    useEffect(() => {
        if (retryAfterSeconds <= 0) {
            return;
        }

        const timer = window.setInterval(() => {
            setRetryAfterSeconds((current) => Math.max(0, current - 1));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [retryAfterSeconds]);

    // Define a type for the resend action data if needed, or use inline type
    // type ResendActionData = { success?: boolean; error?: string };
    // const fetcher = useFetcher<ResendActionData>();

    const isUnconfirmedEmailError = displayActionData?.error === "Please check your inbox and confirm your email address before logging in.";

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        if (!supabase) {
            return;
        }

        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;
        const redirectTarget = formData.get("redirectTo");

        if (!email || !password) {
            setClientActionData({
                error: "Email and password are required.",
                email,
            });
            return;
        }

        if (retryAfterSeconds > 0) {
            return;
        }

        setIsClientSubmitting(true);
        setClientActionData(null);

        try {
            console.log("[Login Page] Attempting browser-side supabase.auth.signInWithPassword...");
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError || !authData.user) {
                console.error("Browser login error:", authError?.message, "Status:", (authError as AuthApiError)?.status);

                if (authError instanceof AuthApiError && authError.status === 429) {
                    setClientActionData({
                        error: `Too many login attempts. Supabase is temporarily rate limiting sign-ins from this connection. Please wait ${formatRetryDelay(DEFAULT_RETRY_AFTER_SECONDS)} and try once.`,
                        email,
                        retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS,
                    });
                    return;
                }

                if (authError?.message === "Email not confirmed") {
                    setClientActionData({
                        error: "Please check your inbox and confirm your email address before logging in.",
                        email,
                    });
                    return;
                }

                setClientActionData({ error: "Invalid login credentials." });
                return;
            }

            if (!authData.user.email_confirmed_at) {
                setClientActionData({
                    error: "Please check your inbox and confirm your email address before logging in.",
                    email,
                });
                return;
            }

            const postLoginUrl = new URL("/auth/post-login", window.location.origin);
            if (typeof redirectTarget === "string" && redirectTarget) {
                postLoginUrl.searchParams.set("redirectTo", redirectTarget);
            }

            window.location.assign(postLoginUrl.toString());
        } finally {
            setIsClientSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen page-background-styles flex flex-col">
            {/* Login form container */}
            <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        {heading}
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
                        {linkPrefix}
                        {linkHref && linkLabel ? (
                            <Link to={linkHref}
                                  data-testid="register-link"
                                  className="font-medium text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300">
                                {linkLabel}
                            </Link>
                        ) : linkLabel}
                        {linkSuffix ?? ''}
                    </p>
                    {extraMessage && (
                        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-300">
                            {extraMessage}
                        </p>
                    )}
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="form-container-styles py-8 px-4 sm:px-10">
                        <form className="space-y-6" method="post" onSubmit={handleSubmit}>
                            <AuthenticityTokenInput />
                            {redirectTo && (
                                <input type="hidden" name="redirectTo" value={redirectTo} />
                            )}
                            {/* Display success message from URL params */}
                            {successMessage && (
                                <Alert variant="default">
                                    <AlertTitle className="dark:text-green-200">Success</AlertTitle>
                                    <AlertDescription className="dark:text-green-300">
                                        {successMessage}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Display Login Errors */}
                            {displayActionData?.error && (
                                <Alert variant="destructive">
                                    <AlertTitle className="dark:text-red-200">Login Failed</AlertTitle>
                                    <AlertDescription className="dark:text-red-300">
                                        {displayActionData.error}
                                        {/* Show Resend option only for the specific error and if email is available */}
                                        {isUnconfirmedEmailError && displayActionData.email && (
                                            <div className="mt-2">
                                                <Button
                                                    type="button"
                                                    variant="link"
                                                    className="p-0 h-auto text-red-300 hover:text-red-200 dark:text-red-300 dark:hover:text-red-200 underline"
                                                    disabled={fetcher.state !== 'idle'}
                                                    onClick={() => {
                                                        const formData = new FormData();
                                                        formData.append('email', displayActionData.email || '');
                                                        fetcher.submit(formData, {
                                                            method: 'post',
                                                            action: '/api/resend-confirmation'
                                                        });
                                                    }}
                                                >
                                                    {fetcher.state === 'submitting' ? 'Sending...' : 'Resend Confirmation Email'}
                                                </Button>
                                            </div>
                                        )}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Display Resend Feedback */}
                            {fetcher.data && (
                                <Alert variant={fetcher.data.error ? "destructive" : "default"} className="mt-4">
                                    <AlertTitle
                                        className={fetcher.data.error ? "dark:text-red-200" : "dark:text-green-200"}>
                                        {fetcher.data.error ? 'Resend Failed' : 'Email Sent'}
                                    </AlertTitle>
                                    <AlertDescription
                                        className={fetcher.data.error ? "dark:text-red-300" : "dark:text-green-300"}>
                                        {fetcher.data.error || 'Confirmation email has been resent. Please check your inbox.'}
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
                                    placeholder="Enter your email"
                                    disabled={isSubmitting}
                                    data-testid="email-input"
                                    className="input-custom-styles"
                                    tabIndex={1}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password" className="dark:text-gray-200">Password</Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    placeholder="Enter your password"
                                    disabled={isSubmitting}
                                    data-testid="password-input"
                                    className="input-custom-styles"
                                    tabIndex={2}
                                />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="remember-me" name="remember-me" tabIndex={3}/>
                                        <Label htmlFor="remember-me" className="dark:text-gray-300">Remember me</Label>
                                    </div>

                                    <div className="text-sm">
                                        <Link to="/forgot-password"
                                           data-testid="forgot-password-link"
                                           className="font-medium text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300">
                                            Forgot your password?
                                        </Link>
                                    </div>
                                </div>

                                    <Button
                                    type="submit"
                                    data-testid="login-submit-button"
                                    className="w-full bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50"
                                    disabled={isSubmitting || retryAfterSeconds > 0} // Disable button when submitting
                                    tabIndex={4}
                                >
                                    {isSubmitting
                                        ? 'Signing in...'
                                        : retryAfterSeconds > 0
                                            ? `Try again in ${retryAfterSeconds}s`
                                            : 'Sign in'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
