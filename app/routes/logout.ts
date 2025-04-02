import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { getSupabaseServerClient } from "~/utils/supabase.server";

// Action function to handle the POST request for logout
export async function action({ request }: ActionFunctionArgs) {
  // console.log("Entering /logout action...");
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;

  // Ensure it's a POST request (though Remix routing usually handles this)
  if (request.method !== "POST") {
    console.error("/logout action - Method not allowed:", request.method);
    // Set Allow header for 405 response
    headers.set("Allow", "POST");
    return new Response("Method Not Allowed", { status: 405, headers });
  }

  console.warn("/logout action - Signing out user...");
  const { error } = await supabaseServer.auth.signOut();

  if (error) {
    console.error("Error during sign out:", error.message);
    // Optionally, redirect with an error message or handle differently
    // For simplicity, we still redirect to login, but log the error server-side.
  } else {
    // console.log("/logout action - Sign out successful.");
  }

  // console.log("/logout action - Redirecting to /login...");
  // Redirect to the login page after sign out, passing headers to clear session cookies
  return redirect("/login", { headers });
}

// Loader function to disallow GET requests to this route
export async function loader({ request }: LoaderFunctionArgs) {
  console.log("Entering /logout loader (should not be called via GET)...");
  const { response:{headers} } = getSupabaseServerClient(request); // Get headers for response
  // Set Allow header for 405 response
  headers.set("Allow", "POST");
  throw new Response("Method Not Allowed", { status: 405, headers });
}
