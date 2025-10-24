import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

type GuardianInfoSectionProps = {
  fieldErrors?: {
    contact1FirstName?: string;
    contact1LastName?: string;
    contact1Type?: string;
    contact1Email?: string;
    contact1CellPhone?: string;
    contact1HomePhone?: string;
    familyEmail?: string;
    guardian1FirstName?: string;
    guardian1LastName?: string;
    guardian1Relationship?: string;
    guardian1Email?: string;
    guardian1CellPhone?: string;
    guardian1HomePhone?: string;
  };
  showEmailConfirmation?: boolean;
  showSubheadings?: boolean;
  fieldPrefix?: 'contact1' | 'guardian1';
  startTabIndex?: number;
  className?: string;
};

export function GuardianInfoSection({
  fieldErrors,
  showEmailConfirmation = false,
  showSubheadings = false,
  fieldPrefix = 'guardian1',
  startTabIndex = 11,
  className = ""
}: GuardianInfoSectionProps) {
  const firstNameField = `${fieldPrefix}FirstName`;
  const lastNameField = `${fieldPrefix}LastName`;
  const relationshipField = fieldPrefix === 'guardian1' ? 'guardian1Relationship' : 'contact1Type';
  const homePhoneField = `${fieldPrefix}HomePhone`;
  const cellPhoneField = `${fieldPrefix}CellPhone`;
  const emailField = `${fieldPrefix}Email`;

  return (
    <section className={className}>
      <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
        Primary Guardian
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        This is the main contact for the family. You can add additional guardians later via the family portal.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <Label htmlFor={firstNameField}>
            First Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id={firstNameField}
            name={firstNameField}
            autoComplete="given-name"
            className={`input-custom-styles ${fieldErrors?.[firstNameField as keyof typeof fieldErrors] ? 'border-red-500' : ''}`}
            required
            tabIndex={startTabIndex}
          />
          {fieldErrors?.[firstNameField as keyof typeof fieldErrors] && (
            <p className="text-red-500 text-sm mt-1">
              {fieldErrors[firstNameField as keyof typeof fieldErrors]}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor={lastNameField}>
            Last Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id={lastNameField}
            name={lastNameField}
            autoComplete="family-name"
            className={`input-custom-styles ${fieldErrors?.[lastNameField as keyof typeof fieldErrors] ? 'border-red-500' : ''}`}
            required
            tabIndex={startTabIndex + 1}
          />
          {fieldErrors?.[lastNameField as keyof typeof fieldErrors] && (
            <p className="text-red-500 text-sm mt-1">
              {fieldErrors[lastNameField as keyof typeof fieldErrors]}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor={relationshipField}>
            Type <span className="text-red-500">*</span>
          </Label>
          <Select name={relationshipField} required>
            <SelectTrigger
              id={relationshipField}
              className="input-custom-styles"
              tabIndex={startTabIndex + 2}
            >
              <SelectValue placeholder="Select relationship" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Mother">Mother</SelectItem>
              <SelectItem value="Father">Father</SelectItem>
              <SelectItem value="Guardian">Guardian</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {fieldErrors?.[relationshipField as keyof typeof fieldErrors] && (
            <p className="text-red-500 text-sm mt-1">
              {fieldErrors[relationshipField as keyof typeof fieldErrors]}
            </p>
          )}
        </div>
      </div>

      {showSubheadings && (
        <h3 className="text-lg font-medium text-foreground mt-6 mb-3">
          How Can We Contact Them?
        </h3>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${showSubheadings ? '' : 'mt-6'}`}>
        <div>
          <Label htmlFor={homePhoneField}>Home Phone</Label>
          <Input
            id={homePhoneField}
            name={homePhoneField}
            type="tel"
            autoComplete="home tel"
            className={`input-custom-styles ${fieldErrors?.[homePhoneField as keyof typeof fieldErrors] ? 'border-red-500' : ''}`}
            tabIndex={startTabIndex + 3}
          />
          {fieldErrors?.[homePhoneField as keyof typeof fieldErrors] && (
            <p className="text-red-500 text-sm mt-1">
              {fieldErrors[homePhoneField as keyof typeof fieldErrors]}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor={cellPhoneField}>
            Cell Phone <span className="text-red-500">*</span>
          </Label>
          <Input
            id={cellPhoneField}
            name={cellPhoneField}
            type="tel"
            autoComplete="mobile tel"
            className={`input-custom-styles ${fieldErrors?.[cellPhoneField as keyof typeof fieldErrors] ? 'border-red-500' : ''}`}
            required
            tabIndex={startTabIndex + 4}
          />
          {fieldErrors?.[cellPhoneField as keyof typeof fieldErrors] && (
            <p className="text-red-500 text-sm mt-1">
              {fieldErrors[cellPhoneField as keyof typeof fieldErrors]}
            </p>
          )}
        </div>
      </div>

      {showSubheadings && (
        <h3 className="text-lg font-medium text-foreground mt-6 mb-3">
          Portal Access (Email is Login)
        </h3>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-${showEmailConfirmation ? '2' : '1'} gap-6 ${showSubheadings ? '' : 'mt-6'}`}>
        <div>
          <Label htmlFor={emailField}>
            Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id={emailField}
            name={emailField}
            type="email"
            autoComplete="email"
            className={`input-custom-styles ${fieldErrors?.[emailField as keyof typeof fieldErrors] ? 'border-red-500' : ''}`}
            required
            tabIndex={startTabIndex + 5}
          />
          {fieldErrors?.[emailField as keyof typeof fieldErrors] && (
            <p className="text-red-500 text-sm mt-1">
              {fieldErrors[emailField as keyof typeof fieldErrors]}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">(Emails are kept confidential)</p>
        </div>

        {showEmailConfirmation && (
          <div>
            <Label htmlFor="familyEmail">
              Confirm Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="familyEmail"
              name="familyEmail"
              type="email"
              className={`input-custom-styles ${fieldErrors?.familyEmail ? 'border-red-500' : ''}`}
              required
              tabIndex={startTabIndex + 6}
            />
            {fieldErrors?.familyEmail && (
              <p className="text-red-500 text-sm mt-1">{fieldErrors.familyEmail}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
