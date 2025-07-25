import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useRouteError, useSearchParams } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { getInvoiceEntitiesWithStats } from "~/services/invoice-entity.server";
import type { EntityType } from "~/types/invoice";
import { Search, Plus, Building2, Users, Landmark, Briefcase, HelpCircle, Eye, FileText, Trash2 } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const entityType = url.searchParams.get("entity_type") || "";
  const isActive = url.searchParams.get("is_active");

  const filters = {
    search: search || undefined,
    entity_type: entityType ? [entityType as EntityType] : undefined,
    is_active: isActive !== null ? isActive === "true" : undefined,
  };

  try {
    const entities = await getInvoiceEntitiesWithStats(filters);
    return json({ entities, filters: { search, entityType, isActive } });
  } catch (error) {
    console.error("Error loading invoice entities:", error);
    throw new Response("Failed to load invoice entities", { status: 500 });
  }
}

const entityTypeIcons = {
  family: Users,
  school: Building2,
  government: Landmark,
  corporate: Briefcase,
  other: HelpCircle,
};

const entityTypeLabels = {
  family: "Family",
  school: "School",
  government: "Government",
  corporate: "Corporate",
  other: "Other",
};

const entityTypeColors = {
  family: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  school: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  government: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  corporate: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export default function InvoiceEntitiesIndexPage() {
  const { entities, filters } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <AppBreadcrumb items={breadcrumbPatterns.adminInvoiceEntities()} className="mb-6" />
      
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Invoice Entities</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage billing entities including families, schools, government agencies, and corporate clients. 
            These entities are used for creating invoices and tracking financial relationships.
          </p>
        </div>
        <Button asChild tabIndex={0}>
          <Link to="/admin/invoice-entities/new">
            <Plus className="w-4 h-4 mr-2" />
            Add New Entity
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search entities..."
              value={filters.search || ""}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="pl-10 input-custom-styles"
              tabIndex={0}
            />
          </div>
          
          <Select
            value={filters.entityType || "all"}
            onValueChange={(value) => handleFilterChange("entity_type", value)}
          >
            <SelectTrigger className="input-custom-styles" tabIndex={0}>
              <SelectValue placeholder="All entity types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entity types</SelectItem>
              <SelectItem value="family">Family</SelectItem>
              <SelectItem value="school">School</SelectItem>
              <SelectItem value="government">Government</SelectItem>
              <SelectItem value="corporate">Corporate</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.isActive || "all"}
            onValueChange={(value) => handleFilterChange("is_active", value)}
          >
            <SelectTrigger className="input-custom-styles" tabIndex={0}>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => setSearchParams({})}
            className="w-full"
            tabIndex={0}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Entities</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{entities.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Entities</h3>
          <p className="text-2xl font-bold text-green-600">
            {entities.filter(e => e.is_active).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Outstanding</h3>
          <p className="text-2xl font-bold text-orange-600">
            {formatCurrency(entities.reduce((sum, e) => sum + e.outstanding_amount, 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Invoiced</h3>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(entities.reduce((sum, e) => sum + e.total_amount, 0))}
          </p>
        </div>
      </div>

      {/* Entities Table */}
      {entities.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-sm text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No invoice entities found.</p>
          <Button asChild tabIndex={0}>
            <Link to="/admin/invoice-entities/new">Create your first entity</Link>
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Invoices</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entities.map((entity) => {
                const IconComponent = entityTypeIcons[entity.entity_type];
                return (
                  <TableRow key={entity.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <IconComponent className="w-5 h-5 text-gray-500" />
                        <div>
                          <Link 
                            to={`/admin/invoice-entities/${entity.id}`}
                            className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                          >
                            {entity.name}
                          </Link>
                          {entity.contact_person && (
                            <div className="text-sm text-gray-500">{entity.contact_person}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={entityTypeColors[entity.entity_type]}>
                        {entityTypeLabels[entity.entity_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {entity.email && <div>{entity.email}</div>}
                        {entity.phone && <div className="text-gray-500">{entity.phone}</div>}
                      </div>
                    </TableCell>
                    <TableCell>{entity.payment_terms}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{entity.total_invoices} invoices</div>
                        <div className="text-gray-500">
                          {formatCurrency(entity.total_amount)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`font-medium ${
                        entity.outstanding_amount > 0 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(entity.outstanding_amount)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={entity.is_active ? "default" : "secondary"}>
                        {entity.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button variant="outline" size="sm" asChild tabIndex={0} title="View entity details">
                          <Link to={`/admin/invoice-entities/${entity.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild tabIndex={0} title="Create new invoice for this entity">
                          <Link to={`/admin/invoices/new?entity_id=${entity.id}`}>
                            <FileText className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild tabIndex={0} title="Edit entity">
                          <Link to={`/admin/invoice-entities/${entity.id}/edit`}>
                            Edit
                          </Link>
                        </Button>
                        {entity.is_active && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild 
                            tabIndex={0} 
                            title="Deactivate entity (soft delete)"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                          >
                            <Link to={`/admin/invoice-entities/${entity.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error("Error in InvoiceEntitiesIndexPage:", error);

  let errorMessage = "An unknown error occurred.";
  if (error instanceof Response) {
    errorMessage = `Error: ${error.status} - ${error.statusText}`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
      <h2 className="text-xl font-bold mb-2">Error Loading Invoice Entities</h2>
      <p>{errorMessage}</p>
    </div>
  );
}