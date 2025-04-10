import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { createClient } from "@supabase/supabase-js"; // Import createClient
import { getFamilyDetails } from "~/services/family.server";
import { requireApiAuth } from "~/utils/api-auth.server"; // Import auth helper
import type { Database } from "~/types/supabase"; // Import Database type

// Helper to create admin client (copied from family.server.ts - consider moving to shared utils)
function createSupabaseAdminClient(): ReturnType<typeof createClient<Database>> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[API /family/me] Missing Supabase URL or Service Role Key env vars.");
        throw json({ error: "Server configuration error" }, { status: 500 });
    }
    return createClient<Database>(supabaseUrl, supabaseServiceKey);
}


/**
 * API endpoint to fetch details for the currently authenticated user's family.
 * Requires Bearer token authentication. No specific role needed beyond being authenticated.
 */
export async function loader({ request }: LoaderFunctionArgs) {
    // 1. Authenticate the request using JWT Bearer token
    let user;
    try {
        // No specific role required, just authentication
        user = await requireApiAuth(request);
    } catch (error) {
        // requireApiAuth throws Response objects on failure
        if (error instanceof Response) {
            return error;
        }
        console.error("[API /family/me Loader] Unexpected auth error:", error);
        return json({ error: "Authentication failed" }, { status: 500 });
    }

    // 2. Fetch the user's profile to get their family_id
    let familyId: string | null = null;
    try {
        const supabaseAdmin = createSupabaseAdminClient(); // Use admin client to read profiles table
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('family_id')
            .eq('id', user.id)
            .maybeSingle(); // Use maybeSingle as profile might theoretically not exist

        if (profileError) {
            console.error(`[API /family/me Loader] Error fetching profile for user ${user.id}:`, profileError.message);
            throw json({ error: "Failed to retrieve user profile information." }, { status: 500 });
        }

        if (!profile || !profile.family_id) {
            console.warn(`[API /family/me Loader] Profile or family_id not found for user ${user.id}.`);
            // Return 404 Not Found if the user isn't linked to a family
            throw json({ error: "User is not associated with a family." }, { status: 404 });
        }

        familyId = profile.family_id;
        console.log(`[API /family/me Loader] User ${user.id} belongs to family ${familyId}`);

    } catch (error) {
        if (error instanceof Response) {
            return error; // Return JSON responses directly
        }
        console.error(`[API /family/me Loader] Unexpected error fetching profile for user ${user.id}:`, error);
        return json({ error: "An unexpected error occurred while fetching user profile." }, { status: 500 });
    }


    // 3. Fetch family data using the service function
    try {
        // Pass the determined familyId to the service function
        const familyDetails = await getFamilyDetails(familyId);
        // Return data on success
        return json(familyDetails, { status: 200 });

    } catch (error) {
        // Handle errors thrown by the service (e.g., 404 Not Found, 500 DB error)
        if (error instanceof Response) {
            // If the service threw a Response (like 404), convert it to a JSON response
            const errorBody = await error.text();
            console.warn(`[API /family/me Loader] Service threw Response (${error.status}) for family ${familyId}: ${errorBody}`);
            // Customize error message if needed
            const message = error.status === 404 ? "Family details not found for the associated family ID." : (errorBody || "Failed to fetch family details");
            return json({ error: message }, { status: error.status });
        }

        // Handle unexpected errors from the service
        console.error(`[API /family/me Loader] Unexpected error fetching family ${familyId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
        return json({ error: errorMessage }, { status: 500 });
    }
}
