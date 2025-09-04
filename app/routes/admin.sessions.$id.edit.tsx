import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData, Link } from "@remix-run/react";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Calendar, Clock, Save } from "lucide-react";
import { AppBreadcrumb } from "~/components/AppBreadcrumb";
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from "~/components/AdminCard";
import { requireAdminUser } from "~/utils/auth.server";
import { getClassSessionById, updateClassSession } from "~/services/class.server";
import { formatDate } from "~/utils/misc";

type ActionData = {
  errors?: {
    session_date?: string;
    start_time?: string;
    end_time?: string;
    status?: string;
    notes?: string;
    instructor_id?: string;
    general?: string;
  };
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminUser(request);

  const sessionId = params.id;
  if (!sessionId) {
    throw new Response("Session ID is required", { status: 400 });
  }

  const session = await getClassSessionById(sessionId);
  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  return json({ session });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdminUser(request);

  const sessionId = params.id;
  if (!sessionId) {
    throw new Response("Session ID is required", { status: 400 });
  }

  try {
    await csrf.validate(request);
  } catch (error) {
    console.error('CSRF validation failed:', error);
    return json({ errors: { general: 'Security validation failed. Please try again.' } }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "update") {
      const sessionDate = formData.get("session_date") as string;
      const startTime = formData.get("start_time") as string;
      const endTime = formData.get("end_time") as string;
      const status = formData.get("status") as string;
      const notes = formData.get("notes") as string;
      const instructorId = formData.get("instructor_id") as string;

      // Validation
      const errors: {
        session_date?: string;
        start_time?: string;
        end_time?: string;
        status?: string;
        general?: string;
      } = {};

      if (!sessionDate?.trim()) {
        errors.session_date = "Session date is required";
      }

      if (!startTime?.trim()) {
        errors.start_time = "Start time is required";
      }

      if (!endTime?.trim()) {
        errors.end_time = "End time is required";
      }

      if (!status?.trim()) {
        errors.status = "Status is required";
      }

      if (Object.keys(errors).length > 0) {
        return json({ errors }, { status: 400 });
      }

      await updateClassSession(sessionId, {
        session_date: sessionDate,
        start_time: startTime,
        end_time: endTime,
        status: status as 'scheduled' | 'completed' | 'cancelled',
        notes: notes || undefined,
        instructor_id: instructorId || undefined
      });

      return redirect("/admin/sessions");
    }

    return json({ errors: { general: "Invalid intent" } }, { status: 400 });
  } catch (error) {
    console.error("Error updating session:", error);
    return json<ActionData>({
      errors: { general: "Failed to update session. Please try again." }
    }, { status: 500 });
  }
}

export default function EditSession() {
  const { session } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="container mx-auto px-4 py-8">
      <AppBreadcrumb 
        items={[
          { label: "Admin Dashboard", href: "/admin" },
          { label: "Session Management", href: "/admin/sessions" },
          { label: `Edit Session - ${formatDate(session.session_date)}`, current: true }
        ]} 
        className="mb-6"
      />
      
      <div className="mt-6">
        <Form method="post" className="space-y-6">
          <AuthenticityTokenInput />
          <AdminCard>
            <AdminCardHeader>
              <AdminCardTitle>Session Details</AdminCardTitle>
            </AdminCardHeader>
            <AdminCardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="session_date">Session Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="session_date"
                      name="session_date"
                      type="date"
                      defaultValue={session.session_date}
                      className="pl-10 input-custom-styles"
                      tabIndex={1}
                      required
                    />
                  </div>
                  {actionData?.errors?.session_date && (
                    <p className="text-sm text-destructive">{actionData.errors.session_date}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue={session.status} required>
                    <SelectTrigger className="input-custom-styles" tabIndex={2}>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  {actionData?.errors?.status && (
                    <p className="text-sm text-destructive">{actionData.errors.status}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="start_time"
                      name="start_time"
                      type="time"
                      defaultValue={session.start_time}
                      className="pl-10 input-custom-styles"
                      tabIndex={3}
                      required
                    />
                  </div>
                  {actionData?.errors?.start_time && (
                    <p className="text-sm text-destructive">{actionData.errors.start_time}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="end_time"
                      name="end_time"
                      type="time"
                      defaultValue={session.end_time}
                      className="pl-10 input-custom-styles"
                      tabIndex={4}
                      required
                    />
                  </div>
                  {actionData?.errors?.end_time && (
                    <p className="text-sm text-destructive">{actionData.errors.end_time}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructor_id">Instructor ID (Optional)</Label>
                <Input
                  id="instructor_id"
                  name="instructor_id"
                  type="text"
                  defaultValue={session.instructor_id || ""}
                  placeholder="Enter instructor ID"
                  className="input-custom-styles"
                  tabIndex={5}
                />
                {actionData?.errors?.instructor_id && (
                  <p className="text-sm text-destructive">{actionData.errors.instructor_id}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={session.notes || ""}
                  placeholder="Add any notes about this session..."
                  rows={4}
                  className="input-custom-styles"
                  tabIndex={6}
                />
                {actionData?.errors?.notes && (
                  <p className="text-sm text-destructive">{actionData.errors.notes}</p>
                )}
              </div>

              {actionData?.errors?.general && (
                <div className="rounded-md bg-destructive/15 p-3">
                  <p className="text-sm text-destructive">{actionData.errors.general}</p>
                </div>
              )}
            </AdminCardContent>
          </AdminCard>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" asChild tabIndex={7}>
              <Link to="/admin/sessions">Cancel</Link>
            </Button>
            <Button 
              type="submit" 
              name="intent" 
              value="update"
              disabled={isSubmitting}
              tabIndex={8}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}