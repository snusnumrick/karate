import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { getPrograms } from "~/services/program.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Plus, Edit, Calendar, Archive, Users } from "lucide-react";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { serializeMoney, fromCents, formatMoney, isPositive } from "~/utils/money";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);

  const url = new URL(request.url);
  const showInactive = url.searchParams.get('showInactive') === 'true';
  const filter = url.searchParams.get('filter') as 'all' | 'program' | 'seminar' | null;

  const programs = await getPrograms({
    is_active: showInactive ? undefined : true,
    engagement_type: filter === 'program' ? 'program' : filter === 'seminar' ? 'seminar' : undefined,
  });

  // Serialize Money objects for JSON transmission
  const serializedPrograms = programs.map(program => ({
    ...program,
    monthly_fee: program.monthly_fee ? serializeMoney(program.monthly_fee) : undefined,
    yearly_fee: program.yearly_fee ? serializeMoney(program.yearly_fee) : undefined,
    individual_session_fee: program.individual_session_fee ? serializeMoney(program.individual_session_fee) : undefined,
    registration_fee: program.registration_fee ? serializeMoney(program.registration_fee) : undefined,
  }));

  return json({ programs: serializedPrograms, showInactive, filter: filter || 'all' });
}

export default function ProgramsIndex() {
  const { programs, showInactive, filter } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Helper to format money from serialized MoneyJSON
  const formatProgramFee = (moneyJson: { amount: number; currency: string } | undefined) => {
    if (!moneyJson) return null;
    return fromCents(moneyJson.amount);
  };

  const handleToggleInactive = (checked: boolean) => {
    if (checked) {
      searchParams.set('showInactive', 'true');
    } else {
      searchParams.delete('showInactive');
    }
    setSearchParams(searchParams);
  };

  const handleFilterChange = (newFilter: string) => {
    if (newFilter === 'all') {
      searchParams.delete('filter');
    } else {
      searchParams.set('filter', newFilter);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="space-y-6">
      <AppBreadcrumb items={breadcrumbPatterns.adminPrograms()} className="mb-6" />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Programs & Seminars</h1>
          <p className="text-muted-foreground">
            Manage your martial arts programs, seminars, and their configurations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={handleToggleInactive}
            />
            <label
              htmlFor="show-inactive"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Show Inactive
            </label>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin/programs/new">
              <Plus className="h-4 w-4 mr-2" />
              New Program
            </Link>
          </Button>
          <Button asChild>
            <Link to="/admin/seminars/new">
              <Plus className="h-4 w-4 mr-2" />
              New Seminar
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => handleFilterChange('all')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            filter === 'all'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
        <button
          onClick={() => handleFilterChange('program')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            filter === 'program'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Programs
        </button>
        <button
          onClick={() => handleFilterChange('seminar')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            filter === 'seminar'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Seminars
        </button>
      </div>

      {programs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            {showInactive ? (
              <Archive className="h-12 w-12 text-muted-foreground mb-4" />
            ) : (
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
            )}
            <h3 className="text-lg font-semibold mb-2">
              {showInactive ? "No programs found" : "No active programs found"}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {showInactive
                ? "Create your first program to start managing classes and enrollments"
                : "All programs are currently inactive, or create your first program to get started"
              }
            </p>
            <div className="flex gap-2">
              {!showInactive && (
                <Button variant="outline" onClick={() => handleToggleInactive(true)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Show Inactive Programs
                </Button>
              )}
              <Button asChild>
                <Link to="/admin/programs/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Program
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => {
            const monthlyFee = formatProgramFee(program.monthly_fee);
            const yearlyFee = formatProgramFee(program.yearly_fee);
            const sessionFee = formatProgramFee(program.individual_session_fee);

            return (
              <Card key={program.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{program.name}</CardTitle>
                    <Badge variant={program.is_active ? "default" : "secondary"}>
                      {program.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {program.description && (
                    <CardDescription>{program.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center">
                        {monthlyFee && isPositive(monthlyFee) ? 'Monthly Fee:' :
                         yearlyFee && isPositive(yearlyFee) ? 'Yearly Fee:' :
                         sessionFee && isPositive(sessionFee) ? 'Session Fee:' : 'Monthly Fee:'}
                      </span>
                      <span>
                        {monthlyFee && isPositive(monthlyFee) ? formatMoney(monthlyFee, { showCurrency: true, trimTrailingZeros: true }) :
                         yearlyFee && isPositive(yearlyFee) ? formatMoney(yearlyFee, { showCurrency: true, trimTrailingZeros: true }) :
                         sessionFee && isPositive(sessionFee) ? formatMoney(sessionFee, { showCurrency: true, trimTrailingZeros: true }) : 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Duration:
                      </span>
                      <span>{program.duration_minutes} minutes</span>
                    </div>

                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link to={`/admin/programs/${program.id}/edit`}>
                        <Edit className="h-4 w-4 mr-1" />
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