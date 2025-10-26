/**
 * Reusable submit button component with loading state
 * Shows spinner and custom text during form submission
 */

import { Button } from '~/components/ui/button';
import { Loader2 } from 'lucide-react';

interface SubmitButtonWithLoadingProps {
  isSubmitting: boolean;
  defaultText: string;
  loadingText: string;
  className?: string;
  disabled?: boolean;
  testId?: string;
  tabIndex?: number;
}

export function SubmitButtonWithLoading({
  isSubmitting,
  defaultText,
  loadingText,
  className = '',
  disabled = false,
  testId,
  tabIndex,
}: SubmitButtonWithLoadingProps) {
  return (
    <Button
      type="submit"
      disabled={isSubmitting || disabled}
      className={className}
      data-testid={testId}
      tabIndex={tabIndex}
    >
      {isSubmitting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        defaultText
      )}
    </Button>
  );
}
