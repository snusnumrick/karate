import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams, useRouteError } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import type { Database } from "~/types/database.types";
import { getSupabaseAdminClient, getSupabaseServerClient } from "~/utils/supabase.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek
} from "date-fns";
import { Calendar } from "~/components/calendar/Calendar";
import { CalendarLayout } from "~/components/calendar/CalendarLayout";
import { CalendarPageHeader } from "~/components/calendar/CalendarPageHeader";
import { CalendarFilters } from "~/components/calendar/CalendarFilters";
import { CalendarLegend } from "~/components/calendar/CalendarLegend";
import type { CalendarEvent } from "~/components/calendar/types";
import { sessionsToCalendarEvents, attendanceToCalendarEvents, formatLocalDate, birthdaysToCalendarEvents, parseLocalDate, expandMultiDayEvents, filterEventsByStudent } from "~/components/calendar/utils";
import { formatDate, getTodayLocalDateString } from "~/utils/misc";
import { requireUserId } from "~/utils/auth.server";
import { breadcrumbPatterns } from "~/components/AppBreadcrumb";


// Define types
type StudentRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'first_name' | 'last_name' | 'birth_date'>;
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

type EligibilityDetail = {
  studentId: string;
  studentName: string;
  eligible: boolean;
  reason: string;
  allIssues: Database['public']['Enums']['eligibility_reason_enum'][];
};

type EligibilityInfo = {
  status: 'eligible' | 'all_registered' | 'not_eligible';
  details: EligibilityDetail[];
};

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_type_id: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  status: string;
  visibility: 'public' | 'limited' | 'internal';
};

type EventRowWithEligibility = EventRow & { eligibilityInfo: EligibilityInfo };

type LoaderData = {
  students: StudentRow[];
  sessions: ClassSession[];
  attendance: AttendanceRow[];
  enrollments: EnrollmentWithClass[];
  events: EventRowWithEligibility[];
  familyName: string | null;
  currentMonth: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // console.log('Family Calendar Loader: Starting...');
    
    const userId = await requireUserId(request);
    const { supabaseServer: supabase } = getSupabaseServerClient(request);
    // console.log('Family Calendar Loader: User authenticated:', userId);

    // Get user's profile to find their family ID
    // console.log('Family Calendar Loader: Fetching user profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Family Calendar Loader: Profile query error:', profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!profile || !profile.family_id) {
      console.error('Family Calendar Loader: No family found for user');
      return redirect("/family");
    }
    // console.log('Family Calendar Loader: Family ID found:', profile.family_id);

    const familyId = profile.family_id;
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');
    const currentMonth = monthParam || getTodayLocalDateString().substring(0, 7);
    // console.log('Family Calendar Loader: Current month:', currentMonth);

    // Fetch family name
    // console.log('Family Calendar Loader: Fetching family data...');
    const { data: familyData, error: familyError } = await supabase
      .from('families')
      .select('name')
      .eq('id', familyId)
      .single();
    
    if (familyError) {
      console.error('Family Calendar Loader: Family query error:', familyError);
    }
    const familyName = familyData?.name ?? null;
    // console.log('Family Calendar Loader: Family name:', familyName);

    // Fetch students in the family
    // console.log('Family Calendar Loader: Fetching students...');
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, birth_date')
      .eq('family_id', familyId)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (studentsError) {
      console.error('Family Calendar Loader: Students query error:', studentsError);
      throw new Error(`Failed to fetch students: ${studentsError.message}`);
    }
    const students = studentsData ?? [];
    const studentIds = students.map(s => s.id);
    // console.log('Family Calendar Loader: Students found:', students.length);

    if (studentIds.length === 0) {
      console.log('Family Calendar Loader: No students found, returning empty data');
      return json({ students, sessions: [], attendance: [], enrollments: [], events: [], familyName, currentMonth });
    }

    // Get date range for the month view (including surrounding weeks)
    const monthStart = startOfMonth(parseLocalDate(currentMonth + '-01'));
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    // console.log('Family Calendar Loader: Date range:', formatLocalDate(calendarStart), 'to', formatLocalDate(calendarEnd));

    // Fetch enrollments for students to get their classes
    // console.log('Family Calendar Loader: Fetching enrollments...');
    const { data: enrollmentsData, error: enrollmentsError } = await supabase
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
    // console.log('Family Calendar Loader: Enrollments found:', enrollments.length, 'Class IDs:', classIds);

    // Fetch upcoming class sessions for enrolled classes
    let upcomingSessions: ClassSession[] = [];
    if (classIds.length > 0) {
      // console.log('Family Calendar Loader: Fetching class sessions...');
      const { data: sessionsData, error: sessionsError } = await supabase
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
      // console.log('Family Calendar Loader: Sessions found:', upcomingSessions.length);
    } else {
      console.log('Family Calendar Loader: No class IDs, skipping sessions fetch');
    }

    // Fetch attendance records for the date range
    // console.log('Family Calendar Loader: Fetching attendance records...');
    const { data: attendanceData, error: attendanceError } = await supabase
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
    // console.log('Family Calendar Loader: Attendance records found:', attendanceRecords.length);

    // Fetch events and check eligibility for family students
    // console.log('Family Calendar Loader: Fetching events...');
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        event_type_id,
        start_date,
        end_date,
        start_time,
        end_time,
        location,
        status,
        visibility
      `)
      .gte('start_date', formatLocalDate(calendarStart))
      .lte('start_date', formatLocalDate(calendarEnd))
      .in('status', ['published', 'registration_open'])
      .in('visibility', ['public', 'internal']) // Logged-in users can see public and internal events
      .order('start_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (eventsError) {
      console.error('Family Calendar Loader: Events query error:', eventsError);
      throw new Error(`Failed to fetch events: ${eventsError.message}`);
    }

    const allEvents = (eventsData || []) as EventRow[];
    // console.log('Family Calendar Loader: All events found:', allEvents.length);

    // Filter events and collect eligibility information for visual styling
    const visibleEventsWithEligibility: EventRowWithEligibility[] = [];
    
    // Create service role client for RPC calls
    const supabaseService = getSupabaseAdminClient();
    
    for (const event of allEvents) {
      let shouldShowEvent = false;
      const eligibilityDetails: EligibilityDetail[] = [];
      let eligibleStudents = 0;
      let registeredStudents = 0;
      
      // Check each student in the family to determine if event should be visible
      for (const student of students) {
        try {
          const { data: eligibilityResult, error: eligibilityError } = await supabaseService
            .rpc('check_event_registration_eligibility', {
              p_event_id: event.id,
              p_student_id: student.id
            });

          if (eligibilityError) {
            console.error(`Family Calendar Loader: Eligibility check error for student ${student.id}, event ${event.id}:`, eligibilityError);
            continue;
          }

          // Parse the JSON result
          const result = typeof eligibilityResult === 'string' ? JSON.parse(eligibilityResult) : eligibilityResult;
          
          // Store eligibility details for this student
          eligibilityDetails.push({
            studentId: student.id,
            studentName: `${student.first_name} ${student.last_name}`,
            eligible: result?.eligible === true,
            reason: result?.reason || 'unknown',
            allIssues: result?.all_issues || []
          });
          
          // Count eligible and registered students
          if (result?.eligible === true) {
            eligibleStudents++;
          }
          if (result?.reason === 'already_registered') {
            registeredStudents++;
          }
          
          // Define allowed reasons that should still show the event
          const allowedReasons = new Set([
            'already_registered',
            'registration_not_open',
            'registration_deadline_passed', 
            'event_full',
            'student_too_young',
            'student_too_old',
            'student_belt_rank_too_low',
            'student_belt_rank_too_high'
          ]);

          // Show event if student is eligible
          if (result?.eligible === true) {
            shouldShowEvent = true;
          } else if (result?.all_issues) {
            // Use all_issues array for comprehensive visibility logic
            const allIssues = result.all_issues as Database['public']['Enums']['eligibility_reason_enum'][];
            
            // Show event only if ALL issues are in the allowed list
            // This ensures we don't show events with fundamental problems
            const allIssuesAreAllowed = allIssues.length > 0 && allIssues.every(issue => allowedReasons.has(issue));
            
            if (allIssuesAreAllowed) {
              shouldShowEvent = true;
            }
          } else if (result?.reason) {
            // Fallback to single reason check for backward compatibility
            const reason = result.reason as Database['public']['Enums']['eligibility_reason_enum'];
            if (allowedReasons.has(reason)) {
              shouldShowEvent = true;
            }
          }
        } catch (error) {
          console.error(`Family Calendar Loader: Error checking eligibility for student ${student.id}, event ${event.id}:`, error);
          continue;
        }
      }
      
      if (shouldShowEvent) {
        // Determine overall eligibility status for visual styling
        let eligibilityStatus: 'eligible' | 'all_registered' | 'not_eligible';
        
        if (registeredStudents === students.length && students.length > 0) {
          eligibilityStatus = 'all_registered';
        } else if (eligibleStudents > 0) {
          eligibilityStatus = 'eligible';
        } else {
          eligibilityStatus = 'not_eligible';
        }
        
        visibleEventsWithEligibility.push({
          ...event,
          eligibilityInfo: {
            status: eligibilityStatus,
            details: eligibilityDetails
          }
        });
      }
    }
    
    // console.log('Family Calendar Loader: Visible events found:', visibleEventsWithEligibility.length);

    const result = {
      students, 
      sessions: upcomingSessions, 
      attendance: attendanceRecords, 
      enrollments, 
      events: visibleEventsWithEligibility,
      familyName, 
      currentMonth 
    };
    
    // console.log('Family Calendar Loader: Success, returning data');
    return json(result);

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
  const { students, sessions, attendance, enrollments, events, familyName, currentMonth } = useLoaderData<LoaderData>();
  const [currentDate, setCurrentDate] = useState(() => parseLocalDate(currentMonth + '-01'));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const scrollPositionRef = useRef<number>(0);

  // Convert raw data to calendar events
  const studentList = students.map((s: StudentRow) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }));
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
  ).map(event => ({
    ...event,
    studentId: transformedAttendance.find(a => a.id === event.attendanceId)?.student_id
  }));

  // Add birthday events (filter students with valid birth dates)
  const studentsWithBirthDates = students
    .filter((s): s is typeof s & { birth_date: string } => s.birth_date !== null)
    .map(s => ({
      ...s,
      birth_date: s.birth_date as string
    }));
  const birthdayEvents = birthdaysToCalendarEvents(studentsWithBirthDates, currentDate);
  
  // Transform events into CalendarEvent objects
  // console.log('Family Calendar: Raw events from loader:', events);
  const eventCalendarEvents: CalendarEvent[] = events.map((event: EventRowWithEligibility) => {
    const calendarEvent = {
      id: event.id,
      title: event.title,
      date: parseLocalDate(event.start_date), // Use parseLocalDate to avoid timezone issues
      type: 'event' as const,
      eventTypeId: event.event_type_id,
      startTime: event.start_time || undefined,
      endTime: event.end_time || undefined,
      location: event.location || undefined,
      description: event.description || undefined,
      endDate: event.end_date || undefined, // Include end date for multi-day events
      status: event.status === 'completed' ? 'completed' as const : 
              event.status === 'cancelled' ? 'cancelled' as const : 
              'scheduled' as const,
      // Add eligibility information for visual styling
      eligibilityStatus: event.eligibilityInfo?.status,
      eligibilityDetails: event.eligibilityInfo?.details,
    };
    // console.log('Family Calendar: Transformed event:', calendarEvent);
    return calendarEvent;
  });
  
  // Combine all events and expand multi-day events
  const combinedEvents = [...sessionEvents, ...attendanceEvents, ...birthdayEvents, ...eventCalendarEvents];
  
  // Expand multi-day events to show on all days
  const allEvents = expandMultiDayEvents(combinedEvents);
  // console.log('Family Calendar: All events for calendar:', allEvents);
  // console.log('Family Calendar: Session events:', sessionEvents);
  // console.log('Family Calendar: Attendance events:', attendanceEvents);
  // console.log('Family Calendar: Birthday events:', birthdayEvents);
  // console.log('Family Calendar: Event calendar events:', eventCalendarEvents);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedStudentId = searchParams.get('student') || 'all';

  // Filter events once the selection is known
  const filteredEvents = filterEventsByStudent(allEvents, selectedStudentId, studentList);

  // Restore scroll position after navigation
  useEffect(() => {
    if (scrollPositionRef.current > 0) {
      window.scrollTo(0, scrollPositionRef.current);
      scrollPositionRef.current = 0;
    }
  }, [currentMonth, selectedStudentId]);
  


  const handleDateChange = (newDate: Date) => {
    // Store current scroll position
    scrollPositionRef.current = window.scrollY;
    
    setCurrentDate(newDate);
    const newMonth = formatDate(newDate, { formatString: 'yyyy-MM' });
    
    // Update URL and trigger navigation to reload events
    const newParams = new URLSearchParams(searchParams);
    newParams.set('month', newMonth);
    setSearchParams(newParams);
  };

  const handleStudentChange = (studentId: string) => {
    // Store current scroll position
    scrollPositionRef.current = window.scrollY;
    
    // Update URL and trigger navigation
    const newParams = new URLSearchParams(searchParams);
    if (studentId === 'all') {
      newParams.delete('student');
    } else {
      newParams.set('student', studentId);
    }
    setSearchParams(newParams);
  };

  const handleEventClick = (event: CalendarEvent) => {
    // Show details for session and attendance types only
    // Event types now navigate directly to event page via Link component
    // Birthday types don't show details
    if (event.type === 'session' || event.type === 'attendance') {
      setSelectedEvent(event);
      setIsModalOpen(true);
    }
  };

  // Navigation functions for fixed arrows
  const handlePrevMonth = () => {
    const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    handleDateChange(prevMonth);
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    handleDateChange(nextMonth);
  };

  return (
    <CalendarLayout>
      <CalendarPageHeader
        title="Family Calendar"
        subtitle={familyName ? `View ${familyName} family's schedule and events` : 'View your family schedule and events'}
        icon={CalendarIcon}
        breadcrumbItems={breadcrumbPatterns.familyCalendar()}
      />
      
      {/* Calendar Filters */}
      <CalendarFilters
        students={studentList}
        selectedStudentId={selectedStudentId}
        onStudentChange={handleStudentChange}
      />

      {/* Calendar Component in Card */}
      <div className="form-container-styles p-2 backdrop-blur-lg mb-8 landscape-tablet:mb-2 landscape-tablet:p-1">
        <Calendar
          events={filteredEvents}
          currentDate={currentDate}
          onDateChange={handleDateChange}
          onEventClick={handleEventClick}
        />
      </div>

      {/* Legend */}
      <div className="landscape-tablet:hidden">
        <CalendarLegend />
      </div>

      {/* Event Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(selectedEvent.date, { formatString: 'EEEE, MMMM d, yyyy' })}
                </p>
                {selectedEvent.startTime && (
                  <p className="text-sm text-muted-foreground">
                    {selectedEvent.startTime}
                    {selectedEvent.endTime && ` - ${selectedEvent.endTime}`}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={selectedEvent.type === 'session' ? 'default' : 
                              selectedEvent.type === 'attendance' ? 'secondary' :
                              selectedEvent.type === 'event' ? 'outline' : 'default'}>
                  {selectedEvent.type}
                </Badge>
                {selectedEvent.status && (
                  <Badge variant={selectedEvent.status === 'completed' ? 'default' :
                                selectedEvent.status === 'cancelled' ? 'destructive' : 'outline'}>
                    {selectedEvent.status}
                  </Badge>
                )}
              </div>
              
              {selectedEvent.location && (
                <div>
                  <p className="text-sm font-medium">Location:</p>
                  <p className="text-sm text-muted-foreground">{selectedEvent.location}</p>
                </div>
              )}
              
              {selectedEvent.description && (
                <div>
                  <p className="text-sm font-medium">Description:</p>
                  <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                </div>
              )}
              
              {selectedEvent.studentName && (
                <div>
                  <p className="text-sm font-medium">Student:</p>
                  <p className="text-sm text-muted-foreground">{selectedEvent.studentName}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fixed navigation arrows - positioned relative to viewport */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePrevMonth}
        className="fixed left-2 top-1/2 transform -translate-y-1/2 z-50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 shadow-lg rounded-full w-10 h-10 p-0"
        title="Previous month"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleNextMonth}
        className="fixed right-2 top-1/2 transform -translate-y-1/2 z-50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 shadow-lg rounded-full w-10 h-10 p-0"
        title="Next month"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </CalendarLayout>
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
