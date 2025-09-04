import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData, Link } from "@remix-run/react";
import { useState, useEffect } from "react";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { csrf } from "~/utils/csrf.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Plus, X, AlertTriangle, Info } from "lucide-react";
import { requireAdminUser } from "~/utils/auth.server";
import { createClass, getInstructors, createClassSchedule } from "~/services/class.server";
import { getPrograms } from "~/services/program.server";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import type { CreateClassData, Program } from "~/types/multi-class";
import { validateClassConstraints, getDefaultMaxCapacity, getSessionFrequencyDescription } from "~/utils/class-validation";


export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);

  const [programs, instructors] = await Promise.all([
    getPrograms(),
    getInstructors()
  ]);

  return json({ programs, instructors });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminUser(request);
  await csrf.validate(request);

  try {
    const formData = await request.formData();

    const maxCapacityValue = formData.get("max_capacity") as string;
    const instructorIdValue = formData.get("instructor_id") as string;

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
      program: selectedProgram
    });

    if (!validationResult.isValid) {
      return json(
        { error: validationResult.errors.join('. ') },
        { status: 400 }
      );
    }

    const classData: CreateClassData = {
      program_id: programId,
      name: className || selectedProgram?.name || "Unnamed Class",
      description: classDescription || selectedProgram?.description || "",
      max_capacity: maxCapacity,
      instructor_id: instructorIdValue || undefined,
      is_active: formData.get("is_active") === "on", // Checkbox sends "on" when checked
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

    return redirect("/admin/classes");
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Failed to create class" },
      { status: 400 }
    );
  }
}

export default function NewClass() {
  const { programs, instructors } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const isSubmitting = navigation.state === "submitting";

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
        program: selectedProgram
      });

      setValidationResult(result);
    }
  }, [selectedProgram, maxCapacity, schedules, scheduleTimes, scheduleDays]);

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
    <div className="container mx-auto py-6">
      <AppBreadcrumb 
        items={breadcrumbPatterns.adminClassNew()} 
        className="mb-6"
      />

      <div className="flex items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Class</h1>
          <p className="text-muted-foreground">
            Set up a new class with schedule and capacity limits.
          </p>
        </div>
      </div>

      {actionData?.error && (
        <Alert className="mb-6">
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Class Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            <AuthenticityTokenInput />
            {/* Compact grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="program_id">Program *</Label>
                <Select 
                  name="program_id" 
                  required 
                  value={selectedProgramId}
                  onValueChange={setSelectedProgramId}
                >
                  <SelectTrigger className="input-custom-styles">
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
                <Label htmlFor="name">Class Name (Optional)</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Leave empty to use program name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructor_id">Instructor</Label>
                <Select name="instructor_id">
                  <SelectTrigger className="input-custom-styles">
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
                  className={validationResult.errors.some(e => e.includes('capacity')) ? "border-red-500" : ""}
                />
                {selectedProgram?.max_capacity && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Program maximum: {selectedProgram.max_capacity} students
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Leave empty to use program description"
                rows={2}
              />
            </div>

            {/* Validation Messages */}
            {(validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
              <div className="space-y-2">
                {validationResult.errors.map((error, index) => (
                  <Alert key={`error-${index}`} className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">{error}</AlertDescription>
                  </Alert>
                ))}
                {validationResult.warnings.map((warning, index) => (
                  <Alert key={`warning-${index}`} className="border-yellow-200 bg-yellow-50">
                    <Info className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Class Schedule Section */}
            <div className="space-y-4">
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-3">Class Schedule</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add weekly schedule slots for this class. Duration is taken from the program.
                  {selectedProgram && (
                    <span className="block mt-1 font-medium">
                      {getSessionFrequencyDescription(selectedProgram)}
                    </span>
                  )}
                </p>

                <div className="space-y-3">
                  {/* Headers */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 px-4">
                    <Label>Day of Week</Label>
                    <Label>Start Time</Label>
                  </div>

                  {/* Schedule rows */}
                  <div className="space-y-2">
                    {schedules.map((schedule) => (
                      <div key={schedule.id} className="flex gap-4 items-start border rounded-lg p-4">
                        <div className="flex-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Select 
                              name={`schedules[${schedule.id}][day_of_week]`}
                              value={scheduleDays[schedule.id] || ''}
                              onValueChange={(value) => handleDayChange(schedule.id, value)}
                            >
                              <SelectTrigger className="input-custom-styles">
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
                              className={!isTimeValid(schedule.id) ? "border-red-500 focus-visible:ring-red-500" : ""}
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
                            className="flex-shrink-0 text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Plus button at bottom */}
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSchedule}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Schedule
                    </Button>
                  </div>

                  {/* Helper text */}
                  <p className="text-xs text-muted-foreground text-center">Use 24-hour format (e.g., 17:45 for 5:45 PM)</p>
                </div>


              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="is_active" name="is_active" defaultChecked={true} />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" asChild>
                  <Link to="/admin/classes">Cancel</Link>
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !validationResult.isValid}
                >
                  {isSubmitting ? "Creating..." : "Create Class"}
                </Button>
              </div>
            </div>


          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
