import { Link } from '@remix-run/react';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Calendar, Clock, BookOpen } from 'lucide-react';

interface SeminarEnrollment {
  id: string;
  status: string;
  class: {
    id: string;
    name: string;
    series_label?: string;
    series_start_on?: string;
    series_end_on?: string;
    series_session_quota?: number;
    program: {
      name: string;
      engagement_type: string;
    };
  };
  student: {
    id: string;
    first_name: string;
    last_name: string;
    is_adult: boolean;
  };
}

interface SeminarEnrollmentsCardProps {
  enrollments: SeminarEnrollment[];
  isAdult?: boolean;
}

export function SeminarEnrollmentsCard({ enrollments, isAdult = false }: SeminarEnrollmentsCardProps) {
  // Filter for only seminar enrollments
  const seminarEnrollments = enrollments.filter(
    (e) => e.class?.program?.engagement_type === 'seminar'
  );

  if (seminarEnrollments.length === 0) {
    return null;
  }

  const title = isAdult ? 'Your Seminars' : 'Seminar Enrollments';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {title}
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/curriculum?tab=seminars">Browse Seminars</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {seminarEnrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold">
                    {enrollment.class.program.name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {enrollment.class.series_label || enrollment.class.name}
                  </p>
                </div>
                <Badge
                  variant={
                    enrollment.status === 'active'
                      ? 'default'
                      : enrollment.status === 'completed'
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {enrollment.status}
                </Badge>
              </div>

              {!isAdult && (
                <p className="text-sm text-muted-foreground mb-2">
                  Participant: {enrollment.student.first_name} {enrollment.student.last_name}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm">
                {enrollment.class.series_start_on && enrollment.class.series_end_on && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {new Date(enrollment.class.series_start_on).toLocaleDateString()} -{' '}
                      {new Date(enrollment.class.series_end_on).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {enrollment.class.series_session_quota && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{enrollment.class.series_session_quota} sessions</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
