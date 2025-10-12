import {useEffect, useRef, useState, useMemo, useCallback} from 'react';
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect, type TypedResponse,} from "@remix-run/node";
import {Form, useActionData, useLoaderData, useNavigation, useRouteError} from "@remix-run/react";
import {AuthenticityTokenInput} from "remix-utils/csrf/react";
import {csrf} from "~/utils/csrf.server";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Database} from "~/types/database.types";
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Checkbox} from "~/components/ui/checkbox";
import {Label} from "~/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import {Textarea} from "~/components/ui/textarea"; // Import Textarea
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert"; // For displaying errors
import {AppBreadcrumb, breadcrumbPatterns} from "~/components/AppBreadcrumb";
import {getTodayLocalDateString} from "~/utils/misc";
import { formatMoney, fromCents } from "~/utils/money";
import { getPaymentProvider } from '~/services/payments/index.server';
import { getApplicableTaxRatesForStorePurchase } from '~/services/tax-rates.server';

type FamilyInfo = Pick<Database['public']['Tables']['families']['Row'], 'id' | 'name'>;
type StudentInfo = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name' | 'family_id'>;
type TaxRateInfo = Pick<Database['public']['Tables']['tax_rates']['Row'], 'id' | 'name' | 'rate' | 'description'>; // Add type for tax rates
type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductVariantRow = Database['public']['Tables']['product_variants']['Row'];

type ProductWithVariants = ProductRow & {
    product_variants: ProductVariantRow[];
};

type LoaderData = {
    families: FamilyInfo[];
    students: StudentInfo[];
    taxRates: TaxRateInfo[]; // Add tax rates to loader data
    products: ProductWithVariants[]; // Add products for store purchases
    paymentProvider: {
        id: string;
        name: string;
    };
};

type ActionData = {
    success?: boolean;
    error?: string;
    fieldErrors?: {
        familyId?: string;
        studentIds?: string;
        studentId?: string; // For store_purchase single student selection
        subtotalAmount?: string; // Changed from amount
        paymentDate?: string;
        paymentMethod?: string;
        status?: string;
        type?: string; // Use 'type'
        quantity?: string; // Added for one_on_one session quantity and store purchases
        productVariantId?: string; // For store_purchase product selection
    };
};


export async function loader({request}: LoaderFunctionArgs) {
    console.log("Entering /admin/payments/new loader...");
    const {response} = getSupabaseServerClient(request);
    const headers = response.headers;

    const { getSupabaseAdminClient } = await import('~/utils/supabase.server');
    const supabaseAdmin = getSupabaseAdminClient();

    try {
        // console.log("Admin new payment loader: Fetching families...");
        const {data: families, error} = await supabaseAdmin
            .from('families')
            .select('id, name')
            .order('name', {ascending: true});

        if (error) {
            console.error("Error fetching families:", error.message);
            throw new Response("Failed to load family data.", {status: 500, headers: Object.fromEntries(headers)});
        }
        // console.log(`Admin new payment loader: Fetched ${families?.length ?? 0} families.`);

        // Fetch students
        // console.log("Admin new payment loader: Fetching students...");
        const { data: students, error: studentsError } = await supabaseAdmin
            .from('students')
            .select('id, first_name, last_name, family_id')
            .order('first_name', { ascending: true });

        if (studentsError) {
            console.error("Error fetching students:", studentsError.message);
            throw new Response("Failed to load student data.", { status: 500, headers: Object.fromEntries(headers) });
        }
        // console.log(`Admin new payment loader: Fetched ${students?.length ?? 0} students.`);

        // Fetch all active tax rates (admin should have choice of all available taxes)
        // console.log("Admin new payment loader: Fetching active tax rates...");
        const { data: taxRatesData, error: taxRatesError } = await supabaseAdmin
            .from('tax_rates')
            .select('id, name, rate, description') // Select fields needed for display/calculation
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (taxRatesError) {
            console.error("Error fetching tax rates:", taxRatesError.message);
            // Proceed without tax rates, but log the error. The component should handle missing rates.
            // throw new Response("Failed to load tax rate data.", { status: 500, headers: Object.fromEntries(headers) });
        }
        // console.log(`Admin new payment loader: Fetched ${taxRatesData?.length ?? 0} active tax rates.`);

        // Fetch products with variants for store purchases
        // console.log("Admin new payment loader: Fetching products with variants...");
        const { data: productsData, error: productsError } = await supabaseAdmin
            .from('products')
            .select(`
                *,
                product_variants (*)
            `)
            .eq('is_active', true)
            .eq('product_variants.is_active', true)
            .order('name');

        if (productsError) {
            console.error("Error fetching products:", productsError.message);
            // Continue without products but log the error
        }

        // Filter out products with no active variants or variants with zero stock
        const availableProducts = productsData
            ?.map(p => ({
                ...p,
                product_variants: p.product_variants.filter(v => v.is_active && v.stock_quantity > 0)
            }))
            .filter(p => p.product_variants.length > 0) || [];
        // console.log(`Admin new payment loader: Fetched ${availableProducts.length} available products.`);

        // Get payment provider info for the frontend
        const paymentProvider = getPaymentProvider();

        return json<LoaderData>({
            families: families || [],
            students: students || [],
            taxRates: taxRatesData || [], // Return fetched tax rates (or empty array)
            products: availableProducts, // Return available products
            paymentProvider: {
                id: paymentProvider.id,
                name: paymentProvider.displayName
            }
        }, {headers: Object.fromEntries(headers)});

    } catch (error) {
        if (error instanceof Error) {
            console.error("Error in /admin/payments/new loader:", error.message);
        } else {
            console.error("Error in /admin/payments/new loader:", error);
        }
        throw new Response("Failed to load data for new payment form.", {
            status: 500,
            headers: Object.fromEntries(headers)
        });
    }
}

export async function action({request}: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    // Validate CSRF token
    await csrf.validate(request);
    
    // console.log("Entering /admin/payments/new action...");
    const {response} = getSupabaseServerClient(request); // Get headers
    const headers = response.headers;
    const formData = await request.formData();

    const familyId = formData.get("familyId") as string;
    const studentIdsString = formData.get("studentIds") as string;
    const studentId = formData.get("studentId") as string | null; // Single student for store_purchase
    const subtotalAmountStr = formData.get("subtotalAmount") as string; // Changed from amount
    let paymentDate = formData.get("paymentDate") as string | null;
    const paymentMethod = formData.get("paymentMethod") as string;
    // Get payment provider to determine if payment method requires online processing
    const paymentProvider = getPaymentProvider();
    const requiresOnlineProcessing = paymentMethod === paymentProvider.id;
    const status = requiresOnlineProcessing ? 'pending' : 'succeeded';
    const notes = formData.get("notes") as string | null;
    const type = formData.get("type") as string || 'monthly_group'; // Use 'type' variable
    const quantityStr = formData.get("quantity") as string; // Get quantity for one_on_one session and store purchases
    const selectedTaxRateIdsString = formData.get("selectedTaxRateIds") as string; // Get selected tax rate IDs
    const productVariantId = formData.get("productVariantId") as string | null; // For store_purchase

    // --- Validation ---
    const fieldErrors: ActionData['fieldErrors'] = {};
    if (!familyId) fieldErrors.familyId = "Family is required.";
    const studentIds = studentIdsString ? studentIdsString.split(',').filter(id => id.trim() !== '') : [];
    if ((type === 'monthly_group' || type === 'yearly_group') && studentIds.length === 0) {
        fieldErrors.studentIds = "Please select at least one student for group payments.";
    }

    // Validate store_purchase specific fields
    if (type === 'store_purchase') {
        if (!studentId) {
            fieldErrors.studentId = "Please select a student for the store purchase.";
        }
        if (!productVariantId) {
            fieldErrors.productVariantId = "Please select a product.";
        }
        if (!quantityStr || isNaN(parseInt(quantityStr)) || parseInt(quantityStr) <= 0) {
            fieldErrors.quantity = "A valid positive quantity is required for store purchases.";
        }
    }

    // Validate subtotal amount
    let subtotalAmount = 0;
    // For store purchases, subtotal will be calculated from product price, so we allow it to be optional
    if (type !== 'store_purchase') {
        if (!subtotalAmountStr || isNaN(parseFloat(subtotalAmountStr)) || parseFloat(subtotalAmountStr) < 0) {
            fieldErrors.subtotalAmount = "A valid non-negative subtotal amount is required.";
        } else {
            subtotalAmount = parseFloat(subtotalAmountStr); // Keep as float for now
        }
    }

    if (!requiresOnlineProcessing) {
        if (!paymentDate) {
            // Default the date if it's not an online payment and date is missing.
            paymentDate = getTodayLocalDateString();
        }
    } else {
        paymentDate = null; // Online payments are pending, date will be set on success
    }

    if (!paymentMethod) fieldErrors.paymentMethod = "Payment method is required.";
    // Status validation removed as it's hardcoded
    // Use the actual enum values for type validation
    if (!type || !['monthly_group', 'yearly_group', 'individual_session', 'other', 'store_purchase'].includes(type)) { // Check 'type' variable
        fieldErrors.type = "Invalid payment type selected."; // Use 'type' key
    }
    let quantity: number | null = null;
    if (type === 'individual_session') { // Check 'type' variable
        if (!quantityStr || isNaN(parseInt(quantityStr)) || parseInt(quantityStr) <= 0) {
            fieldErrors.quantity = "A valid positive quantity is required for Individual Sessions.";
        } else {
            quantity = parseInt(quantityStr);
        }
    }
    if (type === 'store_purchase') { // Parse quantity for store purchases
        if (quantityStr && !isNaN(parseInt(quantityStr)) && parseInt(quantityStr) > 0) {
            quantity = parseInt(quantityStr);
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        console.error("Validation errors:", fieldErrors);
        return json<ActionData>({error: "Validation failed.", fieldErrors}, {
            status: 400,
            headers: Object.fromEntries(headers)
        });
    }
    // --- End Validation ---

    const { getSupabaseAdminClient } = await import('~/utils/supabase.server');
    const supabaseAdmin = getSupabaseAdminClient();

    try {
        let subtotalAmountInCents = 0;
        let orderId: string | null = null;

        // --- Handle Store Purchase ---
        if (type === 'store_purchase' && productVariantId && studentId && quantity) {
            // Fetch product variant details (price, stock check)
            const { data: variantData, error: variantError } = await supabaseAdmin
                .from('product_variants')
                .select('id, price_in_cents, stock_quantity, is_active, products(id, is_active)')
                .eq('id', productVariantId)
                .single();

            if (variantError || !variantData) {
                console.error(`[Admin Payment Action] Error fetching variant ${productVariantId}:`, variantError?.message);
                return json<ActionData>({ error: "Selected product variant not found." }, { status: 404, headers: Object.fromEntries(headers) });
            }

            // Check if variant and product are active and in stock
            if (!variantData.is_active || !variantData.products?.is_active) {
                return json<ActionData>({ error: "Selected product is no longer available." }, { status: 400, headers: Object.fromEntries(headers) });
            }
            if (variantData.stock_quantity < quantity) {
                return json<ActionData>({ error: "Insufficient stock for the selected product." }, { status: 400, headers: Object.fromEntries(headers) });
            }

            const pricePerItem = variantData.price_in_cents;
            subtotalAmountInCents = pricePerItem * quantity;

            // Calculate Taxes using store purchase tax logic (handles PST exemption)
            let taxRatesData = [];
            try {
                taxRatesData = await getApplicableTaxRatesForStorePurchase(studentId, supabaseAdmin);
            } catch (error) {
                console.error('[Admin Payment Action] Error fetching tax rates for store purchase:', error);
                return json<ActionData>({ error: "Could not retrieve tax information." }, { status: 500, headers: Object.fromEntries(headers) });
            }

            const applicableTaxes = taxRatesData?.map(t => ({ name: t.name, rate: Number(t.rate), description: t.description })) || [];
            const totalTaxAmount = applicableTaxes.reduce((acc, tax) => {
                return acc + Math.round(subtotalAmountInCents * tax.rate);
            }, 0);
            const finalTotalAmountCents = subtotalAmountInCents + totalTaxAmount;

            // Create Order record
            // Set order_date to match payment_date for proper tracking
            // Since order_date is TIMESTAMPTZ, we need to pass a full ISO timestamp, not just a date
            // to avoid timezone interpretation issues
            let orderDate: string;
            if (paymentDate) {
                // Convert YYYY-MM-DD to ISO timestamp at noon local time to avoid date boundary issues
                orderDate = new Date(`${paymentDate}T12:00:00`).toISOString();
            } else {
                // Use current timestamp
                orderDate = new Date().toISOString();
            }

            const orderInsert = {
                family_id: familyId,
                student_id: studentId,
                status: (requiresOnlineProcessing ? 'pending_payment' : 'paid_pending_pickup') as Database['public']['Enums']['order_status'],
                total_amount_cents: finalTotalAmountCents,
                order_date: orderDate, // Full ISO timestamp to avoid timezone issues
            };

            const { data: orderData, error: orderError } = await supabaseAdmin
                .from('orders')
                .insert(orderInsert)
                .select('id')
                .single();

            if (orderError || !orderData) {
                console.error(`[Admin Payment Action] Error creating order for family ${familyId}:`, orderError?.message);
                return json<ActionData>({ error: "Failed to create order record." }, { status: 500, headers: Object.fromEntries(headers) });
            }
            orderId = orderData.id;

            // Create Order Item record
            const orderItemInsert = {
                order_id: orderId,
                product_variant_id: productVariantId,
                quantity: quantity,
                price_per_item_cents: pricePerItem,
            };

            const { error: orderItemError } = await supabaseAdmin
                .from('order_items')
                .insert(orderItemInsert);

            if (orderItemError) {
                console.error(`[Admin Payment Action] Error creating order item for order ${orderId}:`, orderItemError.message);
                // Cleanup order on failure
                await supabaseAdmin.from('orders').delete().eq('id', orderId);
                return json<ActionData>({ error: "Failed to create order item record." }, { status: 500, headers: Object.fromEntries(headers) });
            }

            console.log(`[Admin Payment Action] Created order ${orderId} with total ${finalTotalAmountCents} cents`);
        } else {
            // For non-store purchases, convert subtotal to cents
            subtotalAmountInCents = Math.round(subtotalAmount * 100);
        }

        // --- Multi-Tax Calculation ---
        // Skip manual tax calculation for store purchases (already calculated above)
        let totalTaxAmountInCents = 0;
        const paymentTaxesToInsert: Array<{
            tax_rate_id: string;
            tax_amount: number;
            tax_rate_snapshot: number;
            tax_name_snapshot: string;
            tax_description_snapshot: string | null;
        }> = [];

        if (type !== 'store_purchase') {
            const selectedTaxRateIds = selectedTaxRateIdsString ? selectedTaxRateIdsString.split(',').filter(id => id.trim() !== '') : [];

            let taxRatesData = null;
            let taxRatesError = null;

            // Only fetch tax rates if some are selected
            if (selectedTaxRateIds.length > 0) {
                const result = await supabaseAdmin
                    .from('tax_rates')
                    .select('id, name, rate, description') // Fetch description as well
                    .in('id', selectedTaxRateIds)
                    .eq('is_active', true);
                taxRatesData = result.data;
                taxRatesError = result.error;
            }

            if (taxRatesError) {
                throw new Error(`Failed to fetch tax rates: ${taxRatesError.message}`);
            }

            if (taxRatesData) {
                for (const taxRate of taxRatesData) {
                    const rate = Number(taxRate.rate);
                    if (isNaN(rate)) continue;
                    const taxAmountForThisRate = Math.round(subtotalAmountInCents * rate);
                    totalTaxAmountInCents += taxAmountForThisRate;
                    paymentTaxesToInsert.push({
                        tax_rate_id: taxRate.id,
                        tax_amount: taxAmountForThisRate,
                        tax_rate_snapshot: rate,
                        tax_name_snapshot: taxRate.name,
                        tax_description_snapshot: taxRate.description, // Store description
                    });
                }
            }
        } else {
            // For store purchases, tax was already calculated and included in order total
            // We need to extract tax info from the order to create payment_taxes records
            if (orderId && studentId) {
                try {
                    const taxRatesData = await getApplicableTaxRatesForStorePurchase(studentId, supabaseAdmin);
                    const applicableTaxes = taxRatesData?.map(t => ({ name: t.name, rate: Number(t.rate), description: t.description, id: t.id })) || [];
                    for (const tax of applicableTaxes) {
                        const taxAmountForThisRate = Math.round(subtotalAmountInCents * tax.rate);
                        totalTaxAmountInCents += taxAmountForThisRate;
                        paymentTaxesToInsert.push({
                            tax_rate_id: tax.id,
                            tax_amount: taxAmountForThisRate,
                            tax_rate_snapshot: tax.rate,
                            tax_name_snapshot: tax.name,
                            tax_description_snapshot: tax.description || null,
                        });
                    }
                } catch (error) {
                    console.error('[Admin Payment Action] Error fetching tax rates for payment_taxes:', error);
                    // Continue without tax breakdown - order already has total
                }
            }
        }

        const totalAmountInCents = subtotalAmountInCents + totalTaxAmountInCents;
        // --- End Multi-Tax Calculation ---

        // console.log("Admin new payment action: Inserting payment record...");
        // Insert main payment record
        const { data: paymentData, error: insertPaymentError } = await supabaseAdmin
            .from('payments')
            .insert({
                family_id: familyId,
                // Payments numeric columns are INT4 cents in this schema
                subtotal_amount: subtotalAmountInCents,
                // tax_amount removed
                total_amount: totalAmountInCents,
                payment_date: paymentDate,
                payment_method: paymentMethod,
                status: status as Database['public']['Enums']['payment_status'],
                type: type as Database['public']['Enums']['payment_type_enum'],
                notes: notes,
                order_id: orderId, // Link to order for store purchases
            })
            .select('id')
            .single();

        if (insertPaymentError || !paymentData?.id) {
            console.error("Error inserting payment:", insertPaymentError?.message);
            // Cleanup order if payment creation failed
            if (orderId) {
                await supabaseAdmin.from('order_items').delete().eq('order_id', orderId);
                await supabaseAdmin.from('orders').delete().eq('id', orderId);
            }
            return json<ActionData>({error: `Failed to record payment: ${insertPaymentError?.message || 'Could not retrieve payment ID'}`}, {
                status: 500,
                headers: Object.fromEntries(headers)
            });
        }

        const paymentId = paymentData.id;
        console.log(`Payment ${paymentId} recorded. Status: ${status}. Subtotal: ${subtotalAmountInCents}, Total Tax: ${totalTaxAmountInCents}, Total: ${totalAmountInCents}`);

        // Insert student links if applicable
        if ((type === 'monthly_group' || type === 'yearly_group') && studentIds.length > 0) {
            const paymentStudentsToInsert = studentIds.map(studentId => ({
                payment_id: paymentId,
                student_id: studentId,
            }));
            const { error: insertStudentsError } = await supabaseAdmin
                .from('payment_students')
                .insert(paymentStudentsToInsert);

            if (insertStudentsError) {
                console.error(`Error inserting payment_students for payment ${paymentId}:`, insertStudentsError.message);
                // For now, return error indicating partial failure.
                return json<ActionData>({error: `Payment recorded, but failed to link students: ${insertStudentsError.message}`}, {
                    status: 500,
                    headers: Object.fromEntries(headers)
                });
            }
            console.log(`Inserted ${paymentStudentsToInsert.length} student links for payment ${paymentId}.`);
        }

        // Insert tax breakdown
        if (paymentTaxesToInsert.length > 0) {
            const taxesWithPaymentId = paymentTaxesToInsert.map(tax => ({
                ...tax,
                tax_amount_cents: tax.tax_amount,
                payment_id: paymentId,
            }));
            const { error: insertTaxesError } = await supabaseAdmin
                .from('payment_taxes')
                .insert(taxesWithPaymentId);

            if (insertTaxesError) {
                console.error(`Error inserting payment_taxes for payment ${paymentId}:`, insertTaxesError.message);
                // Attempt cleanup? Or return partial success error?
                // For now, return error indicating partial failure.
                return json<ActionData>({error: `Payment recorded, but failed to record tax details: ${insertTaxesError.message}`}, {
                    status: 500,
                    headers: Object.fromEntries(headers)
                });
            }
             console.log(`Inserted ${taxesWithPaymentId.length} tax records for payment ${paymentId}.`);
        }

        // If it's an individual session payment, record the session purchase (logic remains the same)
        if (type === 'individual_session' && quantity !== null) {
            // console.log(`Recording Individual Session purchase for payment ${paymentId}, quantity: ${quantity}`);
            const { error: sessionInsertError } = await supabaseAdmin
                .from('one_on_one_sessions') // Table name remains the same
                .insert({
                    payment_id: paymentId,
                    family_id: familyId,
                    quantity_purchased: quantity,
                    quantity_remaining: quantity, // Initially, remaining equals purchased
                    // purchase_date, created_at, updated_at have defaults
                });

            if (sessionInsertError) {
                console.error(`Error inserting Individual Session record for payment ${paymentId}:`, sessionInsertError.message);
                // Note: Payment is already created. Might need manual cleanup or a more robust transaction.
                // For now, return an error indicating partial success.
                return json<ActionData>({error: `Payment recorded, but failed to record Individual Session details: ${sessionInsertError.message}`}, {
                    status: 500, // Or maybe a different status?
                    headers: Object.fromEntries(headers)
                });
            }
            console.log(`Individual Session purchase recorded for payment ${paymentId}.`);
        }

        // If it's an online payment, redirect to the payment page to handle it.
        if (requiresOnlineProcessing) {
            console.log(`Online payment initiated with ${paymentProvider.id}. Redirecting to payment page for payment ${paymentId}.`);
            return redirect(`/pay/${paymentId}`, { headers: Object.fromEntries(headers) });
        }

        // Redirect to the payments index page on success for other methods
        headers.set('Location', '/admin/payments?success=true');
        return redirect("/admin/payments?success=true", {headers: Object.fromEntries(headers)});

    } catch (error) {
        if (error instanceof Error) {
            console.error("Error in /admin/payments/new action:", error.message);
        } else {
            console.error("Error in /admin/payments/new action:", error);
        }
        return json<ActionData>({error: "An unexpected error occurred while recording the payment."}, {
            status: 500,
            headers: Object.fromEntries(headers)
        });
    }
}


export default function AdminNewPaymentPage() {
    // Combined declaration for loader data
    const {families, students, taxRates, products, paymentProvider} = useLoaderData<typeof loader>(); // Get families, taxRates, products, and paymentProvider
    // Single declaration for action data
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // Ref for family field to enable focus
    const familySelectRef = useRef<HTMLButtonElement>(null);

    // State for controlled Select components
    const [selectedFamily, setSelectedFamily] = useState<string | undefined>(undefined);
    const [familyStudents, setFamilyStudents] = useState<StudentInfo[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(undefined); // Single student for store purchase
    const [selectedMethod, setSelectedMethod] = useState<string | undefined>(undefined);
    // selectedStatus state removed
    const [selectedType, setSelectedType] = useState<string>('monthly_group'); // Use selectedType state
    const [subtotalStr, setSubtotalStr] = useState<string>(''); // State for subtotal input string
    const [selectedTaxRateIds, setSelectedTaxRateIds] = useState<Set<string>>(new Set()); // State for selected tax rates
    const [selectedProductVariantId, setSelectedProductVariantId] = useState<string | undefined>(undefined); // For store purchases
    const [storePurchaseQuantity, setStorePurchaseQuantity] = useState<string>('1'); // For store purchases

    // Focus on family field when component mounts
    useEffect(() => {
        if (familySelectRef.current) {
            familySelectRef.current.focus();
        }
    }, []);

    useEffect(() => {
        if (selectedFamily) {
            const currentFamilyStudents = students.filter(s => s.family_id === selectedFamily);
            setFamilyStudents(currentFamilyStudents);
            setSelectedStudentIds(new Set()); // Reset student selection when family changes

            // If a group payment type is selected but the new family has no students, reset the type.
            if (currentFamilyStudents.length === 0 && (selectedType === 'monthly_group' || selectedType === 'yearly_group')) {
                setSelectedType('other'); // Default to 'other'
            }
        } else {
            setFamilyStudents([]);
            setSelectedStudentIds(new Set());
        }
    }, [selectedFamily, students, selectedType]);

    const handleCheckboxChange = (studentId: string, checked: boolean) => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (checked) {
                next.add(studentId);
            } else {
                next.delete(studentId);
            }
            return next;
        });
    };

    // Client-side calculation for display
    const calculateDisplayAmounts = useCallback(() => {
        let subtotalCents = 0;
        let totalTaxCents = 0;
        const calculatedTaxes: Array<{ name: string; description: string | null; amount: number }> = [];

        // For store purchases, calculate based on product price and quantity
        if (selectedType === 'store_purchase') {
            if (selectedProductVariantId) {
                // Find the selected product variant
                let selectedVariant: ProductVariantRow | undefined;
                for (const product of products) {
                    const variant = product.product_variants.find(v => v.id === selectedProductVariantId);
                    if (variant) {
                        selectedVariant = variant;
                        break;
                    }
                }

                if (selectedVariant) {
                    const quantity = parseInt(storePurchaseQuantity) || 1;
                    subtotalCents = selectedVariant.price_in_cents * quantity;

                    // Note: For store purchases, tax is calculated server-side based on student age
                    // We show a note instead of calculating tax client-side
                    // This is because PST exemption logic is complex and depends on student birth date
                }
            }
        } else {
            // For other payment types, use the subtotal amount input
            const subtotalNum = parseFloat(subtotalStr);
            if (isNaN(subtotalNum) || subtotalNum < 0) {
                return { subtotal: 0, taxes: [], total: 0 };
            }
            subtotalCents = Math.round(subtotalNum * 100);

            // Use only selected tax rates from loader data
            if (taxRates && taxRates.length > 0) {
                for (const taxRate of taxRates) {
                    // Only calculate tax if this tax rate is selected
                    if (selectedTaxRateIds.has(taxRate.id)) {
                        const rate = Number(taxRate.rate);
                        if (!isNaN(rate)) {
                            const taxAmountForThisRate = Math.round(subtotalCents * rate);
                            totalTaxCents += taxAmountForThisRate;
                            calculatedTaxes.push({
                                name: taxRate.name,
                                description: taxRate.description,
                                amount: taxAmountForThisRate,
                            });
                        }
                    }
                }
            }
        }

        const totalCents = subtotalCents + totalTaxCents;
        return { subtotal: subtotalCents, taxes: calculatedTaxes, total: totalCents };
    }, [selectedType, selectedProductVariantId, storePurchaseQuantity, subtotalStr, selectedTaxRateIds, products, taxRates]);

    const { subtotal: calculatedSubtotalCents, taxes: calculatedTaxes, total: calculatedTotalCents } = useMemo(
        () => calculateDisplayAmounts(),
        [calculateDisplayAmounts]
    );

    // console.log("Rendering AdminNewPaymentPage component...");
    // console.log("Action Data:", actionData);
    // console.log("Tax Rates from Loader:", taxRates);
    // console.log("Calculated Display Amounts:", { calculatedSubtotalCents, calculatedTaxes, calculatedTotalCents });

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <AppBreadcrumb items={breadcrumbPatterns.adminPaymentNew()} className="mb-6" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                    Record New Payment
                </h1>
            </div>

            {actionData?.error && !actionData.fieldErrors && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg p-6">
                <Form method="post">
                    <AuthenticityTokenInput />
                    <div className="space-y-6">
                        {/* Family Selection */}
                        <div>
                            <Label htmlFor="familyId">Family</Label>
                            <Select
                                name="familyId"
                                value={selectedFamily}
                                onValueChange={setSelectedFamily}
                                required
                            >
                                <SelectTrigger id="familyId" tabIndex={1} ref={familySelectRef} className="input-custom-styles">
                                    <SelectValue placeholder="Select a family"/>
                                </SelectTrigger>
                                <SelectContent>
                                    {families.map((family) => (
                                        <SelectItem key={family.id} value={family.id}>
                                            {family.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {actionData?.fieldErrors?.familyId && (
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.familyId}</p>
                            )}
                        </div>

                        {/* Payment Type */}
                        <div>
                            <Label htmlFor="type">Payment Type</Label> {/* Update htmlFor */}
                            <Select
                                name="type" // Update name
                                value={selectedType} // Update value
                                onValueChange={setSelectedType} // Update handler
                                required
                            >
                                <SelectTrigger id="type" tabIndex={2} className="input-custom-styles"> {/* Update id */}
                                    <SelectValue placeholder="Select payment type"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly_group"
                                                disabled={!!(selectedFamily && familyStudents.length === 0)}>Monthly Group Class</SelectItem>
                                    <SelectItem value="yearly_group"
                                                disabled={!!(selectedFamily && familyStudents.length === 0)}>Yearly Group Class</SelectItem>
                                    <SelectItem value="individual_session">Individual Session</SelectItem>
                                    <SelectItem value="store_purchase">Store Purchase</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            {actionData?.fieldErrors?.type && ( // Check 'type' field error
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.type}</p>
                            )}
                        </div>

                        {/* Conditionally show student selection */}
                        {(selectedType === 'monthly_group' || selectedType === 'yearly_group') && selectedFamily && (
                            <div className="border p-4 rounded-md mt-4 bg-gray-50/50 dark:bg-gray-700/50 dark:border-gray-600">
                                <Label className="font-semibold">Students</Label>
                                {familyStudents.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                        {familyStudents.map(student => (
                                            <div key={student.id} className="flex items-center space-x-3">
                                                <Checkbox
                                                    id={`student-${student.id}`}
                                                    checked={selectedStudentIds.has(student.id)}
                                                    onCheckedChange={(checked) => handleCheckboxChange(student.id, !!checked)}
                                                    tabIndex={2 + familyStudents.indexOf(student) + 1}
                                                />
                                                <Label htmlFor={`student-${student.id}`} className="font-normal cursor-pointer">
                                                    {student.first_name} {student.last_name}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 mt-2">No students found for this family.</p>
                                )}
                                {actionData?.fieldErrors?.studentIds && (
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.studentIds}</p>
                                )}
                            </div>
                        )}

                        {/* Conditionally show Quantity for Individual sessions */}
                        {selectedType === 'individual_session' && ( // Check selectedType state
                            <div>
                                <Label htmlFor="quantity">Quantity (Number of Sessions)</Label>
                                <Input
                                    id="quantity"
                                    name="quantity"
                                    type="number"
                                    min="1"
                                    step="1"
                                    placeholder="e.g., 5"
                                    required={selectedType === 'individual_session'} // Check selectedType state
                                    className="mt-1"
                                    tabIndex={3}
                                />
                                {actionData?.fieldErrors?.quantity && (
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.quantity}</p>
                                )}
                            </div>
                        )}

                        {/* Conditionally show Store Purchase fields */}
                        {selectedType === 'store_purchase' && selectedFamily && (
                            <div className="border p-4 rounded-md mt-4 bg-gray-50/50 dark:bg-gray-700/50 dark:border-gray-600 space-y-4">
                                {/* Single Student Selection */}
                                <div>
                                    <Label htmlFor="studentId">Student</Label>
                                    <Select
                                        name="studentId"
                                        value={selectedStudentId}
                                        onValueChange={setSelectedStudentId}
                                        required={selectedType === 'store_purchase'}
                                    >
                                        <SelectTrigger id="studentId" className="input-custom-styles">
                                            <SelectValue placeholder="Select a student"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {familyStudents.map((student) => (
                                                <SelectItem key={student.id} value={student.id}>
                                                    {student.first_name} {student.last_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {actionData?.fieldErrors?.studentId && (
                                        <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.studentId}</p>
                                    )}
                                </div>

                                {/* Product Variant Selection */}
                                <div>
                                    <Label htmlFor="productVariantId">Product</Label>
                                    <Select
                                        name="productVariantId"
                                        value={selectedProductVariantId}
                                        onValueChange={setSelectedProductVariantId}
                                        required={selectedType === 'store_purchase'}
                                    >
                                        <SelectTrigger id="productVariantId" className="input-custom-styles">
                                            <SelectValue placeholder="Select a product"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {products.map((product) => (
                                                product.product_variants.map((variant) => (
                                                    <SelectItem key={variant.id} value={variant.id}>
                                                        {product.name} - {variant.size} ({formatMoney(fromCents(variant.price_in_cents))})
                                                    </SelectItem>
                                                ))
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {actionData?.fieldErrors?.productVariantId && (
                                        <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.productVariantId}</p>
                                    )}
                                </div>

                                {/* Quantity */}
                                <div>
                                    <Label htmlFor="storePurchaseQuantity">Quantity</Label>
                                    <Input
                                        id="storePurchaseQuantity"
                                        name="quantity"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={storePurchaseQuantity}
                                        onChange={(e) => setStorePurchaseQuantity(e.target.value)}
                                        required={selectedType === 'store_purchase'}
                                        className="mt-1"
                                    />
                                    {actionData?.fieldErrors?.quantity && (
                                        <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.quantity}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Subtotal Amount - Hide for store purchases as it's calculated automatically */}
                        {selectedType !== 'store_purchase' && (
                            <div>
                                <Label htmlFor="subtotalAmount">Subtotal Amount ($)</Label>
                                <Input
                                    id="subtotalAmount"
                                    name="subtotalAmount" // Changed name
                                    type="number"
                                    step="0.01"
                                    min="0.00"
                                    placeholder="e.g., 150.00"
                                    required={selectedType !== 'store_purchase'}
                                    className="mt-1"
                                    value={subtotalStr} // Control input value
                                    onChange={(e) => setSubtotalStr(e.target.value)} // Update state on change
                                    tabIndex={4}
                                />
                                {actionData?.fieldErrors?.subtotalAmount && (
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.subtotalAmount}</p>
                                )}
                            </div>
                        )}

                        {/* Tax Rates Selection - Hide for store purchases as tax is automatic */}
                        {selectedType !== 'store_purchase' && (
                            <div>
                                <Label className="block text-sm font-medium mb-1">
                                    Tax Rates
                                </Label>
                                <div className="space-y-2 mt-2">
                                    {taxRates.length > 0 ? (
                                        taxRates.map((taxRate) => (
                                            <div key={taxRate.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`tax-${taxRate.id}`}
                                                    checked={selectedTaxRateIds.has(taxRate.id)}
                                                    onCheckedChange={(checked) => {
                                                        setSelectedTaxRateIds(prev => {
                                                            const newIds = new Set(prev);
                                                            if (checked) {
                                                                newIds.add(taxRate.id);
                                                            } else {
                                                                newIds.delete(taxRate.id);
                                                            }
                                                            return newIds;
                                                        });
                                                    }}
                                                />
                                                <Label
                                                    htmlFor={`tax-${taxRate.id}`}
                                                    className="text-sm font-normal cursor-pointer"
                                                >
                                                    {taxRate.name} ({(taxRate.rate * 100).toFixed(2)}%)
                                                    {taxRate.description && (
                                                        <span className="text-muted-foreground ml-1">- {taxRate.description}</span>
                                                    )}
                                                </Label>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No tax rates available</p>
                                    )}
                                </div>
                                {/* Hidden input to submit selected tax rate IDs */}
                                <input
                                    type="hidden"
                                    name="selectedTaxRateIds"
                                    value={Array.from(selectedTaxRateIds).join(',')}
                                />
                            </div>
                        )}

                        {/* Display Calculated Tax and Total */}
                        {calculatedSubtotalCents > 0 && (
                            <div className="mt-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 space-y-1">
                                <p className="text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                                    <span>Subtotal:</span>
                                    <span>{formatMoney(fromCents(calculatedSubtotalCents))}</span>
                                </p>
                                {selectedType === 'store_purchase' ? (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                        Tax will be calculated based on student age (PST exemption applies for students under 15)
                                    </p>
                                ) : (
                                    calculatedTaxes.map((tax, index) => (
                                        <p key={index} className="text-sm text-gray-600 dark:text-gray-300 flex justify-between">
                                            <span>{tax.description || tax.name}:</span>
                                            <span>{formatMoney(fromCents(tax.amount))}</span>
                                        </p>
                                    ))
                                )}
                                <p className="text-md font-semibold text-gray-800 dark:text-gray-100 flex justify-between border-t pt-2 mt-2 dark:border-gray-500">
                                    <span>{selectedType === 'store_purchase' ? 'Subtotal (taxes added at checkout):' : 'Total Amount:'}</span>
                                    <span>{formatMoney(fromCents(calculatedTotalCents))}</span>
                                </p>
                            </div>
                        )}

                        {/* Payment Date (hidden for online payments) */}
                        {selectedMethod !== paymentProvider.id && (
                            <div>
                                <Label htmlFor="paymentDate">Payment Date</Label>
                                <Input
                                    id="paymentDate"
                                    name="paymentDate"
                                    type="date"
                                    defaultValue={getTodayLocalDateString()}
                                    required={selectedMethod !== paymentProvider.id}
                                    className="mt-1"
                                    tabIndex={5}
                                />
                                {actionData?.fieldErrors?.paymentDate && (
                                    <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.paymentDate}</p>
                                )}
                            </div>
                        )}

                        {/* Payment Method */}
                        <div>
                            <Label htmlFor="paymentMethod">Payment Method</Label>
                            <Select
                                name="paymentMethod"
                                value={selectedMethod}
                                onValueChange={setSelectedMethod}
                                required
                            >
                                <SelectTrigger id="paymentMethod" tabIndex={6} className="input-custom-styles">
                                    <SelectValue placeholder="Select payment method"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="cheque">Cheque</SelectItem>
                                    <SelectItem value="etransfer">E-Transfer</SelectItem>
                                    <SelectItem value={paymentProvider.id}>{paymentProvider.name} (Online)</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            {actionData?.fieldErrors?.paymentMethod && (
                                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.paymentMethod}</p>
                            )}
                        </div>

                        {/* Status field removed */}

                        {/* Online Payment Info Message */}
                        {selectedMethod === paymentProvider.id && (
                            <Alert variant="default" className="bg-blue-50 dark:bg-gray-700 border-blue-200 dark:border-gray-600">
                                <AlertTitle className="text-blue-800 dark:text-blue-200">{paymentProvider.name} Payment</AlertTitle>
                                <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                                    After submitting, you will be redirected to a secure {paymentProvider.name} payment page to complete the transaction. The payment will be marked as &apos;pending&apos; until completed.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Notes */}
                        <div>
                            <Label htmlFor="notes">Notes (Optional)</Label>
                            <Textarea
                                id="notes"
                                name="notes"
                                placeholder="e.g., Cheque #123, Paid for June fees"
                                className="mt-1"
                                rows={3}
                                tabIndex={7}
                            />
                        </div>

                    </div>

                    <input type="hidden" name="studentIds" value={Array.from(selectedStudentIds).join(',')} />

                    <div className="mt-8 flex justify-end">
                        <Button type="submit" disabled={isSubmitting} tabIndex={8}>
                            {isSubmitting ? "Recording..." : "Record Payment"}
                        </Button>
                    </div>
                </Form>
            </div>
        </div>
    );
}

// Basic ErrorBoundary for this route
export function ErrorBoundary() {
    const error = useRouteError() as Error;
    console.error("Error caught in AdminNewPaymentPage ErrorBoundary:", error);

    return (
        <div
            className="p-4 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900/30 dark:border-red-600 dark:text-red-300">
            <h2 className="text-xl font-bold mb-2">Error Creating New Payment</h2>
            <p>{error?.message || "An unknown error occurred."}</p>
            {error && (
                <pre
                    className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs dark:bg-red-900/50 dark:text-red-100">
          {error.stack || JSON.stringify(error, null, 2)}
        </pre>
            )}
            <a href="/admin/payments" className="text-blue-600 hover:underline mt-4 inline-block">
                Return to Payments List
            </a>
        </div>
    );
}
