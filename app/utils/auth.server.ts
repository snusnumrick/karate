import { redirect } from "@vercel/remix";
import { getSupabaseServerClient, isUserAdmin } from "~/utils/supabase.server";

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