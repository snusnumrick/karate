import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams, useRouteError } from "@remix-run/react";
import { useState } from "react";
import type { Database } from "~/types/database.types";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Calendar as CalendarIcon } from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  parseISO
} from "date-fns";
import { Calendar } from "~/components/calendar";
import type { CalendarEvent } from "~/components/calendar/types";
import { sessionsToCalendarEvents, attendanceToCalendarEvents, formatLocalDate } from "~/components/calendar/utils";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";


// Define types
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name'>;
type AttendanceRow = {
  id: string;
  student_id: string;
  class_session_id: string;
  status: 'present' | 'absent' | 'excused' | 'late';
  students: Pick<StudentRow, 'first_name' | 'last_name'> | null;
  class_sessions: {
    id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    class_id: string;
    classes: {
      id: string;
      name: string;
    } | null;
  } | null;
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
  instructor?: {
    first_name: string;
    last_name: string;
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

type LoaderData = {
  students: StudentRow[];
  sessions: ClassSession[];
  attendance: AttendanceRow[];
  enrollments: EnrollmentWithClass[];
  familyName: string | null;
  currentMonth: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    console.log('Family Calendar Loader: Starting...');
    
    const { supabaseServer, response } = getSupabaseServerClient(request);
    const headers = response.headers;
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
      console.log('Family Calendar Loader: No authenticated user, redirecting to login');
      return redirect("/login?redirectTo=/family/calendar", { headers });
    }
    console.log('Family Calendar Loader: User authenticated:', user.id);

    // Get user's profile to find their family ID
    console.log('Family Calendar Loader: Fetching user profile...');
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Family Calendar Loader: Profile query error:', profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!profile || !profile.family_id) {
      console.error('Family Calendar Loader: No family found for user');
      return redirect("/family", { headers });
    }
    console.log('Family Calendar Loader: Family ID found:', profile.family_id);

    const familyId = profile.family_id;
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');
    const currentMonth = monthParam || format(new Date(), 'yyyy-MM');
    console.log('Family Calendar Loader: Current month:', currentMonth);

    // Fetch family name
    console.log('Family Calendar Loader: Fetching family data...');
    const { data: familyData, error: familyError } = await supabaseServer
      .from('families')
      .select('name')
      .eq('id', familyId)
      .single();
    
    if (familyError) {
      console.error('Family Calendar Loader: Family query error:', familyError);
    }
    const familyName = familyData?.name ?? null;
    console.log('Family Calendar Loader: Family name:', familyName);

    // Fetch students in the family
    console.log('Family Calendar Loader: Fetching students...');
    const { data: studentsData, error: studentsError } = await supabaseServer
      .from('students')
      .select('id, first_name, last_name')
      .eq('family_id', familyId)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (studentsError) {
      console.error('Family Calendar Loader: Students query error:', studentsError);
      throw new Error(`Failed to fetch students: ${studentsError.message}`);
    }
    const students = studentsData ?? [];
    const studentIds = students.map(s => s.id);
    console.log('Family Calendar Loader: Students found:', students.length);

    if (studentIds.length === 0) {
      console.log('Family Calendar Loader: No students found, returning empty data');
      return json({ students, sessions: [], attendance: [], enrollments: [], familyName, currentMonth }, { headers });
    }

    // Get date range for the month view (including surrounding weeks)
    const monthStart = startOfMonth(parseISO(currentMonth + '-01'));
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    console.log('Family Calendar Loader: Date range:', formatLocalDate(calendarStart), 'to', formatLocalDate(calendarEnd));

    // Fetch enrollments for students to get their classes
    console.log('Family Calendar Loader: Fetching enrollments...');
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

    if (enrollmentsError) {
      console.error('Family Calendar Loader: Enrollments query error:', enrollmentsError);
      throw new Error(`Failed to fetch enrollments: ${enrollmentsError.message}`);
    }
    const enrollments = enrollmentsData as EnrollmentWithClass[] ?? [];
    const classIds = enrollments.map(e => e.class_id);
    console.log('Family Calendar Loader: Enrollments found:', enrollments.length, 'Class IDs:', classIds);

    // Fetch upcoming class sessions for enrolled classes
    let upcomingSessions: ClassSession[] = [];
    if (classIds.length > 0) {
      console.log('Family Calendar Loader: Fetching class sessions...');
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
          ),
          instructor:profiles(
            first_name,
            last_name
          )
        `)
        .in('class_id', classIds)
        .gte('session_date', formatLocalDate(calendarStart))
        .lte('session_date', formatLocalDate(calendarEnd))
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (sessionsError) {
        console.error('Family Calendar Loader: Sessions query error:', sessionsError);
        throw new Error(`Failed to fetch class sessions: ${sessionsError.message}`);
      }
      upcomingSessions = sessionsData as ClassSession[] ?? [];
      console.log('Family Calendar Loader: Sessions found:', upcomingSessions.length);
    } else {
      console.log('Family Calendar Loader: No class IDs, skipping sessions fetch');
    }

    // Fetch attendance records for the date range
    console.log('Family Calendar Loader: Fetching attendance records...');
    const { data: attendanceData, error: attendanceError } = await supabaseServer
      .from('attendance')
      .select(`
        id,
        student_id,
        class_session_id,
        status,
        students ( 
          first_name, 
          last_name 
        ),
        class_sessions (
          id,
          session_date,
          start_time,
          end_time,
          class_id,
          classes (
            id,
            name
          )
        )
      `)
      .in('student_id', studentIds)
      .not('class_sessions', 'is', null)
      .gte('class_sessions.session_date', formatLocalDate(calendarStart))
      .lte('class_sessions.session_date', formatLocalDate(calendarEnd));

    if (attendanceError) {
      console.error('Family Calendar Loader: Attendance query error:', attendanceError);
      throw new Error(`Failed to fetch attendance records: ${attendanceError.message}`);
    }
    const attendanceRecords = attendanceData as AttendanceRow[] ?? [];
    console.log('Family Calendar Loader: Attendance records found:', attendanceRecords.length);

    const result = {
      students, 
      sessions: upcomingSessions, 
      attendance: attendanceRecords, 
      enrollments, 
      familyName, 
      currentMonth 
    };
    
    console.log('Family Calendar Loader: Success, returning data');
    return json(result, { headers });

  } catch (error) {
    console.error('Family Calendar Loader: Caught error:', error);
    
    if (error instanceof Response) {
      // Re-throw redirect responses
      throw error;
    }
    
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error('Family Calendar Loader: Error message:', message);
    
    // Log the full error for debugging
    if (error instanceof Error) {
      console.error('Family Calendar Loader: Error stack:', error.stack);
    }
    
    throw new Response(`Failed to load calendar data: ${message}`, { status: 500 });
  }
}

export default function FamilyCalendarPage() {
  const { students, sessions, attendance, enrollments, familyName, currentMonth } = useLoaderData<LoaderData>();
  const [, setSearchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(() => parseISO(currentMonth + '-01'));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Convert raw data to calendar events
  const studentList = students.map(s => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }));
  const sessionEvents = sessionsToCalendarEvents(sessions, enrollments, studentList);
  
  // Transform attendance data to match the expected format for the utility function
  const transformedAttendance = attendance.map(a => ({
    id: a.id,
    student_id: a.student_id,
    session_id: a.class_session_id, // Map class_session_id to session_id
    class_date: a.class_sessions?.session_date, // Get date from related session
    status: a.status as 'present' | 'absent' | 'excused' | 'late'
  }));
  
  const attendanceEvents = attendanceToCalendarEvents(
    transformedAttendance,
    sessions, 
    enrollments, 
    studentList
  );
  const allEvents = [...sessionEvents, ...attendanceEvents];

  const handleDateChange = (newDate: Date) => {
    setCurrentDate(newDate);
    const newMonth = format(newDate, 'yyyy-MM');
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('month', newMonth);
      return newParams;
    });
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const renderEventDetails = (event: CalendarEvent) => {
    if (event.type === 'session') {
      const getStatusBadgeVariant = (status?: string) => {
        switch (status) {
          case 'completed': return 'default';
          case 'cancelled': return 'destructive';
          case 'scheduled': 
          default: return 'secondary';
        }
      };

      return (
        <div className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Session
              </Badge>
              {event.status && (
                <Badge variant={getStatusBadgeVariant(event.status)}>
                  {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                </Badge>
              )}
            </div>
            {event.startTime && event.endTime && (
              <span className="text-sm font-medium">
                {event.startTime} - {event.endTime}
              </span>
            )}
          </div>
          <h4 className="font-semibold text-lg">{event.className}</h4>
          {event.programName && (
            <p className="text-gray-600 dark:text-gray-400">Program: {event.programName}</p>
          )}
          {event.studentNames && event.studentNames.length > 0 && (
            <div className="text-gray-600 dark:text-gray-400">
              <p className="font-medium">Enrolled Students:</p>
              <ul className="list-disc list-inside ml-2">
                {event.studentNames.map((studentName, index) => (
                  <li key={index}>{studentName}</li>
                ))}
              </ul>
            </div>
          )}
          {event.studentName && (
            <p className="text-gray-600 dark:text-gray-400">Student: {event.studentName}</p>
          )}
        </div>
      );
    } else if (event.type === 'attendance') {
      return (
        <div className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-2">
            <Badge variant={event.status === 'present' ? 'default' : 'destructive'}>
              {event.status?.toUpperCase()}
            </Badge>
          </div>
          <h4 className="font-semibold text-lg">Attendance Record</h4>
          <p className="text-gray-600 dark:text-gray-400">Class: {event.className}</p>
          {event.studentName && (
            <p className="text-gray-600 dark:text-gray-400">Student: {event.studentName}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="sm:container sm:mx-auto px-2 sm:px-4 py-4">
      <div className="px-2 sm:px-0">
        <AppBreadcrumb items={breadcrumbPatterns.familyCalendar()} className="mb-4" />

        <div className="mb-3 sm:mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
            <CalendarIcon className="inline-block mr-2 h-5 w-5 sm:h-6 sm:w-6" />
            <span className="hidden sm:inline">Calendar {familyName ? `for ${familyName}` : ''}</span>
            <span className="sm:hidden">Calendar</span>
          </h1>
        </div>
      </div>

      {/* Shared Calendar Component */}
      <div className="-mx-2 sm:mx-0">
        <Calendar
          events={allEvents}
          currentDate={currentDate}
          onDateChange={handleDateChange}
          onEventClick={handleEventClick}
          filterOptions={{
            students: studentList,
            selectedStudentId: 'all',
            onStudentChange: (studentId) => {
              // Handle student filter change if needed
              console.log('Student filter changed:', studentId);
            }
          }}
        />
      </div>

      {/* Legend */}
      <div className="mt-3 sm:mt-4 px-2 sm:px-0">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500 dark:border-blue-400 rounded text-xs text-blue-900 dark:text-blue-100 font-medium">
              Scheduled
            </div>
            <span>Scheduled class</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 border-l-2 border-green-500 dark:border-green-400 rounded text-xs text-green-900 dark:text-green-100 font-medium">
              Completed
            </div>
            <span>Completed class</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="px-2 py-1 bg-red-100 dark:bg-red-900/30 border-l-2 border-red-500 dark:border-red-400 rounded text-xs text-red-900 dark:text-red-100 font-medium">
              Cancelled
            </div>
            <span>Cancelled class</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="default" className="text-xs h-4 sm:h-5">Present</Badge>
            <span>Attended class</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="destructive" className="text-xs h-4 sm:h-5">Absent</Badge>
            <span>Missed class</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs h-4 sm:h-5">Late</Badge>
            <span>Arrived late</span>
          </div>
          <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
            <Badge variant="outline" className="text-xs h-4 sm:h-5">Excused</Badge>
            <span>Excused absence</span>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-4 px-2 sm:px-0">
        <Button asChild>
          <Link to="/family/attendance">Attendance History</Link>
        </Button>
      </div>

      {/* Event Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
             <DialogTitle>
               Event Details
             </DialogTitle>
           </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {selectedEvent && renderEventDetails(selectedEvent)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  
  console.error('Family Calendar Error:', error);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h1 className="text-xl font-bold text-red-800 mb-4">
          Error Loading Family Calendar
        </h1>
        <div className="text-red-700">
          {error instanceof Error ? (
            <div>
              <p className="font-semibold">Error Message:</p>
              <p className="mb-2">{error.message}</p>
              <p className="font-semibold">Stack Trace:</p>
              <pre className="text-sm bg-red-100 p-2 rounded overflow-auto">
                {error.stack}
              </pre>
            </div>
          ) : error instanceof Response ? (
            <div>
              <p className="font-semibold">HTTP Error:</p>
              <p>Status: {error.status}</p>
              <p>Status Text: {error.statusText}</p>
            </div>
          ) : (
            <div>
              <p className="font-semibold">Unknown Error:</p>
              <pre className="text-sm bg-red-100 p-2 rounded overflow-auto">
                {JSON.stringify(error, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <div className="mt-4">
          <Link 
            to="/family" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ← Back to Family Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
