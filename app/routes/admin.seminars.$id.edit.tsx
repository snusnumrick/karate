import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, Link } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { getProgramById, updateProgram } from "~/services/program.server";
import { getProgramRequiredWaivers, addProgramWaiver, removeProgramWaiver, updateProgramWaiver } from "~/services/waiver.server";
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
import type { UpdateProgramData } from "~/types/multi-class";
import { toMoney, isNegative, serializeMoney } from "~/utils/money";
import type { MoneyJSON } from "~/utils/money";
import { getSupabaseAdminClient } from "~/utils/supabase.server";

type ActionData = {
  errors?: {
    name?: string;
    slug?: string;
    min_age?: string;
    max_age?: string;
    single_purchase_price?: string;
    general?: string;
  };
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  const { id } = params;

  if (!id) {
    throw new Response("Not Found", { status: 404 });
  }

  const seminar = await getProgramById(id);

  if (!seminar || seminar.engagement_type !== 'seminar') {
    throw new Response("Seminar not found", { status: 404 });
  }

  // Get all available waivers
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: allWaivers } = await supabaseAdmin
    .from('waivers')
    .select('*')
    .order('title', { ascending: true });

  // Get seminar-specific waivers
  const seminarWaivers = await getProgramRequiredWaivers(id);

  return json({
    seminar: {
      ...seminar,
      monthly_fee: seminar.monthly_fee ? serializeMoney(seminar.monthly_fee) : undefined,
      registration_fee: seminar.registration_fee ? serializeMoney(seminar.registration_fee) : undefined,
      yearly_fee: seminar.yearly_fee ? serializeMoney(seminar.yearly_fee) : undefined,
      individual_session_fee: seminar.individual_session_fee ? serializeMoney(seminar.individual_session_fee) : undefined,
      single_purchase_price: seminar.single_purchase_price ? serializeMoney(seminar.single_purchase_price) : undefined,
      subscription_monthly_price: seminar.subscription_monthly_price ? serializeMoney(seminar.subscription_monthly_price) : undefined,
      subscription_yearly_price: seminar.subscription_yearly_price ? serializeMoney(seminar.subscription_yearly_price) : undefined,
    },
    allWaivers: allWaivers ?? [],
    seminarWaivers: seminarWaivers,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdminUser(request);
  await csrf.validate(request);
  const { id } = params;

  if (!id) {
    throw new Response("Not Found", { status: 404 });
  }

  const formData = await request.formData();

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string;

  // Seminar-specific fields
  const abilityCategory = formData.get("ability_category") as string || undefined;
  const seminarType = formData.get("seminar_type") as string || undefined;
  const audienceScope = formData.get("audience_scope") as string || undefined;

  // Capacity
  const minCapacity = formData.get("min_capacity") ? parseInt(formData.get("min_capacity") as string) : undefined;
  const maxCapacity = formData.get("max_capacity") ? parseInt(formData.get("max_capacity") as string) : undefined;

  // Session frequency
  const sessionsPerWeek = formData.get("sessions_per_week") ? parseInt(formData.get("sessions_per_week") as string) : undefined;

  // Belt requirements
  const beltRankRequired = formData.get("belt_rank_required") === "on";
  const minBeltRank = formData.get("min_belt_rank") as string || undefined;
  const maxBeltRank = formData.get("max_belt_rank") as string || undefined;

  // Age constraints
  const minAge = formData.get("min_age") ? parseInt(formData.get("min_age") as string) : undefined;
  const maxAge = formData.get("max_age") ? parseInt(formData.get("max_age") as string) : undefined;
  const genderRestriction = formData.get("gender_restriction") as string || undefined;
  const specialNeedsSupport = formData.get("special_needs_support") === "on";

  // Pricing
  const seminarPriceValue = formData.get("seminar_price") as string;
  const seminarPrice = seminarPriceValue ? toMoney(seminarPriceValue) : undefined;
  const registrationFeeValue = formData.get("registration_fee") as string;
  const registrationFee = registrationFeeValue ? toMoney(registrationFeeValue) : undefined;

  const isActive = formData.get("is_active") === "on";

  // Validation
  const errors: ActionData['errors'] = {};

  if (!name?.trim()) {
    errors.name = "Seminar name is required";
  }

  if (slug && !/^[a-z0-9-]+$/.test(slug)) {
    errors.slug = "Slug must contain only lowercase letters, numbers, and hyphens";
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

  if (seminarPrice !== undefined && isNegative(seminarPrice)) {
    errors.single_purchase_price = "Seminar price cannot be negative";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  try {
    const updateData: Partial<UpdateProgramData> = {
      name,
      description: description || undefined,
      // Seminar-specific
      ability_category: abilityCategory as 'able' | 'adaptive' | undefined,
      seminar_type: seminarType as 'introductory' | 'intermediate' | 'advanced' | undefined,
      audience_scope: audienceScope as 'youth' | 'adults' | 'mixed' | undefined,
      slug: slug || undefined,
      // Capacity constraints
      min_capacity: minCapacity,
      max_capacity: maxCapacity,
      // Frequency constraints
      sessions_per_week: sessionsPerWeek,
      // Belt requirements
      belt_rank_required: beltRankRequired,
      min_belt_rank: minBeltRank as 'white' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'brown' | 'black' | undefined,
      max_belt_rank: maxBeltRank as 'white' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'brown' | 'black' | undefined,
      // Age and demographic constraints
      min_age: minAge,
      max_age: maxAge,
      gender_restriction: genderRestriction as 'male' | 'female' | 'none' | undefined,
      special_needs_support: specialNeedsSupport,
      // Pricing structure
      single_purchase_price: seminarPrice,
      registration_fee: registrationFee,
      // System fields
      is_active: isActive,
    };

    await updateProgram(id, updateData);

    // Handle waiver assignments
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: allWaivers } = await supabaseAdmin
      .from('waivers')
      .select('id')
      .order('id');

    if (allWaivers) {
      for (const waiver of allWaivers) {
        const waiverId = waiver.id;
        const isRequired = formData.get(`waiver_required_${waiverId}`) === 'on';
        const requiredForTrial = formData.get(`waiver_trial_${waiverId}`) === 'on';
        const requiredForFull = formData.get(`waiver_full_${waiverId}`) === 'on';

        // Check if this waiver is currently assigned to the seminar
        const { data: existingAssignment } = await supabaseAdmin
          .from('program_waivers')
          .select('*')
          .eq('program_id', id)
          .eq('waiver_id', waiverId)
          .single();

        if (isRequired) {
          // Add or update the waiver assignment
          if (existingAssignment) {
            await updateProgramWaiver(id, waiverId, {
              is_required: true,
              required_for_trial: requiredForTrial,
              required_for_full_enrollment: requiredForFull,
            });
          } else {
            await addProgramWaiver(id, waiverId, {
              is_required: true,
              required_for_trial: requiredForTrial,
              required_for_full_enrollment: requiredForFull,
            });
          }
        } else if (existingAssignment) {
          // Remove the waiver assignment if it exists but is no longer required
          await removeProgramWaiver(id, waiverId);
        }
      }
    }

    return redirect("/admin/programs?filter=seminar");
  } catch (error) {
    console.error("Error updating seminar:", error);
    return json<ActionData>({
      errors: { general: "Failed to update seminar. Please try again." }
    }, { status: 500 });
  }
}

export default function EditSeminar() {
  const { seminar, allWaivers, seminarWaivers } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const moneyToString = (money: MoneyJSON | undefined) => {
    if (!money) return "";
    return (money.amount / 100).toString();
  };

  // Create a map of waiver_id -> seminar waiver settings for quick lookup
  const seminarWaiverMap = new Map(
    seminarWaivers.map(pw => [pw.waiver_id, pw])
  );

  return (
    <div className="space-y-6">
      <AppBreadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Programs", href: "/admin/programs" },
          { label: seminar.name }
        ]}
        className="mb-6"
      />

      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Seminar</h1>
          <p className="text-muted-foreground">
            Update seminar template settings and configuration
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
                    defaultValue={seminar.name}
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
                    defaultValue={seminar.slug || ''}
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
                  defaultValue={seminar.description || ''}
                  placeholder="Describe the seminar content, objectives, and what participants will learn..."
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  Session duration will be set at the series level when creating specific seminar offerings.
                </p>
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
                  <Select name="ability_category" defaultValue={seminar.ability_category || undefined}>
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
                  <Label htmlFor="seminar_type">Seminar Type</Label>
                  <Select name="seminar_type" defaultValue={seminar.seminar_type || undefined}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="introductory">Introductory</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audience_scope">Target Audience *</Label>
                  <Select name="audience_scope" defaultValue={seminar.audience_scope || 'youth'}>
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
                    defaultValue={seminar.min_capacity || ''}
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
                    defaultValue={seminar.max_capacity || ''}
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
                    defaultValue={seminar.sessions_per_week || 1}
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
                    defaultValue={seminar.min_age || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_age">Maximum Age</Label>
                  <Input
                    id="max_age"
                    name="max_age"
                    type="number"
                    min="0"
                    defaultValue={seminar.max_age || ''}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="belt_rank_required"
                  name="belt_rank_required"
                  defaultChecked={seminar.belt_rank_required || false}
                />
                <Label htmlFor="belt_rank_required">Require specific belt rank</Label>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="gender_restriction">Gender Restriction</Label>
                  <Select name="gender_restriction" defaultValue={seminar.gender_restriction || 'none'}>
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
                    <Checkbox
                      id="special_needs_support"
                      name="special_needs_support"
                      defaultChecked={seminar.special_needs_support || false}
                    />
                    <Label htmlFor="special_needs_support">Offers special needs support</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold">Pricing</h3>
                <p className="text-sm text-muted-foreground">Set default pricing for this seminar</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="seminar_price">Default Seminar Price</Label>
                  <Input
                    id="seminar_price"
                    name="seminar_price"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={moneyToString(seminar.single_purchase_price)}
                    placeholder="0.00"
                  />
                  <p className="text-sm text-muted-foreground">
                    This price will be used for all series unless overridden at the series level
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registration_fee">Registration Fee (optional)</Label>
                  <Input
                    id="registration_fee"
                    name="registration_fee"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={moneyToString(seminar.registration_fee)}
                    placeholder="0.00"
                  />
                  <p className="text-sm text-muted-foreground">
                    One-time fee charged in addition to seminar price
                  </p>
                </div>
              </div>
            </div>

            {/* Waiver Requirements Section */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold">Waiver Requirements</h3>
                <p className="text-sm text-muted-foreground">
                  Select which waivers are required for this seminar. You can specify different requirements for trial vs full enrollment.
                </p>
              </div>

              {allWaivers.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 px-3 bg-muted/30 rounded-lg">
                  No waivers available. <Link to="/admin/waivers/new" className="text-primary hover:underline">Create a waiver</Link> first.
                </div>
              ) : (
                <div className="space-y-3">
                  {allWaivers.map((waiver) => {
                    const seminarWaiver = seminarWaiverMap.get(waiver.id);
                    const isAssigned = !!seminarWaiver;

                    return (
                      <div key={waiver.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id={`waiver_required_${waiver.id}`}
                            name={`waiver_required_${waiver.id}`}
                            defaultChecked={isAssigned}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <Label htmlFor={`waiver_required_${waiver.id}`} className="text-sm font-medium cursor-pointer">
                              {waiver.title}
                            </Label>
                            {waiver.description && (
                              <p className="text-xs text-muted-foreground mt-1">{waiver.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Nested checkboxes for enrollment type */}
                        <div className="ml-8 pl-4 border-l-2 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`waiver_trial_${waiver.id}`}
                              name={`waiver_trial_${waiver.id}`}
                              defaultChecked={seminarWaiver?.required_for_trial ?? false}
                              className="h-4 w-4"
                            />
                            <Label htmlFor={`waiver_trial_${waiver.id}`} className="text-xs cursor-pointer">
                              Required for trial enrollment
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`waiver_full_${waiver.id}`}
                              name={`waiver_full_${waiver.id}`}
                              defaultChecked={seminarWaiver?.required_for_full_enrollment ?? true}
                              className="h-4 w-4"
                            />
                            <Label htmlFor={`waiver_full_${waiver.id}`} className="text-xs cursor-pointer">
                              Required for full enrollment
                            </Label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  name="is_active"
                  defaultChecked={seminar.is_active}
                />
                <Label htmlFor="is_active">Active (visible to users)</Label>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
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
