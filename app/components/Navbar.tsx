import { Link } from "@remix-run/react";
import { useState } from "react";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-green-600 text-white shadow-md dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-white font-bold text-xl hover:text-green-200">
                KARATE GREENEGIN
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/"
                className="border-transparent text-white hover:border-green-200 hover:text-green-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Home
              </Link>
              <Link
                to="/about"
                className="border-transparent text-white hover:border-green-200 hover:text-green-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                About
              </Link>
              <Link
                to="/classes"
                className="border-transparent text-white hover:border-green-200 hover:text-green-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Classes
              </Link>
              <Link
                to="/register"
                className="border-transparent text-white hover:border-green-200 hover:text-green-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Register
              </Link>
              <Link
                to="/contact"
                className="border-transparent text-white hover:border-green-200 hover:text-green-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Contact
              </Link>
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <Link
              to="/login"
              className="inline-flex items-center px-8 py-3 h-12 border border-transparent text-lg font-bold rounded-lg text-green-600 bg-white hover:bg-green-50"
            >
              Login
            </Link>
          </div>
          <div className="-mr-2 flex items-center sm:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:text-green-200 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-200"
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {!isMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="sm:hidden z-50 bg-green-700">
          <div className="pt-2 pb-3 space-y-1">
            <Link
              to="/"
              className="bg-green-800 border-green-200 text-white block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/about"
              className="border-transparent text-white hover:bg-green-800 hover:border-green-200 hover:text-green-200 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/classes"
              className="border-transparent text-white hover:bg-green-800 hover:border-green-200 hover:text-green-200 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Classes
            </Link>
            <Link
              to="/register"
              className="border-transparent text-white hover:bg-green-800 hover:border-green-200 hover:text-green-200 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Register
            </Link>
            <Link
              to="/contact"
              className="border-transparent text-white hover:bg-green-800 hover:border-green-200 hover:text-green-200 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </Link>
            <Link
              to="/login"
              className="block w-full text-center px-8 py-3 border border-transparent text-lg font-bold rounded-lg text-green-600 bg-white hover:bg-green-50 mt-4 mx-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
