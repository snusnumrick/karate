import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { parseLocalDate } from "~/components/calendar/utils";
import { formatDate } from "~/utils/misc";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Calendar } from "~/components/calendar";
import type { CalendarEvent } from "~/components/calendar/types";
import { Calendar as CalendarIcon, Users, DollarSign, Clock, AlertTriangle, CheckCircle, XCircle, BookOpen, User, Filter } from "lucide-react";

// Enhanced admin calendar event interface
interface AdminCalendarEvent {
  // Base CalendarEvent properties
  id: string;
  title: string;
  date: Date;
  type: 'session' | 'attendance';
  status: 'scheduled' | 'completed' | 'cancelled';
  className?: string;
  sessionId?: string;
  classId?: string;
  programName?: string;
  startTime?: string;
  endTime?: string;
  
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
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return redirect("/login?redirectTo=/admin/calendar", { headers });
  }

  // Check if user is admin
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return redirect("/", { headers });
  }

  const url = new URL(request.url);
  const monthParam = url.searchParams.get('month');
  const programFilter = url.searchParams.get('program');
  const instructorFilter = url.searchParams.get('instructor');
  const statusFilter = url.searchParams.get('status');
  const currentMonth = monthParam || format(new Date(), 'yyyy-MM');

  try {
    // Get date range for the month view
    const monthStart = startOfMonth(parseLocalDate(currentMonth + '-01'));
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

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
    if (sessionsError) throw sessionsError;

    const sessions = sessionsData || [];

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

    // Transform sessions to admin calendar events
    const events: AdminCalendarEvent[] = sessions
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
        
        return {
          id: session.id,
          title: classData.name,
          date: parseLocalDate(session.session_date),
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

    // Calculate stats
    const totalCapacityPercentages = events.map(e => {
      const capacity = Math.max(e.enrollmentStats.capacity, 1);
      return e.enrollmentStats.enrolled / capacity;
    });
    
    const avgCapacityPercentage = totalCapacityPercentages.length > 0 
      ? totalCapacityPercentages.reduce((sum, percentage) => sum + percentage, 0) / totalCapacityPercentages.length
      : 0;

    const stats = {
      totalSessions: events.length,
      completedSessions: events.filter(e => e.status === 'completed').length,
      totalEnrollments: events.reduce((sum, e) => sum + e.enrollmentStats.enrolled, 0),
      averageCapacity: Math.round(avgCapacityPercentage * 100)
    };

    return json({
      events,
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
      programs: [],
      instructors: [],
      filters: {},
      stats: { totalSessions: 0, completedSessions: 0, totalEnrollments: 0, averageCapacity: 0 }
    }, { headers });
  }
}

export default function AdminCalendar() {
  const { events, programs, instructors, filters, stats } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const [selectedEvent, setSelectedEvent] = useState<AdminCalendarEvent | null>(null);
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
    // Store current scroll position
    const currentScrollY = window.scrollY;
    
    // Update URL without triggering navigation
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all' || !value) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    window.history.replaceState(null, '', newUrl);
    
    // Restore scroll position immediately
    window.scrollTo(0, currentScrollY);
  };

  const handleEventClick = (event: CalendarEvent) => {
    // Find the corresponding AdminCalendarEvent
    const adminEvent = events.find(e => e.id === event.id);
    if (adminEvent) {
      setSelectedEvent(adminEvent);
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

  const calculateCompletionPercentage = () => {
    if (stats.totalSessions === 0) return 0;
    return Math.round((stats.completedSessions * 100) / stats.totalSessions);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Calendar</h1>
          <p className="text-sm text-muted-foreground">{formatDate(currentDate, { formatString: 'MMMM yyyy' })}</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                <SelectTrigger className="h-8 input-custom-styles">
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
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardContent className="p-3">
          <Calendar
            events={events.map(event => ({
              id: event.id,
              title: event.title,
              date: event.date,
              type: event.type,
              status: event.status, // Pass the session status for color coding
              className: event.className,
              sessionId: event.sessionId,
              classId: event.classId,
              programName: event.programName,
              startTime: event.startTime,
              endTime: event.endTime
            }))}
            currentDate={currentDate}
            onDateChange={handleDateChange}
            onEventClick={handleEventClick}
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Month/Year Header */}
      <div className="text-center py-2">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          {formatDate(currentDate, { formatString: 'MMMM yyyy' })} Overview
        </h2>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">Total Sessions</CardTitle>
            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-bold">{stats.totalSessions}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">Completed</CardTitle>
            <CheckCircle className="h-3 w-3 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-bold">{stats.completedSessions}</div>
            <p className="text-xs text-muted-foreground">
              {calculateCompletionPercentage()}%
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">Enrollments</CardTitle>
            <Users className="h-3 w-3 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-bold">{stats.totalEnrollments}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">Avg Capacity</CardTitle>
            <DollarSign className="h-3 w-3 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-bold">{stats.averageCapacity}%</div>
          </CardContent>
        </Card>
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
                    <div>Date: {formatDate(selectedEvent.date, { formatString: 'PPP' })}</div>
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
