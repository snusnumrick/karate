import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, Link } from "@remix-run/react";
import { withAdminLoader, withAdminAction } from "~/utils/auth.server";
import { createProgram } from "~/services/program.server";
import { addProgramWaiver } from "~/services/waiver.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { csrf } from "~/utils/csrf.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Plus } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import type { CreateProgramData } from "~/types/multi-class";
import {toMoney, isNegative} from "~/utils/money";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { cn } from "~/lib/utils";

type ActionData = {
  errors?: {
    name?: string;
    duration_minutes?: string;
    min_age?: string;
    max_age?: string;
    monthly_fee?: string;
    yearly_fee?: string;
    individual_session_fee?: string;
    general?: string;
  };
};

async function loaderImpl({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const engagement = url.searchParams.get("engagement") === "seminar" ? "seminar" : "program";

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: allWaivers } = await supabaseAdmin
    .from('waivers')
    .select('*')
    .order('title', { ascending: true });

  return json({
    allWaivers: allWaivers ?? [],
    engagement,
  });
}

export const loader = withAdminLoader(loaderImpl);

async function actionImpl({ request }: ActionFunctionArgs) {
  await csrf.validate(request);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const durationMinutes = formData.get("duration_minutes") ? parseInt(formData.get("duration_minutes") as string) : undefined;

  // Capacity and frequency fields
  const maxCapacity = formData.get("max_capacity") ? parseInt(formData.get("max_capacity") as string) : undefined;
  const sessionsPerWeek = formData.get("sessions_per_week") ? parseInt(formData.get("sessions_per_week") as string) : undefined;
  const minSessionsPerWeek = formData.get("min_sessions_per_week") ? parseInt(formData.get("min_sessions_per_week") as string) : undefined;
  const maxSessionsPerWeek = formData.get("max_sessions_per_week") ? parseInt(formData.get("max_sessions_per_week") as string) : undefined;

  // Belt requirements
  const beltRankRequired = formData.get("belt_rank_required") === "on";
  const minBeltRank = formData.get("min_belt_rank") as string || undefined;
  const maxBeltRank = formData.get("max_belt_rank") as string || undefined;

  // Age and demographic constraints
  const minAge = formData.get("min_age") ? parseInt(formData.get("min_age") as string) : undefined;
  const maxAge = formData.get("max_age") ? parseInt(formData.get("max_age") as string) : undefined;
  const genderRestriction = formData.get("gender_restriction") as string || "none";
  const specialNeedsSupport = formData.get("special_needs_support") === "on";

  // Pricing
  const engagementValueEarly = formData.get("engagement") as string;
  const isSeminarSubmit = engagementValueEarly === "seminar";
  const monthlyFee = formData.get("monthly_fee") ? toMoney(formData.get("monthly_fee")) : isSeminarSubmit ? toMoney(0) : undefined;
  const registrationFee = formData.get("registration_fee") ? toMoney(formData.get("registration_fee")) : undefined;
  const yearlyFee = formData.get("yearly_fee") ? toMoney(formData.get("yearly_fee")) : isSeminarSubmit ? toMoney(0) : undefined;
  const individualSessionFee = formData.get("individual_session_fee") ? toMoney(formData.get("individual_session_fee")) : isSeminarSubmit ? toMoney(0) : undefined;

  const isActive = formData.get("is_active") === "on";
  const engagementValue = formData.get("engagement") as string;
  const engagement = engagementValue === "seminar" ? "seminar" : "program";
  const audienceScopeValue = formData.get("audience_scope") as string;
  const audienceScope = (["youth", "adults", "mixed"].includes(audienceScopeValue) ? audienceScopeValue : "mixed") as 'youth' | 'adults' | 'mixed';

  // Validation
  const errors: {
    name?: string;
    duration_minutes?: string;
    min_age?: string;
    max_age?: string;
    monthly_fee?: string;
    yearly_fee?: string;
    individual_session_fee?: string;
    general?: string;
  } = {};

  if (!name?.trim()) {
    errors.name = "Program name is required";
  }

  if (durationMinutes !== undefined && durationMinutes <= 0) {
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

  if (monthlyFee !== undefined && isNegative(monthlyFee)) {
    errors.monthly_fee = "Monthly fee cannot be negative";
  }

  if (yearlyFee !== undefined && isNegative(yearlyFee)) {
    errors.yearly_fee = "Yearly fee cannot be negative";
  }

  if (individualSessionFee !== undefined && isNegative(individualSessionFee)) {
    errors.individual_session_fee = "Individual session fee cannot be negative";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  try {
    const programData: CreateProgramData = {
      name,
      description: description || undefined,
      duration_minutes: durationMinutes,
      // Capacity constraints
      max_capacity: maxCapacity,
      // Frequency constraints
      sessions_per_week: sessionsPerWeek,
      min_sessions_per_week: minSessionsPerWeek,
      max_sessions_per_week: maxSessionsPerWeek,
      // Belt requirements
      belt_rank_required: beltRankRequired,
      min_belt_rank: minBeltRank as 'white' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'brown' | 'black' | undefined,
      max_belt_rank: maxBeltRank as 'white' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'brown' | 'black' | undefined,
      // Age and demographic constraints
      min_age: minAge,
      max_age: maxAge,
      gender_restriction: genderRestriction as 'male' | 'female' | 'none',
      special_needs_support: specialNeedsSupport,
      // Pricing structure
      monthly_fee: monthlyFee,
      yearly_fee: yearlyFee,
      individual_session_fee: individualSessionFee,
      registration_fee: registrationFee,
      // System fields
      is_active: isActive,
      engagement_type: engagement,
      audience_scope: audienceScope,
    };

    const newProgram = await createProgram(programData);

    // Handle waiver assignments for new program
    if (newProgram?.id) {
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

          if (isRequired) {
            await addProgramWaiver(newProgram.id, waiverId, {
              is_required: true,
              required_for_trial: requiredForTrial,
              required_for_full_enrollment: requiredForFull,
            });
          }
        }
      }
    }

    return redirect(engagement === "seminar" ? "/admin/programs?engagement=seminar" : "/admin/programs");
  } catch (error) {
    console.error("Error creating program:", error);
    return json<ActionData>({
      errors: { general: "Failed to create program. Please try again." }
    }, { status: 500 });
  }
}

export const action = withAdminAction(actionImpl);

export default function NewProgram() {
  const { allWaivers, engagement } = useLoaderData<typeof loader>();
  const isSeminarView = engagement === "seminar";
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const pageTitle = isSeminarView ? "Create Seminar Template" : "Create Program";
  const pageDescription = isSeminarView
    ? "Define a reusable seminar template with pricing, eligibility, and waiver defaults."
    : "Set up a new martial arts program with pricing, eligibility, and waiver requirements.";
  const sectionClass = "rounded-xl border border-gray-200 bg-gray-50/80 p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/40";
  const sectionTitleClass = "text-lg font-semibold text-gray-900 dark:text-gray-100";
  const sectionDescriptionClass = "mt-1 text-sm text-gray-600 dark:text-gray-400";
  const helperTextClass = "text-xs text-gray-500 dark:text-gray-400";
  const toggleCardClass = "flex items-start space-x-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800";
  const waiverCardClass = "rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800";
  const primaryButtonClass = "bg-green-600 text-white shadow-sm hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500";
  const secondaryButtonClass = "border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/30 dark:hover:text-green-200";
  const checkboxClass = "checkbox-custom-styles border-green-600 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600";
  const inputClass = (hasError?: string) => cn(
    "input-custom-styles h-11 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
    hasError && "border-red-500 focus-visible:border-red-500"
  );
  const textareaClass = "input-custom-styles resize-none border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";

  return (
    <div className="min-h-screen bg-gray-50 py-12 text-foreground dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Card className="border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
          <CardHeader className="space-y-6 border-b border-gray-100 pb-8 dark:border-gray-700">
            <AppBreadcrumb
              items={isSeminarView
                ? [{ label: "Admin Dashboard", href: "/admin" }, { label: "Seminar Templates", href: "/admin/programs?engagement=seminar" }, { label: "New Seminar Template", current: true }]
                : breadcrumbPatterns.adminProgramNew()
              }
              className="mb-0"
            />

            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-green-50 p-3 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <div className="inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
                  {isSeminarView ? "Seminar Setup" : "Program Setup"}
                </div>
                <CardTitle className="mt-3 text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">
                  {pageTitle}
                </CardTitle>
                <CardDescription className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                  {pageDescription}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            <Form method="post" className="space-y-8">
              <AuthenticityTokenInput />
              <input type="hidden" name="engagement" value={engagement} />
              {actionData?.errors?.general && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  {actionData.errors.general}
                </div>
              )}

              {/* Basic Information Section */}
              <div className={sectionClass}>
                <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
                  <h3 className={sectionTitleClass}>{isSeminarView ? "Seminar Template Details" : "Program Details"}</h3>
                  <p className={sectionDescriptionClass}>{isSeminarView ? "Define the seminar template properties and configuration" : "Define the program properties and configuration"}</p>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-sm font-medium">{isSeminarView ? "Seminar Name *" : "Program Name *"}</Label>
                    <Input
                      id="name"
                      name="name"
                      required
                      placeholder="e.g., Youth Karate"
                      className={inputClass(actionData?.errors?.name)}
                      tabIndex={1}
                    />
                    {actionData?.errors?.name && (
                      <p className="flex items-center gap-1 text-sm text-red-500">
                        <span className="text-xs">⚠</span>
                        {actionData.errors.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                     <div className={toggleCardClass}>
                       <Checkbox
                         id="is_active"
                         name="is_active"
                         defaultChecked={true}
                         className={cn("mt-1", checkboxClass)}
                         tabIndex={2}
                       />
                       <div className="space-y-1">
                         <Label htmlFor="is_active" className="cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-100">
                           {isSeminarView ? "Active Seminar Template" : "Active Program"}
                         </Label>
                         <p className="text-sm text-gray-600 dark:text-gray-400">
                           {isSeminarView ? "Check to make this template available for scheduling" : "Check to make this program available for enrollment"}
                         </p>
                       </div>
                     </div>
                   </div>
                </div>

                <div className="mt-6 space-y-3">
                  <Label htmlFor="audience_scope" className="text-sm font-medium">Audience Scope *</Label>
                  <Select name="audience_scope" defaultValue={isSeminarView ? "mixed" : "youth"}>
                    <SelectTrigger className={inputClass()}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youth">Youth (children)</SelectItem>
                      <SelectItem value="adults">Adults</SelectItem>
                      <SelectItem value="mixed">Mixed (all ages)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className={helperTextClass}>
                    {isSeminarView ? "Who this seminar is open to — use Mixed for summer camps" : "Age group this program is intended for"}
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Optional description for this program"
                    rows={4}
                    className={textareaClass}
                    tabIndex={3}
                  />
                </div>
              </div>

              {/* Program Configuration Section */}
              <div className={sectionClass}>
                <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
                  <h3 className={sectionTitleClass}>Program Configuration</h3>
                  <p className={sectionDescriptionClass}>Set duration, age requirements, and special accommodations</p>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-3">
                  <div className="space-y-3">
                    <Label htmlFor="duration_minutes" className="flex items-center gap-2 text-sm font-medium">
                      <span>Session Duration (minutes)</span>
                      <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">Required</span>
                    </Label>
                    <Input
                      id="duration_minutes"
                      name="duration_minutes"
                      type="number"
                      min="1"
                      defaultValue="60"
                      placeholder="e.g., 60"
                      className={inputClass(actionData?.errors?.duration_minutes)}
                      tabIndex={4}
                    />
                    {actionData?.errors?.duration_minutes && (
                      <p className="flex items-center gap-1 text-sm text-red-500">
                        <span className="text-xs">⚠</span>
                        {actionData.errors.duration_minutes}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="min_age" className="text-sm font-medium">Minimum Age</Label>
                    <Input
                      id="min_age"
                      name="min_age"
                      type="number"
                      min="0"
                      placeholder="e.g., 5"
                      className={inputClass(actionData?.errors?.min_age)}
                      tabIndex={5}
                    />
                    {actionData?.errors?.min_age && (
                      <p className="flex items-center gap-1 text-sm text-red-500">
                        <span className="text-xs">⚠</span>
                        {actionData.errors.min_age}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="max_age" className="text-sm font-medium">Maximum Age</Label>
                    <Input
                      id="max_age"
                      name="max_age"
                      type="number"
                      min="0"
                      placeholder="e.g., 18"
                      className={inputClass(actionData?.errors?.max_age)}
                      tabIndex={6}
                    />
                    {actionData?.errors?.max_age && (
                      <p className="flex items-center gap-1 text-sm text-red-500">
                        <span className="text-xs">⚠</span>
                        {actionData.errors.max_age}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label htmlFor="gender_restriction" className="text-sm font-medium">Gender Restriction</Label>
                    <Select name="gender_restriction" defaultValue="none">
                      <SelectTrigger className={inputClass()} tabIndex={7}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Restriction</SelectItem>
                        <SelectItem value="male">Male Only</SelectItem>
                        <SelectItem value="female">Female Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className={toggleCardClass}>
                      <Checkbox
                        id="special_needs_support"
                        name="special_needs_support"
                        className={cn("mt-1", checkboxClass)}
                        tabIndex={8}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="special_needs_support" className="cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-100">
                          Special Needs Support
                        </Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Check if this program provides special accommodations
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Capacity and Frequency Section */}
              <div className={sectionClass}>
                <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
                  <h3 className={sectionTitleClass}>Capacity & Frequency</h3>
                  <p className={sectionDescriptionClass}>Set capacity limits and training frequency requirements</p>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-3">
                  <div className="space-y-3">
                    <Label htmlFor="max_capacity" className="text-sm font-medium">Max Capacity</Label>
                    <Input
                      id="max_capacity"
                      name="max_capacity"
                      type="number"
                      min="1"
                      placeholder="e.g., 20"
                      className={inputClass()}
                    />
                    <p className={helperTextClass}>Maximum students per class (leave empty for unlimited)</p>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="sessions_per_week" className="text-sm font-medium">Sessions Per Week</Label>
                    <Input
                      id="sessions_per_week"
                      name="sessions_per_week"
                      type="number"
                      min="1"
                      placeholder="e.g., 2"
                      className={inputClass()}
                    />
                    <p className={helperTextClass}>Required training frequency</p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Flexible Frequency</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        name="min_sessions_per_week"
                        type="number"
                        min="1"
                        placeholder="Min"
                        className={inputClass()}
                      />
                      <Input
                        name="max_sessions_per_week"
                        type="number"
                        min="1"
                        placeholder="Max"
                        className={inputClass()}
                      />
                    </div>
                    <p className={helperTextClass}>Optional: for flexible programs (e.g., 3-5x/week)</p>
                  </div>
                </div>
              </div>

              {/* Belt Requirements Section */}
              <div className={sectionClass}>
                <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
                  <h3 className={sectionTitleClass}>Belt Requirements</h3>
                  <p className={sectionDescriptionClass}>Set belt rank eligibility requirements</p>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-3">
                  <div className="space-y-3">
                    <div className={toggleCardClass}>
                      <Checkbox
                        id="belt_rank_required"
                        name="belt_rank_required"
                        className={cn("mt-1", checkboxClass)}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="belt_rank_required" className="cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-100">
                          Enforce Belt Requirements
                        </Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Check to require specific belt ranks for enrollment
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="min_belt_rank" className="text-sm font-medium">Minimum Belt Rank</Label>
                    <Select name="min_belt_rank">
                      <SelectTrigger className={inputClass()}>
                        <SelectValue placeholder="Select minimum belt" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="white">White Belt</SelectItem>
                        <SelectItem value="yellow">Yellow Belt</SelectItem>
                        <SelectItem value="orange">Orange Belt</SelectItem>
                        <SelectItem value="green">Green Belt</SelectItem>
                        <SelectItem value="blue">Blue Belt</SelectItem>
                        <SelectItem value="purple">Purple Belt</SelectItem>
                        <SelectItem value="red">Red Belt</SelectItem>
                        <SelectItem value="brown">Brown Belt</SelectItem>
                        <SelectItem value="black">Black Belt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="max_belt_rank" className="text-sm font-medium">Maximum Belt Rank</Label>
                    <Select name="max_belt_rank">
                      <SelectTrigger className={inputClass()}>
                        <SelectValue placeholder="Select maximum belt" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="white">White Belt</SelectItem>
                        <SelectItem value="yellow">Yellow Belt</SelectItem>
                        <SelectItem value="orange">Orange Belt</SelectItem>
                        <SelectItem value="green">Green Belt</SelectItem>
                        <SelectItem value="blue">Blue Belt</SelectItem>
                        <SelectItem value="purple">Purple Belt</SelectItem>
                        <SelectItem value="red">Red Belt</SelectItem>
                        <SelectItem value="brown">Brown Belt</SelectItem>
                        <SelectItem value="black">Black Belt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className={sectionClass}>
                <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
                  <h3 className={sectionTitleClass}>Pricing Structure</h3>
                  <p className={sectionDescriptionClass}>
                    {isSeminarView ? "Set the default registration fee for this seminar" : "Set up the fee structure for this program"}
                  </p>
                </div>

                {!isSeminarView && (
                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label htmlFor="monthly_fee" className="text-sm font-medium">Monthly Fee ($)</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                        <Input
                          id="monthly_fee"
                          name="monthly_fee"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="120.00"
                          className={cn(inputClass(actionData?.errors?.monthly_fee), "pl-8")}
                          tabIndex={9}
                        />
                      </div>
                      {actionData?.errors?.monthly_fee && (
                        <p className="flex items-center gap-1 text-sm text-red-500">
                          <span className="text-xs">⚠</span>
                          {actionData.errors.monthly_fee}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="yearly_fee" className="text-sm font-medium">Yearly Fee ($)</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                        <Input
                          id="yearly_fee"
                          name="yearly_fee"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="1200.00"
                          className={cn(inputClass(actionData?.errors?.yearly_fee), "pl-8")}
                          tabIndex={10}
                        />
                      </div>
                      {actionData?.errors?.yearly_fee && (
                        <p className="flex items-center gap-1 text-sm text-red-500">
                          <span className="text-xs">⚠</span>
                          {actionData.errors.yearly_fee}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className={cn("grid gap-6 md:grid-cols-2", !isSeminarView && "mt-6")}>
                  {!isSeminarView && (
                    <div className="space-y-3">
                      <Label htmlFor="individual_session_fee" className="text-sm font-medium">Individual Session Fee ($)</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                        <Input
                          id="individual_session_fee"
                          name="individual_session_fee"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="30.00"
                          className={cn(inputClass(actionData?.errors?.individual_session_fee), "pl-8")}
                          tabIndex={11}
                        />
                      </div>
                      {actionData?.errors?.individual_session_fee && (
                        <p className="flex items-center gap-1 text-sm text-red-500">
                          <span className="text-xs">⚠</span>
                          {actionData.errors.individual_session_fee}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-3">
                    <Label htmlFor="registration_fee" className="text-sm font-medium">
                      Registration Fee ($)
                    </Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                      <Input
                        id="registration_fee"
                        name="registration_fee"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={isSeminarView ? "150.00" : "50.00"}
                        className={cn(inputClass(), "pl-8")}
                        tabIndex={12}
                      />
                    </div>
                    {isSeminarView && (
                      <p className={helperTextClass}>Default price per registration — can be overridden per series</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Waiver Requirements Section */}
              <div className={sectionClass}>
                <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
                  <h3 className={sectionTitleClass}>Waiver Requirements</h3>
                  <p className={sectionDescriptionClass}>Select which waivers are required for this program</p>
                </div>

                {allWaivers.length === 0 ? (
                  <div className="mt-6 rounded-lg border border-gray-200 bg-white px-4 py-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    No waivers available. <Link to="/admin/waivers/new" className="font-medium text-green-600 hover:underline dark:text-green-400">Create a waiver</Link> first.
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {allWaivers.map((waiver) => (
                      <div key={waiver.id} className={waiverCardClass}>
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id={`waiver_required_${waiver.id}`}
                            name={`waiver_required_${waiver.id}`}
                            className={cn("mt-1", checkboxClass)}
                          />
                          <div className="flex-1">
                            <Label htmlFor={`waiver_required_${waiver.id}`} className="cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-100">
                              {waiver.title}
                            </Label>
                            {waiver.description && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{waiver.description}</p>
                            )}
                          </div>
                        </div>

                        {!isSeminarView && (
                          <div className="ml-8 mt-3 space-y-2 border-l-2 border-green-200 pl-4 dark:border-green-800">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`waiver_trial_${waiver.id}`}
                                name={`waiver_trial_${waiver.id}`}
                                className={cn("h-4 w-4", checkboxClass)}
                              />
                              <Label htmlFor={`waiver_trial_${waiver.id}`} className="cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                                Required for trial enrollment
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`waiver_full_${waiver.id}`}
                                name={`waiver_full_${waiver.id}`}
                                defaultChecked={true}
                                className={cn("h-4 w-4", checkboxClass)}
                              />
                              <Label htmlFor={`waiver_full_${waiver.id}`} className="cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                                Required for full enrollment
                              </Label>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-4 border-t border-gray-200 pt-6 sm:flex-row dark:border-gray-700">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn("h-11 px-8", primaryButtonClass)}
                  tabIndex={13}
                >
                  <Plus className="h-4 w-4" />
                  {isSubmitting ? "Creating..." : isSeminarView ? "Create Seminar Template" : "Create Program"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("h-11 px-8", secondaryButtonClass)}
                  asChild
                  tabIndex={14}
                >
                  <Link to={isSeminarView ? "/admin/programs?engagement=seminar" : "/admin/programs"}>Cancel</Link>
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
