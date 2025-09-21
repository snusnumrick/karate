import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AppBreadcrumb } from "~/components/AppBreadcrumb";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { formatDate } from "~/utils/misc";
import { formatMoney, fromCents } from "~/utils/money";
import { centsFromRow, moneyFromRow } from "~/utils/database-money";
import { FileText, Calendar, DollarSign, Eye } from "lucide-react";
import type { InvoiceStatus } from "~/types/invoice";

type FamilyInvoice = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus | null;
  issue_date: string;
  due_date: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  notes: string | null;
  entity: {
    name: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer, response: { headers } } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();
  
  if (!user) {
    throw redirect("/login", { headers });
  }
  
  // Get the user's family_id
  const { data: profile, error: profileError } = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();
    
  if (profileError || !profile?.family_id) {
    throw new Response("Family not found", { status: 404 });
  }
  
  // Get invoices for this family
  const { data: invoices, error: invoicesError } = await supabaseServer
    .from('invoices')
    .select(`
      id,
      invoice_number,
      status,
      issue_date,
      due_date,
      total_amount,
      amount_paid,
      amount_due,
      notes,
      entity:entity_id (
        name
      )
    `)
    .eq('family_id', profile.family_id)
    .order('created_at', { ascending: false });
    
  if (invoicesError) {
    console.error("Error loading family invoices:", invoicesError);
    throw new Response("Could not load invoices", { status: 500 });
  }
  
  // Calculate stats
  const stats = {
    total: invoices?.length || 0,
    pending: invoices?.filter((inv) => inv.status === 'sent' || inv.status === 'viewed').length || 0,
    paid: invoices?.filter((inv) => inv.status === 'paid').length || 0,
    overdue: invoices?.filter((inv) => inv.status === 'overdue').length || 0,
    totalAmountCents: invoices?.reduce((sum: number, inv) => sum + centsFromRow('invoices', 'total_amount', inv as unknown as Record<string, unknown>), 0) || 0,
    pendingAmountCents: invoices?.reduce((sum: number, inv) => {
      if (inv.status === 'paid') return sum;
      const dueCents = centsFromRow('invoices', 'amount_due', inv as unknown as Record<string, unknown>);
      return sum + dueCents;
    }, 0) || 0,
  } as const;
  
  return json({ invoices: invoices || [], stats });
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    case "sent":
    case "viewed":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "paid":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "overdue":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "cancelled":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
};

export default function FamilyInvoicesIndexPage() {
  const { invoices, stats } = useLoaderData<typeof loader>();
  
  return (
    <div className="min-h-screen page-background-styles">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <AppBreadcrumb 
          items={[
            { label: "Family Portal", href: "/family" },
            { label: "Invoices", href: "/family/invoices" }
          ]} 
          className="mb-6"
        />
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Your Invoices</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            View and manage your family&apos;s invoices
          </p>
        </div>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="dark:bg-gray-700 dark:border-gray-600">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Invoices</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="dark:bg-gray-700 dark:border-gray-600">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
                </div>
                <Calendar className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="dark:bg-gray-700 dark:border-gray-600">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Paid</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.paid}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="dark:bg-gray-700 dark:border-gray-600">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Amount Due</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {formatMoney(fromCents(stats.pendingAmountCents))}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Invoices Table */}
        <Card className="dark:bg-gray-700 dark:border-gray-600">
          <CardHeader>
            <CardTitle className="dark:text-white">Invoice History</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices && invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Invoice #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Issue Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                    {invoices.map((invoice: FamilyInvoice) => (
                      <tr key={invoice.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {invoice.invoice_number}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {invoice.notes || 'No description'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getStatusColor(invoice.status || 'draft')}>
                            {(invoice.status || 'draft').charAt(0).toUpperCase() + (invoice.status || 'draft').slice(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatMoney(moneyFromRow('invoices', 'total_amount', invoice as unknown as Record<string, unknown>))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatDate(invoice.issue_date, { formatString: 'P' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatDate(invoice.due_date, { formatString: 'P' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <Link
                              to={`/family/invoices/${invoice.id}`}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Link>
                            <span className="text-gray-300">|</span>
                            <a
                              href={`/api/invoices/${invoice.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                              title="View PDF"
                            >
                              PDF
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No invoices</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  You don&apos;t have any invoices yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
