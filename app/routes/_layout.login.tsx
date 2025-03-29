import { Link, useActionData, useFetcher } from "@remix-run/react";
import {ActionFunctionArgs, json, redirect, TypedResponse} from "@remix-run/node";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import type { ResendActionData } from "~/routes/api.resend-confirmation"; // Import the type

interface ActionResponse {
  error?: string;
  email?: string;
}

export async function action({ request }: ActionFunctionArgs)
    : Promise<TypedResponse<ActionResponse>>{
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;

  if (!email || !password) {
    return json({ error: "Email and password are required.", email: email }, { status: 400, headers });
  }

  const { data: authData, error: authError } = await supabaseServer.auth.signInWithPassword({
    email,
    password,
  });
  console.log("Login attempt for:", email, "Result:", authData?.user, "Error:", authError?.message);

  if (authError || !authData.user) {
    console.error("Login error:", authError?.message);
    // Check for specific "Email not confirmed" error
    // Note: Relying on the exact error message string might be fragile if Supabase changes it.
    if (authError?.message === 'Email not confirmed') {
      // Return the specific error and the email address
      return json({
        error: "Please check your inbox and confirm your email address before logging in.",
        email: email // Include email for the resend action
      }, { status: 401, headers });
    }
    // Generic error for other auth issues
    return json({ error: "Invalid login credentials." }, { status: 401, headers });
  }

  // If signInWithPassword succeeded, double-check if the email is confirmed on the user object.
  // There might be a slight delay, or the error check above might miss an edge case.
  if (!authData.user.email_confirmed_at) {
      console.warn(`Login successful for ${email}, but email_confirmed_at is still missing on the returned user object.`);
      // Re-trigger the "Email not confirmed" flow
      return json({
        error: "Please check your inbox and confirm your email address before logging in.",
        email: email // Include email for the resend action
      }, { status: 401, headers });
  }

  // Fetch user profile to check role
  // Ensure you have a 'profiles' table with 'id' (UUID matching auth.users.id) and 'role' columns.
  const { data: profile, error: profileError } = await supabaseServer
    .from('profiles') // Make sure 'profiles' is the correct table name
    .select('role')
    .eq('id', authData.user.id)
    .single();

  // Handle cases where profile might not exist yet or error fetching
  if (profileError && profileError.code !== 'PGRST116') { // PGRST116: Row not found
    console.error("Profile fetch error:", profileError?.message);
    // Optional: Log out the user if profile is mandatory?
    // await supabaseServer.auth.signOut();
    return json({ error: "Could not retrieve user profile." }, { status: 500, headers });
  }

  // Determine redirect path
  let redirectTo = "/waivers"; // Default redirect for non-admin users
  if (profile?.role === 'admin') {
    redirectTo = "/admin";
  }
  // Add other role checks here if needed, e.g., 'instructor'

  return redirect(redirectTo, { headers });
}


export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const fetcher = useFetcher<ResendActionData>(); // Use the imported type

  // Define a type for the resend action data if needed, or use inline type
  // type ResendActionData = { success?: boolean; error?: string };
  // const fetcher = useFetcher<ResendActionData>();

  const isUnconfirmedEmailError = actionData?.error === "Please check your inbox and confirm your email address before logging in.";

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-gray-800 flex flex-col">
      {/* Login form container */}
      <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{" "}
          <Link to="/register" className="font-medium text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300">
            register for classes
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-700 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" method="post">
            {/* Display Login Errors */}
            {actionData?.error && (
              <Alert variant="destructive">
                <AlertTitle className="dark:text-red-200">Login Failed</AlertTitle>
                <AlertDescription className="dark:text-red-300">
                  {actionData.error}
                  {/* Show Resend option only for the specific error and if email is available */}
                  {isUnconfirmedEmailError && actionData.email && (
                    <fetcher.Form method="post" action="/api/resend-confirmation" className="mt-2">
                      <input type="hidden" name="email" value={actionData.email} />
                      <Button
                        type="submit"
                        variant="link"
                        className="p-0 h-auto text-red-300 hover:text-red-200 dark:text-red-300 dark:hover:text-red-200 underline"
                        disabled={fetcher.state !== 'idle'}
                      >
                        {fetcher.state === 'submitting' ? 'Sending...' : 'Resend Confirmation Email'}
                      </Button>
                    </fetcher.Form>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Display Resend Feedback */}
            {fetcher.data && (
              <Alert variant={fetcher.data.error ? "destructive" : "default"} className="mt-4">
                 <AlertTitle className={fetcher.data.error ? "dark:text-red-200" : "dark:text-green-200"}>
                   {fetcher.data.error ? 'Resend Failed' : 'Email Sent'}
                 </AlertTitle>
                 <AlertDescription className={fetcher.data.error ? "dark:text-red-300" : "dark:text-green-300"}>
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
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember-me" name="remember-me" />
                  <Label htmlFor="remember-me" className="dark:text-gray-300">Remember me</Label>
                </div>

                <div className="text-sm">
                  <a href="/forgot-password" className="font-medium text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300">
                    Forgot your password?
                  </a>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800"
              >
                Sign in
              </Button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
}
