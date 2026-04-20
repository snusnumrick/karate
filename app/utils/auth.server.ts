import { redirect } from "@vercel/remix";
import type { Session } from '@supabase/auth-helpers-remix';
import { getSupabaseServerClient, getUserRole } from "~/utils/supabase.server";
import type { UserRole } from '~/types/auth';
import { USER_ROLE_VALUES } from '~/types/auth';
import { clearSupabaseAuthCookies, isRefreshTokenNotFoundError, isAuthSessionMissingError } from "~/utils/auth-cookies.server";

type SupabaseServerClientBundle = ReturnType<typeof getSupabaseServerClient>;

type OptionalUserResult = SupabaseServerClientBundle & {
  user: Session['user'] | null;
  authError: unknown | null;
  clearedInvalidSession: boolean;
};

type OptionalSessionResult = SupabaseServerClientBundle & {
  session: Session | null;
  authError: unknown | null;
  clearedInvalidSession: boolean;
};

export async function getOptionalUser(request: Request): Promise<OptionalUserResult> {
  const clientBundle = getSupabaseServerClient(request);
  const { supabaseServer, response: { headers } } = clientBundle;

  try {
    const { data, error } = await supabaseServer.auth.getUser();
    if (error) throw error;

    return {
      ...clientBundle,
      user: data.user,
      authError: null,
      clearedInvalidSession: false,
    };
  } catch (error) {
    if (isRefreshTokenNotFoundError(error) || isAuthSessionMissingError(error)) {
      clearSupabaseAuthCookies(request, headers);
      return {
        ...clientBundle,
        user: null,
        authError: error,
        clearedInvalidSession: true,
      };
    }

    throw error;
  }
}

export async function getOptionalSession(request: Request): Promise<OptionalSessionResult> {
  const clientBundle = getSupabaseServerClient(request);
  const { supabaseServer, response: { headers } } = clientBundle;

  try {
    const { data, error } = await supabaseServer.auth.getSession();
    if (error) throw error;

    return {
      ...clientBundle,
      session: data.session,
      authError: null,
      clearedInvalidSession: false,
    };
  } catch (error) {
    if (isRefreshTokenNotFoundError(error) || isAuthSessionMissingError(error)) {
      clearSupabaseAuthCookies(request, headers);
      return {
        ...clientBundle,
        session: null,
        authError: error,
        clearedInvalidSession: true,
      };
    }

    throw error;
  }
}

export async function isLoggedIn(request: Request): Promise<boolean> {
  try {
    const { user } = await getOptionalUser(request);
    return Boolean(user);
  } catch {
    return false;
  }
}

export async function requireUserId(request: Request): Promise<string> {
  const { user, response: { headers } } = await getOptionalUser(request);
  const url = new URL(request.url);
  const redirectTo = `${url.pathname}${url.search}`;

  if (!user) {
    clearSupabaseAuthCookies(request, headers);
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`, { headers });
  }

  return user.id;
}

type RequireRoleResult = {
  user: Session['user'];
  role: UserRole;
};

export async function requireRole(request: Request, allowedRoles: readonly UserRole[]): Promise<RequireRoleResult> {
  const { user, response: { headers } } = await getOptionalUser(request);
  const url = new URL(request.url);
  const redirectTo = `${url.pathname}${url.search}`;

  if (!user) {
    clearSupabaseAuthCookies(request, headers);
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

type RoleLoaderHandler<TArgs extends { request: Request }, TResult> = (
  args: TArgs & { auth: RequireRoleResult }
) => Promise<TResult> | TResult;

type UserLoaderHandler<TArgs extends { request: Request }, TResult> = (
  args: TArgs & { userId: string }
) => Promise<TResult> | TResult;

export function withRoleLoader<TArgs extends { request: Request }, TResult>(
  allowedRoles: readonly UserRole[],
  handler: RoleLoaderHandler<TArgs, TResult>
) {
  return async (args: TArgs): Promise<TResult> => {
    const auth = await requireRole(args.request, allowedRoles);
    return handler({ ...args, auth });
  };
}

export function withRoleAction<TArgs extends { request: Request }, TResult>(
  allowedRoles: readonly UserRole[],
  handler: RoleLoaderHandler<TArgs, TResult>
) {
  return async (args: TArgs): Promise<TResult> => {
    const auth = await requireRole(args.request, allowedRoles);
    return handler({ ...args, auth });
  };
}

export function withUserLoader<TArgs extends { request: Request }, TResult>(
  handler: UserLoaderHandler<TArgs, TResult>
) {
  return async (args: TArgs): Promise<TResult> => {
    const userId = await requireUserId(args.request);
    return handler({ ...args, userId });
  };
}

export function withUserAction<TArgs extends { request: Request }, TResult>(
  handler: UserLoaderHandler<TArgs, TResult>
) {
  return async (args: TArgs): Promise<TResult> => {
    const userId = await requireUserId(args.request);
    return handler({ ...args, userId });
  };
}

export function withAdminLoader<TArgs extends { request: Request }, TResult>(
  handler: RoleLoaderHandler<TArgs, TResult>
) {
  return withRoleLoader(['admin'], handler);
}

export function withAdminAction<TArgs extends { request: Request }, TResult>(
  handler: RoleLoaderHandler<TArgs, TResult>
) {
  return withRoleAction(['admin'], handler);
}

export function withFamilyLoader<TArgs extends { request: Request }, TResult>(
  handler: RoleLoaderHandler<TArgs, TResult>
) {
  return withRoleLoader(['user'], handler);
}

export function withFamilyAction<TArgs extends { request: Request }, TResult>(
  handler: RoleLoaderHandler<TArgs, TResult>
) {
  return withRoleAction(['user'], handler);
}

export function withInstructorLoader<TArgs extends { request: Request }, TResult>(
  handler: RoleLoaderHandler<TArgs, TResult>
) {
  return withRoleLoader(['instructor', 'admin'], handler);
}

export function withInstructorAction<TArgs extends { request: Request }, TResult>(
  handler: RoleLoaderHandler<TArgs, TResult>
) {
  return withRoleAction(['instructor', 'admin'], handler);
}

export function withAuthenticatedLoader<TArgs extends { request: Request }, TResult>(
  handler: RoleLoaderHandler<TArgs, TResult>
) {
  return withRoleLoader(USER_ROLE_VALUES, handler);
}

export function withAuthenticatedAction<TArgs extends { request: Request }, TResult>(
  handler: RoleLoaderHandler<TArgs, TResult>
) {
  return withRoleAction(USER_ROLE_VALUES, handler);
}
