import { type ActionFunctionArgs, json } from "@remix-run/node";
import { getSupabaseServerClient } from "~/utils/supabase.server";

// Define the expected return type for the fetcher typing in LoginPage
export type ResendActionData = { success?: boolean; error?: string };

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const { supabaseServer, headers } = getSupabaseServerClient(request); // Pass request for headers

  if (!email) {
    return json<ResendActionData>({ error: "Email is required." }, { status: 400, headers });
  }

  // Construct the redirect URL for the confirmation link *within* the resent email
  // This should match the one used in registration
  const url = new URL(request.url); // Use request URL to get origin
  const emailRedirectTo = `${url.origin}/auth/callback`;

  console.log(`Resending confirmation email to: ${email} with redirect: ${emailRedirectTo}`);

  const { error } = await supabaseServer.auth.resend({
    type: 'signup', // Use 'signup' for initial confirmation, 'email_change' for email changes etc.
    email: email,
    options: {
      emailRedirectTo: emailRedirectTo,
    }
  });

  if (error) {
    console.error("Resend Confirmation Error:", error.message);
    // Provide a more user-friendly error message if possible
    let userErrorMessage = "Failed to resend confirmation email. Please try again later.";
    if (error.message.includes("rate limit")) { // Example: Check for specific errors
        userErrorMessage = "You have requested this too recently. Please wait a moment before trying again.";
    }
    // Avoid exposing raw Supabase errors directly to the client
    return json<ResendActionData>({ error: userErrorMessage }, { status: 500, headers });
  }

  console.log(`Confirmation email successfully resent to: ${email}`);
  return json<ResendActionData>({ success: true }, { headers });
}

// Optional: Add a loader function that returns a 405 Method Not Allowed
// if someone tries to GET this route.
export async function loader() {
  throw new Response("Method Not Allowed", { status: 405 });
}
