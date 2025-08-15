import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useRouteError, useSearchParams , Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { siteConfig } from "~/config/site";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { getInvoiceEntityById, updateInvoiceEntity } from "~/services/invoice-entity.server";
import type { EntityType, PaymentTerms } from "~/types/invoice";
import { Save, CheckCircle } from "lucide-react";
import { Constants } from "~/types/database.types";

interface ActionData {
  errors?: {
    name?: string;
    entity_type?: string;
    email?: string;
    general?: string;
  };
  values?: {
    name?: string;
    entity_type?: string;
    email?: string;
  };
  success?: boolean;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const entityId = params.id;
  if (!entityId) {
    throw new Response("Entity ID is required", { status: 400 });
  }

  try {
    const entity = await getInvoiceEntityById(entityId);
    return json({ entity });
  } catch (error) {
    console.error("Error loading invoice entity:", error);
    throw new Response("Failed to load invoice entity", { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const entityId = params.id;
  if (!entityId) {
    throw new Response("Entity ID is required", { status: 400 });
  }

  const formData = await request.formData();
  
  const updateData = {
    name: formData.get("name") as string,
    entity_type: formData.get("entity_type") as EntityType,
    contact_person: formData.get("contact_person") as string || undefined,
    email: formData.get("email") as string || undefined,
    phone: formData.get("phone") as string || undefined,
    address_line1: formData.get("address_line1") as string || undefined,
    address_line2: formData.get("address_line2") as string || undefined,
    city: formData.get("city") as string || undefined,
    state: formData.get("state") as string || undefined,
    postal_code: formData.get("postal_code") as string || undefined,
    country: formData.get("country") as string || siteConfig.localization.country,
    tax_id: formData.get("tax_id") as string || undefined,
    payment_terms: formData.get("payment_terms") as PaymentTerms,
    credit_limit: formData.get("credit_limit") ? parseFloat(formData.get("credit_limit") as string) : undefined,
    is_active: formData.get("is_active") === "on",
    notes: formData.get("notes") as string || undefined,
  };

  // Validation
  const errors: ActionData["errors"] = {};
  const values: ActionData["values"] = {
    name: updateData.name || '',
    entity_type: updateData.entity_type || '',
    email: updateData.email || ''
  };
  
  if (!updateData.name?.trim()) {
    errors.name = "Entity name is required";
  }
  
  if (!updateData.entity_type) {
    errors.entity_type = "Entity type is required";
  }
  
  if (updateData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)) {
    errors.email = "Please enter a valid email address";
  }

  if (Object.keys(errors).length > 0) {
    return json<ActionData>({ errors, values }, { status: 400 });
  }

  try {
    await updateInvoiceEntity(entityId, updateData);
    return json<ActionData>({ success: true });
  } catch (error) {
    console.error("Error updating invoice entity:", error);
    return json<ActionData>({
      errors: { general: "Failed to update invoice entity. Please try again." }
    }, { status: 500 });
  }
}

export default function EditInvoiceEntityPage() {
  const { entity } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";
  const showCreatedSuccess = searchParams.get("success") === "created";

  return (
    <div className="min-h-screen page-background-styles py-12 text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md backdrop-blur-lg border dark:border-gray-700">
          <AppBreadcrumb items={breadcrumbPatterns.adminInvoiceEntityEdit(entity.name, entity.id)} className="mb-6" />
          
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-green-600 dark:text-green-400">Edit Invoice Entity</h1>
          </div>

      {showCreatedSuccess && (
        <div className="bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded mb-6 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          Invoice entity created successfully!
        </div>
      )}

      {actionData?.success && (
        <div className="bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded mb-6 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          Invoice entity updated successfully!
        </div>
      )}

      {actionData?.errors?.general && (
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-6">
          {actionData.errors.general}
        </div>
      )}

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Update the basic details for the invoice entity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Entity Name *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={actionData?.values?.name || entity.name}
                  placeholder="e.g., ABC School District"
                  className={`input-custom-styles ${actionData?.errors?.name ? 'border-red-500 focus:border-red-500' : ''}`}
                  required
                />
                {actionData?.errors?.name && (
                  <p className="text-sm text-red-600">{actionData.errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity_type">Entity Type *</Label>
                <Select name="entity_type" defaultValue={actionData?.values?.entity_type || entity.entity_type} required>
                  <SelectTrigger className={`input-custom-styles ${actionData?.errors?.entity_type ? 'border-red-500 focus:border-red-500' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Constants.public.Enums.entity_type_enum.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {actionData?.errors?.entity_type && (
                  <p className="text-sm text-red-600">{actionData.errors.entity_type}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  name="contact_person"
                  defaultValue={entity.contact_person || ""}
                  placeholder="e.g., John Smith"
                  className="input-custom-styles"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID</Label>
                <Input
                  id="tax_id"
                  name="tax_id"
                  defaultValue={entity.tax_id || ""}
                  placeholder="e.g., 12-3456789"
                  className="input-custom-styles"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                name="is_active"
                defaultChecked={entity.is_active}
              />
              <Label htmlFor="is_active">Active Entity</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>
              Contact details for communication and billing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={actionData?.values?.email || entity.email || ""}
                  placeholder="billing@example.com"
                  className={`input-custom-styles ${actionData?.errors?.email ? 'border-red-500 focus:border-red-500' : ''}`}
                />
                {actionData?.errors?.email && (
                  <p className="text-sm text-red-600">{actionData.errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={entity.phone || ""}
                  placeholder="(555) 123-4567"
                  className="input-custom-styles"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription>
              Billing address for the entity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address_line1">Street Address</Label>
              <Input
                id="address_line1"
                name="address_line1"
                defaultValue={entity.address_line1 || ""}
                placeholder="123 Main Street"
                className="input-custom-styles"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={entity.city || ""}
                  placeholder="Toronto"
                  className="input-custom-styles"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">Province</Label>
                <Select name="state" defaultValue={entity.state || ""}>
                  <SelectTrigger className="input-custom-styles">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AB">Alberta</SelectItem>
                    <SelectItem value="BC">British Columbia</SelectItem>
                    <SelectItem value="MB">Manitoba</SelectItem>
                    <SelectItem value="NB">New Brunswick</SelectItem>
                    <SelectItem value="NL">Newfoundland and Labrador</SelectItem>
                    <SelectItem value="NS">Nova Scotia</SelectItem>
                    <SelectItem value="ON">Ontario</SelectItem>
                    <SelectItem value="PE">Prince Edward Island</SelectItem>
                    <SelectItem value="QC">Quebec</SelectItem>
                    <SelectItem value="SK">Saskatchewan</SelectItem>
                    <SelectItem value="NT">Northwest Territories</SelectItem>
                    <SelectItem value="NU">Nunavut</SelectItem>
                    <SelectItem value="YT">Yukon</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  defaultValue={entity.postal_code || ""}
                  placeholder="M5V 3A8"
                  className="input-custom-styles"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Terms</CardTitle>
            <CardDescription>
              Set payment terms and credit limits for this entity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Select name="payment_terms" defaultValue={entity.payment_terms}>
                  <SelectTrigger className="input-custom-styles">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                    <SelectItem value="Net 15">Net 15</SelectItem>
                    <SelectItem value="Net 30">Net 30</SelectItem>
                    <SelectItem value="Net 60">Net 60</SelectItem>
                    <SelectItem value="Net 90">Net 90</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="credit_limit">Credit Limit ($)</Label>
                <Input
                  id="credit_limit"
                  name="credit_limit"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={entity.credit_limit || ""}
                  placeholder="0.00"
                  className="input-custom-styles"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={entity.notes || ""}
                placeholder="Additional notes about this entity..."
                rows={3}
                className="input-custom-styles"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" asChild>
            <Link to="/admin/invoice-entities">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </Form>
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error("Error in EditInvoiceEntityPage:", error);

  let errorMessage = "An unknown error occurred.";
  if (error instanceof Response) {
    errorMessage = `Error: ${error.status} - ${error.statusText}`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded">
      <h2 className="text-xl font-bold mb-2">Error Loading Invoice Entity</h2>
      <p>{errorMessage}</p>
    </div>
  );
}