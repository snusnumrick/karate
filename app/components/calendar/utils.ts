import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import type { CalendarDay, CalendarEvent } from './types';

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
export function filterEventsByStudent(events: CalendarEvent[], studentId?: string): CalendarEvent[] {
  if (!studentId || studentId === 'all') {
    return events;
  }
  
  return events.filter(event => {
    // For attendance events, filter by the student who attended
    if (event.type === 'attendance') {
      // This would need student ID from attendance record
      return true; // For now, show all attendance events
    }
    
    // For session events, show all sessions (family can see all their enrolled classes)
    return true;
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