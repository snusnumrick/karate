import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation, Link } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { DiscountTemplateService } from "~/services/discount-template.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { ArrowLeft, Save } from "lucide-react";
import type { DiscountType, UsageType, PaymentTypeEnum, DiscountScope } from "~/types/discount";

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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/discount-templates">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Discount Template</h1>
          <p className="text-muted-foreground">
            Create a reusable template for quick discount creation
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
          <CardDescription>
            Define the template properties that will be used when creating new discounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-6">
            {actionData?.errors?.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {actionData.errors.general}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Student Discount Template"
                  className={actionData?.errors?.name ? "border-red-500" : ""}
                />
                {actionData?.errors?.name && (
                  <p className="text-sm text-red-500">{actionData.errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount_type">Discount Type *</Label>
                <Select name="discount_type">
                  <SelectTrigger className={actionData?.errors?.discount_type ? "border-red-500" : ""}>
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Optional description for this template"
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discount_value">Discount Value *</Label>
                <Input
                  id="discount_value"
                  name="discount_value"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 10 or 15.50"
                  className={actionData?.errors?.discount_value ? "border-red-500" : ""}
                />
                {actionData?.errors?.discount_value && (
                  <p className="text-sm text-red-500">{actionData.errors.discount_value}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="usage_type">Usage Type *</Label>
                <Select name="usage_type">
                  <SelectTrigger className={actionData?.errors?.usage_type ? "border-red-500" : ""}>
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
                <Label htmlFor="max_uses">Max Uses (Optional)</Label>
                <Input
                  id="max_uses"
                  name="max_uses"
                  type="number"
                  min="1"
                  placeholder="Leave empty for unlimited"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scope">Scope *</Label>
                <Select name="scope">
                  <SelectTrigger className={actionData?.errors?.scope ? "border-red-500" : ""}>
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

            <div className="space-y-3">
              <Label>Applicable To *</Label>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="monthly_group" name="applicable_to" value="monthly_group" />
                  <Label htmlFor="monthly_group">Monthly Group</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="yearly_group" name="applicable_to" value="yearly_group" />
                  <Label htmlFor="yearly_group">Yearly Group</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="individual_session" name="applicable_to" value="individual_session" />
                  <Label htmlFor="individual_session">Individual Session</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="store_purchase" name="applicable_to" value="store_purchase" />
                  <Label htmlFor="store_purchase">Store Purchase</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="other" name="applicable_to" value="other" />
                  <Label htmlFor="other">Other</Label>
                </div>
              </div>
              {actionData?.errors?.applicable_to && (
                <p className="text-sm text-red-500">{actionData.errors.applicable_to}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="is_active" name="is_active" defaultChecked />
              <Label htmlFor="is_active">Active Template</Label>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Creating..." : "Create Template"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/admin/discount-templates">Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}