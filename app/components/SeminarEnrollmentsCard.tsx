import { Link } from '@remix-run/react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Calendar, Clock, BookOpen } from 'lucide-react';

function extractPaymentId(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/\[seminar_pending_payment:([^:\]]+):/);
  return match ? match[1] : null;
}

interface SeminarEnrollment {
  id: string;
  status: string;
  notes?: string | null;
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
  const seminarEnrollments = enrollments.filter(
    (e) => e.class?.program?.engagement_type === 'seminar'
  );

  if (seminarEnrollments.length === 0) {
    return null;
  }

  const title = isAdult ? 'Your Seminars' : 'Seminar Enrollments';

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-600 rounded-lg">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>

      <div className="space-y-4">
        {seminarEnrollments.map((enrollment) => (
          <div
            key={enrollment.id}
            className="p-4 form-card-styles rounded-lg border-l-4 border-green-500 hover:shadow-md transition-shadow duration-300"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-bold text-gray-900 dark:text-gray-100">
                  {enrollment.class.program.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
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
                {enrollment.status === 'pending_payment' ? 'Pending Payment' : enrollment.status}
              </Badge>
            </div>

            {!isAdult && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Participant: {enrollment.student.first_name} {enrollment.student.last_name}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 text-sm">
              {enrollment.class.series_start_on && enrollment.class.series_end_on && (
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {new Date(enrollment.class.series_start_on).toLocaleDateString()} -{' '}
                    {new Date(enrollment.class.series_end_on).toLocaleDateString()}
                  </span>
                </div>
              )}
              {enrollment.class.series_session_quota && (
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Clock className="h-3 w-3" />
                  <span>{enrollment.class.series_session_quota} sessions</span>
                </div>
              )}
            </div>

            {enrollment.status === 'pending_payment' && (() => {
              const paymentId = extractPaymentId(enrollment.notes);
              return paymentId ? (
                <div className="mt-3">
                  <Button asChild size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                    <Link to={`/pay/${paymentId}`}>Complete Payment</Link>
                  </Button>
                </div>
              ) : null;
            })()}
          </div>
        ))}

        <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
          <Link to="/curriculum?tab=seminars" className="flex items-center justify-center gap-2">
            <BookOpen className="h-5 w-5" />
            Browse Seminars
          </Link>
        </Button>
      </div>
    </>
  );
}
