import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation, useRouteError , Link } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { siteConfig } from "~/config/site";
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
  values?: {
    name?: string;
    entity_type?: string;
    email?: string;
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
    country: formData.get("country") as string || siteConfig.localization.country,
    tax_id: formData.get("tax_id") as string || undefined,
    payment_terms: formData.get("payment_terms") as PaymentTerms || "Net 30",
    credit_limit: formData.get("credit_limit") ? parseFloat(formData.get("credit_limit") as string) : undefined,
    notes: formData.get("notes") as string || undefined,
  };

  // Validation
  const errors: ActionData["errors"] = {};
  const values: ActionData["values"] = {
    name: entityData.name || '',
    entity_type: entityData.entity_type || '',
    email: entityData.email || ''
  };
  
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
    return json<ActionData>({ errors, values }, { status: 400 });
  }

  try {
    await createInvoiceEntity(entityData);
    return redirect(`/admin/invoice-entities?success=created`);
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
  const [country, setCountry] = useState(siteConfig.localization.country);

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
                  type="text"
                  autoComplete="organization"
                  placeholder="Enter entity name"
                  defaultValue={actionData?.values?.name}
                  className={`input-custom-styles ${actionData?.errors?.name ? 'border-red-500 focus:border-red-500' : ''}`}
                  tabIndex={1}
                  required
                />
                {actionData?.errors?.name && (
                  <p className="text-sm text-red-600">{actionData.errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity_type">Entity Type *</Label>
                <Select name="entity_type" defaultValue={actionData?.values?.entity_type} required>
                  <SelectTrigger className={`input-custom-styles ${actionData?.errors?.entity_type ? 'border-red-500 focus:border-red-500' : ''}`} tabIndex={2}>
                    <SelectValue placeholder="Select entity type" />
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
                  type="text"
                  autoComplete="name"
                  placeholder="e.g., John Smith"
                  className="input-custom-styles"
                  tabIndex={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID</Label>
                <Input
                  id="tax_id"
                  name="tax_id"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g., 12-3456789"
                  className="input-custom-styles"
                  tabIndex={4}
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
                  autoComplete="email"
                  placeholder="Enter email address"
                  defaultValue={actionData?.values?.email}
                  className={`input-custom-styles ${actionData?.errors?.email ? 'border-red-500 focus:border-red-500' : ''}`}
                  tabIndex={5}
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
                  type="tel"
                  autoComplete="tel"
                  placeholder="(555) 123-4567"
                  className="input-custom-styles"
                  tabIndex={6}
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
                type="text"
                autoComplete="address-line1"
                placeholder="123 Main Street"
                className="input-custom-styles"
                tabIndex={7}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                name="address_line2"
                type="text"
                autoComplete="address-line2"
                placeholder="Suite 100"
                className="input-custom-styles"
                tabIndex={8}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  type="text"
                  autoComplete="address-level2"
                  placeholder="Anytown"
                  className="input-custom-styles"
                  tabIndex={9}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">Province / State</Label>
                {country === 'CA' ? (
                  <Select name="state" defaultValue={siteConfig.location.region}>
                    <SelectTrigger className="input-custom-styles" tabIndex={10}>
                      <SelectValue placeholder={siteConfig.location.region} />
                    </SelectTrigger>
                    <SelectContent>
                      {siteConfig.provinces.map((province) => (
                        <SelectItem key={province.value} value={province.value}>
                          {province.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="state"
                    name="state"
                    type="text"
                    autoComplete="address-level1"
                    placeholder={siteConfig.location.region}
                    className="input-custom-styles"
                    tabIndex={10}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  type="text"
                  autoComplete="postal-code"
                  placeholder="12345"
                  className="input-custom-styles"
                  tabIndex={11}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                name="country"
                type="text"
                autoComplete="country"
                defaultValue={siteConfig.localization.country}
                placeholder={siteConfig.localization.country}
                className="input-custom-styles"
                tabIndex={12}
                onChange={(e) => setCountry(e.target.value)}
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
                  <SelectTrigger className="input-custom-styles" tabIndex={13}>
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
                  tabIndex={14}
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
                tabIndex={15}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" asChild tabIndex={16}>
            <Link to="/admin/invoice-entities">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting} tabIndex={17}>
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