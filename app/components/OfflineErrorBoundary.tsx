import React from 'react';
import { useRouteError, isRouteErrorResponse } from '@remix-run/react';
import { AlertCircle, WifiOff, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { getCachedFamilyData, getCachedUpcomingClasses, getCacheStatus } from '~/utils/offline-cache';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  currentBeltRank?: string;
}

interface CachedFamilyData {
  family?: {
    name?: string;
    students?: Student[];
  };
}

interface CachedSession {
  student_name: string;
  class_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
}

interface OfflineErrorBoundaryProps {
  children?: React.ReactNode;
}

export function OfflineErrorBoundary({ children }: OfflineErrorBoundaryProps) {
  const error = useRouteError();
  const [isOnline, setIsOnline] = React.useState(true);
  const [isRetrying, setIsRetrying] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    // Wait a moment for any network recovery
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.location.reload();
  };

  // Check if this is a network-related error
  const isNetworkError = React.useMemo(() => {
    if (isRouteErrorResponse(error)) {
      return error.status >= 500 || error.status === 0;
    }
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('network') || 
             message.includes('fetch') || 
             message.includes('offline') ||
             message.includes('connection');
    }
    
    return false;
  }, [error]);

  // If there's an error and we have fallback data, show offline mode
  if (error && (isNetworkError || !isOnline)) {
    const cachedFamilyData = getCachedFamilyData() as CachedFamilyData | null;
    const cachedUpcomingClasses = getCachedUpcomingClasses() as CachedSession[] | null;
    const cacheStatus = getCacheStatus();

    return (
      <div className="min-h-screen page-background-styles text-foreground p-4">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive" className="mb-6">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>Offline Mode</AlertTitle>
            <AlertDescription>
              You&apos;re currently offline. Showing cached data from your last visit.
              {cacheStatus.cacheAge && (
                <span className="block mt-1 text-sm">
                  Last updated: {Math.round(cacheStatus.cacheAge / (1000 * 60))} minutes ago
                </span>
              )}
            </AlertDescription>
          </Alert>
          
          {cachedFamilyData ? (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                  {cachedFamilyData.family?.name || 'Your Family Portal'} (Offline)
                </h1>
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                  Viewing cached data from your last visit.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cached Students */}
                {cachedFamilyData.family?.students && (
                  <div className="form-container-styles p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
                      My Students (Cached)
                    </h2>
                    <div className="space-y-3">
                      {cachedFamilyData.family.students.map((student: Student) => (
                        <div key={student.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {student.first_name} {student.last_name}
                          </p>
                          {student.currentBeltRank && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                              {student.currentBeltRank} Belt
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cached Upcoming Classes */}
                {cachedUpcomingClasses && cachedUpcomingClasses.length > 0 && (
                  <div className="form-container-styles p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
                      Upcoming Classes (Cached)
                    </h2>
                    <div className="space-y-3">
                      {cachedUpcomingClasses.slice(0, 3).map((session: CachedSession, index: number) => (
                        <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {session.student_name}
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-400">
                            {session.class_name}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {session.session_date} • {session.start_time} - {session.end_time}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <WifiOff className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Cached Data Available
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Please connect to the internet to load your family data.
              </p>
            </div>
          )}
          
          <div className="text-center mt-8">
            <Button 
              onClick={handleRetry}
              className="flex items-center gap-2 mx-auto"
              disabled={isRetrying}
            >
              {isRetrying ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // For other errors, show standard error boundary
  if (error) {
    let errorMessage = 'An unexpected error occurred.';
    let errorDetails = '';

    if (isRouteErrorResponse(error)) {
      errorMessage = error.statusText || `Error ${error.status}`;
      errorDetails = error.data?.message || '';
    } else if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || '';
    }

    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            {errorMessage}
            {errorDetails && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm">Technical details</summary>
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                  {errorDetails}
                </pre>
              </details>
            )}
          </AlertDescription>
        </Alert>
        
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}



// Hook to provide offline-aware data loading
export function useOfflineAwareData<T>(data: T, fallbackKey?: string): T {
  const [cachedData, setCachedData] = React.useState<T>(data);
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  React.useEffect(() => {
    if (data && isOnline) {
      setCachedData(data);
      
      // Cache data in localStorage if fallbackKey is provided
      if (fallbackKey) {
        try {
          localStorage.setItem(fallbackKey, JSON.stringify(data));
        } catch (error) {
          console.warn('Failed to cache data:', error);
        }
      }
    }
  }, [data, isOnline, fallbackKey]);

  React.useEffect(() => {
    // Load cached data on mount if offline and no data
    if (!isOnline && !data && fallbackKey) {
      try {
        const cached = localStorage.getItem(fallbackKey);
        if (cached) {
          setCachedData(JSON.parse(cached));
        }
      } catch (error) {
        console.warn('Failed to load cached data:', error);
      }
    }
  }, [isOnline, data, fallbackKey]);

  return cachedData;
}