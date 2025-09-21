import { type ActionFunctionArgs, type LoaderFunctionArgs, json, TypedResponse } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { getSupabaseServerClient, getSupabaseAdminClient } from "~/utils/supabase.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
// Removed unused Label import
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import type { Tables } from "~/types/database.types";
import { Save } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

type ProductRow = Tables<'products'>;
type ProductVariantRow = Tables<'product_variants'>;

// Type for variants joined with product name
type VariantWithProduct = ProductVariantRow & {
    products: Pick<ProductRow, 'name'> | null;
};

type LoaderData = {
    variants: VariantWithProduct[];
};

type ActionData = {
    success?: boolean;
    message?: string;
    error?: string;
    fieldErrors?: { [key: string]: string }; // e.g., { 'stock-variantId': 'Invalid number' }
};

// Loader function to fetch all active variants with product names
export async function loader({ request }: LoaderFunctionArgs) {
    // Admin check happens in the parent _admin layout loader
    const { supabaseServer, response } = getSupabaseServerClient(request);

    const { data: variants, error } = await supabaseServer
        .from('product_variants')
        .select(`
            *,
            products ( name )
        `)
        .eq('is_active', true) // Only show active variants
        .order('name', { foreignTable: 'products', ascending: true }) // Order by product name
        .order('size', { ascending: true }); // Then by size

    if (error) {
        console.error("Error fetching product variants for inventory:", error.message);
        throw new Response("Could not load inventory.", { status: 500 });
    }

    return json({ variants: (variants as VariantWithProduct[]) || [] }, { headers: response.headers });
}

// Action function to handle bulk stock updates
export async function action({ request }: ActionFunctionArgs): Promise<TypedResponse<ActionData>> {
    // Admin check happens in the parent _admin layout loader
    const { response } = getSupabaseServerClient(request); // Only need response for headers
    const headers = response.headers;

    await csrf.validate(request);
    const formData = await request.formData();
    const updates: Array<{ id: string; stock_quantity: number }> = [];
    const fieldErrors: { [key: string]: string } = {};

    // Iterate over form data to find stock updates
    for (const [key, value] of formData.entries()) {
        if (key.startsWith('stock-')) {
            const variantId = key.substring(6); // Extract variant ID
            const stockString = value as string;
            const stockInt = parseInt(stockString, 10);

            if (isNaN(stockInt) || stockInt < 0 || !Number.isInteger(stockInt)) {
                fieldErrors[key] = "Must be a valid non-negative whole number.";
            } else {
                updates.push({ id: variantId, stock_quantity: stockInt });
            }
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return json({ error: "Please fix the errors below.", fieldErrors }, { status: 400, headers });
    }

    if (updates.length === 0) {
        return json({ message: "No stock quantities were submitted for update." }, { headers }); // Or success: true?
    }

    // Use admin client for updates
    const supabaseAdmin = getSupabaseAdminClient();
    let updateErrors = 0;

    // Perform updates in a loop (consider transaction or bulk update if performance becomes an issue)
    for (const update of updates) {
        const { error: updateError } = await supabaseAdmin
            .from('product_variants')
            .update({
                stock_quantity: update.stock_quantity,
                updated_at: new Date().toISOString(),
            })
            .eq('id', update.id);

        if (updateError) {
            console.error(`Error updating stock for variant ${update.id}:`, updateError.message);
            updateErrors++;
            // Collect specific errors? For now, just count them.
        }
    }

    if (updateErrors > 0) {
        return json({ error: `Failed to update stock for ${updateErrors} variant(s). Please check logs.` }, { status: 500, headers });
    }

    return json({ success: true, message: `Successfully updated stock for ${updates.length} variant(s).` }, { headers });
}


// Component for the Inventory Management page
export default function AdminInventoryPage() {
    const { variants } = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="space-y-6">
            <AppBreadcrumb items={breadcrumbPatterns.adminStoreInventory()} className="mb-6" />
            <h1 className="text-2xl font-bold">Inventory Management</h1>
            <p className="text-gray-600 dark:text-gray-400">View and update stock levels for all active product variants.</p>

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
             {actionData?.error && actionData.fieldErrors && (
                 <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Validation Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                    {/* Optionally list specific field errors */}
                 </Alert>
             )}


            {variants.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-10">No active product variants found.</p>
            ) : (
                <Form method="post">
                    <AuthenticityTokenInput />
                    <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead className="w-32 text-center">Current Stock</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {variants.map((variant) => (
                                    <TableRow key={variant.id}>
                                        <TableCell className="font-medium">
                                            {variant.products?.name || 'Unknown Product'}
                                            <Link to={`/admin/store/products/${variant.product_id}/edit`} className="text-xs text-blue-500 hover:underline ml-2">(Edit Product)</Link>
                                        </TableCell>
                                        <TableCell>
                                            {variant.size}
                                             <Link to={`/admin/store/products/${variant.product_id}/variants/${variant.id}/edit`} className="text-xs text-blue-500 hover:underline ml-2">(Edit Variant)</Link>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Input
                                                type="number"
                                                name={`stock-${variant.id}`} // Name includes variant ID
                                                defaultValue={variant.stock_quantity}
                                                min="0"
                                                step="1"
                                                required
                                                className="input-custom-styles w-24 mx-auto text-center"
                                                aria-label={`Stock for ${variant.products?.name} - ${variant.size}`}
                                                aria-invalid={!!actionData?.fieldErrors?.[`stock-${variant.id}`]}
                                                aria-describedby={`stock-error-${variant.id}`}
                                            />
                                             {actionData?.fieldErrors?.[`stock-${variant.id}`] && (
                                                <p id={`stock-error-${variant.id}`} className="text-xs text-destructive mt-1">{actionData.fieldErrors[`stock-${variant.id}`]}</p>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex justify-end mt-6">
                        <Button type="submit" disabled={isSubmitting}>
                            <Save className="mr-2 h-4 w-4" />
                            {isSubmitting ? "Saving Inventory..." : "Save All Changes"}
                        </Button>
                    </div>
                </Form>
            )}
        </div>
    );
}
