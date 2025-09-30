import { Outlet, useLoaderData, useOutletContext, useRouteError } from '@remix-run/react';
import { json, redirect, type LoaderFunctionArgs } from '@vercel/remix';
import { getSupabaseServerClient, getUserRole } from '~/utils/supabase.server';
import { isAdminRole, isInstructorRole, type UserRole } from '~/types/auth';

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();
  const headers = Object.fromEntries(response.headers);

  if (!user) {
    return redirect('/login?redirectTo=/instructor', { headers });
  }

  const role = await getUserRole(user.id);

  if (!role || (!isInstructorRole(role) && !isAdminRole(role))) {
    return redirect('/', { headers });
  }

  return json({ role }, { headers });
}

export default function InstructorLayout() {
  const { role } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
      <Outlet context={{ role }} />
    </div>
  );
}

export function useInstructorRole() {
  const { role } = useOutletContext<{ role: UserRole }>();
  return role;
}

export function ErrorBoundary() {
  const error = useRouteError() as Error;
  console.error('Error caught in Instructor layout:', error);

  return (
    <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
      <h1 className="text-xl font-bold">Instructor Portal Error</h1>
      <p>{error?.message || 'An unknown error occurred.'}</p>
      {error?.stack && (
        <pre className="mt-2 p-2 bg-red-50 text-red-900 text-xs overflow-auto">{error.stack}</pre>
      )}
    </div>
  );
}
