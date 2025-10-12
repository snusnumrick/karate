import { json, type LoaderFunctionArgs } from '@vercel/remix';
import { Link, useLoaderData } from '@remix-run/react';
import { addDays } from 'date-fns';
import type { UserRole } from '~/types/auth';
import {
  getInstructorSessionsWithDetails,
  resolveInstructorPortalContext,
} from '~/services/instructor.server';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { BookOpen, ExternalLink, Notebook } from 'lucide-react';
import type { InstructorRouteHandle } from '~/routes/instructor';
import { formatDate, getCurrentDateTimeInTimezone } from '~/utils/misc';

interface ResourceSummary {
  programId?: string;
  programName: string;
  description?: string | null;
  sessionCount: number;
}

interface ResourcesLoaderData {
  role: UserRole;
  resources: ResourceSummary[];
}

export const handle: InstructorRouteHandle = {
  breadcrumb: () => [{ label: 'Materials', href: '/instructor/resources' }],
};

export async function loader({ request }: LoaderFunctionArgs) {
  const context = await resolveInstructorPortalContext(request);
  const { role, viewInstructorId, supabaseAdmin, headers } = context;

  const today = getCurrentDateTimeInTimezone();
  const startDate = formatDate(today, { formatString: 'yyyy-MM-dd' });
  const endDate = formatDate(addDays(today, 14), { formatString: 'yyyy-MM-dd' });

  const sessions = await getInstructorSessionsWithDetails({
    instructorId: viewInstructorId,
    startDate,
    endDate,
    supabaseAdmin,
  });

  const resourceMap = new Map<string, ResourceSummary>();

  for (const session of sessions) {
    const program = session.session.class?.program;
    const key = program?.id ?? session.session.class?.id ?? session.session.id;
    const existing = resourceMap.get(key);

    if (existing) {
      existing.sessionCount += 1;
    } else {
      resourceMap.set(key, {
        programId: program?.id,
        programName: program?.name ?? session.session.class?.name ?? 'Class Material',
        description: program?.description,
        sessionCount: 1,
      });
    }
  }

  const resources = Array.from(resourceMap.values()).sort((a, b) => a.programName.localeCompare(b.programName));

  return json<ResourcesLoaderData>({ role, resources }, { headers });
}

export default function InstructorResourcesPage() {
  const data = useLoaderData<ResourcesLoaderData>();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="instructor-page-header-styles">Curriculum & Materials</h1>
        <p className="instructor-subheader-styles">Program descriptions and quick links to program management for reference before class.</p>
      </header>

      {data.resources.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.resources.map((resource) => (
            <Card key={resource.programName} className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    {resource.programName}
                  </span>
                  <span className="text-sm text-muted-foreground">{resource.sessionCount} upcoming session{resource.sessionCount === 1 ? '' : 's'}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {resource.description ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {resource.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No curriculum notes saved yet.</p>
                )}

                {resource.programId && (
                  <Button variant="outline" size="sm" className="flex items-center gap-2" asChild>
                    <Link to={`/admin/programs/${resource.programId}/edit`}>
                      View program in admin <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="instructor-empty-state-styles">
      <Notebook className="h-8 w-8" />
      <p className="text-lg font-semibold text-foreground">No materials queued</p>
      <p className="text-sm">Programs tied to this instructor will appear here with quick access links.</p>
    </div>
  );
}
