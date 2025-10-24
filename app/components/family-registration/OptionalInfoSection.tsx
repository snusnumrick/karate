import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Info } from "lucide-react";

type OptionalInfoSectionProps = {
  fieldErrors?: {
    referralSource?: string;
    referralName?: string;
    emergencyContact?: string;
    healthInfo?: string;
    healthNumber?: string;
    contact1Type?: string;
    contact1HomePhone?: string;
  };
  isCollapsible?: boolean;
  showReferral?: boolean;
  showGuardianInfo?: boolean;
  showEmergencyContact?: boolean;
  showHealthInfo?: boolean;
  startTabIndex?: number;
  className?: string;
};

export function OptionalInfoSection({
  fieldErrors,
  isCollapsible = false,
  showReferral = true,
  showGuardianInfo = false,
  showEmergencyContact = true,
  showHealthInfo = true,
  startTabIndex = 1,
  className = ""
}: OptionalInfoSectionProps) {
  const referralContent = showReferral && (
    <div className="space-y-4">
      <h3 className="text-base font-medium mb-3">Referral Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="referralSource">
            How did you hear about us?
          </Label>
          <Select name="referralSource">
            <SelectTrigger id="referralSource" className="input-custom-styles" tabIndex={startTabIndex}>
              <SelectValue placeholder="Select one" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friend">Friend</SelectItem>
              <SelectItem value="social">Social Media</SelectItem>
              <SelectItem value="search">Search Engine</SelectItem>
              <SelectItem value="flyer">Flyer</SelectItem>
              <SelectItem value="event">Event</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {fieldErrors?.referralSource && (
            <p className="text-red-500 text-sm mt-1">{fieldErrors.referralSource}</p>
          )}
        </div>

        <div>
          <Label htmlFor="referralName">
            Referral Name (if applicable)
          </Label>
          <Input
            id="referralName"
            name="referralName"
            className="input-custom-styles"
            tabIndex={startTabIndex + 1}
          />
          {fieldErrors?.referralName && (
            <p className="text-red-500 text-sm mt-1">{fieldErrors.referralName}</p>
          )}
        </div>
      </div>
    </div>
  );

  const guardianInfoContent = showGuardianInfo && (
    <div className="space-y-4">
      <h3 className="text-base font-medium mb-3">Guardian Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="contact1Type">
            Relationship
          </Label>
          <Select name="contact1Type">
            <SelectTrigger id="contact1Type" className="input-custom-styles" tabIndex={startTabIndex + 2}>
              <SelectValue placeholder="Select relationship" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Mother">Mother</SelectItem>
              <SelectItem value="Father">Father</SelectItem>
              <SelectItem value="Guardian">Guardian</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {fieldErrors?.contact1Type && (
            <p className="text-red-500 text-sm mt-1">{fieldErrors.contact1Type}</p>
          )}
        </div>

        <div>
          <Label htmlFor="contact1HomePhone">
            Home Phone (optional)
          </Label>
          <Input
            id="contact1HomePhone"
            name="contact1HomePhone"
            type="tel"
            autoComplete="home tel"
            className="input-custom-styles"
            tabIndex={startTabIndex + 3}
          />
          {fieldErrors?.contact1HomePhone && (
            <p className="text-red-500 text-sm mt-1">{fieldErrors.contact1HomePhone}</p>
          )}
        </div>
      </div>
    </div>
  );

  const additionalContent = (showEmergencyContact || showHealthInfo) && (
    <div className="space-y-4">
      {!isCollapsible && <h3 className="text-base font-medium mb-3">Additional Details</h3>}

      {showEmergencyContact && (
        <div>
          <Label htmlFor="emergencyContact">
            Emergency Contact Info
          </Label>
          <Textarea
            id="emergencyContact"
            name="emergencyContact"
            rows={3}
            className="input-custom-styles"
            placeholder="Name and phone number of emergency contact"
            tabIndex={startTabIndex + (showGuardianInfo ? 4 : 2)}
          />
          {fieldErrors?.emergencyContact && (
            <p className="text-red-500 text-sm mt-1">{fieldErrors.emergencyContact}</p>
          )}
        </div>
      )}

      {showHealthInfo && (
        <div>
          <Label htmlFor={isCollapsible ? "healthNumber" : "healthInfo"}>
            Personal Health Number
          </Label>
          {isCollapsible ? (
            <Input
              id="healthNumber"
              name="healthNumber"
              className="input-custom-styles"
              tabIndex={startTabIndex + (showGuardianInfo ? 5 : 3)}
            />
          ) : (
            <Textarea
              id="healthInfo"
              name="healthInfo"
              className="input-custom-styles"
              rows={3}
              tabIndex={startTabIndex + (showGuardianInfo ? 5 : 3)}
            />
          )}
          {fieldErrors?.healthInfo && (
            <p className="text-red-500 text-sm mt-1">{fieldErrors.healthInfo}</p>
          )}
          {fieldErrors?.healthNumber && (
            <p className="text-red-500 text-sm mt-1">{fieldErrors.healthNumber}</p>
          )}
        </div>
      )}
    </div>
  );

  if (isCollapsible) {
    return (
      <Accordion type="multiple" className={className}>
        <AccordionItem value="optional">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">Optional Information</span>
              <Badge variant="outline" className="text-xs">Help us serve you better</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-6 pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                This information helps us personalize your experience but can be added later.
              </p>
              {referralContent}
              {guardianInfoContent}
              {additionalContent}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  return (
    <>
      {showReferral && (
        <section className={className}>
          <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
            Referral Information
          </h2>
          {referralContent}
        </section>
      )}

      {(showEmergencyContact || showHealthInfo) && (
        <section className={className}>
          <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
            Additional Info
          </h2>
          {additionalContent}
        </section>
      )}
    </>
  );
}
