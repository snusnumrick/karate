import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Users, GraduationCap, Calendar, FileText, CheckCircle, AlertCircle, User } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";

import { getClasses } from "~/services/class.server";
import { enrollStudent, getEnrollments } from "~/services/enrollment.server";
import { getPrograms } from "~/services/program.server";
import { requireAdminUser } from "~/utils/auth.server";
import { createClient } from "~/utils/supabase.server";
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
  
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
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
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
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

  const getEligibleClasses = () => {
    if (!selectedStudent) {
      return classes; // Show all classes if no student selected
    }

    return classes.filter(classItem => {
      const program = programs.find(p => p.id === classItem.program_id);
      if (!program) return false;

      // Calculate student age
      const birthDate = new Date(selectedStudent.birth_date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;

      // Check age requirements
       if (program.min_age != null && actualAge < program.min_age) {
         return false;
       }
       if (program.max_age != null && actualAge > program.max_age) {
         return false;
       }

      // Check gender restrictions
      if (program.gender_restriction && program.gender_restriction !== 'none' && program.gender_restriction !== selectedStudent.gender) {
        return false;
      }

      // Check special needs support
      if (selectedStudent.special_needs && !program.special_needs_support) {
        return false;
      }

      return true;
    });
  };

  const eligibleClasses = getEligibleClasses();
  
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
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/enrollments">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Enrollments
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
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
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Student Enrollment Form
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
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
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Choose a family to get started" />
                    </SelectTrigger>
                    <SelectContent>
                      {families.map((family) => (
                        <SelectItem key={family.id} value={family.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{family.name}</span>
                            <Badge variant="outline" className="ml-2">
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
                    <SelectTrigger className={`h-11 ${!selectedFamilyId ? 'opacity-50' : ''}`}>
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
                    <SelectTrigger className={`h-11 ${!selectedStudentId ? 'opacity-50' : ''}`}>
                      <SelectValue placeholder={
                        !selectedStudentId 
                          ? "Select student first" 
                          : eligibleClasses.length === 0 
                            ? "No eligible classes available" 
                            : "Select class"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleClasses.map((classItem) => {
                        const { program } = getClassInfo(classItem.id);
                        return (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{program?.name}</span>
                              <span className="text-sm text-muted-foreground">{classItem.name}</span>
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
                        No classes are available for this student based on age, gender, or special needs requirements.
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
            </CardContent>
          </Card>
        </div>
        
        {/* Sidebar with enrollment summary */}
        <div className="space-y-6">
          {selectedStudent && (
            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Student Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Born: {new Date(selectedStudent.birth_date).toLocaleDateString()}
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
              </CardContent>
            </Card>
          )}
          
          {selectedClassId && (() => {
            const { class: classItem, program } = getClassInfo(selectedClassId);
            return (
              <Card className="shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Class Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                </CardContent>
              </Card>
            );
          })()}
          
          <Card className="shadow-md border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Enrollment Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}