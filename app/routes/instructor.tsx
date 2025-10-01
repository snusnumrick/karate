import { Outlet, useLoaderData, useMatches, useOutletContext, useRouteError } from '@remix-run/react';
import { json, redirect, type LoaderFunctionArgs } from '@vercel/remix';
import { useEffect, useMemo, useState } from 'react';
import { getSupabaseServerClient, getUserRole } from '~/utils/supabase.server';
import { isAdminRole, isInstructorRole, type UserRole } from '~/types/auth';
import InstructorNavbar from '~/components/InstructorNavbar';
import InstructorFooter from '~/components/InstructorFooter';
import { AppBreadcrumb, type BreadcrumbItem } from '~/components/AppBreadcrumb';
import { createBrowserClient } from '@supabase/auth-helpers-remix';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database.types';

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer, response, ENV } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();
  const headers = Object.fromEntries(response.headers);

  if (!user) {
    return redirect('/login?redirectTo=/instructor', { headers });
  }

  const role = await getUserRole(user.id);

  if (!role || (!isInstructorRole(role) && !isAdminRole(role))) {
    return redirect('/', { headers });
  }

  return json({ role, ENV }, { headers });
}

type InstructorRouteHandle = {
  breadcrumb?: (data: unknown) => BreadcrumbItem[];
};

export type InstructorOutletContext = {
  role: UserRole;
  supabase: SupabaseClient<Database> | null;
};

export default function InstructorLayout() {
  const { role, ENV } = useLoaderData<typeof loader>();
  const matches = useMatches();
  const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null);

  useEffect(() => {
    const url = ENV?.SUPABASE_URL;
    const anonKey = ENV?.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      console.warn('InstructorLayout missing Supabase environment configuration.');
      return;
    }

    const client = createBrowserClient<Database, 'public'>(url, anonKey) as unknown as SupabaseClient<Database>;
    setSupabase(client);
  }, [ENV?.SUPABASE_URL, ENV?.SUPABASE_ANON_KEY]);

  const breadcrumbItems = useMemo(() => {
    const childSegments = matches
      .filter((match) => match.id !== 'routes/instructor' && match.id.startsWith('routes/instructor'))
      .flatMap((match) => {
        const handle = match.handle as InstructorRouteHandle | undefined;
        if (!handle?.breadcrumb) return [] as BreadcrumbItem[];
        try {
          const crumbs = handle.breadcrumb(match.data);
          return Array.isArray(crumbs) ? crumbs : [];
        } catch (error) {
          console.error('Error building instructor breadcrumb for match', match.id, error);
          return [] as BreadcrumbItem[];
        }
      });

    const items: BreadcrumbItem[] = [];
    if (childSegments.length === 0) {
      items.push({ label: 'Instructor Portal', current: true });
    } else {
      items.push({ label: 'Instructor Portal', href: '/instructor' });
      items.push(...childSegments);
    }

    const hasExplicitCurrent = items.some((item) => item.current);
    if (!hasExplicitCurrent && items.length > 0) {
      const lastIndex = items.length - 1;
      items[lastIndex] = { ...items[lastIndex], current: true };
    }

    return items.map((item) => (item.current ? { ...item, href: undefined } : item));
  }, [matches]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <InstructorNavbar />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <AppBreadcrumb items={breadcrumbItems} className="mb-6" />
          <Outlet context={{ role, supabase }} />
        </div>
      </main>
      <InstructorFooter />
    </div>
  );
}

export type { InstructorRouteHandle };

export function useInstructorRole() {
  const { role } = useOutletContext<InstructorOutletContext>();
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
