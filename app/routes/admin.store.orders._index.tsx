import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
// Removed: import { getSupabaseServerClient } from "~/utils/supabase.server";
import { createClient } from '@supabase/supabase-js'; // Import createClient
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"; // For filtering
import { formatDateTime, formatCurrency } from "~/utils/misc";
import { Constants, type Tables, type Enums, type Database } from "~/types/supabase"; // Import Database type
import { Eye } from "lucide-react"; // Import icon

type OrderRow = Tables<'orders'>;
type FamilyRow = Tables<'families'>;
type OrderStatusEnum = Enums<'order_status'>;

// Combine Order with Family Name (fetching id and name separately)
type OrderWithFamily = OrderRow & {
    families: Pick<FamilyRow, 'id' | 'name'> | null; // Expect id and name again
};

type LoaderData = {
    orders: OrderWithFamily[];
    statuses: OrderStatusEnum[]; // Pass available statuses for filter dropdown
    currentStatusFilter: OrderStatusEnum | null;
};

// Define status colors for badges
const statusColors: Record<OrderStatusEnum, string> = {
    pending_payment: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    paid_pending_pickup: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export async function loader({ request }: LoaderFunctionArgs) {
    // Admin check happens in the parent _admin layout loader

    // Initialize Supabase client directly using service role key (like in admin/families)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin orders loader: Missing Supabase URL or Service Role Key env variables.");
        throw new Response("Server configuration error.", { status: 500 });
    }
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey); // Use Database type if needed

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status") as OrderStatusEnum | null;

    // Fetch orders WITH the relationship using the direct client
    let query = supabaseAdmin // Use supabaseAdmin client
        .from('orders')
        .select(`
            *,
            families ( id, name )
        `) // Restore relationship query
        .order('order_date', { ascending: false }); // Show newest first

    // Apply status filter if provided
    if (statusFilter) {
        query = query.eq('status', statusFilter);
    }

    const { data: orders, error } = await query;

    if (error) {
        console.error("Error fetching orders:", error.message);
        throw new Response("Could not load orders.", { status: 500 });
    }

    // No need for Step 2 (separate family fetch) anymore

    // Get available statuses from the type definition (or query distinct statuses if preferred)
    const statuses = Constants.public.Enums.order_status;

    // Return the data fetched directly with the relationship
    return json({
        orders: (orders as OrderWithFamily[]) || [], // Use data directly from query
        statuses,
        currentStatusFilter: statusFilter
    }); // Removed response headers as we don't have the response object anymore
}


export default function AdminOrderListPage() {
    // Component receives data as fetched by the restored loader query
    const { orders, statuses, currentStatusFilter } = useLoaderData<LoaderData>();
    const [searchParams, setSearchParams] = useSearchParams();

    const handleStatusChange = (value: string) => {
        const newParams = new URLSearchParams(searchParams);
        if (value === 'all') {
            newParams.delete('status');
        } else {
            newParams.set('status', value);
        }
        setSearchParams(newParams);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Manage Orders</h1>
                {/* Filter Dropdown */}
                <div className="w-48">
                     <Select onValueChange={handleStatusChange} defaultValue={currentStatusFilter ?? 'all'}>
                        <SelectTrigger id="status-filter">
                            <SelectValue placeholder="Filter by status..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {statuses.map(status => (
                                <SelectItem key={status} value={status} className="capitalize">
                                    {status.replace(/_/g, ' ')} {/* Make status more readable */}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {orders.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-10">
                    {currentStatusFilter ? `No orders found with status "${currentStatusFilter.replace(/_/g, ' ')}".` : "No orders found."}
                </p>
            ) : (
                <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order Date</TableHead>
                                <TableHead>Family</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                        {formatDateTime(order.order_date)}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {order.families?.name || 'N/A'}
                                        {/* Restore link now that family ID is fetched again */}
                                        {order.families?.id && (
                                             <Link to={`/admin/families/${order.families.id}`} className="text-xs text-blue-500 hover:underline ml-2">(View)</Link>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge className={`capitalize ${statusColors[order.status] || 'bg-gray-200 text-gray-800'}`}>
                                            {order.status.replace(/_/g, ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(order.total_amount_cents)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="outline" size="sm">
                                            <Link to={`${order.id}`}>
                                                <Eye className="mr-1 h-3 w-3" /> View Details
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
