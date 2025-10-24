import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { forwardRef } from "react";

type FamilyBasicsSectionProps = {
  fieldErrors?: {
    familyName?: string;
  };
  tabIndex?: number;
  className?: string;
};

export const FamilyBasicsSection = forwardRef<HTMLInputElement, FamilyBasicsSectionProps>(
  ({ fieldErrors, tabIndex = 3, className = "" }, ref) => {
    return (
      <section className={className}>
        <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
          Family Information
        </h2>
        <div>
          <Label htmlFor="familyName">
            Family Last Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="familyName"
            name="familyName"
            autoComplete="family-name"
            className="input-custom-styles"
            required
            tabIndex={tabIndex}
            ref={ref}
          />
          {fieldErrors?.familyName && (
            <p className="text-red-500 text-sm mt-1">{fieldErrors.familyName}</p>
          )}
        </div>
      </section>
    );
  }
);

FamilyBasicsSection.displayName = "FamilyBasicsSection";
