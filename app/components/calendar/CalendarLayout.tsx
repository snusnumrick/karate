import { ReactNode } from "react";

interface CalendarLayoutProps {
  children: ReactNode;
  containerClassName?: string;
}

export function CalendarLayout({
  children,
  containerClassName = "page-styles"
}: CalendarLayoutProps) {
  return (
    <div className={containerClassName}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 landscape-tablet:px-2">
        {children}
      </div>
    </div>
  );
}