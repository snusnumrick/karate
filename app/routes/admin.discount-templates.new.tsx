import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation, Link } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { DiscountTemplateService } from "~/services/discount-template.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Save } from "lucide-react";
import type { DiscountType, UsageType, PaymentTypeEnum, DiscountScope } from "~/types/discount";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

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



export async function action({ request }: ActionFunctionArgs) {
  await requireAdminUser(request);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const discountType = formData.get("discount_type") as DiscountType;
  const discountValue = parseFloat(formData.get("discount_value") as string);
  const usageType = formData.get("usage_type") as UsageType;
  const maxUses = formData.get("max_uses") ? parseInt(formData.get("max_uses") as string) : undefined;
  const applicableTo = formData.getAll("applicable_to").map(value => value.toString()) as PaymentTypeEnum[];
  const scope = formData.get("scope") as DiscountScope;
  // const isActive = formData.get("is_active") === "on";

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
    await DiscountTemplateService.createTemplate({
      name,
      description: description || undefined,
      discount_type: discountType,
      discount_value: discountValue,
      usage_type: usageType,
      max_uses: maxUses,
      applicable_to: applicableTo,
      scope,
    });

    return redirect("/admin/discount-templates");
  } catch (error) {
    return json(
      { errors: { general: "Failed to create template. Please try again." } },
      { status: 500 }
    );
  }
}

export default function NewDiscountTemplate() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen page-background-styles py-12 text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md backdrop-blur-lg border dark:border-gray-700">
          <AppBreadcrumb 
            items={breadcrumbPatterns.adminDiscountTemplateNew()} 
            className="mb-6"
          />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">Create Discount Template</h1>
            <p className="text-muted-foreground">
              Create a reusable template for quick discount creation
            </p>
          </div>
          <Form method="post" className="space-y-8">
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
                    placeholder="e.g., Student Discount Template"
                    className={`input-custom-styles ${actionData?.errors?.name ? "border-red-500" : ""}`}
                    tabIndex={1}
                  />
                  {actionData?.errors?.name && (
                    <p className="text-sm text-red-500">{actionData.errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discount_type" className="text-sm font-medium mb-1">Discount Type *</Label>
                  <Select name="discount_type">
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
                  <Select name="usage_type">
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
                    placeholder="Leave empty for unlimited"
                    className="input-custom-styles"
                    tabIndex={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scope" className="text-sm font-medium mb-1">Scope *</Label>
                  <Select name="scope">
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
                      tabIndex={8}
                    />
                    <Label htmlFor="monthly_group" className="text-sm font-medium">Monthly Group</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="yearly_group" 
                      name="applicable_to" 
                      value="yearly_group" 
                      tabIndex={9}
                    />
                    <Label htmlFor="yearly_group" className="text-sm font-medium">Yearly Group</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="individual_session" 
                      name="applicable_to" 
                      value="individual_session" 
                      tabIndex={10}
                    />
                    <Label htmlFor="individual_session" className="text-sm font-medium">Individual Session</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="store_purchase" 
                      name="applicable_to" 
                      value="store_purchase" 
                      tabIndex={11}
                    />
                    <Label htmlFor="store_purchase" className="text-sm font-medium">Store Purchase</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="other" 
                      name="applicable_to" 
                      value="other" 
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
              <Checkbox id="is_active" name="is_active" defaultChecked tabIndex={13} />
              <Label htmlFor="is_active">Active Template</Label>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting} tabIndex={14}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Creating..." : "Create Template"}
              </Button>
              <Button type="button" variant="outline" asChild tabIndex={15}>
                <Link to="/admin/discount-templates">Cancel</Link>
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
