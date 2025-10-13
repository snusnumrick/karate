import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, Link } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { getProgramById, updateProgram } from "~/services/program.server";
import { getProgramRequiredWaivers, addProgramWaiver, removeProgramWaiver, updateProgramWaiver } from "~/services/waiver.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
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

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminUser(request);
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

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdminUser(request);
  
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
  const specialNeedsSupport = formData.get("special_needs_support") === "on";
  
  // Pricing
  const monthlyFee = formData.get("monthly_fee") ? toMoney(formData.get("monthly_fee")) : undefined;
  const registrationFee = formData.get("registration_fee") ? toMoney(formData.get("registration_fee")) : undefined;
  const yearlyFee = formData.get("yearly_fee") ? toMoney(formData.get("yearly_fee")) : undefined;
  const individualSessionFee = formData.get("individual_session_fee") ? toMoney(formData.get("individual_session_fee")) : undefined;

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

    return redirect("/admin/programs");
  } catch (error) {
    console.error("Error updating program:", error);
    return json<ActionData>({
      errors: { general: "Failed to update program. Please try again." }
    }, { status: 500 });
  }
}

export default function EditProgram() {
  const { program, allWaivers, programWaivers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

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
    <div className="container mx-auto px-4 py-8">
      <AppBreadcrumb items={breadcrumbPatterns.adminProgramEdit(program.name)} className="mb-6" />
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Edit Program: {program.name}</h1>
      </div>

      <Form method="post" className="space-y-6">
        <AuthenticityTokenInput />
        {actionData?.errors?.general && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {actionData.errors.general}
          </div>
        )}

        {/* Basic Information Section */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle>Basic Information</AdminCardTitle>
          </AdminCardHeader>
          <AdminCardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Program Name <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                name="name"
                defaultValue={program.name}
                placeholder="e.g., Youth Karate"
                className={`input-custom-styles ${actionData?.errors?.name ? "border-red-500" : ""}`}
                tabIndex={1}
              />
              {actionData?.errors?.name && (
                <p className="text-sm text-red-500">{actionData.errors.name}</p>
              )}
            </div>

            <div className="flex items-center space-x-3 mt-6">
              <Checkbox
                id="is_active"
                name="is_active"
                defaultChecked={program.is_active}
                tabIndex={2}
                className="checkbox-custom-styles"
              />
              <div className="flex-1">
                <Label htmlFor="is_active" className="text-sm font-medium">Active Program</Label>
                <p className="text-xs text-gray-500">Enable this program for enrollment</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={program.description || ""}
              placeholder="Optional description for this program"
              rows={3}
              className="input-custom-styles"
              tabIndex={3}
            />
          </div>
          </AdminCardContent>
        </AdminCard>

        {/* Capacity & Frequency Section */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle>Capacity & Frequency</AdminCardTitle>
          </AdminCardHeader>
          <AdminCardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="max_capacity">Max Capacity</Label>
              <Input
                id="max_capacity"
                name="max_capacity"
                type="number"
                min="1"
                defaultValue={program.max_capacity?.toString() || ""}
                placeholder="e.g., 20"
                className="input-custom-styles"
                tabIndex={4}
              />
              <p className="text-xs text-gray-500 mt-1">Maximum students allowed</p>
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
                className="input-custom-styles"
                tabIndex={5}
              />
              <p className="text-xs text-gray-500 mt-1">Default frequency</p>
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
                className="input-custom-styles"
                tabIndex={6}
              />
              <p className="text-xs text-gray-500 mt-1">Minimum required</p>
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
                className="input-custom-styles"
                tabIndex={7}
              />
              <p className="text-xs text-gray-500 mt-1">Maximum allowed</p>
            </div>
          </div>
          </AdminCardContent>
        </AdminCard>

        {/* Belt Requirements Section */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle>Belt Requirements</AdminCardTitle>
          </AdminCardHeader>
          <AdminCardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="belt_rank_required"
                name="belt_rank_required"
                defaultChecked={program.belt_rank_required || false}
                tabIndex={8}
                className="checkbox-custom-styles"
              />
              <Label htmlFor="belt_rank_required" className="text-sm font-medium">
                Enforce belt rank requirements
              </Label>
            </div>
            <p className="text-xs text-gray-500">
              When enabled, students must meet belt rank requirements to enroll
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min_belt_rank">Minimum Belt Rank</Label>
                <Select name="min_belt_rank" defaultValue={program.min_belt_rank || "none"}>
                  <SelectTrigger className="input-custom-styles" tabIndex={9}>
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
                  <SelectTrigger className="input-custom-styles" tabIndex={10}>
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

        {/* Session & Demographics Section */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle>Session & Demographics</AdminCardTitle>
          </AdminCardHeader>
          <AdminCardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="duration_minutes">Duration (minutes)</Label>
              <Input
                id="duration_minutes"
                name="duration_minutes"
                type="number"
                min="1"
                defaultValue={program.duration_minutes?.toString() || "60"}
                placeholder="e.g., 60"
                className={`input-custom-styles ${actionData?.errors?.duration_minutes ? "border-red-500" : ""}`}
                tabIndex={11}
              />
              {actionData?.errors?.duration_minutes && (
                <p className="text-sm text-red-500">{actionData.errors.duration_minutes}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Length of each session</p>
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
                className={`input-custom-styles ${actionData?.errors?.min_age ? "border-red-500" : ""}`}
                tabIndex={12}
              />
              {actionData?.errors?.min_age && (
                <p className="text-sm text-red-500">{actionData.errors.min_age}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Youngest allowed age</p>
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
                className={`input-custom-styles ${actionData?.errors?.max_age ? "border-red-500" : ""}`}
                tabIndex={13}
              />
              {actionData?.errors?.max_age && (
                <p className="text-sm text-red-500">{actionData.errors.max_age}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Oldest allowed age</p>
            </div>

            <div>
              <Label htmlFor="gender_restriction">Gender Restriction</Label>
              <Select name="gender_restriction" defaultValue={program.gender_restriction || "none"}>
                <SelectTrigger className="input-custom-styles" tabIndex={14}>
                  <SelectValue placeholder="Select gender restriction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Restriction</SelectItem>
                  <SelectItem value="male">Male Only</SelectItem>
                  <SelectItem value="female">Female Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Limit enrollment by gender</p>
            </div>

            <div className="md:col-span-2 lg:col-span-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                id="special_needs_support"
                name="special_needs_support"
                defaultChecked={program.special_needs_support || false}
                tabIndex={14}
                className="checkbox-custom-styles"
              />
                <Label htmlFor="special_needs_support" className="text-sm font-medium">
                  Special Needs Support
                </Label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Check if this program provides special accommodations
              </p>
            </div>
          </div>
          </AdminCardContent>
        </AdminCard>

        {/* Pricing Structure Section */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle>Pricing Structure</AdminCardTitle>
          </AdminCardHeader>
          <AdminCardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                className={`input-custom-styles ${actionData?.errors?.monthly_fee ? "border-red-500" : ""}`}
                tabIndex={16}
              />
              {actionData?.errors?.monthly_fee && (
                <p className="text-sm text-red-500">{actionData.errors.monthly_fee}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Regular monthly fee</p>
            </div>

            <div>
              <Label htmlFor="registration_fee">Registration Fee ($)</Label>
              <Input
                id="registration_fee"
                name="registration_fee"
                type="number"
                min="0"
                step="0.01"
                defaultValue={moneyToString(program.registration_fee)}
                placeholder="e.g., 50.00"
                className="input-custom-styles"
                tabIndex={17}
              />
              <p className="text-xs text-gray-500 mt-1">One-time registration fee</p>
            </div>

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
                className={`input-custom-styles ${actionData?.errors?.yearly_fee ? "border-red-500" : ""}`}
                tabIndex={18}
              />
              {actionData?.errors?.yearly_fee && (
                <p className="text-sm text-red-500">{actionData.errors.yearly_fee}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Annual payment option</p>
            </div>

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
                className={`input-custom-styles ${actionData?.errors?.individual_session_fee ? "border-red-500" : ""}`}
                tabIndex={19}
              />
              {actionData?.errors?.individual_session_fee && (
                <p className="text-sm text-red-500">{actionData.errors.individual_session_fee}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Drop-in session rate</p>
            </div>
          </div>
          </AdminCardContent>
        </AdminCard>

        {/* Waiver Requirements Section */}
        <AdminCard>
          <AdminCardHeader>
            <AdminCardTitle>Waiver Requirements</AdminCardTitle>
          </AdminCardHeader>
          <AdminCardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select which waivers are required for this program. You can specify different requirements for trial vs full enrollment.
              </p>

              {allWaivers.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 px-3 bg-muted/30 rounded-lg">
                  No waivers available. <Link to="/admin/waivers/new" className="text-primary hover:underline">Create a waiver</Link> first.
                </div>
              ) : (
                <div className="space-y-3">
                  {allWaivers.map((waiver) => {
                    const programWaiver = programWaiverMap.get(waiver.id);
                    const isAssigned = !!programWaiver;

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
                              defaultChecked={programWaiver?.required_for_trial ?? false}
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
                              defaultChecked={programWaiver?.required_for_full_enrollment ?? true}
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
          </AdminCardContent>
        </AdminCard>

        {/* Actions Section */}
        <AdminCard>
          <AdminCardContent>
            <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              asChild
              tabIndex={21}
            >
              <Link to="/admin/programs">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2"
              tabIndex={20}
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? "Updating..." : "Update Program"}
            </Button>
            </div>
          </AdminCardContent>
        </AdminCard>
      </Form>
    </div>
  );
}