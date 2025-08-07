import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  title?: string;
  message?: string;
  showSpinner?: boolean;
  className?: string;
}

export function LoadingScreen({ 
  title = "Loading...", 
  message = "Please wait while we load your content.",
  showSpinner = true,
  className = ""
}: LoadingScreenProps) {
  return (
    <div className={`min-h-screen page-background-styles text-foreground ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <div className="flex flex-col items-center gap-4">
            {showSpinner && (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            )}
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              {message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Specialized loading screens for different contexts
export function FamilyLoadingScreen() {
  return (
    <LoadingScreen 
      title="Loading Family Portal"
      message="Please wait while we load your family dashboard."
    />
  );
}

export function AdminLoadingScreen() {
  return (
    <LoadingScreen 
      title="Loading Admin Panel"
      message="Please wait while we load the administration interface."
    />
  );
}

export function PageLoadingScreen({ pageName }: { pageName: string }) {
  return (
    <LoadingScreen 
      title={`Loading ${pageName}`}
      message={`Please wait while we load the ${pageName.toLowerCase()} page.`}
    />
  );
}