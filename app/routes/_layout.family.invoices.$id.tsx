import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { InvoiceItemType, InvoiceEntity } from "~/types/invoice";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AppBreadcrumb } from "~/components/AppBreadcrumb";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { formatDate } from "~/utils/misc";
import { formatEntityAddress } from "~/utils/entity-helpers";
import { getItemTypeLabel, formatServicePeriod, calculateLineItemSubtotal } from "~/utils/line-item-helpers";
import {formatMoney, isPositive, fromCents, toMoney, type Money} from "~/utils/money";
import { moneyFromRow } from "~/utils/database-money";
import { 
  DollarSign, 
  Calendar, 
  FileText, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye
} from "lucide-react";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { supabaseServer, response: { headers } } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();
  
  if (!user) {
    throw redirect("/login", { headers });
  }
  
  const { id } = params;
  if (!id) {
    throw new Response("Invoice ID is required", { status: 400 });
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
  
  try {
    // Get invoice with family_id check for security
    // Check both direct family_id and through invoice_entities.family_id
    const { data: invoice, error: invoiceError } = await supabaseServer
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
        family_id,
        entity:entity_id (
          name,
          contact_person,
          email,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          family_id
        ),
        line_items:invoice_line_items (
          id,
          description,
          quantity,
          unit_price,
          item_type,
          service_period_start,
          service_period_end
        ),
        payments:invoice_payments (
          id,
          amount_cents,
          currency,
          payment_date,
          payment_method,
          reference_number,
          notes
        )
      `)
      .eq('id', id)
      .single();
      
    // Check if invoice belongs to the family (either directly or through entity)
    if (invoiceError || !invoice) {
      throw new Response("Invoice not found", { status: 404 });
    }
    
    const belongsToFamily = invoice.family_id === profile.family_id || 
                           invoice.entity?.family_id === profile.family_id;
                           
    if (!belongsToFamily) {
       throw new Response("Invoice not found", { status: 404 });
     }
    
    // Convert monetary values to Money types
    const invoiceWithMoney = {
      ...invoice,
      total_amount: moneyFromRow('invoices', 'total_amount', invoice as unknown as Record<string, unknown>),
      amount_paid: moneyFromRow('invoices', 'amount_paid', invoice as unknown as Record<string, unknown>),
      amount_due: moneyFromRow('invoices', 'amount_due', invoice as unknown as Record<string, unknown>)
    } as typeof invoice & {
      total_amount: Money;
      amount_paid: Money;
      amount_due: Money;
    };
    
    return json({ invoice: invoiceWithMoney });
  } catch (error) {
    console.error("Error loading invoice:", error);
    throw new Response("Failed to load invoice", { status: 500 });
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'paid':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'partially_paid':
      return <Clock className="h-5 w-5 text-yellow-500" />;
    case 'overdue':
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    case 'cancelled':
      return <XCircle className="h-5 w-5 text-gray-500" />;
    default:
      return <FileText className="h-5 w-5 text-blue-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'partially_paid':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    case 'sent':
    case 'viewed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

const formatDateLocal = (dateString: string) => {
  return formatDate(dateString);
};

export default function FamilyInvoiceDetailPage() {
  const loaderData = useLoaderData<typeof loader>();
  
  // Convert serialized Money values back to Money types
  const invoice = {
    ...loaderData.invoice,
    total_amount: typeof loaderData.invoice.total_amount === 'number' ? fromCents(loaderData.invoice.total_amount) : toMoney(loaderData.invoice.total_amount as unknown),
    amount_paid: typeof loaderData.invoice.amount_paid === 'number' ? fromCents(loaderData.invoice.amount_paid) : toMoney(loaderData.invoice.amount_paid as unknown),
    amount_due: typeof loaderData.invoice.amount_due === 'number' ? fromCents(loaderData.invoice.amount_due) : toMoney(loaderData.invoice.amount_due as unknown)
  };
  
  const breadcrumbs = [
    { label: "Family Portal", href: "/family" },
    { label: "Invoices", href: "/family/invoices" },
    { label: invoice.invoice_number, href: `/family/invoices/${invoice.id}` }
  ];
  
  return (
    <div className="min-h-screen page-background-styles">
        <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
          <AppBreadcrumb items={breadcrumbs} />
      
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
          </div>

          <div className="mt-4 sm:mt-0 flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <a
                href={`/api/invoices/${invoice.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                View PDF
              </a>
            </Button>
          </div>
        </div>

        {/* Invoice Header */}
        <Card className="mb-8 dark:bg-gray-700 dark:border-gray-600">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-2xl font-bold dark:text-white flex items-center gap-3">
                  {getStatusIcon(invoice.status || 'draft')}
                  Invoice {invoice.invoice_number}
                </CardTitle>
                <div className="mt-2 flex items-center gap-2">
                  <Badge className={getStatusColor(invoice.status || 'draft')}>
                    {(invoice.status || 'draft').replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </div>
              
              <div className="mt-4 sm:mt-0 text-right">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {formatMoney(invoice.total_amount)}
                </div>
                {isPositive(invoice.amount_due) && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    Balance Due: {formatMoney(invoice.amount_due)}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Invoice Details */}
            <Card className="dark:bg-gray-700 dark:border-gray-600">
              <CardHeader>
                <CardTitle className="dark:text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Invoice Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Issue Date</div>
                    <p className="text-gray-900 dark:text-white">{formatDateLocal(invoice.issue_date)}</p>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Due Date</div>
                    <p className="text-gray-900 dark:text-white">{formatDateLocal(invoice.due_date)}</p>
                  </div>
                </div>
                
                {invoice.notes && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</div>
                    <p className="text-gray-900 dark:text-white">{invoice.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card className="dark:bg-gray-700 dark:border-gray-600">
              <CardHeader>
                <CardTitle className="dark:text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                    <thead className="bg-gray-50 dark:bg-gray-600">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                      {invoice.line_items.map((item) => {
                        const lineTotal = calculateLineItemSubtotal({
                          ...item,
                          item_type: item.item_type as InvoiceItemType,
                          unit_price: fromCents(item.unit_price as number),
                          service_period_start: item.service_period_start || undefined,
                          service_period_end: item.service_period_end || undefined
                        });
                        
                        return (
                          <tr key={item.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {item.description}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {getItemTypeLabel(item.item_type as InvoiceItemType)}
                                </div>
                                {(item.service_period_start || item.service_period_end) && (
                                  <div className="text-xs text-gray-400 dark:text-gray-500">
                                    {formatServicePeriod(item.service_period_start || undefined, item.service_period_end || undefined)}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {item.quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {formatMoney(fromCents(item.unit_price as number))}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {formatMoney(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Totals */}
                <div className="mt-6 border-t border-gray-200 dark:border-gray-600 pt-4">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-lg font-semibold text-gray-900 dark:text-white">
                        <span>Total:</span>
                        <span>{formatMoney(invoice.total_amount)}</span>
                      </div>
                      {isPositive(invoice.amount_paid) && (
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Paid:</span>
                    <span>-{formatMoney(invoice.amount_paid)}</span>
                  </div>
                )}
                {isPositive(invoice.amount_due) && (
                  <div className="flex justify-between text-lg font-bold text-red-600 dark:text-red-400 border-t border-gray-200 dark:border-gray-600 pt-2">
                    <span>Balance Due:</span>
                    <span>{formatMoney(invoice.amount_due)}</span>
                  </div>
                )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Bill To */}
            {invoice.entity && (
              <Card className="dark:bg-gray-700 dark:border-gray-600">
                <CardHeader>
                  <CardTitle className="dark:text-white text-lg">Bill To</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {invoice.entity.name}
                    </div>
                    {invoice.entity.contact_person && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Attn: {invoice.entity.contact_person}
                      </div>
                    )}
                    {invoice.entity && formatEntityAddress(invoice.entity as unknown as InvoiceEntity) && (
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {formatEntityAddress(invoice.entity as unknown as InvoiceEntity)}
                      </div>
                    )}
                    {invoice.entity.email && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {invoice.entity.email}
                      </div>
                    )}
                    {invoice.entity.phone && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {invoice.entity.phone}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment History */}
            {invoice.payments && invoice.payments.length > 0 && (
              <Card className="dark:bg-gray-700 dark:border-gray-600">
                <CardHeader>
                  <CardTitle className="dark:text-white text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Payment History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {invoice.payments.map((payment) => (
                      <div key={payment.id} className="border-b border-gray-200 dark:border-gray-600 pb-3 last:border-b-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {formatMoney(moneyFromRow('invoice_payments', 'amount_cents', payment as unknown as Record<string, unknown>))}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDateLocal(payment.payment_date)}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {payment.payment_method.replace('_', ' ').toUpperCase()}
                            </div>
                          </div>
                        </div>
                        {payment.reference_number && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Ref: {payment.reference_number}
                          </div>
                        )}
                        {payment.notes && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {payment.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
