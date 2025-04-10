import { createClient, SupabaseClient } from "@supabase/supabase-js";
// Request is globally available or comes from web fetch API, not @remix-run/node
// import type { Request } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { User } from "@supabase/supabase-js";
import type { Database } from "~/types/supabase";

// Helper to create a Supabase client specifically for JWT verification
// Uses the public URL and anon key, as JWT verification happens based on the token itself
// and Supabase's configured JWT secret.
function createSupabaseClientForAuth(request: Request): SupabaseClient<Database> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("[API Auth] Missing Supabase URL or Anon Key env vars.");
        throw json({ error: "Server configuration error" }, { status: 500 });
    }

    // Create a new client for each request to avoid potential issues with shared state
    // Pass existing headers from the request to potentially forward cookies if needed,
    // although for API auth, we primarily rely on the Authorization header.
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: request.headers.get("Authorization")! } },
        auth: {
             // We expect the token to be passed via the Authorization header,
             // so disable auto session management which relies on cookies.
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    });
}

/**
 * Verifies the JWT token from the Authorization header.
 * Throws a Remix Response object (401 or 403) if authentication fails.
 *
 * @param request The incoming Remix request object.
 * @returns The authenticated Supabase User object if successful.
 * @throws {Response} Throws 401 for missing/invalid token, 403 if user not found.
 */
export async function requireApiAuth(request: Request): Promise<User> {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.warn("[API Auth] Missing or invalid Authorization header.");
        throw json({ error: "Unauthorized: Missing or invalid Bearer token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        console.warn("[API Auth] Token missing after 'Bearer ' prefix.");
        throw json({ error: "Unauthorized: Malformed Bearer token" }, { status: 401 });
    }

    // Create a request-specific client to verify the token
    const supabase = createSupabaseClientForAuth(request);

    // Verify the token and get the user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
        console.error("[API Auth] Error verifying token:", error.message);
        // Distinguish between invalid token and other errors if needed
        throw json({ error: `Forbidden: ${error.message}` }, { status: 403 });
    }

    if (!user) {
        console.warn("[API Auth] Token verified but no user found.");
        throw json({ error: "Forbidden: User not found for token" }, { status: 403 });
    }

    console.log(`[API Auth] User ${user.id} authenticated successfully via API token.`);
    return user;
}

/**
 * Optional: Checks if the authenticated user has a specific role (e.g., 'admin').
 * Assumes roles are stored in user metadata.
 *
 * @param user The authenticated Supabase User object.
 * @param requiredRole The role required for access.
 * @throws {Response} Throws 403 if the user does not have the required role.
 */
export function requireApiRole(user: User, requiredRole: string): void {
    // Example: Check for role in user_metadata. Adjust based on your actual structure.
    const roles = user.user_metadata?.roles as string[] | undefined;
    if (!roles || !roles.includes(requiredRole)) {
        console.warn(`[API Auth] User ${user.id} lacks required role '${requiredRole}'. Roles: ${roles}`);
        throw json({ error: `Forbidden: Requires '${requiredRole}' role.` }, { status: 403 });
    }
    console.log(`[API Auth] User ${user.id} has required role '${requiredRole}'.`);
}
