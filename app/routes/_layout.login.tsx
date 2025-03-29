import { Link, useActionData } from "@remix-run/react";
import { ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { getSupabaseServerClient } from "~/utils/supabase.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const { supabaseServer, headers } = getSupabaseServerClient(request);

  if (!email || !password) {
    return json({ error: "Email and password are required." }, { status: 400, headers });
  }

  const { data: authData, error: authError } = await supabaseServer.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    console.error("Login error:", authError?.message);
    return json({ error: "Invalid login credentials." }, { status: 401, headers });
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
            {actionData?.error && (
              <Alert variant="destructive">
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{actionData.error}</AlertDescription>
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
