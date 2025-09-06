import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, Form, useNavigation, useActionData } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import {
  getInvoiceById,
  getInvoiceByNumber,
  updateInvoiceStatus,
  deleteInvoice,
} from "~/services/invoice.server";
import { formatCurrency, formatDate } from "~/utils/misc";
import { formatEntityAddress } from "~/utils/entity-helpers";
import { getItemTypeLabel, formatServicePeriod, calculateLineItemSubtotal, calculateLineItemDiscount } from "~/utils/line-item-helpers";
import { requireUserId } from "~/utils/auth.server";
import { 
  Send,
  Trash2, 
  Edit,
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
  await requireUserId(request);
  
  const { id } = params;
  if (!id) {
    throw new Response("Invoice ID is required", { status: 400 });
  }
  
  try {
    // Check if the id looks like an invoice number (INV-YYYY-NNNN format)
    const isInvoiceNumber = /^INV-\d{4}-\d{4}$/.test(id);
    
    const invoice = isInvoiceNumber 
      ? await getInvoiceByNumber(id)
      : await getInvoiceById(id);
      
    if (!invoice) {
      throw new Response("Invoice not found", { status: 404 });
    }
    
    return json({ invoice });
  } catch (error) {
    console.error("Error loading invoice:", error);
    throw new Response("Failed to load invoice", { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserId(request);
  
  const { id } = params;
  if (!id) {
    return json({ error: "Invoice ID is required" }, { status: 400 });
  }
  
  const formData = await request.formData();
  const action = formData.get("action");
  
  try {
    switch (action) {
      case "mark_paid": {
        // First get the invoice to calculate remaining balance
        const invoice = await getInvoiceById(id);
        if (!invoice) {
          return json({ error: "Invoice not found" }, { status: 404 });
        }
        
        const remainingBalance = invoice.total_amount - invoice.amount_paid;
        
        if (remainingBalance > 0) {
          // Create a payment record for the remaining balance
          const { getSupabaseAdminClient } = await import("~/utils/supabase.server");
          const supabase = getSupabaseAdminClient();
          
          const { error: paymentError } = await supabase
            .from('invoice_payments')
            .insert({
              invoice_id: id,
              amount: remainingBalance,
              payment_date: new Date().toISOString().split('T')[0], // Today's date
              payment_method: 'other', // Default method when marked as paid
              notes: 'Marked as paid via admin interface'
            });
            
          if (paymentError) {
            console.error('Error creating payment record:', paymentError);
            return json({ error: "Failed to create payment record" }, { status: 500 });
          }
        }
        
        await updateInvoiceStatus(id, "paid");
        return json({ success: true, message: "Invoice marked as paid" });
      }
        
      case "mark_pending":
        await updateInvoiceStatus(id, "sent");
        return json({ success: true, message: "Invoice marked as sent" });
        
      case "cancel":
        await updateInvoiceStatus(id, "cancelled");
        return json({ success: true, message: "Invoice cancelled" });
        
      case "delete":
        await deleteInvoice(id);
        return redirect("/admin/invoices");
        
      case "send_email": {
        const invoice = await getInvoiceById(id);
        if (!invoice) {
          return json({ error: "Invoice not found" }, { status: 404 });
        }
        
        if (!invoice.entity.email) {
          return json({ error: "No email address found for this invoice entity" }, { status: 400 });
        }
        
        const { sendInvoiceEmail } = await import("~/services/invoice-email.server");
        const emailSent = await sendInvoiceEmail(invoice);
        
        if (emailSent) {
          // Update invoice status to sent if it was draft
          if (invoice.status === "draft") {
            await updateInvoiceStatus(id, "sent");
          }
          return json({ success: true, message: "Invoice email sent successfully" });
        } else {
          return json({ error: "Failed to send invoice email" }, { status: 500 });
        }
      }
        
      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error updating invoice:", error);
    return json({ error: "Failed to update invoice" }, { status: 500 });
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "draft":
      return <FileText className="h-3 w-3" />;
    case "sent":
      return <Clock className="h-3 w-3" />;
    case "paid":
      return <CheckCircle className="h-3 w-3" />;
    case "overdue":
      return <AlertTriangle className="h-3 w-3" />;
    case "cancelled":
      return <XCircle className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200";
    case "sent":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-600 dark:text-yellow-200";
    case "paid":
      return "bg-green-100 text-green-800 dark:bg-green-600 dark:text-green-200";
    case "overdue":
      return "bg-red-100 text-red-800 dark:bg-red-600 dark:text-red-200";
    case "cancelled":
      return "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200";
  }
};

const formatDateLocal = (dateString: string) => {
  return formatDate(dateString, {
    formatString: 'MMMM d, yyyy'
  });
};

export default function InvoiceDetailPage() {
  const { invoice } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const canEdit = invoice.status === "draft";
  const canMarkPaid = invoice.status === "draft" || invoice.status === "sent" || invoice.status === "overdue";
  const canCancel = invoice.status === "sent" || invoice.status === "draft";

  return (
    <div className="min-h-screen page-background-styles">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <AppBreadcrumb items={breadcrumbPatterns.adminInvoiceDetail(invoice.invoice_number, invoice.id)}  className="mb-6"/>

        {/* Success/Error Messages */}
        {actionData && 'success' in actionData && actionData.success && (
          <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {actionData.message}
            </AlertDescription>
          </Alert>
        )}
        
        {actionData && 'error' in actionData && actionData.error && (
          <Alert className="mb-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {actionData.error}
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Invoice #{invoice.invoice_number}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={getStatusColor(invoice.status)}>
                <span className="flex items-center gap-1">
                  {getStatusIcon(invoice.status)}
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </span>
              </Badge>
              <span className="text-sm text-gray-500 dark:text-gray-300">
                Created {formatDate(invoice.created_at)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/admin/invoices/${invoice.id}/edit`} className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
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
            <Form method="post" className="inline">
              <input type="hidden" name="action" value="send_email" />
              <Button 
                type="submit" 
                variant="outline" 
                size="sm"
                disabled={isSubmitting || !invoice.entity.email}
                className="flex items-center gap-2"
                title={!invoice.entity.email ? "No email address available for this entity" : "Send invoice via email"}
              >
                <Send className="h-4 w-4" />
                {isSubmitting && navigation.formData?.get("action") === "send_email" ? "Sending..." : "Send Email"}
              </Button>
            </Form>
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8 dark:bg-gray-700 dark:border-gray-600">
          <CardHeader>
            <CardTitle className="dark:text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {canMarkPaid && (
                <Form method="post" className="inline">
                  <input type="hidden" name="action" value="mark_paid" />
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={isSubmitting}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Mark as Paid
                  </Button>
                </Form>
              )}
              
              {invoice.status === "paid" && (
                <Form method="post" className="inline">
                  <input type="hidden" name="action" value="mark_pending" />
                  <Button 
                    type="submit" 
                    variant="outline" 
                    size="sm" 
                    disabled={isSubmitting}
                    className="flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4" />
                    Mark as Sent
                  </Button>
                </Form>
              )}
              
              {canCancel && (
                <Form method="post" className="inline">
                  <input type="hidden" name="action" value="cancel" />
                  <Button 
                    type="submit" 
                    variant="outline" 
                    size="sm" 
                    disabled={isSubmitting}
                    className="flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel Invoice
                  </Button>
                </Form>
              )}
              
              {invoice.status === "draft" && (
                <Form method="post" className="inline">
                  <input type="hidden" name="action" value="delete" />
                  <Button 
                    type="submit" 
                    variant="destructive" 
                    size="sm" 
                    disabled={isSubmitting}
                    className="flex items-center gap-2"
                    onClick={(e) => {
                      if (!confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </Form>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invoice Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Invoice Information */}
            <Card className="dark:bg-gray-700 dark:border-gray-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 dark:text-white">
                  <Calendar className="h-5 w-5" />
                  Invoice Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Issue Date</span>
                    <p className="text-sm text-gray-900 dark:text-white">{formatDateLocal(invoice.issue_date)}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Due Date</span>
                    <p className="text-sm text-gray-900 dark:text-white">{formatDateLocal(invoice.due_date)}</p>
                  </div>
                </div>
                
                {(invoice.service_period_start || invoice.service_period_end) && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Service Period</span>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {formatServicePeriod(invoice.service_period_start, invoice.service_period_end)}
                    </p>
                  </div>
                )}
                
                {invoice.terms && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Payment Terms</span>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{invoice.terms}</p>
                  </div>
                )}
                
                {invoice.notes && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Notes</span>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card className="dark:bg-gray-700 dark:border-gray-600">
              <CardHeader>
                <CardTitle className="dark:text-white">Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {invoice.line_items.map((item) => {
                    console.log("Line item: ", item);
                    console.log("Line item taxes: ", item.taxes);
                    const itemSubtotal = calculateLineItemSubtotal(item);
                    const itemDiscount = calculateLineItemDiscount(item);
                    const itemTax = item.taxes?.reduce((sum, tax) => sum + tax.tax_amount, 0) || 0;
                    
                    return (
                      <div key={item.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                        {/* Item Header */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">{item.description}</h4>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                              <span>{getItemTypeLabel(item.item_type)}</span>
                              {(item.service_period_start || item.service_period_end) && (
                                <span>Service Period: {formatServicePeriod(item.service_period_start, item.service_period_end)}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900 dark:text-white">
                              {formatCurrency((itemSubtotal - itemDiscount + itemTax) * 100)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                          </div>
                        </div>
                        
                        {/* Item Details Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</div>
                            <div className="font-medium text-gray-900 dark:text-white">{item.quantity}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit Price</div>
                            <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.unit_price * 100)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subtotal</div>
                            <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(itemSubtotal * 100)}</div>
                          </div>
                        </div>
                        
                        {/* Adjustments */}
                        {(itemDiscount > 0 || itemTax > 0) && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Adjustments</div>
                            <div className="space-y-1 text-sm">
                              {itemDiscount > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-green-600 dark:text-green-400">Discount ({Number(item.discount_rate).toFixed(2)}%):</span>
                                  <span className="text-green-600 dark:text-green-400">-{formatCurrency(itemDiscount * 100)}</span>
                                </div>
                              )}
                              {item.taxes && item.taxes.length > 0 && item.taxes.map((tax, taxIndex) => (
                                <div key={taxIndex} className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-300">{tax.tax_name_snapshot}
                                      ({(Number(tax.tax_rate_snapshot) * 100).toFixed(2)}%):
                                  </span>
                                  <span className="text-gray-900 dark:text-white">
                                      {formatCurrency(tax.tax_amount * 100)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Entity Information */}
            <Card className="dark:bg-gray-700 dark:border-gray-600">
              <CardHeader>
                <CardTitle className="dark:text-white">Billing Entity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{invoice.entity.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{invoice.entity.entity_type}</p>
                </div>
                
                {invoice.entity.contact_person && (
                  <div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Contact</span>
                    <p className="text-sm text-gray-900 dark:text-white">{invoice.entity.contact_person}</p>
                  </div>
                )}
                
                {formatEntityAddress(invoice.entity) && (
                  <div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Address</span>
                    <p className="text-sm text-gray-900 dark:text-white">{formatEntityAddress(invoice.entity)}</p>
                  </div>
                )}
                
                {invoice.entity.phone && (
                  <div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Phone</span>
                    <p className="text-sm text-gray-900 dark:text-white">{invoice.entity.phone}</p>
                  </div>
                )}
                
                {invoice.entity.email && (
                  <div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Email</span>
                    <p className="text-sm text-gray-900 dark:text-white">{invoice.entity.email}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Invoice Totals */}
            <Card className="dark:bg-gray-700 dark:border-gray-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 dark:text-white">
                  <DollarSign className="h-5 w-5" />
                  Invoice Totals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Subtotal:</span>
                  <span className="text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.subtotal * 100)}</span>
                </div>
                
                {/* Simple Discount Total */}
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Total Discounts:</span>
                    <span className="text-sm text-green-600 dark:text-green-400">-{formatCurrency(invoice.discount_amount * 100)}</span>
                  </div>
                )}
                
                {/* Detailed Tax Breakdown */}
                {invoice.tax_amount > 0 && (
                  <div className="border-l-2 border-blue-200 dark:border-blue-700 pl-3 py-1 bg-blue-50 dark:bg-blue-900/20">
                    <div className="flex justify-between font-medium">
                      <span className="text-sm text-gray-700 dark:text-gray-200">Total Tax:</span>
                      <span className="text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.tax_amount * 100)}</span>
                    </div>
                    <div className="mt-1 space-y-1">
                      {invoice.line_items.length > 1 && invoice.line_items.map((item) => {
                        const itemTax = item.taxes?.reduce((sum, tax) => sum + tax.tax_amount, 0) || 0;
                        if (itemTax > 0) {
                          return (
                            <div key={item.id} className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                              <span className="truncate max-w-32">{item.description}:</span>
                              <span className="text-gray-900 dark:text-white ml-2">{formatCurrency(itemTax * 100)}</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}
                
                <div className="border-t dark:border-gray-600 pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">Total:</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(invoice.total_amount * 100)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Information */}
            {invoice.status === "paid" && (
              <Card className="dark:bg-gray-700 dark:border-gray-600">
                <CardHeader>
                  <CardTitle className="dark:text-white">Payment Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert className="dark:bg-green-900 dark:border-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription className="dark:text-green-200">
                      This invoice has been marked as paid.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}