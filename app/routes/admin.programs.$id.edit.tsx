import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, Link } from "@remix-run/react";
import { withAdminLoader, withAdminAction } from "~/utils/auth.server";
import { getProgramById, updateProgram } from "~/services/program.server";
import { getProgramRequiredWaivers, addProgramWaiver, removeProgramWaiver, updateProgramWaiver } from "~/services/waiver.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Save } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from "~/components/AdminCard";
import type { CreateProgramData } from "~/types/multi-class";
import {toMoney, isNegative, serializeMoney, type MoneyJSON} from "~/utils/money";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { cn } from "~/lib/utils";


type ActionData = {
  errors?: {
    name?: string;
    description?: string;
    duration_minutes?: string;
    min_age?: string;
    max_age?: string;
    monthly_fee?: string;
    registration_fee?: string;
    yearly_fee?: string;
    individual_session_fee?: string;
    general?: string;
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const programName = data?.program?.name ?? "Edit Program";
  return [
    { title: `Edit ${programName} | Admin Dashboard` },
    { name: "description", content: `Edit details for the ${programName} program.` },
  ];
};

async function loaderImpl({ params }: LoaderFunctionArgs) {
  const programId = params.id;

  if (!programId) {
    throw new Response("Program ID is required", { status: 400 });
  }

  const program = await getProgramById(programId);

  if (!program) {
    throw new Response("Program not found", { status: 404 });
  }

  // Get all available waivers
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: allWaivers } = await supabaseAdmin
    .from('waivers')
    .select('*')
    .order('title', { ascending: true });

  // Get program-specific waivers
  const programWaivers = await getProgramRequiredWaivers(programId);

  // Serialize Money objects for JSON transport
  return json({
    program: {
      ...program,
      monthly_fee: program.monthly_fee ? serializeMoney(program.monthly_fee) : undefined,
      registration_fee: program.registration_fee ? serializeMoney(program.registration_fee) : undefined,
      yearly_fee: program.yearly_fee ? serializeMoney(program.yearly_fee) : undefined,
      individual_session_fee: program.individual_session_fee ? serializeMoney(program.individual_session_fee) : undefined,
    },
    allWaivers: allWaivers ?? [],
    programWaivers: programWaivers,
  });
}

export const loader = withAdminLoader(loaderImpl);

async function actionImpl({ request, params }: ActionFunctionArgs) {
  
  try {
    await csrf.validate(request);
  } catch (error) {
    console.error('CSRF validation failed:', error);
    return json({ errors: { general: 'Security validation failed. Please try again.' } }, { status: 403 });
  }
  
  const programId = params.id;
  
  if (!programId) {
    throw new Response("Program ID is required", { status: 400 });
  }

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
  const minBeltRank = formData.get("min_belt_rank") as string;
  const maxBeltRank = formData.get("max_belt_rank") as string;
  const minBeltRankValue = minBeltRank === "none" ? undefined : minBeltRank;
  const maxBeltRankValue = maxBeltRank === "none" ? undefined : maxBeltRank;
  
  // Age and demographic constraints
  const minAge = formData.get("min_age") ? parseInt(formData.get("min_age") as string) : undefined;
  const maxAge = formData.get("max_age") ? parseInt(formData.get("max_age") as string) : undefined;
  const genderRestriction = formData.get("gender_restriction") as string || "none";
  const audienceScopeValue = formData.get("audience_scope") as string;
  const audienceScope = (["youth", "adults", "mixed"].includes(audienceScopeValue) ? audienceScopeValue : undefined) as 'youth' | 'adults' | 'mixed' | undefined;
  const specialNeedsSupport = formData.get("special_needs_support") === "on";
  
  // Pricing
  const isSeminarSubmit = formData.get("engagement_type") === "seminar";
  const monthlyFee = formData.get("monthly_fee") ? toMoney(formData.get("monthly_fee")) : isSeminarSubmit ? toMoney(0) : undefined;
  const registrationFee = formData.get("registration_fee") ? toMoney(formData.get("registration_fee")) : undefined;
  const yearlyFee = formData.get("yearly_fee") ? toMoney(formData.get("yearly_fee")) : isSeminarSubmit ? toMoney(0) : undefined;
  const individualSessionFee = formData.get("individual_session_fee") ? toMoney(formData.get("individual_session_fee")) : isSeminarSubmit ? toMoney(0) : undefined;

  const isActive = formData.get("is_active") === "on";

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
    const programData: Partial<CreateProgramData> = {
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
      min_belt_rank: minBeltRankValue as 'white' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'brown' | 'black' | undefined,
      max_belt_rank: maxBeltRankValue as 'white' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'brown' | 'black' | undefined,
      // Age and demographic constraints
      min_age: minAge,
      max_age: maxAge,
      gender_restriction: genderRestriction as 'male' | 'female' | 'none',
      audience_scope: audienceScope,
      special_needs_support: specialNeedsSupport,
      // Pricing structure
      monthly_fee: monthlyFee,
      yearly_fee: yearlyFee,
      individual_session_fee: individualSessionFee,
      registration_fee: registrationFee,
      // System fields
      is_active: isActive,
    };

    await updateProgram(programId, programData);

    // Handle waiver assignments
    // Get all waivers to process their form data
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

        // Check if this waiver is currently assigned to the program
        const { data: existingAssignment } = await supabaseAdmin
          .from('program_waivers')
          .select('*')
          .eq('program_id', programId)
          .eq('waiver_id', waiverId)
          .single();

        if (isRequired) {
          // Add or update the waiver assignment
          if (existingAssignment) {
            await updateProgramWaiver(programId, waiverId, {
              is_required: true,
              required_for_trial: requiredForTrial,
              required_for_full_enrollment: requiredForFull,
            });
          } else {
            await addProgramWaiver(programId, waiverId, {
              is_required: true,
              required_for_trial: requiredForTrial,
              required_for_full_enrollment: requiredForFull,
            });
          }
        } else if (existingAssignment) {
          // Remove the waiver assignment if it exists but is no longer required
          await removeProgramWaiver(programId, waiverId);
        }
      }
    }

    return redirect(isSeminarSubmit ? "/admin/programs?engagement=seminar" : "/admin/programs");
  } catch (error) {
    console.error("Error updating program:", error);
    return json<ActionData>({
      errors: { general: "Failed to update program. Please try again." }
    }, { status: 500 });
  }
}

export const action = withAdminAction(actionImpl);

export default function EditProgram() {
  const { program, allWaivers, programWaivers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const isSeminarView = program.engagement_type === 'seminar';
  const pageTitle = isSeminarView ? "Edit Seminar Template" : "Edit Program";
  const pageDescription = isSeminarView
    ? "Update pricing, eligibility, availability, and waiver defaults for this seminar template."
    : "Update pricing, eligibility, availability, and waiver defaults for this program.";
  const sectionCardClass = "border border-gray-200 bg-gray-50/80 shadow-sm dark:border-gray-700 dark:bg-gray-900/40";
  const sectionTitleClass = "mb-0 border-gray-200 pb-2 text-lg font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100";
  const sectionDescriptionClass = "mt-1 text-sm text-gray-600 dark:text-gray-400";
  const helperTextClass = "text-xs text-gray-500 dark:text-gray-400";
  const toggleCardClass = "flex items-start space-x-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800";
  const waiverCardClass = "rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800";
  const primaryButtonClass = "bg-green-600 text-white shadow-sm hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500";
  const secondaryButtonClass = "border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/30 dark:hover:text-green-200";
  const activeBadgeClass = "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200";
  const inactiveBadgeClass = "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-700/70 dark:text-gray-200";
  const checkboxClass = "checkbox-custom-styles border-green-600 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600";
  const inputClass = (hasError?: string) => cn(
    "input-custom-styles border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
    hasError && "border-red-500 focus-visible:border-red-500"
  );
  const textareaClass = "input-custom-styles border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";

  // Create a map of waiver_id -> program waiver settings for quick lookup
  const programWaiverMap = new Map(
    programWaivers.map(pw => [pw.waiver_id, pw])
  );

  // Helper to convert MoneyJSON to dollar string for inputs
  const moneyToString = (money: MoneyJSON | undefined) => {
    if (!money) return "";
    return (money.amount / 100).toString();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 text-foreground dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Card className="border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
          <CardHeader className="space-y-6 border-b border-gray-100 pb-8 dark:border-gray-700">
            <AppBreadcrumb
              items={isSeminarView
                ? [{ label: "Admin Dashboard", href: "/admin" }, { label: "Seminar Templates", href: "/admin/programs?engagement=seminar" }, { label: program.name, current: true }]
                : breadcrumbPatterns.adminProgramEdit(program.name)
              }
              className="mb-0"
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-green-50 p-3 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  <Save className="h-6 w-6" />
                </div>
                <div>
                  <div className="inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {isSeminarView ? "Seminar Setup" : "Program Setup"}
                  </div>
                  <CardTitle className="mt-3 text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">
                    {pageTitle}
                  </CardTitle>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{program.name}</p>
                  <CardDescription className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                    {pageDescription}
                  </CardDescription>
                </div>
              </div>

              <div className={cn(
                "inline-flex h-fit rounded-full border px-3 py-1 text-sm font-medium",
                program.is_active ? activeBadgeClass : inactiveBadgeClass
              )}>
                {program.is_active ? "Active" : "Inactive"}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-8">
            <Form method="post" className="space-y-6">
              <AuthenticityTokenInput />
              <input type="hidden" name="engagement_type" value={program.engagement_type} />
              {actionData?.errors?.general && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  {actionData.errors.general}
                </div>
              )}

              <AdminCard className={sectionCardClass}>
                <AdminCardHeader className="pb-0">
                  <AdminCardTitle className={sectionTitleClass}>Basic Information</AdminCardTitle>
                  <p className={sectionDescriptionClass}>Update naming, activation, audience, and description.</p>
                </AdminCardHeader>
                <AdminCardContent className="pt-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label htmlFor="name">{isSeminarView ? "Seminar Name" : "Program Name"} <span className="text-red-500">*</span></Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={program.name}
                        placeholder="e.g., Youth Karate"
                        className={inputClass(actionData?.errors?.name)}
                        tabIndex={1}
                      />
                      {actionData?.errors?.name && (
                        <p className="text-sm text-red-500">{actionData.errors.name}</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className={toggleCardClass}>
                        <Checkbox
                          id="is_active"
                          name="is_active"
                          defaultChecked={program.is_active}
                          tabIndex={2}
                          className={cn("mt-1", checkboxClass)}
                        />
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="is_active" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Active {isSeminarView ? "Seminar Template" : "Program"}
                          </Label>
                          <p className={helperTextClass}>Enable this {isSeminarView ? "seminar template" : "program"} for enrollment</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="audience_scope">Audience Scope <span className="text-red-500">*</span></Label>
                      <Select name="audience_scope" defaultValue={program.audience_scope || (isSeminarView ? "mixed" : "youth")}>
                        <SelectTrigger className={inputClass()} tabIndex={3}>
                          <SelectValue placeholder="Select audience" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="youth">Youth</SelectItem>
                          <SelectItem value="adults">Adults</SelectItem>
                          <SelectItem value="mixed">Mixed (All Ages)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className={helperTextClass}>Who this {isSeminarView ? "seminar" : "program"} is open to</p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      defaultValue={program.description || ""}
                      placeholder="Optional description for this program"
                      rows={3}
                      className={textareaClass}
                      tabIndex={3}
                    />
                  </div>
                </AdminCardContent>
              </AdminCard>

              <AdminCard className={sectionCardClass}>
                <AdminCardHeader className="pb-0">
                  <AdminCardTitle className={sectionTitleClass}>Capacity & Frequency</AdminCardTitle>
                  <p className={sectionDescriptionClass}>Adjust capacity limits and training frequency requirements.</p>
                </AdminCardHeader>
                <AdminCardContent className="pt-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <Label htmlFor="max_capacity">Max Capacity</Label>
                      <Input
                        id="max_capacity"
                        name="max_capacity"
                        type="number"
                        min="1"
                        defaultValue={program.max_capacity?.toString() || ""}
                        placeholder="e.g., 20"
                        className={inputClass()}
                        tabIndex={4}
                      />
                      <p className={cn(helperTextClass, "mt-1")}>Maximum students allowed</p>
                    </div>

                    <div>
                      <Label htmlFor="sessions_per_week">Sessions/Week</Label>
                      <Input
                        id="sessions_per_week"
                        name="sessions_per_week"
                        type="number"
                        min="1"
                        defaultValue={program.sessions_per_week?.toString() || ""}
                        placeholder="e.g., 2"
                        className={inputClass()}
                        tabIndex={5}
                      />
                      <p className={cn(helperTextClass, "mt-1")}>Default frequency</p>
                    </div>

                    <div>
                      <Label htmlFor="min_sessions_per_week">Min Sessions/Week</Label>
                      <Input
                        id="min_sessions_per_week"
                        name="min_sessions_per_week"
                        type="number"
                        min="1"
                        defaultValue={program.min_sessions_per_week?.toString() || ""}
                        placeholder="e.g., 1"
                        className={inputClass()}
                        tabIndex={6}
                      />
                      <p className={cn(helperTextClass, "mt-1")}>Minimum required</p>
                    </div>

                    <div>
                      <Label htmlFor="max_sessions_per_week">Max Sessions/Week</Label>
                      <Input
                        id="max_sessions_per_week"
                        name="max_sessions_per_week"
                        type="number"
                        min="1"
                        defaultValue={program.max_sessions_per_week?.toString() || ""}
                        placeholder="e.g., 3"
                        className={inputClass()}
                        tabIndex={7}
                      />
                      <p className={cn(helperTextClass, "mt-1")}>Maximum allowed</p>
                    </div>
                  </div>
                </AdminCardContent>
              </AdminCard>

              <AdminCard className={sectionCardClass}>
                <AdminCardHeader className="pb-0">
                  <AdminCardTitle className={sectionTitleClass}>Belt Requirements</AdminCardTitle>
                  <p className={sectionDescriptionClass}>Set belt rank eligibility rules for enrollment.</p>
                </AdminCardHeader>
                <AdminCardContent className="pt-6">
                  <div className="space-y-6">
                    <div className={toggleCardClass}>
                      <Checkbox
                        id="belt_rank_required"
                        name="belt_rank_required"
                        defaultChecked={program.belt_rank_required || false}
                        tabIndex={8}
                        className={cn("mt-1", checkboxClass)}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="belt_rank_required" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Enforce belt rank requirements
                        </Label>
                        <p className={helperTextClass}>
                          When enabled, students must meet belt rank requirements to enroll.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <Label htmlFor="min_belt_rank">Minimum Belt Rank</Label>
                        <Select name="min_belt_rank" defaultValue={program.min_belt_rank || "none"}>
                          <SelectTrigger className={inputClass()} tabIndex={9}>
                            <SelectValue placeholder="Select minimum belt" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Requirement</SelectItem>
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

                      <div>
                        <Label htmlFor="max_belt_rank">Maximum Belt Rank</Label>
                        <Select name="max_belt_rank" defaultValue={program.max_belt_rank || "none"}>
                          <SelectTrigger className={inputClass()} tabIndex={10}>
                            <SelectValue placeholder="Select maximum belt" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Limit</SelectItem>
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
                </AdminCardContent>
              </AdminCard>

              <AdminCard className={sectionCardClass}>
                <AdminCardHeader className="pb-0">
                  <AdminCardTitle className={sectionTitleClass}>Session & Demographics</AdminCardTitle>
                  <p className={sectionDescriptionClass}>Adjust duration, age bounds, and accommodation settings.</p>
                </AdminCardHeader>
                <AdminCardContent className="pt-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                      <Input
                        id="duration_minutes"
                        name="duration_minutes"
                        type="number"
                        min="1"
                        defaultValue={program.duration_minutes?.toString() || "60"}
                        placeholder="e.g., 60"
                        className={inputClass(actionData?.errors?.duration_minutes)}
                        tabIndex={11}
                      />
                      {actionData?.errors?.duration_minutes && (
                        <p className="text-sm text-red-500">{actionData.errors.duration_minutes}</p>
                      )}
                      <p className={cn(helperTextClass, "mt-1")}>Length of each session</p>
                    </div>

                    <div>
                      <Label htmlFor="min_age">Minimum Age</Label>
                      <Input
                        id="min_age"
                        name="min_age"
                        type="number"
                        min="0"
                        defaultValue={program.min_age?.toString() || ""}
                        placeholder="e.g., 5"
                        className={inputClass(actionData?.errors?.min_age)}
                        tabIndex={12}
                      />
                      {actionData?.errors?.min_age && (
                        <p className="text-sm text-red-500">{actionData.errors.min_age}</p>
                      )}
                      <p className={cn(helperTextClass, "mt-1")}>Youngest allowed age</p>
                    </div>

                    <div>
                      <Label htmlFor="max_age">Maximum Age</Label>
                      <Input
                        id="max_age"
                        name="max_age"
                        type="number"
                        min="0"
                        defaultValue={program.max_age?.toString() || ""}
                        placeholder="e.g., 18"
                        className={inputClass(actionData?.errors?.max_age)}
                        tabIndex={13}
                      />
                      {actionData?.errors?.max_age && (
                        <p className="text-sm text-red-500">{actionData.errors.max_age}</p>
                      )}
                      <p className={cn(helperTextClass, "mt-1")}>Oldest allowed age</p>
                    </div>

                    <div>
                      <Label htmlFor="gender_restriction">Gender Restriction</Label>
                      <Select name="gender_restriction" defaultValue={program.gender_restriction || "none"}>
                        <SelectTrigger className={inputClass()} tabIndex={14}>
                          <SelectValue placeholder="Select gender restriction" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Restriction</SelectItem>
                          <SelectItem value="male">Male Only</SelectItem>
                          <SelectItem value="female">Female Only</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className={cn(helperTextClass, "mt-1")}>Limit enrollment by gender</p>
                    </div>

                    <div className="md:col-span-2 lg:col-span-2">
                      <div className={toggleCardClass}>
                        <Checkbox
                          id="special_needs_support"
                          name="special_needs_support"
                          defaultChecked={program.special_needs_support || false}
                          tabIndex={15}
                          className={cn("mt-1", checkboxClass)}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="special_needs_support" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Special Needs Support
                          </Label>
                          <p className={helperTextClass}>
                            Check if this program provides special accommodations.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </AdminCardContent>
              </AdminCard>

              <AdminCard className={sectionCardClass}>
                <AdminCardHeader className="pb-0">
                  <AdminCardTitle className={sectionTitleClass}>Pricing Structure</AdminCardTitle>
                  <p className={sectionDescriptionClass}>
                    {isSeminarView ? "Update the default seminar price and fee defaults." : "Update recurring, registration, and drop-in pricing."}
                  </p>
                </AdminCardHeader>
                <AdminCardContent className="pt-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {!isSeminarView && (
                      <div>
                        <Label htmlFor="monthly_fee">Monthly Fee ($)</Label>
                        <Input
                          id="monthly_fee"
                          name="monthly_fee"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={moneyToString(program.monthly_fee)}
                          placeholder="e.g., 120.00"
                          className={inputClass(actionData?.errors?.monthly_fee)}
                          tabIndex={16}
                        />
                        {actionData?.errors?.monthly_fee && (
                          <p className="text-sm text-red-500">{actionData.errors.monthly_fee}</p>
                        )}
                        <p className={cn(helperTextClass, "mt-1")}>Regular monthly fee</p>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="registration_fee">{isSeminarView ? "Single Purchase Price ($)" : "Registration Fee ($)"}</Label>
                      <Input
                        id="registration_fee"
                        name="registration_fee"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={moneyToString(program.registration_fee)}
                        placeholder={isSeminarView ? "e.g., 150.00" : "e.g., 50.00"}
                        className={inputClass(actionData?.errors?.registration_fee)}
                        tabIndex={17}
                      />
                      {actionData?.errors?.registration_fee && (
                        <p className="text-sm text-red-500">{actionData.errors.registration_fee}</p>
                      )}
                      <p className={cn(helperTextClass, "mt-1")}>
                        {isSeminarView ? "Default price per registration — can be overridden per series" : "One-time registration fee"}
                      </p>
                    </div>

                    {!isSeminarView && (
                      <div>
                        <Label htmlFor="yearly_fee">Yearly Fee ($)</Label>
                        <Input
                          id="yearly_fee"
                          name="yearly_fee"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={moneyToString(program.yearly_fee)}
                          placeholder="e.g., 1200.00"
                          className={inputClass(actionData?.errors?.yearly_fee)}
                          tabIndex={18}
                        />
                        {actionData?.errors?.yearly_fee && (
                          <p className="text-sm text-red-500">{actionData.errors.yearly_fee}</p>
                        )}
                        <p className={cn(helperTextClass, "mt-1")}>Annual payment option</p>
                      </div>
                    )}

                    {!isSeminarView && (
                      <div>
                        <Label htmlFor="individual_session_fee">Individual Session Fee ($)</Label>
                        <Input
                          id="individual_session_fee"
                          name="individual_session_fee"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={moneyToString(program.individual_session_fee)}
                          placeholder="e.g., 35.00"
                          className={inputClass(actionData?.errors?.individual_session_fee)}
                          tabIndex={19}
                        />
                        {actionData?.errors?.individual_session_fee && (
                          <p className="text-sm text-red-500">{actionData.errors.individual_session_fee}</p>
                        )}
                        <p className={cn(helperTextClass, "mt-1")}>Drop-in session rate</p>
                      </div>
                    )}
                  </div>
                </AdminCardContent>
              </AdminCard>

              <AdminCard className={sectionCardClass}>
                <AdminCardHeader className="pb-0">
                  <AdminCardTitle className={sectionTitleClass}>Waiver Requirements</AdminCardTitle>
                  <p className={sectionDescriptionClass}>
                    Select which waivers are required and whether they apply to trial or full enrollment.
                  </p>
                </AdminCardHeader>
                <AdminCardContent className="pt-6">
                  {allWaivers.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      No waivers available. <Link to="/admin/waivers/new" className="font-medium text-green-600 hover:underline dark:text-green-400">Create a waiver</Link> first.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {allWaivers.map((waiver) => {
                        const programWaiver = programWaiverMap.get(waiver.id);
                        const isAssigned = !!programWaiver;

                        return (
                          <div key={waiver.id} className={waiverCardClass}>
                            <div className="flex items-start space-x-3">
                              <Checkbox
                                id={`waiver_required_${waiver.id}`}
                                name={`waiver_required_${waiver.id}`}
                                defaultChecked={isAssigned}
                                className={cn("mt-1", checkboxClass)}
                              />
                              <div className="flex-1">
                                <Label htmlFor={`waiver_required_${waiver.id}`} className="text-sm font-medium cursor-pointer text-gray-900 dark:text-gray-100">
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
                                    defaultChecked={programWaiver?.required_for_trial ?? false}
                                    className={cn("h-4 w-4", checkboxClass)}
                                  />
                                  <Label htmlFor={`waiver_trial_${waiver.id}`} className="text-xs cursor-pointer text-gray-700 dark:text-gray-300">
                                    Required for trial enrollment
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`waiver_full_${waiver.id}`}
                                    name={`waiver_full_${waiver.id}`}
                                    defaultChecked={programWaiver?.required_for_full_enrollment ?? true}
                                    className={cn("h-4 w-4", checkboxClass)}
                                  />
                                  <Label htmlFor={`waiver_full_${waiver.id}`} className="text-xs cursor-pointer text-gray-700 dark:text-gray-300">
                                    Required for full enrollment
                                  </Label>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </AdminCardContent>
              </AdminCard>

              <AdminCard className={sectionCardClass}>
                <AdminCardContent className="pt-6">
                  <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      asChild
                      className={secondaryButtonClass}
                      tabIndex={21}
                    >
                      <Link to={isSeminarView ? "/admin/programs?engagement=seminar" : "/admin/programs"}>Cancel</Link>
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn("flex items-center gap-2", primaryButtonClass)}
                      tabIndex={20}
                    >
                      <Save className="h-4 w-4" />
                      {isSubmitting ? "Updating..." : isSeminarView ? "Update Seminar Template" : "Update Program"}
                    </Button>
                  </div>
                </AdminCardContent>
              </AdminCard>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
