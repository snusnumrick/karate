import { type ActionFunctionArgs, type LoaderFunctionArgs, json, TypedResponse } from "@remix-run/node"; // Removed unused redirect
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
// Removed: import { getSupabaseServerClient } from "~/utils/supabase.server";
import { getSupabaseAdminClient } from '~/utils/supabase.server';
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { formatDate, formatCurrency } from "~/utils/misc";
import { Constants, type Database, type Tables, type Enums } from "~/types/database.types"; // Added Database type back
import { CheckCircle, XCircle, Clock, PackageCheck, ShoppingCart } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

// Define types for related data
type OrderRow = Tables<'orders'>;
type FamilyRow = Tables<'families'>;
type StudentRow = Tables<'students'>;
type OrderItemRow = Tables<'order_items'>;
type ProductVariantRow = Tables<'product_variants'>;
type ProductRow = Tables<'products'>;
type PaymentRow = Tables<'payments'>;
type OrderStatusEnum = Enums<'order_status'>;

// Type for Order Items with nested Product Variant and Product details
type OrderItemWithDetails = OrderItemRow & {
    product_variants: (ProductVariantRow & {
        products: Pick<ProductRow, 'id' | 'name' | 'image_url'> | null;
    }) | null;
};

// Type for the main Order data with all relations
type OrderDetails = OrderRow & {
    families: Pick<FamilyRow, 'id' | 'name' | 'email' | 'primary_phone' | 'address' | 'city' | 'province' | 'postal_code'> | null;
    students: Pick<StudentRow, 'id' | 'first_name' | 'last_name'> | null;
    order_items: OrderItemWithDetails[];
    payments: Pick<PaymentRow, 'id' | 'status' | 'payment_method' | 'card_last4' | 'receipt_url'> | null; // Fetch related payment via order_id FK
};

type LoaderData = {
    order: OrderDetails;
    statuses: OrderStatusEnum[]; // Pass available statuses for dropdown
};

type ActionData = {
    success?: boolean;
    message?: string;
    error?: string;
    fieldErrors?: { [key: string]: string };
};

// Define status colors and icons
const statusConfig: Record<OrderStatusEnum, { color: string; icon: React.ElementType }> = {
    pending_payment: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
    paid_pending_pickup: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: ShoppingCart },
    completed: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle },
    cancelled: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: XCircle },
};

// Loader function to fetch order details
export async function loader({ params }: LoaderFunctionArgs) {
    const orderId = params.orderId;
    if (!orderId) {
        throw new Response("Order ID is required", { status: 400 });
    }
    // Admin check happens in the parent _admin layout loader
    // Removed: const { supabaseServer, response } = getSupabaseServerClient(request);
    // Initialize Supabase admin client
    const supabaseAdmin = getSupabaseAdminClient();


    // Fetch the order with all related details
    const { data: orderData, error } = await supabaseAdmin // Use supabaseAdmin
        .from('orders')
        .select(`
            *,
            families ( id, name, email, primary_phone, address, city, province, postal_code ),
            students ( id, first_name, last_name ),
            order_items (
                *,
                product_variants (
                    *,
                    products ( id, name, image_url )
                )
            ),
            payments ( id, status, payment_method, card_last4, receipt_url )
        `)
        .eq('id', orderId)
        .maybeSingle(); // Use maybeSingle to handle potential null if order has no payment

    if (error) {
        console.error(`Error fetching order details for ${orderId}:`, error.message);
        throw new Response("Could not load order details.", { status: 500 });
    }
    if (!orderData) {
        throw new Response("Order not found.", { status: 404 });
    }

    // Add warnings if expected relations are missing
    if (!orderData.families) {
        console.warn(`[Admin Order Loader] Order ${orderId} is missing associated family data.`);
    }
    // Note: Student might be optional depending on exact store logic. Adjust if needed.
    if (!orderData.students) {
        console.warn(`[Admin Order Loader] Order ${orderId} is missing associated student data.`);
    }

    // Ensure payment is treated as potentially null if the join didn't find one
    // Also, take the first payment if the array is returned (as expected for 1-to-1 via FK)
    const orderDetails: OrderDetails = {
        ...orderData,
        payments: orderData.payments && orderData.payments.length > 0 ? orderData.payments[0] : null,
    };


    // Get available statuses from the type definition
    const statuses = Constants.public.Enums.order_status;

    return json({ order: orderDetails, statuses }); // Removed response headers
}

// Action function to handle status updates and notes
export async function action({ request, params }: ActionFunctionArgs): Promise<TypedResponse<ActionData | never>> {
    const orderId = params.orderId;
    if (!orderId) {
        return json({ error: "Order ID is missing." }, { status: 400 });
    }
    // Admin check happens in the parent _admin layout loader
    // Use admin client for the action as well to ensure consistency and bypass RLS if needed for updates
    const supabaseAdmin = getSupabaseAdminClient();
    // Removed: const { supabaseServer, response } = getSupabaseServerClient(request);
    // Removed: const headers = response.headers;


    const formData = await request.formData();
    const newStatus = formData.get('status') as OrderStatusEnum | null;
    const pickupNotes = formData.get('pickup_notes') as string | null;

    // --- Validation ---
    const fieldErrors: { [key: string]: string } = {};
    if (!newStatus) {
        fieldErrors.status = "New status is required.";
    } else if (!Constants.public.Enums.order_status.includes(newStatus)) {
        fieldErrors.status = "Invalid status selected.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return json({ error: "Please fix the errors below.", fieldErrors }, { status: 400 }); // Removed headers
    }

    // --- Database Update ---
    const updateData: Partial<Tables<'orders'>> = {
        status: newStatus!, // Assert non-null as validated
        pickup_notes: pickupNotes,
        updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin // Use supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

    if (updateError) {
        console.error(`Error updating order ${orderId}:`, updateError.message);
        return json({ error: `Failed to update order: ${updateError.message}` }, { status: 500 }); // Removed headers
    }

    // Return success message - stay on the page
    return json({ success: true, message: "Order updated successfully." }); // Removed headers
}


// Component for the Order Detail page
export default function AdminOrderDetailPage() {
    const { order, statuses } = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    // const params = useParams(); // Removed unused params
    const isSubmitting = navigation.state === "submitting";

    const currentStatusConfig = statusConfig[order.status] || { color: "bg-gray-200 text-gray-800", icon: PackageCheck };
    const paymentStatus = order.payments?.status;
    const paymentMethod = order.payments?.payment_method;
    const cardLast4 = order.payments?.card_last4;

    return (
        <div className="space-y-6">
            <AppBreadcrumb items={breadcrumbPatterns.adminStoreOrderDetail(order.id)} className="mb-6" />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <h1 className="text-2xl font-bold">Order Details</h1>
                 <Badge className={`text-sm px-3 py-1 capitalize ${currentStatusConfig.color}`}>
                     <currentStatusConfig.icon className="mr-2 h-4 w-4" />
                     {order.status.replace(/_/g, ' ')}
                 </Badge>
            </div>

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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Order Items & Update Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Order Items Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Items</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead className="text-center">Qty</TableHead>
                                        <TableHead className="text-right">Price/Item</TableHead>
                                        <TableHead className="text-right">Subtotal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {order.order_items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium flex items-center">
                                                {item.product_variants?.products?.image_url && (
                                                    <img src={item.product_variants.products.image_url} alt={item.product_variants.products.name ?? 'Product'} className="h-10 w-10 object-cover rounded mr-3" />
                                                )}
                                                {item.product_variants?.products?.name || 'Unknown Product'}
                                            </TableCell>
                                            <TableCell>{item.product_variants?.size || 'N/A'}</TableCell>
                                            <TableCell className="text-center">{item.quantity}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.price_per_item_cents)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.price_per_item_cents * item.quantity)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                         <CardFooter className="flex justify-end font-semibold text-lg border-t pt-4">
                            <span>Total: {formatCurrency(order.total_amount_cents)}</span>
                        </CardFooter>
                    </Card>

                    {/* Update Order Form Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Update Order</CardTitle>
                            <CardDescription>Update the order status or add pickup notes.</CardDescription>
                        </CardHeader>
                        <Form method="post">
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="status">Order Status</Label>
                                    <Select name="status" defaultValue={order.status} required>
                                        <SelectTrigger id="status" aria-invalid={!!actionData?.fieldErrors?.status} aria-describedby="status-error" tabIndex={1} className="input-custom-styles">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {statuses.map(status => (
                                                <SelectItem key={status} value={status} className="capitalize">
                                                    {status.replace(/_/g, ' ')}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                     {actionData?.fieldErrors?.status && (
                                        <p id="status-error" className="text-sm text-destructive mt-1">{actionData.fieldErrors.status}</p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="pickup_notes">Pickup Notes</Label>
                                    <Textarea
                                        id="pickup_notes"
                                        name="pickup_notes"
                                        defaultValue={order.pickup_notes || ''}
                                        rows={3}
                                        placeholder="Add any notes regarding pickup..."
                                        className="input-custom-styles"
                                        tabIndex={2}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end">
                                <Button type="submit" disabled={isSubmitting} tabIndex={3}>
                                    {isSubmitting ? "Updating..." : "Update Order"}
                                </Button>
                            </CardFooter>
                        </Form>
                    </Card>
                </div>

                {/* Right Column: Customer & Payment Info */}
                <div className="space-y-6">
                    {/* Customer Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Customer Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                             <p><strong>Family:</strong> {order.families ? (
                                <Link to={`/admin/families/${order.families.id}`} className="text-blue-600 hover:underline">
                                    {order.families.name}
                                </Link>
                             ) : (
                                <span className="text-muted-foreground italic">Family data missing</span>
                             )}
                            </p>
                            <p><strong>Email:</strong> {order.families?.email || <span className="text-muted-foreground italic">N/A</span>}</p>
                            <p><strong>Phone:</strong> {order.families?.primary_phone || <span className="text-muted-foreground italic">N/A</span>}</p>
                            <p><strong>Address:</strong></p>
                            {order.families ? (
                                <address className="not-italic text-gray-600 dark:text-gray-400 pl-4">
                                    {order.families.address || 'N/A'}<br />
                                    {order.families.city || 'N/A'}, {order.families.province || 'N/A'} {order.families.postal_code || 'N/A'}
                                </address>
                            ) : (
                                <p className="text-muted-foreground italic pl-4">Address data missing</p>
                            )}
                             {order.students ? (
                                <p className="pt-2"><strong>Student (if applicable):</strong>
                                    <Link to={`/admin/students/${order.students.id}`} className="text-blue-600 hover:underline">
                                        {order.students.first_name} {order.students.last_name}
                                    </Link>
                                </p>
                            ) : (
                                 <p className="pt-2"><strong>Student (if applicable):</strong> <span className="text-muted-foreground italic">Student data missing</span></p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Payment Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Payment Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                             <p><strong>Payment Status:</strong> <span className={`capitalize font-medium ${paymentStatus === 'succeeded' ? 'text-green-600' : paymentStatus === 'failed' ? 'text-red-600' : 'text-yellow-600'}`}>{paymentStatus || 'N/A'}</span></p>
                             <p><strong>Method:</strong> {paymentMethod || 'N/A'} {cardLast4 ? `(**** ${cardLast4})` : ''}</p>
                             <p><strong>Order Date:</strong> {formatDate(order.order_date, { type: 'datetime' })}</p>
                             {order.payments?.receipt_url && (
                                 <p>
                                     <strong>Receipt:</strong>
                                     <a href={order.payments.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-2">
                                         View Receipt
                                     </a>
                                 </p>
                             )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
