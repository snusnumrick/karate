import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, Link } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { getProgramById, updateProgram, deleteProgram } from "~/services/program.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import type { CreateProgramData } from "~/types/multi-class";
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
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    try {
      await deleteProgram(programId);
      return redirect("/admin/programs");
    } catch (error) {
      return json(
        { errors: { general: "Failed to delete program. Please try again." } },
        { status: 500 }
      );
    }
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const durationMinutes = formData.get("duration_minutes") ? parseInt(formData.get("duration_minutes") as string) : undefined;
  const minAge = formData.get("min_age") ? parseInt(formData.get("min_age") as string) : undefined;
  const maxAge = formData.get("max_age") ? parseInt(formData.get("max_age") as string) : undefined;
  const genderRestriction = formData.get("gender_restriction") as string || "none";
  const specialNeedsSupport = formData.get("special_needs_support") === "on";
  const monthlyFee = formData.get("monthly_fee") ? parseFloat(formData.get("monthly_fee") as string) : undefined;
  const registrationFee = formData.get("registration_fee") ? parseFloat(formData.get("registration_fee") as string) : undefined;
  const yearlyFee = formData.get("yearly_fee") ? parseFloat(formData.get("yearly_fee") as string) : undefined;
  const individualSessionFee = formData.get("individual_session_fee") ? parseFloat(formData.get("individual_session_fee") as string) : undefined;

  const isActive = formData.get("is_active") !== "off";

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
      min_age: minAge,
      max_age: maxAge,
      gender_restriction: genderRestriction as 'male' | 'female' | 'none',
      special_needs_support: specialNeedsSupport,
      monthly_fee: monthlyFee,
      yearly_fee: yearlyFee,
      individual_session_fee: individualSessionFee,
      registration_fee: registrationFee,
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

      <Card>
        <CardHeader>
          <CardTitle>Program Details</CardTitle>
          <CardDescription>
            Modify the program properties and configuration
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
                <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/30">
                  <Checkbox
                    id="is_active"
                    name="is_active"
                    defaultChecked={program.is_active}
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

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  min="1"
                  defaultValue={program.duration_minutes?.toString() || "60"}
                  placeholder="e.g., 60"
                  className={actionData?.errors?.duration_minutes ? "border-red-500" : ""}
                  tabIndex={9}
                />
                {actionData?.errors?.duration_minutes && (
                  <p className="text-sm text-red-500">{actionData.errors.duration_minutes}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_age">Minimum Age</Label>
                <Input
                  id="min_age"
                  name="min_age"
                  type="number"
                  min="0"
                  defaultValue={program.min_age?.toString() || ""}
                  placeholder="e.g., 5"
                  className={actionData?.errors?.min_age ? "border-red-500" : ""}
                  tabIndex={10}
                />
                {actionData?.errors?.min_age && (
                  <p className="text-sm text-red-500">{actionData.errors.min_age}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_age">Maximum Age</Label>
                <Input
                  id="max_age"
                  name="max_age"
                  type="number"
                  min="0"
                  defaultValue={program.max_age?.toString() || ""}
                  placeholder="e.g., 18"
                  className={actionData?.errors?.max_age ? "border-red-500" : ""}
                  tabIndex={11}
                />
                {actionData?.errors?.max_age && (
                  <p className="text-sm text-red-500">{actionData.errors.max_age}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gender_restriction">Gender Restriction</Label>
                <Select name="gender_restriction" defaultValue={program.gender_restriction || "none"}>
                  <SelectTrigger tabIndex={12}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Restriction</SelectItem>
                    <SelectItem value="male">Male Only</SelectItem>
                    <SelectItem value="female">Female Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="special_needs_support" className="flex items-center space-x-2">
                  <Checkbox
                    id="special_needs_support"
                    name="special_needs_support"
                    defaultChecked={program.special_needs_support || false}
                    tabIndex={13}
                  />
                  <span>Special Needs Support</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Check if this program provides special accommodations
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="monthly_fee">Monthly Fee ($)</Label>
                <Input
                  id="monthly_fee"
                  name="monthly_fee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={program.monthly_fee?.toString() || ""}
                  placeholder="e.g., 120.00"
                  className={actionData?.errors?.monthly_fee ? "border-red-500" : ""}
                  tabIndex={14}
                />
                {actionData?.errors?.monthly_fee && (
                  <p className="text-sm text-red-500">{actionData.errors.monthly_fee}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="registration_fee">Registration Fee ($)</Label>
                <Input
                  id="registration_fee"
                  name="registration_fee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={program.registration_fee?.toString() || ""}
                  placeholder="e.g., 50.00"
                  tabIndex={15}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="yearly_fee">Yearly Fee ($)</Label>
                <Input
                  id="yearly_fee"
                  name="yearly_fee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={program.yearly_fee?.toString() || ""}
                  placeholder="e.g., 1200.00"
                  className={actionData?.errors?.yearly_fee ? "border-red-500" : ""}
                  tabIndex={16}
                />
                {actionData?.errors?.yearly_fee && (
                  <p className="text-sm text-red-500">{actionData.errors.yearly_fee}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="individual_session_fee">Individual Session Fee ($)</Label>
                <Input
                  id="individual_session_fee"
                  name="individual_session_fee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={program.individual_session_fee?.toString() || ""}
                  placeholder="e.g., 35.00"
                  className={actionData?.errors?.individual_session_fee ? "border-red-500" : ""}
                  tabIndex={17}
                />
                {actionData?.errors?.individual_session_fee && (
                  <p className="text-sm text-red-500">{actionData.errors.individual_session_fee}</p>
                )}
              </div>
            </div>







            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting} tabIndex={18}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Updating..." : "Update Program"}
              </Button>
              <Button type="button" variant="outline" asChild tabIndex={19}>
                <Link to="/admin/programs">Cancel</Link>
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" tabIndex={20}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Program
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the program
                      and remove all associated data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Form method="post" style={{ display: 'inline' }}>
                      <input type="hidden" name="intent" value="delete" />
                      <AlertDialogAction type="submit">
                        Delete Program
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
  );
}