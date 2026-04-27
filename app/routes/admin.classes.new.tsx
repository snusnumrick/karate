import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData, Link } from "@remix-run/react";
import { useState, useEffect } from "react";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { csrf } from "~/utils/csrf.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Plus, X, AlertTriangle, Info } from "lucide-react";
import { withAdminLoader, withAdminAction } from "~/utils/auth.server";
import { createClass, getInstructors, createClassSchedule } from "~/services/class.server";
import { getPrograms } from "~/services/program.server";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import type { CreateClassData } from "~/types/multi-class";
import { validateClassConstraints, getDefaultMaxCapacity, getSessionFrequencyDescription } from "~/utils/class-validation";
import { serializeMoney } from "~/utils/money";
import { cn } from "~/lib/utils";


async function loaderImpl({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const engagement = url.searchParams.get("engagement") === "seminar" ? "seminar" : "program";

  const [programs, instructors] = await Promise.all([
    getPrograms({ is_active: true, engagement_type: engagement }),
    getInstructors()
  ]);

  // Serialize Money objects in programs
  const serializedPrograms = programs.map(program => ({
    ...program,
    monthly_fee: program.monthly_fee ? serializeMoney(program.monthly_fee) : undefined,
    registration_fee: program.registration_fee ? serializeMoney(program.registration_fee) : undefined,
    yearly_fee: program.yearly_fee ? serializeMoney(program.yearly_fee) : undefined,
    individual_session_fee: program.individual_session_fee ? serializeMoney(program.individual_session_fee) : undefined,
  }));

  return json({ programs: serializedPrograms, instructors, engagement });
}

export const loader = withAdminLoader(loaderImpl);

async function actionImpl({ request }: ActionFunctionArgs) {
  await csrf.validate(request);

  try {
    const formData = await request.formData();

    const maxCapacityValue = formData.get("max_capacity") as string;
    const instructorIdValue = formData.get("instructor_id") as string;

    const programId = formData.get("program_id") as string;
    const className = formData.get("name") as string;
    const engagementValue = formData.get("engagement") as string;
    const engagement = engagementValue === "seminar" ? "seminar" : "program";

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

    // Parse schedules from form data
    const schedules: Array<{day_of_week: string, start_time: string}> = [];
    for (const [key, value] of formData.entries()) {
      const scheduleMatch = key.match(/^schedules\[(\d+)]\[(\w+)]$/);
      if (scheduleMatch) {
        const [, index, field] = scheduleMatch;
        const scheduleIndex = parseInt(index, 10);

        if (!schedules[scheduleIndex]) {
          schedules[scheduleIndex] = { day_of_week: '', start_time: '' };
        }

        if (field === 'day_of_week' || field === 'start_time') {
          schedules[scheduleIndex][field] = value as string;
        }
      }
    }

    // Validate class constraints against program requirements
    const maxCapacity = maxCapacityValue ? parseInt(maxCapacityValue, 10) : undefined;
    const validationResult = validateClassConstraints({
      maxCapacity,
      schedules,
      program: selectedProgram,
      isSeminar: engagement === "seminar",
    });

    if (!validationResult.isValid) {
      return json(
        { error: validationResult.errors.join('. ') },
        { status: 400 }
      );
    }

    const topic = formData.get("topic") as string;
    const seriesStartOn = formData.get("series_start_on") as string;
    const seriesEndOn = formData.get("series_end_on") as string;
    const seriesSessionQuotaStr = formData.get("series_session_quota") as string;
    const minCapacityStr = formData.get("min_capacity") as string;
    const priceOverrideStr = formData.get("price_override") as string;
    const seriesStatus = formData.get("series_status") as string;
    const registrationStatus = formData.get("registration_status") as string;
    const allowSelfEnrollment = formData.get("allow_self_enrollment") === "on";

    const classData: CreateClassData = {
      program_id: programId,
      name: className || selectedProgram?.name || "Unnamed Class",
      description: classDescription || selectedProgram?.description || "",
      max_capacity: maxCapacity,
      instructor_id: instructorIdValue || undefined,
      is_active: formData.get("is_active") === "on",
      ...(engagement === "seminar" ? {
        topic: topic || undefined,
        series_start_on: seriesStartOn || undefined,
        series_end_on: seriesEndOn || undefined,
        series_session_quota: seriesSessionQuotaStr ? parseInt(seriesSessionQuotaStr, 10) : undefined,
        min_capacity: minCapacityStr ? parseInt(minCapacityStr, 10) : undefined,
        price_override_cents: priceOverrideStr ? Math.round(parseFloat(priceOverrideStr) * 100) : undefined,
        series_status: (seriesStatus || "tentative") as CreateClassData['series_status'],
        registration_status: (registrationStatus || "closed") as CreateClassData['registration_status'],
        allow_self_enrollment: allowSelfEnrollment,
      } : {}),
    };

    const newClass = await createClass(classData);

    // Create schedule entries for valid schedules
     for (const schedule of schedules) {
       if (schedule.day_of_week && schedule.start_time) {
         await createClassSchedule(
           newClass.id,
           schedule.day_of_week as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
           schedule.start_time
         );
       }
     }

    return redirect(engagement === "seminar" ? "/admin/classes?engagement=seminar" : "/admin/classes");
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Failed to create class" },
      { status: 400 }
    );
  }
}

export const action = withAdminAction(actionImpl);

export default function NewClass() {
  const { programs, instructors, engagement } = useLoaderData<typeof loader>();
  const isSeminarView = engagement === "seminar";
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const isSubmitting = navigation.state === "submitting";

  // Infer types from the loader data
  type ProgramType = typeof programs[number];

  const [schedules, setSchedules] = useState([{ id: 0, startTime: '', dayOfWeek: '' }]);
  const [scheduleTimes, setScheduleTimes] = useState<{[key: number]: string}>({0: ''});
  const [scheduleDays, setScheduleDays] = useState<{[key: number]: string}>({0: ''});
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [maxCapacity, setMaxCapacity] = useState<string>('');
  const [validationResult, setValidationResult] = useState<{isValid: boolean, errors: string[], warnings: string[]}>({
    isValid: true,
    errors: [],
    warnings: []
  });
  const pageTitle = isSeminarView ? "Create Seminar" : "Create New Class";
  const pageDescription = isSeminarView
    ? "Set up a new seminar with sessions, capacity, pricing, and registration settings."
    : "Set up a new class with schedules, capacity limits, and instructor assignment.";
  const sectionClass = "rounded-xl border border-gray-200 bg-gray-50/80 p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/40";
  const sectionTitleClass = "text-lg font-semibold text-gray-900 dark:text-gray-100";
  const sectionDescriptionClass = "mt-1 text-sm text-gray-600 dark:text-gray-400";
  const helperTextClass = "text-xs text-gray-500 dark:text-gray-400";
  const toggleCardClass = "flex items-start space-x-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800";
  const scheduleRowClass = "rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800";
  const primaryButtonClass = "bg-green-600 text-white shadow-sm hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500";
  const secondaryButtonClass = "border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/30 dark:hover:text-green-200";
  const dangerButtonClass = "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30 dark:hover:text-red-200";
  const checkboxClass = "checkbox-custom-styles border-green-600 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600";
  const inputClass = (hasError?: boolean) => cn(
    "input-custom-styles h-11 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
    hasError && "border-red-500 focus-visible:border-red-500"
  );
  const textareaClass = "input-custom-styles resize-none border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";

  const selectedProgram = programs.find(p => p.id === selectedProgramId);

  // Update default max capacity when program changes
  useEffect(() => {
    if (selectedProgram && !maxCapacity) {
      const defaultCapacity = getDefaultMaxCapacity(selectedProgram);
      if (defaultCapacity) {
        setMaxCapacity(defaultCapacity.toString());
      }
    }
  }, [selectedProgram, maxCapacity]);

  // Validate constraints in real-time
  useEffect(() => {
    if (selectedProgram) {
      const currentSchedules = schedules.map((schedule) => ({
        day_of_week: scheduleDays[schedule.id] || '',
        start_time: scheduleTimes[schedule.id] || ''
      }));

      const result = validateClassConstraints({
        maxCapacity: maxCapacity ? parseInt(maxCapacity, 10) : undefined,
        schedules: currentSchedules,
        program: selectedProgram,
        isSeminar: isSeminarView,
      });

      setValidationResult(result);
    }
  }, [selectedProgram, maxCapacity, schedules, scheduleTimes, scheduleDays, isSeminarView]);

  const addSchedule = () => {
    const newId = schedules.length;
    setSchedules(prev => [...prev, { id: newId, startTime: '', dayOfWeek: '' }]);
    setScheduleTimes(prev => ({...prev, [newId]: ''}));
    setScheduleDays(prev => ({...prev, [newId]: ''}));
  };

  const removeSchedule = (id: number) => {
    setSchedules(prev => prev.filter(schedule => schedule.id !== id));
    setScheduleTimes(prev => {
      const newTimes = {...prev};
      delete newTimes[id];
      return newTimes;
    });
    setScheduleDays(prev => {
      const newDays = {...prev};
      delete newDays[id];
      return newDays;
    });
  };

  const handleTimeChange = (scheduleId: number, time: string) => {
    setScheduleTimes(prev => ({...prev, [scheduleId]: time}));
  };

  const handleDayChange = (scheduleId: number, day: string) => {
    setScheduleDays(prev => ({...prev, [scheduleId]: day}));
  };

  const validateTimeFormat = (time: string): boolean => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  const isTimeValid = (scheduleId: number): boolean => {
    const time = scheduleTimes[scheduleId];
    return !time || validateTimeFormat(time);
  };



  return (
    <div className="min-h-screen bg-gray-50 py-12 text-foreground dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Card className="border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
          <CardHeader className="space-y-6 border-b border-gray-100 pb-8 dark:border-gray-700">
            <AppBreadcrumb
              items={isSeminarView ? breadcrumbPatterns.adminSeminarNew() : breadcrumbPatterns.adminClassNew()}
              className="mb-0"
            />

            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-green-50 p-3 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <div className="inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
                  {isSeminarView ? "Seminar Setup" : "Class Setup"}
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
            {actionData?.error && (
              <Alert className="mb-6 border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription>{actionData.error}</AlertDescription>
              </Alert>
            )}

            <Form method="post" className="space-y-8">
              <AuthenticityTokenInput />
              <input type="hidden" name="engagement" value={engagement} />

              <div className={sectionClass}>
                <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
                  <h3 className={sectionTitleClass}>{isSeminarView ? "Seminar Details" : "Class Details"}</h3>
                  <p className={sectionDescriptionClass}>
                    {isSeminarView
                      ? "Choose the seminar template, instructor, and capacity settings for this run."
                      : "Choose the program, instructor, and capacity settings for this class."}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="program_id">{isSeminarView ? "Seminar Template *" : "Program *"}</Label>
                    <Select
                      name="program_id"
                      required
                      value={selectedProgramId}
                      onValueChange={setSelectedProgramId}
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
                    <Label htmlFor="name">{isSeminarView ? "Seminar Name" : "Class Name"} (Optional)</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder={isSeminarView ? "Leave empty to use seminar template name" : "Leave empty to use program name"}
                      className={inputClass()}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instructor_id">Instructor</Label>
                    <Select name="instructor_id">
                      <SelectTrigger className={inputClass()}>
                        <SelectValue placeholder="Select instructor (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {instructors.map((instructor) => (
                          <SelectItem key={instructor.id} value={instructor.id}>
                            {instructor.first_name} {instructor.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_capacity">Max Capacity</Label>
                    <Input
                      id="max_capacity"
                      name="max_capacity"
                      type="number"
                      min="1"
                      max={selectedProgram?.max_capacity || undefined}
                      value={maxCapacity}
                      onChange={(e) => setMaxCapacity(e.target.value)}
                      placeholder={selectedProgram?.max_capacity ? `Default: ${selectedProgram.max_capacity}` : "e.g., 20"}
                      className={inputClass(validationResult.errors.some((e) => e.includes('capacity')))}
                    />
                    {selectedProgram?.max_capacity && (
                      <p className={cn(helperTextClass, "flex items-center gap-1")}>
                        <Info className="h-3 w-3" />
                        Program maximum: {selectedProgram.max_capacity} students
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder={isSeminarView ? "Leave empty to use seminar template description" : "Leave empty to use program description"}
                    rows={2}
                    className={textareaClass}
                  />
                </div>
              </div>

              {isSeminarView && (
                <div className={sectionClass}>
                  <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
                    <h3 className={sectionTitleClass}>Seminar Run Details</h3>
                    <p className={sectionDescriptionClass}>Set timing, pricing, and registration settings for this seminar run.</p>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="topic">Topic (Optional)</Label>
                      <Input
                        id="topic"
                        name="topic"
                        placeholder="e.g. Beginner Fundamentals"
                        className={inputClass()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="series_start_on">Start Date</Label>
                      <Input
                        id="series_start_on"
                        name="series_start_on"
                        type="date"
                        className={inputClass()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="series_end_on">End Date</Label>
                      <Input
                        id="series_end_on"
                        name="series_end_on"
                        type="date"
                        className={inputClass()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="series_session_quota">Number of Sessions</Label>
                      <Input
                        id="series_session_quota"
                        name="series_session_quota"
                        type="number"
                        min="1"
                        placeholder="e.g. 5"
                        className={inputClass()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="min_capacity">Min Capacity</Label>
                      <Input
                        id="min_capacity"
                        name="min_capacity"
                        type="number"
                        min="1"
                        placeholder="e.g. 8"
                        className={inputClass()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price_override">Price Override ($)</Label>
                      <Input
                        id="price_override"
                        name="price_override"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Leave blank to use template price"
                        className={inputClass()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="series_status">Series Status</Label>
                      <Select name="series_status" defaultValue="tentative">
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
                      <Label htmlFor="registration_status">Registration Status</Label>
                      <Select name="registration_status" defaultValue="closed">
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

                  <div className="mt-6">
                    <div className={toggleCardClass}>
                      <Checkbox id="allow_self_enrollment" name="allow_self_enrollment" className={cn("mt-1", checkboxClass)} />
                      <div className="space-y-1">
                        <Label htmlFor="allow_self_enrollment" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Allow Self-Enrollment
                        </Label>
                        <p className={helperTextClass}>Families can register for this seminar online.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
                <div className="space-y-2">
                  {validationResult.errors.map((error, index) => (
                    <Alert key={`error-${index}`} className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <AlertDescription className="text-red-800 dark:text-red-300">{error}</AlertDescription>
                    </Alert>
                  ))}
                  {validationResult.warnings.map((warning, index) => (
                    <Alert key={`warning-${index}`} className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
                      <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertDescription className="text-yellow-800 dark:text-yellow-300">{warning}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              <div className={sectionClass}>
                <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
                  <h3 className={sectionTitleClass}>{isSeminarView ? "Session Schedule" : "Class Schedule"}</h3>
                  <p className={sectionDescriptionClass}>
                    {isSeminarView ? "Add weekly schedule slots for this seminar. Duration is taken from the seminar template." : "Add weekly schedule slots for this class. Duration is taken from the program."}
                    {selectedProgram && (
                      <span className="mt-1 block font-medium text-gray-700 dark:text-gray-300">
                        {getSessionFrequencyDescription(selectedProgram)}
                      </span>
                    )}
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="grid grid-cols-1 gap-4 px-1 sm:grid-cols-2 sm:px-4">
                    <Label>Day of Week</Label>
                    <Label>Start Time</Label>
                  </div>

                  <div className="space-y-2">
                    {schedules.map((schedule) => (
                      <div key={schedule.id} className={cn(scheduleRowClass, "flex items-start gap-4")}>
                        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Select
                              name={`schedules[${schedule.id}][day_of_week]`}
                              value={scheduleDays[schedule.id] || ''}
                              onValueChange={(value) => handleDayChange(schedule.id, value)}
                            >
                              <SelectTrigger className={inputClass()}>
                                <SelectValue placeholder="Select day" />
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

                          <div className="space-y-2">
                            <Input
                              id={`start_time_${schedule.id}`}
                              name={`schedules[${schedule.id}][start_time]`}
                              type="text"
                              value={scheduleTimes[schedule.id] || ''}
                              onChange={(e) => handleTimeChange(schedule.id, e.target.value)}
                              placeholder="HH:MM (e.g., 17:45)"
                              pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                              className={inputClass(!isTimeValid(schedule.id))}
                            />
                            {!isTimeValid(schedule.id) && (
                              <p className="text-xs text-red-500">Please enter time in HH:MM format (00:00 to 23:59)</p>
                            )}
                          </div>
                        </div>

                        {schedules.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeSchedule(schedule.id)}
                            className={cn("flex-shrink-0", dangerButtonClass)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSchedule}
                      className={secondaryButtonClass}
                    >
                      <Plus className="h-4 w-4" />
                      Add Schedule
                    </Button>
                  </div>

                  <p className={cn(helperTextClass, "text-center")}>Use 24-hour format (e.g., 17:45 for 5:45 PM)</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
                <div className={cn(toggleCardClass, "w-full sm:w-auto")}>
                  <Checkbox id="is_active" name="is_active" defaultChecked={true} className={cn("mt-1", checkboxClass)} />
                  <div className="space-y-1">
                    <Label htmlFor="is_active" className="text-sm font-medium text-gray-900 dark:text-gray-100">Active</Label>
                    <p className={helperTextClass}>Make this {isSeminarView ? "seminar" : "class"} available immediately.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" variant="outline" asChild className={secondaryButtonClass}>
                    <Link to={isSeminarView ? "/admin/classes?engagement=seminar" : "/admin/classes"}>Cancel</Link>
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !validationResult.isValid}
                    className={primaryButtonClass}
                  >
                    {isSubmitting ? "Creating..." : isSeminarView ? "Create Seminar" : "Create Class"}
                  </Button>
                </div>
              </div>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
