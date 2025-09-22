import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Database } from './database.types.ts';

/**
 * Creates a Supabase admin client for use in Supabase functions
 * Uses environment variables from the Deno runtime
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
  }
  
  return createClient<Database, 'public'>(supabaseUrl, supabaseServiceKey);
}

/**
 * Export createClient for cases where direct usage is needed
 */
export { createClient };
export type { SupabaseClient };
