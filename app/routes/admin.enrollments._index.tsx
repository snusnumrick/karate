import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useSearchParams, Link, useSubmit, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "~/components/ui/alert-dialog";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { CheckCircle, Clock, AlertCircle, Users, Plus, Edit, Trash2 } from "lucide-react";
import type { Database } from "~/types/database.types";
import type { EligibilityStatus } from "~/types/payment";
import { formatDate } from "~/utils/misc";
import { requireAdminUser } from "~/utils/auth.server";
import { getEnrollments, updateEnrollment, dropStudent } from "~/services/enrollment.server";
import { getClasses } from "~/services/class.server";
import { getPrograms } from "~/services/program.server";
import type { ClassEnrollment } from "~/types/multi-class";
import { checkStudentEligibility, createClient } from "~/utils/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  
  const url = new URL(request.url);
  const classId = url.searchParams.get("class");
  const programId = url.searchParams.get("program");
  const status = url.searchParams.get("status");
  
  const [enrollments, classes, programs] = await Promise.all([
    getEnrollments({ class_id: classId || undefined, status: status as 'active' | 'waitlist' | 'dropped' | 'completed' | undefined }),
    getClasses(),
    getPrograms()
  ]);

  // Create supabase admin client for eligibility checks
  const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Fetch eligibility for each enrolled student
  const enrollmentsWithEligibility = await Promise.all(
    enrollments.map(async (enrollment) => {
      if (enrollment.student) {
        const eligibility = await checkStudentEligibility(enrollment.student.id, supabaseAdmin);
        return {
          ...enrollment,
          student: {
            ...enrollment.student,
            eligibility
          }
        };
      }
      return enrollment;
    })
  );
  
  // Calculate stats from enrollments
  const stats = {
    total: enrollments.length,
    active: enrollments.filter(e => e.status === 'active').length,
    trial: enrollments.filter(e => e.status === 'trial').length,
    waitlisted: enrollments.filter(e => e.status === 'waitlist').length,
    dropped: enrollments.filter(e => e.status === 'dropped').length
  };
  
  return json({ 
    enrollments: enrollmentsWithEligibility, 
    classes, 
    programs, 
    stats,
    filters: { classId, programId, status }
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminUser(request);
  
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  
  switch (intent) {
    
    case "update": {
      const id = formData.get("id") as string;
      const updates = {
        status: formData.get("status") as "active" | "waitlist" | "dropped",
        notes: formData.get("notes") as string,
      };
      
      await updateEnrollment(id, updates);
      return json({ success: true });
    }
    
    case "drop": {
      const id = formData.get("id") as string;
      // const reason = formData.get("reason") as string;
      
      await dropStudent(id);
      return json({ success: true });
    }
    
    default:
      return json({ error: "Invalid intent" }, { status: 400 });
  }
}

function getStudentName(enrollment: ClassEnrollment): string {
  if (!enrollment.student) return "Unknown Student";
  return `${enrollment.student.first_name} ${enrollment.student.last_name}`;
}

function getEligibilityBadgeVariant(status: EligibilityStatus['reason']): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case 'Paid - Monthly':
    case 'Paid - Yearly':
      return 'default';
    case 'Trial':
      return 'secondary';
    case 'Expired':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default function AdminEnrollments() {
  const { enrollments, classes, programs, stats, filters } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const submit = useSubmit();
  
  const [selectedEnrollment, setSelectedEnrollment] = useState<ClassEnrollment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteEnrollmentId, setDeleteEnrollmentId] = useState<string | null>(null);
  
  const isSubmitting = navigation.state === "submitting";
  
  const handleFilterChange = (key: string, value: string) => {
    if (value === "all" || value === "") {
      searchParams.delete(key);
    } else {
      searchParams.set(key, value);
    }
    setSearchParams(searchParams);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case "trial":
        return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="h-3 w-3 mr-1" />Trial</Badge>;
      case "waitlist":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Waitlisted</Badge>;
      case "dropped":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Dropped</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getClassInfo = (classId: string) => {
    const classItem = classes.find(c => c.id === classId);
    const program = classItem ? programs.find(p => p.id === classItem.program_id) : null;
    return { class: classItem, program };
  };
  
  return (
    <div className="container mx-auto py-6">
      <AppBreadcrumb 
        items={breadcrumbPatterns.adminEnrollments()}
        className="mb-6"
      />
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enrollments</h1>
          <p className="text-muted-foreground">
            Manage student enrollments across all classes and programs.
          </p>
        </div>
        
        <Button asChild>
          <Link to="/admin/enrollments/new">
            <Plus className="h-4 w-4 mr-2" />
            Enroll Student
          </Link>
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.trial}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Waitlisted</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.waitlisted}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dropped</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.dropped}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select value={filters.programId || "all"} onValueChange={(value) => handleFilterChange("program", value)}>
                <SelectTrigger className="input-custom-styles">
                  <SelectValue placeholder="All programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={filters.classId || "all"} onValueChange={(value) => handleFilterChange("class", value)}>
                <SelectTrigger className="input-custom-styles">
                    <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent className="w-full min-w-[300px]">
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((classItem) => (
                    <SelectItem key={classItem.id} value={classItem.id} className="whitespace-normal">
                      {classItem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filters.status || "all"} onValueChange={(value) => handleFilterChange("status", value)}>
                <SelectTrigger className="input-custom-styles">
                    <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="waitlist">Waitlisted</SelectItem>
                  <SelectItem value="dropped">Dropped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Enrollments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Enrollments ({enrollments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enrolled Date</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
            <TableBody>
              {enrollments.map((enrollment) => {
                const { class: classItem, program } = getClassInfo(enrollment.class_id);
                
                return (
                  <TableRow key={enrollment.id}>
                    <TableCell className="font-medium">
                      {getStudentName(enrollment)}
                    </TableCell>
                    <TableCell>{program?.name || "Unknown"}</TableCell>
                    <TableCell className="min-w-[200px]">{classItem?.name || "Unknown"}</TableCell>
                    <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                    <TableCell>
                      {formatDate(enrollment.enrolled_at, { formatString: 'MMM d, yyyy' })}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {enrollment.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedEnrollment(enrollment);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        {enrollment.status !== "dropped" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteEnrollmentId(enrollment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {enrollments.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No enrollments found</h3>
              <p className="text-muted-foreground mb-4">
                No enrollments match your current filters.
              </p>
              <Button asChild>
                <Link to="/admin/enrollments/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Enroll Student
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Enrollment</DialogTitle>
            <DialogDescription>
              Update the enrollment status and notes.
            </DialogDescription>
          </DialogHeader>
          
          {selectedEnrollment && (
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="id" value={selectedEnrollment.id} />
              
              <div className="space-y-2">
                <Label>Student</Label>
                <div className="p-2 bg-muted rounded">
                  {getStudentName(selectedEnrollment)}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Class</Label>
                <div className="p-2 bg-muted rounded">
                  {(() => {
                    const { class: classItem, program } = getClassInfo(selectedEnrollment.class_id);
                    return `${program?.name} - ${classItem?.name}`;
                  })()}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select name="status" defaultValue={selectedEnrollment.status}>
                  <SelectTrigger className="input-custom-styles">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="waitlist">Waitlisted</SelectItem>
                    <SelectItem value="dropped">Dropped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Input
                  id="edit-notes"
                  name="notes"
                  className="input-custom-styles"
                  defaultValue={selectedEnrollment.notes || ""}
                  placeholder="Enrollment notes..."
                />
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Updating..." : "Update Enrollment"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEnrollmentId} onOpenChange={() => setDeleteEnrollmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently drop the student from the class and update their enrollment status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
               onClick={() => {
                 if (deleteEnrollmentId) {
                   const formData = new FormData();
                   formData.append('intent', 'drop');
                   formData.append('id', deleteEnrollmentId);
                   formData.append('reason', 'Admin action');
                   
                   submit(formData, { method: 'post' });
                   setDeleteEnrollmentId(null);
                 }
               }}
               disabled={isSubmitting}
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
             >
               {isSubmitting ? 'Dropping...' : 'Drop Student'}
             </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}