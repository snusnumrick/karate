import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher, Link, useSearchParams } from "@remix-run/react";
import { format, parseISO, addDays } from "date-fns";
import { Trash2, Calendar, Clock, Users, AlertTriangle, Edit2, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { getClassSessions, deleteClassSession, bulkDeleteClassSessions, getClasses, createClassSession } from "~/services/class.server";
import { hasAttendanceRecords } from "~/services/attendance.server";
import type { Class, CreateSessionData } from "~/types/multi-class";
import { useState, useEffect } from "react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

type ActionData = {
  error?: string;
  success?: string;
};

interface SessionWithClass {
  id: string;
  class_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  instructor_override?: string;
  created_at: string;
  updated_at: string;
  class: {
    id: string;
    name: string;
    program: {
      name: string;
    };
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const classId = url.searchParams.get("class_id") || undefined;
  const status = url.searchParams.get("status") as "scheduled" | "completed" | "cancelled" | undefined;
  const dateFrom = url.searchParams.get("date_from") || undefined;
  const dateTo = url.searchParams.get("date_to") || undefined;

  const [sessions, classes] = await Promise.all([
    getClassSessions({
      class_id: classId,
      status,
      session_date_from: dateFrom,
      session_date_to: dateTo,
    }),
    getClasses({ is_active: true })
  ]);

  return json({ 
    sessions: sessions as SessionWithClass[], 
    classes: classes as Class[]
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create_makeup_session") {
    const classId = formData.get("class_id") as string;
    const sessionDate = formData.get("session_date") as string;
    const startTime = formData.get("start_time") as string;
    const endTime = formData.get("end_time") as string;
    const notes = formData.get("notes") as string;

    if (!classId || !sessionDate || !startTime || !endTime) {
      return json(
        { error: "Class, date, start time, and end time are required" },
        { status: 400 }
      );
    }

    try {
      const sessionData: CreateSessionData = {
        class_id: classId,
        session_date: sessionDate,
        start_time: startTime,
        end_time: endTime,
        notes: notes || undefined,
      };

      await createClassSession(sessionData);
      return json({ success: "Makeup session created successfully" });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Failed to create makeup session" },
        { status: 500 }
      );
    }
  }

  if (intent === "delete") {
    const sessionId = formData.get("sessionId") as string;
    try {
      // Check if session has attendance records
      const hasAttendance = await hasAttendanceRecords(sessionId);
      if (hasAttendance) {
        return json(
          { error: "Cannot delete session with attendance records. Please remove attendance first." },
          { status: 400 }
        );
      }

      await deleteClassSession(sessionId);
      return json({ success: "Session deleted successfully" });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Failed to delete session" },
        { status: 500 }
      );
    }
  }

  if (intent === "bulk_delete") {
    const dateFrom = formData.get("bulk_date_from") as string;
    const dateTo = formData.get("bulk_date_to") as string;
    const classId = formData.get("bulk_class_id") as string;
    const status = formData.get("bulk_status") as string;

    if (!dateFrom || !dateTo) {
      return json(
        { error: "Date range is required for bulk delete" },
        { status: 400 }
      );
    }

    try {
      const result = await bulkDeleteClassSessions({
        date_from: dateFrom,
        date_to: dateTo,
        class_id: classId && classId !== "all" ? classId : undefined,
        status: status && status !== "all" ? status as 'scheduled' | 'completed' | 'cancelled' : undefined,
      });

      let message = `Bulk delete completed: ${result.deletedCount} sessions deleted`;
      if (result.skippedCount > 0) {
        message += `, ${result.skippedCount} sessions skipped (have attendance records)`;
      }
      if (result.errors.length > 0) {
        message += `. Errors: ${result.errors.join(', ')}`;
      }

      return json({ success: message });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Failed to bulk delete sessions" },
        { status: 500 }
      );
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

export default function AdminSessions() {
  const { sessions, classes } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    class_id: "all",
    status: "all",
    date_from: "",
    date_to: "",
  });

  // Initialize filters from URL parameters
  useEffect(() => {
    const classId = searchParams.get("class_id");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    setFilters({
      class_id: classId || "all",
      status: status || "all",
      date_from: dateFrom || "",
      date_to: dateTo || "",
    });
  }, [searchParams]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<SessionWithClass | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isCreateMakeupDialogOpen, setIsCreateMakeupDialogOpen] = useState(false);
  const [bulkDeleteForm, setBulkDeleteForm] = useState({
    dateFrom: format(new Date(), 'yyyy-MM-dd'),
    dateTo: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    classId: "all",
    status: "all"
  });
  const [makeupSessionForm, setMakeupSessionForm] = useState({
    classId: "",
    sessionDate: format(new Date(), 'yyyy-MM-dd'),
    startTime: "09:00",
    endTime: "10:00",
    notes: ""
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatTime = (time: string) => {
    try {
      const [hours, minutes] = time.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return format(date, 'h:mm a');
    } catch {
      return time;
    }
  };

  const handleDelete = (session: SessionWithClass) => {
    setSessionToDelete(session);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (sessionToDelete) {
      fetcher.submit(
        { intent: "delete", sessionId: sessionToDelete.id },
        { method: "post" }
      );
      setIsDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  const handleBulkDelete = () => {
    setIsBulkDeleteDialogOpen(true);
  };

  const handleCreateMakeupSession = () => {
    setIsCreateMakeupDialogOpen(true);
  };

  const confirmCreateMakeupSession = () => {
    if (!makeupSessionForm.classId) {
      return;
    }

    fetcher.submit(
      {
        intent: "create_makeup_session",
        class_id: makeupSessionForm.classId,
        session_date: makeupSessionForm.sessionDate,
        start_time: makeupSessionForm.startTime,
        end_time: makeupSessionForm.endTime,
        notes: makeupSessionForm.notes,
      },
      { method: "post" }
    );
    setIsCreateMakeupDialogOpen(false);
    setMakeupSessionForm({
      classId: "",
      sessionDate: format(new Date(), 'yyyy-MM-dd'),
      startTime: "09:00",
      endTime: "10:00",
      notes: ""
    });
  };

  const confirmBulkDelete = () => {
    fetcher.submit(
      {
        intent: "bulk_delete",
        bulk_date_from: bulkDeleteForm.dateFrom,
        bulk_date_to: bulkDeleteForm.dateTo,
        bulk_class_id: bulkDeleteForm.classId,
        bulk_status: bulkDeleteForm.status
      },
      { method: "post" }
    );
    setIsBulkDeleteDialogOpen(false);
    setBulkDeleteForm({
      dateFrom: format(new Date(), 'yyyy-MM-dd'),
      dateTo: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      classId: "all",
      status: "all"
    });
  };

  const applyFilters = () => {
    const searchParams = new URLSearchParams();
    if (filters.class_id && filters.class_id !== "all") searchParams.set("class_id", filters.class_id);
    if (filters.status && filters.status !== "all") searchParams.set("status", filters.status);
    if (filters.date_from) searchParams.set("date_from", filters.date_from);
    if (filters.date_to) searchParams.set("date_to", filters.date_to);

    window.location.search = searchParams.toString();
  };

  const clearFilters = () => {
    setFilters({
      class_id: "all",
      status: "all",
      date_from: "",
      date_to: "",
    });
    window.location.search = "";
  };

  // Get unique classes for filter dropdown
  const uniqueClasses = Array.from(
    new Map(sessions.map(session => [session.class.id, session.class])).values()
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AppBreadcrumb
          items={breadcrumbPatterns.adminSessions()}
          className="mb-6" />
      <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Session Management</h1>
            <p className="text-muted-foreground">
              Manage sessions across all classes
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleCreateMakeupSession}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Makeup Session
            </Button>
            <Button 
              onClick={handleBulkDelete}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Bulk Delete
            </Button>
          </div>
        </div>

      {fetcher.data?.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{fetcher.data.error}</AlertDescription>
        </Alert>
      )}

      {fetcher.data?.success && (
        <Alert>
          <AlertDescription>{fetcher.data.success}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter sessions by class, status, or date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="class-filter">Class</Label>
              <Select
                value={filters.class_id}
                onValueChange={(value) => setFilters(prev => ({ ...prev, class_id: value === "all" ? "" : value }))}
              >
                <SelectTrigger className="input-custom-styles" tabIndex={0}>
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {uniqueClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.program.name} - {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === "all" ? "" : value }))}
              >
                <SelectTrigger className="input-custom-styles" tabIndex={0}>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
                tabIndex={0}
              />
            </div>

            <div>
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
                tabIndex={0}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={applyFilters} tabIndex={0}>Apply Filters</Button>
            <Button variant="outline" onClick={clearFilters} tabIndex={0}>Clear Filters</Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No sessions found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : (
          sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="font-semibold text-lg">
                        {session.class.program.name} - {session.class.name}
                      </h3>
                      <Badge className={getStatusColor(session.status)}>
                        {session.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(parseISO(session.session_date), 'EEEE, MMMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatTime(session.start_time)} - {formatTime(session.end_time)}
                      </div>
                      {session.instructor_override && (
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          Instructor: {session.instructor_override}
                        </div>
                      )}
                    </div>

                    {session.notes && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Notes: {session.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      tabIndex={0}
                    >
                      <Link to={`/admin/classes/${session.class_id}/sessions`}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Session
                      </Link>
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      tabIndex={0}
                    >
                      <Link to={`/admin/classes/${session.class_id}/sessions`}>
                        View Class Sessions
                      </Link>
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(session)}
                      disabled={fetcher.state === "submitting"}
                      tabIndex={0}
                      aria-label={`Delete session for ${session.class.program.name} - ${session.class.name} on ${format(parseISO(session.session_date), 'EEEE, MMMM d, yyyy')}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {sessions.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the session for
              <span className="font-semibold"> {sessionToDelete?.class.program.name} - {sessionToDelete?.class.name}</span> on
              <span className="font-semibold"> {sessionToDelete && format(parseISO(sessionToDelete.session_date), 'EEEE, MMMM d, yyyy')}</span> and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={fetcher.state === "submitting"}
              tabIndex={0}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={fetcher.state === "submitting"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              tabIndex={0}
            >
              {fetcher.state === "submitting" ? 'Deleting...' : 'Delete Session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Delete Sessions</AlertDialogTitle>
            <AlertDialogDescription>
              Delete multiple sessions based on date range and filters. Sessions with attendance records will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bulk-date-from">From Date</Label>
                <Input
                  id="bulk-date-from"
                  type="date"
                  value={bulkDeleteForm.dateFrom}
                  onChange={(e) => setBulkDeleteForm(prev => ({ ...prev, dateFrom: e.target.value }))}
                  required
                  tabIndex={0}
                />
              </div>
              <div>
                <Label htmlFor="bulk-date-to">To Date</Label>
                <Input
                  id="bulk-date-to"
                  type="date"
                  value={bulkDeleteForm.dateTo}
                  onChange={(e) => setBulkDeleteForm(prev => ({ ...prev, dateTo: e.target.value }))}
                  required
                  tabIndex={0}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="bulk-class">Class (Optional)</Label>
              <Select 
                value={bulkDeleteForm.classId} 
                onValueChange={(value) => setBulkDeleteForm(prev => ({ ...prev, classId: value }))}
              >
                <SelectTrigger className="input-custom-styles" tabIndex={0}>
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {uniqueClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.program.name} - {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="bulk-status">Status (Optional)</Label>
              <Select 
                value={bulkDeleteForm.status} 
                onValueChange={(value) => setBulkDeleteForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="input-custom-styles" tabIndex={0}>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel tabIndex={0}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={!bulkDeleteForm.dateFrom || !bulkDeleteForm.dateTo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              tabIndex={0}
            >
              Bulk Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Makeup Session Dialog */}
      <Dialog open={isCreateMakeupDialogOpen} onOpenChange={setIsCreateMakeupDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Makeup Session</DialogTitle>
            <DialogDescription>
              Create a makeup session outside of the regular class schedule. This session will be available for attendance tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="makeup-class">Class *</Label>
              <Select 
                value={makeupSessionForm.classId} 
                onValueChange={(value) => setMakeupSessionForm(prev => ({ ...prev, classId: value }))}
                required
              >
                <SelectTrigger className="input-custom-styles" tabIndex={0}>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.program?.name} - {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="makeup-date">Session Date *</Label>
              <Input
                id="makeup-date"
                type="date"
                value={makeupSessionForm.sessionDate}
                onChange={(e) => setMakeupSessionForm(prev => ({ ...prev, sessionDate: e.target.value }))}
                required
                tabIndex={0}
                className="input-custom-styles"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="makeup-start-time">Start Time *</Label>
                <Input
                  id="makeup-start-time"
                  type="time"
                  value={makeupSessionForm.startTime}
                  onChange={(e) => setMakeupSessionForm(prev => ({ ...prev, startTime: e.target.value }))}
                  required
                  tabIndex={0}
                />
              </div>
              <div>
                <Label htmlFor="makeup-end-time">End Time *</Label>
                <Input
                  id="makeup-end-time"
                  type="time"
                  value={makeupSessionForm.endTime}
                  onChange={(e) => setMakeupSessionForm(prev => ({ ...prev, endTime: e.target.value }))}
                  required
                  tabIndex={0}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="makeup-notes">Notes (Optional)</Label>
              <Textarea
                id="makeup-notes"
                placeholder="Add any special notes for this makeup session..."
                value={makeupSessionForm.notes}
                onChange={(e) => setMakeupSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                tabIndex={0}
                className="input-custom-styles"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCreateMakeupDialogOpen(false)}
              tabIndex={0}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmCreateMakeupSession}
              disabled={!makeupSessionForm.classId || !makeupSessionForm.sessionDate || !makeupSessionForm.startTime || !makeupSessionForm.endTime || fetcher.state === "submitting"}
              tabIndex={0}
            >
              {fetcher.state === "submitting" ? 'Creating...' : 'Create Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
