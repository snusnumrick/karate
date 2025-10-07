import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { parseLocalDate, birthdaysToCalendarEvents, expandMultiDayEvents } from "~/components/calendar/utils";
import { formatDate } from "~/utils/misc";
import { getSupabaseServerClient, getSupabaseAdminClient } from "~/utils/supabase.server";
import { requireAdminUser } from "~/utils/auth.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { Calendar } from "~/components/calendar/Calendar";
import type { CalendarEvent } from "~/components/calendar/types";
import { Clock, AlertTriangle, CheckCircle, XCircle, BookOpen, User, Filter, Plus } from "lucide-react";


// Enhanced admin calendar event interface
interface AdminCalendarEvent {
  // Base CalendarEvent properties
  id: string;
  title: string;
  date: string; // YYYY-MM-DD format to avoid timezone serialization issues
  type: 'session' | 'attendance' | 'event';
  status: 'scheduled' | 'completed' | 'cancelled';
  className?: string;
  sessionId?: string;
  classId?: string;
  programName?: string;
  startTime?: string;
  endTime?: string;
  endDate?: string; // For multi-day events (YYYY-MM-DD format)

  // Admin-specific properties
  programId: string;
  programColor?: string;

  // Enrollment Information
  enrollmentStats: {
    enrolled: number;
    capacity: number;
    waitlist: number;
  };

  // Instructor Details
  instructorId?: string;
  instructorName?: string;

  // Administrative Metadata
  paymentStatus: 'pending' | 'partial' | 'complete';
  attendanceRecorded: boolean;
  sessionGenerated: boolean;

  // Quick Actions
  adminActions: {
    canEditSession: boolean;
    canRecordAttendance: boolean;
    canManageEnrollments: boolean;
    canViewPayments: boolean;
  };
}

type LoaderData = {
  events: AdminCalendarEvent[];
  birthdayEvents: CalendarEvent[];
  programs: Array<{ id: string; name: string; color?: string }>;
  instructors: Array<{ id: string; name: string }>;
  filters: {
    program?: string;
    instructor?: string;
    status?: string;
  };
  stats: {
    totalSessions: number;
    completedSessions: number;
    totalEnrollments: number;
    averageCapacity: number;
  };
  students: Array<{
    id: string;
    first_name: string;
    last_name: string;
    birth_date: string;
  }>;
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Require admin authentication
  await requireAdminUser(request);

  // Create a service role client directly for admin-level data fetching
  const supabaseAdmin = getSupabaseAdminClient();

  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;

  const url = new URL(request.url);
  const monthParam = url.searchParams.get('month');
  const programFilter = url.searchParams.get('program');
  const instructorFilter = url.searchParams.get('instructor');
  const statusFilter = url.searchParams.get('status');
  const currentMonth = monthParam || format(new Date(), 'yyyy-MM');

  try {
    // Get date range for the month view using local date formatting
    const monthStart = startOfMonth(parseLocalDate(currentMonth + '-01'));
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    console.log('Admin Calendar - Date range calculation:', {
      currentMonth,
      monthStartParsed: parseLocalDate(currentMonth + '-01'),
      monthStart,
      calendarStart,
      calendarEnd,
      calendarStartFormatted: formatDate(calendarStart, { formatString: 'yyyy-MM-dd' }),
      calendarEndFormatted: formatDate(calendarEnd, { formatString: 'yyyy-MM-dd' })
    });

    // Fetch programs for filtering
    const { data: programsData } = await supabaseServer
      .from('programs')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    const programs = programsData || [];

    // Fetch instructors for filtering
    const { data: instructorsData } = await supabaseServer
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('role', 'instructor')
      .order('first_name');

    const instructors = (instructorsData || []).map(instructor => ({
      id: instructor.id,
      name: instructor.first_name + ' ' + instructor.last_name
    }));

    // Fetch all students for birthday events
    const { data: studentsData } = await supabaseAdmin
      .from('students')
      .select('id, first_name, last_name, birth_date')
      .order('first_name');

    const students = studentsData || [];

    // Build query for class sessions with filters
    const sessionsQuery = supabaseServer
      .from('class_sessions')
      .select(`
        id,
        session_date,
        start_time,
        end_time,
        status,
        class_id,
        classes (
          id,
          name,
          max_capacity,
          instructor_id,
          program_id,
          programs (
            id,
            name
          ),
          instructor:profiles (
            id,
            first_name,
            last_name
          )
        )
      `)
      .gte('session_date', formatDate(calendarStart, { formatString: 'yyyy-MM-dd' }))
      .lte('session_date', formatDate(calendarEnd, { formatString: 'yyyy-MM-dd' }))
      .order('session_date')
      .order('start_time');

    const { data: sessionsData, error: sessionsError } = await sessionsQuery;
    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      throw sessionsError;
    }

    const sessions = sessionsData || [];
    console.log('Fetched sessions:', sessions.length, 'sessions in date range', formatDate(calendarStart, { formatString: 'yyyy-MM-dd' }), 'to', formatDate(calendarEnd, { formatString: 'yyyy-MM-dd' }));

    // Debug: Check if there are any sessions at all
/*    const { count: totalSessionsCount } = await supabaseServer
      .from('class_sessions')
      .select('*', { count: 'exact', head: true });
    console.log('Total sessions in database:', totalSessionsCount);*/

    // Get enrollment counts for each class
    const classIds = [...new Set(sessions.map(s => s.class_id))];
    const enrollmentCounts: Record<string, { enrolled: number; waitlist: number }> = {};

    if (classIds.length > 0) {
      const { data: enrollmentsData } = await supabaseServer
        .from('enrollments')
        .select('class_id, status')
        .in('class_id', classIds);

      (enrollmentsData || []).forEach(enrollment => {
        if (!enrollmentCounts[enrollment.class_id]) {
          enrollmentCounts[enrollment.class_id] = { enrolled: 0, waitlist: 0 };
        }
        if (enrollment.status === 'active' || enrollment.status === 'trial') {
          enrollmentCounts[enrollment.class_id].enrolled++;
        } else if (enrollment.status === 'waitlist') {
          enrollmentCounts[enrollment.class_id].waitlist++;
        }
      });
    }

    // Check attendance records for sessions
    const sessionIds = sessions.map(s => s.id);
    const attendanceRecords: Record<string, boolean> = {};

    if (sessionIds.length > 0) {
      const { data: attendanceData } = await supabaseServer
        .from('attendance')
        .select('class_session_id')
        .in('class_session_id', sessionIds);

      (attendanceData || []).forEach(record => {
        if (record.class_session_id) {
          attendanceRecords[record.class_session_id] = true;
        }
      });
    }

    // Fetch events from the events table
    const { data: eventsData, error: eventsError } = await supabaseServer
      .from('events')
      .select(`
        id,
        title,
        description,
        event_type_id,
        status,
        start_date,
        end_date,
        start_time,
        end_time,
        location,
        max_participants,
        registration_fee,
        instructor_id,
        instructor:profiles!events_instructor_id_fkey (
          id,
          first_name,
          last_name
        )
      `)
      .gte('start_date', formatDate(calendarStart, { formatString: 'yyyy-MM-dd' }))
      .lte('start_date', formatDate(calendarEnd, { formatString: 'yyyy-MM-dd' }))
      .order('start_date')
      .order('start_time');

    if (eventsError) throw eventsError;
    const eventsList = eventsData || [];

    // Transform sessions to admin calendar events
    const sessionEvents: AdminCalendarEvent[] = sessions
      .filter(session => {
        if (!session.classes) return false;

        // Apply filters
        if (programFilter && session.classes.program_id !== programFilter) return false;
        if (instructorFilter && session.classes.instructor_id !== instructorFilter) return false;
        if (statusFilter && session.status !== statusFilter) return false;

        return true;
      })
      .map(session => {
        const classData = session.classes!;
        const programData = classData.programs!;
        const instructorData = classData.instructor;
        const enrollmentData = enrollmentCounts[session.class_id] || { enrolled: 0, waitlist: 0 };

        console.log('Admin Calendar - Parsing session:', {
          sessionId: session.id,
          sessionDateString: session.session_date,
          className: classData.name
        });

        return {
          id: session.id,
          title: classData.name,
          date: session.session_date, // Keep as string to avoid timezone issues
          type: 'session' as const,
          status: session.status as 'scheduled' | 'completed' | 'cancelled',
          className: classData.name,
          sessionId: session.id,
          classId: session.class_id,
          programName: programData.name,
          startTime: session.start_time,
          endTime: session.end_time,

          // Admin-specific properties
          programId: classData.program_id,
          programColor: undefined, // Could be added to programs table

          enrollmentStats: {
            enrolled: enrollmentData.enrolled,
            capacity: classData.max_capacity || 0,
            waitlist: enrollmentData.waitlist
          },

          instructorId: instructorData?.id,
          instructorName: instructorData ? instructorData.first_name + ' ' + instructorData.last_name : undefined,

          paymentStatus: 'complete' as const, // Would need payment integration
          attendanceRecorded: !!attendanceRecords[session.id],
          sessionGenerated: true,

          adminActions: {
            canEditSession: true,
            canRecordAttendance: session.status === 'completed',
            canManageEnrollments: true,
            canViewPayments: true
          }
        };
      });

    // Transform events from events table to admin calendar events
    const generalEvents: AdminCalendarEvent[] = eventsList
      .filter(event => {
        // Apply instructor filter if set
        if (instructorFilter && event.instructor_id !== instructorFilter) return false;
        // Apply status filter if set (map event status to session status)
        if (statusFilter) {
          const mappedStatus = event.status === 'completed' ? 'completed' : 
                              event.status === 'cancelled' ? 'cancelled' : 'scheduled';
          if (mappedStatus !== statusFilter) return false;
        }
        return true;
      })
      .map(event => {
        const instructorData = event.instructor;
        
        return {
          id: `event-${event.id}`,
          title: event.title,
          date: event.start_date, // Keep as string to avoid timezone issues
          type: 'event' as const,
          eventType: event.event_type_id,
          status: (event.status === 'completed' ? 'completed' : 
                   event.status === 'cancelled' ? 'cancelled' : 'scheduled') as 'scheduled' | 'completed' | 'cancelled',
          className: event.title,
          sessionId: undefined,
          classId: undefined,
          programName: event.event_type_id.replace('_', ' ').toUpperCase(),
          startTime: event.start_time || undefined,
          endTime: event.end_time || undefined,
          endDate: event.end_date || undefined, // Include end date for multi-day events

          // Admin-specific properties
          programId: 'events', // Special program ID for events
          programColor: undefined,

          enrollmentStats: {
            enrolled: 0, // Would need to query event_registrations
            capacity: event.max_participants || 0,
            waitlist: 0
          },

          instructorId: instructorData?.id,
          instructorName: instructorData ? instructorData.first_name + ' ' + instructorData.last_name : undefined,

          paymentStatus: 'complete' as const,
          attendanceRecorded: false,
          sessionGenerated: true,

          adminActions: {
            canEditSession: true,
            canRecordAttendance: false,
            canManageEnrollments: true,
            canViewPayments: true
          }
        };
      });

    // Combine session events and general events
    const events: AdminCalendarEvent[] = [...sessionEvents, ...generalEvents];

    // Calculate stats
    const totalCapacityPercentages = events.map(e => {
      const capacity = Math.max(e.enrollmentStats.capacity, 1);
      return e.enrollmentStats.enrolled / capacity;
    });

    const avgCapacityPercentage = totalCapacityPercentages.length > 0 
      ? totalCapacityPercentages.reduce((sum, percentage) => sum + percentage, 0) / totalCapacityPercentages.length
      : 0;

    // Convert student birthdays to calendar events
    // Use current date to create a 12-month rolling window of birthdays
    const studentsWithBirthDates = students.filter(s => s.birth_date);
    const birthdayEvents = birthdaysToCalendarEvents(studentsWithBirthDates, new Date());

    const stats = {
      totalSessions: events.length,
      completedSessions: events.filter(e => e.status === 'completed').length,
      totalEnrollments: events.reduce((sum, e) => sum + e.enrollmentStats.enrolled, 0),
      averageCapacity: Math.round(avgCapacityPercentage * 100)
    };

    return json({
      events,
      birthdayEvents,
      programs,
      instructors,
      filters: {
        program: programFilter || undefined,
        instructor: instructorFilter || undefined,
        status: statusFilter || undefined
      },
      stats
    }, { headers });

  } catch (error) {
    console.error('Error loading admin calendar:', error);
    return json({
      events: [],
      birthdayEvents: [],
      programs: [],
      instructors: [],
      filters: {},
      stats: { totalSessions: 0, completedSessions: 0, totalEnrollments: 0, averageCapacity: 0 }
    }, { headers });
  }
}

export default function AdminCalendar() {
  const { events, birthdayEvents, programs, instructors, filters } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const [selectedEvent, setSelectedEvent] = useState<AdminCalendarEvent | null>(null);
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(() => {
    const month = searchParams.get('month');
    return month ? parseLocalDate(month + '-01') : new Date();
  });
  
  const handleDateChange = (date: Date) => {
    // Store current scroll position
    const currentScrollY = window.scrollY;
    
    setCurrentDate(date);
    
    // Update URL without triggering navigation
    const newParams = new URLSearchParams(searchParams);
    newParams.set('month', format(date, 'yyyy-MM'));
    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    window.history.replaceState(null, '', newUrl);
    
    // Restore scroll position immediately
    window.scrollTo(0, currentScrollY);
  };

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all' || !value) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    navigate(`?${newParams.toString()}`, { replace: true });
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === 'session') {
      // Handle session events for the modal
      const adminEvent = events.find(e => e.id === event.id);
      if (adminEvent) {
        setSelectedEvent(adminEvent);
      }
    } else if (event.type === 'birthday' && event.studentId) {
      // Navigate to student page when birthday event is clicked
      navigate(`/admin/students/${event.studentId}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>;
    }
  };

  const getCapacityBadge = (enrolled: number, capacity: number) => {
    const percentage = capacity > 0 ? (enrolled * 100) / capacity : 0;
    if (percentage >= 90) {
      return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Full</Badge>;
    } else if (percentage >= 70) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">High</Badge>;
    }
    return <Badge variant="outline">Available</Badge>;
  };



  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <AppBreadcrumb items={breadcrumbPatterns.adminCalendar()} />
        <div className="flex justify-between items-center mt-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Calendar</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage class sessions, events, and student activities</p>
          </div>
          <Button asChild>
            <Link to="/admin/calendar/new">
              <Plus className="w-4 h-4 mr-2" />
              New Event
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">Program</span>
            </div>
            <Select value={filters.program || 'all'} onValueChange={(value) => handleFilterChange('program', value)}>
              <SelectTrigger className="h-8 input-custom-styles">
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {programs.map(program => (
                  <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">Instructor</span>
            </div>
            <Select value={filters.instructor || 'all'} onValueChange={(value) => handleFilterChange('instructor', value)}>
              <SelectTrigger className="h-8 input-custom-styles">
                <SelectValue placeholder="All Instructors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Instructors</SelectItem>
                {instructors.map(instructor => (
                  <SelectItem key={instructor.id} value={instructor.id}>{instructor.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">Status</span>
            </div>
            <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6">
        <div className="p-6">
          <Calendar
            events={expandMultiDayEvents([
              // Session events - parse date strings to Date objects
              ...events.map(event => ({
                id: event.id,
                title: event.title,
                date: parseLocalDate(event.date), // Parse YYYY-MM-DD string to local Date
                type: event.type,
                status: event.status, // Pass the session status for color coding
                className: event.className,
                sessionId: event.sessionId,
                classId: event.classId,
                programName: event.programName,
                startTime: event.startTime,
                endTime: event.endTime,
                endDate: event.endDate // Include end date for multi-day events
              })),
              // Birthday events
              ...birthdayEvents
            ])}
            currentDate={currentDate}
            onDateChange={handleDateChange}
            onEventClick={handleEventClick}
            className="w-full"
          />
        </div>
      </div>

      {/* Event Detail Modal */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Session Details</h4>
                  <div className="space-y-2 text-sm">
                    <div>Date: {formatDate(parseLocalDate(selectedEvent.date), { formatString: 'PPP' })}</div>
                    <div>Time: {selectedEvent.startTime} - {selectedEvent.endTime}</div>
                    <div>Program: {selectedEvent.programName}</div>
                    <div>Instructor: {selectedEvent.instructorName || 'Not assigned'}</div>
                    <div>Status: {getStatusBadge(selectedEvent.status || 'scheduled')}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Enrollment</h4>
                  <div className="space-y-2 text-sm">
                    <div>Enrolled: {selectedEvent.enrollmentStats.enrolled}</div>
                    <div>Capacity: {selectedEvent.enrollmentStats.capacity}</div>
                    <div>Waitlist: {selectedEvent.enrollmentStats.waitlist}</div>
                    <div>Capacity: {getCapacityBadge(selectedEvent.enrollmentStats.enrolled, selectedEvent.enrollmentStats.capacity)}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Administrative Status</h4>
                <div className="space-y-2 text-sm">
                  <div>Attendance Recorded: {selectedEvent.attendanceRecorded ? '✅ Yes' : '❌ No'}</div>
                  <div>Session Generated: {selectedEvent.sessionGenerated ? '✅ Yes' : '❌ No'}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button asChild size="sm">
                  <Link to={"/admin/classes/" + selectedEvent.classId + "/sessions"}>Manage Sessions</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={"/admin/enrollments?class=" + selectedEvent.classId}>View Enrollments</Link>
                </Button>
                {selectedEvent.adminActions.canRecordAttendance && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={"/admin/attendance/record?session=" + selectedEvent.sessionId}>Record Attendance</Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
