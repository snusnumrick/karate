import { Badge } from '~/components/ui/badge';
import { formatEventTime, getAttendanceStatusVariant } from './utils';
import type { CalendarEventProps } from './types';

export function CalendarEvent({ event, onClick, compact = false }: CalendarEventProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(event);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  if (event.type === 'session') {
    return (
      <div
        className={`p-0.5 sm:p-1 mb-0.5 sm:mb-1 bg-blue-100 dark:bg-blue-900/30 border-l-2 sm:border-l-4 border-blue-500 dark:border-blue-400 rounded cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Session: ${event.className}`}
      >
        <div className="font-medium text-blue-900 dark:text-blue-100 text-xs leading-tight">
          {compact ? (event.className && event.className.length > 15 ? event.className.substring(0, 15) + '...' : event.className) : event.className}
        </div>
        {!compact && event.programName && (
          <div className="text-xs text-blue-700 dark:text-blue-200 leading-tight">{event.programName}</div>
        )}
        {!compact && (event.startTime || event.endTime) && (
          <div className="text-xs text-blue-600 dark:text-blue-300 leading-tight">
            {formatEventTime(event.startTime, event.endTime)}
          </div>
        )}
      </div>
    );
  }

  if (event.type === 'attendance') {
    const variant = getAttendanceStatusVariant(event.status);
    
    return (
      <div
        className={`p-0.5 sm:p-1 mb-0.5 sm:mb-1 rounded cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Attendance: ${event.studentName} - ${event.status}`}
      >
        <div className="flex items-center space-x-1">
          <Badge variant={variant} className="text-xs px-1 py-0 leading-tight">
            {compact ? event.status?.charAt(0).toUpperCase() : event.status?.toUpperCase()}
          </Badge>
          {!compact && (
            <span className="text-xs text-gray-600 dark:text-gray-300 truncate leading-tight">
              {event.studentName}
            </span>
          )}
        </div>
        {!compact && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
            {event.className}
          </div>
        )}
      </div>
    );
  }

  return null;
}