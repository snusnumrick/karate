import { Badge } from '~/components/ui/badge';
import { CalendarIcon } from 'lucide-react';
import { formatEventTime, getAttendanceStatusVariant, getSessionStatusColors, getBirthdayColors, getEventColors } from './utils';
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
    const colors = getSessionStatusColors(event.status);
    
    return (
      <div
        className={`p-0.5 sm:p-1 mb-0.5 sm:mb-1 ${colors.background} border-l-2 sm:border-l-4 ${colors.border} rounded cursor-pointer ${colors.hover} transition-colors`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Session: ${event.className} - ${event.status}`}
      >
        <div className={`font-medium ${colors.text} text-xs leading-tight`}>
          {compact ? (event.className && event.className.length > 15 ? event.className.substring(0, 15) + '...' : event.className) : event.className}
        </div>
        {!compact && event.programName && (
          <div className={`text-xs ${colors.text} opacity-80 leading-tight`}>{event.programName}</div>
        )}
        {!compact && (event.startTime || event.endTime) && (
          <div className={`text-xs ${colors.text} opacity-70 leading-tight`}>
            {formatEventTime(event.startTime, event.endTime)}
          </div>
        )}
        {!compact && event.status && event.status !== 'scheduled' && (
          <div className={`text-xs ${colors.text} opacity-90 leading-tight font-medium mt-0.5`}>
            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
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

  if (event.type === 'birthday') {
    const colors = getBirthdayColors();
    
    return (
      <div
        className={`p-0.5 sm:p-1 mb-0.5 sm:mb-1 ${colors.background} border-l-2 sm:border-l-4 ${colors.border} rounded cursor-pointer ${colors.hover} transition-colors`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Birthday: ${event.studentName}`}
      >
        <div className={`font-medium ${colors.text} text-xs leading-tight`}>
          {compact ? (event.title && event.title.length > 15 ? event.title.substring(0, 15) + '...' : event.title) : event.title}
        </div>
        {!compact && (
          <div className={`text-xs ${colors.text} opacity-80 leading-tight`}>Birthday</div>
        )}
      </div>
    );
  }

  if (event.type === 'event') {
    const colors = getEventColors();
    
    return (
      <div
        className={`p-0.5 sm:p-1 mb-0.5 sm:mb-1 ${colors.background} border-l-2 sm:border-l-4 ${colors.border} rounded cursor-pointer ${colors.hover} transition-colors`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Event: ${event.title}`}
      >
        <div className="flex items-center gap-1">
          <CalendarIcon className="w-3 h-3 flex-shrink-0" />
          <div className={`font-medium ${colors.text} text-xs leading-tight truncate`}>
            {compact ? (event.title && event.title.length > 15 ? event.title.substring(0, 15) + '...' : event.title) : event.title}
          </div>
        </div>
        {!compact && event.eventType && (
          <div className={`text-xs ${colors.text} opacity-80 leading-tight capitalize`}>
            {event.eventType.replace('_', ' ')}
          </div>
        )}
        {!compact && (event.startTime || event.endTime) && (
          <div className={`text-xs ${colors.text} opacity-70 leading-tight`}>
            {formatEventTime(event.startTime, event.endTime)}
          </div>
        )}
      </div>
    );
  }

  return null;
}