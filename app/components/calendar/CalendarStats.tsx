import React, { ReactNode } from "react";
import { Card, CardContent } from "~/components/ui/card";

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  value: string | number;
  subtitle?: string;
}

export function StatCard({ icon: Icon, iconColor, label, value, subtitle }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4 landscape-tablet:p-2">
        <div className="flex items-center space-x-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CalendarStatsProps {
  children: ReactNode;
  className?: string;
}

export function CalendarStats({ children, className = "" }: CalendarStatsProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 landscape-tablet:gap-1 ${className}`}>
      {children}
    </div>
  );
}