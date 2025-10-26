/**
 * Full-screen loading overlay for long-running form submissions
 * Provides visual feedback and prevents user interaction during processing
 */

import { Loader2 } from 'lucide-react';

interface FormLoadingOverlayProps {
  isVisible: boolean;
  title?: string;
  message?: string;
}

export function FormLoadingOverlay({
  isVisible,
  title = 'Processing...',
  message = 'Please wait while we process your request. This may take a few moments.',
}: FormLoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="alert"
      aria-live="assertive"
      aria-busy="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md mx-4 space-y-6">
        {/* Spinner */}
        <div className="flex justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-green-600 dark:text-green-400" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        </div>

        {/* Progress indicator */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div className="bg-green-600 dark:bg-green-400 h-full rounded-full animate-pulse"></div>
        </div>

        {/* Reassurance text */}
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          Please don&apos;t close this window or navigate away.
        </p>
      </div>
    </div>
  );
}
