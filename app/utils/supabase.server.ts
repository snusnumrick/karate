import {createServerClient} from "@supabase/auth-helpers-remix";
import {createClient} from "@supabase/supabase-js"; // Import standard client
import type {Database} from "~/types/supabase";

import { siteConfig } from "~/config/site"; // Import siteConfig for tax rate

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

    // Trim potential whitespace and check for empty strings explicitly
    const supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim() || '';

    // Provide specific error messages
    if (!supabaseUrl) {
        throw new Error('Missing or invalid SUPABASE_URL environment variable. Check server configuration.');
    }
    if (!supabaseAnonKey) {
        throw new Error('Missing or invalid SUPABASE_ANON_KEY environment variable. Check server configuration.');
    }
    if (!supabaseServiceKey) {
        throw new Error('Missing or invalid SUPABASE_SERVICE_ROLE_KEY environment variable. Check server configuration.');
    }

    // Now we know the variables are non-empty strings, proceed with initialization
    const supabaseServer = createServerClient<Database>(
        supabaseUrl,
        supabaseServiceKey,
        {request, response}
    );

    const supabaseClient = createServerClient<Database>(
        supabaseUrl, // Use the validated variable
        supabaseAnonKey, // Use the validated variable
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
    subtotalAmount: number,
    studentIds: string[],
    type: Database['public']['Enums']['payment_type_enum'],
    orderId?: string | null // Optional: Add orderId parameter
) {
    // Use the standard client with service role for DB operations server-side
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables required for payment record creation.');
    }
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // --- Multi-Tax Calculation ---
    // 1. Fetch active tax rates applicable to this site/region
    const applicableTaxNames = siteConfig.pricing.applicableTaxNames;
    const { data: taxRatesData, error: taxRatesError } = await supabaseAdmin
        .from('tax_rates')
        .select('id, name, rate')
        .in('name', applicableTaxNames)
        .eq('is_active', true);

    if (taxRatesError) {
        console.error('Error fetching tax rates:', taxRatesError.message);
        return { data: null, error: `Failed to fetch tax rates: ${taxRatesError.message}` };
    }
    if (!taxRatesData || taxRatesData.length === 0) {
        console.warn(`No active tax rates found for names: ${applicableTaxNames.join(', ')}. Proceeding without tax.`);
        // Proceed without tax if none are configured/active
    }

    // 2. Calculate individual taxes and total tax
    let totalTaxAmount = 0;
    const paymentTaxesToInsert: Array<{
        tax_rate_id: string;
        tax_amount: number;
        tax_rate_snapshot: number;
        tax_name_snapshot: string;
    }> = [];

    if (taxRatesData) {
        for (const taxRate of taxRatesData) {
            // Ensure rate is a number before calculation
            const rate = Number(taxRate.rate);
            if (isNaN(rate)) {
                console.error(`Invalid tax rate found for ${taxRate.name}: ${taxRate.rate}`);
                continue; // Skip this tax rate
            }
            const taxAmountForThisRate = Math.round(subtotalAmount * rate);
            totalTaxAmount += taxAmountForThisRate;
            paymentTaxesToInsert.push({
                tax_rate_id: taxRate.id,
                tax_amount: taxAmountForThisRate,
                tax_rate_snapshot: rate, // Store the rate used
                tax_name_snapshot: taxRate.name, // Store the name used
            });
        }
    }

    // 3. Calculate final total amount
    const totalAmount = subtotalAmount + totalTaxAmount;
    // --- End Multi-Tax Calculation ---


    // 4. Create the main payment record in Supabase (without tax_amount column)
    const { data: paymentRecord, error: insertPaymentError } = await supabaseAdmin
        .from('payments')
        .insert({
            family_id: familyId,
            subtotal_amount: subtotalAmount, // Store subtotal
            // tax_amount column removed
            total_amount: totalAmount,
            status: 'pending',
            type: type,
            order_id: orderId || null, // Set order_id if provided
            // payment_date, payment_method, stripe_payment_intent_id, receipt_url updated later
        })
        .select('id')
        .single();

    if (insertPaymentError || !paymentRecord) {
        console.error('Supabase payment insert error:', insertPaymentError?.message);
        return { data: null, error: `Failed to create payment record: ${insertPaymentError?.message || 'Unknown error'}` };
    }

    const paymentId = paymentRecord.id;

    // 5. Insert records into the payment_taxes junction table
    if (paymentTaxesToInsert.length > 0) {
        const taxesWithPaymentId = paymentTaxesToInsert.map(tax => ({
            ...tax,
            payment_id: paymentId,
        }));
        const { error: insertTaxesError } = await supabaseAdmin
            .from('payment_taxes')
            .insert(taxesWithPaymentId);

        if (insertTaxesError) {
            console.error(`Supabase payment_taxes insert error for payment ${paymentId}:`, insertTaxesError.message);
            // Attempt cleanup: Delete the payment record if tax insertion fails
            await supabaseAdmin.from('payments').delete().eq('id', paymentId);
            return { data: null, error: `Failed to record tax details: ${insertTaxesError.message}` };
        }
        // console.log(`[createInitialPaymentRecord] Inserted ${taxesWithPaymentId.length} tax records for payment ${paymentId}.`);
    }


    // 6. Insert records into the payment_students junction table *if* student IDs are provided AND it's not a store purchase
    if (type !== 'store_purchase' && studentIds && studentIds.length > 0) {
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
            return { data: null, error: `Failed to link students to payment: ${junctionError.message}` };
        }
    } else if ((type === 'monthly_group' || type === 'yearly_group') && (!studentIds || studentIds.length === 0)) {
        // If it's a group payment but no students were selected/provided, this is an error
        console.error(`Group payment type (${type}) selected but no student IDs provided.`);
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


// Helper function to get the base site URL
function getSiteUrl(): string {
    // Ensure this environment variable is set in your deployment environment (Vercel, Netlify, etc.)
    // and in your local .env file for development. Use VITE_ prefix for consistency.
    const siteUrl = process.env.VITE_SITE_URL;
    if (!siteUrl) {
        console.error("FATAL: VITE_SITE_URL environment variable is not set. Cannot generate absolute receipt URLs.");
        // Throw an error or return a default that makes it obvious something is wrong
        // Throwing an error might be better to prevent unexpected behavior.
        throw new Error("VITE_SITE_URL environment variable is not configured.");
        // Or fallback to relative path if absolutely necessary, but log loudly:
        // console.warn("VITE_SITE_URL environment variable is not set. Defaulting to relative paths for receipts, which might not work in emails.");
        // return "";
    }
    // Ensure it doesn't end with a slash for clean joining
    return siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
}


export async function updatePaymentStatus(
    supabasePaymentId: string, // Use Supabase Payment ID (from metadata) to find the record
    status: "pending" | "succeeded" | "failed", // Use the specific enum values
    _stripeReceiptUrl?: string | null, // Stripe receipt URL - renamed as we won't store it directly
    paymentMethod?: string | null, // Added parameter for payment method
    stripePaymentIntentId?: string | null, // Optional: Store the PI ID if needed
    type?: Database['public']['Enums']['payment_type_enum'] | null, // Use 'type' parameter
    familyId?: string | null, // Added: Needed for individual session insert
    quantity?: number | null, // Added: Needed for individual session insert
    // Add amounts from metadata for verification/logging if needed
    subtotalAmountFromMeta?: number | null,
    taxAmountFromMeta?: number | null,
    totalAmountFromMeta?: number | null,
    // Add card last 4
    cardLast4?: string | null
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
        // receipt_url: receiptUrl, // Don't store the Stripe receipt URL directly anymore
        payment_method: paymentMethod,
        type: type || undefined, // Use 'type' parameter
        stripe_payment_intent_id: stripePaymentIntentId || undefined, // Store the PI ID
        card_last4: cardLast4 || undefined, // Store card last 4 digits
    };

    // Set payment_date and generate our internal receipt_url when status becomes 'succeeded'
    if (status === 'succeeded') {
        updateData.payment_date = new Date().toISOString();
        try {
            // Construct the ABSOLUTE URL to our custom receipt page
            const siteBaseUrl = getSiteUrl(); // Get base URL (e.g., https://yourdomain.com)
            updateData.receipt_url = `${siteBaseUrl}/family/receipt/${supabasePaymentId}`;
            // console.log(`[updatePaymentStatus] Generated receipt URL for ${supabasePaymentId}: ${updateData.receipt_url}`);
        } catch (e) {
             console.error(`[updatePaymentStatus] Failed to generate receipt URL for ${supabasePaymentId} due to missing VITE_SITE_URL. Payment status updated, but receipt URL is null.`, e);
             updateData.receipt_url = null; // Ensure it's null if generation fails
        }
    } else if (status === 'failed') {
        // Also set payment_date for failed payments, but no receipt URL
        updateData.payment_date = new Date().toISOString();
        updateData.receipt_url = null; // Ensure no receipt URL for failed payments
    } else {
        // For pending status, ensure receipt_url is null
        updateData.receipt_url = null;
    }

    // console.log(`[updatePaymentStatus] FINAL update data for payment ${supabasePaymentId}:`, JSON.stringify(updateData));

    const {data, error} = await supabaseAdmin
        .from('payments')
        .update(updateData)
        .eq('id', supabasePaymentId) // Find record using the Supabase Payment ID
        .select('id, family_id, subtotal_amount, total_amount') // Select amounts for verification/logging
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

    // Optional: Log/verify amounts from metadata against DB record
    if (status === 'succeeded') {
        if (subtotalAmountFromMeta !== null && data.subtotal_amount !== subtotalAmountFromMeta) {
            console.warn(`[Webhook ${supabasePaymentId}] Subtotal mismatch! DB: ${data.subtotal_amount}, Meta: ${subtotalAmountFromMeta}`);
        }
        if (totalAmountFromMeta !== null && data.total_amount !== totalAmountFromMeta) {
            console.warn(`[Webhook ${supabasePaymentId}] Total amount mismatch! DB: ${data.total_amount}, Meta: ${totalAmountFromMeta}`);
            // Potentially throw error or alert if amounts don't match
        }
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
        // console.log(`[updatePaymentStatus] Recorded Individual Session purchase for payment ${data.id}.`); // Simplified log
    } else if (status === 'succeeded' && type === 'individual_session') { // Check against 'type' parameter
        // Keep this warning for debugging potential future issues
        console.warn(`[updatePaymentStatus] Condition for individual session insert NOT met for payment ${data.id}. Status='${status}', Type='${type}', Quantity='${quantity}'. Session record NOT created.`); // Log updated
    }

    return data; // Return the updated payment data
}
