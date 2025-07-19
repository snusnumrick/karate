import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation , Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { AutoDiscountService } from "~/services/auto-discount.server";
import { DiscountTemplateService } from "~/services/discount-template.server";
import { requireAdminUser } from "~/utils/auth.server";
import type { Json } from "~/types/database.types";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

import { useState } from "react";
import { Badge } from "~/components/ui/badge";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  
  try {
    const [templates, programs] = await Promise.all([
      DiscountTemplateService.getActiveTemplates(),
      import('~/services/program.server').then(m => m.getPrograms({ is_active: true }))
    ]);
    return json({ templates, programs });
  } catch (error) {
    throw new Response('Failed to load data', { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminUser(request);
  const formData = await request.formData();
  
  const name = formData.get('name') as string;
  const eventType = formData.get('event_type') as string;
  const discountTemplateId = formData.get('discount_template_id') as string;
  const usesMultipleTemplates = formData.get('uses_multiple_templates') === 'on';
  const validFrom = formData.get('valid_from') as string;
  const validUntil = formData.get('valid_until') as string;
  const isActive = formData.get('is_active') === 'on';
  
  // Handle applicable programs
  const applicablePrograms = formData.getAll('applicable_programs') as string[];
  const filteredPrograms = applicablePrograms.filter(id => id && id.trim() !== '');
  
  // Handle multiple discount templates
  let discountTemplateIds: string[] = [];
  if (usesMultipleTemplates) {
    const templateIds = formData.getAll('discount_template_ids') as string[];
    discountTemplateIds = templateIds.filter(id => id && id.trim() !== '');
  }
  
  // Parse conditions from form
  const conditions: Record<string, Json> = {};
  
  // Handle different condition types based on event type
  if (eventType === 'belt_promotion') {
    const beltRank = formData.get('condition_belt_rank') as string;
    if (beltRank) conditions.belt_rank = beltRank;
  }
  
  if (eventType === 'attendance_milestone') {
    const attendanceCount = formData.get('condition_attendance_count') as string;
    if (attendanceCount) conditions.attendance_count = parseInt(attendanceCount);
  }
  
  if (eventType === 'student_enrollment') {
    const minAge = formData.get('condition_min_age') as string;
    if (minAge) conditions.min_age = parseInt(minAge);
    
    const minFamilySize = formData.get('condition_min_family_size') as string;
    if (minFamilySize) conditions.min_family_size = parseInt(minFamilySize);
  }
  
  try {
    await AutoDiscountService.createAutomationRule({
      name,
      event_type: eventType as "student_enrollment" | "first_payment" | "belt_promotion" | "attendance_milestone" | "family_referral" | "birthday" | "seasonal_promotion",
      discount_template_id: usesMultipleTemplates ? undefined : discountTemplateId,
      discount_template_ids: usesMultipleTemplates ? discountTemplateIds : undefined,
      uses_multiple_templates: usesMultipleTemplates,
      conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
      valid_from: validFrom || undefined,
      valid_until: validUntil || undefined,
      applicable_programs: filteredPrograms.length > 0 ? filteredPrograms : undefined,
      is_active: isActive,
    });
    
    return redirect('/admin/automatic-discounts');
  } catch (error) {
    console.error('Error creating automation rule:', error);
    return json({ error: 'Failed to create automation rule' }, { status: 500 });
  }
}

const eventTypes = [
  { value: 'student_enrollment', label: 'Student Enrollment' },
  { value: 'first_payment', label: 'First Payment' },
  { value: 'belt_promotion', label: 'Belt Promotion' },
  { value: 'attendance_milestone', label: 'Attendance Milestone' },
  { value: 'family_referral', label: 'Family Referral' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'seasonal_promotion', label: 'Seasonal Promotion' },
];

const beltRanks = [
  'white', 'yellow', 'orange', 'green', 'blue', 'purple', 'red', 'brown', 'black'
];

export default function NewAutomationRule() {
  const { templates, programs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [usesMultipleTemplates, setUsesMultipleTemplates] = useState<boolean>(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <AppBreadcrumb 
          items={breadcrumbPatterns.adminAutomaticDiscountNew()} 
          className="mb-4"
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Automation Rule</h1>
          <p className="text-muted-foreground">
            Create a rule to automatically assign discounts when events occur
          </p>
        </div>
      </div>

      {actionData?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Define the basic details of your automation rule
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Welcome Discount for New Students"
                required
                tabIndex={1}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="event_type">Trigger Event</Label>
              <Select name="event_type" onValueChange={setSelectedEventType} required>
                <SelectTrigger tabIndex={2}>
                  <SelectValue placeholder="Select an event type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="uses_multiple_templates"
                  name="uses_multiple_templates"
                  checked={usesMultipleTemplates}
                  onCheckedChange={(checked) => setUsesMultipleTemplates(checked === true)}
                />
                <Label htmlFor="uses_multiple_templates">Use Multiple Discount Templates</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Enable this to assign multiple discounts in sequence (e.g., first month discount, second month discount)
              </p>
            </div>

            {!usesMultipleTemplates ? (
              <div className="space-y-2">
                <Label htmlFor="discount_template_id">Discount Template</Label>
                <Select name="discount_template_id" required={!usesMultipleTemplates}>
                  <SelectTrigger tabIndex={3}>
                    <SelectValue placeholder="Select a discount template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} - {template.discount_type === 'percentage' ? 
                          `${template.discount_value}%` : 
                          `$${template.discount_value}`
                        } off
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Discount Templates (in order of application)</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {templates.map((template) => (
                    <div key={template.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`template_${template.id}`}
                        name="discount_template_ids"
                        value={template.id}
                        checked={selectedTemplateIds.includes(template.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTemplateIds(prev => [...prev, template.id]);
                          } else {
                            setSelectedTemplateIds(prev => prev.filter(id => id !== template.id));
                          }
                        }}
                      />
                      <Label htmlFor={`template_${template.id}`} className="flex-1 cursor-pointer">
                        {template.name} - {template.discount_type === 'percentage' ? 
                          `${template.discount_value}%` : 
                          `$${template.discount_value}`
                        } off
                      </Label>
                    </div>
                  ))}
                </div>
                {selectedTemplateIds.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Selected Templates (in order):</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplateIds.map((templateId, index) => {
                        const template = templates.find(t => t.id === templateId);
                        return template ? (
                          <Badge key={templateId} variant="secondary">
                            {index + 1}. {template.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Program Filtering Card */}
        <Card>
          <CardHeader>
            <CardTitle>Program Filtering</CardTitle>
            <CardDescription>
              Select specific programs this rule should apply to. Leave empty to apply to all programs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Applicable Programs (optional)</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {programs.map((program) => (
                  <div key={program.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`program_${program.id}`}
                      name="applicable_programs"
                      value={program.id}
                    />
                    <Label htmlFor={`program_${program.id}`} className="flex-1 cursor-pointer">
                      {program.name}
                      {program.description && (
                        <span className="text-sm text-muted-foreground block">
                          {program.description}
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                If no programs are selected, the rule will apply to students in any program.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Conditions Card */}
        {selectedEventType && (
          <Card>
            <CardHeader>
              <CardTitle>Conditions</CardTitle>
              <CardDescription>
                Optional conditions that must be met for the rule to trigger
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedEventType === 'student_enrollment' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="condition_min_age">Minimum Age</Label>
                    <Input
                      id="condition_min_age"
                      name="condition_min_age"
                      type="number"
                      placeholder="e.g., 5"
                      tabIndex={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="condition_min_family_size">Minimum Family Size</Label>
                    <Input
                      id="condition_min_family_size"
                      name="condition_min_family_size"
                      type="number"
                      placeholder="e.g., 2"
                      tabIndex={5}
                    />
                  </div>
                </>
              )}
              
              {selectedEventType === 'belt_promotion' && (
                <div className="space-y-2">
                  <Label htmlFor="condition_belt_rank">Belt Rank</Label>
                  <Select name="condition_belt_rank">
                    <SelectTrigger tabIndex={4}>
                      <SelectValue placeholder="Select belt rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {beltRanks.map((rank) => (
                        <SelectItem key={rank} value={rank}>
                          {rank.charAt(0).toUpperCase() + rank.slice(1)} Belt
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {selectedEventType === 'attendance_milestone' && (
                <div className="space-y-2">
                  <Label htmlFor="condition_attendance_count">Attendance Count</Label>
                  <Input
                    id="condition_attendance_count"
                    name="condition_attendance_count"
                    type="number"
                    placeholder="e.g., 10"
                    tabIndex={4}
                  />
                </div>
              )}
              
              {!['student_enrollment', 'belt_promotion', 'attendance_milestone'].includes(selectedEventType) && (
                <p className="text-sm text-muted-foreground">
                  No additional conditions available for this event type.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Validity Period Card */}
        <Card>
          <CardHeader>
            <CardTitle>Validity Period</CardTitle>
            <CardDescription>
              Define when this rule should be active
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid_from">Valid From</Label>
                <Input
                  id="valid_from"
                  name="valid_from"
                  type="datetime-local"
                  defaultValue={new Date().toISOString().slice(0, 16)}
                  tabIndex={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid_until">Valid Until</Label>
                <Input
                  id="valid_until"
                  name="valid_until"
                  type="datetime-local"
                  tabIndex={7}
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox id="is_active" name="is_active" defaultChecked tabIndex={8} />
              <Label htmlFor="is_active">Rule is active</Label>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link to="/admin/automatic-discounts">
            <Button variant="outline" tabIndex={9}>Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting} tabIndex={10}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Creating...' : 'Create Rule'}
          </Button>
        </div>
      </Form>
    </div>
  );
}