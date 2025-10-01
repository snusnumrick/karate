import React, { useState } from 'react';
import { Form, Link, useLocation } from '@remix-run/react';
import { ModeToggle } from './mode-toggle';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ClientOnly } from './client-only';
import { Button } from './ui/button';
import { cn } from '~/lib/utils';
import {
  CalendarDays,
  CheckSquare,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  NotebookText,
  Sun,
  Users,
  X,
} from 'lucide-react';

const instructorNavItems = [
  { to: '/instructor', label: 'Dashboard', icon: Home },
  { to: '/instructor/sessions', label: 'Schedule', icon: CalendarDays },
  { to: '/instructor/attendance', label: 'Attendance', icon: CheckSquare },
  { to: '/instructor/messages', label: 'Messages', icon: MessageSquare },
  { to: '/instructor/students', label: 'Students', icon: Users },
  { to: '/instructor/resources', label: 'Materials', icon: NotebookText },
] as const;

export default function InstructorNavbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={100}>
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <div className="relative h-10 w-53 mr-4">
                  <img
                    src="/logo-light.svg"
                    alt="Karate Greenegin Logo"
                    className="h-10 w-53 dark:hidden"
                  />
                  <img
                    src="/logo-dark.svg"
                    alt="Karate Greenegin Logo"
                    className="h-10 w-53 hidden dark:block"
                  />
                </div>
              </Link>
            </div>

            <nav className="hidden md:flex md:space-x-1 md:items-center">
              {instructorNavItems.map((item) => (
                <InstructorNavLink key={item.to} to={item.to} label={item.label}>
                  <item.icon className="h-5 w-5" />
                </InstructorNavLink>
              ))}
            </nav>

            <div className="flex items-center space-x-4">
              <ClientOnly
                fallback={
                  <Button variant="outline" size="icon" disabled>
                    <Sun className="h-[1.2rem] w-[1.2rem]" />
                    <span className="sr-only">Toggle theme</span>
                  </Button>
                }
              >
                {() => <ModeToggle />}
              </ClientOnly>

              <Form action="/logout" method="post" className="hidden md:inline-block">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="text-red-600 dark:text-red-400 border-red-600 dark:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300"
                >
                  <LogOut className="h-4 w-4 mr-1" /> Logout
                </Button>
              </Form>

              <ClientOnly
                fallback={
                  <Button variant="outline" size="icon" className="md:hidden" disabled>
                    <Menu className="h-5 w-5" />
                  </Button>
                }
              >
                {() => (
                  <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild className="md:hidden">
                      <Button variant="outline" size="icon" onClick={() => setIsOpen(!isOpen)}>
                        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                      </Button>
                    </SheetTrigger>

                    <SheetContent
                      side="right"
                      className="w-[300px] sm:w-[400px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-0 flex flex-col max-h-screen"
                    >
                      <div className="flex-1 overflow-y-auto py-4">
                        <SheetTitle className="px-4 mb-2">Instructor Portal</SheetTitle>
                        <div className="flex flex-col space-y-2 px-4">
                          {instructorNavItems.map((item) => (
                            <InstructorMobileNavLink key={item.to} to={item.to} onClick={() => setIsOpen(false)}>
                              <item.icon className="h-5 w-5 mr-2 inline-block" />
                              {item.label}
                            </InstructorMobileNavLink>
                          ))}

                          <Form action="/logout" method="post" className="mt-auto pt-4">
                            <Button
                              type="submit"
                              variant="outline"
                              className="w-full text-red-600 dark:text-red-400 border-red-600 dark:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300"
                              onClick={() => setIsOpen(false)}
                            >
                              <LogOut className="h-4 w-4 mr-1" /> Logout
                            </Button>
                          </Form>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                )}
              </ClientOnly>
            </div>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}

type InstructorNavLinkProps = {
  to: string;
  label: string;
  children: React.ReactNode;
};

function InstructorNavLink({ to, label, children }: InstructorNavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/instructor' && location.pathname.startsWith(to));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={to}
          className={cn(
            'text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 p-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700',
            isActive && 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
          )}
          aria-label={label}
        >
          {children}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function InstructorMobileNavLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/instructor' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
        isActive ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      )}
    >
      {children}
    </Link>
  );
}
