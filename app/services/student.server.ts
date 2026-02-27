import { SupabaseClient } from "@supabase/supabase-js";
import invariant from "tiny-invariant";
import type { Database } from "~/types/database.types";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
// Removed unused format import

// Define types locally or import if shared
type StudentRow = Omit<Database['public']['Tables']['students']['Row'], 'belt_rank'>;
type FamilyRow = Database['public']['Tables']['families']['Row'];
type BeltRankEnum = Database['public']['Enums']['belt_rank_enum'];
type IndividualSessionRow = Database['public']['Tables']['one_on_one_sessions']['Row'];

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

    const client = supabaseAdmin ?? getSupabaseAdminClient();

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

    const client = supabaseAdmin ?? getSupabaseAdminClient();

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

    const client = supabaseAdmin ?? getSupabaseAdminClient();

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
 * Uses a database RPC to atomically decrement quantity and insert the usage record.
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

    const client = supabaseAdmin ?? getSupabaseAdminClient();
    const rpcClient = client as unknown as {
        rpc: (
            fn: string,
            args?: Record<string, unknown>
        ) => Promise<{ data: number | null; error: { message: string } | null }>;
    };

    const { data: newBalance, error: rpcError } = await rpcClient.rpc(
        'record_individual_session_usage',
        {
            p_session_purchase_id: sessionPurchaseId,
            p_student_id: studentId,
            p_usage_date: usageDate,
            p_admin_user_id: adminUserId,
            p_notes: notes,
        }
    );

    if (rpcError) {
        console.error(
            `[Service/recordIndividualSessionUsage] Atomic usage RPC failed for session ${sessionPurchaseId}:`,
            rpcError.message
        );
        throw new Error(`Failed to record session usage: ${rpcError.message}`);
    }

    const updatedBalance = newBalance ?? 0;
    console.log(
        `[Service/recordIndividualSessionUsage] Successfully recorded usage for session ${sessionPurchaseId}. ` +
        `New family balance: ${updatedBalance}`
    );
    return updatedBalance;
}
