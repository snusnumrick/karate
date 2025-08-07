import { Button } from '~/components/ui/button';
import { ChevronLeft, ChevronRight, Grid3X3, List } from 'lucide-react';
import { formatMonthYear } from './utils';
import type { CalendarHeaderProps } from './types';

export function CalendarHeader({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  viewMode,
  onViewModeChange
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
        {/* View toggle buttons - only show if handlers are provided */}
        {onViewModeChange && viewMode && (
          <div className="flex items-center space-x-1 mr-2 sm:mr-3">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('grid')}
              className="p-1 sm:p-2"
              title="Grid View"
            >
              <Grid3X3 className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('list')}
              className="p-1 sm:p-2"
              title="List View"
            >
              <List className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        )}
        
        {/* Hide navigation arrows on mobile since we have fixed arrows */}
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevMonth}
          className="p-1 sm:p-2 hidden sm:flex"
        >
          <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNextMonth}
          className="p-1 sm:p-2 hidden sm:flex"
        >
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  );
}