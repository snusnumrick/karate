import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Plus, Edit, Users, Calendar, Clock } from "lucide-react";
import { requireAdminUser } from "~/utils/auth.server";
import { getClasses, getClassById } from "~/services/class.server";
import { getPrograms } from "~/services/program.server";
import { getEnrollmentStats } from "~/services/enrollment.server";
import type { EnrollmentStats, ClassWithDetails, ClassFilters } from "~/types/multi-class";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { formatDate } from "~/utils/misc";
import { serializeMoney } from "~/utils/money";

type ClassWithStats = ClassWithDetails & {
  enrollmentStats: EnrollmentStats;
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);

  const url = new URL(request.url);
  const programId = url.searchParams.get("program");
  const engagementParam = url.searchParams.get("engagement");
  const engagementFilter = engagementParam === 'program' || engagementParam === 'seminar' ? engagementParam : null;

  const classFilters: ClassFilters = {
    is_active: true,
    ...(programId ? { program_id: programId } : {}),
    ...(engagementFilter ? { engagement_type: engagementFilter } : {}),
  };

  const [classes, programs] = await Promise.all([
    getClasses(classFilters),
    getPrograms()
  ]);

  // Get enrollment stats and detailed info for each class
  const classesWithStats = await Promise.all(
    classes.map(async (classItem) => {
      const [stats, classDetails] = await Promise.all([
        getEnrollmentStats(classItem.id),
        getClassById(classItem.id)
      ]);
      return {
        ...(classDetails || classItem),
        enrollmentStats: stats
      } as ClassWithStats;
    })
  );

  // Serialize Money objects in programs
  const serializedPrograms = programs.map(program => ({
    ...program,
    monthly_fee: program.monthly_fee ? serializeMoney(program.monthly_fee) : undefined,
    registration_fee: program.registration_fee ? serializeMoney(program.registration_fee) : undefined,
    yearly_fee: program.yearly_fee ? serializeMoney(program.yearly_fee) : undefined,
    individual_session_fee: program.individual_session_fee ? serializeMoney(program.individual_session_fee) : undefined,
  }));

  return json({
    classes: classesWithStats,
    programs: serializedPrograms,
    selectedProgramId: programId,
    engagementFilter,
  });
}

export default function AdminClassesIndex() {
  const { classes, programs, selectedProgramId, engagementFilter } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Infer types from the loader data
  type ProgramType = typeof programs[number];
  type ClassType = typeof classes[number];

  const handleProgramFilter = (programId: string) => {
    if (programId === "all") {
      searchParams.delete("program");
    } else {
      searchParams.set("program", programId);
    }
    setSearchParams(searchParams);
  };



  return (
    <div className="container mx-auto py-6">
      <AppBreadcrumb items={breadcrumbPatterns.adminClasses()} className="mb-6" />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground">
            Manage class schedules, capacity, and enrollment.
          </p>
          {engagementFilter === 'seminar' && (
            <Badge variant="secondary" className="mt-2">Showing seminar series</Badge>
          )}
        </div>

        <div className="flex gap-2">
          <Select value={selectedProgramId || "all"} onValueChange={handleProgramFilter}>
            <SelectTrigger className="w-48 input-custom-styles">
              <SelectValue placeholder="Filter by program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              {programs.map((program: ProgramType) => (
                <SelectItem key={program.id} value={program.id}>
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button asChild>
            <Link to="/admin/classes/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Class
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {classes.map((classItem: ClassType) => {
          const program = programs.find((p: ProgramType) => p.id === classItem.program_id);
          
          return (
            <Card key={classItem.id} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{classItem.name}</CardTitle>
                  <Badge variant={classItem.is_active ? "default" : "secondary"}>
                    {classItem.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription>
                  {program?.name} • {classItem.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {classItem.next_session ? (
(() => {
                          return `Next: ${formatDate(classItem.next_session.session_date, { formatString: 'EEE MMM d' })} at ${classItem.next_session.start_time.slice(0, 5)}`;
                        })()
                      ) : (
                        'No upcoming sessions'
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      {classItem.enrollmentStats.active_enrollments}
                      {classItem.max_capacity ? `/${classItem.max_capacity}` : ''} enrolled
                      {classItem.enrollmentStats.waitlist_count > 0 && (
                        <span className="text-orange-600 ml-1">
                          (+{classItem.enrollmentStats.waitlist_count} waitlist)
                        </span>
                      )}
                    </span>
                  </div>
                  
                  {classItem.instructor && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Instructor: {classItem.instructor.first_name} {classItem.instructor.last_name}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/admin/classes/${classItem.id}/edit`}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/admin/classes/${classItem.id}/sessions`}>
                      <Calendar className="h-4 w-4 mr-1" />
                      Sessions
                    </Link>
                  </Button>
                  
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/admin/enrollments?class=${classItem.id}`}>
                      <Users className="h-4 w-4 mr-1" />
                      Enrollments
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {classes.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No classes found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {selectedProgramId 
                ? "No classes found for the selected program."
                : "Get started by creating your first class."
              }
            </p>
            <Button asChild>
              <Link to="/admin/classes/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Class
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
