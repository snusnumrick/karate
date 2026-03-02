import { redirect } from "@vercel/remix";
import type { Session } from '@supabase/auth-helpers-remix';
import { getSupabaseServerClient, getUserRole } from "~/utils/supabase.server";
import type { UserRole } from '~/types/auth';

export async function isLoggedIn(request: Request): Promise<boolean> {
  const { supabaseServer } = getSupabaseServerClient(request);
  try {
    const { data: { user }, error } = await supabaseServer.auth.getUser();
    return !(error || !user);
  } catch {
    return false;
  }
}

export async function requireUserId(request: Request): Promise<string> {
  const { supabaseServer, response: { headers } } = getSupabaseServerClient(request);
  const url = new URL(request.url);
  const redirectTo = `${url.pathname}${url.search}`;

  let user = null;
  try {
    const { data, error } = await supabaseServer.auth.getUser();
    if (error) throw error;
    user = data.user;
  } catch {
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`, { headers });
  }

  if (!user) {
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`, { headers });
  }

  return user.id;
}

type RequireRoleResult = {
  user: Session['user'];
  role: UserRole;
};

export async function requireRole(request: Request, allowedRoles: readonly UserRole[]): Promise<RequireRoleResult> {
  const { supabaseServer, response: { headers } } = getSupabaseServerClient(request);
  const url = new URL(request.url);
  const redirectTo = `${url.pathname}${url.search}`;

  let user = null;
  try {
    const { data, error } = await supabaseServer.auth.getUser();
    if (error) throw error;
    user = data.user;
  } catch {
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`, { headers });
  }

  if (!user) {
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`, { headers });
  }

  const role = await getUserRole(user.id);

  if (!role || !allowedRoles.includes(role)) {
    throw redirect('/');
  }

  return { user, role };
}

export async function requireAdminUser(request: Request) {
  const { user } = await requireRole(request, ['admin']);
  return user;
}

export async function requireInstructorUser(request: Request) {
  return requireRole(request, ['instructor', 'admin']);
}
