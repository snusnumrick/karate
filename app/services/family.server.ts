import { createClient, SupabaseClient } from "@supabase/supabase-js";
import invariant from "tiny-invariant";
import type { Database } from "~/types/supabase";

// Define row types locally or import if shared
type FamilyRow = Database['public']['Tables']['families']['Row'];
// Removed unused GuardianRow type
type StudentRow = Database['public']['Tables']['students']['Row'];

// Define the shape returned by the specific select query
type FamilyWithStudents = FamilyRow & {
    students: StudentRow[] | null; // students can be null if no relation exists
};

// Define the expected return type for the service function
// Guardians are no longer included here; fetch them separately.
export type FamilyDetails = FamilyRow & {
    // guardians: GuardianRow[]; // Removed
    students: StudentRow[];
    oneOnOneBalance: number;
};

/**
 * Fetches detailed information for a specific family, including guardians, students,
 * and their 1:1 session balance.
 * Uses the Supabase Admin client for direct database access.
 *
 * @param familyId The ID of the family to fetch.
 * @param supabaseAdmin Optional Supabase admin client instance. If not provided, it will be created.
 * @returns The detailed family information.
 * @throws {Response} Throws Remix Response objects for errors (e.g., 404 Not Found, 500 Server Error).
 */
export async function getFamilyDetails(
    familyId: string,
    supabaseAdmin?: SupabaseClient<Database>
): Promise<FamilyDetails> {
    invariant(familyId, "Missing familyId parameter");
    console.log(`[Service/getFamilyDetails] Fetching family details for ID: ${familyId}`);

    const client = supabaseAdmin ?? createSupabaseAdminClient(); // Use provided client or create one

    console.log('[Service/getFamilyDetails] Supabase client obtained. Fetching data...');
    const { data: familyData, error: familyError } = await client
        .from('families')
        .select(`
            *,
            // guardians (*), // Removed - fetch guardians separately
            students (*)
        `)
        .eq('id', familyId)
        .single<FamilyWithStudents>(); // Explicitly type the expected result

    console.log('[Service/getFamilyDetails] Supabase query result:', { familyData, familyError });

    if (familyError) {
        console.error(`[Service/getFamilyDetails] Supabase error fetching family ${familyId}:`, familyError.message);
        throw new Response(`Database error: ${familyError.message}`, { status: 500 });
    }

    if (!familyData) {
        console.warn(`[Service/getFamilyDetails] No family data found for ID: ${familyId}. Throwing 404.`);
        throw new Response("Family not found", { status: 404 });
    }

    // Now that we know familyData is not null and is of type FamilyWithStudents,
    // we can safely access its properties.
    const familyBaseData: FamilyRow = { ...familyData }; // Spread the base family properties
    const studentsData: StudentRow[] = familyData.students ?? []; // Ensure students is an array

    // Fetch 1:1 balance
    let oneOnOneBalance = 0;
    const { data: balanceData, error: balanceError } = await client
        .from('family_one_on_one_balance')
        .select('total_remaining_sessions')
        .eq('family_id', familyId)
        .maybeSingle();

    if (balanceError) {
        console.error(`[Service/getFamilyDetails] Error fetching 1:1 balance for family ${familyId}:`, balanceError.message);
        // Don't fail load, just show 0
    } else if (balanceData) {
        oneOnOneBalance = balanceData.total_remaining_sessions ?? 0;
    }

    console.log(`[Service/getFamilyDetails] Family ${familyId} 1:1 balance: ${oneOnOneBalance}`);

    // Construct the final FamilyDetails object
    const finalFamilyDetails: FamilyDetails = {
        ...familyBaseData, // Spread the validated family data
        students: studentsData, // Assign the validated students array
        oneOnOneBalance: oneOnOneBalance,
    };

    return finalFamilyDetails;
}


// Helper to create admin client (consider moving to a shared utils if used elsewhere)
function createSupabaseAdminClient(): SupabaseClient<Database> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Service/createSupabaseAdminClient] Missing Supabase URL or Service Role Key env vars.");
        throw new Response("Server configuration error: Missing Supabase credentials.", { status: 500 });
    }
    return createClient<Database>(supabaseUrl, supabaseServiceKey);
}
