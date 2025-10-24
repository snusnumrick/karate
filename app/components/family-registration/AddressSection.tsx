import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { MapPin } from "lucide-react";
import { siteConfig } from "~/config/site";

type AddressSectionProps = {
  fieldErrors?: {
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    primaryPhone?: string;
  };
  isCollapsible?: boolean;
  showPrimaryPhone?: boolean;
  showPostalCode?: boolean;
  startTabIndex?: number;
  className?: string;
  sectionTitle?: string;
};

export function AddressSection({
  fieldErrors,
  isCollapsible = false,
  showPrimaryPhone = true,
  showPostalCode = false,
  startTabIndex = 4,
  className = "",
  sectionTitle = "Where Do They Live?"
}: AddressSectionProps) {
  const content = (
    <>
      {isCollapsible && (
        <p className="text-sm text-muted-foreground mb-4">
          You can add this now or complete it later when enrolling in classes.
        </p>
      )}

      <div className="space-y-4">
        <div className={isCollapsible ? "" : "md:col-span-2"}>
          <Label htmlFor="address">
            Home Address {!isCollapsible && <span className="text-red-500">*</span>}
          </Label>
          <Input
            id="address"
            name="address"
            autoComplete="street-address"
            className={`input-custom-styles ${fieldErrors?.address ? 'border-red-500' : ''}`}
            required={!isCollapsible}
            tabIndex={startTabIndex}
          />
          {fieldErrors?.address && (
            <p className="text-red-500 text-sm mt-1">{fieldErrors.address}</p>
          )}
        </div>

        <div className={`grid grid-cols-1 gap-4 ${showPostalCode ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          <div>
            <Label htmlFor="city">
              City {!isCollapsible && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="city"
              name="city"
              autoComplete="address-level2"
              className={`input-custom-styles ${fieldErrors?.city ? 'border-red-500' : ''}`}
              required={!isCollapsible}
              tabIndex={startTabIndex + 1}
            />
            {fieldErrors?.city && (
              <p className="text-red-500 text-sm mt-1">{fieldErrors.city}</p>
            )}
          </div>

          <div>
            <Label htmlFor="province">
              Province {!isCollapsible && <span className="text-red-500">*</span>}
            </Label>
            <Select name="province" required={!isCollapsible}>
              <SelectTrigger id="province" className="input-custom-styles" tabIndex={startTabIndex + 2}>
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {siteConfig.provinces.map((prov) => (
                  <SelectItem key={prov.value} value={prov.value}>
                    {prov.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors?.province && (
              <p className="text-red-500 text-sm mt-1">{fieldErrors.province}</p>
            )}
          </div>

          {showPostalCode && (
            <div>
              <Label htmlFor="postalCode">
                Postal Code {!isCollapsible && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="postalCode"
                name="postalCode"
                autoComplete="postal-code"
                className={`input-custom-styles ${fieldErrors?.postalCode ? 'border-red-500' : ''}`}
                required={!isCollapsible}
                tabIndex={startTabIndex + 3}
              />
              {fieldErrors?.postalCode && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.postalCode}</p>
              )}
            </div>
          )}
        </div>

        {showPrimaryPhone && (
          <div>
            <Label htmlFor="primaryPhone">
              Primary/Home Phone
            </Label>
            <Input
              id="primaryPhone"
              name="primaryPhone"
              type="tel"
              autoComplete="tel"
              className={`input-custom-styles ${fieldErrors?.primaryPhone ? 'border-red-500' : ''}`}
              tabIndex={startTabIndex + (showPostalCode ? 4 : 3)}
            />
            {fieldErrors?.primaryPhone && (
              <p className="text-red-500 text-sm mt-1">{fieldErrors.primaryPhone}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Optional - if different from cell phone</p>
          </div>
        )}
      </div>
    </>
  );

  if (isCollapsible) {
    return (
      <Accordion type="multiple" className={className}>
        <AccordionItem value="address">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-600" />
              <span className="font-semibold">Address Details</span>
              <Badge variant="outline" className="text-xs">Optional - Add now or later</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-4">
              {content}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  return (
    <section className={className}>
      <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
        {sectionTitle}
      </h2>
      {content}
    </section>
  );
}
