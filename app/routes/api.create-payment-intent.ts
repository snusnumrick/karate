import { type ActionFunctionArgs, json, TypedResponse } from "@remix-run/node";
import { getSupabaseServerClient, getSupabaseAdminClient } from '~/utils/supabase.server';
import type { Database } from "~/types/database.types"; // Removed unused Tables import
import { siteConfig } from "~/config/site";
import { getPaymentProvider } from '~/services/payments/index.server';
import type { PaymentProviderId } from '~/services/payments/types.server';
import { fromCents } from "~/utils/money";

// Define expected form data structure
type PaymentOption = 'monthly' | 'yearly' | 'individual' | 'store' | 'event'; // Add 'store' and 'event' options
type PaymentTypeEnum = Database['public']['Enums']['payment_type_enum'];



// Type for the successful response (includes subtotal, tax, total)
type ActionSuccessResponse = {
    clientSecret: string;
    supabasePaymentId: string;
    subtotalAmount: number; // Amount before tax in cents
    taxAmount: number;      // Calculated tax amount in cents (can be 0)
    totalAmount: number;    // Total amount in cents (subtotal + tax)
    provider: PaymentProviderId;
    error?: never; // Ensure error is not present on success
};

// Type for the error response (ensure new fields are not present)
type ActionErrorResponse = {
    clientSecret?: never; // Ensure clientSecret is not present on error
    supabasePaymentId?: never;
    subtotalAmount?: never;
    taxAmount?: never;
    totalAmount?: never;
    provider?: PaymentProviderId;
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
    const quantityFromForm = formData.get('quantity') as string | null; // For 1:1 or store quantity
    const orderIdFromForm = formData.get('orderId') as string | null; // For store purchases
    // Get the existing amounts passed from the payment page
    const subtotalAmountString = formData.get('subtotalAmount') as string | null;
    const totalAmountString = formData.get('totalAmount') as string | null;


    // --- Get Supabase Client with Auth Context ---
    // Use request-specific client for response headers
    const paymentProvider = getPaymentProvider();
    const { response } = getSupabaseServerClient(request);
    // --- End Get Supabase Client ---


    // --- Basic Validation ---
    // Add orderId check for store payment option
    if (!familyId || !familyName || !paymentOption || !subtotalAmountString || !totalAmountString || (paymentOption === 'store' && !orderIdFromForm)) {
        return json({ error: "Missing required information (familyId, familyName, paymentOption, amounts, orderId for store).", provider: paymentProvider.id }, { status: 400, headers: response.headers });
    }

    // Validate received amounts
    const subtotalAmountFromForm = parseInt(subtotalAmountString, 10);
    const totalAmountFromForm = parseInt(totalAmountString, 10);

    if (isNaN(subtotalAmountFromForm) || isNaN(totalAmountFromForm) || subtotalAmountFromForm < 0 || totalAmountFromForm < 0 || totalAmountFromForm < subtotalAmountFromForm) {
        console.error(`[API Create PI] Invalid amounts received: subtotal=${subtotalAmountString}, total=${totalAmountString}`);
        return json({ error: "Invalid payment amount details received.", provider: paymentProvider.id }, { status: 400, headers: response.headers });
    }
    // console.log(`[API Create PI] Received amounts from form: Subtotal=${subtotalAmountFromForm}, Total=${totalAmountFromForm}`);


    // Only require studentIds for monthly/yearly payments
    const studentIds = (paymentOption === 'monthly' || paymentOption === 'yearly')
        ? (studentIdsString ? studentIdsString.split(',').filter(id => id) : [])
        : []; // Default to empty array for individual sessions or store purchases

    if ((paymentOption === 'monthly' || paymentOption === 'yearly') && studentIds.length === 0) {
        return json({error: "Please select at least one student for group payments.", provider: paymentProvider.id}, {status: 400, headers: response.headers});
    }
    if (paymentOption === 'individual' && (!priceIdFromForm || !quantityFromForm || parseInt(quantityFromForm, 10) <= 0)) {
        return json({error: "Missing or invalid price/quantity for Individual Session.", provider: paymentProvider.id}, {status: 400, headers: response.headers});
    }
    if (paymentOption === 'yearly' && !priceIdFromForm) {
        return json({error: "Missing price information for yearly payment.", provider: paymentProvider.id}, {status: 400, headers: response.headers});
    }
    // --- End Validation ---

    const supabaseAdmin = getSupabaseAdminClient();

    // --- Get Email from Authenticated User ---
    // Email functionality disabled - using custom receipt system instead of provider receipts
    // const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    // --- End Get Email ---

    let type: PaymentTypeEnum;
    let quantityForMetadata: number | undefined = undefined; // For individual sessions or store

    try {
        // --- Determine Payment Type and Quantity (if applicable) ---
        // We still need to know the type for metadata and potentially quantity
        switch (paymentOption) {
            case 'monthly':
                type = 'monthly_group';
                break;
            case 'yearly':
                type = 'yearly_group';
                break;
            case 'individual': { // Add block scope here
                type = 'individual_session';
                const quantity = parseInt(quantityFromForm!, 10);
                if (isNaN(quantity) || quantity <= 0) {
                    return json({ error: "Invalid quantity provided for Individual Session." }, { status: 400, headers: response.headers });
                }
                quantityForMetadata = quantity;
                break;
            }
            case 'store': { // Handle store purchase
                type = 'store_purchase';
                // Quantity might be relevant if multiple items were allowed, but currently 1
                const quantity = quantityFromForm ? parseInt(quantityFromForm, 10) : 1; // Default to 1 if not provided
                if (isNaN(quantity) || quantity <= 0) {
                    return json({ error: "Invalid quantity provided for Store Purchase." }, { status: 400, headers: response.headers });
                }
                quantityForMetadata = quantity; // Store quantity in metadata if needed
                break;
            }
            case 'event': { // Handle event registration
                type = 'event_registration';
                // Event registrations typically have a fixed fee, no quantity needed
                quantityForMetadata = 1; // Default to 1 for event registrations
                break;
            }
            default:
                console.error(`[API Create PI] Unhandled paymentOption: ${paymentOption}`);
                return json({ error: "Invalid payment option." }, { status: 400, headers: response.headers });
        }
        // --- End Determine Payment Type ---

        // --- Use Amounts from Form ---
        // The subtotal and total amounts are now taken directly from the validated form data
        const subtotalAmountInCents = subtotalAmountFromForm;
        const totalAmountInCents = totalAmountFromForm;
        const totalTaxAmountInCents = totalAmountInCents - subtotalAmountInCents; // Calculate tax for metadata


        // --- Validation (using amounts from form) ---
        // console.log(`[API Create PI] Using amounts from form: Subtotal=${subtotalAmountInCents}, Total Tax=${totalTaxAmountInCents}, Total=${totalAmountInCents}`);
        // Validate total amount is positive
        if (totalAmountInCents <= 0) {
            console.error(`[API Create PI] Failing validation: totalAmountInCents=${totalAmountInCents}`);
            return json({error: "Payment total must be positive."}, {status: 400, headers: response.headers});
        }
        // --- End Validation ---


        // 1. Get the existing Supabase Payment ID passed from the client
        // This ID corresponds to the 'pending' record created before navigating to the /pay page.
        const supabasePaymentId = formData.get('supabasePaymentId') as string; // Get ID from form data
        if (!supabasePaymentId) {
            console.error("[API Create PI] CRITICAL: supabasePaymentId missing from form data.");
            return json({ error: "Payment session identifier missing. Please restart the payment process." }, { status: 400, headers: response.headers });
        }
        // console.log(`[API Create PI] Using existing Supabase Payment ID: ${supabasePaymentId}`);
        // We no longer create a new record here, so remove the paymentData variable assignment.
        // paymentData = { id: supabasePaymentId }; // We just need the ID

        // --- Use Existing Tax Records Instead of Recalculating ---
        // Fetch existing tax records for this payment to preserve exemptions and correct calculations
        const { data: existingTaxes, error: existingTaxesError } = await supabaseAdmin
            .from('payment_taxes')
            .select(`
                tax_rate_id,
                tax_amount,
                tax_rate_snapshot,
                tax_name_snapshot,
                tax_description_snapshot,
                tax_rates!inner(id, name, description)
            `)
            .eq('payment_id', supabasePaymentId);

        if (existingTaxesError) {
            console.error('[API Create PI] Error fetching existing tax records:', JSON.stringify(existingTaxesError, null, 2));
            throw new Error(`Failed to fetch existing tax records: ${existingTaxesError.message}`);
        }

        const paymentTaxesToInsert: Array<{
            tax_rate_id: string;
            tax_amount: number;
            tax_rate_snapshot: number;
            tax_name_snapshot: string;
            tax_description_snapshot: string | null;
        }> = [];
        const taxDetailsForMetadata: Array<{ name: string; description: string | null; amount: number; rate: number }> = [];
        let existingTaxTotal = 0;

        if (existingTaxes && existingTaxes.length > 0) {
            console.log(`[API Create PI] Using existing tax records (${existingTaxes.length} taxes) to preserve exemptions.`);
            for (const existingTax of existingTaxes) {
                existingTaxTotal += ((existingTax as unknown as Record<string, number>)['tax_amount']);
                paymentTaxesToInsert.push({
                    tax_rate_id: existingTax.tax_rate_id,
                    tax_amount: ((existingTax as unknown as Record<string, number>)['tax_amount']),
                    tax_rate_snapshot: existingTax.tax_rate_snapshot,
                    tax_name_snapshot: existingTax.tax_name_snapshot,
                    tax_description_snapshot: existingTax.tax_description_snapshot,
                });
                taxDetailsForMetadata.push({
                    name: existingTax.tax_name_snapshot,
                    description: existingTax.tax_description_snapshot,
                    amount: ((existingTax as unknown as Record<string, number>)['tax_amount']),
                    rate: existingTax.tax_rate_snapshot,
                });
            }

            // Verify existing tax total matches form-derived tax
            if (existingTaxTotal !== totalTaxAmountInCents) {
                console.warn(`[API Create PI] Tax amount mismatch! Form-derived tax: ${totalTaxAmountInCents}, Existing tax total: ${existingTaxTotal}. Using form-derived total for payment intent.`);
            } else {
                console.log(`[API Create PI] Tax amounts match. Total tax: ${existingTaxTotal}`);
            }
        } else {
            console.log(`[API Create PI] No existing tax records found. Tax amount is ${totalTaxAmountInCents}.`);
        }
        // --- End Use Existing Tax Records ---

        // 2. Create Payment Intent through the configured provider
        const paymentIntentMetadata: Record<string, string> = {
            paymentId: supabasePaymentId,
            type,
            familyId,
            familyName,
            subtotal_amount: subtotalAmountInCents.toString(),
            tax_amount: totalTaxAmountInCents.toString(),
            total_amount: totalAmountInCents.toString(),
            tax_details: JSON.stringify(taxDetailsForMetadata),
        };
        if ((type === 'individual_session' || type === 'store_purchase') && quantityForMetadata) {
            paymentIntentMetadata.quantity = quantityForMetadata.toString();
        }
        if (type === 'store_purchase' && orderIdFromForm) {
            paymentIntentMetadata.orderId = orderIdFromForm;
        }

        const paymentIntentResult = await paymentProvider.createPaymentIntent({
            amount: fromCents(totalAmountInCents),
            currency: siteConfig.pricing.currencyCode,
            metadata: paymentIntentMetadata,
            // receipt_email: customerEmail, // Removed to disable Stripe receipts - using custom receipt system
            description: `Payment for ${type} - Family: ${familyName}`,
        });

        const paymentIntentId = paymentIntentResult.id;
        const clientSecret = paymentIntentResult.client_secret;

        // 4. Update Supabase payment record:
        //    - Set payment intent ID from the provider.
        //    - Update subtotal_amount and total_amount (in case they changed if user went back/forth).
        //    - Clear existing tax details for this payment (in payment_taxes).
        //    - Insert new tax details into payment_taxes.
        // console.log(`[API Create PI] Updating Supabase payment ${supabasePaymentId} with intent ${paymentIntentId}, amounts, and tax details.`);

        // Step 4a: Update the main payment record
        const { error: updatePaymentError } = await supabaseAdmin
            .from('payments')
            .update({
                payment_intent_id: paymentIntentId, // Generic payment intent ID for all providers
                // Payments numeric columns are INT4 cents in this schema
                subtotal_amount: subtotalAmountInCents,
                total_amount: totalAmountInCents,
                order_id: type === 'store_purchase' ? orderIdFromForm : undefined, // Add order_id if store purchase
                updated_at: new Date().toISOString(),
            })
            .eq('id', supabasePaymentId);

        if (updatePaymentError) {
            console.error(`[API Create PI] FAILED to update main payment record ${supabasePaymentId}:`, updatePaymentError.message);
            // Critical: Payment might proceed but won't be trackable or have correct amounts.
            // Log for manual intervention. Attempt to cancel the Payment Intent.
            console.log(`[API Create PI] Attempting to cancel payment intent ${paymentIntentId} due to DB update failure.`);
            try {
                await paymentProvider.cancelPaymentIntent(paymentIntentId);
                console.log(`[API Create PI] Successfully cancelled payment intent ${paymentIntentId}.`);
            } catch (cancelError) {
                console.error(`[API Create PI] FAILED to cancel payment intent ${paymentIntentId}:`, cancelError instanceof Error ? cancelError.message : cancelError);
                // Log this, but still return the original error to the user.
            }
            return json({ error: "Failed to link payment intent. Please contact support." }, { status: 500, headers: response.headers });
        } else {
            // console.log(`[API Create PI] Successfully updated main payment record ${supabasePaymentId}.`);
        }

        // Step 4b: Delete existing tax records for this payment ID
        const { error: deleteTaxesError } = await supabaseAdmin
            .from('payment_taxes')
            .delete()
            .eq('payment_id', supabasePaymentId);

        if (deleteTaxesError) {
            // Log error but proceed - might result in duplicate taxes if insert succeeds. Needs monitoring.
            console.error(`[API Create PI] FAILED to delete existing tax records for payment ${supabasePaymentId}:`, deleteTaxesError.message);
        } else {
            console.log(`[API Create PI] Deleted existing tax records for payment ${supabasePaymentId}.`);
        }

        // Step 4c: Insert new tax records
        if (paymentTaxesToInsert.length > 0) {
            const taxesWithPaymentId = paymentTaxesToInsert.map(tax => ({
                ...tax,
                tax_amount_cents: tax.tax_amount,
                payment_id: supabasePaymentId,
            }));
            const { error: insertTaxesError } = await supabaseAdmin
                .from('payment_taxes')
                .insert(taxesWithPaymentId);

            if (insertTaxesError) {
                console.error(`[API Create PI] FAILED to insert new tax records for payment ${supabasePaymentId}:`, insertTaxesError.message);
                // Critical: Amounts in 'payments' table might not match sum of 'payment_taxes'.
                // Attempt to cancel PI? For now, log and return error.
                console.log(`[API Create PI] Attempting to cancel payment intent ${paymentIntentId} due to tax insertion failure.`);
                try { await paymentProvider.cancelPaymentIntent(paymentIntentId); } catch { /* Log cancel error */ }
                return json({ error: "Failed to record tax details. Please contact support." }, { status: 500, headers: response.headers });
            }
            // console.log(`[API Create PI] Inserted ${taxesWithPaymentId.length} new tax records for payment ${supabasePaymentId}.`);
        }

        // 5. Return the client_secret, Supabase payment ID, and the amounts *received from the form*
        // console.log(`[API Create PI] Successfully created/updated payment intent ${paymentIntentId} and Supabase payment ${supabasePaymentId} using amounts from form.`);
        return json({
            clientSecret: clientSecret ?? '',
            supabasePaymentId: supabasePaymentId,
            subtotalAmount: subtotalAmountInCents, // Return subtotal from form
            taxAmount: totalTaxAmountInCents, // Return calculated tax amount
            totalAmount: totalAmountInCents, // Return total from form
            provider: paymentProvider.id,
        }, { headers: response.headers });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Log the specific error location if possible
        console.error("Error during Payment Intent creation:", errorMessage);
        // Since we didn't create a new record here, we don't need to delete one on error.
        // The original 'pending' record created on the previous page will remain 'pending'
        // and can potentially be retried or cleaned up later.
        // We should NOT delete the original pending record here, as the user might go back and try again.
        // if (supabasePaymentId) { // Use the ID we received
        //     console.log(`Payment intent creation failed. The pending payment record ${supabasePaymentId} remains.`);
        //     // DO NOT DELETE: await supabaseAdmin.from('payments').delete().eq('id', supabasePaymentId);
        // }
        // Include response headers in JSON response
        return json({ error: `Payment initiation failed: ${errorMessage}` }, { status: 500, headers: response.headers });
    }
}
