import { type LoaderFunctionArgs, redirect } from "@vercel/remix";
import { getOptionalUser } from "~/utils/auth.server";
import { getUserRole } from "~/utils/supabase.server";
import { resolvePostLoginRedirect } from "~/utils/post-login-redirect";

export async function loader({ request }: LoaderFunctionArgs) {
  const { user, response: { headers } } = await getOptionalUser(request);
  const url = new URL(request.url);

  if (!user) {
    const redirectTo = url.searchParams.get("redirectTo");
    const loginUrl = redirectTo
      ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
      : "/login";

    return redirect(loginUrl, { headers });
  }

  const role = await getUserRole(user.id);
  const redirectTo = resolvePostLoginRedirect(url.searchParams.get("redirectTo"), role);

  return redirect(redirectTo, { headers });
}
