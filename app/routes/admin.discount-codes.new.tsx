import { type ActionFunctionArgs, json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { createClient } from '@supabase/supabase-js';
import { DiscountService } from "~/services/discount.server";
import { getDiscountTemplateById } from "~/services/discount-template.server";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import type { PaymentTypeEnum, DiscountTemplate } from "~/types/discount";
import type { Database } from "~/types/database.types";
import { FileText, X } from "lucide-react";

type FamilyInfo = {
  id: string;
  name: string;
  email: string;
};

type StudentInfo = {
  id: string;
  first_name: string;
  last_name: string;
  family_id: string;
};

type ActionData = {
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: { [key: string]: string };
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);
  
  // Check if user is admin
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  // Check admin status
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }

  // Use service role client for admin data access (bypass RLS)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Response("Server configuration error.", {status: 500});
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);
  
  // Check for template parameter
  const url = new URL(request.url);
  const templateId = url.searchParams.get('template');
  let template: DiscountTemplate | null = null;
  
  if (templateId) {
    try {
      template = await getDiscountTemplateById(templateId);
    } catch (error) {
      console.error('Error fetching template:', error);
      // Continue without template if there's an error
    }
  }
  
  // Fetch families and students for selection using service role
  const [familiesResult, studentsResult] = await Promise.all([
    supabaseAdmin.from('families').select('id, name, email').order('name'),
    supabaseAdmin.from('students').select('id, first_name, last_name, family_id').order('first_name')
  ]);

  if (familiesResult.error) {
    throw new Error('Failed to fetch families');
  }
  
  if (studentsResult.error) {
    throw new Error('Failed to fetch students');
  }

  return json({
    families: familiesResult.data as FamilyInfo[],
    students: studentsResult.data as StudentInfo[],
    template
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);
  
  // Get the current user to set as created_by
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();

  // Extract form data
  const code = formData.get('code') as string;
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const discountType = formData.get('discountType') as string;
  const value = parseFloat(formData.get('value') as string);
  const usageType = formData.get('usageType') as string;
  const maxUses = formData.get('maxUses') ? parseInt(formData.get('maxUses') as string) : null;
  const applicableTo = formData.getAll('applicableTo') as string[];
  const scope = formData.get('scope') as string;
  const familyId = formData.get('familyId') as string;
  const studentId = formData.get('studentId') as string;
  const validFrom = formData.get('validFrom') as string;
  const validUntil = formData.get('validUntil') as string || null;

  // Basic validation
  const fieldErrors: { [key: string]: string } = {};
  if (!code) fieldErrors.code = 'Code is required';
  if (!name) fieldErrors.name = 'Name is required';
  if (!discountType) fieldErrors.discountType = 'Discount type is required';
  if (!value || isNaN(value)) fieldErrors.value = 'Valid discount value is required';
  if (!usageType) fieldErrors.usageType = 'Usage type is required';
  if (!applicableTo || applicableTo.length === 0) fieldErrors.applicableTo = 'At least one payment type must be selected';
  if (!scope) fieldErrors.scope = 'Scope is required';
  if (!validFrom) fieldErrors.validFrom = 'Valid from date is required';
  
  // Validate association requirements
  if (scope === 'per_family' && !familyId) {
    fieldErrors.familyId = 'Family selection is required for per-family discount codes';
  }
  if (scope === 'per_student' && !studentId) {
    fieldErrors.studentId = 'Student selection is required for per-student discount codes';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return json({ error: 'Please correct the errors below.', fieldErrors }, { status: 400 });
  }

  try {
    // Create discount code using the service
    await DiscountService.createDiscountCode({
      code,
      name,
      description: description || undefined,
      discount_type: discountType as 'fixed_amount' | 'percentage',
      discount_value: value,
      usage_type: usageType as 'one_time' | 'ongoing',
      max_uses: maxUses || undefined,
      applicable_to: applicableTo as PaymentTypeEnum[],
      scope: scope as 'per_student' | 'per_family',
      family_id: scope === 'per_family' ? familyId : undefined,
      student_id: scope === 'per_student' ? studentId : undefined,
      valid_from: validFrom || undefined,
      valid_until: validUntil || undefined
    }, user.id); // Pass user ID as created_by

    return redirect('/admin/discount-codes');
  } catch (error) {
    console.error('Error creating discount code:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Failed to create discount code. Please try again.' 
    }, { status: 500 });
  }
}

export default function AdminNewDiscountCodePage() {
  const { families, students, template } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  // // const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state === 'submitting';

  const [code, setCode] = useState('');
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [discountType, setDiscountType] = useState(template?.discount_type || '');
  const [discountValue, setDiscountValue] = useState(template?.discount_value?.toString() || '');
  const [selectedScope, setSelectedScope] = useState(template?.scope || '');
  const [selectedFamily, setSelectedFamily] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [familyStudents, setFamilyStudents] = useState<StudentInfo[]>([]);
  const [usageType, setUsageType] = useState(template?.usage_type || '');
  const [maxUses, setMaxUses] = useState(template?.max_uses?.toString() || '');
  const [applicableTo, setApplicableTo] = useState<string[]>(template?.applicable_to || []);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [usingTemplate, setUsingTemplate] = useState(!!template);
  
  // Set default valid from date to current date and time
  const getCurrentDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  const [validFrom, setValidFrom] = useState(getCurrentDateTime());
  const [validUntil, setValidUntil] = useState('');

  // Update family students when family selection changes
  useEffect(() => {
    if (selectedFamily) {
      const filteredStudents = students.filter(student => student.family_id === selectedFamily);
      setFamilyStudents(filteredStudents);
      setSelectedStudent(''); // Reset student selection
    } else {
      setFamilyStudents([]);
      setSelectedStudent('');
    }
  }, [selectedFamily, students]);

  // Update max uses when usage type changes
  useEffect(() => {
    if (usageType === 'one_time') {
      setMaxUses('1');
    }
  }, [usageType]);

  const generateCode = async () => {
    setIsGeneratingCode(true);
    try {
      const response = await fetch('/api/generate-unique-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setCode(data.code);
      } else {
        // Fallback to client-side generation if API fails
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = 'DISC';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setCode(result);
      }
    } catch (error) {
      // Fallback to client-side generation if API fails
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = 'DISC';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setCode(result);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const clearTemplate = () => {
    setUsingTemplate(false);
    setName('');
    setDescription('');
    setDiscountType('');
    setDiscountValue('');
    setUsageType('');
    setMaxUses('');
    setSelectedScope('');
    setApplicableTo([]);
    // Navigate to the same page without template parameter
    window.history.replaceState({}, '', '/admin/discount-codes/new');
  };

  const handleApplicableToChange = (value: string, checked: boolean) => {
    if (checked) {
      setApplicableTo(prev => [...prev, value]);
    } else {
      setApplicableTo(prev => prev.filter(item => item !== value));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <AppBreadcrumb 
        items={breadcrumbPatterns.adminDiscountCodeNew()} 
        className="mb-6"
      />
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Create New Discount Code</h1>
        <p className="text-muted-foreground">Create a new discount code for families and students.</p>
        
        {!usingTemplate && (
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-900 dark:text-amber-100">Want to use a template?</span>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
              Save time by starting with a pre-configured discount template. Templates include all the common settings like discount type, value, and applicable payment types.
            </p>
            <Button asChild variant="outline" size="sm" className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20">
              <Link to="/admin/discount-templates">
                <FileText className="h-4 w-4 mr-2" />
                Browse Templates
              </Link>
            </Button>
          </div>
        )}
        
        {usingTemplate && template && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-900">Using Template: {template.name}</span>
                <Badge variant="secondary">Template</Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearTemplate}
                className="text-blue-600 hover:text-blue-800"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Template
              </Button>
            </div>
            {template.description && (
              <p className="text-sm text-blue-700 mt-2">{template.description}</p>
            )}
          </div>
        )}
      </div>

      {actionData?.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}

      <Form method="post">
        {/* Basic Information Section */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Basic Information</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="code">Code <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter discount code"
                  tabIndex={1}
                  required
                />
                <Button type="button" onClick={generateCode} variant="outline" disabled={isGeneratingCode} tabIndex={2}>
                  {isGeneratingCode ? 'Generating...' : 'Generate'}
                </Button>
              </div>
              {actionData?.fieldErrors?.code && (
                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.code}</p>
              )}
            </div>

            <div>
              <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter discount name"
                tabIndex={3}
                required
              />
              {actionData?.fieldErrors?.name && (
                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description"
                tabIndex={4}
              />
            </div>
          </div>
        </section>

        {/* Discount Configuration Section */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Discount Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discountType">Discount Type <span className="text-red-500">*</span></Label>
              <Select name="discountType" value={discountType} onValueChange={setDiscountType} required>
                <SelectTrigger tabIndex={5}>
                  <SelectValue placeholder="Select discount type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
              {actionData?.fieldErrors?.discountType && (
                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.discountType}</p>
              )}
            </div>

            <div>
              <Label htmlFor="value">Value <span className="text-red-500">*</span></Label>
              <Input
                id="value"
                name="value"
                type="number"
                step="0.0001"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="Enter discount value (e.g., 82.6447)"
                tabIndex={6}
                required
              />
              {actionData?.fieldErrors?.value && (
                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.value}</p>
              )}
            </div>

            <div>
              <Label htmlFor="usageType">Usage Type <span className="text-red-500">*</span></Label>
              <Select name="usageType" value={usageType} onValueChange={setUsageType} required>
                <SelectTrigger tabIndex={7}>
                  <SelectValue placeholder="Select usage type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One Time</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                </SelectContent>
              </Select>
              {actionData?.fieldErrors?.usageType && (
                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.usageType}</p>
              )}
            </div>

            <div>
              <Label htmlFor="maxUses">Max Uses</Label>
              <Input
                id="maxUses"
                name="maxUses"
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Enter max uses (leave empty for unlimited)"
                tabIndex={8}
              />
            </div>
          </div>
        </section>

        {/* Applicability Section */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Applicability</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Applicable To <span className="text-red-500">*</span></Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="monthly_group"
                    name="applicableTo"
                    value="monthly_group"
                    checked={applicableTo.includes('monthly_group')}
                    onChange={(e) => handleApplicableToChange('monthly_group', e.target.checked)}
                    className="rounded border-gray-300"
                    tabIndex={9}
                  />
                  <Label htmlFor="monthly_group" className="text-sm font-normal">Monthly Group Training</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="yearly_group"
                    name="applicableTo"
                    value="yearly_group"
                    checked={applicableTo.includes('yearly_group')}
                    onChange={(e) => handleApplicableToChange('yearly_group', e.target.checked)}
                    className="rounded border-gray-300"
                    tabIndex={10}
                  />
                  <Label htmlFor="yearly_group" className="text-sm font-normal">Yearly Group Training</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="individual_session"
                    name="applicableTo"
                    value="individual_session"
                    checked={applicableTo.includes('individual_session')}
                    onChange={(e) => handleApplicableToChange('individual_session', e.target.checked)}
                    className="rounded border-gray-300"
                    tabIndex={11}
                  />
                  <Label htmlFor="individual_session" className="text-sm font-normal">Individual Session</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="store_purchase"
                    name="applicableTo"
                    value="store_purchase"
                    checked={applicableTo.includes('store_purchase')}
                    onChange={(e) => handleApplicableToChange('store_purchase', e.target.checked)}
                    className="rounded border-gray-300"
                    tabIndex={12}
                  />
                  <Label htmlFor="store_purchase" className="text-sm font-normal">Store Purchase</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="other"
                    name="applicableTo"
                    value="other"
                    checked={applicableTo.includes('other')}
                    onChange={(e) => handleApplicableToChange('other', e.target.checked)}
                    className="rounded border-gray-300"
                    tabIndex={13}
                  />
                  <Label htmlFor="other" className="text-sm font-normal">Other</Label>
                </div>
              </div>
              {actionData?.fieldErrors?.applicableTo && (
                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.applicableTo}</p>
              )}
            </div>

            <div>
              <Label htmlFor="scope">Scope <span className="text-red-500">*</span></Label>
              <Select name="scope" value={selectedScope} onValueChange={setSelectedScope} required>
                <SelectTrigger tabIndex={14}>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_family">Per Family</SelectItem>
                  <SelectItem value="per_student">Per Student</SelectItem>
                </SelectContent>
              </Select>
              {actionData?.fieldErrors?.scope && (
                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.scope}</p>
              )}
            </div>
          </div>
        </section>

        {/* Family and Student Selection Section */}
        {(selectedScope === 'per_family' || selectedScope === 'per_student') && (
          <section className="mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Target Selection</h2>
            <p className="text-sm text-muted-foreground mb-4">Select the specific family or student this discount applies to.</p>
            
            <div className="mb-4">
              <Label htmlFor="familyId">Family Selection <span className="text-red-500">*</span></Label>
              <Select name="familyId" value={selectedFamily} onValueChange={setSelectedFamily} required>
                <SelectTrigger tabIndex={15}>
                  <SelectValue placeholder="Select family" />
                </SelectTrigger>
                <SelectContent>
                  {families.map((family) => (
                    <SelectItem key={family.id} value={family.id}>
                      {family.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {actionData?.fieldErrors?.familyId && (
                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.familyId}</p>
              )}
            </div>

            {selectedScope === 'per_student' && selectedFamily && familyStudents.length > 0 && (
              <div className="mb-4">
                <Label htmlFor="studentId">Student Selection <span className="text-red-500">*</span></Label>
                <Select name="studentId" value={selectedStudent} onValueChange={setSelectedStudent} required>
                  <SelectTrigger tabIndex={16}>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {familyStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.first_name} {student.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {actionData?.fieldErrors?.studentId && (
                  <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.studentId}</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Validity Period Section */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">Validity Period</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="validFrom">Valid From <span className="text-red-500">*</span></Label>
              <Input
                id="validFrom"
                name="validFrom"
                type="datetime-local"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                tabIndex={17}
                required
              />
              {actionData?.fieldErrors?.validFrom && (
                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.validFrom}</p>
              )}
            </div>

            <div>
              <Label htmlFor="validUntil">Valid Until</Label>
              <Input
                id="validUntil"
                name="validUntil"
                type="datetime-local"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                tabIndex={18}
              />
            </div>
          </div>
        </section>



        {/* Submit Button */}
        <div className="flex justify-end gap-4 pt-4 border-t border-border">
          <Button type="button" variant="outline" asChild tabIndex={20}>
            <Link to="/admin/discount-codes">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting} tabIndex={19}>
            {isSubmitting ? 'Creating...' : 'Create Discount Code'}
          </Button>
        </div>
      </Form>
    </div>
  );
}

// Error Boundary
export function ErrorBoundary() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link to="/admin/discount-codes" className="text-blue-600 hover:underline mb-4 inline-block">
        &larr; Back to Discount Codes
      </Link>
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>There was an error loading or processing the new discount code form.</AlertDescription>
      </Alert>
    </div>
  );
}