import { Button } from '~/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthYear } from './utils';
import type { CalendarHeaderProps } from './types';

export function CalendarHeader({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday
}: CalendarHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between mb-4 sm:mb-6 space-y-3 sm:space-y-0">
      <div className="flex items-center space-x-2 sm:space-x-4">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold">
          {formatMonthYear(currentDate)}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          className="text-xs sm:text-sm"
        >
          Today
        </Button>
      </div>
      
      <div className="flex items-center space-x-1 sm:space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevMonth}
          className="p-1 sm:p-2"
        >
          <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNextMonth}
          className="p-1 sm:p-2"
        >
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  );
}