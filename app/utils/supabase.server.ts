import { createServerClient } from "@supabase/auth-helpers-remix";
import { createClient } from "@supabase/supabase-js"; // Import standard client
import type { Database } from "~/types/supabase";
import type { Payment } from "~/types/models";

export function getSupabaseServerClient(request: Request) {
  const response = new Response();
  
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
  }
  
  const supabaseServer = createServerClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    { request, response }
  );
  
  const supabaseClient = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    { request, response }
  );
  
  return { supabaseServer, supabaseClient, response };
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;

  // Use the standard Supabase client with the service role key for admin checks
  // This avoids needing a Request object when checking roles internally.
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables for admin check.');
    return false; // Cannot perform check if env vars are missing
  }

  // Create a temporary client instance with service role privileges
  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
    
  if (error || !data) {
    return false;
  }
  
  return data.role === 'admin';
}

export async function createPaymentSession(
  familyId: string,
  amount: number,
  studentIds: string[]
) {
  const { supabaseServer } = getSupabaseServerClient(new Request(''));
  
  const { data, error } = await supabaseServer
    .from('payments')
    .insert({
      family_id: familyId,
      amount,
      student_ids: studentIds,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw new Error('Payment session creation failed');
  return data;
}

export async function updatePaymentStatus(
  sessionId: string,
  status: Payment['status'],
  receiptUrl?: string
) {
  const { supabaseServer } = getSupabaseServerClient(new Request(''));
  
  const { data, error } = await supabaseServer
    .from('payments')
    .update({ status, receipt_url: receiptUrl })
    .eq('session_id', sessionId)
    .select()
    .single();

  if (error) throw new Error('Payment update failed');
  return data;
}
