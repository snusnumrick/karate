import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Plus, Edit, Users, Calendar, Clock } from "lucide-react";
import { withAdminLoader } from "~/utils/auth.server";
import { getClasses, getClassById } from "~/services/class.server";
import { getPrograms } from "~/services/program.server";
import { getEnrollmentStats } from "~/services/enrollment.server";
import type { EnrollmentStats, ClassWithDetails } from "~/types/multi-class";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { formatDate } from "~/utils/misc";
import { serializeMoney } from "~/utils/money";
import { cn } from "~/lib/utils";

type ClassWithStats = ClassWithDetails & {
  enrollmentStats: EnrollmentStats;
};

type EngagementFilter = "program" | "seminar";

function parseEngagementFilter(value: string | null): EngagementFilter | undefined {
  if (value === "program" || value === "seminar") {
    return value;
  }

  return undefined;
}

async function loaderImpl({ request }: LoaderFunctionArgs) {

  const url = new URL(request.url);
  const programId = url.searchParams.get("program");
  const selectedEngagement = parseEngagementFilter(url.searchParams.get("engagement"));
  const classFilters = {
    is_active: true,
    ...(programId ? { program_id: programId } : {}),
    ...(selectedEngagement ? { engagement_type: selectedEngagement } : {}),
  };
  const programFilters = selectedEngagement ? { engagement_type: selectedEngagement } : {};

  const [classes, programs] = await Promise.all([
    getClasses(classFilters),
    getPrograms(programFilters)
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
    selectedEngagement: selectedEngagement ?? null,
  });
}

export const loader = withAdminLoader(loaderImpl);

export default function AdminClassesIndex() {
  const { classes, programs, selectedProgramId, selectedEngagement } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSeminarView = selectedEngagement === "seminar";
  const pageTitle = isSeminarView ? "Seminars" : "Classes";
  const pageDescription = isSeminarView
    ? "Manage seminar schedules, capacity, and enrollment with the same admin treatment used across the rest of the dashboard."
    : "Manage class schedules, capacity, and enrollment with the same admin treatment used across the rest of the dashboard.";
  const createLabel = isSeminarView ? "Create Seminar" : "Create Class";
  const createPath = isSeminarView ? "/admin/classes/new?engagement=seminar" : "/admin/classes/new";
  const primaryButtonClass = "bg-green-600 text-white shadow-sm hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500";
  const secondaryButtonClass = "border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/30 dark:hover:text-green-200";
  const activeBadgeClass = "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200";
  const inactiveBadgeClass = "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-700/70 dark:text-gray-200";
  const selectTriggerClass = "w-full input-custom-styles border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:w-48";
  const statLabelClass = "flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400";
  const statValueClass = "text-sm text-gray-900 dark:text-gray-100";

  // Infer types from the loader data
  type ProgramType = typeof programs[number];
  type ClassType = typeof classes[number];

  const handleProgramFilter = (programId: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (programId === "all") {
      nextSearchParams.delete("program");
    } else {
      nextSearchParams.set("program", programId);
    }
    setSearchParams(nextSearchParams);
  };

  const handleEngagementFilter = (engagement: "all" | "program" | "seminar") => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (engagement === "all") {
      nextSearchParams.delete("engagement");
    } else {
      nextSearchParams.set("engagement", engagement);
    }

    // Reset program selection when changing engagement to avoid stale filter combos.
    nextSearchParams.delete("program");
    setSearchParams(nextSearchParams);
  };



  return (
    <div className="space-y-8">
      <AppBreadcrumb
        items={isSeminarView
          ? [{ label: "Admin Dashboard", href: "/admin" }, { label: "Seminars", current: true }]
          : breadcrumbPatterns.adminClasses()
        }
        className="mb-0"
      />

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Badge className={activeBadgeClass}>
              {classes.length} {classes.length === 1 ? (isSeminarView ? "seminar" : "class") : (isSeminarView ? "seminars" : "classes")} shown
            </Badge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">
                {pageTitle}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                {pageDescription}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              {!isSeminarView && (
                <Select value={selectedEngagement || "all"} onValueChange={handleEngagementFilter}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="program">Program Classes</SelectItem>
                    <SelectItem value="seminar">Seminars</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Select value={selectedProgramId || "all"} onValueChange={handleProgramFilter}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder={isSeminarView ? "Filter by seminar template" : "Filter by program"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isSeminarView ? "All Seminar Templates" : "All Programs"}</SelectItem>
                  {programs.map((program: ProgramType) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button asChild className={cn("w-full sm:w-auto", primaryButtonClass)}>
                <Link to={createPath}>
                  <Plus className="h-4 w-4" />
                  {createLabel}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {classes.length === 0 && (
        <Card className="border border-dashed border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 rounded-full bg-green-50 p-4 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <Calendar className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{isSeminarView ? "No seminars found" : "No classes found"}</h3>
            <p className="mb-6 max-w-xl text-center text-sm text-gray-600 dark:text-gray-400">
              {selectedProgramId
                ? isSeminarView ? "No seminars found for the selected seminar template." : "No classes found for the selected program."
                : isSeminarView
                  ? "No seminars found for the selected filters."
                  : "Get started by creating your first class."}
            </p>
            <Button asChild className={primaryButtonClass}>
              <Link to={createPath}>
                <Plus className="h-4 w-4" />
                {createLabel}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {classes.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((classItem: ClassType) => {
            const program = programs.find((p: ProgramType) => p.id === classItem.program_id);
            const nextSessionLabel = classItem.next_session
              ? `Next: ${formatDate(classItem.next_session.session_date, { formatString: 'EEE MMM d' })} at ${classItem.next_session.start_time.slice(0, 5)}`
              : "No upcoming sessions";

            return (
              <Card
                key={classItem.id}
                className={cn(
                  "overflow-hidden border border-gray-200 bg-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800",
                  classItem.is_active ? "border-l-4 border-l-green-600" : "border-l-4 border-l-gray-300 dark:border-l-gray-600"
                )}
              >
                <CardHeader className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/40">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        {isSeminarView ? "Scheduled Seminar" : "Scheduled Class"}
                      </p>
                      <CardTitle className="text-lg text-gray-900 dark:text-gray-100">{classItem.name}</CardTitle>
                    </div>
                    <Badge className={classItem.is_active ? activeBadgeClass : inactiveBadgeClass}>
                      {classItem.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                    {program?.name || (isSeminarView ? "Unassigned seminar template" : "Unassigned program")}
                    {classItem.description ? ` • ${classItem.description}` : ""}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
                    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
                      <div className={statLabelClass}>
                        <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Next Session
                      </div>
                      <p className={cn(statValueClass, "mt-2")}>{nextSessionLabel}</p>
                    </div>

                    <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
                      <div className={statLabelClass}>
                        <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Enrollment
                      </div>
                      <p className={cn(statValueClass, "mt-2")}>
                        {classItem.enrollmentStats.active_enrollments}
                        {classItem.max_capacity ? `/${classItem.max_capacity}` : ''} enrolled
                        {classItem.enrollmentStats.waitlist_count > 0 && (
                          <span className="ml-2 text-orange-600 dark:text-orange-400">
                            +{classItem.enrollmentStats.waitlist_count} waitlist
                          </span>
                        )}
                      </p>
                    </div>

                    {classItem.instructor && (
                      <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
                        <div className={statLabelClass}>
                          <Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />
                          Instructor
                        </div>
                        <p className={cn(statValueClass, "mt-2")}>
                          {classItem.instructor.first_name} {classItem.instructor.last_name}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm" className={secondaryButtonClass}>
                      <Link to={`/admin/classes/${classItem.id}/edit`}>
                        <Edit className="h-4 w-4" />
                        Edit
                      </Link>
                    </Button>

                    <Button asChild variant="outline" size="sm" className={secondaryButtonClass}>
                      <Link to={`/admin/classes/${classItem.id}/sessions`}>
                        <Calendar className="h-4 w-4" />
                        Sessions
                      </Link>
                    </Button>

                    <Button asChild variant="outline" size="sm" className={secondaryButtonClass}>
                      <Link to={`/admin/enrollments?class=${classItem.id}`}>
                        <Users className="h-4 w-4" />
                        Enrollments
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
