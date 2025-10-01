import { Link } from '@remix-run/react';
import { Separator } from '~/components/ui/separator';

export default function InstructorFooter() {
  return (
    <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 text-sm text-gray-500 dark:text-gray-400 sm:px-6 lg:px-8">
        <Separator className="bg-gray-300 dark:bg-gray-600" />
        <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row">
          <span>Built for instructors to manage classes with confidence.</span>
          <Link to="https://www.ponto.studio/" className="hover:text-green-600 dark:hover:text-green-400">
            &copy; {new Date().getFullYear()} Ponto Studio
          </Link>
        </div>
      </div>
    </footer>
  );
}
