import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/auth-helpers-remix';
import type { Database } from '~/types/supabase';

// Initialize the Supabase client for server-side usage
export function getSupabaseServerClient(request: Request) {
  const response = new Response();
  
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
  }
  
  // Create a server client that can be used for authenticated server operations
  const supabaseServer = createServerClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    { request, response }
  );
  
  return { supabaseServer, response };
}

// Helper function to check if a user has admin role
export async function isUserAdmin(userId: string) {
  if (!userId) return false;
  
  const { supabaseServer } = getSupabaseServerClient(new Request(''));
  
  const { data, error } = await supabaseServer
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
    
  if (error || !data) return false;
  
  return data.role === 'admin';
}
