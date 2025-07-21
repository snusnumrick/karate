import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation, Link } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { createProgram } from "~/services/program.server";
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

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminUser(request);
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
    };

    await createProgram(programData);
    return redirect("/admin/programs");
  } catch (error) {
    return json(
      { errors: { general: "Failed to create program. Please try again." } },
      { status: 500 }
    );
  }
}

export default function NewProgram() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      <AppBreadcrumb 
        items={breadcrumbPatterns.adminProgramNew()} 
        className="mb-6"
      />

      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Program</h1>
          <p className="text-muted-foreground">
            Set up a new martial arts program with pricing and eligibility rules
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Create Program</CardTitle>
              <CardDescription className="text-base mt-1">
                Set up a new martial arts program with pricing and eligibility rules
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Form method="post" className="space-y-8">
            {actionData?.errors?.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {actionData.errors.general}
              </div>
            )}

            {/* Basic Information Section */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-foreground">Program Details</h3>
                <p className="text-sm text-muted-foreground mt-1">Define the program properties and configuration</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="name" className="text-sm font-medium">Program Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="e.g., Youth Karate"
                    className={`h-11 ${actionData?.errors?.name ? "border-red-500" : ""}`}
                    tabIndex={1}
                  />
                  {actionData?.errors?.name && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="text-xs">⚠</span>
                      {actionData.errors.name}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                   <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/30">
                     <Checkbox
                       id="is_active"
                       name="is_active"
                       defaultChecked={true}
                       className="mt-1"
                       tabIndex={2}
                     />
                     <div className="space-y-1">
                       <Label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                         Active Program
                       </Label>
                       <p className="text-sm text-muted-foreground">
                         Check to make this program available for enrollment
                       </p>
                     </div>
                   </div>
                 </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Optional description for this program"
                rows={4}
                className="resize-none"
                tabIndex={3}
              />
            </div>

            {/* Program Configuration Section */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-foreground">Program Configuration</h3>
                <p className="text-sm text-muted-foreground mt-1">Set duration, age requirements, and special accommodations</p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-3">
                  <Label htmlFor="duration_minutes" className="text-sm font-medium flex items-center gap-2">
                    <span>Session Duration (minutes)</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">Required</span>
                  </Label>
                  <Input
                    id="duration_minutes"
                    name="duration_minutes"
                    type="number"
                    min="1"
                    defaultValue="60"
                    placeholder="e.g., 60"
                    className={`h-11 ${actionData?.errors?.duration_minutes ? "border-red-500" : ""}`}
                    tabIndex={4}
                  />
                  {actionData?.errors?.duration_minutes && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
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
                    className={`h-11 ${actionData?.errors?.min_age ? "border-red-500" : ""}`}
                    tabIndex={5}
                  />
                  {actionData?.errors?.min_age && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
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
                    className={`h-11 ${actionData?.errors?.max_age ? "border-red-500" : ""}`}
                    tabIndex={6}
                  />
                  {actionData?.errors?.max_age && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="text-xs">⚠</span>
                      {actionData.errors.max_age}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="gender_restriction" className="text-sm font-medium">Gender Restriction</Label>
                <Select name="gender_restriction" defaultValue="none">
                  <SelectTrigger className="h-11 input-custom-styles" tabIndex={7}>
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
                <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/30">
                  <Checkbox
                    id="special_needs_support"
                    name="special_needs_support"
                    className="mt-1"
                    tabIndex={8}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="special_needs_support" className="text-sm font-medium cursor-pointer">
                      Special Needs Support
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Check if this program provides special accommodations
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Capacity and Frequency Section */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-foreground">Capacity & Frequency</h3>
                <p className="text-sm text-muted-foreground mt-1">Set capacity limits and training frequency requirements</p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-3">
                  <Label htmlFor="max_capacity" className="text-sm font-medium">Max Capacity</Label>
                  <Input
                    id="max_capacity"
                    name="max_capacity"
                    type="number"
                    min="1"
                    placeholder="e.g., 20"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">Maximum students per class (leave empty for unlimited)</p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="sessions_per_week" className="text-sm font-medium">Sessions Per Week</Label>
                  <Input
                    id="sessions_per_week"
                    name="sessions_per_week"
                    type="number"
                    min="1"
                    placeholder="e.g., 2"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">Required training frequency</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Flexible Frequency</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      name="min_sessions_per_week"
                      type="number"
                      min="1"
                      placeholder="Min"
                      className="h-11"
                    />
                    <Input
                      name="max_sessions_per_week"
                      type="number"
                      min="1"
                      placeholder="Max"
                      className="h-11"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Optional: for flexible programs (e.g., 3-5x/week)</p>
                </div>
              </div>
            </div>

            {/* Belt Requirements Section */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-foreground">Belt Requirements</h3>
                <p className="text-sm text-muted-foreground mt-1">Set belt rank eligibility requirements</p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/30">
                    <Checkbox
                      id="belt_rank_required"
                      name="belt_rank_required"
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="belt_rank_required" className="text-sm font-medium cursor-pointer">
                        Enforce Belt Requirements
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Check to require specific belt ranks for enrollment
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="min_belt_rank" className="text-sm font-medium">Minimum Belt Rank</Label>
                  <Select name="min_belt_rank">
                    <SelectTrigger className="h-11 input-custom-styles">
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
                    <SelectTrigger className="h-11 input-custom-styles">
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
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-foreground">Pricing Structure</h3>
                <p className="text-sm text-muted-foreground mt-1">Set up the fee structure for this program</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="monthly_fee" className="text-sm font-medium flex items-center gap-2">
                    <span>Monthly Fee ($)</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="monthly_fee"
                      name="monthly_fee"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="120.00"
                      className={`h-11 pl-8 ${actionData?.errors?.monthly_fee ? "border-red-500" : ""}`}
                      tabIndex={9}
                    />
                  </div>
                  {actionData?.errors?.monthly_fee && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="text-xs">⚠</span>
                      {actionData.errors.monthly_fee}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="yearly_fee" className="text-sm font-medium">Yearly Fee ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="yearly_fee"
                      name="yearly_fee"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="1200.00"
                      className={`h-11 pl-8 ${actionData?.errors?.yearly_fee ? "border-red-500" : ""}`}
                      tabIndex={10}
                    />
                  </div>
                  {actionData?.errors?.yearly_fee && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="text-xs">⚠</span>
                      {actionData.errors.yearly_fee}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="individual_session_fee" className="text-sm font-medium">Individual Session Fee ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="individual_session_fee"
                      name="individual_session_fee"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="30.00"
                      className={`h-11 pl-8 ${actionData?.errors?.individual_session_fee ? "border-red-500" : ""}`}
                      tabIndex={11}
                    />
                  </div>
                  {actionData?.errors?.individual_session_fee && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="text-xs">⚠</span>
                      {actionData.errors.individual_session_fee}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="registration_fee" className="text-sm font-medium">Registration Fee ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="registration_fee"
                      name="registration_fee"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="50.00"
                      className="h-11 pl-8"
                      tabIndex={12}
                    />
                  </div>
                </div>
              </div>
            </div>







            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t">
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="h-11 px-8"
                tabIndex={13}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isSubmitting ? "Creating..." : "Create Program"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="h-11 px-8"
                asChild 
                tabIndex={14}
              >
                <Link to="/admin/programs">Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
