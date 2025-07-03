import { type ActionFunctionArgs, json } from "@remix-run/node";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { DiscountService } from "~/services/discount.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const { supabaseServer } = getSupabaseServerClient(request);
  
  // Check if user is authenticated and is admin
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check admin status
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Generate a unique code using the existing service method
    // Use 'DISC' prefix with 6 additional characters to match UI pattern
    const uniqueCode = await DiscountService.generateUniqueCode('DISC', 6);
    
    return json({ code: uniqueCode });
  } catch (error) {
    console.error('Error generating unique code:', error);
    return json({ error: 'Failed to generate unique code' }, { status: 500 });
  }
}