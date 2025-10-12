import {createServerClient} from "@supabase/auth-helpers-remix";
import {createClient} from "@supabase/supabase-js"; // Import standard client
import type {SupabaseClient as SupabaseClientType} from "@supabase/supabase-js";
import type {Database} from "~/types/database.types";
import type { EligibilityStatus } from '~/types/payment';
import type { UserRole } from '~/types/auth';
import { isAdminRole } from '~/types/auth';
import { calculateTaxesForPayment } from '~/services/tax-rates.server';
import {addMoney, Money, toCents} from "./money";
import { getCurrentDateTimeInTimezone } from "./misc";
import { calculatePaidUntil } from '~/services/payments/paid-until-calculator.server';

// Re-export EligibilityStatus for other modules
export type { EligibilityStatus };

// Export createClient for use in other modules
export { createClient };

/**
 * Creates a Supabase admin client with service role privileges.
 * This is a centralized function to avoid code duplication across the codebase.
 * Uses lazy initialization to avoid throwing errors during module import.
 * @returns SupabaseClient<Database> with admin privileges
 * @throws {Error} If Supabase URL or Service Role Key are missing
 */
export function getSupabaseAdminClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.warn('Missing Supabase URL or Service Role Key environment variables. Admin client functionality will be disabled.');
        throw new Error('Missing Supabase URL or Service Role Key environment variables.');
    }

    return createClient<Database, "public">(supabaseUrl, supabaseServiceKey) as unknown as SupabaseClientType<Database>;
}

// Note: Provider-specific environment validation is now handled by each provider's isConfigured() method

type TypedSupabaseClient = SupabaseClientType<Database>;
type SupabaseServerClientReturn = {
    supabaseServer: TypedSupabaseClient,
    supabaseClient: TypedSupabaseClient,
    response: Response,
    ENV: { // Pass environment variables needed by client
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
        // DO NOT PASS SERVICE ROLE KEY TO CLIENT - Security risk
    }
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
    const supabaseServer = createServerClient<Database, "public">(
        supabaseUrl,
        supabaseServiceKey,
        {request, response}
    ) as unknown as TypedSupabaseClient;

    const supabaseClient = createServerClient<Database, "public">(
        supabaseUrl, // Use the validated variable
        supabaseAnonKey, // Use the validated variable
        {request, response}
    ) as unknown as TypedSupabaseClient;

    const ENV = { // Pass environment variables needed by client
        SUPABASE_URL: supabaseUrl,
        SUPABASE_ANON_KEY: supabaseAnonKey,
        // DO NOT PASS SERVICE ROLE KEY TO CLIENT - Security risk
    }

    return {supabaseServer, supabaseClient, response, ENV};
}

export async function getUserRole(userId: string): Promise<UserRole | null> {
    if (!userId) return null;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables (URL or Service Role Key) required to fetch user role.');
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    if (error || !data) {
        return null;
    }

    return data.role;
}

export async function isUserAdmin(userId: string): Promise<boolean> {
    const role = await getUserRole(userId);
    return isAdminRole(role);
}

// Renamed from createPaymentSession - This function ONLY creates the initial DB record.
export async function createInitialPaymentRecord(
    familyId: string,
    subtotalAmount: Money,
    studentIds: string[],
    type: Database['public']['Enums']['payment_type_enum'],
    orderId?: string | null, // Optional: Add orderId parameter
    discountCodeId?: string | null, // Optional: Discount code ID
    discountAmount?: Money | null // Optional: Discount amount in cents
) {
    // Use the centralized admin client function
    const supabaseAdmin = getSupabaseAdminClient();

    // Note: subtotalAmount is already the discounted amount from the family payment page
    // No need to apply discount again here

    // --- Multi-Tax Calculation ---
    // Use the centralized tax calculation service
    const taxCalculation = await calculateTaxesForPayment({
        subtotalAmount,
        paymentType: type,
        studentIds,
        supabaseClient: supabaseAdmin
    });

    if (taxCalculation.error) {
        console.error('Error calculating taxes:', taxCalculation.error);
        return { data: null, error: taxCalculation.error };
    }

    const { totalTaxAmount, paymentTaxes: paymentTaxesToInsert } = taxCalculation;

    // Calculate final total amount (subtotal + taxes)
    const totalAmount = addMoney(subtotalAmount, totalTaxAmount);
    // --- End Multi-Tax Calculation ---


    // 4. Create the main payment record in Supabase (without tax_amount column)
    const { data: paymentRecord, error: insertPaymentError } = await supabaseAdmin
        .from('payments')
        .insert({
            family_id: familyId,
            // Payments numeric columns are INT4 cents in this schema
            subtotal_amount: toCents(subtotalAmount),
            // tax_amount column removed; taxes stored in payment_taxes
            total_amount: toCents(totalAmount),
            status: 'pending',
            type: type,
            order_id: orderId || null, // Set order_id if provided
            discount_code_id: discountCodeId || null, // Store discount code ID
            discount_amount: discountAmount ? toCents(discountAmount) : null,
            // payment_date, payment_method, payment_intent_id, receipt_url updated later
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
        const taxesWithPaymentId_db = paymentTaxesToInsert.map(tax => ({
            ...tax,
            tax_amount: toCents(tax.tax_amount),
            tax_amount_cents: toCents(tax.tax_amount),
            payment_id: paymentId,
        }));
        const { error: insertTaxesError } = await supabaseAdmin
            .from('payment_taxes')
            .insert(taxesWithPaymentId_db);

        if (insertTaxesError) {
            console.error(`Supabase payment_taxes insert error for payment ${paymentId}:`, insertTaxesError.message);
            // Attempt cleanup: Delete the payment record if tax insertion fails
            await supabaseAdmin.from('payments').delete().eq('id', paymentId);
            return { data: null, error: `Failed to record tax details: ${insertTaxesError.message}` };
        }
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

    // If a discount was applied, record the usage
    if (discountCodeId && discountAmount) {
        // imported locally to avoid circular deopendancy
        const { DiscountService } = await import('~/services/discount.server');
        const discountResult = await DiscountService.applyDiscountCode(
            discountCodeId,
            paymentId,
            familyId,
            discountAmount,
            studentIds?.[0] // Use first student ID if available
        );

        if (!discountResult.success) {
            console.error('Failed to record discount usage:', discountResult.error);
            // Don't fail the payment creation, just log the error
        }
    }

    // Return the newly created payment record ID and null error
    return {data: {id: paymentId}, error: null};
}

// --- Student Eligibility Check ---

/**
 * Checks if a student is eligible to attend class today based on payment status.
 * Eligibility rules:
 * 1. Eligible if on Free Trial (no successful payments and trial enrollment).
 * 2. Eligible if the enrollment's paid_until date is in the future.
 * @param studentId The ID of the student to check.
 * @param supabaseAdmin A Supabase client instance with service_role privileges.
 * @returns Promise<EligibilityStatus>
 */
export async function checkStudentEligibility(
    studentId: string,
    supabaseAdmin: TypedSupabaseClient
): Promise<EligibilityStatus> {
    console.log(`Checking eligibility for student ID: ${studentId}`);

    // 1. Fetch the student's active enrollments with their paid_until dates and status
    const {data: enrollments, error: enrollmentError} = await supabaseAdmin
        .from('enrollments')
        .select('paid_until, status')
        .eq('student_id', studentId)
        .in('status', ['active', 'trial'])
        .order('paid_until', {ascending: false});

    if (enrollmentError) {
        console.error(`Error fetching enrollments for student ${studentId}:`, enrollmentError.message);
        return {eligible: false, reason: 'Expired'};
    }

    if (!enrollments || enrollments.length === 0) {
        console.log(`No active enrollments found for student ${studentId}.`);
        return {eligible: false, reason: 'Expired'};
    }

    // 2. Check for trial enrollments first
    const trialEnrollment = enrollments.find(e => e.status === 'trial');
    if (trialEnrollment) {
        console.log(`[checkStudentEligibility] Student ${studentId} is on Free Trial.`);
        return {eligible: true, reason: 'Trial'};
    }

    // 3. Check active enrollments with paid_until dates
    const today = getCurrentDateTimeInTimezone();
    const activeEnrollments = enrollments.filter(e => e.status === 'active');

    for (const enrollment of activeEnrollments) {
        if (enrollment.paid_until) {
            const paidUntilDate = new Date(enrollment.paid_until);
            if (paidUntilDate >= today) {
                // 4. Fetch the most recent payment to determine payment type for the reason
                const {data: paymentLinks} = await supabaseAdmin
                    .from('payment_students')
                    .select(`
                        payments!inner ( payment_date, type )
                    `)
                    .eq('student_id', studentId)
                    .eq('payments.status', 'succeeded')
                    .order('payments.payment_date', {ascending: false})
                    .limit(1);

                let reason: EligibilityStatus['reason'] = 'Paid - Monthly'; // Default
                let lastPaymentDate: string | undefined;
                let paymentType: Database['public']['Enums']['payment_type_enum'] | undefined;

                if (paymentLinks && paymentLinks.length > 0) {
                    const lastPayment = paymentLinks[0].payments;
                    if (lastPayment) {
                        paymentType = lastPayment.type;
                        lastPaymentDate = lastPayment.payment_date || undefined;
                        reason = lastPayment.type === 'yearly_group' ? 'Paid - Yearly' : 'Paid - Monthly';
                    }
                }

                console.log(`[checkStudentEligibility] Student ${studentId} is eligible. Paid until: ${enrollment.paid_until}`);
                return {
                    eligible: true,
                    reason: reason,
                    lastPaymentDate: lastPaymentDate,
                    type: paymentType,
                    paidUntil: enrollment.paid_until || undefined
                };
            }
        }
    }

    // 5. If we get here, no enrollments are paid up
    console.log(`[checkStudentEligibility] Student ${studentId} is NOT eligible. No active enrollments are paid up.`);

    // Get the most recent payment info for the expired response
    const {data: paymentLinks} = await supabaseAdmin
        .from('payment_students')
        .select(`
            payments!inner ( payment_date, type )
        `)
        .eq('student_id', studentId)
        .eq('payments.status', 'succeeded')
        .order('payments.payment_date', {ascending: false})
        .limit(1);

    let lastPaymentDate: string | undefined;
    let paymentType: Database['public']['Enums']['payment_type_enum'] | undefined;

    if (paymentLinks && paymentLinks.length > 0) {
        const lastPayment = paymentLinks[0].payments;
        if (lastPayment) {
            paymentType = lastPayment.type;
            lastPaymentDate = lastPayment.payment_date || undefined;
        }
    }

    const paidUntil = activeEnrollments[0]?.paid_until;

    return {
        eligible: false,
        reason: 'Expired',
        lastPaymentDate: lastPaymentDate,
        type: paymentType,
        paidUntil: paidUntil || undefined
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
    }
    // Ensure it doesn't end with a slash for clean joining
    return siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
}


export async function updatePaymentStatus(
    supabasePaymentId: string, // Use Supabase Payment ID (from metadata) to find the record
    status: "pending" | "succeeded" | "failed", // Use the specific enum values
    _providerReceiptUrl?: string | null, // Provider receipt URL - not stored directly
    paymentMethod?: string | null, // Added parameter for payment method
    paymentIntentId?: string | null, // Optional: Store the payment intent ID
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
    // Use the centralized admin client function
    const supabaseAdmin = getSupabaseAdminClient();

    console.log(`[updatePaymentStatus] Called for payment ${supabasePaymentId} with status=${status}, paymentIntentId=${paymentIntentId || 'null'}`);

    // Check if payment already succeeded to prevent duplicate payment status updates
    const { data: existingPayment, error: checkError } = await supabaseAdmin
        .from('payments')
        .select('id, status, payment_date, type, family_id, subtotal_amount, total_amount')
        .eq('id', supabasePaymentId)
        .single();

    if (checkError && checkError.code !== 'PGRST116') {
        // Real database error (not just "no rows returned")
        console.error(`[updatePaymentStatus] Database error checking payment ${supabasePaymentId}:`, checkError.message);
        // Continue anyway - don't fail the whole update
    }

    const paymentAlreadySucceeded = existingPayment?.status === 'succeeded' && status === 'succeeded';

    let data = existingPayment;

    // Only update payment status if it hasn't already succeeded
    if (!paymentAlreadySucceeded) {
        const updateData: Partial<Database['public']['Tables']['payments']['Update']> = {
            status,
            // receipt_url: Don't store the provider receipt URL directly
            payment_method: paymentMethod,
            type: type || undefined, // Use 'type' parameter
            payment_intent_id: paymentIntentId || undefined, // Generic payment intent ID for all providers
            card_last4: cardLast4 || undefined, // Store card last 4 digits
        };

        // Set payment_date and generate our internal receipt_url when status becomes 'succeeded'
        if (status === 'succeeded') {
            updateData.payment_date = new Date().toISOString();
            try {
                const siteBaseUrl = getSiteUrl();
                updateData.receipt_url = `${siteBaseUrl}/family/receipt/${supabasePaymentId}`;
            } catch (e) {
                console.error(`[updatePaymentStatus] Failed to generate receipt URL for ${supabasePaymentId} due to missing VITE_SITE_URL.`, e);
                updateData.receipt_url = null;
            }
        } else if (status === 'failed') {
            // Also set payment_date for failed payments, but no receipt URL
            updateData.payment_date = new Date().toISOString();
            updateData.receipt_url = null; // Ensure no receipt URL for failed payments
        } else {
            // For pending status, ensure receipt_url is null
            updateData.receipt_url = null;
        }

        console.log(`[updatePaymentStatus] FINAL update data for payment ${supabasePaymentId}:`, JSON.stringify(updateData));

        const result = await supabaseAdmin
            .from('payments')
            .update(updateData)
            .eq('id', supabasePaymentId) // Find record using the Supabase Payment ID
            .select('id, family_id, subtotal_amount, total_amount, status, payment_date, type') // Select all needed fields
            .single();

        if (result.error) {
            console.error(`Payment update failed for Supabase payment ID ${supabasePaymentId}:`, result.error.message);
            // Decide how to handle webhook errors - retry? log?
            throw new Error(`Payment update failed: ${result.error.message}`);
        }
        if (!result.data) {
            console.error(`No payment record found for Supabase payment ID ${supabasePaymentId} during update.`);
            throw new Error(`Payment record not found for ID ${supabasePaymentId}.`);
        }
        data = result.data;
    } else {
        console.warn(`[updatePaymentStatus] Payment ${supabasePaymentId} already succeeded at ${existingPayment.payment_date}. Skipping payment status update but will still check enrollments.`);
    }

    if (!data) {
        console.error(`[updatePaymentStatus] No payment data available for ${supabasePaymentId}`);
        throw new Error(`Payment data not found for ID ${supabasePaymentId}.`);
    }

    // Optional: Log/verify amounts from metadata against DB record
    if (status === 'succeeded') {
        // If the payment was successful, update the enrollment's paid_until date
        if (type === 'monthly_group' || type === 'yearly_group') {
            const { data: studentLinks, error: studentLinkError } = await supabaseAdmin
                .from('payment_students')
                .select('student_id')
                .eq('payment_id', supabasePaymentId);

            if (studentLinkError) {
                console.error(`Failed to fetch students for payment ${supabasePaymentId}:`, studentLinkError.message);
            } else if (studentLinks) {
                // Deduplicate student IDs to prevent multiple updates for the same student
                const uniqueStudentIds = [...new Set(studentLinks.map(link => link.student_id))];

                if (uniqueStudentIds.length !== studentLinks.length) {
                    console.warn(`[updatePaymentStatus] Payment ${supabasePaymentId} has duplicate student entries: ${studentLinks.length} total, ${uniqueStudentIds.length} unique. This may indicate a data issue.`);
                }

                for (const studentId of uniqueStudentIds) {
                    // Find the student's enrollment to update paid_until
                    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
                        .from('enrollments')
                        .select('id, student_id, paid_until, status')
                        .eq('student_id', studentId)
                        // Optional: add a filter for active enrollments if applicable
                        .eq('status', 'active')
                        .single(); // Assuming one enrollment per student for simplicity

                    if (enrollmentError || !enrollment) {
                        console.error(`[updatePaymentStatus] Could not fetch enrollment for student ${studentId} to update paid_until`, enrollmentError);
                        continue; // Move to next student
                    }

                    // Idempotency check for enrollment updates
                    // If payment already succeeded and enrollment already has a future paid_until,
                    // this payment likely already processed this enrollment
                    if (paymentAlreadySucceeded && enrollment.paid_until && existingPayment?.payment_date) {
                        const paymentDate = new Date(existingPayment.payment_date);
                        const enrollmentPaidUntil = new Date(enrollment.paid_until);

                        // If enrollment's paid_until is after the payment date, this payment likely already updated it
                        if (enrollmentPaidUntil > paymentDate) {
                            console.log(`[updatePaymentStatus] Enrollment ${enrollment.id} already has paid_until (${enrollment.paid_until}) after payment date (${existingPayment.payment_date}). Skipping duplicate enrollment update.`);
                            continue;
                        }
                    }

                    // Use the intelligent paid_until calculator
                    const paymentDate = new Date();
                    const calculation = await calculatePaidUntil(enrollment, paymentDate, type as 'monthly_group' | 'yearly_group');

                    console.log(`[updatePaymentStatus] Payment ${supabasePaymentId}, Student ${studentId}, Enrollment ${enrollment.id}: Updating paid_until from ${enrollment.paid_until || 'null'} to ${calculation.newPaidUntil.toISOString()} (type: ${type}, rule: ${calculation.ruleApplied}, reason: ${calculation.reason})`);

                    const { error: updateEnrollmentError } = await supabaseAdmin
                        .from('enrollments')
                        .update({ paid_until: calculation.newPaidUntil.toISOString() })
                        .eq('id', enrollment.id);

                    if (updateEnrollmentError) {
                        console.error(`[updatePaymentStatus] Failed to update paid_until for enrollment ${enrollment.id}`, updateEnrollmentError);
                    }

                }
            }
        }
    }

    // If payment succeeded, type is individual_session, and quantity is provided, insert the session record
    if (status === 'succeeded' && type === 'individual_session' && quantity && quantity > 0) {
        // Use family_id from the updated payment record OR the passed familyId as fallback
        const targetFamilyId = data.family_id || familyId;
        if (!targetFamilyId) {
            console.error(`Cannot record Individual Session for payment ${data.id}: Missing family ID.`);
            // Return the payment data but log the error - session not recorded
            return data;
        }

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
            // Throw an error here to indicate the webhook handler should potentially return an error status to the payment provider.
            throw new Error(`Payment ${data.id} succeeded, but failed to record Individual Session credits: ${sessionInsertError.message}`);
        }
    } else if (status === 'succeeded' && type === 'individual_session') {
        console.warn(`[updatePaymentStatus] Condition for individual session insert NOT met for payment ${data.id}. Status='${status}', Type='${type}', Quantity='${quantity}'. Session record NOT created.`);
    }

    return data; // Return the updated payment data
}
