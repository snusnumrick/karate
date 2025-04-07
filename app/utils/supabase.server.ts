import {createServerClient} from "@supabase/auth-helpers-remix";
import {createClient} from "@supabase/supabase-js"; // Import standard client
import type {Database} from "~/types/supabase";

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    console.warn("STRIPE_SECRET_KEY is not set. Payment functionality will be disabled.");
}
// Ensure Stripe version compatibility if needed, e.g., apiVersion: '2023-10-16'
// Stripe client initialization removed since it is not used.

type SupabaseClient = ReturnType<typeof createServerClient<Database>>;
type SupabaseServerClientReturn = {
    supabaseServer: SupabaseClient,
    supabaseClient: SupabaseClient,
    response: Response
};


export function getSupabaseServerClient(request: Request): SupabaseServerClientReturn {
    const response = new Response();

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        // Throw an error instead of just logging. This prevents proceeding with invalid config.
        throw new Error('Missing required Supabase environment variables (URL, Anon Key, or Service Role Key). Check server configuration.');
    }

    const supabaseServer = createServerClient<Database>(
        supabaseUrl,
        supabaseServiceKey,
        {request, response}
    );

    const supabaseClient = createServerClient<Database>(
        supabaseUrl,
        supabaseAnonKey,
        {request, response}
    );

    return {supabaseServer, supabaseClient, response};
}

export async function isUserAdmin(userId: string): Promise<boolean> {
    if (!userId) return false;

    // Use the standard Supabase client with the service role key for admin checks
    // This avoids needing a Request object when checking roles internally.
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        // Throw an error for missing configuration
        throw new Error('Missing Supabase environment variables (URL or Service Role Key) required for admin check.');
    }

    // Create a temporary client instance with service role privileges
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    const {data, error} = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    if (error || !data) {
        return false;
    }

    return data.role === 'admin';
}

// Renamed from createPaymentSession - This function ONLY creates the initial DB record.
export async function createInitialPaymentRecord(
    familyId: string,
    amount: number, // Amount in smallest currency unit (e.g., cents) - Calculated by caller
    studentIds: string[], // Can be empty for non-student specific payments like 1:1? Let's assume 1:1 is still family-linked.
    type: Database['public']['Enums']['payment_type_enum'] // Use 'type' to match DB column
) {
    // Use the standard client with service role for creating payment records server-side
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        // Throw an error for missing configuration
        throw new Error('Missing Supabase environment variables (URL or Service Role Key) required for payment record creation.');
    }
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);


    // Create a pending payment record in Supabase
    const {data: paymentRecord, error: insertError} = await supabaseAdmin // Use supabaseAdmin here
        .from('payments')
        .insert({
            family_id: familyId,
            amount: amount, // Use amount calculated by caller
            status: 'pending',
            type: type, // Set the 'type' column using the 'type' parameter
            // payment_date, payment_method, stripe_session_id, receipt_url are set later
        })
        .select('id') // Select the ID of the newly created record
        .single();

    if (insertError || !paymentRecord) {
        console.error('Supabase payment insert error:', insertError?.message);
        return {data: null, error: `Failed to create payment record: ${insertError.message}`};
    }

    const paymentId = paymentRecord.id;

    // 2. Insert records into the payment_students junction table *if* student IDs are provided
    //    (Relevant for monthly/yearly group payments)
    if (studentIds && studentIds.length > 0) {
        const studentInserts = studentIds.map(studentId => ({
            payment_id: paymentId,
            student_id: studentId,
        }));

        const {error: junctionError} = await supabaseAdmin
            .from('payment_students')
            .insert(studentInserts);

        if (junctionError) {
            console.error('Supabase payment_students insert error:', junctionError.message);
            // Attempt to delete the payment record if linking students fails
            await supabaseAdmin.from('payments').delete().eq('id', paymentId); // Cleanup payment record
            return {data: null, error: `Failed to link students to payment: ${junctionError.message}`};
        }
    } else if (type === 'monthly_group' || type === 'yearly_group') { // Check against 'type' parameter
        // If it's a group payment but no students were selected/provided, this is an error
        console.error('Group payment type selected but no student IDs provided.');
        await supabaseAdmin.from('payments').delete().eq('id', paymentId); // Cleanup payment record
        return {data: null, error: 'No students selected for group payment.'};
    }

    // Return the newly created payment record ID and null error
    return {data: {id: paymentId}, error: null};
}

// --- Student Eligibility Check ---

// Define the eligibility window in days
const MONTHLY_PAYMENT_ELIGIBILITY_WINDOW_DAYS = 35; // ~1 month + buffer
const YEARLY_PAYMENT_ELIGIBILITY_WINDOW_DAYS = 370; // ~1 year + buffer

export type EligibilityStatus = {
    eligible: boolean;
    reason: 'Trial' | 'Paid - Monthly' | 'Paid - Yearly' | 'Expired'; // More specific reasons
    lastPaymentDate?: string; // Optional: ISO date string of the last successful payment
    type?: Database['public']['Enums']['payment_type_enum']; // Use 'type' to match DB column
};

/**
 * Checks if a student is eligible to attend class today based on payment status.
 * Eligibility rules:
 * 1. Eligible if on Free Trial (zero successful payments linked).
 * 2. Eligible if the most recent successful payment was within the last PAYMENT_ELIGIBILITY_WINDOW_DAYS days.
 * @param studentId The ID of the student to check.
 * @param supabaseAdmin A Supabase client instance with service_role privileges.
 * @returns Promise<EligibilityStatus>
 */
export async function checkStudentEligibility(
    studentId: string,
    supabaseAdmin: ReturnType<typeof createClient<Database>>
): Promise<EligibilityStatus> {
    // 1. Fetch successful payments linked to this student, ordered by date descending.
    //    We will filter by type *after* fetching to simplify the initial query.
    const {data: paymentLinks, error: linkError} = await supabaseAdmin
        .from('payment_students')
        .select(`                                                                                                                                                                                                        
            payment_id,                                                                                                                                                                                                  
            payments!inner ( id, payment_date, status, type )                                                                                                                                                            
        `) // Use !inner join syntax to ensure payment exists, select type
        .eq('student_id', studentId)
        .eq('payments.status', 'succeeded') // Keep filter for successful payments
        .order('payment_date', {foreignTable: 'payments', ascending: false}); // Get most recent first

    if (linkError) {
        console.error(`Error fetching successful payment links for student ${studentId}:`, linkError.message);
        // Default to not eligible if we can't verify payments
        return {eligible: false, reason: 'Expired'}; // Use 'Expired'
    }

    // Filter out null payments and filter for the correct *type* here in the code
    const successfulGroupPayments = paymentLinks
        ?.map(link => link.payments)
        .filter(payment =>
            payment !== null &&
            payment.payment_date !== null &&
            payment.type !== null &&
            ['monthly_group', 'yearly_group'].includes(payment.type) // Filter for group types now
        ) as Array<{
        id: string,
        payment_date: string,
        status: string,
        type: Database['public']['Enums']['payment_type_enum'] // This 'type' is correct (from DB)
    }> ?? [];


    // 2. Check for Free Trial (zero successful group payments)
    if (successfulGroupPayments.length === 0) {
        return {eligible: true, reason: 'Trial'};
    }

    // 3. Check the most recent group payment date against the appropriate eligibility window
    const mostRecentGroupPayment = successfulGroupPayments[0];
    const lastPaymentDate = new Date(mostRecentGroupPayment.payment_date);
    const type = mostRecentGroupPayment.type; // Use 'type' variable

    const today = new Date();
    const eligibilityCutoffDate = new Date(today);

    let reason: EligibilityStatus['reason'] = 'Expired'; // Default if checks fail
    let eligibilityWindowDays: number;

    if (type === 'yearly_group') { // Check against 'type' variable
        eligibilityWindowDays = YEARLY_PAYMENT_ELIGIBILITY_WINDOW_DAYS;
        reason = 'Paid - Yearly';
    } else { // Default to monthly for 'monthly_group' (or any unexpected type that slipped through)
        eligibilityWindowDays = MONTHLY_PAYMENT_ELIGIBILITY_WINDOW_DAYS;
        reason = 'Paid - Monthly';
    }

    eligibilityCutoffDate.setDate(today.getDate() - eligibilityWindowDays);

    if (lastPaymentDate >= eligibilityCutoffDate) {
        // Payment is recent enough
        return {
            eligible: true,
            reason: reason, // Use the determined reason
            lastPaymentDate: mostRecentGroupPayment.payment_date,
            type: type, // Use 'type'
        };
    }

    // 4. If not on trial and the most recent group payment is outside the window
    return {
        eligible: false,
        reason: 'Expired',
        lastPaymentDate: mostRecentGroupPayment.payment_date, // Still pass the date for context
        type: type, // Use 'type'
    };
}


export async function updatePaymentStatus(
    supabasePaymentId: string, // Use Supabase Payment ID (from metadata) to find the record
    status: "pending" | "succeeded" | "failed", // Use the specific enum values
    receiptUrl?: string | null, // Stripe might provide this in the webhook event
    paymentMethod?: string | null, // Added parameter for payment method
    stripePaymentIntentId?: string | null, // Optional: Store the PI ID if needed
    type?: Database['public']['Enums']['payment_type_enum'] | null, // Use 'type' parameter
    familyId?: string | null, // Added: Needed for individual session insert
    quantity?: number | null // Added: Needed for individual session insert
) {
    // Use the standard client with service role for webhooks/server-side updates
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        // Throw an error for missing configuration
        throw new Error('Missing Supabase environment variables (URL or Service Role Key) required for payment update.');
    }
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);


    const updateData: Partial<Database['public']['Tables']['payments']['Update']> = {
        status,
        receipt_url: receiptUrl,
        payment_method: paymentMethod,
        type: type || undefined, // Use 'type' parameter
        stripe_payment_intent_id: stripePaymentIntentId || undefined, // Store the PI ID
    };

    // Set payment_date when status becomes 'succeeded' or 'failed'
    if (status === 'succeeded' || status === 'failed') {
        updateData.payment_date = new Date().toISOString();
    }

    const {data, error} = await supabaseAdmin
        .from('payments')
        .update(updateData)
        .eq('id', supabasePaymentId) // Find record using the Supabase Payment ID
        .select('id, family_id') // Select id and family_id
        .single();

    if (error) {
        console.error(`Payment update failed for Supabase payment ID ${supabasePaymentId}:`, error.message);
        // Decide how to handle webhook errors - retry? log?
        throw new Error(`Payment update failed: ${error.message}`);
    }
    if (!data) {
        console.error(`No payment record found for Supabase payment ID ${supabasePaymentId} during update.`);
        throw new Error(`Payment record not found for ID ${supabasePaymentId}.`);
    }

    // console.log(`Payment status updated successfully for Supabase payment ID ${supabasePaymentId} to ${status}.`); // Updated log message

    // If payment succeeded, type is individual_session, and quantity is provided, insert the session record
    // console.log(`[updatePaymentStatus] Checking condition for individual session insert: status=${status}, type=${type}, quantity=${quantity}`); // Log updated
    if (status === 'succeeded' && type === 'individual_session' && quantity && quantity > 0) { // Check against 'type' parameter
        // console.log(`[updatePaymentStatus] Condition met for individual session insert for payment ${data.id}.`); // Removed log
        // Use family_id from the updated payment record OR the passed familyId as fallback
        const targetFamilyId = data.family_id || familyId;
        if (!targetFamilyId) {
            console.error(`Cannot record Individual Session for payment ${data.id}: Missing family ID.`);
            // Return the payment data but log the error - session not recorded
            return data;
        }

        // console.log(`Recording ${quantity} Individual Session(s) for payment ${data.id}, family ${targetFamilyId}`); // Removed log
        const { error: sessionInsertError } = await supabaseAdmin
            .from('one_on_one_sessions') // Table name remains the same
            .insert({
                payment_id: data.id,
                family_id: targetFamilyId,
                quantity_purchased: quantity,
                quantity_remaining: quantity,
            });

        if (sessionInsertError) {
            console.error(`[updatePaymentStatus] FAILED to insert Individual Session record for payment ${data.id}:`, sessionInsertError.message);
            // Critical: Payment succeeded but session credit failed. Needs monitoring/alerting.
            // Throw an error here to indicate the webhook handler should potentially return an error status to Stripe.
            throw new Error(`Payment ${data.id} succeeded, but failed to record Individual Session credits: ${sessionInsertError.message}`);
        }
        console.log(`[updatePaymentStatus] Recorded Individual Session purchase for payment ${data.id}.`); // Simplified log
    } else if (status === 'succeeded' && type === 'individual_session') { // Check against 'type' parameter
        // Keep this warning for debugging potential future issues
        console.warn(`[updatePaymentStatus] Condition for individual session insert NOT met for payment ${data.id}. Status='${status}', Type='${type}', Quantity='${quantity}'. Session record NOT created.`); // Log updated
    }

    return data; // Return the updated payment data
}
