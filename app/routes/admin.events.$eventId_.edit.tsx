import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, useActionData } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { Calendar, MapPin, Users, DollarSign, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import type { Database } from "~/types/database.types";
import { getEventTypeOptions } from "~/utils/event-helpers.server";

type Event = Database['public']['Tables']['events']['Row'];

type Instructor = {
  id: string;
  first_name: string;
  last_name: string;
};

type Waiver = {
  id: string;
  title: string;
  description: string;
  required: boolean;
};

type EventWaiver = {
  waiver_id: string;
  is_required: boolean;
};

type LoaderData = {
  event: Event;
  instructors: Instructor[];
  waivers: Waiver[];
  eventWaivers: EventWaiver[]; // Array of waiver objects with requirement status
  eventTypeOptions: { value: string; label: string; }[];
};

type ActionData = {
  error?: string;
  fieldErrors?: {
    title?: string;
    event_type_id?: string;
    start_date?: string;
    registration_fee?: string;
  };
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { eventId } = params;
  
  if (!eventId) {
    throw new Response("Event ID is required", { status: 400 });
  }

  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return redirect("/login?redirectTo=/admin/events", { headers });
  }

  // Check if user is admin
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return redirect("/", { headers });
  }

  try {
    // Fetch the event
    const { data: event, error: eventError } = await supabaseServer
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new Response("Event not found", { status: 404 });
    }

    // Fetch instructors
    const { data: instructors, error: instructorsError } = await supabaseServer
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('role', 'instructor')
      .order('first_name');

    if (instructorsError) {
      console.error('Error fetching instructors:', instructorsError);
    }

    // Fetch waivers
    const { data: waivers, error: waiversError } = await supabaseServer
      .from('waivers')
      .select('id, title, description, required')
      .order('title');

    if (waiversError) {
      console.error('Error fetching waivers:', waiversError);
    }

    // Fetch event waivers
    const { data: eventWaivers, error: eventWaiversError } = await supabaseServer
      .from('event_waivers')
      .select('waiver_id, is_required')
      .eq('event_id', eventId);

    if (eventWaiversError) {
      console.error('Error fetching event waivers:', eventWaiversError);
    }

    // Get event type options
    const eventTypeOptions = await getEventTypeOptions(request);

    return json({
      event,
      instructors: instructors || [],
      waivers: waivers || [],
      eventWaivers: eventWaivers || [],
      eventTypeOptions
    }, { headers });
  } catch (error) {
    console.error('Error in loader:', error);
    throw new Response("Internal Server Error", { status: 500 });
  }
}

export async function action({ params, request }: ActionFunctionArgs) {
  const { eventId } = params;
  
  if (!eventId) {
    throw new Response("Event ID is required", { status: 400 });
  }

  try {
    await csrf.validate(request);
  } catch (error) {
    console.error('CSRF validation failed:', error);
    return json({ error: 'Security validation failed. Please try again.' }, { status: 403 });
  }

  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return redirect("/login", { headers });
  }

  const formData = await request.formData();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const eventTypeId = formData.get("event_type_id") as string;
  const status = formData.get("status") as string;
  const startDate = formData.get("start_date") as string;
  const endDate = formData.get("end_date") as string;
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;
  const location = formData.get("location") as string;
  const address = formData.get("address") as string;
  const maxParticipants = formData.get("max_participants") as string;
  const registrationFee = formData.get("registration_fee") as string;
  const registrationDeadline = formData.get("registration_deadline") as string;
  const instructorId = formData.get("instructor_id") as string;
  const externalUrl = formData.get("external_url") as string;
  const visibility = formData.get("visibility") as Database["public"]["Enums"]["event_visibility_enum"] || "public";
  // Extract selected waivers - if checked, they are required
  const selectedWaivers: { waiverId: string; isRequired: boolean }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('waiver_') && value === 'on') {
      const waiverId = key.replace('waiver_', '');
      selectedWaivers.push({ waiverId, isRequired: true });
    }
  }

  // Validation
  const fieldErrors: ActionData['fieldErrors'] = {};
  
  if (!title?.trim()) {
    fieldErrors.title = "Event title is required";
  }
  
  if (!eventTypeId) {
    fieldErrors.event_type_id = "Event type is required";
  }
  
  if (!startDate) {
    fieldErrors.start_date = "Start date is required";
  }
  
  if (registrationFee && isNaN(Number(registrationFee))) {
    fieldErrors.registration_fee = "Registration fee must be a valid number";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return json({ fieldErrors }, { status: 400, headers });
  }

  try {
    // Update the event
    const { error: updateError } = await supabaseServer
      .from('events')
      .update({
        title: title.trim(),
        description: description?.trim() || null,
        event_type_id: eventTypeId,
        status: status as Database['public']['Enums']['event_status_enum'],
        start_date: startDate,
        end_date: endDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        location: location?.trim() || null,
        address: address?.trim() || null,
        max_participants: maxParticipants ? parseInt(maxParticipants) : null,
        registration_fee: registrationFee ? parseFloat(registrationFee) : 0,
        registration_deadline: registrationDeadline || null,
        instructor_id: (instructorId && instructorId !== 'none') ? instructorId : null,
        external_url: externalUrl?.trim() || null,
        visibility,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId);

    if (updateError) {
      console.error('Error updating event:', updateError);
      return json({ error: "Failed to update event. Please try again." }, { status: 500, headers });
    }

    // Handle event waivers
    // First, delete existing event waivers
    await supabaseServer
      .from('event_waivers')
      .delete()
      .eq('event_id', eventId);

    // Then insert new ones with requirement status if any are selected
    if (selectedWaivers.length > 0) {
      const eventWaiverInserts = selectedWaivers.map(({ waiverId, isRequired }) => ({
        event_id: eventId,
        waiver_id: waiverId,
        is_required: isRequired
      }));

      const { error: waiversError } = await supabaseServer
        .from('event_waivers')
        .insert(eventWaiverInserts);

      if (waiversError) {
        console.error('Error updating event waivers:', waiversError);
        // Don't fail the whole operation for waiver errors
      }
    }

    return redirect("/admin/events", { headers });
  } catch (error) {
    console.error('Error updating event:', error);
    return json({ error: "Failed to update event. Please try again." }, { status: 500, headers });
  }
}

export default function EditEvent() {
  const { event, instructors, waivers, eventWaivers, eventTypeOptions } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  // Removed requiresWaiver state - now using individual waiver selection

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AppBreadcrumb items={breadcrumbPatterns.adminEventEdit(event.title, event.id)} />
      
      <div>
        <h1 className="text-3xl font-bold">Edit Event</h1>
        <p className="text-muted-foreground">Update event details and configuration</p>
      </div>

      {actionData?.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}

      <Form method="post" className="space-y-6">
        <AuthenticityTokenInput />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Basic Information
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={event.title}
                  required
                  className="input-custom-styles"
                  tabIndex={1}
                />
                {actionData?.fieldErrors?.title && (
                  <p className="text-sm text-destructive mt-1">{actionData.fieldErrors.title}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={event.description || ''}
                  placeholder="Describe the event, requirements, what to bring, etc."
                  className="input-custom-styles min-h-[100px]"
                  tabIndex={2}
                />
              </div>
              
              <div>
                <Label htmlFor="event_type">Event Type *</Label>
                <Select name="event_type_id" defaultValue={event.event_type_id} required>
                  <SelectTrigger className="input-custom-styles" tabIndex={3}>
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {actionData?.fieldErrors?.event_type_id && (
                  <p className="text-sm text-destructive mt-1">{actionData.fieldErrors.event_type_id}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={event.status}>
                  <SelectTrigger className="input-custom-styles" tabIndex={4}>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="registration_open">Registration Open</SelectItem>
                    <SelectItem value="registration_closed">Registration Closed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="external_url">External URL</Label>
                <Input
                  id="external_url"
                  name="external_url"
                  type="url"
                  defaultValue={event.external_url || ''}
                  placeholder="https://example.com/event-registration"
                  className="input-custom-styles"
                  tabIndex={5}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: Link to external registration or event information page
                </p>
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Date & Time
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    defaultValue={event.start_date}
                    required
                    className="input-custom-styles"
                    tabIndex={6}
                  />
                  {actionData?.fieldErrors?.start_date && (
                    <p className="text-sm text-destructive mt-1">{actionData.fieldErrors.start_date}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    name="end_date"
                    type="date"
                    defaultValue={event.end_date || ''}
                    className="input-custom-styles"
                    tabIndex={7}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for single-day events
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    name="start_time"
                    type="time"
                    defaultValue={event.start_time || ''}
                    className="input-custom-styles"
                    tabIndex={8}
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    name="end_time"
                    type="time"
                    defaultValue={event.end_time || ''}
                    className="input-custom-styles"
                    tabIndex={9}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="registration_deadline">Registration Deadline</Label>
                <Input
                  id="registration_deadline"
                  name="registration_deadline"
                  type="date"
                  defaultValue={event.registration_deadline || ''}
                  className="input-custom-styles"
                  tabIndex={10}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Last day students can register for this event
                </p>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="location">Venue Name</Label>
                <Input
                  id="location"
                  name="location"
                  defaultValue={event.location || ''}
                  placeholder="e.g., Main Dojo, Community Center"
                  className="input-custom-styles"
                  tabIndex={11}
                />
              </div>
              
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  name="address"
                  defaultValue={event.address || ''}
                  placeholder="Full address including city, province, postal code"
                  className="input-custom-styles"
                  tabIndex={12}
                />
              </div>
            </div>
          </div>

          {/* Registration & Capacity */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Registration & Capacity
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="max_participants">Maximum Participants</Label>
                <Input
                  id="max_participants"
                  name="max_participants"
                  type="number"
                  min="1"
                  defaultValue={event.max_participants?.toString() || ''}
                  placeholder="Leave empty for unlimited"
                  className="input-custom-styles"
                  tabIndex={13}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum number of students who can register
                </p>
              </div>
              
              <div>
                <Label htmlFor="registration_fee">Registration Fee ($)</Label>
                <Input
                  id="registration_fee"
                  name="registration_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={event.registration_fee?.toString() || '0'}
                  className="input-custom-styles"
                  tabIndex={14}
                />
                {actionData?.fieldErrors?.registration_fee && (
                  <p className="text-sm text-destructive mt-1">{actionData.fieldErrors.registration_fee}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="instructor_id">Instructor</Label>
                <Select name="instructor_id" defaultValue={event.instructor_id || 'none'}>
                  <SelectTrigger className="input-custom-styles" tabIndex={15}>
                    <SelectValue placeholder="Select instructor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No instructor assigned</SelectItem>
                    {instructors.map((instructor) => (
                      <SelectItem key={instructor.id} value={instructor.id}>
                        {instructor.first_name} {instructor.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Settings
          </h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="visibility">Event Visibility *</Label>
              <Select name="visibility" defaultValue={event.visibility || "public"}>
                <SelectTrigger className="input-custom-styles" tabIndex={16}>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public - Displayed on main page, everyone can register</SelectItem>
                  <SelectItem value="limited">Limited - Not displayed, but accessible via link, everyone can register</SelectItem>
                  <SelectItem value="internal">Internal - Only visible when logged in, only existing users can register</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Controls who can see and register for this event
              </p>
            </div>
          </div>
        </div>

        {/* Waiver Requirements */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Waiver Requirements
          </h2>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Check the waivers that participants must sign before registering for this event. Checked waivers will be required.
            </p>

            <div className="mt-4 space-y-3">
              <Label className="text-sm font-medium">Available Waivers</Label>
                {waivers.length > 0 ? (
                  <div className="space-y-3 max-h-48 overflow-y-auto border rounded-md p-3">
                    {waivers.map((waiver) => {
                      const eventWaiver = eventWaivers.find(ew => ew.waiver_id === waiver.id);
                      return (
                        <div key={waiver.id} className="flex items-start space-x-3 p-2 border rounded-md bg-gray-50 dark:bg-gray-700">
                          <div className="flex items-center space-x-2 flex-1">
                            <Checkbox 
                              id={`waiver_${waiver.id}`}
                              name={`waiver_${waiver.id}`}
                              defaultChecked={!!eventWaiver}
                            />
                            <div className="flex-1">
                              <Label htmlFor={`waiver_${waiver.id}`} className="text-sm font-medium cursor-pointer">
                                {waiver.title}
                              </Label>
                              {waiver.description && (
                                <p className="text-xs text-muted-foreground mt-1">{waiver.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-3 border rounded-md bg-gray-50 dark:bg-gray-700">
                    No waivers available. <a href="/admin/waivers/new" className="text-blue-600 hover:underline">Create a waiver</a> first.
                  </div>
                )}
              </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" asChild>
            <a href="/admin/events">Cancel</a>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating Event..." : "Update Event"}
          </Button>
        </div>
      </Form>
    </div>
  );
}