import { type ActionFunctionArgs, type LoaderFunctionArgs, json, redirect, TypedResponse } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation, useParams } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"; // Removed duplicate line above
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "~/components/ui/alert-dialog"; // Added AlertDialog components
import type { Database, Tables, TablesUpdate } from "~/types/supabase";
import { ArrowLeft, Trash2 } from "lucide-react"; // Added Trash2
// import { formatCurrency } from "~/utils/misc"; // Removed unused formatCurrency import
import { createClient } from "@supabase/supabase-js"; // Import admin client

type ProductRow = Tables<'products'>;
type ProductVariantRow = Tables<'product_variants'>;
type ProductVariantUpdate = TablesUpdate<'product_variants'>;

type LoaderData = {
    product: Pick<ProductRow, 'id' | 'name'>;
    variant: ProductVariantRow;
};

type ActionData = {
    success?: boolean;
    message?: string;
    error?: string;
    fieldErrors?: { [key: string]: string };
};

// Loader function to fetch product and variant data
export async function loader({ request, params }: LoaderFunctionArgs) {
    const productId = params.productId;
    const variantId = params.variantId;
    if (!productId || !variantId) {
        throw new Response("Product ID and Variant ID are required", { status: 400 });
    }
    // Admin check happens in the parent _admin layout loader
    const { supabaseServer, response } = getSupabaseServerClient(request);

    // Fetch product name for context
    const { data: productData, error: productError } = await supabaseServer
        .from('products')
        .select('id, name')
        .eq('id', productId)
        .single();

    if (productError || !productData) {
        console.error(`Error fetching product name for edit variant page (ID: ${productId}):`, productError?.message);
        throw new Response("Product not found", { status: 404 });
    }

    // Fetch the specific variant
    const { data: variantData, error: variantError } = await supabaseServer
        .from('product_variants')
        .select('*')
        .eq('id', variantId)
        .eq('product_id', productId) // Ensure variant belongs to the product
        .single();

    if (variantError || !variantData) {
        console.error(`Error fetching variant ${variantId} for product ${productId}:`, variantError?.message);
        throw new Response("Product variant not found", { status: 404 });
    }

    return json({ product: productData, variant: variantData }, { headers: response.headers });
}

// Action function to handle form submission
export async function action({ request, params }: ActionFunctionArgs): Promise<TypedResponse<ActionData | never>> {
    const productId = params.productId;
    const variantId = params.variantId;
    if (!productId || !variantId) {
        return json({ error: "Product ID and Variant ID are missing." }, { status: 400 });
    }
    // Admin check happens in the parent _admin layout loader
    const { supabaseServer, response } = getSupabaseServerClient(request);
    const headers = response.headers;

    const formData = await request.formData();
    const size = formData.get('size') as string;
    const priceString = formData.get('price') as string;
    const stockQuantityString = formData.get('stock_quantity') as string;
    const isActive = formData.get('is_active') === 'on';
    const intent = formData.get('intent') as string;

    // --- Validation ---
    const fieldErrors: { [key: string]: string } = {};
    if (!size) fieldErrors.size = "Size is required.";
    if (!priceString) fieldErrors.price = "Price is required.";
    if (!stockQuantityString) fieldErrors.stock_quantity = "Stock quantity is required.";

    let priceInCents: number | null = null;
    if (priceString) {
        const priceFloat = parseFloat(priceString);
        if (isNaN(priceFloat) || priceFloat < 0) {
            fieldErrors.price = "Price must be a valid positive number.";
        } else {
            priceInCents = Math.round(priceFloat * 100);
        }
    }

    let stockQuantity: number | null = null;
    if (stockQuantityString) {
        const stockInt = parseInt(stockQuantityString, 10);
        if (isNaN(stockInt) || stockInt < 0 || !Number.isInteger(stockInt)) {
            fieldErrors.stock_quantity = "Stock quantity must be a valid non-negative whole number.";
        } else {
            stockQuantity = stockInt;
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return json({ error: "Please fix the errors below.", fieldErrors }, { status: 400, headers });
    }

    // --- Database Update ---
    const updateData: ProductVariantUpdate = {
        size,
        price_in_cents: priceInCents!,
        stock_quantity: stockQuantity!,
        is_active: isActive,
        updated_at: new Date().toISOString(), // Manually update timestamp
    };

    const { error: updateError } = await supabaseServer
        .from('product_variants')
        .update(updateData)
        .eq('id', variantId)
        .eq('product_id', productId); // Ensure we only update the variant for the correct product

    if (updateError) {
        console.error(`Error updating variant ${variantId}:`, updateError.message);
        // Handle potential unique constraint violation (duplicate size for this product)
        if (updateError.code === '23505' && updateError.message.includes('unique_product_size')) {
             return json({ error: "A variant with this size already exists for this product.", fieldErrors: { size: "Size must be unique for this product." } }, { status: 409, headers });
        }
        return json({ error: `Failed to update variant: ${updateError.message}` }, { status: 500, headers });
    }

    // Return success message - stay on the edit page
    // --- Handle Delete Intent ---
    if (intent === 'delete') {
        console.log(`[Action/DeleteVariant] Attempting delete for variant ID: ${variantId}`);
        // Use admin client for deletion attempt
        const supabaseAdmin = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

        const { error: deleteError } = await supabaseAdmin
            .from('product_variants')
            .delete()
            .eq('id', variantId);

        if (deleteError) {
            console.error(`[Action/DeleteVariant] Error deleting variant ${variantId}:`, deleteError.message);
            // Check for foreign key violation (means it's in an order)
            if (deleteError.code === '23503') { // Foreign key violation
                 return json({ error: "Cannot delete variant: It has been included in past orders." }, { status: 409, headers }); // 409 Conflict
            }
            return json({ error: `Failed to delete variant: ${deleteError.message}` }, { status: 500, headers });
        }

        console.log(`[Action/DeleteVariant] Successfully deleted variant ${variantId}. Redirecting...`);
        // Redirect back to the variant list for the product
        return redirect(`/admin/store/products/${productId}/variants`, { headers });
    }
    // --- End Handle Delete Intent ---


    // --- Handle Edit Intent ---
    if (intent === 'edit') { // Explicitly check for edit intent
        if (!size) fieldErrors.size = "Size is required.";
        if (!priceString) fieldErrors.price = "Price is required.";
        if (!stockQuantityString) fieldErrors.stock_quantity = "Stock quantity is required.";

        let priceInCents: number | null = null;
        if (priceString) {
            const priceFloat = parseFloat(priceString);
            if (isNaN(priceFloat) || priceFloat < 0) {
                fieldErrors.price = "Price must be a valid positive number.";
            } else {
                priceInCents = Math.round(priceFloat * 100);
            }
        }

        let stockQuantity: number | null = null;
        if (stockQuantityString) {
            const stockInt = parseInt(stockQuantityString, 10);
            if (isNaN(stockInt) || stockInt < 0 || !Number.isInteger(stockInt)) {
                fieldErrors.stock_quantity = "Stock quantity must be a valid non-negative whole number.";
            } else {
                stockQuantity = stockInt;
            }
        }

        if (Object.keys(fieldErrors).length > 0) {
            return json({ error: "Please fix the errors below.", fieldErrors }, { status: 400, headers });
        }

        // --- Database Update ---
        const updateData: ProductVariantUpdate = {
            size,
            price_in_cents: priceInCents!,
            stock_quantity: stockQuantity!,
            is_active: isActive,
            updated_at: new Date().toISOString(), // Manually update timestamp
        };

        const { error: updateError } = await supabaseServer // Can use standard server client here
            .from('product_variants')
            .update(updateData)
            .eq('id', variantId)
            .eq('product_id', productId); // Ensure we only update the variant for the correct product

        if (updateError) {
            console.error(`Error updating variant ${variantId}:`, updateError.message);
            // Handle potential unique constraint violation (duplicate size for this product)
            if (updateError.code === '23505' && updateError.message.includes('unique_product_size')) {
                 return json({ error: "A variant with this size already exists for this product.", fieldErrors: { size: "Size must be unique for this product." } }, { status: 409, headers });
            }
            return json({ error: `Failed to update variant: ${updateError.message}` }, { status: 500, headers });
        }

        // Return success message - stay on the edit page
        return json({ success: true, message: "Variant updated successfully." }, { headers });
    }
    // --- End Handle Edit Intent ---

     // If intent is missing or invalid
    return json({ error: "Invalid form submission intent." }, { status: 400, headers });
}


// Component for the Edit Variant page
export default function EditProductVariantPage() {
    const { product, variant } = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const params = useParams();
    const isSubmitting = navigation.state === "submitting";
    const formIntent = navigation.formData?.get('intent'); // Get intent for loading state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // State for delete dialog

    // Use variant data from loader as default values
    const defaultValues = {
        size: variant.size,
        price: (variant.price_in_cents / 100).toFixed(2), // Convert cents to dollars string
        stock_quantity: variant.stock_quantity.toString(),
        is_active: variant.is_active,
    };

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <Link to={`/admin/store/products/${params.productId}/variants`} className="inline-flex items-center text-sm text-blue-600 hover:underline">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to Variants for {product.name}
            </Link>
            <h1 className="text-2xl font-bold">Edit Variant</h1>
             <p className="text-gray-600 dark:text-gray-400">Editing variant for product: <span className="font-semibold">{product.name}</span>.</p>

            {actionData?.error && !actionData.fieldErrors && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}
             {actionData?.success && actionData.message && (
                <Alert variant="default" className="mb-4 bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{actionData.message}</AlertDescription>
                </Alert>
            )}

            <Form method="post" className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                 {/* Size */}
                <div>
                    <Label htmlFor="size">Size <span className="text-destructive">*</span></Label>
                    <Input
                        id="size"
                        name="size"
                        required
                        defaultValue={defaultValues.size}
                        placeholder="e.g., YM, AS, Size 3, 120cm"
                        aria-invalid={!!actionData?.fieldErrors?.size}
                        aria-describedby="size-error"
                        className="input-custom-styles"
                    />
                    {actionData?.fieldErrors?.size && (
                        <p id="size-error" className="text-sm text-destructive mt-1">{actionData.fieldErrors.size}</p>
                    )}
                </div>

                {/* Price */}
                <div>
                    <Label htmlFor="price">Price (CAD) <span className="text-destructive">*</span></Label>
                    <Input
                        id="price"
                        name="price"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        defaultValue={defaultValues.price}
                        placeholder="e.g., 49.99"
                        aria-invalid={!!actionData?.fieldErrors?.price}
                        aria-describedby="price-error"
                        className="input-custom-styles"
                    />
                     {actionData?.fieldErrors?.price && (
                        <p id="price-error" className="text-sm text-destructive mt-1">{actionData.fieldErrors.price}</p>
                    )}
                </div>

                {/* Stock Quantity */}
                 <div>
                    <Label htmlFor="stock_quantity">Stock Quantity <span className="text-destructive">*</span></Label>
                    <Input
                        id="stock_quantity"
                        name="stock_quantity"
                        type="number"
                        step="1"
                        min="0"
                        required
                        defaultValue={defaultValues.stock_quantity}
                        placeholder="e.g., 10"
                        aria-invalid={!!actionData?.fieldErrors?.stock_quantity}
                        aria-describedby="stock-error"
                        className="input-custom-styles"
                    />
                     {actionData?.fieldErrors?.stock_quantity && (
                        <p id="stock-error" className="text-sm text-destructive mt-1">{actionData.fieldErrors.stock_quantity}</p>
                    )}
                </div>

                {/* Active Status */}
                <div className="flex items-center space-x-2 pt-2">
                    <Switch
                        id="is_active"
                        name="is_active"
                        defaultChecked={defaultValues.is_active}
                    />
                    <Label htmlFor="is_active">Active (Available for purchase)</Label>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Saving Changes..." : "Save Changes"}
                    </Button>
                </div>
            </Form>

            {/* Delete Section */}
            <div className="mt-8 pt-6 border-t border-destructive/50">
                <h2 className="text-xl font-semibold text-destructive mb-2">Delete Variant</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Permanently delete this variant ({variant.size}). This action cannot be undone.
                    <strong className="block text-destructive">Deletion will fail if this variant has been included in any past orders.</strong>
                </p>
                <Button
                    variant="destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={isSubmitting && formIntent === 'delete'}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isSubmitting && formIntent === 'delete' ? 'Deleting...' : 'Delete Variant'}
                </Button>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will attempt to permanently delete the variant
                            <span className="font-semibold"> {variant.size}</span> for product <span className="font-semibold">{product.name}</span>.
                            Deletion will fail if the variant is part of any existing orders.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting && formIntent === 'delete'}>Cancel</AlertDialogCancel>
                        {/* Use a Form inside the dialog for submission */}
                        <Form method="post" onSubmit={() => setIsDeleteDialogOpen(false)}>
                            <input type="hidden" name="intent" value="delete" />
                            <AlertDialogAction
                                type="submit" // Submit the form
                                disabled={isSubmitting && formIntent === 'delete'}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {isSubmitting && formIntent === 'delete' ? 'Deleting...' : 'Delete Variant'}
                            </AlertDialogAction>
                        </Form>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}
