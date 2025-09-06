import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import type { CalendarDay, CalendarEvent } from './types';

/**
 * Convert student birthdays to calendar events
 * Creates birthday events for a 12-month rolling window from the given start date
 */
export function birthdaysToCalendarEvents(
  students: Array<{
    id: string;
    first_name: string;
    last_name: string;
    birth_date: string;
  }>,
  startDate: Date = new Date()
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const currentYear = startDate.getFullYear();
  const nextYear = currentYear + 1;
  
  students.forEach(student => {
    if (student.birth_date) {
      // Parse the birth date
      const birthDate = parseLocalDate(student.birth_date);
      const birthMonth = birthDate.getMonth();
      const birthDay = birthDate.getDate();
      
      // Create birthday events for current year and next year
      // This ensures we always have a 12-month rolling window
      const birthdayThisYear = new Date(currentYear, birthMonth, birthDay);
      const birthdayNextYear = new Date(nextYear, birthMonth, birthDay);
      
      // Add birthday for current year
      events.push({
        id: `birthday-${student.id}-${currentYear}`,
        title: `🎂 ${student.first_name} ${student.last_name}`,
        date: birthdayThisYear,
        type: 'birthday' as const,
        studentName: `${student.first_name} ${student.last_name}`,
        studentId: student.id
      });
      
      // Add birthday for next year
      events.push({
        id: `birthday-${student.id}-${nextYear}`,
        title: `🎂 ${student.first_name} ${student.last_name}`,
        date: birthdayNextYear,
        type: 'birthday' as const,
        studentName: `${student.first_name} ${student.last_name}`,
        studentId: student.id
      });
    }
  });
  
  return events;
}

/**
 * Generate calendar days for a given month
 */
export function generateCalendarDays(date: Date): CalendarDay[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return days.map(day => ({
    date: day,
    events: [],
    isCurrentMonth: isSameMonth(day, date),
    isToday: isToday(day)
  }));
}

/**
 * Group events by date
 */
export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();
  
  events.forEach(event => {
    const dateKey = format(event.date, 'yyyy-MM-dd');
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(event);
  });
  
  return grouped;
}

/**
 * Assign events to calendar days
 */
export function assignEventsToCalendarDays(days: CalendarDay[], events: CalendarEvent[]): CalendarDay[] {
  const eventsByDate = groupEventsByDate(events);
  
  return days.map(day => {
    const dateKey = format(day.date, 'yyyy-MM-dd');
    const dayEvents = eventsByDate.get(dateKey) || [];
    
    return {
      ...day,
      events: dayEvents
    };
  });
}

/**
 * Parse a date string (YYYY-MM-DD) as a local date to avoid timezone issues
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a Date object or date string as a local date string (YYYY-MM-DD) to avoid timezone issues
 * This ensures the date is formatted in the user's local timezone, not UTC
 */
export function formatLocalDate(date: Date | string): string {
  // If it's already a string in YYYY-MM-DD format, return as-is
  if (typeof date === 'string') {
    // Validate it's in the correct format
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    // If it's a different string format, parse it as a date
    date = parseLocalDate(date);
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as a local date string (YYYY-MM-DD)
 * This avoids timezone issues when comparing with database dates
 */
export function getTodayLocalDateString(): string {
  return formatLocalDate(new Date());
}

/**
 * Convert class sessions to calendar events
 */
export function sessionsToCalendarEvents(
  sessions: Array<{
    id: string;
    session_date: string;
    class_id: string;
    status?: 'scheduled' | 'completed' | 'cancelled';
    start_time?: string;
    end_time?: string;
    classes?: {
      name: string;
      program_id: string;
      programs: {
        name: string;
      } | null;
    } | null;
  }>,
  enrollments: Array<{
    student_id: string;
    class_id: string;
    classes?: {
      id: string;
      name: string;
      program_id: string;
      programs: {
        name: string;
      } | null;
    } | null;
  }>,
  students?: Array<{ id: string; name: string }>
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  sessions.forEach(session => {
    // Find all enrollments for this class
    const classEnrollments = enrollments.filter(e => e.class_id === session.class_id);
    
    // Only create one event per class session, regardless of how many students are enrolled
    if (classEnrollments.length > 0) {
      const enrollment = classEnrollments[0]; // Use first enrollment for class info
      const className = session.classes?.name || enrollment.classes?.name || 'Unknown Class';
      const programName = session.classes?.programs?.name || enrollment.classes?.programs?.name || 'Unknown Program';
      
      // Get student names for this class session
      const enrolledStudentNames = students ? 
        classEnrollments
          .map(e => students.find(s => s.id === e.student_id)?.name)
          .filter(Boolean) as string[] :
        [];
      
      // Parse date string as local date to avoid timezone issues
      const localDate = parseLocalDate(session.session_date);
      
      events.push({
        id: `session-${session.id}`,
        title: className,
        date: localDate,
        type: 'session' as const,
        status: session.status || 'scheduled',
        className,
        sessionId: session.id,
        classId: session.class_id,
        programName,
        studentNames: enrolledStudentNames,
        startTime: session.start_time || undefined,
        endTime: session.end_time || undefined
      });
    }
  });
  
  return events;
}

/**
 * Convert attendance records to calendar events
 */
export function attendanceToCalendarEvents(
  attendance: Array<{
    id: string;
    student_id: string;
    session_id?: string;
    class_date?: string;
    present?: boolean;
    status?: 'present' | 'absent' | 'excused' | 'late';
  }>,
  sessions: Array<{
    id: string;
    session_date: string;
    class_id: string;
    classes?: {
      name: string;
      program_id: string;
      programs: {
        name: string;
      } | null;
    } | null;
  }>,
  enrollments: Array<{
    class_id: string;
    classes?: {
      id: string;
      name: string;
      program_id: string;
      programs: {
        name: string;
      } | null;
    } | null;
  }>,
  students: Array<{ id: string; name: string }>
): CalendarEvent[] {
  return attendance.map(record => {
    const session = sessions.find(s => s.id === record.session_id);
    const enrollment = enrollments.find(e => e.class_id === session?.class_id);
    const student = students.find(s => s.id === record.student_id);
    const className = enrollment?.classes?.name || session?.classes?.name || 'Unknown Class';
    
    // Handle different attendance status formats
    let status: 'present' | 'absent' | 'excused' | 'late' = 'absent';
    if (record.present === true) {
      status = 'present';
    } else if (record.status) {
      status = record.status;
    } else if (record.present === false) {
      status = 'absent';
    }
    
    // Parse date string as local date to avoid timezone issues
    const dateString = record.class_date || session?.session_date;
    let localDate: Date;
    if (dateString) {
      localDate = parseLocalDate(dateString);
    } else {
      localDate = new Date();
    }
    
    return {
      id: `attendance-${record.id}`,
      title: `${className} - ${student?.name || 'Unknown Student'}`,
      date: localDate,
      type: 'attendance' as const,
      status,
      className,
      studentName: student?.name,
      sessionId: record.session_id,
      attendanceId: record.id,
      classId: session?.class_id
    };
  });
}

/**
 * Filter events by student
 */
export function filterEventsByStudent(
  events: CalendarEvent[], 
  studentId?: string, 
  students?: Array<{ id: string; name: string }>
): CalendarEvent[] {
  if (!studentId || studentId === 'all') {
    return events;
  }
  
  // Find the selected student's name
  const selectedStudent = students?.find(s => s.id === studentId);
  const selectedStudentName = selectedStudent?.name;
  
  return events.filter(event => {
    // Birthday events should always be visible regardless of filter
    if (event.type === 'birthday') {
      return true;
    }
    
    // For attendance events, filter by the student who attended
    if (event.type === 'attendance') {
      return event.studentId === studentId;
    }
    
    // For session events, filter by student enrollment
    if (event.type === 'session') {
      // Check if the selected student is enrolled in this class
      if (event.studentNames && selectedStudentName) {
        return event.studentNames.includes(selectedStudentName);
      }
      // If no studentNames or selectedStudentName, show all sessions (family is enrolled)
      return true;
    }
    
    return false;
  });
}

/**
 * Navigation helpers
 */
export function getNextMonth(date: Date): Date {
  return addMonths(date, 1);
}

export function getPrevMonth(date: Date): Date {
  return subMonths(date, 1);
}

export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy');
}

export function formatEventTime(startTime?: string, endTime?: string): string {
  if (!startTime) return '';
  if (!endTime) return startTime;
  return `${startTime} - ${endTime}`;
}

/**
 * Get status badge variant for attendance
 */
export function getAttendanceStatusVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'present':
      return 'default';
    case 'late':
      return 'secondary';
    case 'absent':
      return 'destructive';
    case 'excused':
      return 'outline';
    default:
      return 'outline';
  }
}

/**
 * Get birthday event colors for calendar events
 */
export function getBirthdayColors(): {
  background: string;
  border: string;
  text: string;
  hover: string;
} {
  return {
    background: 'bg-pink-100 dark:bg-pink-900/30',
    border: 'border-pink-500 dark:border-pink-400',
    text: 'text-pink-900 dark:text-pink-100',
    hover: 'hover:bg-pink-200 dark:hover:bg-pink-900/50'
  };
}

/**
 * Get session status colors for calendar events
 */
export function getSessionStatusColors(status?: string): {
  background: string;
  border: string;
  text: string;
  hover: string;
} {
  switch (status) {
    case 'completed':
      return {
        background: 'bg-green-100 dark:bg-green-900/30',
        border: 'border-green-500 dark:border-green-400',
        text: 'text-green-900 dark:text-green-100',
        hover: 'hover:bg-green-200 dark:hover:bg-green-900/50'
      };
    case 'cancelled':
      return {
        background: 'bg-red-100 dark:bg-red-900/30',
        border: 'border-red-500 dark:border-red-400',
        text: 'text-red-900 dark:text-red-100',
        hover: 'hover:bg-red-200 dark:hover:bg-red-900/50'
      };
    case 'scheduled':
    default:
      return {
        background: 'bg-blue-100 dark:bg-blue-900/30',
        border: 'border-blue-500 dark:border-blue-400',
        text: 'text-blue-900 dark:text-blue-100',
        hover: 'hover:bg-blue-200 dark:hover:bg-blue-900/50'
      };
  }
}

/**
 * Get event colors for calendar events from the events table
 */
export function getEventColors(): {
  background: string;
  border: string;
  text: string;
  hover: string;
} {
  return {
    background: 'bg-purple-100 dark:bg-purple-900/30',
    border: 'border-purple-500 dark:border-purple-400',
    text: 'text-purple-900 dark:text-purple-100',
    hover: 'hover:bg-purple-200 dark:hover:bg-purple-900/50'
  };
}

/**
 * Get event colors based on eligibility status for family calendar
 */
export function getEligibilityEventColors(eligibilityStatus?: string): {
  background: string;
  border: string;
  text: string;
  hover: string;
} {
  switch (eligibilityStatus) {
    case 'eligible':
      // Green for events where at least one student is eligible
      return {
        background: 'bg-emerald-100 dark:bg-emerald-900/30',
        border: 'border-emerald-500 dark:border-emerald-400',
        text: 'text-emerald-900 dark:text-emerald-100',
        hover: 'hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
      };
    case 'all_registered':
      // Blue for events where all eligible students are already registered
      return {
        background: 'bg-sky-100 dark:bg-sky-900/30',
        border: 'border-sky-500 dark:border-sky-400',
        text: 'text-sky-900 dark:text-sky-100',
        hover: 'hover:bg-sky-200 dark:hover:bg-sky-900/50'
      };
    case 'not_eligible':
    default:
      // Gray for events where no students are eligible
      return {
        background: 'bg-muted',
        border: 'border-muted-foreground',
        text: 'text-foreground',
        hover: 'hover:bg-muted/80'
      };
  }
}

/**
 * Get eligibility status circle color based on eligibility status
 */
export function getEligibilityIconColor(eligibilityStatus?: string): string {
  switch (eligibilityStatus) {
    case 'eligible':
      return 'bg-green-500';
    case 'all_registered':
      return 'bg-blue-500';
    case 'not_eligible':
      return 'bg-muted-foreground';
    default:
      return 'bg-purple-500';
  }
}

export function getEligibilityBorderColor(eligibilityStatus?: string): string {
  switch (eligibilityStatus) {
    case 'eligible':
      return 'border-green-500';
    case 'all_registered':
      return 'border-blue-500';
    case 'not_eligible':
      return 'border-muted-foreground';
    default:
      return 'border-purple-500 dark:border-purple-400';
  }
}

/**
 * Expand multi-day events to show on all days between start and end dates
 */
export function expandMultiDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  const expandedEvents: CalendarEvent[] = [];
  
  events.forEach(event => {
    // For events with endDate, create an event for each day
    if (event.endDate && event.endDate !== formatLocalDate(event.date)) {
      const startDate = event.date;
      const endDate = parseLocalDate(event.endDate);
      
      // Generate events for each day in the range
      const currentDate = new Date(startDate);
      let dayIndex = 0;
      
      while (currentDate <= endDate) {
        const isFirstDay = dayIndex === 0;
        const isLastDay = formatLocalDate(currentDate) === event.endDate;
        
        expandedEvents.push({
          ...event,
          id: `${event.id}-day-${dayIndex}`,
          date: new Date(currentDate),
          title: isFirstDay ? event.title : 
                 isLastDay ? `${event.title} (ends)` : 
                 `${event.title} (cont.)`,
          isMultiDay: true,
          isFirstDay,
          isLastDay,
          originalEventId: event.id
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
        dayIndex++;
      }
    } else {
      // Single day event, add as-is
      expandedEvents.push(event);
    }
  });
  
  return expandedEvents;
}