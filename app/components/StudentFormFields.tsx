import { useRef, useEffect } from "react";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { T_SHIRT_SIZE_OPTIONS } from "~/constants/tShirtSizes";
import type { Database } from "~/types/database.types";

type StudentRow = Database['public']['Tables']['students']['Row'];

interface StudentFormFieldsProps {
  mode: 'create' | 'edit';
  variant: 'admin' | 'family';
  student?: StudentRow; // For edit mode
  familyId?: string; // For pre-selected family
  familyName?: string; // For display
  families?: Array<{ id: string; name: string }>; // For family dropdown
  actionData?: {
    error?: string;
    fieldErrors?: Record<string, string>;
    formData?: Record<string, string>;
  };
  cancelPath?: string; // Optional cancel button destination
  onCancel?: () => void; // Alternative to cancelPath for programmatic cancel
  showFamilySelector?: boolean; // Override to show/hide family dropdown
  submitButtonText?: string; // Custom submit text
  submitButtonVariant?: 'default' | 'green' | 'blue';
  enableAutoFocus?: boolean; // Auto-focus first field
  isSubmitting?: boolean; // External submitting state
  className?: string;
}

export function StudentFormFields({
  mode,
  student,
  familyId,
  families,
  actionData,
  cancelPath,
  onCancel,
  showFamilySelector = false,
  submitButtonText,
  submitButtonVariant = 'default',
  enableAutoFocus = false,
  isSubmitting = false,
  className = '',
}: StudentFormFieldsProps) {
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus first field if enabled
  useEffect(() => {
    if (enableAutoFocus && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [enableAutoFocus]);

  // Helper to get form data from actionData
  const getFormData = (key: string): string => {
    if (mode === 'edit' && student) {
      // In edit mode, use student data as default
      const value = student[key as keyof StudentRow];
      return value?.toString() || '';
    }
    // In create mode or when actionData exists, use actionData
    return actionData?.formData?.[key] || '';
  };

  // Helper to get field error
  const getFieldError = (key: string): string | undefined => {
    return actionData?.fieldErrors?.[key];
  };

  // Determine if we should show the family selector
  const shouldShowFamilySelector = showFamilySelector || (families && families.length > 0);

  // Determine submit button styling
  const getSubmitButtonClass = () => {
    if (submitButtonVariant === 'green') {
      return 'bg-green-600 text-white hover:bg-green-700';
    }
    if (submitButtonVariant === 'blue') {
      return 'bg-blue-600 text-white hover:bg-blue-700';
    }
    return ''; // Default styling
  };

  // Get default submit text
  const defaultSubmitText = mode === 'edit' ? 'Save Changes' : 'Add Student';
  const finalSubmitText = submitButtonText || defaultSubmitText;

  return (
    <div className={className}>
      <AuthenticityTokenInput />
      {mode === 'edit' && <input type="hidden" name="intent" value="edit" />}

      {/* Family Selection (only for create mode with families) */}
      {mode === 'create' && shouldShowFamilySelector && families && (
        <div className="space-y-2 mb-6">
          <Label htmlFor="familyId">Family *</Label>
          <Select name="familyId" defaultValue={familyId || getFormData("familyId")} required>
            <SelectTrigger className="input-custom-styles" id="familyId">
              <SelectValue placeholder="Select a family" />
            </SelectTrigger>
            <SelectContent>
              {families.map((family) => (
                <SelectItem key={family.id} value={family.id}>
                  {family.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {getFieldError("familyId") && (
            <p className="text-sm text-destructive">{getFieldError("familyId")}</p>
          )}
        </div>
      )}

      {/* Hidden family ID for pre-selected family */}
      {mode === 'create' && familyId && !shouldShowFamilySelector && (
        <input type="hidden" name="familyId" value={familyId} />
      )}

      {/* Required Information Section */}
      <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b">
        Required Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* First Name */}
        <div className="space-y-1">
          <Label htmlFor="firstName">
            First Name<span className="text-destructive">*</span>
          </Label>
          <Input
            ref={firstInputRef}
            type="text"
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            required
            className="input-custom-styles"
            defaultValue={mode === 'edit' && student ? student.first_name : getFormData('firstName')}
            aria-invalid={!!getFieldError('firstName')}
            aria-describedby={getFieldError('firstName') ? "firstName-error" : undefined}
            tabIndex={1}
          />
          {getFieldError('firstName') && (
            <p id="firstName-error" className="text-sm text-destructive">
              {getFieldError('firstName')}
            </p>
          )}
        </div>

        {/* Last Name */}
        <div className="space-y-1">
          <Label htmlFor="lastName">
            Last Name<span className="text-destructive">*</span>
          </Label>
          <Input
            type="text"
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            required
            className="input-custom-styles"
            defaultValue={mode === 'edit' && student ? student.last_name : getFormData('lastName')}
            aria-invalid={!!getFieldError('lastName')}
            aria-describedby={getFieldError('lastName') ? "lastName-error" : undefined}
            tabIndex={2}
          />
          {getFieldError('lastName') && (
            <p id="lastName-error" className="text-sm text-destructive">
              {getFieldError('lastName')}
            </p>
          )}
        </div>

        {/* Birth Date */}
        <div className="space-y-1">
          <Label htmlFor="birthDate">
            Birth Date<span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            id="birthDate"
            name="birthDate"
            required
            className="input-custom-styles dark:[color-scheme:dark]"
            defaultValue={mode === 'edit' && student ? student.birth_date || '' : getFormData('birthDate')}
            aria-invalid={!!getFieldError('birthDate')}
            aria-describedby={getFieldError('birthDate') ? "birthDate-error" : undefined}
            tabIndex={3}
          />
          {getFieldError('birthDate') && (
            <p id="birthDate-error" className="text-sm text-destructive">
              {getFieldError('birthDate')}
            </p>
          )}
        </div>

        {/* Gender */}
        <div className="space-y-1">
          <Label htmlFor="gender">
            Gender<span className="text-destructive">*</span>
          </Label>
          <Select
            name="gender"
            required
            defaultValue={mode === 'edit' && student ? student.gender : getFormData('gender')}
          >
            <SelectTrigger
              id="gender"
              className="input-custom-styles"
              aria-invalid={!!getFieldError('gender')}
              aria-describedby={getFieldError('gender') ? "gender-error" : undefined}
              tabIndex={4}
            >
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
              <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
          {getFieldError('gender') && (
            <p id="gender-error" className="text-sm text-destructive">
              {getFieldError('gender')}
            </p>
          )}
        </div>

        {/* T-Shirt Size */}
        <div className="space-y-1">
          <Label htmlFor="tShirtSize">
            T-Shirt Size<span className="text-destructive">*</span>
          </Label>
          <Select
            name="tShirtSize"
            required
            defaultValue={mode === 'edit' && student ? student.t_shirt_size || undefined : getFormData('tShirtSize')}
          >
            <SelectTrigger
              id="tShirtSize"
              className="input-custom-styles"
              aria-invalid={!!getFieldError('tShirtSize')}
              aria-describedby={getFieldError('tShirtSize') ? "tShirtSize-error" : undefined}
              tabIndex={5}
            >
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {T_SHIRT_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {getFieldError('tShirtSize') && (
            <p id="tShirtSize-error" className="text-sm text-destructive">
              {getFieldError('tShirtSize')}
            </p>
          )}
        </div>

        {/* Height */}
        <div className="space-y-1">
          <Label htmlFor="height">Height (cm)</Label>
          <Input
            type="number"
            id="height"
            name="height"
            min="50"
            max="250"
            className="input-custom-styles"
            placeholder="e.g., 150"
            defaultValue={mode === 'edit' && student ? student.height || '' : getFormData('height')}
            aria-invalid={!!getFieldError('height')}
            aria-describedby={getFieldError('height') ? "height-error" : undefined}
            tabIndex={6}
          />
          {getFieldError('height') && (
            <p id="height-error" className="text-sm text-destructive">
              {getFieldError('height')}
            </p>
          )}
        </div>

        {/* School */}
        <div className="space-y-1">
          <Label htmlFor="school">
            School<span className="text-destructive">*</span>
          </Label>
          <Input
            type="text"
            id="school"
            name="school"
            required
            className="input-custom-styles"
            defaultValue={mode === 'edit' && student ? student.school || '' : getFormData('school')}
            aria-invalid={!!getFieldError('school')}
            aria-describedby={getFieldError('school') ? "school-error" : undefined}
            tabIndex={7}
          />
          {getFieldError('school') && (
            <p id="school-error" className="text-sm text-destructive">
              {getFieldError('school')}
            </p>
          )}
        </div>

        {/* Grade Level */}
        <div className="space-y-1">
          <Label htmlFor="gradeLevel">
            Grade Level<span className="text-destructive">*</span>
          </Label>
          <Select
            name="gradeLevel"
            required
            defaultValue={mode === 'edit' && student ? student.grade_level || undefined : getFormData('gradeLevel')}
          >
            <SelectTrigger
              id="gradeLevel"
              className="input-custom-styles"
              aria-invalid={!!getFieldError('gradeLevel')}
              aria-describedby={getFieldError('gradeLevel') ? "gradeLevel-error" : undefined}
              tabIndex={8}
            >
              <SelectValue placeholder="Select grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pre-K">Pre-Kindergarten</SelectItem>
              <SelectItem value="K">Kindergarten</SelectItem>
              <SelectItem value="1">1st Grade</SelectItem>
              <SelectItem value="2">2nd Grade</SelectItem>
              <SelectItem value="3">3rd Grade</SelectItem>
              <SelectItem value="4">4th Grade</SelectItem>
              <SelectItem value="5">5th Grade</SelectItem>
              <SelectItem value="6">6th Grade</SelectItem>
              <SelectItem value="7">7th Grade</SelectItem>
              <SelectItem value="8">8th Grade</SelectItem>
              <SelectItem value="9">9th Grade</SelectItem>
              <SelectItem value="10">10th Grade</SelectItem>
              <SelectItem value="11">11th Grade</SelectItem>
              <SelectItem value="12">12th Grade</SelectItem>
              <SelectItem value="Post-Secondary">Post-Secondary</SelectItem>
              <SelectItem value="N/A">Not Applicable</SelectItem>
            </SelectContent>
          </Select>
          {getFieldError('gradeLevel') && (
            <p id="gradeLevel-error" className="text-sm text-destructive">
              {getFieldError('gradeLevel')}
            </p>
          )}
        </div>
      </div>

      {/* Optional Information Section */}
      <h3 className="text-lg font-semibold text-foreground mt-6 mb-4 pb-2 border-b">
        Optional Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Student Email */}
        <div className="space-y-1">
          <Label htmlFor="email">Student Email</Label>
          <Input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            className="input-custom-styles"
            defaultValue={mode === 'edit' && student ? student.email || '' : getFormData('email')}
            tabIndex={9}
          />
        </div>

        {/* Student Cell Phone */}
        <div className="space-y-1">
          <Label htmlFor="cellPhone">Student Cell #</Label>
          <Input
            type="tel"
            id="cellPhone"
            name="cellPhone"
            autoComplete="mobile tel"
            className="input-custom-styles"
            defaultValue={mode === 'edit' && student ? student.cell_phone || '' : getFormData('cellPhone')}
            tabIndex={10}
          />
        </div>

        {/* Special Needs */}
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="specialNeeds">Special Needs (Leave blank if NONE)</Label>
          <Input
            type="text"
            id="specialNeeds"
            name="specialNeeds"
            className="input-custom-styles"
            defaultValue={mode === 'edit' && student ? student.special_needs || '' : getFormData('specialNeeds')}
            tabIndex={11}
          />
        </div>

        {/* Allergies */}
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="allergies">Allergies (Leave blank if NONE)</Label>
          <Textarea
            id="allergies"
            name="allergies"
            rows={3}
            className="input-custom-styles"
            defaultValue={mode === 'edit' && student ? student.allergies || '' : getFormData('allergies')}
            tabIndex={12}
          />
        </div>

        {/* Medications */}
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="medications">Medications (Leave blank if NONE)</Label>
          <Textarea
            id="medications"
            name="medications"
            rows={3}
            className="input-custom-styles"
            defaultValue={mode === 'edit' && student ? student.medications || '' : getFormData('medications')}
            tabIndex={13}
          />
        </div>

        {/* Immunizations Up To Date */}
        <div className="space-y-1">
          <Label htmlFor="immunizationsUpToDate">Immunizations Up To Date?</Label>
          <Select
            name="immunizationsUpToDate"
            defaultValue={
              mode === 'edit' && student
                ? student.immunizations_up_to_date || undefined
                : getFormData('immunizationsUpToDate')
            }
          >
            <SelectTrigger id="immunizationsUpToDate" className="input-custom-styles" tabIndex={14}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
              <SelectItem value="Unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Immunization Notes */}
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="immunizationNotes">Immunization Notes</Label>
          <Textarea
            id="immunizationNotes"
            name="immunizationNotes"
            rows={3}
            className="input-custom-styles"
            defaultValue={mode === 'edit' && student ? student.immunization_notes || '' : getFormData('immunizationNotes')}
            tabIndex={15}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 mt-6">
        {(cancelPath || onCancel) && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            tabIndex={16}
            {...(cancelPath ? { asChild: true } : {})}
          >
            {cancelPath ? (
              <a href={cancelPath}>Cancel</a>
            ) : (
              'Cancel'
            )}
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className={getSubmitButtonClass()}
          tabIndex={17}
        >
          {isSubmitting ? `${mode === 'edit' ? 'Saving' : 'Adding'}...` : finalSubmitText}
        </Button>
      </div>
    </div>
  );
}
