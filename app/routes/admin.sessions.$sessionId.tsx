import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { Calendar, Clock, Users, AlertTriangle, CheckCircle, XCircle, Edit, ListChecks, BookOpen } from "lucide-react";
import { formatDate } from "~/utils/misc";
import { format, parseISO } from "date-fns";

type LoaderData = {
  session: {
    id: string;
    session_date: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
    class: {
      id: string;
      name: string;
      max_capacity: number | null;
      program: {
        id: string;
        name: string;
      };
      instructor: {
        id: string;
        first_name: string;
        last_name: string;
      } | null;
    };
  };
  enrollmentStats: {
    enrolled: number;
    capacity: number;
    waitlist: number;
  };
  attendanceRecorded: boolean;
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { sessionId } = params;

  if (!sessionId) {
    throw new Response("Session ID is required", { status: 400 });
  }

  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return redirect("/login?redirectTo=/admin/sessions", { headers });
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

  try {
    // Fetch the session with class and program info
    const { data: session, error: sessionError } = await supabaseServer
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
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('Error fetching session by ID:', sessionError);
      throw new Response("Session not found", { status: 404 });
    }

    // Get enrollment counts for this class
    const { data: enrollmentsData } = await supabaseServer
      .from('enrollments')
      .select('class_id, status')
      .eq('class_id', session.class_id);

    let enrolled = 0;
    let waitlist = 0;

    (enrollmentsData || []).forEach(enrollment => {
      if (enrollment.status === 'active' || enrollment.status === 'trial') {
        enrolled++;
      } else if (enrollment.status === 'waitlist') {
        waitlist++;
      }
    });

    // Check if attendance has been recorded
    const { data: attendanceData } = await supabaseServer
      .from('attendance')
      .select('id')
      .eq('class_session_id', sessionId)
      .limit(1);

    return json({
      session: {
        id: session.id,
        session_date: session.session_date,
        start_time: session.start_time,
        end_time: session.end_time,
        status: session.status,
        class: {
          id: session.classes.id,
          name: session.classes.name,
          max_capacity: session.classes.max_capacity,
          program: {
            id: session.classes.programs.id,
            name: session.classes.programs.name
          },
          instructor: session.classes.instructor
        }
      },
      enrollmentStats: {
        enrolled,
        capacity: session.classes.max_capacity || 0,
        waitlist
      },
      attendanceRecorded: (attendanceData?.length || 0) > 0
    }, { headers });
  } catch (error) {
    console.error('Error in loader:', error);
    throw new Response("Internal Server Error", { status: 500 });
  }
}

export default function SessionDetail() {
  const { session, enrollmentStats, attendanceRecorded } = useLoaderData<LoaderData>();

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

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '';
    return format(parseISO(`2000-01-01T${timeString}`), 'h:mm a');
  };

  const capacityPercentage = enrollmentStats.capacity
    ? Math.round((enrollmentStats.enrolled / enrollmentStats.capacity) * 100)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AppBreadcrumb items={breadcrumbPatterns.adminSessionDetail(
        session.id,
        session.class.name,
        formatDate(session.session_date, { formatString: 'MMM d, yyyy' })
      )} />

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{session.class.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            {getStatusBadge(session.status)}
            <Badge className="bg-blue-100 text-blue-800">{session.class.program.name}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to={`/admin/attendance/record?session=${session.id}`}>
              {attendanceRecorded ? <CheckCircle className="w-4 h-4 mr-2" /> : <Edit className="w-4 h-4 mr-2" />}
              {attendanceRecorded ? 'View Attendance' : 'Record Attendance'}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/admin/classes/${session.class.id}/sessions`}>
              <ListChecks className="w-4 h-4 mr-2" />
              {session.status === 'scheduled' ? 'Complete Session' : 'Manage Sessions'}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Session Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Session Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Date</div>
                <div className="text-lg">{formatDate(session.session_date, { formatString: 'EEEE, MMMM d, yyyy' })}</div>
              </div>
              {(session.start_time || session.end_time) && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Time</div>
                  <div className="flex items-center gap-2 text-lg">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {session.start_time && formatTime(session.start_time)}
                    {session.end_time && ` - ${formatTime(session.end_time)}`}
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-muted-foreground">Program</div>
                <div className="text-lg">{session.class.program.name}</div>
              </div>
              {session.class.instructor && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Instructor</div>
                  <div className="text-lg">
                    {session.class.instructor.first_name} {session.class.instructor.last_name}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enrollment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Enrollment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{enrollmentStats.enrolled}</div>
                  <div className="text-sm text-muted-foreground">Enrolled</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{enrollmentStats.capacity || 'Unlimited'}</div>
                  <div className="text-sm text-muted-foreground">Capacity</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{enrollmentStats.waitlist}</div>
                  <div className="text-sm text-muted-foreground">Waitlist</div>
                </div>
              </div>
              {enrollmentStats.capacity > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Capacity Status</span>
                    <span>{capacityPercentage}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        capacityPercentage >= 90 ? 'bg-destructive' :
                        capacityPercentage >= 70 ? 'bg-yellow-500' :
                        'bg-primary'
                      }`}
                      style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2">
                    {getCapacityBadge(enrollmentStats.enrolled, enrollmentStats.capacity)}
                  </div>
                </div>
              )}
              <Button className="w-full" asChild>
                <Link to={`/admin/enrollments?class=${session.class.id}`}>
                  View All Enrollments
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" asChild>
                <Link to={`/admin/attendance/record?session=${session.id}`}>
                  {attendanceRecorded ? <CheckCircle className="w-4 h-4 mr-2" /> : <Edit className="w-4 h-4 mr-2" />}
                  {attendanceRecorded ? 'View Attendance' : 'Record Attendance'}
                </Link>
              </Button>
              <Button className="w-full" variant="outline" asChild>
                <Link to={`/admin/classes/${session.class.id}/sessions`}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  {session.status === 'scheduled' ? 'Complete Session' : 'Manage Sessions'}
                </Link>
              </Button>
              <Button className="w-full" variant="outline" asChild>
                <Link to={`/admin/enrollments?class=${session.class.id}`}>
                  <Users className="w-4 h-4 mr-2" />
                  View Enrollments
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Administrative Status */}
          <Card>
            <CardHeader>
              <CardTitle>Administrative Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="font-medium text-muted-foreground">Attendance Recorded</div>
                <div className="flex items-center gap-2">
                  {attendanceRecorded ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-600">Yes</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                      <span>No</span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Class ID</div>
                <div className="font-mono text-xs">{session.class.id}</div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Session ID</div>
                <div className="font-mono text-xs">{session.id}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
