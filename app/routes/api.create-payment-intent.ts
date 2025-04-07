import { type ActionFunctionArgs, json, TypedResponse } from "@remix-run/node";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Stripe from 'stripe';
import { createInitialPaymentRecord, getSupabaseServerClient } from '~/utils/supabase.server';
import type { Database } from "~/types/supabase";
import { siteConfig } from "~/config/site";

// Define expected form data structure
type PaymentOption = 'monthly' | 'yearly' | 'individual';
type PaymentTypeEnum = Database['public']['Enums']['payment_type_enum'];

// Helper function to get Supabase admin client (avoids repetition)
function getSupabaseAdmin(): SupabaseClient<Database> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Missing Supabase URL or Service Role Key environment variables.");
    }
    return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

// Helper function to get student payment history (needed for monthly tier calculation)
async function getStudentPaymentHistory(studentId: string, supabaseAdmin: SupabaseClient<Database>): Promise<number> {
    // Revert to direct query with count
    const {count, error} = await supabaseAdmin
        .from('payment_students')
        .select('payments!inner(status)', {count: 'exact', head: true}) // Use inner join and count
        .eq('student_id', studentId)
        .eq('payments.status', 'succeeded'); // Filter by successful payments in the joined table

    if (error) {
        console.error(`Error fetching payment count for student ${studentId}:`, error.message);
        return 0; // Assume 0 on error
    }
    return count ?? 0; // Return the count
}

// Type for the successful response
type ActionSuccessResponse = {
    clientSecret: string;
    supabasePaymentId: string;
    totalAmount: number; // Send amount back for display confirmation if needed
    error?: never; // Ensure error is not present on success
};

// Type for the error response
type ActionErrorResponse = {
    clientSecret?: never; // Ensure clientSecret is not present on error
    supabasePaymentId?: never;
    totalAmount?: never;
    error: string;
};

// Combined response type
type ActionResponse = ActionSuccessResponse | ActionErrorResponse;


export async function action({ request }: ActionFunctionArgs): Promise<TypedResponse<ActionResponse>> {
    const formData = await request.formData();
    const familyId = formData.get('familyId') as string;
    const familyName = formData.get('familyName') as string;
    const studentIdsString = formData.get('studentIds') as string; // Comma-separated, potentially empty
    const paymentOption = formData.get('paymentOption') as PaymentOption;
    const priceIdFromForm = formData.get('priceId') as string | null; // Only for yearly/1:1
    const quantityFromForm = formData.get('quantity') as string | null; // Only for 1:1

    // --- Get Supabase Client with Auth Context ---
    // Use request-specific client for auth check
    const { supabaseClient, response } = getSupabaseServerClient(request);
    // --- End Get Supabase Client ---


    // --- Basic Validation ---
    if (!familyId || !familyName || !paymentOption) {
        // Include response headers in JSON response
        return json({error: "Missing required information (familyId, familyName, paymentOption)."}, {status: 400, headers: response.headers});
    }
    // Only require studentIds for monthly/yearly payments
    const studentIds = (paymentOption === 'monthly' || paymentOption === 'yearly')
        ? (studentIdsString ? studentIdsString.split(',').filter(id => id) : [])
        : []; // Default to empty array for individual sessions

    if ((paymentOption === 'monthly' || paymentOption === 'yearly') && studentIds.length === 0) {
        // Include response headers in JSON response
        return json({error: "Please select at least one student for group payments."}, {status: 400, headers: response.headers});
    }
    if (paymentOption === 'individual' && (!priceIdFromForm || !quantityFromForm || parseInt(quantityFromForm, 10) <= 0)) {
        // Include response headers in JSON response
        return json({error: "Missing or invalid price/quantity for Individual Session."}, {status: 400, headers: response.headers});
    }
    if (paymentOption === 'yearly' && !priceIdFromForm) {
        // Include response headers in JSON response
        return json({error: "Missing price information for yearly payment."}, {status: 400, headers: response.headers});
    }
    // --- End Validation ---

    const supabaseAdmin = getSupabaseAdmin();
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
        console.error("STRIPE_SECRET_KEY is not set.");
        // Include response headers in JSON response
        return json({error: "Payment processing is not configured."}, {status: 500, headers: response.headers});
    }
    const stripe = new Stripe(stripeSecretKey);

    // --- Get Email from Authenticated User ---
    let customerEmail: string | undefined;
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError) {
        console.warn("Auth error while fetching user for Stripe email:", authError.message);
        // Proceed without email, but maybe log more details or handle differently?
    } else if (user?.email) {
        customerEmail = user.email;
        // console.log(`[Checkout Action] Using authenticated user email: ${customerEmail}`); // Optional log
    } else {
        console.warn(`[Checkout Action] User is authenticated but no email found. Proceeding without email.`);
    }
    // --- End Get Email ---

    // Removed line_items array, calculation logic remains the same for totalAmountInCents
    let type: PaymentTypeEnum; // Use 'type' variable name
    let totalAmountInCents = 0; // Calculate total amount server-side
    let paymentData: { id: string } | null = null; // Declare outside try block
    let quantityForMetadata: number | undefined = undefined; // For individual sessions

    try {
        // --- Construct Line Items & Calculate Total ---
        // console.log(`[Checkout Action] Processing paymentOption received: '${paymentOption}'`); // Removed log
        if (paymentOption === 'individual') {
            type = 'individual_session'; // Assign to 'type'
            // console.log(`[Checkout Action] Individual session selected. Price ID from form: ${priceIdFromForm}, Quantity from form: ${quantityFromForm}`); // Removed log
            const quantity = parseInt(quantityFromForm!, 10);
            if (isNaN(quantity) || quantity <= 0) {
                console.error(`[Checkout Action] Invalid quantity parsed: ${quantity}`);
                // Include response headers in JSON response
                return json({error: "Invalid quantity provided for Individual Session."}, {status: 400, headers: response.headers});
            }
            if (!priceIdFromForm) {
                 console.error(`[Checkout Action] Missing priceId for Individual Session.`);
                 // Include response headers in JSON response
                 return json({error: "Missing price information for Individual Session."}, {status: 400, headers: response.headers});
            }
            // No line_items needed for Payment Intent, just calculate total
            quantityForMetadata = quantity; // Store quantity for metadata

            // Fetch price amount from Stripe to calculate total accurately
            const priceObject = await stripe.prices.retrieve(priceIdFromForm);
            // console.log(`[Checkout Action] Stripe price object retrieved:`, priceObject); // Removed log
            if (!priceObject || typeof priceObject.unit_amount !== 'number') {
                 console.error(`[Checkout Action] Invalid price object or unit_amount missing/invalid for price ID ${priceIdFromForm}. Unit amount: ${priceObject?.unit_amount}`);
                throw new Error(`Could not retrieve valid price details for ${priceIdFromForm}`);
            }
            totalAmountInCents = priceObject.unit_amount * quantity;
            // console.log(`[Checkout Action] Calculated totalAmountInCents for individual session: ${totalAmountInCents}`); // Removed log

        } else if (paymentOption === 'yearly') {
            type = 'yearly_group'; // Assign to 'type'
            // No line_items needed for Payment Intent, just calculate total
            const priceObject = await stripe.prices.retrieve(priceIdFromForm!);
            if (!priceObject || typeof priceObject.unit_amount !== 'number') {
                throw new Error(`Could not retrieve valid price details for ${priceIdFromForm}`);
            }
            totalAmountInCents = priceObject.unit_amount * studentIds.length;

        } else { // Monthly
            type = 'monthly_group'; // Assign to 'type'
            for (const studentId of studentIds) {
                const pastPaymentCount = await getStudentPaymentHistory(studentId, supabaseAdmin);
                // let priceId: string;
                let unitAmount: number; // Amount in cents

                if (pastPaymentCount === 0) {
                    // priceId = siteConfig.stripe.priceIds.firstMonth;
                    unitAmount = siteConfig.pricing.firstMonth * 100;
                } else if (pastPaymentCount === 1) {
                    // priceId = siteConfig.stripe.priceIds.secondMonth;
                    unitAmount = siteConfig.pricing.secondMonth * 100;
                } else {
                    // priceId = siteConfig.stripe.priceIds.monthly;
                    unitAmount = siteConfig.pricing.monthly * 100;
                }
                // No line_items needed for Payment Intent, just calculate total
                totalAmountInCents += unitAmount;
            }
        }

        // console.log(`[Checkout Action] Before final check - totalAmountInCents: ${totalAmountInCents}`); // Log updated
        if (totalAmountInCents <= 0) {
             console.error(`[Checkout Action] Failing validation: totalAmountInCents=${totalAmountInCents}`);
             // Include response headers in JSON response
            return json({error: "Calculated payment amount is invalid."}, {status: 400, headers: response.headers});
        }

        // 1. Get the existing Supabase Payment ID passed from the client
        // This ID corresponds to the 'pending' record created before navigating to the /pay page.
        const supabasePaymentId = formData.get('supabasePaymentId') as string; // Get ID from form data
        if (!supabasePaymentId) {
            console.error("[API Create PI] CRITICAL: supabasePaymentId missing from form data.");
            return json({ error: "Payment session identifier missing. Please restart the payment process." }, { status: 400, headers: response.headers });
        }
        console.log(`[API Create PI] Using existing Supabase Payment ID: ${supabasePaymentId}`);
        // We no longer create a new record here, so remove the paymentData variable assignment.
        // paymentData = { id: supabasePaymentId }; // We just need the ID

        // 2. Create Stripe Payment Intent instead of Checkout Session
        // Build metadata object explicitly
        const paymentIntentMetadata: { [key: string]: string | number } = { // Allow number for quantity
            paymentId: supabasePaymentId,
            type: type, // Use 'type' key
            familyId: familyId,
            // studentIds: studentIds.join(','), // Optionally include student IDs if needed later
            // Ensure the familyName is included if needed by webhooks or later processing
            familyName: familyName,
        };
        if (type === 'individual_session' && quantityForMetadata) { // Check against 'type'
            paymentIntentMetadata.quantity = quantityForMetadata; // Use the stored number
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmountInCents,
            currency: 'usd', // Or get from config/environment
            payment_method_types: ['card'],
            metadata: paymentIntentMetadata, // Attach metadata directly
            // Add customer email if found - Stripe might create/link a customer
            receipt_email: customerEmail, // Send receipt to this email on success
            // description: `Payment for ${paymentType} - Family: ${familyName}`, // Optional description
            // statement_descriptor: 'Sensei Negin', // Optional, short descriptor on bank statements
        });

        if (!paymentIntent.client_secret) {
            throw new Error('Stripe Payment Intent creation failed: Missing client_secret.');
        }

        // 4. Update Supabase payment record with Stripe Payment Intent ID (important for webhook lookup)
        console.log(`[API Create PI] Attempting to update Supabase payment record ${supabasePaymentId} with Stripe PI ID ${paymentIntent.id}`);
        const { error: updateError } = await supabaseAdmin
            .from('payments')
            .update({ stripe_payment_intent_id: paymentIntent.id }) // Store the Payment Intent ID
            .eq('id', supabasePaymentId);

        if (updateError) {
            console.error(`[API Create PI] FAILED to update payment record ${supabasePaymentId} with Stripe Payment Intent ID ${paymentIntent.id}:`, updateError.message);
            // Critical: Payment might proceed but won't be trackable via webhook easily.
            // Log for manual intervention. Attempt to cancel the Payment Intent.
            console.log(`[API Create PI] Attempting to cancel Stripe Payment Intent ${paymentIntent.id} due to DB update failure.`);
            try {
                await stripe.paymentIntents.cancel(paymentIntent.id);
                console.log(`[API Create PI] Successfully cancelled Stripe Payment Intent ${paymentIntent.id}.`);
            } catch (cancelError) {
                console.error(`[API Create PI] FAILED to cancel Stripe Payment Intent ${paymentIntent.id}:`, cancelError instanceof Error ? cancelError.message : cancelError);
                // Log this, but still return the original error to the user.
            }
            return json({ error: "Failed to link payment intent. Please contact support." }, { status: 500, headers: response.headers });
        } else {
            console.log(`[API Create PI] Successfully updated payment record ${supabasePaymentId} with Stripe PI ID ${paymentIntent.id}.`);
        }

        // 5. Return the client_secret and Supabase payment ID to the client
        console.log(`[API Create PI] Successfully created Stripe Payment Intent ${paymentIntent.id} for Supabase payment ${supabasePaymentId}`);
        return json({
            clientSecret: paymentIntent.client_secret,
            supabasePaymentId: supabasePaymentId,
            totalAmount: totalAmountInCents // Send amount back for confirmation display
        }, { headers: response.headers });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error during Payment Intent creation:", errorMessage);
        // Since we didn't create a new record here, we don't need to delete one on error.
        // The original 'pending' record created on the previous page will remain 'pending'
        // and can potentially be retried or cleaned up later.
        // We should NOT delete the original pending record here, as the user might go back and try again.
        // if (supabasePaymentId) { // Use the ID we received
        //     console.log(`Stripe PI creation failed. The pending payment record ${supabasePaymentId} remains.`);
        //     // DO NOT DELETE: await supabaseAdmin.from('payments').delete().eq('id', supabasePaymentId);
        // }
        // Include response headers in JSON response
        return json({ error: `Payment initiation failed: ${errorMessage}` }, { status: 500, headers: response.headers });
    }
}
