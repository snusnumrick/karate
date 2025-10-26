/**
 * Banner component for displaying incomplete event registrations in the family portal
 * Allows users to resume or dismiss incomplete registrations
 */

import { Link, useFetcher } from '@remix-run/react';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { AlertCircle, Calendar, X, ArrowRight } from 'lucide-react';
import { formatDate } from '~/utils/misc';
import type { IncompleteRegistrationWithEvent } from '~/services/incomplete-registration.server';
import { getStepDescription, getResumeUrl } from '~/utils/incomplete-registration';

interface IncompleteRegistrationBannerProps {
  incompleteRegistrations: IncompleteRegistrationWithEvent[];
}

export function IncompleteRegistrationBanner({
  incompleteRegistrations,
}: IncompleteRegistrationBannerProps) {
  const dismissFetcher = useFetcher();

  if (!incompleteRegistrations || incompleteRegistrations.length === 0) {
    return null;
  }

  const handleDismiss = (id: string) => {
    dismissFetcher.submit(
      { intent: 'dismiss', incompleteRegistrationId: id },
      { method: 'post', action: '/family?index' }
    );
  };

  return (
    <div className="space-y-4 mb-6">
      {incompleteRegistrations.map((incompleteReg) => {
        const isDismissing =
          dismissFetcher.state === 'submitting' &&
          dismissFetcher.formData?.get('incompleteRegistrationId') === incompleteReg.id;

        // Don't show if currently being dismissed
        if (isDismissing) return null;

        const resumeUrl = getResumeUrl(incompleteReg);
        const stepDescription = getStepDescription(incompleteReg.current_step);

        return (
          <Alert
            key={incompleteReg.id}
            className="bg-amber-50 dark:bg-amber-900/20 border-amber-500 relative"
          >
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-900 dark:text-amber-100 font-semibold pr-8">
              Continue Your Event Registration
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300 mt-2">
              {/* Event Info */}
              <div className="mb-3">
                <div className="flex items-start gap-2 mb-1">
                  <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-100">
                      {incompleteReg.event.title}
                    </p>
                    {incompleteReg.event.start_date && (
                      <p className="text-sm">
                        {formatDate(incompleteReg.event.start_date, {
                          formatString: 'EEEE, MMMM d, yyyy',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Info */}
              <p className="text-sm mb-3">
                You started registering{' '}
                {incompleteReg.selected_student_ids.length > 0 && (
                  <span className="font-medium">
                    {incompleteReg.selected_student_ids.length} student
                    {incompleteReg.selected_student_ids.length !== 1 ? 's' : ''}
                  </span>
                )}{' '}
                for this event. Next step: <span className="font-medium">{stepDescription}</span>
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Link to={resumeUrl} className="inline-flex items-center gap-2">
                    Continue Registration
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleDismiss(incompleteReg.id)}
                  disabled={isDismissing}
                  className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
                >
                  Dismiss
                </Button>
              </div>

              {/* Expiry Notice */}
              <p className="text-xs mt-3 text-amber-600 dark:text-amber-400">
                This reminder will expire on{' '}
                {formatDate(incompleteReg.expires_at, { formatString: 'MMM d, yyyy' })}
              </p>
            </AlertDescription>

            {/* Close Button (Alternative to Dismiss button) */}
            <button
              type="button"
              onClick={() => handleDismiss(incompleteReg.id)}
              disabled={isDismissing}
              className="absolute top-4 right-4 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </Alert>
        );
      })}
    </div>
  );
}
