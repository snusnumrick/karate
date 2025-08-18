import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { useState, useEffect, useMemo } from "react";
import { Users, GraduationCap, Calendar, FileText, CheckCircle, AlertCircle, User } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

import { getClasses } from "~/services/class.server";
import { enrollStudent, getEnrollments } from "~/services/enrollment.server";
import { getPrograms } from "~/services/program.server";
import { requireAdminUser } from "~/utils/auth.server";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { formatDate } from "~/utils/misc";
import type { CreateEnrollmentData } from "~/types/multi-class";

type FamilyWithStudents = {
  id: string;
  name: string;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    birth_date: string;
    gender: string;
    special_needs: string | null;
  }[];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);

  const supabase = getSupabaseAdminClient();

  const [classes, programs, familiesResult, enrollments] = await Promise.all([
    getClasses(),
    getPrograms(),
    supabase
      .from('families')
      .select(`
        id,
        name,
        students (
          id,
          first_name,
          last_name,
          birth_date,
          gender,
          special_needs
        )
      `)
      .order('name', { ascending: true }),
    getEnrollments({ status: 'active' })
  ]);

  if (familiesResult.error) {
    throw new Response("Failed to load families", { status: 500 });
  }

  const families = familiesResult.data as FamilyWithStudents[];

  return json({ 
    classes: classes.filter(c => c.is_active), 
    programs, 
    families: families.filter(f => f.students && f.students.length > 0),
    enrollments
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminUser(request);

  const formData = await request.formData();
  const classId = formData.get("class_id") as string;
  const studentId = formData.get("student_id") as string;
  const notes = formData.get("notes") as string;

  if (!classId || !studentId) {
    return json({ error: "Class and student are required" }, { status: 400 });
  }

  try {
    // Get class data to find program_id
    const supabase = getSupabaseAdminClient();
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('program_id')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      return json({ error: "Class not found" }, { status: 400 });
    }

    const enrollmentData: CreateEnrollmentData = {
      student_id: studentId,
      class_id: classId,
      program_id: classData.program_id,
      notes: notes || undefined,
    };

    await enrollStudent(enrollmentData);
    return redirect("/admin/enrollments");
  } catch (error) {
    console.error("Enrollment error:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Failed to enroll student" 
    }, { status: 400 });
  }
}

export default function NewEnrollmentPage() {
  const { classes, programs, families, enrollments } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [eligibleClasses, setEligibleClasses] = useState<typeof classes>([]);

  const isSubmitting = navigation.state === "submitting";

  const selectedFamily = families.find(f => f.id === selectedFamilyId);
  const availableStudents = useMemo(() => selectedFamily?.students || [], [selectedFamily]);
  const selectedStudent = availableStudents.find((s: { id: string }) => s.id === selectedStudentId);

  // Get enrolled student IDs for quick lookup
  const enrolledStudentIds = useMemo(() => new Set(enrollments.map(e => e.student_id)), [enrollments]);

  const getClassInfo = (classId: string) => {
    const classItem = classes.find(c => c.id === classId);
    const program = classItem ? programs.find(p => p.id === classItem.program_id) : null;
    return { class: classItem, program };
  };

  // Update eligible classes when student changes
  useEffect(() => {
    if (!selectedStudent) {
      setEligibleClasses(classes); // Show all classes if no student selected
      return;
    }

    // Filter classes based on eligibility
    const filterEligibleClasses = async () => {
      try {
        const response = await fetch(`/api/student-eligible-classes/${selectedStudent.id}`);
        if (response.ok) {
          const eligibleClassIds = await response.json();
          const filtered = classes.filter(c => eligibleClassIds.includes(c.id));
          setEligibleClasses(filtered);
        } else {
          // Fallback to showing all classes if API fails
          console.warn('Failed to fetch eligible classes, showing all classes');
          setEligibleClasses(classes);
        }
      } catch (error) {
        console.error('Error fetching eligible classes:', error);
        // Fallback to showing all classes if there's an error
        setEligibleClasses(classes);
      }
    };

    filterEligibleClasses();
  }, [selectedStudent, classes]);

  // Auto-select student when family changes
  useEffect(() => {
    if (selectedFamilyId && availableStudents.length > 0) {
      if (availableStudents.length === 1) {
        // Auto-select if only one student
        setSelectedStudentId(availableStudents[0].id);
      } else {
        // Find first non-enrolled student
        const nonEnrolledStudent = availableStudents.find(s => !enrolledStudentIds.has(s.id));
        if (nonEnrolledStudent) {
          setSelectedStudentId(nonEnrolledStudent.id);
        }
      }
    }
  }, [selectedFamilyId, availableStudents, enrolledStudentIds]);

  // Auto-select first eligible class when student changes
  useEffect(() => {
    if (selectedStudentId && eligibleClasses.length > 0) {
      setSelectedClassId(eligibleClasses[0].id);
    } else {
      setSelectedClassId("");
    }
  }, [selectedStudentId, eligibleClasses]);

  return (
    <div className="min-h-screen page-background-styles py-12 text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8">
          <AppBreadcrumb 
            items={breadcrumbPatterns.adminEnrollmentNew()} 
            className="mb-6"
          />

          <div className="flex items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-green-600 dark:text-green-400">
                <GraduationCap className="h-8 w-8 text-primary" />
                Enroll Student
              </h1>
              <p className="text-muted-foreground mt-1">
                Add a student to a class. The system will check eligibility and capacity.
              </p>
            </div>
          </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary/5 to-primary/10">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Student Enrollment Form
              </h3>
            </div>
            <div className="p-6">
              <Form method="post" className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="family_id" className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Family
                    <Badge variant="secondary" className="ml-auto">Step 1</Badge>
                  </Label>
                  <Select 
                    value={selectedFamilyId} 
                    onValueChange={(value) => {
                      setSelectedFamilyId(value);
                      setSelectedStudentId(""); // Reset student selection when family changes
                    }}
                    required
                  >
                    <SelectTrigger className="input-custom-styles h-11 w-full [&>span]:line-clamp-none">
                      <SelectValue placeholder="Choose a family to get started" />
                    </SelectTrigger>
                    <SelectContent>
                      {families.map((family) => (
                        <SelectItem key={family.id} value={family.id}>
                          <div className="flex items-center justify-between w-full min-w-0">
                            <span className="truncate flex-1">{family.name}</span>
                            <Badge variant="outline" className="ml-2 flex-shrink-0">
                              {family.students.length} student{family.students.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="student_id" className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Student
                    <Badge variant="secondary" className="ml-auto">Step 2</Badge>
                  </Label>
                  <Select 
                    name="student_id" 
                    value={selectedStudentId}
                    onValueChange={(value) => {
                      setSelectedStudentId(value);
                    }}
                    disabled={!selectedFamilyId} 
                    required
                  >
                    <SelectTrigger className={`input-custom-styles h-11 ${!selectedFamilyId ? 'opacity-50' : ''}`}>
                      <SelectValue placeholder={selectedFamilyId ? "Select student" : "Select family first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStudents.map((student) => {
                        const isEnrolled = enrolledStudentIds.has(student.id);
                        return (
                          <SelectItem key={student.id} value={student.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{student.first_name} {student.last_name}</span>
                              {isEnrolled && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Already enrolled
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="class_id" className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Class
                    <Badge variant="secondary" className="ml-auto">Step 3</Badge>
                  </Label>
                  <Select 
                    name="class_id" 
                    value={selectedClassId}
                    onValueChange={setSelectedClassId}
                    disabled={!selectedStudentId} 
                    required
                  >
                    <SelectTrigger className={`input-custom-styles h-11 w-full [&>span]:line-clamp-none ${!selectedStudentId ? 'opacity-50' : ''}`}>
                      <SelectValue placeholder={
                        !selectedStudentId 
                          ? "Select student first" 
                          : eligibleClasses.length === 0 
                            ? "No eligible classes available" 
                            : "Select class"
                      } />
                    </SelectTrigger>
                    <SelectContent className="w-full min-w-[300px]">
                      {eligibleClasses.map((classItem) => {
                        const { program } = getClassInfo(classItem.id);
                        return (
                          <SelectItem key={classItem.id} value={classItem.id} className="w-full">
                            <div className="flex flex-col items-start w-full min-w-0">
                              <span className="font-medium w-full truncate">{program?.name}</span>
                              <span className="text-sm text-muted-foreground w-full whitespace-normal break-words">{classItem.name}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {selectedStudentId && eligibleClasses.length === 0 && (
                    <Alert variant="warning">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No classes are available for this student based on eligibility requirements (age, gender, special needs, belt rank, or prerequisites).
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="notes" className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes
                    <Badge variant="outline" className="ml-auto">Optional</Badge>
                  </Label>
                  <Input
                    id="notes"
                    name="notes"
                    placeholder="Add any special notes or requirements for this enrollment..."
                    className="h-11"
                  />
                </div>

                <div className="flex gap-4 pt-6 border-t">
                  <Button type="button" variant="outline" asChild className="flex-1">
                    <Link to="/admin/enrollments">Cancel</Link>
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !selectedClassId}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Enrolling...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Enroll Student
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        </div>

        {/* Sidebar with enrollment summary */}
        <div className="space-y-6">
          {selectedStudent && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Student Details
                </h3>
              </div>
              <div className="p-6 space-y-3">
                <div>
                  <p className="font-medium">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Born: {formatDate(selectedStudent.birth_date, { formatString: 'MMM d, yyyy' })}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    Gender: {selectedStudent.gender}
                  </p>
                  {selectedStudent.special_needs && (
                    <Badge variant="outline" className="mt-2">
                      Special Needs Support
                    </Badge>
                  )}
                </div>
                </div>
              </div>
            )}

          {selectedClassId && (() => {
            const { class: classItem, program } = getClassInfo(selectedClassId);
            return (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Class Details
                  </h3>
                </div>
                <div className="p-6 space-y-3">
                  <div>
                    <p className="font-medium">{program?.name}</p>
                    <p className="text-sm text-muted-foreground">{classItem?.name}</p>
                    {program?.description && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {program.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {program?.min_age && (
                      <Badge variant="outline">Min Age: {program.min_age}</Badge>
                    )}
                    {program?.max_age && (
                      <Badge variant="outline">Max Age: {program.max_age}</Badge>
                    )}
                    {classItem?.max_capacity && (
                      <Badge variant="outline">Capacity: {classItem.max_capacity}</Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border-primary/20">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Enrollment Progress
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    selectedFamilyId ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {selectedFamilyId ? '✓' : '1'}
                  </div>
                  <span className={selectedFamilyId ? 'text-green-700' : 'text-muted-foreground'}>
                    Family Selected
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    selectedStudentId ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {selectedStudentId ? '✓' : '2'}
                  </div>
                  <span className={selectedStudentId ? 'text-green-700' : 'text-muted-foreground'}>
                    Student Selected
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    selectedClassId ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {selectedClassId ? '✓' : '3'}
                  </div>
                  <span className={selectedClassId ? 'text-green-700' : 'text-muted-foreground'}>
                    Class Selected
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
