import { useState } from 'react';
import { Link } from "@remix-run/react";
import { ModeToggle } from "./mode-toggle";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <img src="/logo.svg" alt="Karate Greenegin Logo" className="h-10 w-10 mr-4" />
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-green-600 dark:text-green-400 font-bold text-xl">KARATE GREENEGIN</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex md:space-x-8 md:items-center">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/classes">Classes</NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </nav>

          <div className="flex items-center space-x-4">
            <ModeToggle />
            <Link
              to="/login"
              className="hidden md:inline-block bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Login
            </Link>
            
            {/* Mobile Menu Button */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsOpen(!isOpen)}
                >
                  {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </SheetTrigger>

              <SheetContent 
                side="right" 
                className="w-[300px] sm:w-[400px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700"
              >
                <div className="flex flex-col space-y-4 mt-6">
                  <MobileNavLink to="/" onClick={() => setIsOpen(false)}>
                    Home
                  </MobileNavLink>
                  <MobileNavLink to="/classes" onClick={() => setIsOpen(false)}>
                    Classes
                  </MobileNavLink>
                  <MobileNavLink to="/about" onClick={() => setIsOpen(false)}>
                    About
                  </MobileNavLink>
                  <MobileNavLink to="/contact" onClick={() => setIsOpen(false)}>
                    Contact
                  </MobileNavLink>
                  <MobileNavLink to="/login" onClick={() => setIsOpen(false)}>
                    Login
                  </MobileNavLink>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 text-sm font-medium"
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ to, children, onClick }: { 
  to: string; 
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="px-4 py-3 text-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors
               text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400"
    >
      {children}
    </Link>
  );
}
