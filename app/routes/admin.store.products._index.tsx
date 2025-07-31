import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, ClientLoaderFunctionArgs } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { formatDate } from "~/utils/misc"; // Import formatDate utility
import type { Tables } from "~/types/database.types"; // Removed unused Database import
import { PlusCircle, Edit, Package } from "lucide-react"; // Import icons
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

type ProductRow = Tables<'products'>;

type LoaderData = {
    products: ProductRow[];
};

export async function loader({ request }: LoaderFunctionArgs) {
    // Admin check happens in the parent _admin layout loader
    const { supabaseServer, response } = getSupabaseServerClient(request);

    const { data: products, error } = await supabaseServer
        .from('products')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error("Error fetching products:", error.message);
        throw new Response("Could not load products.", { status: 500 });
    }

    return json({ products: products || [] }, { headers: response.headers });
}

export async function clientLoader({ serverLoader }: ClientLoaderFunctionArgs) {
    return serverLoader();
}

export default function AdminProductListPage() {
    const { products } = useLoaderData<LoaderData>();

    return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            <AppBreadcrumb 
                items={breadcrumbPatterns.adminStoreProducts()}
            />
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Manage Products</h1>
                <Button asChild>
                    <Link to="new">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
                    </Link>
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No products found. Create your first product to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            products.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell className="max-w-xs truncate">
                                        {product.description || "No description"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={product.is_active ? "default" : "secondary"}>
                                            {product.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatDate(product.created_at)}</TableCell>
                                    <TableCell>{formatDate(product.updated_at)}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button asChild variant="outline" size="sm">
                                            <Link to={`${product.id}/variants`}>
                                                <Package className="mr-1 h-3 w-3" />
                                                Variants
                                            </Link>
                                        </Button>
                                        <Button asChild variant="outline" size="sm">
                                            <Link to={`${product.id}/edit`}>
                                                <Edit className="mr-1 h-3 w-3" />
                                                Edit
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
