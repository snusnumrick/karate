import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useRouteError } from "@remix-run/react";
import { createClient } from '@supabase/supabase-js';
import { Database } from "~/types/supabase"; // Assuming your generated types
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge"; // For status display
import { format } from 'date-fns'; // For date formatting

// Define the shape of data returned by the loader, including the family name
type PaymentWithFamily = Database['public']['Tables']['payments']['Row'] & {
  families: { name: string } | null; // Supabase relation type
};

type LoaderData = {
  payments: Array<Omit<PaymentWithFamily, 'families'> & { familyName: string }>; // Flattened structure for component
};

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("Entering /admin/payments loader...");
  const { response } = getSupabaseServerClient(request); // Get headers via helper
  const headers = response.headers;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Admin payments loader: Missing Supabase env variables.");
    throw new Response("Server configuration error.", { status: 500, headers: Object.fromEntries(headers) });
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    console.log("Admin payments loader: Fetching payments with family names...");
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select(`
        id,
        payment_date,
        amount,
        status,
        payment_method,
        family_id,
        families ( name )
      `)
      .order('payment_date', { ascending: false }); // Show most recent first

    if (error) {
      console.error("Error fetching payments:", error.message);
      throw new Response("Failed to load payment data.", { status: 500, headers: Object.fromEntries(headers) });
    }

    // Format data for easier use in the component
    const formattedPayments = data?.map(p => ({
      ...p,
      familyName: p.families?.name ?? 'N/A' // Handle cases where family might be deleted or relation is null
    })) || [];

    console.log(`Admin payments loader: Fetched ${formattedPayments.length} payments.`);
    return json<LoaderData>({ payments: formattedPayments }, { headers: Object.fromEntries(headers) });

  } catch (error) {
     if (error instanceof Error) {
       console.error("Error in /admin/payments loader:", error.message);
     } else {
       console.error("Error in /admin/payments loader:", error);
     }
     throw new Response("Failed to load payment data.", { status: 500, headers: Object.fromEntries(headers) });
  }
}

export default function AdminPaymentsPage() {
  const { payments } = useLoaderData<typeof loader>();
  console.log("Rendering AdminPaymentsPage component...");

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed': return 'default'; // Greenish in default theme
      case 'pending': return 'secondary'; // Yellowish/Grayish
      case 'failed': return 'destructive'; // Reddish
      default: return 'outline';
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          Payment History
        </h1>
        <Button asChild>
          <Link to="/admin/payments/new">Record New Payment</Link>
        </Button>
      </div>

      {payments.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400">No payments found.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Family</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{format(new Date(payment.payment_date), 'yyyy-MM-dd')}</TableCell>
                  <TableCell>
                    <Link to={`/admin/families/${payment.family_id}`} className="text-green-600 hover:underline dark:text-green-400">
                      {payment.familyName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">${payment.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(payment.status)} className="capitalize">
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{payment.payment_method?.replace('_', ' ') ?? 'N/A'}</TableCell>
                   <TableCell>
                     {/* Add view/edit links here if needed later */}
                     <Button variant="outline" size="sm" asChild>
                       <Link to={`/admin/payments/${payment.id}`}>View</Link>
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

// Basic ErrorBoundary for this route
export function ErrorBoundary() {
  const error = useRouteError() as Error;
  console.error("Error caught in AdminPaymentsPage ErrorBoundary:", error);

  return (
    <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900/30 dark:border-red-600 dark:text-red-300">
      <h2 className="text-xl font-bold mb-2">Error Loading Payments</h2>
      <p>{error?.message || "An unknown error occurred."}</p>
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs dark:bg-red-900/50 dark:text-red-100">
          {error?.stack || JSON.stringify(error, null, 2)}
        </pre>
      )}
    </div>
  );
}
