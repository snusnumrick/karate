import { CalendarHeader } from './CalendarHeader';
import { CalendarFilters } from './CalendarFilters';
import { CalendarGrid } from './CalendarGrid';
import { generateCalendarDays, assignEventsToCalendarDays, filterEventsByStudent, getNextMonth, getPrevMonth } from './utils';
import type { CalendarProps } from './types';

export function Calendar({
  events,
  currentDate,
  onDateChange,
  onEventClick,
  filterOptions,
  className = ''
}: CalendarProps) {
  // Use the selectedStudentId from filterOptions instead of local state
  const selectedStudentId = filterOptions?.selectedStudentId || 'all';

  // Filter events based on selected student, passing students data for proper filtering
  const filteredEvents = filterEventsByStudent(events, selectedStudentId, filterOptions?.students);

  // Generate calendar days and assign events
  const calendarDays = generateCalendarDays(currentDate);
  const daysWithEvents = assignEventsToCalendarDays(calendarDays, filteredEvents);

  const handlePrevMonth = () => {
    onDateChange(getPrevMonth(currentDate));
  };

  const handleNextMonth = () => {
    onDateChange(getNextMonth(currentDate));
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const handleStudentChange = (studentId: string) => {
    if (filterOptions?.onStudentChange) {
      filterOptions.onStudentChange(studentId);
    }
  };

  const handleDayClick = (date: Date) => {
    // Could be used for day detail view or other interactions
    console.log('Day clicked:', date);
  };

  return (
    <div className={`calendar-container ${className}`}>
      <CalendarHeader
        currentDate={currentDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
      />
      
      {filterOptions && (
        <CalendarFilters
          students={filterOptions.students}
          selectedStudentId={selectedStudentId}
          onStudentChange={handleStudentChange}
        />
      )}
      
      <CalendarGrid
        days={daysWithEvents}
        onEventClick={onEventClick}
        onDayClick={handleDayClick}
        onSwipeLeft={handleNextMonth}
        onSwipeRight={handlePrevMonth}
      />
    </div>
  );
}