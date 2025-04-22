import { createClient, SupabaseClient } from "@supabase/supabase-js";
import invariant from "tiny-invariant";
import type { Database, Tables, TablesInsert, TablesUpdate } from "~/types/database.types";
import { json } from "@remix-run/node"; // For throwing Response objects

// Define row types locally
type GuardianRow = Tables<'guardians'>;
type GuardianInsert = TablesInsert<'guardians'>;
type GuardianUpdate = TablesUpdate<'guardians'>;

// --- Helper Functions ---

/**
 * Creates a Supabase client with service role privileges.
 * @returns SupabaseClient<Database>
 * @throws {Response} If Supabase URL or Service Role Key are missing.
 */
function createSupabaseAdminClient(): SupabaseClient<Database> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Service/createSupabaseAdminClient] Missing Supabase URL or Service Role Key env vars.");
        throw json("Server configuration error: Missing Supabase credentials.", { status: 500 });
    }
    return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

/**
 * Verifies if a user has permission to access/modify a specific guardian.
 * Checks if the user is an admin OR belongs to the same family as the guardian.
 *
 * @param client Supabase admin client instance.
 * @param userId The ID of the user making the request.
 * @param guardianId The ID of the guardian being accessed.
 * @returns {Promise<{ authorized: boolean, familyId: string | null }>} True if authorized, false otherwise, and the guardian's family ID.
 * @throws {Response} Throws 404 if guardian not found, 500 for other DB errors.
 */
async function verifyGuardianAccess(
    client: SupabaseClient<Database>,
    userId: string,
    guardianId: string
): Promise<{ authorized: boolean, familyId: string | null }> {
    invariant(userId, "User ID is required for authorization check.");
    invariant(guardianId, "Guardian ID is required for authorization check.");

    // 1. Fetch the guardian's family ID
    const { data: guardianData, error: guardianError } = await client
        .from('guardians')
        .select('family_id')
        .eq('id', guardianId)
        .single();

    if (guardianError) {
        console.error(`[Service/verifyGuardianAccess] Error fetching guardian ${guardianId}:`, guardianError.message);
        throw json(`Database error: ${guardianError.message}`, { status: 500 });
    }
    if (!guardianData) {
        console.warn(`[Service/verifyGuardianAccess] Guardian not found: ${guardianId}`);
        throw json("Guardian not found", { status: 404 });
    }
    const guardianFamilyId = guardianData.family_id;

    // 2. Fetch the user's profile (role and family ID)
    const { data: profileData, error: profileError } = await client
        .from('profiles')
        .select('role, family_id')
        .eq('id', userId)
        .single();

    if (profileError) {
        console.error(`[Service/verifyGuardianAccess] Error fetching profile for user ${userId}:`, profileError.message);
        throw json(`Database error fetching user profile: ${profileError.message}`, { status: 500 });
    }
    if (!profileData) {
        console.warn(`[Service/verifyGuardianAccess] Profile not found for user ${userId}`);
        // If profile doesn't exist, they can't be authorized
        return { authorized: false, familyId: guardianFamilyId };
    }

    // 3. Check authorization
    const isAdmin = profileData.role === 'admin';
    const belongsToFamily = profileData.family_id === guardianFamilyId;

    const authorized = isAdmin || belongsToFamily;
    console.log(`[Service/verifyGuardianAccess] User ${userId} access to guardian ${guardianId} (Family ${guardianFamilyId}): Authorized = ${authorized} (IsAdmin: ${isAdmin}, BelongsToFamily: ${belongsToFamily})`);

    return { authorized, familyId: guardianFamilyId };
}

/**
 * Verifies if a user has permission to access/modify guardians within a specific family.
 * Checks if the user is an admin OR belongs to the target family.
 *
 * @param client Supabase admin client instance.
 * @param userId The ID of the user making the request.
 * @param targetFamilyId The ID of the family whose guardians are being accessed.
 * @returns {Promise<boolean>} True if authorized, false otherwise.
 * @throws {Response} Throws 500 for database errors fetching user profile.
 */
async function verifyFamilyAccess(
    client: SupabaseClient<Database>,
    userId: string,
    targetFamilyId: string
): Promise<boolean> {
    invariant(userId, "User ID is required for authorization check.");
    invariant(targetFamilyId, "Target Family ID is required for authorization check.");

    // Fetch the user's profile (role and family ID)
    const { data: profileData, error: profileError } = await client
        .from('profiles')
        .select('role, family_id')
        .eq('id', userId)
        .single();

    if (profileError) {
        console.error(`[Service/verifyFamilyAccess] Error fetching profile for user ${userId}:`, profileError.message);
        throw json(`Database error fetching user profile: ${profileError.message}`, { status: 500 });
    }
    if (!profileData) {
        console.warn(`[Service/verifyFamilyAccess] Profile not found for user ${userId}`);
        return false; // User without profile cannot access family data
    }

    // Check authorization
    const isAdmin = profileData.role === 'admin';
    const belongsToFamily = profileData.family_id === targetFamilyId;

    const authorized = isAdmin || belongsToFamily;
    console.log(`[Service/verifyFamilyAccess] User ${userId} access to family ${targetFamilyId}: Authorized = ${authorized} (IsAdmin: ${isAdmin}, BelongsToFamily: ${belongsToFamily})`);

    return authorized;
}


// --- Service Functions ---

/**
 * Fetches details for a specific guardian.
 * Requires authorization check.
 *
 * @param guardianId The ID of the guardian to fetch.
 * @param requestingUserId The ID of the user making the request (for auth check).
 * @param supabaseAdmin Optional Supabase admin client instance.
 * @returns The guardian's details.
 * @throws {Response} Throws 403 Forbidden, 404 Not Found, 500 Server Error.
 */
export async function getGuardianDetails(
    guardianId: string,
    requestingUserId: string,
    supabaseAdmin?: SupabaseClient<Database>
): Promise<GuardianRow> {
    invariant(guardianId, "Missing guardianId parameter");
    invariant(requestingUserId, "Missing requestingUserId for authorization");
    console.log(`[Service/getGuardianDetails] Fetching guardian details for ID: ${guardianId} by User: ${requestingUserId}`);

    const client = supabaseAdmin ?? createSupabaseAdminClient();

    // Authorize
    const { authorized } = await verifyGuardianAccess(client, requestingUserId, guardianId);
    if (!authorized) {
        throw json("Forbidden: You do not have permission to view this guardian.", { status: 403 });
    }

    // Fetch data (already fetched partially in verifyGuardianAccess, but fetch full row here)
    const { data, error } = await client
        .from('guardians')
        .select('*')
        .eq('id', guardianId)
        .single();

    if (error) {
        console.error(`[Service/getGuardianDetails] Supabase error fetching guardian ${guardianId}:`, error.message);
        throw json(`Database error: ${error.message}`, { status: 500 });
    }
    // verifyGuardianAccess already handles the 404 case if guardian doesn't exist

    console.log(`[Service/getGuardianDetails] Successfully fetched guardian ${guardianId}`);
    return data;
}

/**
 * Fetches all guardians associated with a specific family.
 * Requires authorization check.
 *
 * @param familyId The ID of the family whose guardians to fetch.
 * @param requestingUserId The ID of the user making the request (for auth check).
 * @param supabaseAdmin Optional Supabase admin client instance.
 * @returns An array of guardian details.
 * @throws {Response} Throws 403 Forbidden, 500 Server Error.
 */
export async function getGuardiansByFamily(
    familyId: string,
    requestingUserId: string,
    supabaseAdmin?: SupabaseClient<Database>
): Promise<GuardianRow[]> {
    invariant(familyId, "Missing familyId parameter");
    invariant(requestingUserId, "Missing requestingUserId for authorization");
    console.log(`[Service/getGuardiansByFamily] Fetching guardians for Family ID: ${familyId} by User: ${requestingUserId}`);

    const client = supabaseAdmin ?? createSupabaseAdminClient();

    // Authorize
    const authorized = await verifyFamilyAccess(client, requestingUserId, familyId);
    if (!authorized) {
        throw json("Forbidden: You do not have permission to view guardians for this family.", { status: 403 });
    }

    // Fetch data
    const { data, error } = await client
        .from('guardians')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: true }); // Optional: order by creation time

    if (error) {
        console.error(`[Service/getGuardiansByFamily] Supabase error fetching guardians for family ${familyId}:`, error.message);
        throw json(`Database error: ${error.message}`, { status: 500 });
    }

    console.log(`[Service/getGuardiansByFamily] Successfully fetched ${data?.length ?? 0} guardians for family ${familyId}`);
    return data ?? [];
}

/**
 * Creates a new guardian record for a specific family.
 * Requires authorization check.
 *
 * @param familyId The ID of the family to add the guardian to.
 * @param guardianData Data for the new guardian (must include required fields).
 * @param requestingUserId The ID of the user making the request (for auth check).
 * @param supabaseAdmin Optional Supabase admin client instance.
 * @returns The newly created guardian's details.
 * @throws {Response} Throws 400 Bad Request (missing data), 403 Forbidden, 500 Server Error.
 */
export async function createGuardian(
    familyId: string,
    guardianData: Omit<GuardianInsert, 'family_id' | 'id' | 'created_at' | 'updated_at'>, // Exclude auto-generated fields
    requestingUserId: string,
    supabaseAdmin?: SupabaseClient<Database>
): Promise<GuardianRow> {
    invariant(familyId, "Missing familyId parameter");
    invariant(requestingUserId, "Missing requestingUserId for authorization");
    // Add basic validation for required guardian fields if needed, or rely on DB constraints/API validation
    invariant(guardianData.first_name, "Missing guardian first name");
    invariant(guardianData.last_name, "Missing guardian last name");
    // ... add other required field checks

    console.log(`[Service/createGuardian] Attempting to create guardian in Family ID: ${familyId} by User: ${requestingUserId}`);

    const client = supabaseAdmin ?? createSupabaseAdminClient();

    // Authorize
    const authorized = await verifyFamilyAccess(client, requestingUserId, familyId);
    if (!authorized) {
        throw json("Forbidden: You do not have permission to add a guardian to this family.", { status: 403 });
    }

    // Prepare insert data
    const insertData: GuardianInsert = {
        ...guardianData,
        family_id: familyId,
    };

    // Insert data
    const { data, error } = await client
        .from('guardians')
        .insert(insertData)
        .select() // Select the newly created row
        .single();

    if (error) {
        console.error(`[Service/createGuardian] Supabase error creating guardian for family ${familyId}:`, error.message);
        // Handle potential constraint violations (e.g., unique email if applicable)
        if (error.code === '23505') { // Unique violation
             throw json(`Guardian creation failed: ${error.details || 'Duplicate entry.'}`, { status: 409 }); // 409 Conflict
        }
        throw json(`Database error: ${error.message}`, { status: 500 });
    }

    if (!data) {
         console.error(`[Service/createGuardian] Failed to create guardian for family ${familyId}, no data returned.`);
         throw json("Guardian creation failed unexpectedly.", { status: 500 });
    }

    console.log(`[Service/createGuardian] Successfully created guardian ${data.id} for family ${familyId}`);
    return data;
}

/**
 * Updates an existing guardian record.
 * Requires authorization check.
 *
 * @param guardianId The ID of the guardian to update.
 * @param updateData The data to update (partial updates allowed).
 * @param requestingUserId The ID of the user making the request (for auth check).
 * @param supabaseAdmin Optional Supabase admin client instance.
 * @returns The updated guardian's details.
 * @throws {Response} Throws 403 Forbidden, 404 Not Found, 500 Server Error.
 */
export async function updateGuardian(
    guardianId: string,
    updateData: GuardianUpdate, // Use TablesUpdate for partial updates
    requestingUserId: string,
    supabaseAdmin?: SupabaseClient<Database>
): Promise<GuardianRow> {
    invariant(guardianId, "Missing guardianId parameter");
    invariant(requestingUserId, "Missing requestingUserId for authorization");
    invariant(Object.keys(updateData).length > 0, "No update data provided.");
    console.log(`[Service/updateGuardian] Attempting to update guardian ID: ${guardianId} by User: ${requestingUserId}`);

    const client = supabaseAdmin ?? createSupabaseAdminClient();

    // Authorize (also implicitly checks if guardian exists)
    const { authorized } = await verifyGuardianAccess(client, requestingUserId, guardianId);
    if (!authorized) {
        throw json("Forbidden: You do not have permission to update this guardian.", { status: 403 });
    }

    // Perform update
    const { data, error } = await client
        .from('guardians')
        .update(updateData)
        .eq('id', guardianId)
        .select() // Select the updated row
        .single();

    if (error) {
        console.error(`[Service/updateGuardian] Supabase error updating guardian ${guardianId}:`, error.message);
        throw json(`Database error: ${error.message}`, { status: 500 });
    }
     if (!data) {
         // This case might occur if the row was deleted between verify and update, though unlikely.
         console.error(`[Service/updateGuardian] Failed to update guardian ${guardianId}, no data returned after update.`);
         throw json("Guardian update failed unexpectedly.", { status: 500 });
     }

    console.log(`[Service/updateGuardian] Successfully updated guardian ${guardianId}`);
    return data;
}

/**
 * Deletes a specific guardian record.
 * Requires authorization check.
 *
 * @param guardianId The ID of the guardian to delete.
 * @param requestingUserId The ID of the user making the request (for auth check).
 * @param supabaseAdmin Optional Supabase admin client instance.
 * @returns {Promise<void>} Resolves on successful deletion.
 * @throws {Response} Throws 403 Forbidden, 404 Not Found, 500 Server Error.
 */
export async function deleteGuardian(
    guardianId: string,
    requestingUserId: string,
    supabaseAdmin?: SupabaseClient<Database>
): Promise<void> {
    invariant(guardianId, "Missing guardianId parameter");
    invariant(requestingUserId, "Missing requestingUserId for authorization");
    console.log(`[Service/deleteGuardian] Attempting to delete guardian ID: ${guardianId} by User: ${requestingUserId}`);

    const client = supabaseAdmin ?? createSupabaseAdminClient();

    // Authorize (also implicitly checks if guardian exists)
    const { authorized } = await verifyGuardianAccess(client, requestingUserId, guardianId);
    if (!authorized) {
        throw json("Forbidden: You do not have permission to delete this guardian.", { status: 403 });
    }

    // Perform delete
    const { error } = await client
        .from('guardians')
        .delete()
        .eq('id', guardianId);

    if (error) {
        console.error(`[Service/deleteGuardian] Supabase error deleting guardian ${guardianId}:`, error.message);
        throw json(`Database error: ${error.message}`, { status: 500 });
    }

    console.log(`[Service/deleteGuardian] Successfully deleted guardian ${guardianId}`);
}
