import { type ActionFunctionArgs, type LoaderFunctionArgs, json, redirect, TypedResponse } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation, useParams } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import type { Tables, TablesInsert } from "~/types/supabase"; // Removed unused Database
import { ArrowLeft } from "lucide-react";
// import { formatCurrency } from "~/utils/misc"; // Removed unused formatCurrency import

type ProductRow = Tables<'products'>;
type ProductVariantInsert = TablesInsert<'product_variants'>;

type LoaderData = {
    product: Pick<ProductRow, 'id' | 'name'>;
};

type ActionData = {
    success?: boolean;
    error?: string;
    fieldErrors?: { [key: string]: string };
};

// Loader to get product context
export async function loader({ request, params }: LoaderFunctionArgs) {
    const productId = params.productId;
    if (!productId) {
        throw new Response("Product ID is required", { status: 400 });
    }
    // Admin check happens in the parent _admin layout loader
    const { supabaseServer, response } = getSupabaseServerClient(request);

    const { data: productData, error: productError } = await supabaseServer
        .from('products')
        .select('id, name')
        .eq('id', productId)
        .single();

    if (productError || !productData) {
        console.error(`Error fetching product name for new variant page (ID: ${productId}):`, productError?.message);
        throw new Response("Product not found", { status: 404 });
    }

    return json({ product: productData }, { headers: response.headers });
}


// Action function to handle form submission
export async function action({ request, params }: ActionFunctionArgs): Promise<TypedResponse<ActionData | never>> {
    const productId = params.productId;
    if (!productId) {
        return json({ error: "Product ID is missing." }, { status: 400 });
    }
    // Admin check happens in the parent _admin layout loader
    const { supabaseServer, response } = getSupabaseServerClient(request);
    const headers = response.headers;

    const formData = await request.formData();
    const size = formData.get('size') as string;
    const priceString = formData.get('price') as string; // Price entered as dollars
    const stockQuantityString = formData.get('stock_quantity') as string;
    const isActive = formData.get('is_active') === 'on';

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
            priceInCents = Math.round(priceFloat * 100); // Convert to cents
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

    // --- Database Insert ---
    const insertData: ProductVariantInsert = {
        product_id: productId,
        size,
        price_in_cents: priceInCents!, // Assert non-null as validated above
        stock_quantity: stockQuantity!, // Assert non-null as validated above
        is_active: isActive,
    };

    const { error: insertError } = await supabaseServer
        .from('product_variants')
        .insert(insertData);

    if (insertError) {
        console.error("Error inserting product variant:", insertError.message);
        // Handle potential unique constraint violation (duplicate size for this product)
        if (insertError.code === '23505' && insertError.message.includes('unique_product_size')) {
             return json({ error: "A variant with this size already exists for this product.", fieldErrors: { size: "Size must be unique for this product." } }, { status: 409, headers });
        }
        return json({ error: `Failed to add variant: ${insertError.message}` }, { status: 500, headers });
    }

    // Redirect back to the variant list page for this product
    return redirect(`/admin/store/products/${productId}/variants`, { headers });
}


// Component for the Add Variant page
export default function AddProductVariantPage() {
    const { product } = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const params = useParams();
    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <Link to={`/admin/store/products/${params.productId}/variants`} className="inline-flex items-center text-sm text-blue-600 hover:underline">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to Variants for {product.name}
            </Link>
            <h1 className="text-2xl font-bold">Add New Variant</h1>
            <p className="text-gray-600 dark:text-gray-400">Add a size, price, and stock level for the product: <span className="font-semibold">{product.name}</span>.</p>

            {actionData?.error && !actionData.fieldErrors && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
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
                    <Switch id="is_active" name="is_active" defaultChecked={true} />
                    <Label htmlFor="is_active">Active (Available for purchase)</Label>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Adding Variant..." : "Add Variant"}
                    </Button>
                </div>
            </Form>
        </div>
    );
}
