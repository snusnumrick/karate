import {type ActionFunctionArgs, json, TypedResponse} from "@remix-run/node";
import {createClient, SupabaseClient} from "@supabase/supabase-js";
import Stripe from 'stripe';
import {createInitialPaymentRecord, getSupabaseServerClient} from '~/utils/supabase.server'; // Import getSupabaseServerClient
import type {Database} from "~/types/supabase";
import {siteConfig} from "~/config/site"; // Import site config for price IDs

// Define expected form data structure
type PaymentOption = 'monthly' | 'yearly' | 'individual'; // Renamed option
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

export async function action({request}: ActionFunctionArgs): Promise<TypedResponse<{
    sessionId?: string;
    error?: string
}>> {
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


    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    let paymentType: PaymentTypeEnum;
    let totalAmountInCents = 0; // Calculate total amount server-side
    let paymentData: { id: string } | null = null; // Declare outside try block

    try {
        // --- Construct Line Items & Calculate Total ---
        // console.log(`[Checkout Action] Processing paymentOption received: '${paymentOption}'`); // Removed log
        if (paymentOption === 'individual') {
            paymentType = 'individual_session';
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
            line_items.push({
                price: priceIdFromForm!,
                quantity: quantity,
            });
            // Fetch price amount from Stripe to calculate total accurately
            // console.log(`[Checkout Action] Retrieving Stripe price object for ID: ${priceIdFromForm}`); // Removed log
            const priceObject = await stripe.prices.retrieve(priceIdFromForm);
            // console.log(`[Checkout Action] Stripe price object retrieved:`, priceObject); // Removed log
            if (!priceObject || typeof priceObject.unit_amount !== 'number') {
                 console.error(`[Checkout Action] Invalid price object or unit_amount missing/invalid for price ID ${priceIdFromForm}. Unit amount: ${priceObject?.unit_amount}`);
                throw new Error(`Could not retrieve valid price details for ${priceIdFromForm}`);
            }
            totalAmountInCents = priceObject.unit_amount * quantity;
            // console.log(`[Checkout Action] Calculated totalAmountInCents for individual session: ${totalAmountInCents}`); // Removed log

        } else if (paymentOption === 'yearly') {
            paymentType = 'yearly_group';
            line_items.push({
                price: priceIdFromForm!,
                quantity: studentIds.length, // One item per student
            });
            const priceObject = await stripe.prices.retrieve(priceIdFromForm!);
            if (!priceObject || typeof priceObject.unit_amount !== 'number') {
                throw new Error(`Could not retrieve price details for ${priceIdFromForm}`);
            }
            totalAmountInCents = priceObject.unit_amount * studentIds.length;

        } else { // Monthly
            paymentType = 'monthly_group';
            for (const studentId of studentIds) {
                const pastPaymentCount = await getStudentPaymentHistory(studentId, supabaseAdmin);
                let priceId: string;
                let unitAmount: number; // Amount in cents

                if (pastPaymentCount === 0) {
                    priceId = siteConfig.stripe.priceIds.firstMonth;
                    unitAmount = siteConfig.pricing.firstMonth * 100;
                } else if (pastPaymentCount === 1) {
                    priceId = siteConfig.stripe.priceIds.secondMonth;
                    unitAmount = siteConfig.pricing.secondMonth * 100;
                } else {
                    priceId = siteConfig.stripe.priceIds.monthly;
                    unitAmount = siteConfig.pricing.monthly * 100;
                }
                line_items.push({price: priceId, quantity: 1});
                totalAmountInCents += unitAmount;
            }
        }

        // console.log(`[Checkout Action] Before final check - line_items count: ${line_items.length}, totalAmountInCents: ${totalAmountInCents}`); // Removed log
        if (line_items.length === 0 || totalAmountInCents <= 0) {
             console.error(`[Checkout Action] Failing validation: line_items.length=${line_items.length}, totalAmountInCents=${totalAmountInCents}`);
             // Include response headers in JSON response
            return json({error: "Calculated payment amount is invalid or no items selected."}, {status: 400, headers: response.headers});
        }

        // 1. Create initial payment record in Supabase (BEFORE Stripe)
        // Assign to the outer variable, rename inner variable to avoid shadowing
        const {data: paymentRecordResult, error: paymentError} = await createInitialPaymentRecord(
            familyId,
            totalAmountInCents, // Use server-calculated total
            studentIds, // Pass student IDs (empty for 1:1)
            paymentType  // Pass the determined payment type
        );

        if (paymentError || !paymentRecordResult?.id) {
            console.error("Failed to create initial payment record:", paymentError);
            // Include response headers in JSON response
            return json({error: "Failed to initialize payment. Please try again."}, {status: 500, headers: response.headers});
        }
        // Assign the successful result to the outer variable
        paymentData = paymentRecordResult;
        const supabasePaymentId = paymentData.id; // Get the ID of the record we just created

        // 3. Create Stripe checkout session
        const requestUrl = new URL(request.url);
        // Correct the success URL path to match the file route (_layout.payment.success.tsx -> /payment/success)
        const successUrl = process.env.STRIPE_SUCCESS_URL || new URL('/payment/success', requestUrl.origin).toString();
        const cancelUrl = process.env.STRIPE_CANCEL_URL || new URL('/family/payment', requestUrl.origin).toString(); // Return to payment page on cancel

        // Build metadata object explicitly
        const paymentIntentMetadata: { [key: string]: string } = {
            paymentId: supabasePaymentId,
            paymentType: paymentType,
            familyId: familyId,
        };
        if (paymentType === 'individual_session' && quantityFromForm) {
            paymentIntentMetadata.quantity = quantityFromForm;
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: line_items, // Use the dynamically constructed line items
            mode: 'payment',
            success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl,
            // client_reference_id: supabasePaymentId, // Optional: Supabase ID here if needed
            // --- CRITICAL METADATA --- moved to payment_intent_data
            // metadata: { ... } // Removed from top level
            payment_intent_data: {
                metadata: paymentIntentMetadata // Use the constructed object
            },
            // Add customer email if found
            ...(customerEmail && {customer_email: customerEmail}),
        });

        // console.log(`[Checkout Action] Metadata on session object returned by Stripe:`, session.metadata); // Removed log

        if (!session.id) {
            throw new Error('Stripe session creation failed: Missing session ID.');
        }

        // 4. Update Supabase payment record with Stripe session ID (important for webhook lookup)
        const {error: updateError} = await supabaseAdmin
            .from('payments')
            .update({stripe_session_id: session.id})
            .eq('id', supabasePaymentId);

        if (updateError) {
            console.error(`Failed to update payment record ${supabasePaymentId} with Stripe session ID ${session.id}:`, updateError.message);
            // Critical: Payment might proceed but won't be trackable via webhook easily.
            // Log for manual intervention. Return error to user.
            // Include response headers in JSON response
            return json({error: "Failed to link payment session. Please contact support."}, {status: 500, headers: response.headers});
        }

        // 5. Return the Stripe session ID to the client
        console.log(`Successfully created Stripe session ${session.id} for payment ${supabasePaymentId}`);
        // Include response headers in JSON response
        return json({sessionId: session.id}, { headers: response.headers });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error during checkout session creation:", errorMessage);
        // Attempt to clean up the pending Supabase payment record if Stripe fails
        if (paymentData?.id) {
            console.log(`Attempting to delete pending payment record ${paymentData.id} due to Stripe error.`);
            await supabaseAdmin.from('payments').delete().eq('id', paymentData.id);
        }
        // Include response headers in JSON response
        return json({error: `Payment initiation failed: ${errorMessage}`}, {status: 500, headers: response.headers});
    }
}
