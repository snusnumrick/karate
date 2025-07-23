import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useRouteError, useSearchParams , Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { getInvoiceEntityById, updateInvoiceEntity } from "~/services/invoice-entity.server";
import type { EntityType, PaymentTerms } from "~/types/invoice";
import { ArrowLeft, Save, CheckCircle } from "lucide-react";

interface ActionData {
  errors?: {
    name?: string;
    entity_type?: string;
    email?: string;
    general?: string;
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
    country: formData.get("country") as string || "US",
    tax_id: formData.get("tax_id") as string || undefined,
    payment_terms: formData.get("payment_terms") as PaymentTerms,
    credit_limit: formData.get("credit_limit") ? parseFloat(formData.get("credit_limit") as string) : undefined,
    is_active: formData.get("is_active") === "on",
    notes: formData.get("notes") as string || undefined,
  };

  // Validation
  const errors: ActionData["errors"] = {};
  
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
    return json<ActionData>({ errors }, { status: 400 });
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
    <div className="container mx-auto px-4 py-8 max-w-4xl bg-gray-50 dark:bg-gray-900 min-h-screen">
      <AppBreadcrumb items={breadcrumbPatterns.adminInvoiceEntityEdit(entity.name, entity.id)} className="mb-6" />
      
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/invoice-entities">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Entities
          </Link>
        </Button>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Edit Invoice Entity</h1>
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
                  defaultValue={entity.name}
                  placeholder="e.g., ABC School District"
                  required
                />
                {actionData?.errors?.name && (
                  <p className="text-sm text-red-600">{actionData.errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity_type">Entity Type *</Label>
                <Select name="entity_type" defaultValue={entity.entity_type} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID / EIN</Label>
                <Input
                  id="tax_id"
                  name="tax_id"
                  defaultValue={entity.tax_id || ""}
                  placeholder="e.g., 12-3456789"
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
                  defaultValue={entity.email || ""}
                  placeholder="billing@example.com"
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
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input
                id="address_line1"
                name="address_line1"
                defaultValue={entity.address_line1 || ""}
                placeholder="123 Main Street"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                name="address_line2"
                defaultValue={entity.address_line2 || ""}
                placeholder="Suite 100"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={entity.city || ""}
                  placeholder="Anytown"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  name="state"
                  defaultValue={entity.state || ""}
                  placeholder="CA"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  defaultValue={entity.postal_code || ""}
                  placeholder="12345"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                name="country"
                defaultValue={entity.country}
                placeholder="US"
              />
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
                  <SelectTrigger>
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