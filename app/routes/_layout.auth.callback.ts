import {type LoaderFunctionArgs, redirect} from "@vercel/remix";
import {getSupabaseServerClient} from "~/utils/supabase.server";

// This route handles the server-side exchange of the verification code
// for a valid user session. Supabase redirects here after email confirmation.
export async function loader({request}: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    // Default redirect after login is now /family
    const next = url.searchParams.get("next") || "/family";

    if (code) {
        const {supabaseServer, response:{headers}} = getSupabaseServerClient(request);
        const {error} = await supabaseServer.auth.exchangeCodeForSession(code);

        if (!error) {
            // Successfully exchanged code for session.
            // Check user role for appropriate redirect (similar to login)
            const {data: {user}} = await supabaseServer.auth.getUser();
            if (user) {
                // Use maybeSingle() to handle potential duplicate profiles gracefully
                const {data: profile, error: profileError} = await supabaseServer
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle();

                if (profileError) {
                    console.error("Error fetching profile during auth callback:", profileError.message);
                    // Continue with login even if profile fetch fails
                }

                if (profile?.role === 'admin') {
                    return redirect("/admin", {headers});
                } else if (profile?.role === 'instructor') {
                    return redirect("/instructor", {headers});
                }
            }
            // Default redirect for non-admins or if profile fetch fails
            return redirect(next, {headers});
        } else {
            console.error("Auth Callback Error:", error.message, error);

            // PKCE flow error - code verifier missing (common when opening link in different browser)
            if (error.message.includes('code verifier') || error.message.includes('invalid request')) {
                console.warn("PKCE flow issue detected - redirecting to login with helpful message");
                return redirect("/login?error=email_confirmed&message=" + encodeURIComponent("Your email has been confirmed! Please log in with your email and password."), {headers});
            }

            // Other auth errors
            return redirect("/login?error=auth_callback_failed&message=" + encodeURIComponent("Email confirmation failed. Please try logging in or contact support."), {headers});
        }
    }

    // If no code is present, maybe the user navigated here directly
    console.warn("Auth Callback: No code found in URL.");
    return redirect("/login?error=invalid_callback", {headers: {}});
}
