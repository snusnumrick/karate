import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData, Link, useSubmit } from "@remix-run/react";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Trash2, Plus, X, AlertTriangle, Info } from "lucide-react";
import { requireAdminUser } from "~/utils/auth.server";
import { getClassById, updateClass, deleteClass, getInstructors, getClassSchedules, updateClassSchedules } from "~/services/class.server";
import { getPrograms } from "~/services/program.server";
import type { UpdateClassData, Program } from "~/types/multi-class";
import { useState, useEffect } from "react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { validateClassConstraints, getSessionFrequencyDescription } from "~/utils/class-validation";


export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminUser(request);

  const classId = params.id;
  if (!classId) {
    throw new Response("Class ID is required", { status: 400 });
  }

  const [classData, programs, instructors, schedules] = await Promise.all([
    getClassById(classId),
    getPrograms(),
    getInstructors(),
    getClassSchedules(classId)
  ]);

  if (!classData) {
    throw new Response("Class not found", { status: 404 });
  }

  return json({ classData, programs, instructors, schedules });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdminUser(request);

  const classId = params.id;
  if (!classId) {
    throw new Response("Class ID is required", { status: 400 });
  }

  try {
    await csrf.validate(request);
  } catch (error) {
    console.error('CSRF validation failed:', error);
    return json({ error: 'Security validation failed. Please try again.' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "delete") {
      await deleteClass(classId);
      return redirect("/admin/classes");
    }

    if (intent === "update") {
      const programId = formData.get("program_id") as string;
      const className = formData.get("name") as string;

      // Get program data to use program name as default if class name is empty
      const [programs] = await Promise.all([getPrograms()]);
      const selectedProgram = programs.find(p => p.id === programId);

      if (!selectedProgram) {
        return json(
          { error: "Selected program not found" },
          { status: 400 }
        );
      }

      const classDescription = formData.get("description") as string;
      const instructorId = formData.get("instructor_id") as string;

      // Handle schedules
      const scheduleCount = parseInt(formData.get("schedule_count") as string) || 0;
      const schedules = [];

      for (let i = 0; i < scheduleCount; i++) {
        const dayOfWeek = formData.get(`schedule_${i}_day`) as string;
        const startTime = formData.get(`schedule_${i}_time`) as string;

        if (dayOfWeek && startTime) {
          schedules.push({
            day_of_week: dayOfWeek,
            start_time: startTime
          });
        }
      }

      // Validate class constraints against program requirements
      const maxCapacity = formData.get("max_capacity") ? parseInt(formData.get("max_capacity") as string, 10) : undefined;
      const validationResult = validateClassConstraints({
        maxCapacity,
        schedules,
        program: selectedProgram
      });

      if (!validationResult.isValid) {
        return json(
          { error: validationResult.errors.join('. ') },
          { status: 400 }
        );
      }

      const updateData: Omit<UpdateClassData, 'id'> = {
        program_id: programId,
        name: className || selectedProgram?.name || "Unnamed Class",
        description: classDescription || selectedProgram?.description || "",
        is_active: formData.get("is_active") === "on",
        max_capacity: maxCapacity,
        instructor_id: instructorId === "none" ? undefined : instructorId || undefined,
      };

      // Update class and schedules
      await Promise.all([
        updateClass(classId, updateData),
        updateClassSchedules(classId, schedules)
      ]);

      return redirect("/admin/classes");
    }

    return json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Failed to update class" },
      { status: 400 }
    );
  }
}

export default function EditClass() {
  const { classData, programs, instructors, schedules } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Initialize schedules state with existing schedules
  const [classSchedules, setClassSchedules] = useState(
    schedules.map(schedule => ({
      day: schedule.day_of_week,
      time: schedule.start_time
    }))
  );

  const [selectedProgramId, setSelectedProgramId] = useState<string>(classData.program_id);
  const [maxCapacity, setMaxCapacity] = useState<string>(classData.max_capacity?.toString() || '');
  const [validationResult, setValidationResult] = useState<{isValid: boolean, errors: string[], warnings: string[]}>({
    isValid: true,
    errors: [],
    warnings: []
  });

  const selectedProgram = programs.find(p => p.id === selectedProgramId);

  // Validate constraints in real-time
  useEffect(() => {
    if (selectedProgram) {
      const currentSchedules = classSchedules.map(schedule => ({
        day_of_week: schedule.day,
        start_time: schedule.time
      }));

      const result = validateClassConstraints({
        maxCapacity: maxCapacity ? parseInt(maxCapacity, 10) : undefined,
        schedules: currentSchedules,
        program: selectedProgram
      });

      setValidationResult(result);
    }
  }, [selectedProgram, maxCapacity, classSchedules]);

  const addSchedule = () => {
    setClassSchedules([...classSchedules, { day: 'monday', time: '09:00' }]);
  };

  const removeSchedule = (index: number) => {
    setClassSchedules(classSchedules.filter((_, i) => i !== index));
  };

  const updateSchedule = (index: number, field: 'day' | 'time', value: string) => {
    const updated = [...classSchedules];
    updated[index][field] = value;
    setClassSchedules(updated);
  };
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";



  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <AppBreadcrumb items={breadcrumbPatterns.adminClassEdit(classData.name)} className="mb-6" />

      <div className="flex items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Class</h1>
          <p className="text-muted-foreground">
            Update class details, schedule, and capacity.
          </p>
        </div>
      </div>

      {actionData?.error && (
        <Alert className="mb-6 border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Class Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
          <Form method="post" className="space-y-8">
            <AuthenticityTokenInput />
            <input type="hidden" name="intent" value="update" />

            {/* Basic Information Section */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-foreground border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="program_id" className="text-sm font-medium">Program *</Label>
                  <Select 
                    name="program_id" 
                    value={selectedProgramId}
                    onValueChange={setSelectedProgramId}
                    required
                  >
                    <SelectTrigger className="h-10 input-custom-styles">
                      <SelectValue placeholder="Select program" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.filter((p: Program) => p.is_active).map((program: Program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProgram && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {getSessionFrequencyDescription(selectedProgram)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Class Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={classData.name}
                    placeholder="Leave empty to use program name"
                    className="h-10 input-custom-styles"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_capacity" className="text-sm font-medium">Max Capacity *</Label>
                  <Input
                    type="number"
                    name="max_capacity"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(e.target.value)}
                    min="1"
                    max={selectedProgram?.max_capacity}
                    placeholder={selectedProgram ? `Max: ${selectedProgram.max_capacity}` : "Enter capacity"}
                    required
                    className={`h-10 input-custom-styles ${
                      validationResult.errors.some(error => error.includes('capacity')) 
                        ? 'border-red-500 focus:border-red-500' 
                        : ''
                    }`}
                  />
                  {selectedProgram && (
                    <p className="text-xs text-muted-foreground">
                      Program maximum: {selectedProgram.max_capacity} students
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructor_id" className="text-sm font-medium">Instructor</Label>
                  <Select name="instructor_id" defaultValue={classData.instructor_id || 'none'}>
                    <SelectTrigger className="h-10 input-custom-styles">
                      <SelectValue placeholder="Select instructor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No instructor assigned</SelectItem>
                      {instructors.map((instructor) => (
                        <SelectItem key={instructor.id} value={instructor.id}>
                          {instructor.first_name} {instructor.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={classData.description || ''}
                  placeholder="Leave empty to use program description"
                  rows={3}
                  className="resize-none input-custom-styles"
                />
              </div>

              <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-lg">
                <Checkbox id="is_active" name="is_active" defaultChecked={classData.is_active} className="h-4 w-4" />
                <div className="space-y-1">
                  <Label htmlFor="is_active" className="text-sm font-medium cursor-pointer">Active Class</Label>
                  <p className="text-xs text-muted-foreground">Students can enroll in active classes</p>
                </div>
              </div>
            </div>

            {/* Validation Errors */}
            {validationResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Validation Warnings */}
            {validationResult.warnings.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Class Schedule Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h3 className="text-lg font-medium text-foreground">Class Schedule</h3>
                  <p className="text-sm text-muted-foreground mt-1">Set up weekly recurring sessions for this class</p>
                  {selectedProgram && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {getSessionFrequencyDescription(selectedProgram)}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSchedule}
                  className="flex items-center gap-2 h-9"
                  tabIndex={0}
                >
                  <Plus className="h-4 w-4" />
                  Add Schedule
                </Button>
              </div>

              {classSchedules.length === 0 && (
                <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/25">
                  <p className="text-sm text-muted-foreground mb-2">
                    No schedules added yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click &quot;Add Schedule&quot; to create your first weekly session
                  </p>
                </div>
              )}

              {classSchedules.length > 0 && (
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-muted/50 rounded-lg text-sm font-medium text-muted-foreground">
                    <div className="col-span-5">Day of Week</div>
                    <div className="col-span-5">Start Time</div>
                    <div className="col-span-2 text-center">Action</div>
                  </div>

                  {/* Schedule rows */}
                  {classSchedules.map((schedule, index) => (
                    <div key={index} className="grid grid-cols-12 gap-4 p-4 border border-border rounded-lg bg-card hover:bg-muted/30 transition-colors items-center">
                      <div className="col-span-5">
                        <Select
                          name={`schedule_${index}_day`}
                          value={schedule.day}
                          onValueChange={(value) => updateSchedule(index, 'day', value)}
                        >
                          <SelectTrigger className="h-10 input-custom-styles">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monday">Monday</SelectItem>
                            <SelectItem value="tuesday">Tuesday</SelectItem>
                            <SelectItem value="wednesday">Wednesday</SelectItem>
                            <SelectItem value="thursday">Thursday</SelectItem>
                            <SelectItem value="friday">Friday</SelectItem>
                            <SelectItem value="saturday">Saturday</SelectItem>
                            <SelectItem value="sunday">Sunday</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-5">
                        <Input
                          id={`schedule_${index}_time`}
                          name={`schedule_${index}_time`}
                          type="time"
                          value={schedule.time}
                          onChange={(e) => updateSchedule(index, 'time', e.target.value)}
                          required
                          className="h-10 input-custom-styles"
                        />
                      </div>

                      <div className="col-span-2 flex justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSchedule(index)}
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          tabIndex={0}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Hidden input to track schedule count */}
              <input type="hidden" name="schedule_count" value={classSchedules.length} />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
              <div className="flex gap-3">
                <Button type="button" variant="outline" asChild className="h-10">
                  <Link to="/admin/classes">Cancel</Link>
                </Button>
                <Button type="button" variant="outline" asChild className="h-10">
                  <Link to={`/admin/classes/${classData.id}/sessions`}>
                    View Sessions
                  </Link>
                </Button>
              </div>
              <div className="sm:ml-auto">
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !validationResult.isValid}
                  className="h-10 px-8"
                >
                  {isSubmitting ? "Updating..." : "Update Class"}
                </Button>
              </div>
            </div>


          </Form>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-destructive/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete a class, there is no going back. Please be certain.
            </p>
            <Button
              type="button"
              variant="destructive"
              disabled={isSubmitting}
              onClick={() => setIsDeleteDialogOpen(true)}
              tabIndex={0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isSubmitting ? "Deleting..." : "Delete Class"}
            </Button>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the class
                <span className="font-semibold"> {classData.name}</span> and remove all associated data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting} tabIndex={0}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const formData = new FormData();
                  formData.append('intent', 'delete');
                  submit(formData, { method: 'post', replace: true });
                  setIsDeleteDialogOpen(false);
                }}
                disabled={isSubmitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                tabIndex={0}
              >
                {isSubmitting ? 'Deleting...' : 'Delete Class'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
