import { json, LoaderFunctionArgs, MetaFunction, redirect } from "@remix-run/node";
import { Link, useLoaderData, useRouteError, useRouteLoaderData } from "@remix-run/react"; // Added useRouteError
import { createServerClient } from "@supabase/auth-helpers-remix";
import { Database, Tables } from "~/types/database.types";
// Removed Card components, using div with classes instead
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { formatCurrency, formatDateTime } from "~/utils/misc";
import { Badge } from "~/components/ui/badge";
// Removed Button import as it's not used
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import type { loader as layoutLoader } from "~/routes/_layout"; // Import layout loader type

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
    // const layoutData = useRouteLoaderData<typeof layoutLoader>("routes/_layout"); // Session not directly used here

    return (
        <div className="container mx-auto px-4 py-8">
             <div className="mb-6">
                <Link to="/family" className="text-blue-600 hover:underline dark:text-blue-400">
                    &larr; Back to Family Portal
                </Link>
            </div>

            <h1 className="text-3xl font-bold mb-6">Order History</h1>

            {/* Replaced Card with styled div */}
            <div className="overflow-x-auto bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                {orders.length === 0 ? (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No Orders Found</AlertTitle>
                            <AlertDescription>
                                You haven't placed any orders yet. Visit the <Link to="/family/store" className="font-medium text-primary underline underline-offset-4">Store</Link> to make a purchase.
                            </AlertDescription>
                    </Alert>
                ) : (
                    // Apply styling similar to payment history table
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order Date</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order ID</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Student</th> {/* Added Student Header */}
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Items</th>
                                {/* <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th> */}
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {orders.map((order) => (
                                <tr key={order.id}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatDateTime(order.created_at)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">{order.id.substring(0, 8)}...</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"> {/* Added Student Cell */}
                                        {order.students ? `${order.students.first_name} ${order.students.last_name}` : 'N/A'}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        {/* Use span with classes like payment history */}
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            order.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                            order.status === 'paid_pending_pickup' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                            order.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' // Default/pending
                                        }`}>
                                            {order.status.replace(/_/g, ' ').replace('paid pending', 'pending')}
                                        </span>
                                    </td>
                                    {/* Pass raw cents to formatCurrency, assuming it handles the division */}
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right">{formatCurrency(order.total_amount_cents)}</td>
                                    <td className="px-4 py-4 whitespace-normal text-sm text-gray-500 dark:text-gray-400"> {/* Allow wrapping */}
                                        <ul className="list-disc list-inside">
                                            {order.order_items.map(item => (
                                                <li key={item.id}>
                                                        {item.quantity} x {item.product_variants?.products?.name ?? 'Unknown Product'}
                                                        {item.product_variants?.size && ` (${item.product_variants.size})`}
                                                        {item.product_variants?.color && ` (${item.product_variants.color})`}
                                                </li>
                                            ))}
                                        </ul>
                                    </td>
                                    {/* Optional: Add actions like view details or reorder */}
                                    {/* <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">
                                        <Button variant="outline" size="sm" asChild>
                                            <Link to={`/family/orders/${order.id}`}>View</Link>
                                        </Button>
                                    </td> */}
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
            <div className="mb-6">
                <Link to="/family" className="text-blue-600 hover:underline dark:text-blue-400">
                    &larr; Back to Family Portal
                </Link>
            </div>
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
