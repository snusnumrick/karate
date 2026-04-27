import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useSearchParams, Link, useActionData } from "@remix-run/react";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "~/components/ui/alert-dialog";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { CheckCircle, Clock, AlertCircle, Users, Plus, Edit, Trash2, ArrowUpCircle } from "lucide-react";
import { formatDate } from "~/utils/misc";
import { withAdminLoader, withAdminAction } from "~/utils/auth.server";
import { advanceWaitlistedEnrollment, getEnrollments, updateEnrollment, dropStudent } from "~/services/enrollment.server";
import { getClasses } from "~/services/class.server";
import { getPrograms } from "~/services/program.server";
import { checkStudentEligibility, getSupabaseAdminClient } from "~/utils/supabase.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { CSRFError } from "remix-utils/csrf/server";
import { serializeMoney } from "~/utils/money";
import { isServiceError } from "~/utils/service-errors.server";

type EnrollmentStatusFilter =
  | 'active'
  | 'inactive'
  | 'dropped'
  | 'completed'
  | 'waitlist'
  | 'trial'
  | 'pending_waivers'
  | 'pending_payment';

const enrollmentStatusFilters = new Set<EnrollmentStatusFilter>([
  'active',
  'inactive',
  'dropped',
  'completed',
  'waitlist',
  'trial',
  'pending_waivers',
  'pending_payment',
]);

function parseEnrollmentStatus(value: string | null): EnrollmentStatusFilter | undefined {
  return value && enrollmentStatusFilters.has(value as EnrollmentStatusFilter)
    ? value as EnrollmentStatusFilter
    : undefined;
}

function stripSeminarPendingPaymentNote(notes?: string | null): string {
  return notes?.replace(/\[seminar_pending_payment:[^\]]+\]/g, '').trim() ?? '';
}

function extractSeminarPendingPaymentNotes(notes?: string | null): string {
  return notes?.match(/\[seminar_pending_payment:[^\]]+\]/g)?.join(' ') ?? '';
}

async function loaderImpl({ request }: LoaderFunctionArgs) {

  const url = new URL(request.url);
  const classId = url.searchParams.get("class");
  const programId = url.searchParams.get("program");
  const status = parseEnrollmentStatus(url.searchParams.get("status"));

  const [enrollments, classes, programs] = await Promise.all([
    getEnrollments({ class_id: classId || undefined, status }),
    getClasses(),
    getPrograms()
  ]);

  const selectedClass = classId ? classes.find(classItem => classItem.id === classId) : undefined;
  const effectiveProgramId = selectedClass?.program_id ?? programId;
  const filteredEnrollments = !classId && effectiveProgramId
    ? enrollments.filter(enrollment =>
        enrollment.program_id === effectiveProgramId || enrollment.class?.program_id === effectiveProgramId
      )
    : enrollments;
  const filteredClasses = effectiveProgramId
    ? classes.filter(classItem => classItem.program_id === effectiveProgramId)
    : classes;

  // Create supabase admin client for eligibility checks
  const supabaseAdmin = getSupabaseAdminClient();

  // Fetch eligibility for each enrolled student
  const enrollmentsWithEligibility = await Promise.all(
    filteredEnrollments.map(async (enrollment) => {
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
    total: filteredEnrollments.length,
    active: filteredEnrollments.filter(e => e.status === 'active').length,
    trial: filteredEnrollments.filter(e => e.status === 'trial').length,
    pending_payment: filteredEnrollments.filter(e => e.status === 'pending_payment').length,
    waitlisted: filteredEnrollments.filter(e => e.status === 'waitlist').length,
    pending_waivers: filteredEnrollments.filter(e => e.status === 'pending_waivers').length,
    dropped: filteredEnrollments.filter(e => e.status === 'dropped').length
  };

  // Serialize Money objects in programs for JSON transmission
  const serializedPrograms = programs.map(program => ({
    ...program,
    monthly_fee: program.monthly_fee ? serializeMoney(program.monthly_fee) : undefined,
    yearly_fee: program.yearly_fee ? serializeMoney(program.yearly_fee) : undefined,
    individual_session_fee: program.individual_session_fee ? serializeMoney(program.individual_session_fee) : undefined,
    registration_fee: program.registration_fee ? serializeMoney(program.registration_fee) : undefined,
  }));

  return json({
    enrollments: enrollmentsWithEligibility,
    classes: filteredClasses,
    programs: serializedPrograms,
    stats,
    filters: { classId, programId: effectiveProgramId, status: status ?? null }
  });
}

export const loader = withAdminLoader(loaderImpl);

async function actionImpl({ request }: ActionFunctionArgs) {
  try {
    await csrf.validate(request);
  } catch (error) {
    if (error instanceof CSRFError) {
      return json(
        { error: "Your session expired. Please refresh the page and try again." },
        { status: 403 }
      );
    }
    throw error;
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  
  switch (intent) {
    
    case "update": {
      const id = formData.get("id") as string;
      const status = parseEnrollmentStatus(formData.get("status")?.toString() ?? null);
      if (!status) {
        return json({ error: "Invalid enrollment status" }, { status: 400 });
      }

      const notes = formData.get("notes")?.toString().trim() ?? "";
      const systemNotes = formData.get("systemNotes")?.toString().trim() ?? "";
      const updates = {
        status,
        notes: status === "pending_payment" && systemNotes
          ? [notes, systemNotes].filter(Boolean).join(' ')
          : notes,
      };
      
      await updateEnrollment(id, updates);
      return json({ success: true });
    }
    
    case "drop": {
      const id = formData.get("id") as string;
      // const reason = formData.get("reason") as string;

      if (!id || id === "null" || id === "") {
        console.error("Drop student failed: invalid ID received:", id);
        return json({ error: "Invalid enrollment ID" }, { status: 400 });
      }

      await dropStudent(id);
      return json({ success: true });
    }

    case "advance-waitlist": {
      const id = formData.get("id") as string;

      if (!id || id === "null" || id === "") {
        return json({ error: "Invalid enrollment ID" }, { status: 400 });
      }

      try {
        const result = await advanceWaitlistedEnrollment(id);
        return json({ success: true, ...result });
      } catch (error) {
        if (isServiceError(error)) {
          return json({ error: error.message }, { status: error.status });
        }

        throw error;
      }
    }
    
    default:
      return json({ error: "Invalid intent" }, { status: 400 });
  }
}

export const action = withAdminAction(actionImpl);

export default function AdminEnrollments() {
  const { enrollments, classes, programs, stats, filters } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Use inferred types from loader data
  type EnrollmentType = typeof enrollments[number];

  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentType | null>(null);

  function getStudentName(enrollment: EnrollmentType): string {
    if (!enrollment.student) return "Unknown Student";
    return `${enrollment.student.first_name} ${enrollment.student.last_name}`;
  }
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteEnrollmentId, setDeleteEnrollmentId] = useState<string | null>(null);

  const isSubmitting = navigation.state === "submitting";
  const primaryButtonClass = "bg-green-600 text-white shadow-sm hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500";
  const secondaryButtonClass = "border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/30 dark:hover:text-green-200";
  const dialogFieldClass = "rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-100";
  const dialogLabelClass = "text-sm font-medium text-gray-900 dark:text-gray-100";
  const dialogInputClass = "input-custom-styles border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/60";
  const waitlistPositionByEnrollmentId = new Map<string, number>();
  const waitlistPositionByClassId = new Map<string, number>();

  enrollments
    .filter((enrollment) => enrollment.status === "waitlist")
    .sort((a, b) => {
      const classComparison = a.class_id.localeCompare(b.class_id);
      if (classComparison !== 0) return classComparison;

      const enrolledAtComparison = new Date(a.enrolled_at).getTime() - new Date(b.enrolled_at).getTime();
      if (enrolledAtComparison !== 0) return enrolledAtComparison;

      return a.id.localeCompare(b.id);
    })
    .forEach((enrollment) => {
      const nextPosition = (waitlistPositionByClassId.get(enrollment.class_id) ?? 0) + 1;
      waitlistPositionByClassId.set(enrollment.class_id, nextPosition);
      waitlistPositionByEnrollmentId.set(enrollment.id, nextPosition);
    });

  const advanceActionMessage = actionData && "success" in actionData && actionData.success && "status" in actionData
    ? actionData.status === "active"
      ? "Waitlist student advanced to active."
      : actionData.status === "pending_payment"
        ? "Waitlist student advanced to pending payment."
        : "Waitlist student advanced to pending waivers."
    : null;
  const advancePaymentId = actionData
    && "paymentId" in actionData
    && typeof actionData.paymentId === "string"
    ? actionData.paymentId
    : null;

  // Close dialog after successful submission
  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success && navigation.state === "idle") {
      setDeleteEnrollmentId(null);
      setIsEditDialogOpen(false);
    }
  }, [actionData, navigation.state]);
  
  const handleFilterChange = (key: string, value: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (value === "all" || value === "") {
      nextSearchParams.delete(key);
    } else {
      nextSearchParams.set(key, value);
    }

    if (key === "program") {
      nextSearchParams.delete("class");
    }

    if (key === "class") {
      nextSearchParams.delete("program");
    }

    setSearchParams(nextSearchParams);
  };

  const getStatusBadge = (enrollment: EnrollmentType, waitlistPosition?: number) => {
    const status = enrollment.status;
    const student = enrollment.student;
    const eligibility = student && 'eligibility' in student ? student.eligibility : undefined;

    // For dropped or waitlisted enrollments, show simple status
    if (status === "dropped") {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Dropped</Badge>;
    }
    if (status === "waitlist") {
      return (
        <div className="space-y-1">
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            {waitlistPosition ? `Waitlist #${waitlistPosition}` : "Waitlisted"}
          </Badge>
          {waitlistPosition === 1 && (
            <div className="text-xs text-muted-foreground">
              First priority
            </div>
          )}
        </div>
      );
    }
    if (status === "completed") {
      return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
    }
    if (status === "inactive") {
      return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Inactive</Badge>;
    }
    if (status === "pending_waivers") {
      return (
        <div className="space-y-1">
          <Badge className="bg-amber-100 text-amber-800">
            <AlertCircle className="h-3 w-3 mr-1" />Pending Waivers
          </Badge>
          <div className="text-xs text-muted-foreground">
            Awaiting waiver completion
          </div>
        </div>
      );
    }
    if (status === "pending_payment") {
      return (
        <div className="space-y-1">
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />Pending Payment
          </Badge>
          <div className="text-xs text-muted-foreground">
            Awaiting payment completion
          </div>
        </div>
      );
    }

    // For active/trial enrollments, combine with eligibility info
    if (status === "trial") {
      return (
        <div className="space-y-1">
          <Badge className="bg-blue-100 text-blue-800">
            <CheckCircle className="h-3 w-3 mr-1" />Trial
          </Badge>
        </div>
      );
    }
    
    if (status === "active" && eligibility) {
      if (eligibility.eligible) {
        const paidUntilText = eligibility.paidUntil 
          ? formatDate(eligibility.paidUntil, { formatString: 'MMM d, yyyy' })
          : '';
        
        return (
          <div className="space-y-1">
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />Active
            </Badge>
            {paidUntilText && (
              <div className="text-xs text-muted-foreground">
                Paid until {paidUntilText}
              </div>
            )}
          </div>
        );
      } else {
        // Active enrollment but not eligible (expired payment)
        const paidUntilText = eligibility.paidUntil 
          ? formatDate(eligibility.paidUntil, { formatString: 'MMM d, yyyy' })
          : '';
        
        return (
          <div className="space-y-1">
            <Badge className="bg-orange-100 text-orange-800">
              <AlertCircle className="h-3 w-3 mr-1" />Active (Expired)
            </Badge>
            {paidUntilText && (
              <div className="text-xs text-muted-foreground">
                Expired {paidUntilText}
              </div>
            )}
          </div>
        );
      }
    }
    
    if (status === "active") {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
    }

    return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Unknown</Badge>;
  };
  
  const getClassInfo = (classId: string) => {
    const classItem = classes.find(c => c.id === classId);
    const program = classItem ? programs.find(p => p.id === classItem.program_id) : null;
    return { class: classItem, program };
  };
  
  return (
    <div className="min-h-screen py-12 text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 rounded-lg shadow-md backdrop-blur-lg border dark:border-gray-700">
          <AppBreadcrumb 
            items={breadcrumbPatterns.adminEnrollments()}
            className="mb-6"
          />
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-green-600 dark:text-green-400">Enrollments</h1>
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

          {actionData && "error" in actionData && actionData.error && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{actionData.error}</span>
            </div>
          )}

          {advanceActionMessage && (
            <div className="mb-6 flex items-start justify-between gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{advanceActionMessage}</span>
              </div>
              {advancePaymentId && (
                <Link className="font-medium underline underline-offset-2" to={`/admin/payments/${advancePaymentId}`}>
                  Review payment
                </Link>
              )}
            </div>
          )}
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-600">
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Total</h3>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-600">
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Active</h3>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.active}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-blue-600">
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Trial</h3>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.trial}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-yellow-600">
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Pending Payment</h3>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.pending_payment}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-amber-600">
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Pending Waivers</h3>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.pending_waivers}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-yellow-600">
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Waitlisted</h3>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.waitlisted}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-red-600">
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Dropped</h3>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.dropped}</p>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Filters</h3>
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
                <SelectItem value="pending_payment">Pending Payment</SelectItem>
                <SelectItem value="pending_waivers">Pending Waivers</SelectItem>
                <SelectItem value="waitlist">Waitlisted</SelectItem>
                <SelectItem value="dropped">Dropped</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Enrollments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Enrollments ({enrollments.length})
          </h3>
        </div>
        <div className="p-6">
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
                const waitlistPosition = waitlistPositionByEnrollmentId.get(enrollment.id);
                
                return (
                  <TableRow key={enrollment.id}>
                    <TableCell className="font-medium">
                      {getStudentName(enrollment)}
                    </TableCell>
                    <TableCell>{program?.name || "Unknown"}</TableCell>
                    <TableCell className="min-w-[200px]">{classItem?.name || "Unknown"}</TableCell>
                    <TableCell>{getStatusBadge(enrollment, waitlistPosition)}</TableCell>
                    <TableCell>
                      {formatDate(enrollment.enrolled_at, { formatString: 'MMM d, yyyy' })}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {stripSeminarPendingPaymentNote(enrollment.notes) || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {enrollment.status === "waitlist" && (
                          <Form method="post">
                            <AuthenticityTokenInput />
                            <input type="hidden" name="intent" value="advance-waitlist" />
                            <input type="hidden" name="id" value={enrollment.id} />
                            <Button
                              type="submit"
                              variant="outline"
                              size="sm"
                              className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/30"
                              disabled={isSubmitting || waitlistPosition !== 1}
                              title={waitlistPosition === 1 ? "Advance from waitlist" : "Advance earlier waitlist entries first"}
                              aria-label={waitlistPosition === 1 ? "Advance from waitlist" : "Advance earlier waitlist entries first"}
                            >
                              <ArrowUpCircle className="h-4 w-4" />
                            </Button>
                          </Form>
                        )}

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
        </div>
      </div>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="gap-0 overflow-hidden border border-gray-200 bg-white p-0 shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:max-w-xl">
          <DialogHeader className="border-b border-gray-100 bg-gray-50/80 px-6 py-5 dark:border-gray-700 dark:bg-gray-900/40">
            <DialogTitle className="text-xl font-semibold text-green-600 dark:text-green-400">Edit Enrollment</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
              Update the enrollment status and notes.
            </DialogDescription>
          </DialogHeader>
          
          {selectedEnrollment && (
            <Form method="post" className="space-y-5 p-6">
              <AuthenticityTokenInput />
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="id" value={selectedEnrollment.id} />
              <input type="hidden" name="systemNotes" value={extractSeminarPendingPaymentNotes(selectedEnrollment.notes)} />
              
              <div className="space-y-2">
                <Label className={dialogLabelClass}>Student</Label>
                <div className={dialogFieldClass}>
                  {getStudentName(selectedEnrollment)}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className={dialogLabelClass}>Class</Label>
                <div className={dialogFieldClass}>
                  {(() => {
                    const { class: classItem, program } = getClassInfo(selectedEnrollment.class_id);
                    return `${program?.name} - ${classItem?.name}`;
                  })()}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-status" className={dialogLabelClass}>Status</Label>
                <Select name="status" defaultValue={selectedEnrollment.status}>
                  <SelectTrigger className={dialogInputClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="pending_payment">Pending Payment</SelectItem>
                    <SelectItem value="pending_waivers">Pending Waivers</SelectItem>
                    <SelectItem value="waitlist">Waitlisted</SelectItem>
                    <SelectItem value="dropped">Dropped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-notes" className={dialogLabelClass}>Notes</Label>
                <Input
                  id="edit-notes"
                  name="notes"
                  className={dialogInputClass}
                  defaultValue={stripSeminarPendingPaymentNote(selectedEnrollment.notes)}
                  placeholder="Enrollment notes..."
                />
              </div>
              
              <DialogFooter className="gap-2 border-t border-gray-100 pt-5 dark:border-gray-700 sm:space-x-0">
                <Button type="button" variant="outline" className={secondaryButtonClass} onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
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
            <Form method="post">
              <AuthenticityTokenInput />
              <input type="hidden" name="intent" value="drop" />
              <input type="hidden" name="id" value={deleteEnrollmentId ?? ""} />
              <input type="hidden" name="reason" value="Admin action" />
              <button
                type="submit"
                disabled={isSubmitting || !deleteEnrollmentId}
                className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {isSubmitting ? 'Dropping...' : 'Drop Student'}
              </button>
            </Form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </div>
      </div>
    </div>
  );
}
