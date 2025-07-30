import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, useActionData } from "@remix-run/react";
import { useState } from "react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
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

type LoaderData = {
  instructors: Instructor[];
  waivers: Waiver[];
};

type ActionData = {
  error?: string;
  fieldErrors?: {
    title?: string;
    event_type?: string;
    start_date?: string;
    registration_fee?: string;
  };
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return redirect("/login?redirectTo=/admin/events/new", { headers });
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
    // Get instructors for the dropdown
    const { data: instructors, error: instructorsError } = await supabaseServer
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('role', 'instructor')
      .order('first_name');

    if (instructorsError) throw instructorsError;

    // Get available waivers
    const { data: waivers, error: waiversError } = await supabaseServer
      .from('waivers')
      .select('id, title, description, required')
      .order('title');

    if (waiversError) throw waiversError;

    return json({
      instructors: instructors || [],
      waivers: waivers || []
    }, { headers });

  } catch (error) {
    console.error("Error loading data:", error);
    throw new Response("Failed to load data", { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return redirect("/login", { headers });
  }

  const formData = await request.formData();
  
  // Extract form data
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const event_type = formData.get("event_type") as string;
  const start_date = formData.get("start_date") as string;
  const end_date = formData.get("end_date") as string;
  const start_time = formData.get("start_time") as string;
  const end_time = formData.get("end_time") as string;
  const location = formData.get("location") as string;
  const location_name = formData.get("location_name") as string;
  const street_address = formData.get("street_address") as string;
  const address = formData.get("address") as string;
  const locality = formData.get("locality") as string;
  const region = formData.get("region") as string;
  const postal_code = formData.get("postal_code") as string;
  const country = formData.get("country") as string;
  const max_participants = formData.get("max_participants") as string;
  const registration_fee = formData.get("registration_fee") as string;
  const registration_deadline = formData.get("registration_deadline") as string;
  const instructor_id = formData.get("instructor_id") as string;
  const requires_waiver = formData.get("requires_waiver") === "on";
  const min_belt_rank = formData.get("min_belt_rank") as string;
  const max_belt_rank = formData.get("max_belt_rank") as string;
  const min_age = formData.get("min_age") as string;
  const max_age = formData.get("max_age") as string;
  const external_url = formData.get("external_url") as string;

  // Extract selected waivers
  const selectedWaivers: Array<{waiverId: string, isRequired: boolean}> = [];
  for (const [key] of formData.entries()) {
    if (key.startsWith("waiver_")) {
      const waiverId = key.replace("waiver_", "");
      const isRequired = formData.get(`waiver_required_${waiverId}`) === "on";
      selectedWaivers.push({ waiverId, isRequired });
    }
  }

  // Validation
  const fieldErrors: ActionData["fieldErrors"] = {};
  
  if (!title?.trim()) {
    fieldErrors.title = "Title is required";
  }
  
  if (!event_type) {
    fieldErrors.event_type = "Event type is required";
  }
  
  if (!start_date) {
    fieldErrors.start_date = "Start date is required";
  }
  
  if (registration_fee && isNaN(parseFloat(registration_fee))) {
    fieldErrors.registration_fee = "Registration fee must be a valid number";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return json({ fieldErrors }, { status: 400, headers });
  }

  try {
    // Insert the event
    const eventData: Database["public"]["Tables"]["events"]["Insert"] = {
      title,
      description: description || null,
      event_type: event_type as Database["public"]["Enums"]["event_type_enum"],
      start_date,
      end_date: end_date || null,
      start_time: start_time || null,
      end_time: end_time || null,
      location: location || null,
      address: address || null,
      location_name: location_name || null,
      street_address: street_address || null,
      locality: locality || null,
      region: region || null,
      postal_code: postal_code || null,
      country: country || null,
      max_participants: max_participants ? parseInt(max_participants) : null,
      registration_fee: registration_fee ? parseFloat(registration_fee) : null,
      registration_deadline: registration_deadline || null,
      instructor_id: instructor_id || null,
      requires_waiver,
      min_belt_rank: min_belt_rank ? (min_belt_rank as Database["public"]["Enums"]["belt_rank_enum"]) : null,
      max_belt_rank: max_belt_rank ? (max_belt_rank as Database["public"]["Enums"]["belt_rank_enum"]) : null,
      min_age: min_age ? parseInt(min_age) : null,
      max_age: max_age ? parseInt(max_age) : null,
      status: "published",
      created_by: user.id,
      external_url: external_url || null,
    };

    const { data: event, error: eventError } = await supabaseServer
      .from("events")
      .insert(eventData)
      .select()
      .single();

    if (eventError) {
      console.error("Error creating event:", eventError);
      throw new Response("Failed to create event", { status: 500 });
    }

    // Insert event waivers if any are selected
    if (selectedWaivers.length > 0) {
      const eventWaivers = selectedWaivers.map(({ waiverId, isRequired }) => ({
        event_id: event.id,
        waiver_id: waiverId,
        is_required: isRequired
      }));

      const { error: waiversError } = await supabaseServer
        .from("event_waivers")
        .insert(eventWaivers);

      if (waiversError) {
        console.error("Error linking waivers to event:", waiversError);
        // Note: Event was created successfully, but waiver linking failed
        // You might want to handle this differently based on your requirements
      }
    }

    return redirect(`/admin/events`, { headers });

  } catch (error) {
    console.error("Error creating event:", error);
    return json({ 
      error: "Failed to create event. Please try again." 
    }, { status: 500, headers });
  }
}

export default function NewEvent() {
  const { instructors, waivers } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [requiresWaiver, setRequiresWaiver] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AppBreadcrumb items={breadcrumbPatterns.adminEventsNew()} />
      
      <div>
        <h1 className="text-3xl font-bold">Create New Event</h1>
        <p className="text-muted-foreground">Set up a new competition, seminar, or special event</p>
      </div>

      {actionData?.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}

      <Form method="post" className="space-y-6">
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
                  placeholder="e.g., Spring Tournament 2024"
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
                  placeholder="Describe the event, what to expect, requirements, etc."
                  rows={3}
                  className="input-custom-styles"
                  tabIndex={2}
                />
              </div>

              <div>
                <Label htmlFor="event_type">Event Type *</Label>
                <Select name="event_type" required>
                  <SelectTrigger className="input-custom-styles" tabIndex={3}>
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="competition">Competition</SelectItem>
                    <SelectItem value="seminar">Seminar</SelectItem>
                    <SelectItem value="testing">Testing</SelectItem>
                    <SelectItem value="tournament">Tournament</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="social_event">Social Event</SelectItem>
                    <SelectItem value="fundraiser">Fundraiser</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {actionData?.fieldErrors?.event_type && (
                  <p className="text-sm text-destructive mt-1">{actionData.fieldErrors.event_type}</p>
                )}
              </div>

              <div>
                <Label htmlFor="instructor_id">Instructor</Label>
                <Select name="instructor_id">
                  <SelectTrigger className="input-custom-styles" tabIndex={4}>
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

              <div>
                <Label htmlFor="external_url">External Event URL</Label>
                <Input
                  id="external_url"
                  name="external_url"
                  type="url"
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
                  className="input-custom-styles"
                  tabIndex={7}
                />
              </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    name="start_time"
                    type="time"
                    className="input-custom-styles"
                    tabIndex={9}
                  />
                </div>

                <div>
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    name="end_time"
                    type="time"
                    className="input-custom-styles"
                    tabIndex={8}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location & Capacity */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location & Capacity
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="location">Location Name</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="e.g., Main Dojo, Community Center"
                  className="input-custom-styles"
                  tabIndex={10}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  General location name or venue name
                </p>
              </div>

              <div>
                <Label htmlFor="location_name">Specific Location Name</Label>
                <Input
                  id="location_name"
                  name="location_name"
                  placeholder="e.g., Toronto Karate Academy - Main Hall"
                  className="input-custom-styles"
                  tabIndex={10.1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Detailed venue name for metadata and SEO
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="street_address">Street Address</Label>
                  <Input
                    id="street_address"
                    name="street_address"
                    placeholder="e.g., 123 Main Street"
                    className="input-custom-styles"
                    tabIndex={10.2}
                  />
                </div>

                <div>
                  <Label htmlFor="address">Full Address (Legacy)</Label>
                  <Input
                    id="address"
                    name="address"
                    placeholder="Complete address for display"
                    className="input-custom-styles"
                    tabIndex={10.3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Fallback address if structured fields are empty
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="locality">City/Locality</Label>
                  <Input
                    id="locality"
                    name="locality"
                    placeholder="e.g., Toronto"
                    className="input-custom-styles"
                    tabIndex={10.4}
                  />
                </div>

                <div>
                  <Label htmlFor="region">Province/State</Label>
                  <Input
                    id="region"
                    name="region"
                    placeholder="e.g., ON"
                    className="input-custom-styles"
                    tabIndex={10.5}
                  />
                </div>

                <div>
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    name="postal_code"
                    placeholder="e.g., M5V 3A8"
                    className="input-custom-styles"
                    tabIndex={10.6}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    placeholder="e.g., Canada"
                    defaultValue="Canada"
                    className="input-custom-styles"
                    tabIndex={10.7}
                  />
                </div>

                <div>
                  <Label htmlFor="max_participants">Maximum Participants</Label>
                  <Input
                    id="max_participants"
                    name="max_participants"
                    type="number"
                    min="1"
                    placeholder="e.g., 50"
                    className="input-custom-styles"
                    tabIndex={11}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for unlimited capacity
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Registration & Payment */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Registration & Payment
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="registration_fee">Registration Fee ($)</Label>
                  <Input
                    id="registration_fee"
                    name="registration_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="input-custom-styles"
                    tabIndex={12}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty or 0 for free events
                  </p>
                  {actionData?.fieldErrors?.registration_fee && (
                    <p className="text-sm text-destructive mt-1">{actionData.fieldErrors.registration_fee}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="registration_deadline">Registration Deadline</Label>
                  <Input
                    id="registration_deadline"
                    name="registration_deadline"
                    type="date"
                    className="input-custom-styles"
                    tabIndex={13}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for no deadline
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Eligibility Requirements */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Eligibility Requirements
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_belt_rank">Minimum Belt Rank</Label>
                  <Select name="min_belt_rank">
                    <SelectTrigger className="input-custom-styles" tabIndex={14}>
                      <SelectValue placeholder="Any belt" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="white">White Belt</SelectItem>
                      <SelectItem value="yellow">Yellow Belt</SelectItem>
                      <SelectItem value="orange">Orange Belt</SelectItem>
                      <SelectItem value="green">Green Belt</SelectItem>
                      <SelectItem value="blue">Blue Belt</SelectItem>
                      <SelectItem value="purple">Purple Belt</SelectItem>
                      <SelectItem value="brown">Brown Belt</SelectItem>
                      <SelectItem value="black">Black Belt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="max_belt_rank">Maximum Belt Rank</Label>
                  <Select name="max_belt_rank">
                    <SelectTrigger className="input-custom-styles" tabIndex={15}>
                      <SelectValue placeholder="Any belt" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="white">White Belt</SelectItem>
                      <SelectItem value="yellow">Yellow Belt</SelectItem>
                      <SelectItem value="orange">Orange Belt</SelectItem>
                      <SelectItem value="green">Green Belt</SelectItem>
                      <SelectItem value="blue">Blue Belt</SelectItem>
                      <SelectItem value="purple">Purple Belt</SelectItem>
                      <SelectItem value="brown">Brown Belt</SelectItem>
                      <SelectItem value="black">Black Belt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_age">Minimum Age</Label>
                  <Input
                    id="min_age"
                    name="min_age"
                    type="number"
                    min="1"
                    placeholder="Any age"
                    className="input-custom-styles"
                    tabIndex={17}
                  />
                </div>
                <div>
                  <Label htmlFor="max_age">Maximum Age</Label>
                  <Input
                    id="max_age"
                    name="max_age"
                    type="number"
                    min="1"
                    placeholder="Any age"
                    className="input-custom-styles"
                    tabIndex={16}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="gender_restriction">Gender Restriction</Label>
                <Select name="gender_restriction">
                  <SelectTrigger className="input-custom-styles" tabIndex={18}>
                    <SelectValue placeholder="No restriction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No restriction</SelectItem>
                    <SelectItem value="Male">Male only</SelectItem>
                    <SelectItem value="Female">Female only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="special_needs_support"
                  name="special_needs_support"
                  tabIndex={19}
                />
                <Label htmlFor="special_needs_support" className="text-sm font-medium cursor-pointer">
                  Special Needs Support Available
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Check this if the event can accommodate participants with special needs
              </p>
            </div>
          </div>

          {/* Waiver Requirements */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Waiver Requirements
            </h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requires_waiver"
                  name="requires_waiver"
                  checked={requiresWaiver}
                  onCheckedChange={(checked) => setRequiresWaiver(checked as boolean)}
                  tabIndex={20}
                />
                <Label htmlFor="requires_waiver">Requires Waiver</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Participants will need to sign a waiver before registering for this event
              </p>

              {requiresWaiver && (
                <div className="mt-4 space-y-3">
                  <Label className="text-sm font-medium">Select Required Waivers</Label>
                  {waivers.length > 0 ? (
                    <div className="space-y-3 max-h-48 overflow-y-auto border rounded-md p-3">
                      {waivers.map((waiver, index) => (
                        <div key={waiver.id} className="flex items-start space-x-3 p-2 border rounded-md bg-gray-50 dark:bg-gray-700">
                          <div className="flex items-center space-x-2 flex-1">
                            <Checkbox
                              id={`waiver_${waiver.id}`}
                              name={`waiver_${waiver.id}`}
                              tabIndex={21 + index * 2}
                            />
                            <div className="flex-1">
                              <Label htmlFor={`waiver_${waiver.id}`} className="text-sm font-medium cursor-pointer">
                                {waiver.title}
                                {waiver.required && (
                                  <span className="ml-1 text-xs bg-red-100 text-red-800 px-1 rounded">Required</span>
                                )}
                              </Label>
                              {waiver.description && (
                                <p className="text-xs text-muted-foreground mt-1">{waiver.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`waiver_required_${waiver.id}`}
                              name={`waiver_required_${waiver.id}`}
                              defaultChecked={waiver.required}
                              tabIndex={22 + index * 2}
                            />
                            <Label htmlFor={`waiver_required_${waiver.id}`} className="text-xs text-muted-foreground">
                              Required
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground p-3 border rounded-md bg-gray-50 dark:bg-gray-700">
                      No waivers available. <a href="/admin/waivers/new" className="text-blue-600 hover:underline">Create a waiver</a> first.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild tabIndex={100}>
            <a href="/admin/events">Cancel</a>
          </Button>
          <Button type="submit" disabled={isSubmitting} tabIndex={101}>
            {isSubmitting ? "Creating..." : "Create Event"}
          </Button>
        </div>
      </Form>
    </div>
  );
}