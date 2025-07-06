import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation , Link } from "@remix-run/react";
import { AutoDiscountService } from "~/services/auto-discount.server";
import { DiscountTemplateService } from "~/services/discount-template.server";
import { requireAdminUser } from "~/utils/auth.server";
import { getSupabaseServerClient } from '~/utils/supabase.server';
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { ArrowLeft, Trash2, Calendar, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
// Type definitions for assignment data with joins
type AssignmentWithJoins = {
  id: string;
  assigned_at: string;
  families?: { name?: string } | null;
  students?: { first_name?: string; last_name?: string } | null;
  discount_codes?: {
    code?: string;
    name?: string;
    discount_type?: string;
    discount_value?: number;
  } | null;
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  
  const ruleId = params.ruleId;
  if (!ruleId) {
    throw new Response("Rule ID is required", { status: 400 });
  }

  const { supabaseServer } = getSupabaseServerClient(request);

  try {
    // Get the automation rule
    const { data: rule, error: ruleError } = await supabaseServer
      .from('discount_automation_rules')
      .select(`
        *,
        discount_templates (
          id,
          name,
          discount_type,
          discount_value
        )
      `)
      .eq('id', ruleId)
      .single();

    if (ruleError || !rule) {
      throw new Response("Automation rule not found", { status: 404 });
    }

    // Get all active discount templates for the dropdown
    const templates = await DiscountTemplateService.getActiveTemplates();

    // Get assignments for this rule
    const { data: assignments, error: assignmentsError } = await supabaseServer
      .from('discount_assignments')
      .select(`
        *,
        students (first_name, last_name),
        families (name),
        discount_codes (code, current_uses, max_uses)
      `)
      .eq('automation_rule_id', ruleId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
    }

    return json({
      rule,
      templates,
      assignments: assignments || [],
    });
  } catch (error) {
    console.error('Error loading automation rule:', error);
    throw new Response("Failed to load automation rule", { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdminUser(request);
  
  const ruleId = params.ruleId;
  if (!ruleId) {
    throw new Response("Rule ID is required", { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "update") {
      const name = formData.get("name") as string;
      const eventType = formData.get("event_type") as string;
      const discountTemplateId = formData.get("discount_template_id") as string;
      const isActive = formData.get("is_active") === "on";

      
      // Parse conditions based on event type
      let conditions: Record<string, string | number> | null = null;
      if (eventType === "belt_promotion") {
        const beltRank = formData.get("belt_rank") as string;
        if (beltRank) {
          conditions = { belt_rank: beltRank };
        }
      } else if (eventType === "attendance_milestone") {
        const minAttendance = formData.get("min_attendance") as string;
        if (minAttendance) {
          conditions = { min_attendance: parseInt(minAttendance) };
        }
      } else if (eventType === "student_enrollment") {
        const minAge = formData.get("min_age") as string;
        const maxAge = formData.get("max_age") as string;
        if (minAge || maxAge) {
          conditions = {};
          if (minAge) conditions.min_age = parseInt(minAge);
          if (maxAge) conditions.max_age = parseInt(maxAge);
        }
      }

      await AutoDiscountService.updateAutomationRule(ruleId, {
        name,
        event_type: eventType as "student_enrollment" | "first_payment" | "belt_promotion" | "attendance_milestone" | "family_referral" | "birthday" | "seasonal_promotion",
        discount_template_id: discountTemplateId,
        conditions,
        is_active: isActive,
      });

      return redirect("/admin/automatic-discounts");
    } else if (intent === "delete") {
      await AutoDiscountService.deleteAutomationRule(ruleId);
      return redirect("/admin/automatic-discounts");
    }

    return json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error('Error updating automation rule:', error);
    return json({ error: "Failed to update automation rule" }, { status: 500 });
  }
}

export default function EditAutomationRule() {
  const { rule, templates, assignments } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [eventType, setEventType] = useState(rule.event_type);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Automation Rule</h1>
          <p className="text-muted-foreground">Modify the automatic discount assignment rule</p>
        </div>
        <Link to="/admin/automatic-discounts">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Rules
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle>Rule Details</CardTitle>
            <CardDescription>Configure the automation rule settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update" />
              
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={rule.name}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_type">Event Type</Label>
                <Select
                  value={eventType}
                  onValueChange={(value) => setEventType(value as "student_enrollment" | "first_payment" | "belt_promotion" | "attendance_milestone" | "family_referral" | "birthday" | "seasonal_promotion")}
                  name="event_type"
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student_enrollment">Student Enrollment</SelectItem>
                    <SelectItem value="first_payment">First Payment</SelectItem>
                    <SelectItem value="belt_promotion">Belt Promotion</SelectItem>
                    <SelectItem value="attendance_milestone">Attendance Milestone</SelectItem>
                    <SelectItem value="family_referral">Family Referral</SelectItem>
                    <SelectItem value="birthday">Birthday</SelectItem>
                    <SelectItem value="seasonal_promotion">Seasonal Promotion</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="event_type" value={eventType} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount_template_id">Discount Template</Label>
                <Select
                  defaultValue={rule.discount_template_id}
                  name="discount_template_id"
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a discount template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} ({template.discount_type === 'percentage' ? `${template.discount_value}%` : `$${template.discount_value}`} off)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional fields based on event type */}
              {eventType === "belt_promotion" && (
                <div className="space-y-2">
                  <Label htmlFor="belt_rank">Belt Rank (optional)</Label>
                  <Select
                    defaultValue={(rule.conditions as Record<string, string | number>)?.belt_rank as string || ""}
                    name="belt_rank"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any belt rank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any belt rank</SelectItem>
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
              )}

              {eventType === "attendance_milestone" && (
                <div className="space-y-2">
                  <Label htmlFor="min_attendance">Minimum Attendance Count</Label>
                  <Input
                    type="number"
                    id="min_attendance"
                    name="min_attendance"
                    defaultValue={(rule.conditions as Record<string, string | number>)?.min_attendance as string || ""}
                    min="1"
                  />
                </div>
              )}

              {eventType === "student_enrollment" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_age">Minimum Age (optional)</Label>
                    <Input
                      type="number"
                      id="min_age"
                      name="min_age"
                      defaultValue={(rule.conditions as Record<string, string | number>)?.min_age as string || ""}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_age">Maximum Age (optional)</Label>
                    <Input
                      type="number"
                      id="max_age"
                      name="max_age"
                      defaultValue={(rule.conditions as Record<string, string | number>)?.max_age as string || ""}
                      min="0"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="validity_days">Validity Days (optional)</Label>
                  <Input
                    type="number"
                    id="validity_days"
                    name="validity_days"
                    defaultValue=""
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_uses_per_family">Max Uses per Family (optional)</Label>
                  <Input
                    type="number"
                    id="max_uses_per_family"
                    name="max_uses_per_family"
                    defaultValue=""
                    min="1"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  name="is_active"
                  defaultChecked={rule.is_active}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Rule
                </Button>
                
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Updating..." : "Update Rule"}
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>

        {/* Assignments List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Recent Assignments ({assignments.length})
            </CardTitle>
            <CardDescription>
              Latest discount assignments for this rule
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-sm">No assignments yet</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Assignments will appear here when this rule is triggered
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.slice(0, 10).map((assignment) => (
                  <div key={assignment.id} className="border dark:border-gray-700 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">
                          {(assignment as AssignmentWithJoins).students?.first_name} {(assignment as AssignmentWithJoins).students?.last_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {(assignment as AssignmentWithJoins).families?.name}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {(assignment as AssignmentWithJoins).discount_codes?.code}
                        </Badge>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(assignment.assigned_at))} ago
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {assignments.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    ... and {assignments.length - 10} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900">Delete Automation Rule</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete this automation rule? This action cannot be undone.
                  Existing discount assignments will remain active.
                </p>
              </div>
              <div className="flex justify-center space-x-4 px-4 py-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <Form method="post" className="inline">
                  <input type="hidden" name="intent" value="delete" />
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
                  >
                    Delete
                  </button>
                </Form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}