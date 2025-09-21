import { useState, useEffect } from "react";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, useFetcher, useRouteError } from "@remix-run/react";
import { csrf } from "~/utils/csrf.server";
import { Building2, FileText, Trash2, Search, Plus, Users, Landmark, Briefcase, HelpCircle, CheckCircle, AlertCircle } from "lucide-react";
import { getInvoiceEntitiesWithStats, deleteInvoiceEntity } from "~/services/invoice-entity.server";
import type { EntityType, InvoiceEntityWithStats } from "~/types/invoice";
import { formatMoney, isPositive, addMoney, ZERO_MONEY, fromCents, toMoney } from "~/utils/money";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

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
    const [csrfToken, csrfCookieHeader] = await csrf.commitToken(request);
    return json(
      { entities, totalCount: entities.length, entityTypes: [], filters: { search, entityType, isActive }, csrfToken },
      { headers: csrfCookieHeader ? { 'Set-Cookie': csrfCookieHeader } : {} }
    );
  } catch (error) {
    console.error("Error loading invoice entities:", error);
    throw new Response("Failed to load invoice entities", { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Validate CSRF token
    await csrf.validate(request);
  } catch (error) {
    console.error('CSRF validation failed:', error);
    return json({ error: 'Security validation failed. Please try again.' }, { status: 403 });
  }
  
  const formData = await request.formData();
  const action = formData.get("action");
  const entityId = formData.get("entityId");

  if (!entityId || typeof entityId !== "string") {
    return json({ error: "Entity ID is required" }, { status: 400 });
  }

  try {
    if (action === "delete") {
      await deleteInvoiceEntity(entityId);
      return json({ 
        success: true, 
        message: "Entity deleted successfully" 
      });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in action:", error);
    
    if (error instanceof Response) {
      const errorText = await error.text();
      return json({ 
        error: errorText || "An error occurred" 
      }, { status: error.status });
    }
    
    return json({ 
      error: "An unexpected error occurred" 
    }, { status: 500 });
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
  const { entities, filters: initialFilters, csrfToken } = useLoaderData<typeof loader>();
  const filters = initialFilters;
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [entityToDeactivate, setEntityToDeactivate] = useState<string | null>(null);
  const [entityToDelete, setEntityToDelete] = useState<{id: string, name: string} | null>(null);

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const handleStatusToggle = (entityId: string, newStatus: boolean) => {
    // Clear any existing feedback
    setFeedback({ type: null, message: '' });
    
    // Optimistic update
    setOptimisticUpdates(prev => ({ ...prev, [entityId]: newStatus }));
    
    // Submit the change
    const formData = new FormData();
    if (csrfToken) {
      formData.append("csrf", csrfToken);
    }
    formData.append("is_active", newStatus.toString());
    
    fetcher.submit(formData, {
      method: "POST",
      action: `/admin/invoice-entities/${entityId}/toggle-status`,
    });
  };

  const handleDeactivateEntity = (entityId: string) => {
    setEntityToDeactivate(entityId);
  };

  const handleDeleteEntity = (entityId: string, entityName: string) => {
    setEntityToDelete({ id: entityId, name: entityName });
  };

  const confirmDeactivation = () => {
    if (entityToDeactivate) {
      handleStatusToggle(entityToDeactivate, false);
      setEntityToDeactivate(null);
    }
  };

  const confirmDeletion = () => {
    if (entityToDelete) {
      // Clear any existing feedback
      setFeedback({ type: null, message: '' });
      
      const formData = new FormData();
      if (csrfToken) {
        formData.append("csrf", csrfToken);
      }
      formData.append("action", "delete");
      formData.append("entityId", entityToDelete.id);
      
      fetcher.submit(formData, {
        method: "POST",
      });
      
      setEntityToDelete(null);
    }
  };

  // Get the current status for an entity (optimistic or actual)
  const getEntityStatus = (entity: InvoiceEntityWithStats) => {
    return optimisticUpdates[entity.id] !== undefined 
      ? optimisticUpdates[entity.id] 
      : entity.is_active;
  };

  // Check if an entity is being updated
  const isEntityUpdating = (entityId: string) => {
    return fetcher.state === "submitting" && 
           (fetcher.formAction === `/admin/invoice-entities/${entityId}/toggle-status` ||
            (fetcher.formData?.get("entityId") === entityId && fetcher.formData?.get("action") === "delete"));
  };

  // Check if entity can be deleted (has no invoices)
  const canDeleteEntity = (entity: InvoiceEntityWithStats) => {
    return entity.total_invoices === 0;
  };

  // Handle fetcher completion
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (Object.keys(optimisticUpdates).length > 0) {
        setOptimisticUpdates({});
      }
      
      const data = fetcher.data as { success?: boolean; message?: string; error?: string };
      
      if (data.success) {
        setFeedback({
          type: 'success',
          message: data.message || 'Operation completed successfully'
        });
        // Clear success message after 3 seconds
        setTimeout(() => setFeedback({ type: null, message: '' }), 3000);
      } else if (data.error) {
        setFeedback({
          type: 'error',
          message: data.error
        });
      }
    }
  }, [fetcher.state, fetcher.data, optimisticUpdates]);

  return (
    <div className="container mx-auto px-4 py-8">
      <AppBreadcrumb items={breadcrumbPatterns.adminInvoiceEntities()} className="mb-6" />
      
      {/* Feedback Alert */}
      {feedback.type && (
        <Alert className={`mb-6 ${feedback.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
          {feedback.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={feedback.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
            {feedback.message}
          </AlertDescription>
        </Alert>
      )}
      
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
            {formatMoney(entities.reduce((sum, e) => addMoney(sum, typeof e.outstanding_amount === 'number' ? fromCents(e.outstanding_amount) : toMoney(e.outstanding_amount as unknown)), ZERO_MONEY))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Invoiced</h3>
          <p className="text-2xl font-bold text-blue-600">
            {formatMoney(entities.reduce((sum, e) => addMoney(sum, typeof e.total_amount === 'number' ? fromCents(e.total_amount) : toMoney(e.total_amount as unknown)), ZERO_MONEY))}
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
                          {formatMoney(typeof entity.total_amount === 'number' ? fromCents(entity.total_amount) : toMoney(entity.total_amount as unknown))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`font-medium ${
                        isPositive(typeof entity.outstanding_amount === 'number' ? fromCents(entity.outstanding_amount) : toMoney(entity.outstanding_amount as unknown)) ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {formatMoney(typeof entity.outstanding_amount === 'number' ? fromCents(entity.outstanding_amount) : toMoney(entity.outstanding_amount as unknown))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`status-${entity.id}`}
                          checked={getEntityStatus(entity as InvoiceEntityWithStats)}
                          disabled={isEntityUpdating(entity.id)}
                          onCheckedChange={(checked) => {
                            handleStatusToggle(entity.id, checked);
                          }}
                        />
                        <Label 
                          htmlFor={`status-${entity.id}`} 
                          className={`text-sm ${isEntityUpdating(entity.id) ? 'opacity-50' : ''}`}
                        >
                          {getEntityStatus(entity as InvoiceEntityWithStats) ? "Active" : "Inactive"}
                          {isEntityUpdating(entity.id) && (
                            <span className="ml-1 text-xs text-gray-500">updating...</span>
                          )}
                        </Label>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button variant="outline" size="sm" asChild tabIndex={0} title="Create new invoice for this entity">
                          <Link to={`/admin/invoices/new?entity_id=${entity.id}`}>
                            <FileText className="w-4 h-4" />
                          </Link>
                        </Button>
                        {canDeleteEntity(entity as InvoiceEntityWithStats) ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDeleteEntity(entity.id, entity.name)}
                            tabIndex={0} 
                            title="Delete entity permanently"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                            disabled={isEntityUpdating(entity.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        ) : entity.is_active ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDeactivateEntity(entity.id)}
                            tabIndex={0} 
                            title="Deactivate entity (soft delete)"
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-900/20"
                            disabled={isEntityUpdating(entity.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Deactivation Confirmation Dialog */}
      <AlertDialog open={!!entityToDeactivate} onOpenChange={() => setEntityToDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Entity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this entity? This will set the entity as inactive but preserve all historical data. You can reactivate it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeactivation}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!entityToDelete} onOpenChange={() => setEntityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entity Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete &quot;{entityToDelete?.name}&quot;? This action cannot be undone and will remove all entity data from the system. This is only allowed because this entity has no associated invoices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeletion}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
