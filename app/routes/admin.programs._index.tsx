import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { requireAdminUser } from "~/utils/auth.server";
import { getPrograms } from "~/services/program.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Plus, Edit, Users, Calendar, DollarSign, Archive } from "lucide-react";
import type { Program } from "~/types/multi-class";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  
  const url = new URL(request.url);
  const showInactive = url.searchParams.get('showInactive') === 'true';
  
  const programs = await getPrograms(showInactive ? {} : { is_active: true });
  return json({ programs, showInactive });
}

export default function ProgramsIndex() {
  const { programs, showInactive } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleToggleInactive = (checked: boolean) => {
    if (checked) {
      searchParams.set('showInactive', 'true');
    } else {
      searchParams.delete('showInactive');
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="space-y-6">
      <AppBreadcrumb items={breadcrumbPatterns.adminPrograms()} className="mb-6" />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
          <p className="text-muted-foreground">
            Manage your martial arts programs and their configurations
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
          <Button asChild>
            <Link to="/admin/programs/new">
              <Plus className="h-4 w-4 mr-2" />
              New Program
            </Link>
          </Button>
        </div>
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
          {programs.map((program: Program) => (
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
                      <DollarSign className="h-4 w-4 mr-1" />
                      {program.monthly_fee ? 'Monthly Fee:' : 
                       program.yearly_fee ? 'Yearly Fee:' : 
                       program.individual_session_fee ? 'Session Fee:' : 'Monthly Fee:'}
                    </span>
                    <span>
                      {program.monthly_fee ? `$${program.monthly_fee}` : 
                       program.yearly_fee ? `$${program.yearly_fee}` : 
                       program.individual_session_fee ? `$${program.individual_session_fee}` : 'Not set'}
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
          ))}
        </div>
      )}
    </div>
  );
}