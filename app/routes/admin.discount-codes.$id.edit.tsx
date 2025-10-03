import { type ActionFunctionArgs, json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { DiscountService } from "~/services/discount.server";
import type { PaymentTypeEnum } from "~/types/discount";
import { AppBreadcrumb, breadcrumbPatterns } from '~/components/AppBreadcrumb';
import { fromDollars } from "~/utils/money";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";

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

export async function loader({ params }: LoaderFunctionArgs) {
  // Auth is handled by parent admin.tsx layout
  const discountId = params.id;

  if (!discountId) {
    throw new Response('Discount ID is required', { status: 400 });
  }

  // Use service role client for admin data access (bypass RLS)
  const supabaseAdmin = getSupabaseAdminClient();
  
  // Fetch the discount code and related data
  const [discountResult, familiesResult, studentsResult] = await Promise.all([
    supabaseAdmin.from('discount_codes').select('*').eq('id', discountId).single(),
    supabaseAdmin.from('families').select('id, name, email').order('name'),
    supabaseAdmin.from('students').select('id, first_name, last_name, family_id').order('first_name')
  ]);

  if (discountResult.error) {
    throw new Response('Discount code not found', { status: 404 });
  }
  
  if (familiesResult.error) {
    throw new Error('Failed to fetch families');
  }
  
  if (studentsResult.error) {
    throw new Error('Failed to fetch students');
  }

  return json({
    discountCode: discountResult.data,
    families: familiesResult.data as FamilyInfo[],
    students: studentsResult.data as StudentInfo[]
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await csrf.validate(request);
  const formData = await request.formData();
  const discountId = params.id;
  
  if (!discountId) {
    throw new Response('Discount ID is required', { status: 400 });
  }

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
    // Update discount code using the service
    await DiscountService.updateDiscountCode(discountId, {
      code,
      name,
      description: description || undefined,
      discount_type: discountType as 'fixed_amount' | 'percentage',
      discount_value: (discountType === 'fixed_amount') ? fromDollars(value) : value,
      usage_type: usageType as 'one_time' | 'ongoing',
      max_uses: maxUses || undefined,
      applicable_to: applicableTo as PaymentTypeEnum[],
      scope: scope as 'per_student' | 'per_family',
      family_id: scope === 'per_family' ? familyId : undefined,
      student_id: scope === 'per_student' ? studentId : undefined,
      valid_from: validFrom || undefined,
      valid_until: validUntil || undefined
    });

    return redirect('/admin/discount-codes');
  } catch (error) {
    console.error('Error updating discount code:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Failed to update discount code. Please try again.' 
    }, { status: 500 });
  }
}

export default function AdminEditDiscountCodePage() {
  const { discountCode, families, students } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [code, setCode] = useState(discountCode.code);
  const [selectedScope, setSelectedScope] = useState(discountCode.scope);
  const [selectedFamily, setSelectedFamily] = useState(discountCode.family_id || '');
  const [selectedStudent, setSelectedStudent] = useState(discountCode.student_id || '');
  const [familyStudents, setFamilyStudents] = useState<StudentInfo[]>([]);

  // Update family students when family selection changes
  useEffect(() => {
    if (selectedFamily) {
      const filteredStudents = students.filter(student => student.family_id === selectedFamily);
      setFamilyStudents(filteredStudents);
      if (discountCode.scope !== 'per_student') {
        setSelectedStudent(''); // Reset student selection only if not editing a per-student discount
      }
    } else {
      setFamilyStudents([]);
      setSelectedStudent('');
    }
  }, [selectedFamily, students, discountCode.scope]);

  // Initialize family students on load
  useEffect(() => {
    if (discountCode.family_id) {
      const filteredStudents = students.filter(student => student.family_id === discountCode.family_id);
      setFamilyStudents(filteredStudents);
    }
  }, [discountCode.family_id, students]);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'DISC';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
  };

  // Format datetime for input
  const formatDateTimeLocal = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <AppBreadcrumb items={breadcrumbPatterns.adminDiscountCodeEdit(discountCode.name)} 
      className="mb-6" />
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Edit Discount Code</h1>
        <p className="text-muted-foreground">Update the discount code details.</p>
      </div>

      {actionData?.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}

      <Form method="post">
        <AuthenticityTokenInput />
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
                  required
                  tabIndex={1}
                />
                <Button type="button" onClick={generateCode} variant="outline" tabIndex={2}>
                  Generate
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
                defaultValue={discountCode.name}
                placeholder="Enter discount name"
                required
                tabIndex={3}
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
                defaultValue={discountCode.description || ''}
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
              <Select name="discountType" defaultValue={discountCode.discount_type} required>
                <SelectTrigger className="input-custom-styles" tabIndex={5}>
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
                defaultValue={discountCode.discount_value}
                placeholder="Enter discount value (e.g., 82.6447)"
                required
                tabIndex={6}
              />
              {actionData?.fieldErrors?.value && (
                <p className="text-red-500 text-sm mt-1">{actionData.fieldErrors.value}</p>
              )}
            </div>

            <div>
              <Label htmlFor="usageType">Usage Type <span className="text-red-500">*</span></Label>
              <Select name="usageType" defaultValue={discountCode.usage_type} required>
                <SelectTrigger className="input-custom-styles" tabIndex={7}>
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
                defaultValue={discountCode.max_uses || ''}
                placeholder="Enter max uses (optional)"
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
                    defaultChecked={discountCode.applicable_to.includes('monthly_group' as PaymentTypeEnum)}
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
                    defaultChecked={discountCode.applicable_to.includes('yearly_group' as PaymentTypeEnum)}
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
                    defaultChecked={discountCode.applicable_to.includes('individual_session' as PaymentTypeEnum)}
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
                    defaultChecked={discountCode.applicable_to.includes('store_purchase' as PaymentTypeEnum)}
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
                    defaultChecked={discountCode.applicable_to.includes('other' as PaymentTypeEnum)}
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
              <Select name="scope" value={selectedScope} onValueChange={(value) => setSelectedScope(value as 'per_student' | 'per_family')} required>
                <SelectTrigger className="input-custom-styles" tabIndex={14}>
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
                <SelectTrigger className="input-custom-styles" tabIndex={15}>
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
                  <SelectTrigger className="input-custom-styles" tabIndex={16}>
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
                defaultValue={formatDateTimeLocal(discountCode.valid_from)}
                required
                tabIndex={17}
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
                defaultValue={formatDateTimeLocal(discountCode.valid_until)}
                tabIndex={18}
              />
            </div>
          </div>
        </section>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 pt-4 border-t border-border">
          <Button type="button" variant="outline" asChild tabIndex={19}>
            <Link to="/admin/discount-codes">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting} tabIndex={20}>
            {isSubmitting ? 'Updating...' : 'Update Discount Code'}
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
        <AlertDescription>There was an error loading or processing the discount code edit form.</AlertDescription>
      </Alert>
    </div>
  );
}
