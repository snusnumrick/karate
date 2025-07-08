import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import type { Database } from "~/types/database.types";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addMonths, 
  subMonths, 
  isSameMonth, 
  isToday,
  parseISO
} from "date-fns";


// Define types
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>;
type AttendanceRow = Database['public']['Tables']['attendance']['Row'] & {
  students: Pick<StudentRow, 'first_name' | 'last_name'> | null;
};

type ClassSession = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  class_id: string;
  classes: {
    name: string;
    program_id: string;
    programs: {
      name: string;
    } | null;
  } | null;
};

type EnrollmentWithClass = {
  id: string;
  student_id: string;
  class_id: string;
  status: string;
  classes: {
    id: string;
    name: string;
    program_id: string;
    programs: {
      name: string;
    } | null;
  } | null;
};

type CalendarEvent = {
  type: 'session' | 'attendance';
  date: string;
  session?: ClassSession;
  attendance?: AttendanceRow;
  student_id: string;
  student_name: string;
};

type LoaderData = {
  students: StudentRow[];
  events: CalendarEvent[];
  familyName: string | null;
  currentMonth: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return redirect("/login?redirectTo=/family/calendar", { headers });
  }

  // Get user's profile to find their family ID
  const { data: profile, error: profileError } = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.family_id) {
    return redirect("/family", { headers });
  }

  const familyId = profile.family_id;
  const url = new URL(request.url);
  const monthParam = url.searchParams.get('month');
  const currentMonth = monthParam || format(new Date(), 'yyyy-MM');

  try {
    // Fetch family name
    const { data: familyData } = await supabaseServer
      .from('families')
      .select('name')
      .eq('id', familyId)
      .single();
    const familyName = familyData?.name ?? null;

    // Fetch students in the family
    const { data: studentsData, error: studentsError } = await supabaseServer
      .from('students')
      .select('id, first_name, last_name')
      .eq('family_id', familyId)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (studentsError) throw studentsError;
    const students = studentsData ?? [];
    const studentIds = students.map(s => s.id);

    if (studentIds.length === 0) {
      return json({ students, events: [], familyName, currentMonth }, { headers });
    }

    // Get date range for the month view (including surrounding weeks)
    const monthStart = startOfMonth(parseISO(currentMonth + '-01'));
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    // Fetch enrollments for students to get their classes
    const { data: enrollmentsData, error: enrollmentsError } = await supabaseServer
      .from('enrollments')
      .select(`
        id,
        student_id,
        class_id,
        status,
        classes (
          id,
          name,
          program_id,
          programs (
            name
          )
        )
      `)
      .in('student_id', studentIds)
      .eq('status', 'active');

    if (enrollmentsError) throw enrollmentsError;
    const enrollments = enrollmentsData as EnrollmentWithClass[] ?? [];
    const classIds = enrollments.map(e => e.class_id);

    // Fetch upcoming class sessions for enrolled classes
    let upcomingSessions: ClassSession[] = [];
    if (classIds.length > 0) {
      const { data: sessionsData, error: sessionsError } = await supabaseServer
        .from('class_sessions')
        .select(`
          id,
          session_date,
          start_time,
          end_time,
          status,
          class_id,
          classes (
            name,
            program_id,
            programs (
              name
            )
          )
        `)
        .in('class_id', classIds)
        .gte('session_date', format(calendarStart, 'yyyy-MM-dd'))
        .lte('session_date', format(calendarEnd, 'yyyy-MM-dd'))
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (sessionsError) throw sessionsError;
      upcomingSessions = sessionsData as ClassSession[] ?? [];
    }

    // Fetch attendance records for the date range
    const { data: attendanceData, error: attendanceError } = await supabaseServer
      .from('attendance')
      .select(`
        *,
        students ( first_name, last_name )
      `)
      .in('student_id', studentIds)
      .gte('class_date', format(calendarStart, 'yyyy-MM-dd'))
      .lte('class_date', format(calendarEnd, 'yyyy-MM-dd'))
      .order('class_date', { ascending: true });

    if (attendanceError) throw attendanceError;
    const attendanceRecords = attendanceData as AttendanceRow[] ?? [];

    // Combine sessions and attendance into calendar events
    const events: CalendarEvent[] = [];

    // Add session events
    upcomingSessions.forEach(session => {
      // Find which students are enrolled in this class
      const enrolledStudents = enrollments.filter(e => e.class_id === session.class_id);
      enrolledStudents.forEach(enrollment => {
        const student = students.find(s => s.id === enrollment.student_id);
        if (student) {
          events.push({
            type: 'session',
            date: session.session_date,
            session,
            student_id: student.id,
            student_name: `${student.first_name} ${student.last_name}`
          });
        }
      });
    });

    // Add attendance events
    attendanceRecords.forEach(attendance => {
      const student = students.find(s => s.id === attendance.student_id);
      if (student) {
        events.push({
          type: 'attendance',
          date: attendance.class_date,
          attendance,
          student_id: student.id,
          student_name: attendance.students ? 
            `${attendance.students.first_name} ${attendance.students.last_name}` : 
            `${student.first_name} ${student.last_name}`
        });
      }
    });

    return json({ students, events, familyName, currentMonth }, { headers });

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("Error in /family/calendar loader:", message);
    throw new Response(`Failed to load calendar data: ${message}`, { status: 500 });
  }
}

export default function FamilyCalendarPage() {
  const { students, events, familyName, currentMonth } = useLoaderData<LoaderData>();
  const [, setSearchParams] = useSearchParams();
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentDate = parseISO(currentMonth + '-01');
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  // Filter events by selected student
  const filteredEvents = selectedStudent === 'all' 
    ? events 
    : events.filter(event => event.student_id === selectedStudent);

  // Group events by date
  const eventsByDate = filteredEvents.reduce((acc, event) => {
    const dateKey = event.date;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  // Generate calendar days
  const calendarDays = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' 
      ? subMonths(currentDate, 1)
      : addMonths(currentDate, 1);
    const newMonth = format(newDate, 'yyyy-MM');
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('month', newMonth);
      return newParams;
    });
  };

  const getEventsForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return eventsByDate[dateKey] || [];
  };

  const handleDayClick = (date: Date) => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length > 0) {
      setSelectedDay(date);
      setIsModalOpen(true);
    }
  };

  const renderEventDetails = (event: CalendarEvent) => {
    if (event.type === 'session' && event.session) {
      return (
        <div className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-2">
            <Badge 
              variant={event.session.status === 'scheduled' ? 'default' : 
                     event.session.status === 'completed' ? 'secondary' : 'destructive'}
            >
              {event.session.status === 'scheduled' ? 'Scheduled' : 
               event.session.status === 'completed' ? 'Completed' : 'Cancelled'}
            </Badge>
            <span className="text-sm font-medium">
              {format(parseISO(`2000-01-01T${event.session.start_time}`), 'h:mm a')} - 
              {format(parseISO(`2000-01-01T${event.session.end_time}`), 'h:mm a')}
            </span>
          </div>
          <h4 className="font-semibold text-lg">{event.session.classes?.name || 'Class'}</h4>
          <p className="text-gray-600 dark:text-gray-400">Student: {event.student_name}</p>
          {event.session.instructor && (
            <p className="text-gray-600 dark:text-gray-400">Instructor: {event.session.instructor.first_name} {event.session.instructor.last_name}</p>
          )}
        </div>
      );
    } else if (event.type === 'attendance' && event.attendance) {
      return (
        <div className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-2">
            <Badge variant={event.attendance.present ? 'default' : 'destructive'}>
              {event.attendance.present ? 'Present' : 'Absent'}
            </Badge>
          </div>
          <h4 className="font-semibold text-lg">Attendance Record</h4>
          <p className="text-gray-600 dark:text-gray-400">Student: {event.student_name}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/family" className="text-blue-600 hover:underline mb-4 inline-block">
        &larr; Back to Family Portal
      </Link>
      
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          <CalendarIcon className="inline-block mr-2 h-8 w-8" />
          Calendar {familyName ? `for ${familyName}` : ''}
        </h1>
        
        {/* Student Filter */}
        <div className="flex items-center gap-4">
          <label htmlFor="student-filter" className="text-sm font-medium">Show events for:</label>
          <select 
            id="student-filter"
            value={selectedStudent} 
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="px-3 py-1 border rounded-md bg-white dark:bg-gray-800"
          >
            <option value="all">All Students</option>
            {students.map(student => (
              <option key={student.id} value={student.id}>
                {student.first_name} {student.last_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="outline" 
          onClick={() => navigateMonth('prev')}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <h2 className="text-xl font-semibold">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        
        <Button 
          variant="outline" 
          onClick={() => navigateMonth('next')}
          className="flex items-center gap-2"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center font-medium text-gray-500 dark:text-gray-400 border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Body */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dayEvents = getEventsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);
              
              return (
                <div 
                  key={index} 
                  className={`min-h-[120px] p-2 border-r border-b last:border-r-0 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    !isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'
                  } ${
                    isCurrentDay ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  } ${
                    dayEvents.length > 0 ? 'md:cursor-default' : ''
                  }`}
                  onClick={() => handleDayClick(day)}
                >
                  <div className={`text-sm font-medium mb-2 ${
                    !isCurrentMonth ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'
                  } ${
                    isCurrentDay ? 'text-blue-600 dark:text-blue-400' : ''
                  }`}>
                    {format(day, 'd')}
                  </div>
                  
                  <div className="space-y-1">
                    {/* Desktop view - show all events */}
                    <div className="hidden md:block">
                      {dayEvents.map((event, eventIndex) => (
                        <div key={eventIndex} className="text-xs">
                          {event.type === 'session' && event.session ? (
                            <Badge 
                              variant={event.session.status === 'scheduled' ? 'default' : 
                                     event.session.status === 'completed' ? 'secondary' : 'destructive'}
                              className="w-full justify-start text-xs p-1"
                            >
                              <div className="truncate">
                                {format(parseISO(`2000-01-01T${event.session.start_time}`), 'h:mm a')}
                                <br />
                                {event.session.classes?.name || 'Class'}
                                <br />
                                <span className="text-xs opacity-75">{event.student_name}</span>
                              </div>
                            </Badge>
                          ) : event.type === 'attendance' && event.attendance ? (
                            <Badge 
                              variant={event.attendance.present ? 'default' : 'destructive'}
                              className="w-full justify-start text-xs p-1"
                            >
                              <div className="truncate">
                                {event.attendance.present ? '✓ Present' : '✗ Absent'}
                                <br />
                                <span className="text-xs opacity-75">{event.student_name}</span>
                              </div>
                            </Badge>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    
                    {/* Mobile view - show event count indicator */}
                    <div className="md:hidden">
                      {dayEvents.length > 0 && (
                        <div className="text-xs text-center">
                          <Badge variant="outline" className="text-xs">
                            {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                          </Badge>
                          <div className="text-xs text-gray-500 mt-1">Tap to view</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-xs">Scheduled Session</Badge>
          <span>Upcoming class session</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Completed Session</Badge>
          <span>Past class session</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-xs">✓ Present</Badge>
          <span>Student attended</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-xs">✗ Absent</Badge>
          <span>Student was absent</span>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-8 flex gap-4">
        <Link to="/family/attendance">
          <Button variant="outline">View Attendance History</Button>
        </Link>
        <Link to="/family">
          <Button variant="outline">Back to Family Portal</Button>
        </Link>
      </div>

      {/* Mobile Day Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
             <DialogTitle>
               {selectedDay && format(selectedDay, 'EEEE, MMMM d, yyyy')}
             </DialogTitle>
           </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {selectedDay && getEventsForDate(selectedDay).map((event, index) => (
              <div key={index}>
                {renderEventDetails(event)}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}