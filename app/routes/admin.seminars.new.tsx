import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { createProgram } from "~/services/program.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { csrf } from "~/utils/csrf.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { BookOpen } from "lucide-react";
import { AppBreadcrumb } from "~/components/AppBreadcrumb";
import type { CreateProgramData } from "~/types/multi-class";
import { toMoney, isNegative, ZERO_MONEY } from "~/utils/money";

type ActionData = {
  errors?: {
    name?: string;
    slug?: string;
    duration_minutes?: string;
    min_age?: string;
    max_age?: string;
    single_purchase_price?: string;
    subscription_monthly_price?: string;
    subscription_yearly_price?: string;
    general?: string;
  };
};

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminUser(request);
  await csrf.validate(request);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string;
  const durationMinutes = formData.get("duration_minutes") ? parseInt(formData.get("duration_minutes") as string) : 60;

  // Seminar-specific fields
  const abilityCategory = formData.get("ability_category") as string || undefined;
  const deliveryFormat = formData.get("delivery_format") as string || undefined;
  const audienceScope = formData.get("audience_scope") as string || "youth";

  // Capacity
  const minCapacity = formData.get("min_capacity") ? parseInt(formData.get("min_capacity") as string) : undefined;
  const maxCapacity = formData.get("max_capacity") ? parseInt(formData.get("max_capacity") as string) : undefined;

  // Session frequency
  const sessionsPerWeek = formData.get("sessions_per_week") ? parseInt(formData.get("sessions_per_week") as string) : 1;

  // Belt requirements
  const beltRankRequired = formData.get("belt_rank_required") === "on";
  const minBeltRank = formData.get("min_belt_rank") as string || undefined;
  const maxBeltRank = formData.get("max_belt_rank") as string || undefined;

  // Age constraints
  const minAge = formData.get("min_age") ? parseInt(formData.get("min_age") as string) : undefined;
  const maxAge = formData.get("max_age") ? parseInt(formData.get("max_age") as string) : undefined;
  const genderRestriction = formData.get("gender_restriction") as string || "none";
  const specialNeedsSupport = formData.get("special_needs_support") === "on";

  // Pricing
  const singlePurchasePrice = formData.get("single_purchase_price") ? toMoney(formData.get("single_purchase_price")) : undefined;
  const subscriptionMonthlyPrice = formData.get("subscription_monthly_price") ? toMoney(formData.get("subscription_monthly_price")) : undefined;
  const subscriptionYearlyPrice = formData.get("subscription_yearly_price") ? toMoney(formData.get("subscription_yearly_price")) : undefined;
  const registrationFee = formData.get("registration_fee") ? toMoney(formData.get("registration_fee")) : ZERO_MONEY;

  const isActive = formData.get("is_active") === "on";

  // Validation
  const errors: ActionData['errors'] = {};

  if (!name?.trim()) {
    errors.name = "Seminar name is required";
  }

  if (slug && !/^[a-z0-9-]+$/.test(slug)) {
    errors.slug = "Slug must contain only lowercase letters, numbers, and hyphens";
  }

  if (durationMinutes <= 0) {
    errors.duration_minutes = "Duration must be greater than 0";
  }

  if (minAge !== undefined && minAge < 0) {
    errors.min_age = "Minimum age cannot be negative";
  }

  if (maxAge !== undefined && maxAge < 0) {
    errors.max_age = "Maximum age cannot be negative";
  }

  if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
    errors.max_age = "Maximum age must be greater than or equal to minimum age";
  }

  if (singlePurchasePrice !== undefined && isNegative(singlePurchasePrice)) {
    errors.single_purchase_price = "Single purchase price cannot be negative";
  }

  if (subscriptionMonthlyPrice !== undefined && isNegative(subscriptionMonthlyPrice)) {
    errors.subscription_monthly_price = "Monthly price cannot be negative";
  }

  if (subscriptionYearlyPrice !== undefined && isNegative(subscriptionYearlyPrice)) {
    errors.subscription_yearly_price = "Yearly price cannot be negative";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  try {
    const programData = {
      name,
      description: description || undefined,
      duration_minutes: durationMinutes,
      // Seminar-specific
      engagement_type: 'seminar',
      ability_category: abilityCategory,
      delivery_format: deliveryFormat,
      audience_scope: audienceScope,
      slug: slug || undefined,
      // Capacity constraints
      min_capacity: minCapacity,
      max_capacity: maxCapacity,
      // Frequency constraints
      sessions_per_week: sessionsPerWeek,
      // Belt requirements
      belt_rank_required: beltRankRequired,
      min_belt_rank: minBeltRank,
      max_belt_rank: maxBeltRank,
      // Age and demographic constraints
      min_age: minAge,
      max_age: maxAge,
      gender_restriction: genderRestriction as 'male' | 'female' | 'none',
      special_needs_support: specialNeedsSupport,
      // Pricing structure
      single_purchase_price: singlePurchasePrice,
      subscription_monthly_price: subscriptionMonthlyPrice,
      subscription_yearly_price: subscriptionYearlyPrice,
      registration_fee: registrationFee,
      // System fields
      is_active: isActive,
    } as CreateProgramData;

    await createProgram(programData);
    return redirect("/admin/programs?filter=seminar");
  } catch (error) {
    console.error("Error creating seminar:", error);
    return json<ActionData>({
      errors: { general: "Failed to create seminar. Please try again." }
    }, { status: 500 });
  }
}

export default function NewSeminar() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      <AppBreadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Programs", href: "/admin/programs" },
          { label: "New Seminar" }
        ]}
        className="mb-6"
      />

      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Seminar</h1>
          <p className="text-muted-foreground">
            Set up a new seminar template for multi-session training programs
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Seminar Details</CardTitle>
              <CardDescription className="text-base mt-1">
                Configure the seminar template, pricing, and eligibility requirements
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Form method="post" className="space-y-8">
            <AuthenticityTokenInput />
            {actionData?.errors?.general && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
                {actionData.errors.general}
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <p className="text-sm text-muted-foreground">General seminar details and description</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Seminar Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., Instructor Certification Seminar"
                    required
                  />
                  {actionData?.errors?.name && (
                    <p className="text-sm text-red-600">{actionData.errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug (optional)</Label>
                  <Input
                    id="slug"
                    name="slug"
                    placeholder="e.g., instructor-certification"
                  />
                  {actionData?.errors?.slug && (
                    <p className="text-sm text-red-600">{actionData.errors.slug}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Lowercase letters, numbers, and hyphens only
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe the seminar content, objectives, and what participants will learn..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration_minutes">Session Duration (minutes) *</Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  defaultValue="60"
                  min="1"
                  required
                />
                {actionData?.errors?.duration_minutes && (
                  <p className="text-sm text-red-600">{actionData.errors.duration_minutes}</p>
                )}
              </div>
            </div>

            {/* Marketing & Categorization */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold">Marketing & Categorization</h3>
                <p className="text-sm text-muted-foreground">Help users find this seminar</p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="ability_category">Ability Category</Label>
                  <Select name="ability_category">
                    <SelectTrigger>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="able">Able-bodied</SelectItem>
                      <SelectItem value="adaptive">Adaptive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_format">Delivery Format</Label>
                  <Select name="delivery_format">
                    <SelectTrigger>
                      <SelectValue placeholder="Select format..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="group">Group</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="competition_individual">Competition (Individual)</SelectItem>
                      <SelectItem value="competition_team">Competition (Team)</SelectItem>
                      <SelectItem value="introductory">Introductory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audience_scope">Target Audience *</Label>
                  <Select name="audience_scope" defaultValue="youth">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youth">Youth</SelectItem>
                      <SelectItem value="adults">Adults</SelectItem>
                      <SelectItem value="mixed">Mixed (Youth & Adults)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Capacity & Scheduling */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold">Capacity & Scheduling</h3>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="min_capacity">Minimum Capacity</Label>
                  <Input
                    id="min_capacity"
                    name="min_capacity"
                    type="number"
                    min="1"
                    placeholder="e.g., 5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_capacity">Maximum Capacity</Label>
                  <Input
                    id="max_capacity"
                    name="max_capacity"
                    type="number"
                    min="1"
                    placeholder="e.g., 20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sessions_per_week">Sessions per Week</Label>
                  <Input
                    id="sessions_per_week"
                    name="sessions_per_week"
                    type="number"
                    min="1"
                    defaultValue="1"
                  />
                </div>
              </div>
            </div>

            {/* Eligibility Requirements */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold">Eligibility Requirements</h3>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="min_age">Minimum Age</Label>
                  <Input
                    id="min_age"
                    name="min_age"
                    type="number"
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_age">Maximum Age</Label>
                  <Input
                    id="max_age"
                    name="max_age"
                    type="number"
                    min="0"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="belt_rank_required" name="belt_rank_required" />
                <Label htmlFor="belt_rank_required">Require specific belt rank</Label>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="gender_restriction">Gender Restriction</Label>
                  <Select name="gender_restriction" defaultValue="none">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="special_needs_support" name="special_needs_support" />
                    <Label htmlFor="special_needs_support">Offers special needs support</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold">Pricing</h3>
                <p className="text-sm text-muted-foreground">Set pricing for different payment options</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="single_purchase_price">Single Purchase Price</Label>
                  <Input
                    id="single_purchase_price"
                    name="single_purchase_price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registration_fee">Registration Fee</Label>
                  <Input
                    id="registration_fee"
                    name="registration_fee"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscription_monthly_price">Monthly Subscription</Label>
                  <Input
                    id="subscription_monthly_price"
                    name="subscription_monthly_price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscription_yearly_price">Yearly Subscription</Label>
                  <Input
                    id="subscription_yearly_price"
                    name="subscription_yearly_price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="is_active" name="is_active" defaultChecked />
                <Label htmlFor="is_active">Active (visible to users)</Label>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Seminar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => window.history.back()}>
                Cancel
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
