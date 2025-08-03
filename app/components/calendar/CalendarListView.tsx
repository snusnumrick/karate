import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Users, MapPin } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import type { CalendarEvent } from './types';

interface CalendarListViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick?: (event: CalendarEvent) => void;
}

export function CalendarListView({ events, currentDate, onEventClick }: CalendarListViewProps) {
  // Get the month range for the current date
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group events by day
  const eventsByDay = monthDays.map(day => ({
    date: day,
    events: events.filter(event => isSameDay(event.date, day))
  })).filter(dayData => dayData.events.length > 0);

  const getEventTypeColor = (event: CalendarEvent) => {
    switch (event.type) {
      case 'session':
        return 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200';
      case 'attendance':
        return event.status === 'present' 
          ? 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200'
          : 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200';
      case 'birthday':
        return 'bg-pink-100 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700 text-pink-800 dark:text-pink-200';
      case 'event':
        return 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-800 dark:text-purple-200';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'present':
        return 'default';
      case 'absent':
        return 'destructive';
      case 'excused':
        return 'secondary';
      case 'late':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (eventsByDay.length === 0) {
    return (
      <div className="text-center py-12">
        <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No events this month
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Check other months or add new events to your calendar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {format(monthStart, 'MMMM yyyy')}
        </h3>
      </div>

      {eventsByDay.map(({ date, events: dayEvents }) => (
        <div key={format(date, 'yyyy-MM-dd')} className="space-y-3">
          {/* Day header */}
          <div className="flex items-center space-x-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${
              isSameDay(date, new Date()) 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}>
              {format(date, 'd')}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                {format(date, 'EEEE')}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {format(date, 'MMMM d, yyyy')}
              </p>
            </div>
            <div className="flex-1" />
            <Badge variant="outline" className="text-xs">
              {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Events for this day */}
          <div className="space-y-3 pl-4">
            {dayEvents.map(event => (
              <Card 
                key={event.id} 
                className={`cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${getEventTypeColor(event)}`}
                onClick={() => onEventClick?.(event)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {event.type === 'session' ? 'Class' : 
                         event.type === 'attendance' ? 'Attendance' :
                         event.type === 'birthday' ? 'Birthday' : 'Event'}
                      </Badge>
                      {event.status && (
                        <Badge variant={getStatusBadgeVariant(event.status)} className="text-xs">
                          {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                        </Badge>
                      )}
                    </div>
                    {(event.startTime || event.endTime) && (
                      <div className="flex items-center space-x-1 text-sm font-medium">
                        <Clock className="h-4 w-4" />
                        <span>
                          {event.startTime && event.endTime
                            ? `${event.startTime} - ${event.endTime}`
                            : event.startTime || event.endTime
                          }
                        </span>
                      </div>
                    )}
                  </div>

                  <h5 className="font-semibold text-base mb-2">
                    {event.className || event.title}
                  </h5>

                  {event.programName && (
                    <p className="text-sm opacity-80 mb-2">
                      Program: {event.programName}
                    </p>
                  )}

                  {event.description && (
                    <p className="text-sm opacity-80 mb-2">
                      {event.description}
                    </p>
                  )}

                  {event.location && (
                    <div className="flex items-center space-x-1 text-sm opacity-80 mb-2">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location}</span>
                    </div>
                  )}

                  {event.studentNames && event.studentNames.length > 0 && (
                    <div className="flex items-start space-x-1 text-sm opacity-80">
                      <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">Students: </span>
                        <span>{event.studentNames.join(', ')}</span>
                      </div>
                    </div>
                  )}

                  {event.studentName && event.type !== 'birthday' && (
                    <div className="flex items-center space-x-1 text-sm opacity-80">
                      <Users className="h-4 w-4" />
                      <span>Student: {event.studentName}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}