import React, {useState} from 'react';
import {Form, Link} from "@remix-run/react";
import {ModeToggle} from "./mode-toggle";
import {Sheet, SheetContent, SheetTrigger} from "./ui/sheet";
import {Button} from "./ui/button";
import {CalendarCheck, CreditCard, FileText, LayoutDashboard, LogOut, Menu, Sun, User, Users, X} from "lucide-react"; // Added Sun and icons
import {ClientOnly} from './client-only'; // Import ClientOnly

// Define navigation items for reuse
const adminNavItems = [
    {to: "/admin", label: "Dashboard", icon: LayoutDashboard},
    {to: "/admin/families", label: "Families", icon: Users},
    {to: "/admin/students", label: "Students", icon: User},
    {to: "/admin/payments", label: "Payments", icon: CreditCard},
    {to: "/admin/waivers", label: "Waivers", icon: FileText},
    {to: "/admin/attendance", label: "Attendance", icon: CalendarCheck},
];

export default function AdminNavbar() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        {/* Use the same logo as the main navbar */}
                        <div className="relative h-10 w-10 mr-4">
                            <img
                                src="/logo-light.svg"
                                alt="Karate Greenegin Logo"
                                className="h-full w-full dark:hidden"
                            />
                            <img
                                src="/logo-dark.svg"
                                alt="Karate Greenegin Logo"
                                className="h-full w-full hidden dark:block"
                            />
                        </div>
                        <Link to="/admin" className="flex-shrink-0 flex items-center">
                            <span className="text-green-600 dark:text-green-400 font-bold text-xl">ADMIN PANEL</span>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex md:space-x-4 md:items-center">
                        {adminNavItems.map((item) => (
                            <AdminNavLink key={item.to} to={item.to}>
                                <item.icon className="h-4 w-4 mr-1 inline-block"/>
                                {item.label}
                            </AdminNavLink>
                        ))}
                    </nav>

                    <div className="flex items-center space-x-4">
                        {/* Wrap ModeToggle in ClientOnly */}
                        <ClientOnly
                            fallback={
                                <Button variant="outline" size="icon" disabled>
                                    <Sun className="h-[1.2rem] w-[1.2rem]"/>
                                    <span className="sr-only">Toggle theme</span>
                                </Button>
                            }
                        >
                            {() => <ModeToggle/>}
                        </ClientOnly>
                        {/* Logout Form */}
                        <Form action="/logout" method="post" className="hidden md:inline-block">
                            <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                className="text-red-600 dark:text-red-400 border-red-600 dark:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300"
                            >
                                <LogOut className="h-4 w-4 mr-1"/> Logout
                            </Button>
                        </Form>

                        {/* Mobile Menu Button - Wrap Sheet in ClientOnly */}
                        <ClientOnly fallback={
                            <Button variant="outline" size="icon" className="md:hidden" disabled>
                                <Menu className="h-5 w-5" />
                            </Button>
                        }>
                            {() => (
                                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                                    <SheetTrigger asChild className="md:hidden">
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
                                        className="w-[300px] sm:w-[400px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700"
                                    >
                                        <div className="flex flex-col space-y-2 mt-6">
                                            {adminNavItems.map((item) => (
                                                <AdminMobileNavLink key={item.to} to={item.to} onClick={() => setIsOpen(false)}>
                                                    <item.icon className="h-5 w-5 mr-2 inline-block"/>
                                                    {item.label}
                                                </AdminMobileNavLink>
                                            ))}
                                            {/* Mobile Logout */}
                                            <Form action="/logout" method="post" className="mt-4 px-4">
                                                <Button
                                                    type="submit"
                                                    variant="outline"
                                                    className="w-full text-red-600 dark:text-red-400 border-red-600 dark:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300"
                                                    onClick={() => setIsOpen(false)}
                                                >
                                                    <LogOut className="h-4 w-4 mr-1"/> Logout
                                                </Button>
                                            </Form>
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            )}
                        </ClientOnly>
                    </div>
                </div>
            </div>
        </header>
    );
}

// Reusable NavLink component for Admin Desktop
function AdminNavLink({to, children}: { to: string; children: React.ReactNode }) {
    return (
        <Link
            to={to}
            className="text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center"
            // Add active styling if needed using useLocation hook from react-router-dom
        >
            {children}
        </Link>
    );
}

// Reusable NavLink component for Admin Mobile
function AdminMobileNavLink({to, children, onClick}: {
    to: string;
    children: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <Link
            to={to}
            onClick={onClick}
            className="px-4 py-3 text-base font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors
               text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 flex items-center"
            // Add active styling if needed
        >
            {children}
        </Link>
    );
}
