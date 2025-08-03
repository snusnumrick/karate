import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { CalendarHeader } from './CalendarHeader';
import { CalendarFilters } from './CalendarFilters';
import { CalendarGrid } from './CalendarGrid';
import { CalendarListView } from './CalendarListView';
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
  const [isMobile, setIsMobile] = useState(false);
  
  // Initialize viewMode from localStorage or default
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendar-view-mode');
      return (saved as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });

  // Use the selectedStudentId from filterOptions instead of local state
  const selectedStudentId = filterOptions?.selectedStudentId || 'all';

  // Check if mobile and set initial default view
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };

    // Set initial view based on screen size only once
    const initialMobile = window.innerWidth < 768;
    setIsMobile(initialMobile);
    
    // Only override saved preference if it's the first time on mobile
    if (initialMobile && !localStorage.getItem('calendar-view-mode')) {
      setViewMode('list');
    }

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []); // Remove viewMode dependency to prevent auto-switching

  // Save viewMode to localStorage when it changes
  const handleViewModeChange = (newViewMode: 'grid' | 'list') => {
    setViewMode(newViewMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendar-view-mode', newViewMode);
    }
  };

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
    <div className={`calendar-container relative ${className}`}>
        <CalendarHeader
          currentDate={currentDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          isMobile={isMobile}
        />
        
        {filterOptions && (
          <CalendarFilters
            students={filterOptions.students}
            selectedStudentId={selectedStudentId}
            onStudentChange={handleStudentChange}
          />
        )}
        
        {viewMode === 'grid' ? (
          <CalendarGrid
            days={daysWithEvents}
            onEventClick={onEventClick}
            onDayClick={handleDayClick}
            onSwipeLeft={handleNextMonth}
            onSwipeRight={handlePrevMonth}
          />
        ) : (
          <CalendarListView
            events={filteredEvents}
            currentDate={currentDate}
            onEventClick={onEventClick}
          />
        )}
       </div>
   );
}