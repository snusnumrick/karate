import { useState, useMemo } from 'react';
import { type ActionFunctionArgs, type LoaderFunctionArgs, json, redirect, TypedResponse } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation, useParams } from "@remix-run/react";
import { getSupabaseServerClient, createInitialPaymentRecord } from "~/utils/supabase.server";
import { createClient } from '@supabase/supabase-js'; // Import createClient for admin
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import type { Database, Tables, TablesInsert } from "~/types/database.types";
import { formatCurrency } from "~/utils/misc"; // Assuming you have a currency formatter
import { siteConfig } from "~/config/site"; // For tax calculation consistency
import { ArrowLeft, Info } from 'lucide-react'; // Added Info icon
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

// --- Helper Function for Size Recommendation ---
const tShirtToUniformSizeMap: { [key: string]: string } = {
    // Assuming standard Youth/Adult sizing codes. Adjust keys if your codes differ.
    'YS': '00', // Youth Small -> Child S -> Uniform 00
    'YM': '0',  // Youth Medium -> Child M -> Uniform 0
    'YL': '1',  // Youth Large -> Child L -> Uniform 1
    'YXL': '2', // Youth XL -> Adult XS -> Uniform 2 (Assumption)
    'AS': '3',  // Adult Small -> Uniform 3
    'AM': '4',  // Adult Medium -> Uniform 4
    'AL': '5',  // Adult Large -> Uniform 5
    'AXL': '6', // Adult XL -> Uniform 6
    'AXXL': '7',// Adult XXL -> Uniform 7
    // Add other potential t-shirt sizes if needed
};

function getRecommendedUniformSize(tShirtSize: string | null | undefined): string | null {
    if (!tShirtSize) return null;
    return tShirtToUniformSizeMap[tShirtSize.toUpperCase()] || null; // Case-insensitive lookup
}

// --- Define Types ---
type ProductRow = Tables<'products'>;
type ProductVariantRow = Tables<'product_variants'>;
type StudentRow = Tables<'students'>;
type OrderInsert = TablesInsert<'orders'>;
type OrderItemInsert = TablesInsert<'order_items'>;

type ProductWithVariants = ProductRow & {
    product_variants: ProductVariantRow[];
};

type LoaderData = {
    student: Pick<StudentRow, 'id' | 'first_name' | 'last_name' | 't_shirt_size'>;
    products: ProductWithVariants[];
    applicableTaxes: Array<{ name: string; rate: number }>; // Pass calculated tax rates
};

type ActionData = {
    error?: string;
    fieldErrors?: { [key: string]: string };
};

// --- Loader ---
export async function loader({ request, params }: LoaderFunctionArgs) {
    const studentId = params.studentId;
    if (!studentId) {
        throw new Response("Student ID is required", { status: 400 });
    }

    const { supabaseServer, response } = getSupabaseServerClient(request);
    const headers = response.headers;
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
        return redirect(`/login?redirectTo=/family/store/purchase/${studentId}`, { headers });
    }

    // Fetch student data (only needed fields)
    const { data: studentData, error: studentError } = await supabaseServer
        .from('students')
        .select('id, first_name, last_name, t_shirt_size')
        .eq('id', studentId)
        .single();

    if (studentError || !studentData) {
        console.error("Error fetching student data for purchase:", studentError?.message);
        throw new Response("Student not found", { status: 404 });
    }

    // Verify user belongs to the student's family
    const { data: profileData, error: profileError } = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    const { data: studentFamilyData, error: studentFamilyError } = await supabaseServer
        .from('students')
        .select('family_id')
        .eq('id', studentId)
        .single();

    if (profileError || studentFamilyError || !profileData || !studentFamilyData || profileData.family_id !== studentFamilyData.family_id) {
        console.error("Authorization error: User", user.id, "tried to access purchase page for student", studentId, "from different family.");
        throw new Response("Forbidden: You do not have permission.", { status: 403 });
    }

    // Fetch active products (e.g., 'Gi') with their active variants
    const { data: productsData, error: productsError } = await supabaseServer
        .from('products')
        .select(`
            *,
            product_variants (
                id,
                product_id,
                size,
                price_in_cents,
                stock_quantity,
                is_active
            )
        `)
        .eq('is_active', true)
        .eq('product_variants.is_active', true) // Filter variants too
        .order('name'); // Order products alphabetically

    if (productsError) {
        console.error("Error fetching products:", productsError.message);
        throw new Response("Could not load products.", { status: 500 });
    }

    // Filter out products with no active variants or variants with zero stock
    const availableProducts = productsData
        .map(p => ({
            ...p,
            product_variants: p.product_variants.filter(v => v.is_active && v.stock_quantity > 0)
        }))
        .filter(p => p.product_variants.length > 0);


    // Fetch active tax rates for display/calculation consistency
    const applicableTaxNames = siteConfig.pricing.applicableTaxNames;
    const { data: taxRatesData, error: taxRatesError } = await supabaseServer
        .from('tax_rates')
        .select('name, rate')
        .in('name', applicableTaxNames)
        .eq('is_active', true);

    if (taxRatesError) {
        console.error('Error fetching tax rates for purchase page:', taxRatesError.message);
        // Proceed without tax calculation on frontend if rates fail, backend will handle it
    }

    const applicableTaxes = taxRatesData?.map(t => ({ name: t.name, rate: Number(t.rate) })) || [];


    return json({
        student: studentData,
        products: availableProducts,
        applicableTaxes: applicableTaxes,
    }, { headers });
}

// --- Action ---
export async function action({ request, params }: ActionFunctionArgs): Promise<TypedResponse<ActionData | never>> {
    const studentId = params.studentId;
    if (!studentId) {
        return json({ error: "Student ID is missing." }, { status: 400 });
    }

    const formData = await request.formData();
    const productVariantId = formData.get('productVariantId') as string;
    const quantity = 1; // Hardcoded to 1 for now, as basket isn't needed

    const { supabaseServer, response } = getSupabaseServerClient(request);
    const headers = response.headers;
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
        return redirect(`/login?redirectTo=/family/store/purchase/${studentId}`, { headers });
    }

    // --- Validation ---
    if (!productVariantId) {
        return json({ error: "Please select a product size.", fieldErrors: { productVariantId: "Selection required." } }, { status: 400, headers });
    }

    // --- Authorization & Data Fetching ---
    // Fetch student's family ID
    const { data: studentFamilyData, error: studentFamilyError } = await supabaseServer
        .from('students')
        .select('family_id')
        .eq('id', studentId)
        .single();

    if (studentFamilyError || !studentFamilyData) {
        return json({ error: "Student not found." }, { status: 404, headers });
    }
    const familyId = studentFamilyData.family_id;

    // Verify user belongs to the family
    const { data: profileData, error: profileError } = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || profileData.family_id !== familyId) {
        return json({ error: "Forbidden: You do not have permission." }, { status: 403, headers });
    }

    // Fetch selected product variant details (price, stock check) using ADMIN client for reliability
    const supabaseAdmin = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: variantData, error: variantError } = await supabaseAdmin
        .from('product_variants')
        .select('id, price_in_cents, stock_quantity, is_active, products(id, is_active)') // Include product active status
        .eq('id', productVariantId)
        .single();

    if (variantError || !variantData) {
        console.error(`[Purchase Action] Error fetching variant ${productVariantId}:`, variantError?.message);
        return json({ error: "Selected product variant not found or could not be retrieved." }, { status: 404, headers });
    }

    // Check if variant and product are active and in stock
    if (!variantData.is_active || !variantData.products?.is_active) {
        return json({ error: "Selected product is no longer available." }, { status: 400, headers });
    }
    if (variantData.stock_quantity < quantity) {
        return json({ error: "Selected size is currently out of stock." }, { status: 400, headers });
    }

    const pricePerItem = variantData.price_in_cents;
    const subtotalAmount = pricePerItem * quantity;

    // --- Calculate Taxes ---
    const applicableTaxNames = siteConfig.pricing.applicableTaxNames;
    const { data: taxRatesData, error: taxRatesError } = await supabaseAdmin
        .from('tax_rates')
        .select('name, rate, description') // Fetch description too if needed later, though not strictly for calc
        .in('name', applicableTaxNames)
        .eq('is_active', true);

    if (taxRatesError) {
        console.error('[Purchase Action] Error fetching tax rates:', taxRatesError.message);
        // Decide how to handle - fail? proceed without tax? For now, let's fail.
        return json({ error: "Could not retrieve tax information to calculate total." }, { status: 500, headers });
    }

    const applicableTaxes = taxRatesData?.map(t => ({ name: t.name, rate: Number(t.rate) })) || [];
    const totalTaxAmount = applicableTaxes.reduce((acc, tax) => {
        // Ensure tax calculation matches createInitialPaymentRecord (e.g., rounding)
        return acc + Math.round(subtotalAmount * tax.rate);
    }, 0);
    const finalTotalAmountCents = subtotalAmount + totalTaxAmount;


    // --- Create Order & Order Item ---
    // 1. Create Order record
    const orderInsert: OrderInsert = {
        family_id: familyId,
        student_id: studentId,
        status: 'pending_payment', // Initial status
        total_amount_cents: finalTotalAmountCents, // Use calculated total
    };

    // --- Log the exact data being inserted ---
    console.log('[Purchase Action] Inserting order with data:', JSON.stringify(orderInsert));
    // -----------------------------------------

    const { data: orderData, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert(orderInsert)
        .select('id')
        .single();

    if (orderError || !orderData) {
        console.error(`[Purchase Action] Error creating order for family ${familyId}:`, orderError?.message);
        return json({ error: "Failed to create order record." }, { status: 500, headers });
    }
    const orderId = orderData.id;

    // 2. Create Order Item record
    const orderItemInsert: OrderItemInsert = {
        order_id: orderId,
        product_variant_id: productVariantId,
        quantity: quantity,
        price_per_item_cents: pricePerItem,
    };

    const { error: orderItemError } = await supabaseAdmin
        .from('order_items')
        .insert(orderItemInsert);

    if (orderItemError) {
        console.error(`[Purchase Action] Error creating order item for order ${orderId}:`, orderItemError.message);
        // Attempt to clean up the order record
        await supabaseAdmin.from('orders').delete().eq('id', orderId);
        return json({ error: "Failed to create order item record." }, { status: 500, headers });
    }

    // --- Create Initial Payment Record ---
    // This function calculates tax and the final total_amount
    const { data: paymentData, error: paymentError } = await createInitialPaymentRecord(
        familyId,
        subtotalAmount,
        [], // No student IDs needed for store purchase linking via payment_students
        'store_purchase', // Payment type
        orderId // Pass the order ID to link
    );

    if (paymentError || !paymentData?.id) {
        console.error(`[Purchase Action] Error creating initial payment record for order ${orderId}:`, paymentError);
        // Attempt cleanup
        await supabaseAdmin.from('order_items').delete().eq('order_id', orderId);
        await supabaseAdmin.from('orders').delete().eq('id', orderId);
        return json({ error: `Failed to initiate payment: ${paymentError || 'Unknown error'}` }, { status: 500, headers });
    }

    // --- Redirect to Payment Page ---
    return redirect(`/pay/${paymentData.id}`, { headers });
}


// --- Component ---
export default function PurchaseGiPage() {
    const { student, products, applicableTaxes } = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const params = useParams(); // Get studentId from params for the form action URL

    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

    const isSubmitting = navigation.state === "submitting";

    // Calculate recommended size
    const recommendedUniformSize = getRecommendedUniformSize(student.t_shirt_size);

    // Find the default variant based on student's t-shirt size across all products
    const defaultVariant = useMemo(() => {
        if (!student.t_shirt_size || !products || products.length === 0) return null;
        for (const product of products) {
            const foundVariant = product.product_variants.find(v => v.size === student.t_shirt_size);
            if (foundVariant) {
                return foundVariant;
            }
        }
        return null;
    }, [student.t_shirt_size, products]);

    // Set default selection on initial load
    useState(() => {
        if (defaultVariant) {
            setSelectedVariantId(defaultVariant.id);
        }
    });

    // Find the selected variant across all products
    const selectedVariant = useMemo(() => {
        if (!selectedVariantId || !products || products.length === 0) return null;
        for (const product of products) {
            // Need to include product data with the variant for context
            const foundVariant = product.product_variants.find(v => v.id === selectedVariantId);
            if (foundVariant) {
                // Return variant data along with its parent product ID/name for context if needed elsewhere
                return { ...foundVariant, products: { id: product.id, name: product.name } };
            }
        }
        return null;
    }, [selectedVariantId, products]);

    const subtotal = selectedVariant ? selectedVariant.price_in_cents : 0;

    const { totalAmount } = useMemo(() => { // Removed unused totalTax
        let calculatedTax = 0;
        if (subtotal > 0 && applicableTaxes.length > 0) {
            calculatedTax = applicableTaxes.reduce((acc, tax) => {
                return acc + Math.round(subtotal * tax.rate);
            }, 0);
        }
        return {
            totalTax: calculatedTax,
            totalAmount: subtotal + calculatedTax,
        };
    }, [subtotal, applicableTaxes]);

    // Removed: const product = products?.[0]; - We will map over products now.

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <AppBreadcrumb 
                items={breadcrumbPatterns.familyStorePurchase(student.first_name, student.last_name, student.id)} 
            />

            <h1 className="text-3xl font-bold mb-2 mt-6">Purchase Uniform</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
                Select the correct size Gi for {student.first_name} {student.last_name}.
                The size defaults to their registered T-shirt size ({student.t_shirt_size || 'N/A'}). {/* Use JS string */}
            </p>

            {actionData?.error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        {actionData.error}
                        {actionData.fieldErrors?.productVariantId && <p>{actionData.fieldErrors.productVariantId}</p>}
                    </AlertDescription>
                </Alert>
            )}

            {products.length === 0 && ( // Check if the products array is empty
                 <Alert variant="default" className="mb-4">
                    <AlertTitle>No Products Available</AlertTitle>
                    <AlertDescription>
                        There are currently no items available for purchase online at this time. Please contact administration.
                    </AlertDescription>
                </Alert>
            )}

            {/* Render form only if there are products */}
            {products.length > 0 && (
                 <Form method="post" action={`/family/store/purchase/${params.studentId}`}>
                    {/* Map over each product */}
                    {products.map((product) => (
                        <Card key={product.id} className="mb-6"> {/* Added margin-bottom */}
                            <CardHeader>
                                <CardTitle>{product.name}</CardTitle>
                                {product.description && <CardDescription>{product.description}</CardDescription>}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Optional Image */}
                                {product.image_url && (
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-auto max-w-xs mx-auto rounded-md mb-4 border" // Added border
                                        onError={(e) => { // Basic error handling to hide broken image links
                                            e.currentTarget.style.display = 'none';
                                            console.warn(`Failed to load image: ${product.image_url}`);
                                        }}
                                    />
                                )}

                                <RadioGroup
                                    name="productVariantId" // Same name links all radio groups
                                    value={selectedVariantId ?? undefined}
                                    onValueChange={setSelectedVariantId}
                                    aria-label={`Select ${product.name} Size`} // More specific label
                                >
                                    <Label className="text-base font-medium">Select Size:</Label>
                                    {/* Display Recommendation */}
                                    {recommendedUniformSize && (
                                        <Alert variant="default" className="mt-2 mb-3 text-sm bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700">
                                            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            <AlertTitle className="text-blue-800 dark:text-blue-300">Recommendation</AlertTitle>
                                            <AlertDescription className="text-blue-700 dark:text-blue-300">
                                                Based on {student.first_name}&apos;s T-shirt size ({student.t_shirt_size}), we recommend Uniform Size:
                                                <span className="font-semibold"> {recommendedUniformSize}</span>.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                                        {product.product_variants
                                            .sort((a, b) => a.size.localeCompare(b.size)) // Sort sizes
                                            .map((variant) => {
                                                const isRecommended = recommendedUniformSize && variant.size === recommendedUniformSize;
                                                const isDefaultMatch = student.t_shirt_size && variant.size === student.t_shirt_size; // Original check

                                                return (
                                            <Label
                                                key={variant.id}
                                                htmlFor={variant.id}
                                                className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${selectedVariantId === variant.id ? 'border-primary' : ''}`}
                                            >
                                                <RadioGroupItem value={variant.id} id={variant.id} className="sr-only" />
                                                <span className="font-semibold">{variant.size}</span>
                                                <span className="text-sm text-muted-foreground">{formatCurrency(variant.price_in_cents)}</span>
                                                {/* Highlight Recommended Size */}
                                                {isRecommended && (
                                                    <span className="text-xs font-medium text-white bg-blue-600 px-1.5 py-0.5 rounded-full mt-1">Recommended</span>
                                                )}
                                                {/* Show T-Shirt Match (if different from recommendation) */}
                                                {isDefaultMatch && !isRecommended && (
                                                     <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">(Matches T-Shirt Size)</span>
                                                )}
                                            </Label>
                                        ); // Close return statement
                                        })}
                                    </div>
                                </RadioGroup>
                                {actionData?.fieldErrors?.productVariantId && selectedVariant?.products?.id === product.id && (
                                    // Show error only under the relevant product
                                    <p className="text-red-500 text-sm">{actionData.fieldErrors.productVariantId}</p>
                                )}
                            </CardContent>
                            {/* Footer might be moved outside the map if totals are global */}
                        </Card>
                    ))}

                    {/* Moved Totals and Submit Button outside the product map */}
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                {applicableTaxes.map(tax => (
                                    <div key={tax.name} className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>{tax.name} ({ (tax.rate * 100).toFixed(0) }%):</span>
                                        <span>{formatCurrency(Math.round(subtotal * tax.rate))}</span>
                                    </div>
                                ))}
                                <Separator className="my-1" />
                                <div className="flex justify-between font-semibold text-base">
                                    <span>Total:</span>
                                    <span>{formatCurrency(totalAmount)}</span>
                                </div>
                            </div>
                        </CardContent>
                         <CardFooter>
                            <Button type="submit" className="w-full" disabled={isSubmitting || !selectedVariantId}>
                                {isSubmitting ? 'Processing...' : 'Proceed to Payment'}
                            </Button>
                        </CardFooter>
                    </Card>
                </Form>
            )}
        </div>
    );
}
