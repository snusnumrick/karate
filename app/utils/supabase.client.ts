import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "~/types/database.types";

// Declare client variable and credentials in the module scope
let supabaseClient: SupabaseClient<Database> | null = null;
let storedSupabaseUrl: string | undefined;
let storedSupabaseAnonKey: string | undefined;
// Flag to track if client initialization is in progress
let isInitializing = false;
// Queue of resolve functions waiting for initialization
const initializationQueue: Array<(client: SupabaseClient<Database> | null) => void> = [];

/**
 * Gets a singleton instance of the Supabase client for browser-side use.
 * Initializes the client only once and stores credentials for reuse.
 * Uses a queue system to prevent race conditions during initialization.
 *
 * @param supabaseUrl - The Supabase project URL.
 * @param supabaseAnonKey - The Supabase anon key.
 * @returns The Supabase client instance, or null if env vars are missing or not in browser.
 */
export function getSupabaseBrowserClient(
    supabaseUrl?: string,
    supabaseAnonKey?: string
): SupabaseClient<Database> | null {
    // Use provided credentials or fall back to stored ones
    const url = supabaseUrl || storedSupabaseUrl;
    const key = supabaseAnonKey || storedSupabaseAnonKey;

    // Check if running in a browser environment
    if (typeof window === 'undefined') {
        console.warn("[getSupabaseBrowserClient] Not in browser environment. Cannot create client.");
        return null;
    }

    // Return existing client if available
    if (supabaseClient) {
        return supabaseClient;
    }

    // Check if we have credentials to create a new client
    if (!url || !key) {
        console.warn(`[getSupabaseBrowserClient] Missing Supabase credentials. URL: ${url ? 'present' : 'missing'}, Key: ${key ? 'present' : 'missing'}. Cannot create client.`);
        return null;
    }

    // If initialization is already in progress, return the existing client
    // This prevents multiple initialization attempts during the same event loop
    if (isInitializing) {
        console.log("[getSupabaseBrowserClient] Initialization already in progress, returning existing client.");
        return supabaseClient;
    }

    // Initialize client and store credentials
    console.log("[getSupabaseBrowserClient] Initializing singleton Supabase client...");
    isInitializing = true;

    try {
        // Only create a new client if one doesn't exist yet
        if (!supabaseClient) {
            supabaseClient = createClient<Database>(url, key);
            // Store credentials for future use
            storedSupabaseUrl = url;
            storedSupabaseAnonKey = key;
            console.log("[getSupabaseBrowserClient] Singleton Supabase client initialized.");

            // Resolve any pending promises waiting for initialization
            while (initializationQueue.length > 0) {
                const resolve = initializationQueue.shift();
                if (resolve) resolve(supabaseClient);
            }
        }
    } catch (error) {
        console.error("[getSupabaseBrowserClient] Error initializing Supabase client:", error);
        // Reject any pending promises
        while (initializationQueue.length > 0) {
            const resolve = initializationQueue.shift();
            if (resolve) resolve(null);
        }
        supabaseClient = null; // Reset client on error
    } finally {
        isInitializing = false;
    }

    return supabaseClient;
}

// Keep existing functions if they are still needed elsewhere,
// but ensure they use the singleton client if appropriate for browser context.
// Or remove them if they are replaced by server-side logic.

// Example: If getCurrentUser is only used server-side, it's fine.
// If used client-side, it should potentially use getSupabaseBrowserClient.
// export async function getCurrentUser() {
//     const client = getSupabaseBrowserClient(); // Needs ENV vars passed somehow or read differently
//     if (!client) return null;
//     const {data: {user}} = await client.auth.getUser();
//     return user;
// }

// export async function signOut() {
//     const client = getSupabaseBrowserClient(); // Needs ENV vars passed somehow or read differently
//      if (!client) return;
//     return client.auth.signOut();
// }
