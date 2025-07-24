import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation, useRouteError , Link } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { createInvoiceEntity } from "~/services/invoice-entity.server";
import type { CreateInvoiceEntityData, EntityType, PaymentTerms } from "~/types/invoice";
import { Save } from "lucide-react";

interface ActionData {
  errors?: {
    name?: string;
    entity_type?: string;
    email?: string;
    general?: string;
  };
  success?: boolean;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  
  const entityData: CreateInvoiceEntityData = {
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
    payment_terms: formData.get("payment_terms") as PaymentTerms || "Net 30",
    credit_limit: formData.get("credit_limit") ? parseFloat(formData.get("credit_limit") as string) : undefined,
    notes: formData.get("notes") as string || undefined,
  };

  // Validation
  const errors: ActionData["errors"] = {};
  
  if (!entityData.name?.trim()) {
    errors.name = "Entity name is required";
  }
  
  if (!entityData.entity_type) {
    errors.entity_type = "Entity type is required";
  }
  
  if (entityData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entityData.email)) {
    errors.email = "Please enter a valid email address";
  }

  if (Object.keys(errors).length > 0) {
    return json<ActionData>({ errors }, { status: 400 });
  }

  try {
    const entity = await createInvoiceEntity(entityData);
    return redirect(`/admin/invoice-entities/${entity.id}/edit?success=created`);
  } catch (error) {
    console.error("Error creating invoice entity:", error);
    return json<ActionData>({
      errors: { general: "Failed to create invoice entity. Please try again." }
    }, { status: 500 });
  }
}

export default function NewInvoiceEntityPage() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus the first input field on page load
  useEffect(() => {
    if (firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <AppBreadcrumb items={breadcrumbPatterns.adminInvoiceEntityNew()} className="mb-6" />
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Create New Invoice Entity</h1>
        <p className="text-muted-foreground">
          Add a new entity to your invoice system
        </p>
      </div>

      {actionData?.errors?.general && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {actionData.errors.general}
        </div>
      )}

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Enter the basic details for the invoice entity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Entity Name *</Label>
                <Input
                  ref={firstInputRef}
                  id="name"
                  name="name"
                  placeholder="e.g., Acme Corporation"
                  required
                  className="input-custom-styles"
                  tabIndex={0}
                />
                {actionData?.errors?.name && (
                  <p className="text-sm text-red-600">{actionData.errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity_type">Entity Type *</Label>
                <Select name="entity_type" defaultValue="family" required>
                  <SelectTrigger className="input-custom-styles" tabIndex={0}>
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
                  placeholder="e.g., John Smith"
                  className="input-custom-styles"
                  tabIndex={0}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID</Label>
                <Input
                  id="tax_id"
                  name="tax_id"
                  placeholder="e.g., 12-3456789"
                  className="input-custom-styles"
                  tabIndex={0}
                />
              </div>
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
                  placeholder="billing@example.com"
                  className="input-custom-styles"
                  tabIndex={0}
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
                  placeholder="(555) 123-4567"
                  className="input-custom-styles"
                  tabIndex={0}
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
                placeholder="123 Main Street"
                className="input-custom-styles"
                tabIndex={0}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                name="address_line2"
                placeholder="Suite 100"
                className="input-custom-styles"
                tabIndex={0}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="Anytown"
                  className="input-custom-styles"
                  tabIndex={0}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  name="state"
                  placeholder="CA"
                  className="input-custom-styles"
                  tabIndex={0}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  placeholder="12345"
                  className="input-custom-styles"
                  tabIndex={0}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                name="country"
                defaultValue="CA"
                placeholder="CA"
                className="input-custom-styles"
                tabIndex={0}
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
                <Select name="payment_terms" defaultValue="Net 30">
                  <SelectTrigger className="input-custom-styles" tabIndex={0}>
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
                  placeholder="0.00"
                  className="input-custom-styles"
                  tabIndex={0}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Additional notes about this entity..."
                rows={3}
                className="input-custom-styles"
                tabIndex={0}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" asChild tabIndex={0}>
            <Link to="/admin/invoice-entities">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting} tabIndex={0}>
            {isSubmitting ? (
              <>Creating...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create Entity
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
  console.error("Error in NewInvoiceEntityPage:", error);

  let errorMessage = "An unknown error occurred.";
  if (error instanceof Response) {
    errorMessage = `Error: ${error.status} - ${error.statusText}`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
      <h2 className="text-xl font-bold mb-2">Error Creating Invoice Entity</h2>
      <p>{errorMessage}</p>
    </div>
  );
}