import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { getInvoices } from "~/services/invoice.server";
import { formatMoney, toCents, fromCents } from "~/utils/money";
import { requireUserId } from "~/utils/auth.server";
import { getTodayLocalDateString } from "~/utils/misc";
import { Plus, Search, FileText, Calendar, DollarSign, Users } from "lucide-react";
import type { InvoiceWithDetails, InvoiceStatus } from "~/types/invoice";
import { siteConfig } from "~/config/site";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const statusParam = url.searchParams.get("status") || "";
  const sortBy = url.searchParams.get("sortBy") || "created_at";
  const sortOrder = url.searchParams.get("sortOrder") || "desc";

  // Parse comma-separated status values
  const statusArray = statusParam
    ? statusParam.split(',').map(s => s.trim()).filter(Boolean) as InvoiceStatus[]
    : undefined;

  try {
    const result = await getInvoices({
      search,
      status: statusArray,
    });

    const invoices = result.invoices;

    // Calculate stats based on filtered invoices for consistency with displayed data
    const stats = {
      total: invoices.length,
      pending: invoices.filter((inv: InvoiceWithDetails) => inv.status === "sent" || inv.status === "viewed").length,
      paid: invoices.filter((inv: InvoiceWithDetails) => inv.status === "paid").length,
      overdue: invoices.filter((inv: InvoiceWithDetails) => {
        const today = getTodayLocalDateString();
        return inv.status !== 'paid' && inv.due_date < today;
      }).length,
      totalAmount: invoices.reduce((sum, inv) => sum + (inv.total_amount ? toCents(inv.total_amount) : 0), 0),
      pendingAmount: invoices.reduce((sum, inv) => {
        const totalCents = inv.total_amount ? toCents(inv.total_amount) : 0;
        const paidCents = inv.amount_paid ? toCents(inv.amount_paid) : 0;
        return sum + (totalCents - paidCents);
      }, 0)
    };
    
    // Serialize Money types for invoices
    const serializedInvoices = invoices.map(invoice => ({
      ...invoice,
      total_amount: invoice.total_amount ? toCents(invoice.total_amount) : 0
    }));
    
    return json({ invoices: serializedInvoices, stats, search, status: statusParam, sortBy, sortOrder });
  } catch (error) {
    console.error("Error loading invoices:", error);
    return json({ 
      invoices: [], 
      stats: {
        total: 0,
        pending: 0,
        paid: 0,
        overdue: 0,
        totalAmount: 0,
        pendingAmount: 0
      }, 
      search, 
      status: statusParam, 
      sortBy, 
      sortOrder 
    });
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "paid":
      return "bg-green-100 text-green-800";
    case "overdue":
      return "bg-red-100 text-red-800";
    case "cancelled":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString(siteConfig.localization.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export default function InvoicesIndexPage() {
  const { invoices: rawInvoices, stats: rawStats, search, status, sortBy, sortOrder } = useLoaderData<typeof loader>();
  
  // Deserialize Money types
  const stats = {
    ...rawStats,
    totalAmount: rawStats.totalAmount ? fromCents(rawStats.totalAmount) : undefined,
    pendingAmount: rawStats.pendingAmount ? fromCents(rawStats.pendingAmount) : undefined
  };
  
  const invoices = rawInvoices.map(invoice => ({
    ...invoice,
    total_amount: invoice.total_amount ? fromCents(invoice.total_amount) : undefined
  }));
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on search input when page loads
  useEffect(() => {
    // Small delay to ensure page is fully loaded and prevent conflicts with browser navigation
    const timer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const updateSearchParams = (updates: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    setSearchParams(newParams);
  };

  return (
    <div className="min-h-screen page-background-styles">
      {/* Focus container to prevent tab navigation from escaping to browser */}
      <main 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        aria-label="Invoice management interface"
      >
        {/* Breadcrumb */}
        <AppBreadcrumb items={breadcrumbPatterns.adminInvoices()}  className="mb-6"/>

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Invoices</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Manage and track all your invoices
            </p>
          </div>
          <Button asChild>
                <Link to="/admin/invoices/new" tabIndex={0}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Invoice
                </Link>
              </Button>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="dark:bg-gray-700 dark:border-gray-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Invoices</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="dark:bg-gray-700 dark:border-gray-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="dark:bg-gray-700 dark:border-gray-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Amount</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalAmount ? formatMoney(stats.totalAmount) : '$0.00'}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="dark:bg-gray-700 dark:border-gray-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Pending Amount</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.pendingAmount ? formatMoney(stats.pendingAmount) : '$0.00'}</p>
                  </div>
                  <Users className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-8 dark:bg-gray-700 dark:border-gray-600">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search invoices..."
                    value={search}
                    onChange={(e) => updateSearchParams({ search: e.target.value })}
                    className="pl-10 input-custom-styles"
                    tabIndex={0}
                  />
                </div>
              </div>
              
              <Select
                value={status || "all"}
                onValueChange={(value) => updateSearchParams({ status: value === "all" ? "" : value })}
              >
                <SelectTrigger className="w-full md:w-48 input-custom-styles" tabIndex={0}>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={`${sortBy}-${sortOrder}`}
                onValueChange={(value) => {
                  const [newSortBy, newSortOrder] = value.split('-');
                  updateSearchParams({ sortBy: newSortBy, sortOrder: newSortOrder });
                }}
              >
                <SelectTrigger className="w-full md:w-48 input-custom-styles" tabIndex={0}>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at-desc">Newest First</SelectItem>
                  <SelectItem value="created_at-asc">Oldest First</SelectItem>
                  <SelectItem value="due_date-asc">Due Date (Earliest)</SelectItem>
                  <SelectItem value="due_date-desc">Due Date (Latest)</SelectItem>
                  <SelectItem value="total_amount-desc">Amount (High to Low)</SelectItem>
                  <SelectItem value="total_amount-asc">Amount (Low to High)</SelectItem>
                  <SelectItem value="invoice_number-asc">Invoice Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card className="dark:bg-gray-700 dark:border-gray-600">
          <CardHeader>
            <CardTitle className="dark:text-white">Invoice List</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No invoices found</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {search || status ? "Try adjusting your filters" : "Get started by creating your first invoice"}
                </p>
                <Button asChild>
                  <Link to="/admin/invoices/new">Create Invoice</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <thead className="bg-gray-50 dark:bg-gray-600">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Invoice
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Entity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
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
                    {invoices.map((invoice) => {
                      if (!invoice) return null;
                      return (
                      <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              #{invoice.invoice_number}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-300">
                              {formatDate(invoice.issue_date)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{invoice.entity?.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-300">{invoice.entity?.entity_type}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {invoice.total_amount ? formatMoney(invoice.total_amount) : '$0.00'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getStatusColor(invoice.status)}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatDate(invoice.due_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/admin/invoices/${invoice.id}`}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            >
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}