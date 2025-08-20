import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database.types';

// Global singleton client
declare global {
  interface Window {
    __SUPABASE_SINGLETON_CLIENT?: SupabaseClient<Database>;
  }
}



export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  accessToken?: string;
  refreshToken?: string;
  clientInfo?: string;
}

/**
 * Get or create a singleton Supabase client for browser use
 * This ensures only one GoTrueClient instance exists across the entire application
 */
export function getSupabaseClient(config: SupabaseClientConfig): SupabaseClient<Database> {
  // Check if we're in the browser
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseClient should only be called in the browser');
  }

  // Return existing singleton if it exists
  if (window.__SUPABASE_SINGLETON_CLIENT) {
    // Update session if tokens are provided
    if (config.accessToken && config.refreshToken) {
      window.__SUPABASE_SINGLETON_CLIENT.auth.setSession({
        access_token: config.accessToken,
        refresh_token: config.refreshToken,
      });
    }
    return window.__SUPABASE_SINGLETON_CLIENT;
  }

  // Create new singleton client
  const client = createClient<Database>(config.url, config.anonKey, {
    auth: { 
      persistSession: false, 
      autoRefreshToken: false 
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    global: {
      headers: {
        'X-Client-Info': config.clientInfo || 'messaging-client'
      }
    }
  });

  // Set session if tokens are provided
  if (config.accessToken && config.refreshToken) {
    client.auth.setSession({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
    });
  }

  // Store as singleton
  window.__SUPABASE_SINGLETON_CLIENT = client;
  console.log(`[Supabase] Created singleton client with info: ${config.clientInfo || 'messaging-client'}`);

  return client;
}

/**
 * Get the existing singleton client without creating a new one
 */
export function getExistingSupabaseClient(): SupabaseClient<Database> | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.__SUPABASE_SINGLETON_CLIENT || null;
}

/**
 * Clear the singleton client (useful for cleanup or testing)
 */
export function clearSupabaseClient(): void {
  if (typeof window !== 'undefined' && window.__SUPABASE_SINGLETON_CLIENT) {
    console.log('[Supabase] Clearing singleton client');
    delete window.__SUPABASE_SINGLETON_CLIENT;
  }
  clientInstance = null;
}