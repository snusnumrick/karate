import * as React from 'react';
import {Form, Link} from "@remix-run/react";
import {ModeToggle} from "./mode-toggle";
import {Sheet, SheetContent, SheetTitle, SheetTrigger} from "./ui/sheet";
import {Button} from "./ui/button";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "./ui/tooltip";
import {LogOut, Menu, Sun, X} from "lucide-react";
import type { Session } from "@supabase/auth-helpers-remix";
import {ClientOnly} from './client-only';

interface PublicNavbarProps {
    user?: Session['user'] | null;
    isAdmin?: boolean;
}

export default function PublicNavbar({ user, isAdmin }: PublicNavbarProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <TooltipProvider delayDuration={100}>
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link to="/" className="flex items-center">
                                <div className="relative h-10 w-10 mr-4">
                                    <img
                                        src="/logo-light.svg"
                                        alt="Karate Greenegin Logo - Kids Martial Arts Victoria BC"
                                        className="h-full w-full dark:hidden"
                                    />
                                    <img
                                        src="/logo-dark.svg"
                                        alt="Karate Greenegin Logo - Kids Martial Arts Victoria BC, Dark Mode"
                                        className="h-full w-full hidden dark:block"
                                    />
                                </div>
                                <span className="text-green-600 dark:text-green-400 font-bold text-xl">KARATE GREENEGIN</span>
                            </Link>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden lg:flex lg:space-x-8 lg:items-center">
                            <NavLink to="/classes">Classes</NavLink>
                            <NavLink to="/about">About</NavLink>
                            {user && !isAdmin && (
                                <NavLink to="/family">Family Portal</NavLink>
                            )}
                            {user && isAdmin && (
                                <NavLink to="/admin">Admin Panel</NavLink>
                            )}
                        </nav>

                        {/* Right-side items */}
                        <div className="flex items-center space-x-2">
                            {/* Mode Toggle */}
                            <ClientOnly
                                fallback={
                                    <Button variant="outline" size="icon" disabled>
                                        <Sun className="h-[1.2rem] w-[1.2rem]"/>
                                        <span className="sr-only">Toggle theme</span>
                                    </Button>
                                }
                            >
                                {() => (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <ModeToggle/>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">
                                            <p>Toggle theme</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </ClientOnly>

                            {/* Desktop Auth Buttons */}
                            <ClientOnly fallback={<div className="hidden lg:block h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>}>
                                {() => user ? (
                                    <div className="hidden lg:flex items-center space-x-4">
                                        <Form action="/logout" method="post">
                                            <Button
                                                type="submit"
                                                variant="outline"
                                                size="sm"
                                                className="text-red-600 dark:text-red-400 border-red-600 dark:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <LogOut className="h-4 w-4 mr-1"/> Logout
                                            </Button>
                                        </Form>
                                    </div>
                                ) : (
                                    <Link
                                        to="/login"
                                        className="hidden lg:inline-block bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                                    >
                                        Login
                                    </Link>
                                )}
                            </ClientOnly>

                            {/* Mobile Menu Button */}
                            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                                <SheetTrigger asChild className="lg:hidden">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setIsOpen(!isOpen)}
                                    >
                                        {isOpen ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}
                                    </Button>
                                </SheetTrigger>

                                <SheetContent
                                    side="right"
                                    className="w-[300px] sm:w-[400px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-0 flex flex-col max-h-screen"
                                >
                                    <div className="flex-1 overflow-y-auto py-4">
                                        <SheetTitle className="px-4 mb-2">Navigation</SheetTitle>
                                        <div className="flex flex-col space-y-4 px-4">
                                            <MobileNavLink to="/classes" onClick={() => setIsOpen(false)}>
                                                Classes
                                            </MobileNavLink>
                                            <MobileNavLink to="/about" onClick={() => setIsOpen(false)}>
                                                About
                                            </MobileNavLink>

                                            {/* Mobile Auth Links */}
                                            {user ? (
                                                <>
                                                    {!isAdmin && (
                                                        <MobileNavLink to="/family" onClick={() => setIsOpen(false)}>
                                                            Family Portal
                                                        </MobileNavLink>
                                                    )}
                                                    {isAdmin && (
                                                        <MobileNavLink to="/admin" onClick={() => setIsOpen(false)}>
                                                            Admin Panel
                                                        </MobileNavLink>
                                                    )}
                                                    <Form action="/logout" method="post" className="mt-2">
                                                        <Button
                                                            type="submit"
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full justify-start text-red-600 dark:text-red-400 border-red-600 dark:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            onClick={() => setIsOpen(false)}
                                                        >
                                                            <LogOut className="h-5 w-5 mr-2 inline-block"/> Logout
                                                        </Button>
                                                    </Form>
                                                </>
                                            ) : (
                                                <MobileNavLink to="/login" onClick={() => setIsOpen(false)}>
                                                    Login
                                                </MobileNavLink>
                                            )}
                                        </div>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>
                </div>
            </header>
        </TooltipProvider>
    );
}

function NavLink({to, children}: { to: string; children: React.ReactNode }) {
    return (
        <Link
            to={to}
            className="text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 text-sm font-medium"
        >
            {children}
        </Link>
    );
}

function MobileNavLink({to, children, onClick}: {
    to: string;
    children: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <Link
            to={to}
            onClick={onClick}
            className="py-3 text-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors
               text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400"
        >
            {children}
        </Link>
    );
}