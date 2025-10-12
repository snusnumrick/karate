import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, Form, useNavigation, useActionData, useFetcher } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
import { Calendar, Clock, Plus, Edit2, Trash2, ExternalLink } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { requireAdminUser } from "~/utils/auth.server";
import { getClassById, getClassSessions, generateClassSessions, deleteClassSession } from "~/services/class.server";
import { hasAttendanceRecords } from "~/services/attendance.server";
import type { BulkSessionGeneration } from "~/types/multi-class";
import { useState } from "react";
import { formatDate, formatTime, getTodayLocalDateString , getCurrentDateTimeInTimezone } from "~/utils/misc";
import { formatLocalDate } from "~/components/calendar/utils";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";

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
  await csrf.validate(request);

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
      const excludedDates = formData.get("excluded_dates") as string;

      const generationData: BulkSessionGeneration = {
        class_id: classId,
        start_date: startDate,
        end_date: endDate,
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

  type SessionType = typeof sessions[number];

  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<SessionType | null>(null);

  const handleDelete = (session: SessionType) => {
    setSessionToDelete(session);
    setIsDeleteDialogOpen(true);
  };




  // formatTime is now imported from ~/utils/misc

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
    const today = getCurrentDateTimeInTimezone();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    return sessionDate >= today;
  });
  const pastSessions = sessions.filter(s => {
    const [year, month, day] = s.session_date.split('-').map(Number);
    const sessionDate = new Date(year, month - 1, day);
    const today = getCurrentDateTimeInTimezone();
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
          <Link to={`/admin/sessions?class_id=${classData.id}`}>
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
                <AuthenticityTokenInput />
                <input type="hidden" name="intent" value="generate" />

                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    defaultValue={getTodayLocalDateString()}
                    required
                    className="input-custom-styles"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    name="end_date"
                    type="date"
                    defaultValue={formatLocalDate(new Date(getCurrentDateTimeInTimezone().setFullYear(getCurrentDateTimeInTimezone().getFullYear() + 1)))}
                    required
                    className="input-custom-styles"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excluded_dates">Excluded Dates (Optional)</Label>
                  <Input
                    id="excluded_dates"
                    name="excluded_dates"
                    placeholder="2024-12-25, 2024-01-01"
                    className="input-custom-styles"
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
                      asChild
                      variant="ghost"
                      size="sm"
                      tabIndex={0}
                    >
                      <Link to={`/admin/sessions/${session.id}/edit`}>
                        <Edit2 className="h-4 w-4" />
                      </Link>
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
                    asChild
                    variant="ghost"
                    size="sm"
                  >
                    <Link to={`/admin/sessions/${session.id}/edit`}>
                      <Edit2 className="h-4 w-4" />
                    </Link>
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
            <Form method="post" onSubmit={() => setIsDeleteDialogOpen(false)}>
              <AuthenticityTokenInput />
              <input type="hidden" name="intent" value="delete_session" />
              {sessionToDelete && (
                <input type="hidden" name="session_id" value={sessionToDelete.id} />
              )}
              <AlertDialogAction
                type="submit"
                disabled={isSubmitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                tabIndex={0}
              >
                {isSubmitting ? 'Deleting...' : 'Delete Session'}
              </AlertDialogAction>
            </Form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
