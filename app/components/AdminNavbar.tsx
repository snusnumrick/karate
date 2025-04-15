import React, { useState } from 'react';
import { Form, Link, useLocation } from "@remix-run/react"; // Import useLocation
import { ModeToggle } from "./mode-toggle";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import {
    CalendarCheck, CreditCard, FileText, LayoutDashboard, LogOut, Menu, Sun, User, Users, X,
    ShoppingBag, Package, ListOrdered, Boxes // Added Store related icons & Boxes for Inventory
} from "lucide-react";
import { ClientOnly } from './client-only'; // Import ClientOnly
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"; // Import DropdownMenu components
import { cn } from "~/lib/utils"; // Import cn utility

// Define navigation items for reuse
const adminNavItems = [
    {to: "/admin", label: "Dashboard", icon: LayoutDashboard},
    {to: "/admin/families", label: "Families", icon: Users},
    {to: "/admin/students", label: "Students", icon: User},
    {to: "/admin/payments", label: "Payments", icon: CreditCard},
    {to: "/admin/waivers", label: "Waivers", icon: FileText},
    {to: "/admin/attendance", label: "Attendance", icon: CalendarCheck},
    // Store items will be handled by the Dropdown below
];

// Define Store navigation items
const storeNavItems = [
    { to: "/admin/store/products", label: "Products", icon: Package },
    { to: "/admin/store/inventory", label: "Inventory", icon: Boxes }, // Uncommented Inventory
    { to: "/admin/store/orders", label: "Orders", icon: ListOrdered },
];


export default function AdminNavbar() {
    const [isOpen, setIsOpen] = useState(false);
    // const location = useLocation(); // Get current location - Removed as it's unused here

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
                        {/* Store Dropdown */}
                        <AdminStoreDropdown />
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
                                            {/* Store Mobile Links */}
                                            <div className="px-4 pt-4 pb-2">
                                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Store</p>
                                            </div>
                                            {storeNavItems.map((item) => (
                                                <AdminMobileNavLink key={item.to} to={item.to} onClick={() => setIsOpen(false)}>
                                                    <item.icon className="h-5 w-5 mr-2 inline-block"/>
                                                    {item.label}
                                                </AdminMobileNavLink>
                                            ))}
                                            {/* Mobile Logout */}
                                            <Form action="/logout" method="post" className="mt-auto pt-4 px-4"> {/* Use mt-auto to push logout down */}
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
function AdminNavLink({ to, children }: { to: string; children: React.ReactNode }) {
    const location = useLocation();
    const isActive = location.pathname === to || (to !== '/admin' && location.pathname.startsWith(to)); // Basic active check

    return (
        <Link
            to={to}
            className={cn(
                "text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center",
                isActive && "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30" // Active style
            )}
        >
            {children}
        </Link>
    );
}

// Store Dropdown Component for Desktop
function AdminStoreDropdown() {
    const location = useLocation();
    const isStoreActive = location.pathname.startsWith('/admin/store');

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className={cn(
                        "text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center hover:bg-transparent dark:hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
                         isStoreActive && "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30" // Active style on trigger
                    )}
                >
                    <ShoppingBag className="h-4 w-4 mr-1 inline-block" />
                    Store
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {/* <DropdownMenuLabel>Store Management</DropdownMenuLabel> */}
                {/* <DropdownMenuSeparator /> */}
                {storeNavItems.map((item) => (
                    // Removed asChild as a test for the React.Children.only error
                    <DropdownMenuItem key={item.to} className="p-0"> {/* Remove padding from item */}
                        {/* Apply styling directly to Link */}
                        <Link
                            to={item.to}
                            className="flex items-center cursor-pointer w-full px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 rounded-sm"
                        >
                            <item.icon className="h-4 w-4 mr-2" />
                            {item.label}
                        </Link>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// Reusable NavLink component for Admin Mobile
function AdminMobileNavLink({ to, children, onClick }: {
    to: string;
    children: React.ReactNode;
    onClick: () => void;
}) {
    const location = useLocation();
    const isActive = location.pathname === to || (to !== '/admin' && location.pathname.startsWith(to)); // Basic active check

    return (
        <Link
            to={to}
            onClick={onClick}
            className={cn(
                "px-4 py-3 text-base font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 flex items-center",
                isActive && "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50" // Active style for mobile
            )}
        >
            {children}
        </Link>
    );
}
