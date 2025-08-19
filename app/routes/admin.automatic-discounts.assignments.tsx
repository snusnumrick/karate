import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ArrowLeft, Search, Filter, Users, CheckCircle, Clock, XCircle } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { formatDate } from "~/utils/misc";

const supabase = getSupabaseAdminClient();

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;
  const search = url.searchParams.get('search') || '';
  const ruleId = url.searchParams.get('rule') || '';
  const status = url.searchParams.get('status') || '';

  try {
    let query = supabase
      .from('discount_assignments')
      .select(`
        *,
        students (id, first_name, last_name),
        families (id, name),
        discount_codes (id, code, current_uses, max_uses, is_active),
        discount_automation_rules (id, name, event_type),
        discount_events (id, event_type, event_data)
      `, { count: 'exact' })
      .order('assigned_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`students.first_name.ilike.%${search}%,students.last_name.ilike.%${search}%,families.name.ilike.%${search}%,discount_codes.code.ilike.%${search}%`);
    }
    
    if (ruleId && ruleId !== 'all') {
      query = query.eq('automation_rule_id', ruleId);
    }
    
    if (status && status !== 'all') {
      if (status === 'active') {
        query = query.eq('discount_codes.is_active', true);
      } else if (status === 'used') {
        query = query.gte('discount_codes.current_uses', 1);
      } else if (status === 'expired') {
        query = query.lt('expires_at', new Date().toISOString());
      }
    }

    const { data: assignments, error: assignmentsError, count } = await query
      .range(offset, offset + limit - 1);

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      throw new Response("Failed to load assignments", { status: 500 });
    }

    // Get automation rules for filter dropdown
    const { data: rules, error: rulesError } = await supabase
      .from('discount_automation_rules')
      .select('id, name, event_type')
      .order('name');

    if (rulesError) {
      console.error('Error fetching rules:', rulesError);
    }

    // Get summary statistics
    const { data: stats, error: statsError } = await supabase
      .from('discount_assignments')
      .select(`
        id,
        discount_codes!inner(current_uses, is_active),
        expires_at
      `);

    let totalAssignments = 0;
    let activeAssignments = 0;
    let usedAssignments = 0;
    let expiredAssignments = 0;

    if (!statsError && stats) {
      totalAssignments = stats.length;
      const now = new Date();
      
      stats.forEach(assignment => {
        const discountCode = assignment.discount_codes as { is_active?: boolean; current_uses?: number } | null;
        if (discountCode?.is_active) {
          activeAssignments++;
        }
        if (discountCode?.current_uses && discountCode.current_uses > 0) {
          usedAssignments++;
        }
        if (assignment.expires_at && new Date(assignment.expires_at) < now) {
          expiredAssignments++;
        }
      });
    }

    return json({
      assignments: assignments || [],
      rules: rules || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      filters: {
        search,
        ruleId,
        status,
      },
      stats: {
        totalAssignments,
        activeAssignments,
        usedAssignments,
        expiredAssignments,
      },
    });
  } catch (error) {
    console.error('Error loading assignments:', error);
    throw new Response("Failed to load assignments", { status: 500 });
  }
}

export default function DiscountAssignments() {
  const { assignments, rules, pagination, filters, stats } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.delete('page'); // Reset to first page when filtering
    setSearchParams(newParams);
  };

  const getStatusBadge = (assignment: {
    expires_at?: string | null;
    discount_codes?: { is_active?: boolean; current_uses?: number } | null;
  }) => {
    const now = new Date();
    const expiresAt = assignment.expires_at ? new Date(assignment.expires_at) : null;
    const isExpired = expiresAt && expiresAt < now;
    const isUsed = assignment.discount_codes?.current_uses && assignment.discount_codes.current_uses > 0;
    const isActive = assignment.discount_codes?.is_active;

    if (isExpired) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Expired
        </Badge>
      );
    } else if (isUsed) {
      return (
        <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
          <CheckCircle className="h-3 w-3" />
          Used
        </Badge>
      );
    } else if (isActive) {
      return (
        <Badge variant="default" className="gap-1">
          <Clock className="h-3 w-3" />
          Active
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="gap-1">
          <XCircle className="h-3 w-3" />
          Inactive
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6">
      <AppBreadcrumb items={breadcrumbPatterns.adminAutomaticDiscountAssignments()} className="mb-6" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Discount Assignments</h1>
          <p className="text-muted-foreground">View and manage automatically assigned discounts</p>
        </div>
        <Link to="/admin/automatic-discounts">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Rules
          </Button>
        </Link>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssignments}</div>
            <p className="text-xs text-muted-foreground">
              discounts automatically assigned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeAssignments}</div>
            <p className="text-xs text-muted-foreground">
              ready to be used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Used</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.usedAssignments}</div>
            <p className="text-xs text-muted-foreground">
              discounts redeemed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiredAssignments}</div>
            <p className="text-xs text-muted-foreground">
              no longer valid
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter assignments by search terms, automation rules, or status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label htmlFor="search" className="text-sm font-medium">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Student name, family, or code..."
                  defaultValue={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  className="input-custom-styles pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="rule" className="text-sm font-medium">
                Automation Rule
              </label>
              <Select value={filters.ruleId || 'all'} onValueChange={(value) => updateFilter('rule', value)}>
                <SelectTrigger className="input-custom-styles">
                  <SelectValue placeholder="All rules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All rules</SelectItem>
                  {rules.map((rule) => (
                    <SelectItem key={rule.id} value={rule.id}>
                      {rule.name} ({rule.event_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <Select value={filters.status || 'all'} onValueChange={(value) => updateFilter('status', value)}>
                <SelectTrigger className="input-custom-styles">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setSearchParams({})}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignments Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Assignments ({pagination.total})
          </CardTitle>
          <CardDescription>
            View all automatic discount assignments and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No assignments found</h3>
              <p className="text-muted-foreground">
                No discount assignments match your current filters
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student/Family</TableHead>
                    <TableHead>Discount Code</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Assigned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {assignment.students?.first_name} {assignment.students?.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {assignment.families?.name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono font-medium">
                          {assignment.discount_codes?.code}
                        </div>
                        <div className="text-sm text-muted-foreground">
          Used: {assignment.discount_codes?.current_uses || 0}/{assignment.discount_codes?.max_uses || '∞'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {assignment.discount_automation_rules?.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {assignment.discount_automation_rules?.event_type}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {assignment.discount_events?.event_type}
                        </div>
                        {assignment.discount_events?.event_data && (
                          <div className="text-sm text-muted-foreground">
                            {JSON.stringify(assignment.discount_events.event_data).substring(0, 50)}...
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(assignment)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {assignment.expires_at 
                          ? formatDate(assignment.expires_at, { formatString: 'MMM d, yyyy' })
                          : 'No expiration'
                        }
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(assignment.assigned_at, { formatString: 'MMM d, yyyy' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex-1 flex justify-between sm:hidden">
                {pagination.page > 1 && (
                  <Link
                    to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(pagination.page - 1) })}`}
                  >
                    <Button variant="outline">Previous</Button>
                  </Link>
                )}
                {pagination.page < pagination.totalPages && (
                  <Link
                    to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(pagination.page + 1) })}`}
                  >
                    <Button variant="outline">Next</Button>
                  </Link>
                )}
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Showing{' '}
                    <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span>
                    {' '}to{' '}
                    <span className="font-medium">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>
                    {' '}of{' '}
                    <span className="font-medium">{pagination.total}</span>
                    {' '}results
                  </p>
                </div>
                <div>
                  <nav className="flex items-center space-x-1" aria-label="Pagination">
                    {pagination.page > 1 && (
                      <Link
                        to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(pagination.page - 1) })}`}
                      >
                        <Button variant="outline" size="sm">Previous</Button>
                      </Link>
                    )}
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, pagination.page - 2) + i;
                      if (pageNum > pagination.totalPages) return null;
                      
                      return (
                        <Link
                          key={pageNum}
                          to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(pageNum) })}`}
                        >
                          <Button
                            variant={pageNum === pagination.page ? "default" : "outline"}
                            size="sm"
                          >
                            {pageNum}
                          </Button>
                        </Link>
                      );
                    })}
                    
                    {pagination.page < pagination.totalPages && (
                      <Link
                        to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(pagination.page + 1) })}`}
                      >
                        <Button variant="outline" size="sm">Next</Button>
                      </Link>
                    )}
                  </nav>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}