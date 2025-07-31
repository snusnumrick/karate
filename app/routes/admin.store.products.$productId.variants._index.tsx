import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useParams } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { formatCurrency, formatDate } from "~/utils/misc"; // Import formatDate utility
import type { Tables } from "~/types/database.types";
import { PlusCircle, Edit } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

type ProductRow = Tables<'products'>;
type ProductVariantRow = Tables<'product_variants'>;

type LoaderData = {
    product: Pick<ProductRow, 'id' | 'name'>; // Only need product ID and name for breadcrumbs/title
    variants: ProductVariantRow[];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
    const productId = params.productId;
    if (!productId) {
        throw new Response("Product ID is required", { status: 400 });
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
        console.error(`Error fetching product name for variants page (ID: ${productId}):`, productError?.message);
        throw new Response("Product not found", { status: 404 });
    }

    // Fetch variants for this product
    const { data: variants, error: variantsError } = await supabaseServer
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('size', { ascending: true }); // Order by size

    if (variantsError) {
        console.error(`Error fetching variants for product ${productId}:`, variantsError.message);
        throw new Response("Could not load product variants.", { status: 500 });
    }

    return json({ product: productData, variants: variants || [] }, { headers: response.headers });
}

export default function AdminProductVariantListPage() {
    const { product, variants } = useLoaderData<LoaderData>();
    const params = useParams(); // Get productId for links

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.adminStoreProductVariants(product.name, params.productId!)} className="mb-6" />
            
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Manage Variants for: <span className="text-green-600 dark:text-green-400">{product.name}</span></h1>
                <Button asChild>
                    <Link to="new">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Variant
                    </Link>
                </Button>
            </div>

            {variants.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No variants found for this product. Add the first variant!</p>
            ) : (
                <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Size</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-center">Stock</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-center">Created</TableHead>
                                <TableHead className="text-center">Updated</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {variants.map((variant) => (
                                <TableRow key={variant.id}>
                                    <TableCell className="font-medium">{variant.size}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(variant.price_in_cents)}</TableCell>
                                    <TableCell className="text-center">{variant.stock_quantity}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={variant.is_active ? "default" : "secondary"}>
                                            {variant.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center text-sm text-gray-500 dark:text-gray-400">
                                        {formatDate(variant.created_at, { formatString: 'PPp' })}
                                    </TableCell>
                                     <TableCell className="text-center text-sm text-gray-500 dark:text-gray-400">
                                        {formatDate(variant.updated_at, { formatString: 'PPp' })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="outline" size="sm">
                                            <Link to={`${variant.id}/edit`}>
                                                <Edit className="mr-1 h-3 w-3" /> Edit
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
