import { Link } from "@remix-run/react";
import { ModeToggle } from "./mode-toggle";

export default function Navbar() {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <img src="/logo.svg" alt="Karate Greenegin Logo" className="h-10 w-10 mr-4" />

            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-green-600 dark:text-green-400 font-bold text-xl">KARATE GREENEGIN</span>
            </Link>
            <nav className="hidden md:ml-6 md:flex md:space-x-8">
              <Link
                to="/"
                className="text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 text-sm font-medium"
              >
                Home
              </Link>
              <Link
                to="/classes"
                className="text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 text-sm font-medium"
              >
                Classes
              </Link>
              <Link
                to="/about"
                className="text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 text-sm font-medium"
              >
                About
              </Link>
              <Link
                to="/contact"
                className="text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 text-sm font-medium"
              >
                Contact
              </Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <ModeToggle />
            <Link
              to="/login"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
