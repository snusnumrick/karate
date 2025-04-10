import { createClient, SupabaseClient } from "@supabase/supabase-js";
import invariant from "tiny-invariant";
import type { Database } from "~/types/supabase";
// Removed unused format import

// Define types locally or import if shared
type StudentRow = Omit<Database['public']['Tables']['students']['Row'], 'belt_rank'>;
type FamilyRow = Database['public']['Tables']['families']['Row'];
type BeltRankEnum = Database['public']['Enums']['belt_rank_enum'];
type IndividualSessionRow = Database['public']['Tables']['one_on_one_sessions']['Row'];
type OneOnOneSessionUsageRow = Database['public']['Tables']['one_on_one_session_usage']['Row'];

// Define the expected return type for the getStudentDetails service function
export type StudentDetails = StudentRow & {
    families: Pick<FamilyRow, 'id' | 'name'> | null;
    currentBeltRank: BeltRankEnum | null;
    familyIndividualSessionBalance: number;
    availableIndividualSessions: Pick<IndividualSessionRow, 'id' | 'quantity_remaining' | 'purchase_date'>[];
};

// Define the input type for updateStudent
export type StudentUpdateData = Partial<Omit<StudentRow, 'id' | 'family_id' | 'created_at' | 'updated_at'>>;


/**
 * Fetches detailed information for a specific student, including family name,
 * current belt rank, family's 1:1 session balance, and available sessions.
 * Uses the Supabase Admin client for direct database access.
 *
 * @param studentId The ID of the student to fetch.
 * @param supabaseAdmin Optional Supabase admin client instance. If not provided, it will be created.
 * @returns The detailed student information.
 * @throws {Response} Throws Remix Response objects for errors (e.g., 404 Not Found, 500 Server Error).
 */
export async function getStudentDetails(
    studentId: string,
    supabaseAdmin?: SupabaseClient<Database>
): Promise<StudentDetails> {
    invariant(studentId, "Missing studentId parameter");
    console.log(`[Service/getStudentDetails] Fetching student details for ID: ${studentId}`);

    const client = supabaseAdmin ?? createSupabaseAdminClient();

    // Fetch student data and related family name
    const { data: studentData, error } = await client
        .from('students')
        .select(`*, families ( id, name )`)
        .eq('id', studentId)
        .single();

    if (error || !studentData) {
        console.error(`[Service/getStudentDetails] Error fetching student ${studentId}:`, error?.message);
        throw new Response("Student not found", { status: 404 });
    }

    // Fetch the latest belt award
    const { data: latestBeltAward, error: beltError } = await client
        .from('belt_awards')
        .select('type')
        .eq('student_id', studentId)
        .order('awarded_date', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (beltError) {
        console.error(`[Service/getStudentDetails] Error fetching latest belt for student ${studentId}:`, beltError.message);
        // Proceed with null belt rank
    }

    const studentWithBelt: Omit<StudentDetails, 'familyIndividualSessionBalance' | 'availableIndividualSessions'> = {
        ...studentData,
        families: studentData.families ?? null,
        currentBeltRank: latestBeltAward?.type ?? null,
    };

    // Fetch family's individual session balance
    let familyIndividualSessionBalance = 0;
    if (studentWithBelt.families?.id) {
        const { data: balanceData, error: balanceError } = await client
            .from('family_one_on_one_balance')
            .select('total_remaining_sessions')
            .eq('family_id', studentWithBelt.families.id)
            .maybeSingle();

        if (balanceError) {
            console.error(`[Service/getStudentDetails] Error fetching Individual Session balance for family ${studentWithBelt.families.id}:`, balanceError.message);
        } else if (balanceData) {
            familyIndividualSessionBalance = balanceData.total_remaining_sessions ?? 0;
        }
    }

    // Fetch available individual session purchase records
    let availableIndividualSessions: Pick<IndividualSessionRow, 'id' | 'quantity_remaining' | 'purchase_date'>[] = [];
    if (studentWithBelt.families?.id) {
        const { data: sessionsData, error: sessionsError } = await client
            .from('one_on_one_sessions')
            .select('id, quantity_remaining, purchase_date')
            .eq('family_id', studentWithBelt.families.id)
            .gt('quantity_remaining', 0)
            .order('purchase_date', { ascending: true });

        if (sessionsError) {
            console.error(`[Service/getStudentDetails] Error fetching available Individual Sessions for family ${studentWithBelt.families.id}:`, sessionsError.message);
        } else {
            availableIndividualSessions = sessionsData ?? [];
        }
    }

    return {
        ...studentWithBelt,
        familyIndividualSessionBalance,
        availableIndividualSessions,
    };
}

/**
 * Updates a student's details in the database.
 * Uses the Supabase Admin client for direct database access.
 *
 * @param studentId The ID of the student to update.
 * @param updateData An object containing the fields to update.
 * @param supabaseAdmin Optional Supabase admin client instance. If not provided, it will be created.
 * @throws {Error} Throws standard Error objects on failure.
 */
export async function updateStudent(
    studentId: string,
    updateData: StudentUpdateData,
    supabaseAdmin?: SupabaseClient<Database>
): Promise<void> {
    invariant(studentId, "Missing studentId parameter");
    console.log(`[Service/updateStudent] Updating student ${studentId}`);

    const client = supabaseAdmin ?? createSupabaseAdminClient();

    const { error: updateError } = await client
        .from('students')
        .update(updateData)
        .eq('id', studentId);

    if (updateError) {
        console.error(`[Service/updateStudent] Error updating student ${studentId}:`, updateError.message);
        throw new Error(`Failed to update student: ${updateError.message}`);
    }
    console.log(`[Service/updateStudent] Successfully updated student ${studentId}`);
}

/**
 * Deletes a student from the database.
 * Uses the Supabase Admin client for direct database access.
 *
 * @param studentId The ID of the student to delete.
 * @param supabaseAdmin Optional Supabase admin client instance. If not provided, it will be created.
 * @throws {Error} Throws standard Error objects on failure.
 */
export async function deleteStudent(
    studentId: string,
    supabaseAdmin?: SupabaseClient<Database>
): Promise<void> {
    invariant(studentId, "Missing studentId parameter");
    console.log(`[Service/deleteStudent] Deleting student ${studentId}`);

    const client = supabaseAdmin ?? createSupabaseAdminClient();

    const { error } = await client
        .from('students')
        .delete()
        .eq('id', studentId);

    if (error) {
        console.error(`[Service/deleteStudent] Supabase error deleting student ${studentId}:`, error.message);
        throw new Error(`Database error deleting student: ${error.message}`);
    }
    console.log(`[Service/deleteStudent] Successfully deleted student ${studentId}`);
}

/**
 * Records the usage of a single 1:1 session for a student.
 * This involves decrementing the quantity on the purchase record and inserting a usage record.
 * Performs operations sequentially (consider RPC for transactionality if needed).
 * Uses the Supabase Admin client for direct database access.
 *
 * @param sessionPurchaseId The ID of the 'one_on_one_sessions' record being used.
 * @param studentId The ID of the student using the session.
 * @param usageDate The date the session was used (YYYY-MM-DD).
 * @param adminUserId The ID of the admin user recording the usage.
 * @param notes Optional notes about the session.
 * @param supabaseAdmin Optional Supabase admin client instance. If not provided, it will be created.
 * @returns The new remaining balance for the family after usage.
 * @throws {Error} Throws standard Error objects on failure (e.g., session not found, no quantity, DB error).
 */
export async function recordIndividualSessionUsage(
    sessionPurchaseId: string,
    studentId: string,
    usageDate: string,
    adminUserId: string,
    notes: string | null,
    supabaseAdmin?: SupabaseClient<Database>
): Promise<number> {
    invariant(sessionPurchaseId, "Missing sessionPurchaseId parameter");
    invariant(studentId, "Missing studentId parameter");
    invariant(usageDate, "Missing usageDate parameter");
    invariant(adminUserId, "Missing adminUserId parameter");
    console.log(`[Service/recordIndividualSessionUsage] Recording usage for session purchase ${sessionPurchaseId} by student ${studentId}`);

    const client = supabaseAdmin ?? createSupabaseAdminClient();

    // 1. Fetch the session to ensure it exists and has quantity
    const { data: sessionData, error: fetchError } = await client
        .from('one_on_one_sessions')
        .select('quantity_remaining, family_id')
        .eq('id', sessionPurchaseId)
        .single();

    if (fetchError || !sessionData) {
        console.error(`[Service/recordIndividualSessionUsage] Session purchase record ${sessionPurchaseId} not found or error fetching:`, fetchError?.message);
        throw new Error(`Session purchase record not found or error fetching: ${fetchError?.message}`);
    }

    if (sessionData.quantity_remaining <= 0) {
        console.warn(`[Service/recordIndividualSessionUsage] Session ${sessionPurchaseId} has no remaining quantity.`);
        throw new Error("Selected session has no remaining quantity.");
    }

    // 2. Decrement the quantity_remaining
    const newQuantity = sessionData.quantity_remaining - 1;
    const { error: updateError } = await client
        .from('one_on_one_sessions')
        .update({ quantity_remaining: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', sessionPurchaseId);

    if (updateError) {
        console.error(`[Service/recordIndividualSessionUsage] Error decrementing session ${sessionPurchaseId}:`, updateError.message);
        throw new Error(`Failed to update session balance: ${updateError.message}`);
    }

    // 3. Insert the usage record
    const usageRecord: Omit<OneOnOneSessionUsageRow, 'id' | 'created_at'> = {
        session_purchase_id: sessionPurchaseId,
        student_id: studentId,
        usage_date: usageDate,
        notes: notes,
        recorded_by: adminUserId,
    };
    const { error: usageInsertError } = await client
        .from('one_on_one_session_usage')
        .insert(usageRecord);

    if (usageInsertError) {
        console.error(`[Service/recordIndividualSessionUsage] Error inserting usage record for session ${sessionPurchaseId}:`, usageInsertError.message);
        // Attempt to rollback decrement
        console.warn(`[Service/recordIndividualSessionUsage] Attempting rollback of quantity decrement for session ${sessionPurchaseId}`);
        await client
            .from('one_on_one_sessions')
            .update({ quantity_remaining: sessionData.quantity_remaining, updated_at: new Date().toISOString() })
            .eq('id', sessionPurchaseId); // Attempt rollback
        throw new Error(`Failed to record session usage details: ${usageInsertError.message}`);
    }

    // 4. Fetch the updated total balance for the family
    let newBalance = 0;
    if (sessionData.family_id) {
        const { data: balanceData, error: balanceFetchError } = await client
            .from('family_one_on_one_balance')
            .select('total_remaining_sessions')
            .eq('family_id', sessionData.family_id)
            .maybeSingle();

        if (balanceFetchError) {
            console.error(`[Service/recordIndividualSessionUsage] Error fetching updated balance for family ${sessionData.family_id}:`, balanceFetchError.message);
            // Proceed, but balance might be stale in the return value
        } else {
            newBalance = balanceData?.total_remaining_sessions ?? 0;
        }
    }

    console.log(`[Service/recordIndividualSessionUsage] Successfully recorded usage for session ${sessionPurchaseId}. New family balance: ${newBalance}`);
    return newBalance;
}


// Helper to create admin client (consider moving to a shared utils if used elsewhere)
function createSupabaseAdminClient(): SupabaseClient<Database> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Service/createSupabaseAdminClient] Missing Supabase URL or Service Role Key env vars.");
        // Throw standard Error here, let calling Remix function handle Response creation
        throw new Error("Server configuration error: Missing Supabase credentials.");
    }
    return createClient<Database>(supabaseUrl, supabaseServiceKey);
}
