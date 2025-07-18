import { json, LoaderFunctionArgs, MetaFunction, redirect } from "@remix-run/node";
import { Link, useLoaderData, useRouteError } from "@remix-run/react"; // Added useRouteError
import { createServerClient } from "@supabase/auth-helpers-remix";
import { Database, Tables } from "~/types/database.types";
// Removed Card components, using div with classes instead
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { formatCurrency, formatDate } from "~/utils/misc";
import { Badge } from "~/components/ui/badge";
// Removed Button import as it's not used
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

type OrderRow = Tables<'orders'>;
type OrderItemRow = Tables<'order_items'>;
type ProductVariantRow = Tables<'product_variants'>;
type ProductRow = Tables<'products'>;

// Define the structure for order items with product details
type OrderItemWithDetails = OrderItemRow & {
    product_variants: (ProductVariantRow & {
        products: Pick<ProductRow, 'name'> | null;
    }) | null;
};

type StudentRow = Tables<'students'>;

// Define the structure for orders with items and product details
type FamilyOrder = OrderRow & {
    order_items: OrderItemWithDetails[];
    students: Pick<StudentRow, 'first_name' | 'last_name'> | null; // Add student details
};

export const meta: MetaFunction = () => {
    return [
        { title: "Order History | Ponto Studio" },
        { name: "description", content: "View your past orders." },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const response = new Response();
    const supabase = createServerClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        { request, response }
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        return redirect("/login?message=Please log in to view your order history.");
    }

    // Fetch family ID associated with the user
    const { data: profile, error: profileError } = await supabase
        .from('profiles') // Corrected table name
        .select('family_id')
        .eq('id', session.user.id) // Corrected column name to match 'profiles' table schema
        .maybeSingle();

    if (profileError || !profile || !profile.family_id) {
        console.error("Error fetching user profile or family ID:", profileError?.message);
        // Redirect or show error? Redirecting to family dashboard for now.
        return redirect("/family?error=Could not find associated family information.");
    }

    const familyId = profile.family_id;

    // Fetch orders for the family, including items and product details
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
            *,
            students ( first_name, last_name ),
            order_items (
                *,
                product_variants (
                    *,
                    products ( name )
                )
            )
        `)
        .eq('family_id', familyId)
        .order('created_at', { ascending: false });

    if (ordersError) {
        console.error("Error fetching family orders:", ordersError.message);
        throw new Error("Failed to load order history."); // Let Remix handle the error boundary
    }

    // Ensure orders is always an array
    const familyOrders: FamilyOrder[] = orders || [];

    return json({ orders: familyOrders }, { headers: response.headers });
}


export default function FamilyOrders() {
    const { orders } = useLoaderData<typeof loader>();

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.familyOrders()} />

            <h1 className="text-3xl font-bold mb-6">Order History</h1>

            {/* Replaced Card with styled div */}
            <div className="overflow-x-auto bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                {orders.length === 0 ? (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No Orders Found</AlertTitle>
                            <AlertDescription>
                                You haven&apos;t placed any orders yet. Visit the <Link to="/family/store" className="font-medium text-primary underline underline-offset-4">Store</Link> to make a purchase.
                            </AlertDescription>
                    </Alert>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order Date</TableHead>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Student</TableHead> {/* Added Student Header */}
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead>Items</TableHead>
                                {/* <TableHead className="text-right">Actions</TableHead> */}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="whitespace-nowrap">{formatDate(order.created_at, { type: 'datetime' })}</TableCell>
                                    <TableCell className="whitespace-nowrap font-mono text-xs">{order.id.substring(0, 8)}...</TableCell>
                                    <TableCell className="whitespace-nowrap"> {/* Added Student Cell */}
                                        {order.students ? `${order.students.first_name} ${order.students.last_name}` : 'N/A'}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {/* Use Badge component for status */}
                                        <Badge variant={
                                            order.status === 'completed' ? 'default' : // Use 'default' for success
                                            order.status === 'paid_pending_pickup' ? 'secondary' : // Use 'secondary' for pending pickup
                                            order.status === 'cancelled' ? 'destructive' :
                                            'secondary' // Default/pending_payment
                                        }>
                                            {order.status.replace(/_/g, ' ').replace('paid pending', 'pending')}
                                        </Badge>
                                    </TableCell>
                                    {/* Pass raw cents to formatCurrency, assuming it handles the division */}
                                    <TableCell className="whitespace-nowrap text-right">{formatCurrency(order.total_amount_cents)}</TableCell>
                                    <TableCell className="whitespace-normal"> {/* Allow wrapping */}
                                        <ul className="list-disc list-inside">
                                            {order.order_items.map(item => (
                                                <li key={item.id}>
                                                        {item.quantity} x {item.product_variants?.products?.name ?? 'Unknown Product'}
                                                        {item.product_variants?.size && ` (${item.product_variants.size})`}
                                                </li>
                                            ))}
                                        </ul>
                                    </TableCell>
                                    {/* Optional: Add actions like view details or reorder */}
                                    {/* <TableCell className="text-right">
                                        <Button variant="outline" size="sm" asChild>
                                            <Link to={`/family/orders/${order.id}`}>View</Link>
                                        </Button>
                                    </TableCell> */}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}

// Basic Error Boundary for this route
export function ErrorBoundary() {
    const error = useRouteError() as Error; // Use this hook in Remix v2+

    // Basic error logging
    console.error("Error Boundary caught error in Family Orders:", error);

    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb items={breadcrumbPatterns.familyOrders()} />
            
            <h1 className="text-3xl font-bold mb-6 text-red-600 dark:text-red-400">Error Loading Order History</h1>
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    There was a problem loading your order history. Please try again later or contact support if the issue persists.
                    {/* Optionally display a simplified error message in development */}
                    {process.env.NODE_ENV === 'development' && (
                        <pre className="mt-2 whitespace-pre-wrap text-xs">
                            {error?.message ?? 'Unknown error'}
                            {error?.stack ? `\n${error.stack}` : ''}
                        </pre>
                    )}
                </AlertDescription>
            </Alert>
        </div>
    );
}
