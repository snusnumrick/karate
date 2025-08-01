import type { Database } from '~/types/database.types';

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'session' | 'attendance' | 'birthday' | 'event';
  status?: 'present' | 'absent' | 'excused' | 'late' | 'scheduled' | 'completed' | 'cancelled';
  className?: string;
  studentName?: string;
  studentNames?: string[]; // For session events with multiple enrolled students
  sessionId?: string;
  attendanceId?: string;
  classId?: string;
  programName?: string;
  startTime?: string;
  endTime?: string;
  studentId?: string; // For birthday events
  eventType?: string; // For events from the events table
  description?: string; // For events from the events table
  location?: string; // For events from the events table
  endDate?: string; // For multi-day events (YYYY-MM-DD format)
  isMultiDay?: boolean; // Indicates if this is part of a multi-day event
  isFirstDay?: boolean; // Indicates if this is the first day of a multi-day event
  isLastDay?: boolean; // Indicates if this is the last day of a multi-day event
  originalEventId?: string; // For multi-day events, references the original event ID
  // Eligibility information for family calendar events
  eligibilityStatus?: 'eligible' | 'all_registered' | 'not_eligible';
  eligibilityDetails?: {
    studentId: string;
    studentName: string;
    eligible: boolean;
    reason: string;
    allIssues: string[];
  }[];
}

export interface CalendarDay {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
}

export type CalendarDayWithEvents = CalendarDay;

export interface CalendarProps {
  events: CalendarEvent[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  filterOptions?: {
    students?: Array<{ id: string; name: string }>;
    selectedStudentId?: string;
    onStudentChange?: (studentId: string) => void;
  };
  className?: string;
}

export interface CalendarGridProps {
  days: CalendarDay[];
  onEventClick?: (event: CalendarEvent) => void;
  onDayClick?: (date: Date) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export interface CalendarEventProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
  compact?: boolean;
}

export interface CalendarHeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export interface CalendarFiltersProps {
  students?: Array<{ id: string; name: string }>;
  selectedStudentId?: string;
  onStudentChange?: (studentId: string) => void;
}

// Database types for calendar data
export type ClassSession = Database['public']['Tables']['class_sessions']['Row'];
export type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
export type EnrollmentWithClass = Database['public']['Tables']['enrollments']['Row'] & {
  classes: Database['public']['Tables']['classes']['Row'] & {
    programs: Database['public']['Tables']['programs']['Row'];
  };
};
export type StudentRow = Database['public']['Tables']['students']['Row'];