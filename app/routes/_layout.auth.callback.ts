import { type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { getSupabaseServerClient } from "~/utils/supabase.server";

// This route handles the server-side exchange of the verification code
// for a valid user session. Supabase redirects here after email confirmation.
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Default redirect after login is now /family
  const next = url.searchParams.get("next") || "/family";

  if (code) {
    const { supabaseServer, headers } = getSupabaseServerClient(request);
    const { error } = await supabaseServer.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successfully exchanged code for session.
      // Check user role for appropriate redirect (similar to login)
      const { data: { user } } = await supabaseServer.auth.getUser();
      if (user) {
        const { data: profile } = await supabaseServer
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'admin') {
          return redirect("/admin", { headers });
        }
      }
      // Default redirect for non-admins or if profile fetch fails
      return redirect(next, { headers });
    } else {
      console.error("Auth Callback Error:", error.message);
      // Handle error, maybe redirect to a specific error page or login with an error message
      return redirect("/login?error=auth_callback_failed", { headers });
    }
  }

  // If no code is present, maybe the user navigated here directly
  console.warn("Auth Callback: No code found in URL.");
  return redirect("/login?error=invalid_callback", { headers: {} });
}
