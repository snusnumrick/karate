import { useState, useEffect, useRef } from 'react';
import { formatDate } from '~/utils/misc';
import { CalendarEvent } from './CalendarEvent';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Calendar as CalendarIcon, Clock, Users } from 'lucide-react';
import type { CalendarGridProps, CalendarEvent as CalendarEventType } from './types';
import {
  getSessionStatusColors,
  getBirthdayColors,
  getEventColors,
  getAttendanceStatusVariant
} from './utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper function to get event colors based on type and status
const getEventModalColors = (event: CalendarEventType) => {
  if (event.type === 'session') {
    return getSessionStatusColors(event.status);
  }
  if (event.type === 'birthday') {
    return getBirthdayColors();
  }
  if (event.type === 'event') {
    return getEventColors();
  }
  if (event.type === 'attendance') {
    // For attendance, use colors based on status
    if (event.status === 'present') {
      return {
        background: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-800',
        text: 'text-green-900 dark:text-green-100'
      };
    }
    if (event.status === 'absent') {
      return {
        background: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-900 dark:text-red-100'
      };
    }
    if (event.status === 'late') {
      return {
        background: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-800',
        text: 'text-yellow-900 dark:text-yellow-100'
      };
    }
    if (event.status === 'excused') {
      return {
        background: 'bg-gray-50 dark:bg-gray-900/20',
        border: 'border-gray-200 dark:border-gray-800',
        text: 'text-gray-900 dark:text-gray-100'
      };
    }
  }
  // Default colors
  return {
    background: 'bg-muted',
    border: 'border-border',
    text: 'text-foreground'
  };
};

// Day Events Modal Component
const DayEventsModal = ({
                          isOpen,
                          onClose,
                          date,
                          events,
                          onEventClick
                        }: {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  events: CalendarEventType[];
  onEventClick?: (event: CalendarEventType) => void;
}) => {
  if (!isOpen) return null;

  return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0">
          {/* Header */}
          <DialogHeader className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <DialogTitle className="text-lg font-semibold text-foreground">
                  {formatDate(date, { formatString: 'MMMM d, yyyy' })}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          {/* Events list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No events scheduled for this day
                </div>
            ) : (
                events.map((event) => {
                  const colors = getEventModalColors(event);
                  return (
                    <div
                        key={event.id}
                        className={`${colors.background} border ${colors.border} rounded-lg p-4 cursor-pointer hover:opacity-80 transition-opacity`}
                        onClick={() => {
                          if (onEventClick) {
                            onEventClick(event);
                            onClose();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (onEventClick) {
                              onEventClick(event);
                              onClose();
                            }
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`View details for ${event.className || event.title}`}
                    >
                      {/* Event title and type */}
                      <div className="flex items-start justify-between mb-2">
                        <h3 className={`font-medium ${colors.text} text-base`}>
                          {event.className || event.title}
                        </h3>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            {event.type === 'session' ? 'Session' :
                             event.type === 'attendance' ? 'Attendance' :
                             event.type === 'birthday' ? 'Birthday' :
                             event.type === 'event' ? 'Event' : event.type}
                          </Badge>
                          {event.status && event.type !== 'birthday' && (
                            <Badge
                              variant={event.type === 'attendance' ? getAttendanceStatusVariant(event.status) : 'outline'}
                              className="text-xs"
                            >
                              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Program name */}
                      {event.programName && (
                          <p className={`${colors.text} text-sm mb-2 opacity-80`}>
                            {event.programName}
                          </p>
                      )}

                      {/* Time */}
                      {(event.startTime || event.endTime) && (
                          <div className={`flex items-center space-x-1 ${colors.text} text-sm mb-2 opacity-80`}>
                            <Clock className="h-4 w-4" />
                            <span>
                      {event.startTime && event.endTime
                          ? `${event.startTime} - ${event.endTime}`
                          : event.startTime || event.endTime
                      }
                    </span>
                          </div>
                      )}

                      {/* Students */}
                      {event.studentNames && event.studentNames.length > 0 && (
                          <div className={`flex items-start space-x-1 ${colors.text} text-sm opacity-80`}>
                            <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="font-medium">Students: </span>
                              <span>{event.studentNames.join(', ')}</span>
                            </div>
                          </div>
                      )}

                      {/* Single student for attendance events */}
                      {event.studentName && event.type === 'attendance' && (
                          <div className={`flex items-center space-x-1 ${colors.text} text-sm opacity-80`}>
                            <Users className="h-4 w-4" />
                            <span>Student: {event.studentName}</span>
                          </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <Button onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  );
};

export function CalendarGrid({ days, onEventClick, onDayClick, onSwipeLeft, onSwipeRight }: CalendarGridProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{
    date: Date;
    events: CalendarEventType[];
  } | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      // Consider landscape tablets (like Google Nest 1024x600, iPad Mini 1024x768, iPad Air 1180x820) as mobile for compact view
      const isLandscapeTablet = window.innerWidth >= 1024 && window.innerHeight <= 820;
      setIsMobile(window.innerWidth < 768 || isLandscapeTablet);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleDayClick = (date: Date) => {
    if (onDayClick) {
      onDayClick(date);
    }
  };

  const handleMoreClick = (e: React.MouseEvent, date: Date, events: CalendarEventType[]) => {
    e.stopPropagation(); // Prevent day click
    setSelectedDayEvents({ date, events });
  };

  const handleKeyDown = (e: React.KeyboardEvent, date: Date) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDayClick(date);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile || touchStartX.current === null || touchStartY.current === null) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const closeModal = () => {
    setSelectedDayEvents(null);
  };

  return (
      <>
        <div
            className="bg-background rounded-lg border border-border overflow-hidden shadow-sm"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-muted border-b border-border">
            {WEEKDAYS.map(day => (
                <div key={day} className="p-1.5 sm:p-2 md:p-3 landscape-tablet:p-1.5 text-center text-xs sm:text-sm landscape-tablet:text-xs font-semibold text-muted-foreground border-r border-border last:border-r-0">
                  <span className="hidden sm:inline landscape-tablet:hidden">{day}</span>
                  <span className="sm:hidden landscape-tablet:inline text-xs font-bold">{day.slice(0, 2)}</span>
                </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayKey = formatDate(day.date, { formatString: 'yyyy-MM-dd' });
              const maxVisible = isMobile ? 1 : 3;
              const hasMoreEvents = day.events.length > maxVisible;

              return (
                  <div
                      key={dayKey}
                      className={`min-h-[70px] sm:min-h-[100px] md:min-h-[120px] landscape-tablet:min-h-[65px] p-1.5 sm:p-2 landscape-tablet:p-1 border-r border-b border-border last:border-r-0 cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted ${
                          !day.isCurrentMonth ? 'bg-muted/30 text-muted-foreground/60' : 'bg-background'
                      } ${
                          day.isToday ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400 border-2 shadow-inner' : ''
                      }`}
                      onClick={() => handleDayClick(day.date)}
                      onKeyDown={(e) => handleKeyDown(e, day.date)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${formatDate(day.date, { formatString: 'MMMM d, yyyy' })} - ${day.events.length} events`}
                  >
                    {/* Day number */}
                    <div className={`text-sm sm:text-sm landscape-tablet:text-xs mb-1 landscape-tablet:mb-0.5 flex items-center justify-between ${
                        day.isToday ? 'font-bold' : day.isCurrentMonth ? 'text-foreground font-medium' : 'text-muted-foreground/60 font-medium'
                    }`}>
                      <span className={day.isToday ? 'bg-blue-600 dark:bg-blue-500 text-white rounded-full w-6 h-6 sm:w-7 sm:h-7 landscape-tablet:w-5 landscape-tablet:h-5 flex items-center justify-center text-xs sm:text-sm landscape-tablet:text-xs font-bold' : ''}>
                        {formatDate(day.date, { formatString: 'd' })}
                      </span>
                      {day.events.length > 0 && (
                        <span className="text-xs bg-red-500 text-white rounded-full w-4 h-4 landscape-tablet:w-3 landscape-tablet:h-3 flex items-center justify-center font-bold landscape-tablet:text-xs">
                          {day.events.length}
                        </span>
                      )}
                    </div>

                    {/* Events */}
                    <div className="space-y-0.5 sm:space-y-1 landscape-tablet:space-y-0">
                      {day.events.slice(0, maxVisible).map(event => (
                          <CalendarEvent
                              key={event.id}
                              event={event}
                              onClick={onEventClick}
                              compact={true}
                          />
                      ))}
                      {hasMoreEvents && (
                          <button
                              onClick={(e) => handleMoreClick(e, day.date, day.events)}
                              className="w-full text-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 py-1 landscape-tablet:py-0.5 rounded transition-colors text-xs landscape-tablet:text-xs font-medium bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700"
                              aria-label={`Show ${day.events.length - maxVisible} more events for ${formatDate(day.date, { formatString: 'MMMM d' })}`}
                          >
                            +{day.events.length - maxVisible} more
                          </button>
                      )}
                    </div>
                  </div>
              );
            })}
          </div>
        </div>

        {/* Day Events Modal */}
        {selectedDayEvents && (
            <DayEventsModal
                isOpen={!!selectedDayEvents}
                onClose={closeModal}
                date={selectedDayEvents.date}
                events={selectedDayEvents.events}
                onEventClick={onEventClick}
            />
        )}
      </>
  );
}