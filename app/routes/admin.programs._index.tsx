import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { withAdminLoader } from "~/utils/auth.server";
import { getPrograms } from "~/services/program.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Plus, Edit, Calendar, Archive, Users } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { serializeMoney, fromCents, formatMoney, isPositive } from "~/utils/money";
import { cn } from "~/lib/utils";

type EngagementFilter = "program" | "seminar";

function parseEngagementFilter(value: string | null): EngagementFilter | undefined {
  if (value === "program" || value === "seminar") {
    return value;
  }

  return undefined;
}

async function loaderImpl({ request }: LoaderFunctionArgs) {

  const url = new URL(request.url);
  const showInactive = url.searchParams.get('showInactive') === 'true';
  const engagementParam = url.searchParams.get('engagement') ?? url.searchParams.get('filter');
  const selectedEngagement = parseEngagementFilter(engagementParam);
  const programFilters = {
    ...(showInactive ? {} : { is_active: true }),
    ...(selectedEngagement ? { engagement_type: selectedEngagement } : {}),
  };

  const programs = await getPrograms(programFilters);

  // Serialize Money objects for JSON transmission
  const serializedPrograms = programs.map(program => ({
    ...program,
    monthly_fee: program.monthly_fee ? serializeMoney(program.monthly_fee) : undefined,
    yearly_fee: program.yearly_fee ? serializeMoney(program.yearly_fee) : undefined,
    individual_session_fee: program.individual_session_fee ? serializeMoney(program.individual_session_fee) : undefined,
    registration_fee: program.registration_fee ? serializeMoney(program.registration_fee) : undefined,
  }));

  return json({ programs: serializedPrograms, showInactive, selectedEngagement: selectedEngagement ?? null });
}

export const loader = withAdminLoader(loaderImpl);

export default function ProgramsIndex() {
  const { programs, showInactive, selectedEngagement } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSeminarView = selectedEngagement === "seminar";
  const pageTitle = isSeminarView ? "Seminar Templates" : "Programs";
  const pageDescription = isSeminarView
    ? "Manage seminar templates and keep them visually aligned with the rest of the admin experience."
    : "Manage your martial arts programs and keep pricing, duration, and availability aligned with the rest of the admin experience.";
  const createLabel = isSeminarView ? "New Seminar Template" : "New Program";
  const emptyStateTitle = showInactive
    ? isSeminarView ? "No seminar templates found" : "No programs found"
    : isSeminarView ? "No active seminar templates found" : "No active programs found";
  const primaryButtonClass = "bg-green-600 text-white shadow-sm hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500";
  const secondaryButtonClass = "border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/30 dark:hover:text-green-200";
  const activeBadgeClass = "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200";
  const inactiveBadgeClass = "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-700/70 dark:text-gray-200";

  // Helper to format money from serialized MoneyJSON
  const formatProgramFee = (moneyJson: { amount: number; currency: string } | undefined) => {
    if (!moneyJson) return null;
    return fromCents(moneyJson.amount);
  };

  const handleToggleInactive = (checked: boolean) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (checked) {
      nextSearchParams.set('showInactive', 'true');
    } else {
      nextSearchParams.delete('showInactive');
    }
    setSearchParams(nextSearchParams);
  };


  return (
    <div className="space-y-8">
      <AppBreadcrumb
        items={isSeminarView
          ? [{ label: "Admin Dashboard", href: "/admin" }, { label: "Seminar Templates", current: true }]
          : breadcrumbPatterns.adminPrograms()
        }
        className="mb-0"
      />

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Badge className={activeBadgeClass}>
              {showInactive ? "Showing active and inactive items" : "Showing active items"}
            </Badge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">{pageTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                {pageDescription}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center space-x-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
              <Checkbox
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={handleToggleInactive}
                className="border-green-600 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600"
              />
              <label
                htmlFor="show-inactive"
                className="text-sm font-medium leading-none text-gray-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
              >
                Show Inactive
              </label>
            </div>

            <Button asChild className={primaryButtonClass}>
              <Link to={isSeminarView ? "/admin/programs/new?engagement=seminar" : "/admin/programs/new"}>
                <Plus className="h-4 w-4" />
                {createLabel}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {programs.length === 0 ? (
        <Card className="border border-dashed border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 rounded-full bg-green-50 p-4 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              {showInactive ? (
                <Archive className="h-8 w-8" />
              ) : (
                <Users className="h-8 w-8" />
              )}
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {emptyStateTitle}
            </h3>
            <p className="mb-6 max-w-xl text-center text-sm text-gray-600 dark:text-gray-400">
              {showInactive
                ? isSeminarView
                  ? "Create your first seminar template to start managing seminars."
                  : "Create your first program to start managing classes and enrollments"
                : isSeminarView
                  ? "All seminar templates are currently inactive, or create your first seminar template to get started."
                  : "All programs are currently inactive, or create your first program to get started"
              }
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {!showInactive && (
                <Button variant="outline" className={secondaryButtonClass} onClick={() => handleToggleInactive(true)}>
                  <Archive className="h-4 w-4" />
                  Show Inactive Programs
                </Button>
              )}
              <Button asChild className={primaryButtonClass}>
                <Link to={isSeminarView ? "/admin/programs/new?engagement=seminar" : "/admin/programs/new"}>
                  <Plus className="h-4 w-4" />
                  {isSeminarView ? "Create Seminar Template" : "Create Program"}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((program) => {
            const monthlyFee = formatProgramFee(program.monthly_fee);
            const yearlyFee = formatProgramFee(program.yearly_fee);
            const sessionFee = formatProgramFee(program.individual_session_fee);
            const registrationFee = formatProgramFee(program.registration_fee);
            const isSeminarCard = program.engagement_type === 'seminar';
            const primaryFeeLabel = isSeminarCard ? "Registration Fee" :
              monthlyFee && isPositive(monthlyFee) ? "Monthly Fee" :
              yearlyFee && isPositive(yearlyFee) ? "Yearly Fee" :
              sessionFee && isPositive(sessionFee) ? "Session Fee" : "Monthly Fee";
            const primaryFeeValue = isSeminarCard
              ? (registrationFee && isPositive(registrationFee) ? formatMoney(registrationFee, { showCurrency: true, trimTrailingZeros: true }) : "Not set")
              : monthlyFee && isPositive(monthlyFee) ? formatMoney(monthlyFee, { showCurrency: true, trimTrailingZeros: true }) :
                yearlyFee && isPositive(yearlyFee) ? formatMoney(yearlyFee, { showCurrency: true, trimTrailingZeros: true }) :
                sessionFee && isPositive(sessionFee) ? formatMoney(sessionFee, { showCurrency: true, trimTrailingZeros: true }) : "Not set";

            return (
              <Card
                key={program.id}
                className={cn(
                  "overflow-hidden border border-gray-200 bg-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800",
                  program.is_active ? "border-l-4 border-l-green-600" : "border-l-4 border-l-gray-300 dark:border-l-gray-600"
                )}
              >
                <CardHeader className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/40">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        {isSeminarCard ? "Seminar Template" : "Recurring Program"}
                      </p>
                      <CardTitle className="text-lg text-gray-900 dark:text-gray-100">{program.name}</CardTitle>
                    </div>
                    <Badge className={program.is_active ? activeBadgeClass : inactiveBadgeClass}>
                      {program.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {program.description && (
                    <CardDescription className="line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
                      {program.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-sm">
                    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center font-medium text-gray-500 dark:text-gray-400">
                          <Users className="mr-2 h-4 w-4 text-green-600 dark:text-green-400" />
                          {primaryFeeLabel}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {primaryFeeValue}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
                      <span className="flex items-center font-medium text-gray-500 dark:text-gray-400">
                        <Calendar className="mr-2 h-4 w-4 text-green-600 dark:text-green-400" />
                        Duration
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {program.duration_minutes} minutes
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <Button asChild size="sm" variant="outline" className={cn("flex-1", secondaryButtonClass)}>
                      <Link to={`/admin/programs/${program.id}/edit`}>
                        <Edit className="h-4 w-4" />
                        Edit
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
