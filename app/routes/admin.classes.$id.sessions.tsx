import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, Form, useNavigation, useActionData, useFetcher } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
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
import { ArrowLeft, Calendar, Clock, Plus, Edit2, Trash2, ExternalLink } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { requireAdminUser } from "~/utils/auth.server";
import { getClassById, getClassSessions, generateClassSessions, updateClassSession, deleteClassSession } from "~/services/class.server";
import { hasAttendanceRecords } from "~/services/attendance.server";
import type { ClassSession, BulkSessionGeneration } from "~/types/multi-class";
import { useState } from "react";
import { formatDate } from "~/utils/misc";
import { parseLocalDate, getTodayLocalDateString, formatLocalDate } from "~/components/calendar/utils";

type ActionData = {
  error?: string;
  success?: string;
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  
  const classId = params.id;
  if (!classId) {
    throw new Response("Class ID is required", { status: 400 });
  }
  
  const [classData, sessions] = await Promise.all([
    getClassById(classId),
    getClassSessions({ class_id: classId })
  ]);
  
  if (!classData) {
    throw new Response("Class not found", { status: 404 });
  }
  
  return json({ classData, sessions });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdminUser(request);
  
  const classId = params.id;
  if (!classId) {
    throw new Response("Class ID is required", { status: 400 });
  }
  
  try {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    
    if (intent === "generate") {
      const startDate = formData.get("start_date") as string;
      const endDate = formData.get("end_date") as string;
      const instructorOverride = formData.get("instructor_override") as string;
      const excludedDates = formData.get("excluded_dates") as string;
      
      const generationData: BulkSessionGeneration = {
        class_id: classId,
        start_date: startDate,
        end_date: endDate,
        override_instructor: instructorOverride || undefined,
        exclude_dates: excludedDates ? excludedDates.split(',').map(d => d.trim()) : undefined
      };
      
      const sessionCount = await generateClassSessions(generationData);
      
      if (sessionCount === 0) {
        return json({ 
          error: "No sessions were generated. This usually means the class has no weekly schedule configured. Please edit the class to add schedule times (day of week and start time) before generating sessions." 
        });
      }
      
      return json({ success: `Generated ${sessionCount} sessions successfully` });
    }
    
    if (intent === "update_session") {
      const sessionId = formData.get("session_id") as string;
      const status = formData.get("status") as string;
      const notes = formData.get("notes") as string;
      
      await updateClassSession(sessionId, {
        status: status as 'scheduled' | 'completed' | 'cancelled',
        notes: notes || undefined
      });
      
      return json({ success: "Session updated successfully" });
    }
    
    if (intent === "delete_session") {
      const sessionId = formData.get("session_id") as string;
      
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
    }
    
    return json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 400 }
    );
  }
}

export default function ClassSessions() {
  const { classData, sessions } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const fetcher = useFetcher<ActionData>();
  const isSubmitting = navigation.state === "submitting" || fetcher.state === "submitting";
  
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [editingSession, setEditingSession] = useState<ClassSession | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ClassSession | null>(null);

  const handleDelete = (session: ClassSession) => {
    setSessionToDelete(session);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (sessionToDelete) {
      fetcher.submit(
        { intent: "delete_session", session_id: sessionToDelete.id },
        { method: "post" }
      );
      setIsDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };
  

  
  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };
  
  const upcomingSessions = sessions.filter(s => {
    const [year, month, day] = s.session_date.split('-').map(Number);
    const sessionDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    return sessionDate >= today;
  });
  const pastSessions = sessions.filter(s => {
    const [year, month, day] = s.session_date.split('-').map(Number);
    const sessionDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    return sessionDate < today;
  });
  
  return (
    <div className="container mx-auto py-6">
      <AppBreadcrumb 
        items={breadcrumbPatterns.adminClassSessions(classData.name, classData.id)} 
        className="mb-6"
      />
      
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Class Sessions</h1>
          <p className="text-muted-foreground">
            {classData.name} • Manage individual class sessions
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/sessions">
            <ExternalLink className="h-4 w-4 mr-2" />
            All Sessions
          </Link>
        </Button>
      </div>
      
      {actionData && 'error' in actionData && (
        <Alert className="mb-6">
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}
      
      {actionData && 'success' in actionData && (
        <Alert className="mb-6">
          <AlertDescription>{actionData.success}</AlertDescription>
        </Alert>
      )}
      
      {fetcher.data && 'error' in fetcher.data && (
        <Alert className="mb-6">
          <AlertDescription>{fetcher.data.error}</AlertDescription>
        </Alert>
      )}
      
      {fetcher.data && 'success' in fetcher.data && (
        <Alert className="mb-6">
          <AlertDescription>{fetcher.data.success}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Session Generation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Generate Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showGenerateForm ? (
              <Button onClick={() => setShowGenerateForm(true)} className="w-full">
                Generate New Sessions
              </Button>
            ) : (
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="generate" />
                
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    defaultValue={getTodayLocalDateString()}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    name="end_date"
                    type="date"
                    defaultValue={formatLocalDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1)))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="instructor_override">Instructor Override (Optional)</Label>
                  <Input
                    id="instructor_override"
                    name="instructor_override"
                    placeholder="Override default instructor"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="excluded_dates">Excluded Dates (Optional)</Label>
                  <Input
                    id="excluded_dates"
                    name="excluded_dates"
                    placeholder="2024-12-25, 2024-01-01"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated dates to exclude (YYYY-MM-DD format)
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting} size="sm">
                    {isSubmitting ? "Generating..." : "Generate"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowGenerateForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </Form>
            )}
          </CardContent>
        </Card>
        
        {/* Upcoming Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Sessions ({upcomingSessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingSessions.slice(0, 5).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">{formatDate(session.session_date, { formatString: 'EEEE, MMMM d, yyyy' })}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(session.start_time)} - {formatTime(session.end_time)}
                    </div>
                    <Badge variant={getStatusColor(session.status)}>
                      {session.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSession(session)}
                      tabIndex={0}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(session)}
                      disabled={isSubmitting}
                      tabIndex={0}
                      aria-label={`Delete session on ${formatDate(session.session_date, { formatString: 'EEEE, MMMM d, yyyy' })}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {upcomingSessions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming sessions scheduled
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Past Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Past Sessions ({pastSessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pastSessions.slice(0, 5).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg opacity-75">
                  <div className="space-y-1">
                    <div className="font-medium">{formatDate(session.session_date, { formatString: 'EEEE, MMMM d, yyyy' })}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(session.start_time)} - {formatTime(session.end_time)}
                    </div>
                    <Badge variant={getStatusColor(session.status)}>
                      {session.status}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSession(session)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {pastSessions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No past sessions found
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Edit Session Modal */}
      {editingSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Session</CardTitle>
            </CardHeader>
            <CardContent>
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="update_session" />
                <input type="hidden" name="session_id" value={editingSession.id} />
                
                <div className="space-y-2">
                  <Label>Date & Time</Label>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(editingSession.session_date, { formatString: 'EEEE, MMMM d, yyyy' })} • {formatTime(editingSession.start_time)} - {formatTime(editingSession.end_time)}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue={editingSession.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    defaultValue={editingSession.notes || ''}
                    placeholder="Session notes..."
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting} size="sm">
                    {isSubmitting ? "Updating..." : "Update"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditingSession(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </Form>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the session on
              <span className="font-semibold"> {sessionToDelete && formatDate(sessionToDelete.session_date, { formatString: 'EEEE, MMMM d, yyyy' })}</span> and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={isSubmitting}
              tabIndex={0}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              tabIndex={0}
            >
              {isSubmitting ? 'Deleting...' : 'Delete Session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}