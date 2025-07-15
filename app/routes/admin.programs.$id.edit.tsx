import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, Link } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { getProgramById, updateProgram } from "~/services/program.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { ArrowLeft, Save } from "lucide-react";
import type { CreateProgramData } from "~/types/multi-class";


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

  return json({ program });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdminUser(request);
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
  const monthlyFee = formData.get("monthly_fee") ? parseFloat(formData.get("monthly_fee") as string) : undefined;
  const registrationFee = formData.get("registration_fee") ? parseFloat(formData.get("registration_fee") as string) : undefined;
  const yearlyFee = formData.get("yearly_fee") ? parseFloat(formData.get("yearly_fee") as string) : undefined;
  const individualSessionFee = formData.get("individual_session_fee") ? parseFloat(formData.get("individual_session_fee") as string) : undefined;

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

  if (monthlyFee !== undefined && monthlyFee < 0) {
    errors.monthly_fee = "Monthly fee cannot be negative";
  }

  if (yearlyFee !== undefined && yearlyFee < 0) {
    errors.yearly_fee = "Yearly fee cannot be negative";
  }

  if (individualSessionFee !== undefined && individualSessionFee < 0) {
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
    return redirect("/admin/programs");
  } catch (error) {
    return json(
      { errors: { general: "Failed to update program. Please try again." } },
      { status: 500 }
    );
  }
}

export default function EditProgram() {
  const { program } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/programs">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Programs
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Program</h1>
          <p className="text-muted-foreground">
            Update the program properties and configuration
          </p>
        </div>
      </div>

      <Form method="post" className="space-y-8">
        {actionData?.errors?.general && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {actionData.errors.general}
          </div>
        )}

        {/* Basic Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
              Basic Information
            </CardTitle>
            <CardDescription>
              Program name, description, and availability settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Program Name *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={program.name}
                  placeholder="e.g., Youth Karate"
                  className={actionData?.errors?.name ? "border-red-500" : ""}
                  tabIndex={1}
                />
                {actionData?.errors?.name && (
                  <p className="text-sm text-red-500">{actionData.errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-start space-x-3 p-4 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                  <Checkbox
                    id="is_active"
                    name="is_active"
                    defaultChecked={program.is_active}
                    className="mt-1"
                    tabIndex={2}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="is_active" className="text-sm font-medium cursor-pointer text-green-800">
                      Active Program
                    </Label>
                    <p className="text-sm text-green-600">
                      Check to make this program available for enrollment
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={program.description || ""}
                placeholder="Optional description for this program"
                rows={3}
                tabIndex={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Capacity & Frequency Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
              Capacity & Frequency
            </CardTitle>
            <CardDescription>
              Set enrollment limits and session frequency requirements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="max_capacity" className="text-sm font-medium">Max Capacity</Label>
                <Input
                  id="max_capacity"
                  name="max_capacity"
                  type="number"
                  min="1"
                  defaultValue={program.max_capacity?.toString() || ""}
                  placeholder="e.g., 20"
                  tabIndex={4}
                />
                <p className="text-xs text-muted-foreground">Maximum students allowed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessions_per_week" className="text-sm font-medium">Sessions/Week</Label>
                <Input
                  id="sessions_per_week"
                  name="sessions_per_week"
                  type="number"
                  min="1"
                  defaultValue={program.sessions_per_week?.toString() || ""}
                  placeholder="e.g., 2"
                  tabIndex={5}
                />
                <p className="text-xs text-muted-foreground">Default frequency</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_sessions_per_week" className="text-sm font-medium">Min Sessions/Week</Label>
                <Input
                  id="min_sessions_per_week"
                  name="min_sessions_per_week"
                  type="number"
                  min="1"
                  defaultValue={program.min_sessions_per_week?.toString() || ""}
                  placeholder="e.g., 1"
                  tabIndex={6}
                />
                <p className="text-xs text-muted-foreground">Minimum required</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_sessions_per_week" className="text-sm font-medium">Max Sessions/Week</Label>
                <Input
                  id="max_sessions_per_week"
                  name="max_sessions_per_week"
                  type="number"
                  min="1"
                  defaultValue={program.max_sessions_per_week?.toString() || ""}
                  placeholder="e.g., 3"
                  tabIndex={7}
                />
                <p className="text-xs text-muted-foreground">Maximum allowed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Belt Requirements Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
              Belt Requirements
            </CardTitle>
            <CardDescription>
              Configure belt rank prerequisites for this program
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start space-x-3 p-4 border rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
              <Checkbox
                id="belt_rank_required"
                name="belt_rank_required"
                defaultChecked={program.belt_rank_required || false}
                className="mt-1"
                tabIndex={8}
              />
              <div className="space-y-1">
                <Label htmlFor="belt_rank_required" className="text-sm font-medium cursor-pointer text-orange-800">
                  Enforce Belt Rank Requirements
                </Label>
                <p className="text-sm text-orange-600">
                  Check to require students to meet belt rank criteria for enrollment
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min_belt_rank" className="text-sm font-medium">Minimum Belt Rank</Label>
                <Select name="min_belt_rank" defaultValue={program.min_belt_rank || "none"}>
                  <SelectTrigger tabIndex={9}>
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
                <p className="text-xs text-muted-foreground">Students must have at least this rank</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_belt_rank" className="text-sm font-medium">Maximum Belt Rank</Label>
                <Select name="max_belt_rank" defaultValue={program.max_belt_rank || "none"}>
                  <SelectTrigger tabIndex={10}>
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
                <p className="text-xs text-muted-foreground">Students cannot exceed this rank</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session & Demographics Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2 w-2 bg-emerald-500 rounded-full"></div>
              Session & Demographics
            </CardTitle>
            <CardDescription>
              Configure session duration, age limits, and demographic restrictions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="duration_minutes" className="text-sm font-medium">Duration (minutes)</Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  min="1"
                  defaultValue={program.duration_minutes?.toString() || "60"}
                  placeholder="e.g., 60"
                  className={actionData?.errors?.duration_minutes ? "border-red-500" : ""}
                  tabIndex={11}
                />
                {actionData?.errors?.duration_minutes && (
                  <p className="text-sm text-red-500">{actionData.errors.duration_minutes}</p>
                )}
                <p className="text-xs text-muted-foreground">Length of each session</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_age" className="text-sm font-medium">Minimum Age</Label>
                <Input
                  id="min_age"
                  name="min_age"
                  type="number"
                  min="0"
                  defaultValue={program.min_age?.toString() || ""}
                  placeholder="e.g., 5"
                  className={actionData?.errors?.min_age ? "border-red-500" : ""}
                  tabIndex={12}
                />
                {actionData?.errors?.min_age && (
                  <p className="text-sm text-red-500">{actionData.errors.min_age}</p>
                )}
                <p className="text-xs text-muted-foreground">Youngest allowed age</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_age" className="text-sm font-medium">Maximum Age</Label>
                <Input
                  id="max_age"
                  name="max_age"
                  type="number"
                  min="0"
                  defaultValue={program.max_age?.toString() || ""}
                  placeholder="e.g., 18"
                  className={actionData?.errors?.max_age ? "border-red-500" : ""}
                  tabIndex={13}
                />
                {actionData?.errors?.max_age && (
                  <p className="text-sm text-red-500">{actionData.errors.max_age}</p>
                )}
                <p className="text-xs text-muted-foreground">Oldest allowed age</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mt-6">
              <div className="space-y-2">
                <Label htmlFor="gender_restriction" className="text-sm font-medium">Gender Restriction</Label>
                <Select name="gender_restriction" defaultValue={program.gender_restriction || "none"}>
                  <SelectTrigger tabIndex={14}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Restriction</SelectItem>
                    <SelectItem value="male">Male Only</SelectItem>
                    <SelectItem value="female">Female Only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Limit enrollment by gender</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-start space-x-3 p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                  <Checkbox
                    id="special_needs_support"
                    name="special_needs_support"
                    defaultChecked={program.special_needs_support || false}
                    className="mt-1"
                    tabIndex={15}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="special_needs_support" className="text-sm font-medium cursor-pointer text-blue-800">
                      Special Needs Support
                    </Label>
                    <p className="text-sm text-blue-600">
                      Check if this program provides special accommodations
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Structure Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              Pricing Structure
            </CardTitle>
            <CardDescription>
              Configure fees and pricing options for this program
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="monthly_fee" className="text-sm font-medium">Monthly Fee ($)</Label>
                <Input
                  id="monthly_fee"
                  name="monthly_fee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={program.monthly_fee?.toString() || ""}
                  placeholder="e.g., 120.00"
                  className={actionData?.errors?.monthly_fee ? "border-red-500" : ""}
                  tabIndex={16}
                />
                {actionData?.errors?.monthly_fee && (
                  <p className="text-sm text-red-500">{actionData.errors.monthly_fee}</p>
                )}
                <p className="text-xs text-muted-foreground">Recurring monthly charge</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="registration_fee" className="text-sm font-medium">Registration Fee ($)</Label>
                <Input
                  id="registration_fee"
                  name="registration_fee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={program.registration_fee?.toString() || ""}
                  placeholder="e.g., 50.00"
                  tabIndex={17}
                />
                <p className="text-xs text-muted-foreground">One-time enrollment fee</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearly_fee" className="text-sm font-medium">Yearly Fee ($)</Label>
                <Input
                  id="yearly_fee"
                  name="yearly_fee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={program.yearly_fee?.toString() || ""}
                  placeholder="e.g., 1200.00"
                  className={actionData?.errors?.yearly_fee ? "border-red-500" : ""}
                  tabIndex={18}
                />
                {actionData?.errors?.yearly_fee && (
                  <p className="text-sm text-red-500">{actionData.errors.yearly_fee}</p>
                )}
                <p className="text-xs text-muted-foreground">Annual payment option</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="individual_session_fee" className="text-sm font-medium">Individual Session Fee ($)</Label>
                <Input
                  id="individual_session_fee"
                  name="individual_session_fee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={program.individual_session_fee?.toString() || ""}
                  placeholder="e.g., 35.00"
                  className={actionData?.errors?.individual_session_fee ? "border-red-500" : ""}
                  tabIndex={19}
                />
                {actionData?.errors?.individual_session_fee && (
                  <p className="text-sm text-red-500">{actionData.errors.individual_session_fee}</p>
                )}
                <p className="text-xs text-muted-foreground">Per-session drop-in rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting} tabIndex={20}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Updating..." : "Update Program"}
                </Button>
                <Button type="button" variant="outline" asChild tabIndex={21}>
                  <Link to="/admin/programs">Cancel</Link>
                </Button>
              </div>
              

            </div>
          </CardContent>
        </Card>
      </Form>
    </div>
  );
}