import { createBrowserClient } from '@supabase/auth-helpers-remix';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hasUsableSupabaseSessionTokens } from '~/utils/supabase-session';
import type { Database } from '~/types/database.types';

// Global singleton client
declare global {
  interface Window {
    __SUPABASE_SINGLETON_CLIENT?: SupabaseClient<Database>;
    __SUPABASE_BROWSER_CLIENT?: SupabaseClient<Database>;
    __SUPABASE_BROWSER_AUTH_CLIENT?: SupabaseClient<Database>;
    __SUPABASE_SINGLETON_ACCESS_TOKEN?: string;
  }
}



export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  accessToken?: string;
  refreshToken?: string;
  clientInfo?: string;
}

function hydrateBrowserSession(
  client: SupabaseClient<Database>,
  accessToken?: string,
  refreshToken?: string
): void {
  if (!hasUsableSupabaseSessionTokens(accessToken, refreshToken)) {
    if (typeof window !== 'undefined') {
      window.__SUPABASE_SINGLETON_ACCESS_TOKEN = undefined;
    }
    return;
  }

  if (window.__SUPABASE_SINGLETON_ACCESS_TOKEN === accessToken) {
    return;
  }

  window.__SUPABASE_SINGLETON_ACCESS_TOKEN = accessToken;
  client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken!,
  }).catch((error) => {
    console.warn('[Supabase] Failed to hydrate browser session', error);
    window.__SUPABASE_SINGLETON_ACCESS_TOKEN = undefined;
  });
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
    hydrateBrowserSession(
      window.__SUPABASE_SINGLETON_CLIENT,
      config.accessToken,
      config.refreshToken
    );
    return window.__SUPABASE_SINGLETON_CLIENT;
  }

  // Create new singleton client
  const client = createClient<Database, "public">(config.url, config.anonKey, {
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

  hydrateBrowserSession(client, config.accessToken, config.refreshToken);

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
  return window.__SUPABASE_BROWSER_AUTH_CLIENT || window.__SUPABASE_BROWSER_CLIENT || window.__SUPABASE_SINGLETON_CLIENT || null;
}

/**
 * Store a browser client as singleton to prevent multiple instances
 */
export function storeBrowserClient(client: SupabaseClient<Database>): void {
  if (typeof window !== 'undefined') {
    window.__SUPABASE_BROWSER_CLIENT = client;
  }
}

export function getSupabaseBrowserAuthClient(config: Pick<SupabaseClientConfig, 'url' | 'anonKey'>): SupabaseClient<Database> {
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseBrowserAuthClient should only be called in the browser');
  }

  if (window.__SUPABASE_BROWSER_AUTH_CLIENT) {
    return window.__SUPABASE_BROWSER_AUTH_CLIENT;
  }

  const client = createBrowserClient<Database, 'public'>(
    config.url,
    config.anonKey
  ) as unknown as SupabaseClient<Database>;

  window.__SUPABASE_BROWSER_AUTH_CLIENT = client;
  return client;
}

/**
 * Clear the singleton client (useful for cleanup or testing)
 */
export function clearSupabaseClient(): void {
  if (typeof window !== 'undefined') {
    if (window.__SUPABASE_SINGLETON_CLIENT) {
      console.log('[Supabase] Clearing singleton client');
      delete window.__SUPABASE_SINGLETON_CLIENT;
    }

    if (window.__SUPABASE_SINGLETON_ACCESS_TOKEN) {
      delete window.__SUPABASE_SINGLETON_ACCESS_TOKEN;
    }

    if (window.__SUPABASE_BROWSER_AUTH_CLIENT) {
      delete window.__SUPABASE_BROWSER_AUTH_CLIENT;
    }
  }
}
