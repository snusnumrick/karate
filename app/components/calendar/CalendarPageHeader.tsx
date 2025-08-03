import { ReactNode } from "react";
import { AppBreadcrumb, BreadcrumbItem } from "~/components/AppBreadcrumb";

interface CalendarPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  breadcrumbItems: BreadcrumbItem[];
  actions?: ReactNode;
}

export function CalendarPageHeader({ title, subtitle, icon: Icon, breadcrumbItems, actions }: CalendarPageHeaderProps) {
  return (
    <>
      <div className="mb-6 landscape-tablet:mb-2">
        <AppBreadcrumb items={breadcrumbItems} />
      </div>

      {/* Page Header */}
      <div className="text-center mb-12 landscape-tablet:mb-4">
        <h1 className="text-3xl font-extrabold page-header-styles sm:text-4xl landscape-tablet:text-2xl">
          {Icon && <Icon className="inline-block mr-2 h-8 w-8 landscape-tablet:h-6 landscape-tablet:w-6" />}
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl mx-auto text-xl page-subheader-styles sm:mt-4 landscape-tablet:mt-1 landscape-tablet:text-base">
            {subtitle}
          </p>
        )}
        {actions && <div className="mt-4">{actions}</div>}
      </div>
    </>
  );
}