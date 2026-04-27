import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData, Link, useSubmit } from "@remix-run/react";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
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
import { withAdminLoader, withAdminAction } from "~/utils/auth.server";
import { getClassById, updateClass, deleteClass, getInstructors, getClassSchedules, updateClassSchedules } from "~/services/class.server";
import { getPrograms } from "~/services/program.server";
import type { UpdateClassData } from "~/types/multi-class";
import { useState, useEffect } from "react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { validateClassConstraints, getSessionFrequencyDescription } from "~/utils/class-validation";
import { serializeMoney } from "~/utils/money";
import { cn } from "~/lib/utils";


async function loaderImpl({ params }: LoaderFunctionArgs) {

  const classId = params.id;
  if (!classId) {
    throw new Response("Class ID is required", { status: 400 });
  }

  const [classData, allPrograms, instructors, schedules] = await Promise.all([
    getClassById(classId),
    getPrograms(),
    getInstructors(),
    getClassSchedules(classId)
  ]);

  if (!classData) {
    throw new Response("Class not found", { status: 404 });
  }

  const matchingProgram = allPrograms.find(p => p.id === classData.program_id);
  const isSeminarView = matchingProgram?.engagement_type === 'seminar';
  const programs = allPrograms.filter(p => p.engagement_type === (isSeminarView ? 'seminar' : 'program'));

  // Serialize Money objects in programs
  const serializedPrograms = programs.map(program => ({
    ...program,
    monthly_fee: program.monthly_fee ? serializeMoney(program.monthly_fee) : undefined,
    registration_fee: program.registration_fee ? serializeMoney(program.registration_fee) : undefined,
    yearly_fee: program.yearly_fee ? serializeMoney(program.yearly_fee) : undefined,
    individual_session_fee: program.individual_session_fee ? serializeMoney(program.individual_session_fee) : undefined,
  }));

  return json({ classData, programs: serializedPrograms, instructors, schedules, isSeminarView });
}

export const loader = withAdminLoader(loaderImpl);

async function actionImpl({ request, params }: ActionFunctionArgs) {

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
      const isSeminar = formData.get("is_seminar_view") === "true";
      await deleteClass(classId);
      return redirect(isSeminar ? "/admin/classes?engagement=seminar" : "/admin/classes");
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
        program: selectedProgram,
        isSeminar: selectedProgram.engagement_type === 'seminar',
      });

      if (!validationResult.isValid) {
        return json(
          { error: validationResult.errors.join('. ') },
          { status: 400 }
        );
      }

      const isSeminarUpdate = selectedProgram.engagement_type === 'seminar';
      const topic = formData.get("topic") as string;
      const seriesStartOn = formData.get("series_start_on") as string;
      const seriesEndOn = formData.get("series_end_on") as string;
      const seriesSessionQuotaStr = formData.get("series_session_quota") as string;
      const minCapacityStr = formData.get("min_capacity") as string;
      const priceOverrideStr = formData.get("price_override") as string;
      const seriesStatus = formData.get("series_status") as string;
      const registrationStatus = formData.get("registration_status") as string;
      const allowSelfEnrollment = formData.get("allow_self_enrollment") === "on";

      const updateData: Omit<UpdateClassData, 'id'> = {
        program_id: programId,
        name: className || selectedProgram?.name || "Unnamed Class",
        description: classDescription || selectedProgram?.description || "",
        is_active: formData.get("is_active") === "on",
        max_capacity: maxCapacity,
        instructor_id: instructorId === "none" ? undefined : instructorId || undefined,
        ...(isSeminarUpdate ? {
          topic: topic || undefined,
          series_start_on: seriesStartOn || undefined,
          series_end_on: seriesEndOn || undefined,
          series_session_quota: seriesSessionQuotaStr ? parseInt(seriesSessionQuotaStr, 10) : undefined,
          min_capacity: minCapacityStr ? parseInt(minCapacityStr, 10) : undefined,
          price_override_cents: priceOverrideStr ? Math.round(parseFloat(priceOverrideStr) * 100) : undefined,
          series_status: (seriesStatus || undefined) as UpdateClassData['series_status'],
          registration_status: (registrationStatus || undefined) as UpdateClassData['registration_status'],
          allow_self_enrollment: allowSelfEnrollment,
        } : {}),
      };

      // Update class and schedules
      await Promise.all([
        updateClass(classId, updateData),
        updateClassSchedules(classId, schedules)
      ]);

      const isSeminar = selectedProgram.engagement_type === 'seminar';
      return redirect(isSeminar ? "/admin/classes?engagement=seminar" : "/admin/classes");
    }

    return json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Failed to update class" },
      { status: 400 }
    );
  }
}

export const action = withAdminAction(actionImpl);

export default function EditClass() {
  const { classData, programs, instructors, schedules, isSeminarView } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  type ProgramType = typeof programs[number];

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
        program: selectedProgram,
        isSeminar: isSeminarView,
      });

      setValidationResult(result);
    }
  }, [selectedProgram, maxCapacity, classSchedules, isSeminarView]);

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
  const pageTitle = isSeminarView ? "Edit Seminar" : "Edit Class";
  const pageDescription = isSeminarView
    ? "Update seminar details, schedule, capacity, pricing, and registration settings."
    : "Update class details, schedule, capacity, and instructor assignment.";
  const sectionClass = "rounded-xl border border-gray-200 bg-gray-50/80 p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/40";
  const sectionTitleClass = "text-lg font-semibold text-gray-900 dark:text-gray-100";
  const sectionDescriptionClass = "mt-1 text-sm text-gray-600 dark:text-gray-400";
  const helperTextClass = "text-xs text-gray-500 dark:text-gray-400";
  const toggleCardClass = "flex items-start space-x-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800";
  const scheduleRowClass = "rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800";
  const primaryButtonClass = "bg-green-600 text-white shadow-sm hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500";
  const secondaryButtonClass = "border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/30 dark:hover:text-green-200";
  const dangerButtonClass = "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30 dark:hover:text-red-200";
  const activeBadgeClass = "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200";
  const inactiveBadgeClass = "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-700/70 dark:text-gray-200";
  const checkboxClass = "checkbox-custom-styles border-green-600 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600";
  const inputClass = (hasError?: boolean) => cn(
    "h-11 input-custom-styles border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
    hasError && "border-red-500 focus-visible:border-red-500"
  );
  const textareaClass = "input-custom-styles min-h-[96px] border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";



  return (
    <div className="min-h-screen bg-gray-50 py-12 text-foreground dark:bg-gray-900">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Card className="border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
          <CardHeader className="space-y-6 border-b border-gray-100 pb-8 dark:border-gray-700">
            <AppBreadcrumb
              items={isSeminarView
                ? [{ label: "Admin Dashboard", href: "/admin" }, { label: "Seminars", href: "/admin/classes?engagement=seminar" }, { label: classData.name, current: true }]
                : breadcrumbPatterns.adminClassEdit(classData.name)
              }
              className="mb-0"
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-green-50 p-3 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  <Info className="h-6 w-6" />
                </div>
                <div>
                  <div className="inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {isSeminarView ? "Seminar Setup" : "Class Setup"}
                  </div>
                  <CardTitle className="mt-3 text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">
                    {pageTitle}
                  </CardTitle>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{classData.name}</p>
                  <CardDescription className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                    {pageDescription}
                  </CardDescription>
                </div>
              </div>

              <div className={cn(
                "inline-flex h-fit rounded-full border px-3 py-1 text-sm font-medium",
                classData.is_active ? activeBadgeClass : inactiveBadgeClass
              )}>
                {classData.is_active ? "Active" : "Inactive"}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-8">
            {actionData?.error && (
              <Alert className="mb-6 border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription>{actionData.error}</AlertDescription>
              </Alert>
            )}

            <Form method="post" className="space-y-8">
              <AuthenticityTokenInput />
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="is_seminar_view" value={isSeminarView ? "true" : "false"} />

              <div className={sectionClass}>
                <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
                  <h3 className={sectionTitleClass}>Basic Information</h3>
                  <p className={sectionDescriptionClass}>
                    {isSeminarView
                      ? "Update template assignment, capacity, instructor, and description."
                      : "Update program assignment, naming, capacity, instructor, and description."}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="program_id" className="text-sm font-medium">{isSeminarView ? "Seminar Template *" : "Program *"}</Label>
                    <Select
                      name="program_id"
                      value={selectedProgramId}
                      onValueChange={setSelectedProgramId}
                      required
                    >
                      <SelectTrigger className={inputClass()}>
                        <SelectValue placeholder={isSeminarView ? "Select seminar template" : "Select program"} />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.filter((p: ProgramType) => p.is_active).map((program: ProgramType) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProgram && (
                      <p className={cn(helperTextClass, "flex items-center gap-1")}>
                        <Info className="h-3 w-3" />
                        {getSessionFrequencyDescription(selectedProgram)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      {isSeminarView ? "Seminar Name" : "Class Name"}
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={classData.name}
                      placeholder={isSeminarView ? "Leave empty to use seminar template name" : "Leave empty to use program name"}
                      className={inputClass()}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_capacity" className="text-sm font-medium">Max Capacity *</Label>
                    <Input
                      id="max_capacity"
                      type="number"
                      name="max_capacity"
                      value={maxCapacity}
                      onChange={(e) => setMaxCapacity(e.target.value)}
                      min="1"
                      max={selectedProgram?.max_capacity}
                      placeholder={selectedProgram?.max_capacity != null ? `Max: ${selectedProgram.max_capacity}` : "Enter capacity"}
                      required
                      className={inputClass(validationResult.errors.some((error) => error.includes('capacity')))}
                    />
                    {selectedProgram?.max_capacity != null && (
                      <p className={helperTextClass}>
                        {isSeminarView ? "Seminar template maximum:" : "Program maximum:"} {selectedProgram.max_capacity} students
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instructor_id" className="text-sm font-medium">Instructor</Label>
                    <Select name="instructor_id" defaultValue={classData.instructor_id || 'none'}>
                      <SelectTrigger className={inputClass()}>
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

                <div className="mt-6 space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={classData.description || ''}
                    placeholder={isSeminarView ? "Leave empty to use seminar template description" : "Leave empty to use program description"}
                    rows={3}
                    className={textareaClass}
                  />
                </div>

                {isSeminarView && (
                  <div className="mt-6 space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700">
                    <div>
                      <h3 className={sectionTitleClass}>Seminar Run Details</h3>
                      <p className={sectionDescriptionClass}>Adjust pricing, timing, and registration for this seminar run.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="topic" className="text-sm font-medium">Topic (Optional)</Label>
                        <Input
                          id="topic"
                          name="topic"
                          defaultValue={classData.topic || ''}
                          placeholder="e.g. Beginner Fundamentals"
                          className={inputClass()}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="series_start_on" className="text-sm font-medium">Start Date</Label>
                        <Input
                          id="series_start_on"
                          name="series_start_on"
                          type="date"
                          defaultValue={classData.series_start_on || ''}
                          className={inputClass()}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="series_end_on" className="text-sm font-medium">End Date</Label>
                        <Input
                          id="series_end_on"
                          name="series_end_on"
                          type="date"
                          defaultValue={classData.series_end_on || ''}
                          className={inputClass()}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="series_session_quota" className="text-sm font-medium">Number of Sessions</Label>
                        <Input
                          id="series_session_quota"
                          name="series_session_quota"
                          type="number"
                          min="1"
                          defaultValue={classData.series_session_quota?.toString() || ''}
                          placeholder="e.g. 5"
                          className={inputClass()}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="min_capacity" className="text-sm font-medium">Min Capacity</Label>
                        <Input
                          id="min_capacity"
                          name="min_capacity"
                          type="number"
                          min="1"
                          defaultValue={classData.min_capacity?.toString() || ''}
                          placeholder="e.g. 8"
                          className={inputClass()}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price_override" className="text-sm font-medium">Price Override ($)</Label>
                        <Input
                          id="price_override"
                          name="price_override"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={classData.price_override_cents != null ? (classData.price_override_cents / 100).toFixed(2) : ''}
                          placeholder="Leave blank to use template price"
                          className={inputClass()}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="series_status" className="text-sm font-medium">Series Status</Label>
                        <Select name="series_status" defaultValue={classData.series_status || 'tentative'}>
                          <SelectTrigger className={inputClass()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tentative">Tentative</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="registration_status" className="text-sm font-medium">Registration Status</Label>
                        <Select name="registration_status" defaultValue={classData.registration_status || 'closed'}>
                          <SelectTrigger className={inputClass()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                            <SelectItem value="waitlisted">Waitlisted</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className={toggleCardClass}>
                      <Checkbox
                        id="allow_self_enrollment"
                        name="allow_self_enrollment"
                        defaultChecked={classData.allow_self_enrollment}
                        className={cn("mt-1", checkboxClass)}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="allow_self_enrollment" className="text-sm font-medium cursor-pointer text-gray-900 dark:text-gray-100">Allow Self-Enrollment</Label>
                        <p className={helperTextClass}>Families can register online without contacting admin.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {validationResult.errors.length > 0 && (
                  <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertDescription className="text-red-800 dark:text-red-300">
                      <ul className="list-disc list-inside space-y-1">
                        {validationResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {validationResult.warnings.length > 0 && (
                  <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
                    <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <AlertDescription className="text-yellow-800 dark:text-yellow-300">
                      <ul className="list-disc list-inside space-y-1">
                        {validationResult.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className={sectionClass}>
                <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-700 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className={sectionTitleClass}>{isSeminarView ? "Session Schedule" : "Class Schedule"}</h3>
                    <p className={sectionDescriptionClass}>{isSeminarView ? "Set up sessions for this seminar." : "Set up weekly recurring sessions for this class."}</p>
                    {selectedProgram && (
                      <p className={cn(helperTextClass, "mt-1")}>
                        {getSessionFrequencyDescription(selectedProgram)}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSchedule}
                    className={secondaryButtonClass}
                    tabIndex={0}
                  >
                    <Plus className="h-4 w-4" />
                    Add Schedule
                  </Button>
                </div>

                {classSchedules.length === 0 && (
                  <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center dark:border-gray-700 dark:bg-gray-800">
                    <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
                      No schedules added yet
                    </p>
                    <p className={helperTextClass}>
                      Click &quot;Add Schedule&quot; to create your first weekly session.
                    </p>
                  </div>
                )}

                {classSchedules.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <div className="grid grid-cols-12 gap-4 rounded-lg bg-gray-100 px-4 py-3 text-sm font-medium text-gray-600 dark:bg-gray-800/80 dark:text-gray-300">
                      <div className="col-span-5">Day of Week</div>
                      <div className="col-span-5">Start Time</div>
                      <div className="col-span-2 text-center">Action</div>
                    </div>

                    {classSchedules.map((schedule, index) => (
                      <div key={index} className={cn(scheduleRowClass, "grid grid-cols-12 gap-4 items-center")}>
                        <div className="col-span-5">
                          <Select
                            name={`schedule_${index}_day`}
                            value={schedule.day}
                            onValueChange={(value) => updateSchedule(index, 'day', value)}
                          >
                            <SelectTrigger className={inputClass()}>
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
                            className={inputClass()}
                          />
                        </div>

                        <div className="col-span-2 flex justify-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeSchedule(index)}
                            className={dangerButtonClass}
                            tabIndex={0}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <input type="hidden" name="schedule_count" value={classSchedules.length} />
              </div>

              <div className="flex flex-col gap-4 border-t border-gray-200 pt-6 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
                <div className={cn(toggleCardClass, "w-full sm:w-auto")}>
                  <Checkbox id="is_active" name="is_active" defaultChecked={classData.is_active} className={cn("mt-1", checkboxClass)} />
                  <div className="space-y-1">
                    <Label htmlFor="is_active" className="text-sm font-medium cursor-pointer text-gray-900 dark:text-gray-100">{isSeminarView ? "Active Seminar" : "Active Class"}</Label>
                    <p className={helperTextClass}>{isSeminarView ? "Students can enroll in this active seminar." : "Students can enroll in this active class."}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" variant="outline" asChild className={secondaryButtonClass}>
                    <Link to={isSeminarView ? "/admin/classes?engagement=seminar" : "/admin/classes"}>Cancel</Link>
                  </Button>
                  <Button type="button" variant="outline" asChild className={secondaryButtonClass}>
                    <Link to={`/admin/classes/${classData.id}/sessions`}>
                      View Sessions
                    </Link>
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !validationResult.isValid}
                    className={primaryButtonClass}
                  >
                    {isSubmitting ? "Updating..." : isSeminarView ? "Update Seminar" : "Update Class"}
                  </Button>
                </div>
              </div>
            </Form>
          </CardContent>
        </Card>

        <Card className="border border-red-200 bg-white shadow-sm dark:border-red-800/60 dark:bg-gray-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-red-700 dark:text-red-400">Danger Zone</CardTitle>
            <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
              Permanently remove this {isSeminarView ? "seminar" : "class"} and its associated data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setIsDeleteDialogOpen(true)}
              className={dangerButtonClass}
              tabIndex={0}
            >
              <Trash2 className="h-4 w-4" />
              {isSubmitting ? "Deleting..." : isSeminarView ? "Delete Seminar" : "Delete Class"}
            </Button>
          </CardContent>
        </Card>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900 dark:text-gray-100">Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                This action cannot be undone. This will permanently delete the {isSeminarView ? "seminar" : "class"}
                <span className="font-semibold text-gray-900 dark:text-gray-100"> {classData.name}</span> and remove all associated data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting} className={secondaryButtonClass} tabIndex={0}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const formData = new FormData();
                  formData.append('intent', 'delete');
                  formData.append('is_seminar_view', isSeminarView ? 'true' : 'false');
                  submit(formData, { method: 'post', replace: true });
                  setIsDeleteDialogOpen(false);
                }}
                disabled={isSubmitting}
                className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
                tabIndex={0}
              >
                {isSubmitting ? 'Deleting...' : isSeminarView ? 'Delete Seminar' : 'Delete Class'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
