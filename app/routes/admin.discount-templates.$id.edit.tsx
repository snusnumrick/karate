import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { requireAdminUser } from "~/utils/auth.server";
import { DiscountTemplateService } from "~/services/discount-template.server";
import { fromDollars, toDollars, type Money } from "~/utils/money";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { AppBreadcrumb , breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { Save, Trash2 } from "lucide-react";
import type { DiscountType, UsageType, DiscountScope, PaymentTypeEnum } from "~/types/discount";

type ActionData = {
  errors?: {
    name?: string;
    discount_type?: string;
    discount_value?: string;
    usage_type?: string;
    applicable_to?: string;
    scope?: string;
    general?: string;
  };
};
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  const templateId = params.id;
  
  if (!templateId) {
    throw new Response("Template ID is required", { status: 400 });
  }

  const template = await DiscountTemplateService.getTemplateById(templateId);
  
  if (!template) {
    throw new Response("Template not found", { status: 404 });
  }

  // Normalize discount_value to a JSON-serializable number (dollars or percentage)
  const normalizedTemplate = {
    ...template,
    discount_value: template.discount_type === 'fixed_amount'
      ? (typeof template.discount_value === 'number' ? template.discount_value : toDollars(template.discount_value as Money))
      : (template.discount_value as number)
  };

  return json({ template: normalizedTemplate });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdminUser(request);
  
  try {
    await csrf.validate(request);
  } catch (error) {
    console.error('CSRF validation failed:', error);
    return json({ errors: { general: 'Security validation failed. Please try again.' } }, { status: 403 });
  }
  
  const templateId = params.id;
  
  if (!templateId) {
    throw new Response("Template ID is required", { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    try {
      await DiscountTemplateService.deleteTemplate(templateId);
      return redirect("/admin/discount-templates");
    } catch {
      return json(
        { errors: { general: "Failed to delete template. Please try again." } },
        { status: 500 }
      );
    }
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const discountType = formData.get("discount_type") as DiscountType;
  const discountValue = parseFloat(formData.get("discount_value") as string);
  const usageType = formData.get("usage_type") as UsageType;
  const maxUses = formData.get("max_uses") ? parseInt(formData.get("max_uses") as string) : undefined;
  const applicableTo = formData.getAll("applicable_to").map(value => value.toString()) as PaymentTypeEnum[];
  const scope = formData.get("scope") as DiscountScope;
  const isActive = formData.get("is_active") === "on";

  // Validation
  const errors: {
    name?: string;
    discount_type?: string;
    discount_value?: string;
    usage_type?: string;
    applicable_to?: string;
    scope?: string;
    general?: string;
  } = {};

  if (!name?.trim()) {
    errors.name = "Template name is required";
  }

  if (!discountType) {
    errors.discount_type = "Discount type is required";
  }

  if (!discountValue || discountValue <= 0) {
    errors.discount_value = "Discount value must be greater than 0";
  }

  if (discountType === "percentage" && discountValue > 100) {
    errors.discount_value = "Percentage discount cannot exceed 100%";
  }

  if (!usageType) {
    errors.usage_type = "Usage type is required";
  }

  if (!applicableTo || applicableTo.length === 0) {
    errors.applicable_to = "At least one payment type must be selected";
  }

  if (!scope) {
    errors.scope = "Scope is required";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  try {
    await DiscountTemplateService.updateTemplate(templateId, {
      name,
      description: description || undefined,
      discount_type: discountType,
      discount_value: discountType === 'fixed_amount' ? fromDollars(discountValue) : discountValue,
      usage_type: usageType,
      max_uses: maxUses,
      applicable_to: applicableTo,
      scope,
      is_active: isActive,
    });

    return redirect("/admin/discount-templates");
  } catch {
    return json(
      { errors: { general: "Failed to update template. Please try again." } },
      { status: 500 }
    );
  }
}

export default function EditDiscountTemplate() {
  const { template } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen page-background-styles py-12 text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md backdrop-blur-lg border dark:border-gray-700">
          <AppBreadcrumb items={breadcrumbPatterns.adminDiscountTemplateEdit(template.name)} className="mb-6" />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-green-600 dark:text-green-400">Edit Discount Template</h1>
            <p className="text-muted-foreground mt-2">
              Update the template properties
            </p>
          </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-6">
            <CardTitle className="text-xl">Template Details</CardTitle>
            <CardDescription>
              Modify the template properties that will be used when creating new discounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-8">
              <AuthenticityTokenInput />
            {actionData?.errors?.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {actionData.errors.general}
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">TEMPLATE INFORMATION</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium mb-1">Template Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={template.name}
                    className={`input-custom-styles ${actionData?.errors?.name ? "border-red-500" : ""}`}
                    tabIndex={1}
                  />
                  {actionData?.errors?.name && (
                    <p className="text-sm text-red-500">{actionData.errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discount_type" className="text-sm font-medium mb-1">Discount Type *</Label>
                  <Select name="discount_type" defaultValue={template.discount_type}>
                    <SelectTrigger className={`input-custom-styles ${actionData?.errors?.discount_type ? "border-red-500" : ""}`} tabIndex={2}>
                      <SelectValue placeholder="Select discount type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                  {actionData?.errors?.discount_type && (
                    <p className="text-sm text-red-500">{actionData.errors.discount_type}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium mb-1">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={template.description || ""}
                  placeholder="Optional description for this template"
                  rows={3}
                  className="input-custom-styles"
                  tabIndex={3}
                />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">DISCOUNT SETTINGS</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="discount_value" className="text-sm font-medium mb-1">Discount Value *</Label>
                  <Input
                    id="discount_value"
                    name="discount_value"
                    type="number"
                    step="0.0001"
                    min="0"
                    defaultValue={template.discount_value}
                    placeholder="e.g., 10 or 82.6447"
                    className={`input-custom-styles ${actionData?.errors?.discount_value ? "border-red-500" : ""}`}
                    tabIndex={4}
                  />
                  {actionData?.errors?.discount_value && (
                    <p className="text-sm text-red-500">{actionData.errors.discount_value}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="usage_type" className="text-sm font-medium mb-1">Usage Type *</Label>
                  <Select name="usage_type" defaultValue={template.usage_type}>
                    <SelectTrigger className={`input-custom-styles ${actionData?.errors?.usage_type ? "border-red-500" : ""}`} tabIndex={5}>
                      <SelectValue placeholder="Select usage type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_time">One Time</SelectItem>
                      <SelectItem value="ongoing">Ongoing</SelectItem>
                    </SelectContent>
                  </Select>
                  {actionData?.errors?.usage_type && (
                    <p className="text-sm text-red-500">{actionData.errors.usage_type}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="max_uses" className="text-sm font-medium mb-1">Max Uses (Optional)</Label>
                  <Input
                    id="max_uses"
                    name="max_uses"
                    type="number"
                    min="1"
                    defaultValue={template.max_uses || ""}
                    placeholder="Leave empty for unlimited"
                    className="input-custom-styles"
                    tabIndex={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scope" className="text-sm font-medium mb-1">Scope *</Label>
                  <Select name="scope" defaultValue={template.scope}>
                    <SelectTrigger className={`input-custom-styles ${actionData?.errors?.scope ? "border-red-500" : ""}`} tabIndex={7}>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_student">Per Student</SelectItem>
                      <SelectItem value="per_family">Per Family</SelectItem>
                    </SelectContent>
                  </Select>
                  {actionData?.errors?.scope && (
                    <p className="text-sm text-red-500">{actionData.errors.scope}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">APPLICABLE TO</h2>
              <div className="space-y-3">
                <Label className="text-sm font-medium mb-1">Payment Types *</Label>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="monthly_group" 
                      name="applicable_to" 
                      value="monthly_group" 
                      defaultChecked={template.applicable_to.includes('monthly_group')}
                      tabIndex={8}
                    />
                    <Label htmlFor="monthly_group" className="text-sm font-medium">Monthly Group</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="yearly_group" 
                      name="applicable_to" 
                      value="yearly_group" 
                      defaultChecked={template.applicable_to.includes('yearly_group')}
                      tabIndex={9}
                    />
                    <Label htmlFor="yearly_group" className="text-sm font-medium">Yearly Group</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="individual_session" 
                      name="applicable_to" 
                      value="individual_session" 
                      defaultChecked={template.applicable_to.includes('individual_session')}
                      tabIndex={10}
                    />
                    <Label htmlFor="individual_session" className="text-sm font-medium">Individual Session</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="store_purchase" 
                      name="applicable_to" 
                      value="store_purchase" 
                      defaultChecked={template.applicable_to.includes('store_purchase')}
                      tabIndex={11}
                    />
                    <Label htmlFor="store_purchase" className="text-sm font-medium">Store Purchase</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="other" 
                      name="applicable_to" 
                      value="other" 
                      defaultChecked={template.applicable_to.includes('other')}
                      tabIndex={12}
                    />
                    <Label htmlFor="other" className="text-sm font-medium">Other</Label>
                  </div>
                </div>
                {actionData?.errors?.applicable_to && (
                  <p className="text-sm text-red-500">{actionData.errors.applicable_to}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="is_active" name="is_active" defaultChecked={template.is_active} tabIndex={13} />
              <Label htmlFor="is_active">Active Template</Label>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting} tabIndex={14}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Updating..." : "Update Template"}
              </Button>
              <Button type="button" variant="outline" asChild tabIndex={15}>
                <Link to="/admin/discount-templates">Cancel</Link>
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" className="ml-auto" tabIndex={16}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Template
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the discount template &ldquo;{template.name}&rdquo;.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel tabIndex={17}>Cancel</AlertDialogCancel>
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <AlertDialogAction type="submit" className="bg-red-600 hover:bg-red-700" tabIndex={18}>
                        Delete Template
                      </AlertDialogAction>
                    </Form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Form>
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}
