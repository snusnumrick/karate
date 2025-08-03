import { ReactNode } from "react";
import { Card, CardContent } from "~/components/ui/card";

interface CalendarFilterContainerProps {
  children: ReactNode;
  className?: string;
}

export function CalendarFilterContainer({ children, className = "" }: CalendarFilterContainerProps) {
  return (
    <Card className={className}>
      <CardContent className="pt-3 sm:pt-4 landscape-tablet:pt-2 px-3 sm:px-6 landscape-tablet:px-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}