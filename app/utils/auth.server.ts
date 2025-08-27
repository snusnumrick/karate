import { redirect } from "@vercel/remix";
import { getSupabaseServerClient, isUserAdmin } from "~/utils/supabase.server";

export async function isLoggedIn(request: Request): Promise<boolean> {
  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user }, error } = await supabaseServer.auth.getUser();
  return ! (error || !user);
}

export async function requireUserId(request: Request): Promise<string> {
  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user }, error } = await supabaseServer.auth.getUser();

  if (error || !user) {
    throw redirect("/login");
  }
  
  return user.id;
}

export async function requireAdminUser(request: Request) {
  const { supabaseServer } = getSupabaseServerClient(request);

  const { data: { user }, error } = await supabaseServer.auth.getUser();

  if (error || !user) {
    throw redirect("/login");
  }

  const isAdmin = await isUserAdmin(user.id);
  
  if (!isAdmin) {
    throw redirect("/");
  }
  
  return user;
}