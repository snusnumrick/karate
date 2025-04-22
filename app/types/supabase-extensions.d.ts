/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
import { type SupabaseClient } from '@supabase/supabase-js';

// Extend the SupabaseClient interface to include the global property
declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    global?: {
      headers: Record<string, string>;
    };
  }
}