import { Badge } from '~/components/ui/badge';
import { CalendarIcon } from 'lucide-react';
import {
  formatEventTime,
  getAttendanceStatusVariant,
  getSessionStatusColors,
  getBirthdayColors,
  getEventColors,
  getEligibilityIconColor,
  getEligibilityBorderColor
} from './utils';
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
        <div className={`font-medium ${colors.text} text-xs leading-tight ${compact ? 'break-words' : ''}`} title={event.className}>
          {event.className}
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
            <span className="text-xs text-gray-600 dark:text-gray-300 truncate text-clip leading-tight">
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
        {compact ? (
          <div className="space-y-0">
            <div className={`font-medium ${colors.text} text-xs leading-tight truncate text-clip`} title={event.studentName}>
              {event.studentName?.split(' ')[0] || ''}
            </div>
            <div className={`${colors.text} text-xs leading-tight truncate text-clip opacity-80`} title={event.studentName}>
              {event.studentName?.split(' ').slice(1).join(' ') || ''}
            </div>
          </div>
        ) : (
          <>
            <div className={`font-medium ${colors.text} text-xs leading-tight`} title={event.studentName}>
              🎂 {event.studentName}
            </div>
            <div className={`text-xs ${colors.text} opacity-80 leading-tight`}>Birthday</div>
          </>
        )}
      </div>
    );
  }

  if (event.type === 'event') {
    // Get border color based on eligibility status
    const borderColor = getEligibilityBorderColor(event.eligibilityStatus);

    // Use consistent purple background for all events
    const colors = {
      background: 'bg-purple-100 dark:bg-purple-900/30',
      border: borderColor,
      text: 'text-purple-900 dark:text-purple-100',
      hover: 'hover:bg-purple-200 dark:hover:bg-purple-900/50'
    };
    
    // Get icon color based on eligibility status
    // const iconColor = getEligibilityIconColor(event.eligibilityStatus);
    
    return (
      <div
        className={`p-0.5 sm:p-1 mb-0.5 sm:mb-1 ${colors.background} border-l-2 sm:border-l-4 ${colors.border} rounded cursor-pointer ${colors.hover} transition-colors`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Event: ${event.title}${event.eligibilityStatus ? ` (${event.eligibilityStatus.replace('_', ' ')})` : ''}`}
      >
        <div className="flex items-center gap-1">
          {/*<div className={`w-2 h-2 rounded-full flex-shrink-0 ${iconColor}`}></div>*/}
          <div className={`font-medium ${colors.text} text-xs leading-tight ${compact ? 'break-words truncate text-clip\n' : ''}`} title={event.title}>
            {event.title}
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
        {!compact && event.eligibilityStatus && event.eligibilityDetails && (
          <div className={`text-xs ${colors.text} opacity-90 leading-tight mt-0.5`}>
            {event.eligibilityStatus === 'eligible' && `${event.eligibilityDetails.filter(d => d.eligible).length} eligible`}
            {event.eligibilityStatus === 'all_registered' && 'All registered'}
            {event.eligibilityStatus === 'not_eligible' && 'Not eligible'}
          </div>
        )}
      </div>
    );
  }

  return null;
}