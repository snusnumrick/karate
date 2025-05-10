import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { format, parseISO } from 'date-fns';
import type { Tables } from "~/types/database.types"; // Removed unused Database import
import { PlusCircle, Edit } from "lucide-react"; // Import icons

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

export default function AdminProductListPage() {
    const { products } = useLoaderData<LoaderData>();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Manage Products</h1>
                <Button asChild>
                    <Link to="new">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
                    </Link>
                </Button>
            </div>

            {products.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No products found. Add your first product!</p>
            ) : (
                <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-center">Created</TableHead>
                                <TableHead className="text-center">Updated</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">
                                        {product.description || '-'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={product.is_active ? "default" : "secondary"}>
                                            {product.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center text-sm text-gray-500 dark:text-gray-400">
                                        {format(parseISO(product.created_at), 'PPp')}
                                    </TableCell>
                                     <TableCell className="text-center text-sm text-gray-500 dark:text-gray-400">
                                        {format(parseISO(product.updated_at), 'PPp')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="outline" size="sm">
                                            <Link to={`${product.id}/edit`}>
                                                <Edit className="mr-1 h-3 w-3" /> Edit
                                            </Link>
                                        </Button>
                                        {/* Add View Variants button later */}
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
