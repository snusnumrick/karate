import { format } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { CalendarEvent } from './CalendarEvent';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Calendar as CalendarIcon, Clock, Users } from 'lucide-react';
import type { CalendarGridProps, CalendarEvent as CalendarEventType } from './types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
          <DialogHeader className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {format(date, 'MMMM d, yyyy')}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          {/* Events list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {events.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No events scheduled for this day
                </div>
            ) : (
                events.map((event) => (
                    <div
                        key={event.id}
                        className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
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
                        <h3 className="font-medium text-blue-900 dark:text-blue-100 text-base">
                          {event.className || event.title}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                            event.type === 'session'
                                ? 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                                : event.status === 'present'
                                    ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200'
                                    : event.status === 'absent'
                                        ? 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                        }`}>
                    {event.type === 'session' ? 'Session' : event.status?.toUpperCase()}
                  </span>
                      </div>

                      {/* Program name */}
                      {event.programName && (
                          <p className="text-blue-700 dark:text-blue-300 text-sm mb-2">
                            {event.programName}
                          </p>
                      )}

                      {/* Time */}
                      {(event.startTime || event.endTime) && (
                          <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 text-sm mb-2">
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
                          <div className="flex items-start space-x-1 text-blue-600 dark:text-blue-400 text-sm">
                            <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="font-medium">Students: </span>
                              <span>{event.studentNames.join(', ')}</span>
                            </div>
                          </div>
                      )}

                      {/* Single student for attendance events */}
                      {event.studentName && event.type === 'attendance' && (
                          <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 text-sm">
                            <Users className="h-4 w-4" />
                            <span>Student: {event.studentName}</span>
                          </div>
                      )}
                    </div>
                ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
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
      setIsMobile(window.innerWidth < 640);
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
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            {WEEKDAYS.map(day => (
                <div key={day} className="p-1 sm:p-2 md:p-3 text-center text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.charAt(0)}</span>
                </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayKey = format(day.date, 'yyyy-MM-dd');
              const maxVisible = isMobile ? 2 : 3;
              const hasMoreEvents = day.events.length > maxVisible;

              return (
                  <div
                      key={dayKey}
                      className={`min-h-[80px] sm:min-h-[100px] md:min-h-[120px] p-1 sm:p-2 border-r border-b border-gray-200 dark:border-gray-700 last:border-r-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          !day.isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500' : 'bg-white dark:bg-gray-800'
                      } ${
                          day.isToday ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400 border-2 shadow-inner' : ''
                      }`}
                      onClick={() => handleDayClick(day.date)}
                      onKeyDown={(e) => handleKeyDown(e, day.date)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${format(day.date, 'MMMM d, yyyy')} - ${day.events.length} events`}
                  >
                    {/* Day number */}
                    <div className={`text-xs sm:text-sm mb-1 ${
                        day.isToday ? 'font-bold bg-blue-600 dark:bg-blue-500 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex items-center justify-center mx-auto text-xs sm:text-sm md:text-base' : day.isCurrentMonth ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400 dark:text-gray-500 font-medium'
                    }`}>
                      {format(day.date, 'd')}
                    </div>

                    {/* Events */}
                    <div className="space-y-0.5 sm:space-y-1">
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
                              className="w-full text-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 py-1 rounded transition-colors text-xs font-medium"
                              aria-label={`Show ${day.events.length - maxVisible} more events for ${format(day.date, 'MMMM d')}`}
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