import React, {useState} from 'react';
import {Form, Link, useLocation} from "@remix-run/react"; // Import useLocation
import {ModeToggle} from "./mode-toggle";
import {Sheet, SheetContent, SheetTitle, SheetTrigger} from "./ui/sheet";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "./ui/tooltip"; // Import Tooltip components
// Note: MessageSquare was already added in the provided file content, no change needed here.
import {
    Boxes,
    Calendar,
    CalendarCheck,
    ChevronDown,
    ChevronRight,
    CreditCard,
    Database,
    FileText,
    GraduationCap,
    LayoutDashboard,
    ListOrdered,
    LogOut,
    Menu,
    MessageSquare,
    Package,
    ShoppingBag,
    Sun,
    Tag,
    User,
    Users,
    X,
    Zap
} from "lucide-react";
import {ClientOnly} from './client-only'; // Import ClientOnly
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,} from "~/components/ui/dropdown-menu"; // Import DropdownMenu components
import {cn} from "~/lib/utils";
import {Button} from "~/components/ui/button"; // Import cn utility

// Define navigation items for reuse
const adminNavItems = [
    {to: "/admin", label: "Dashboard", icon: LayoutDashboard},
    {to: "/admin/calendar", label: "Calendar", icon: Calendar},
    {to: "/admin/families", label: "Families", icon: Users},
    {to: "/admin/students", label: "Students", icon: User},
    {to: "/admin/payments", label: "Payments", icon: CreditCard},
    {to: "/admin/waivers", label: "Waivers", icon: FileText},
    {to: "/admin/attendance", label: "Attendance", icon: CalendarCheck},
    {to: "/admin/messages", label: "Messages", icon: MessageSquare},
    {to: "/admin/db-chat", label: "DB Chat", icon: Database},
    // Discount items will be handled by the Dropdown below
    // Store items will be handled by the Dropdown below
];

// Define Classes & Programs navigation items
const classNavItems = [
    {to: "/admin/programs", label: "Programs", icon: GraduationCap},
    {to: "/admin/classes", label: "Classes", icon: CalendarCheck},
    {to: "/admin/enrollments", label: "Enrollments", icon: Users},
];

// Define Discount navigation items
const discountNavItems = [
    {to: "/admin/discount-codes", label: "Discount Codes", icon: Tag},
    {to: "/admin/discount-templates", label: "Discount Templates", icon: FileText},
    {to: "/admin/automatic-discounts", label: "Automatic Discounts", icon: Zap},
];

// Define Store navigation items
const storeNavItems = [
    {to: "/admin/store/products", label: "Products", icon: Package},
    {to: "/admin/store/inventory", label: "Inventory", icon: Boxes}, // Uncommented Inventory
    {to: "/admin/store/orders", label: "Orders", icon: ListOrdered},
];


export default function AdminNavbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [isStoreMobileOpen, setIsStoreMobileOpen] = useState(false);
    const [isDiscountMobileOpen, setIsDiscountMobileOpen] = useState(false);
    const [isClassMobileOpen, setIsClassMobileOpen] = useState(false);
    // const location = useLocation(); // Get current location - Removed as it's unused here

    return (
        // Wrap the header content in TooltipProvider
        <TooltipProvider delayDuration={100}>
            <header
                className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            {/* Use the same logo as the main navbar */}
                            <Link to="/" className="relative h-10 w-43 mr-4">
                                <img
                                    src="/images/admin-logo-light.png"
                                    alt="Karate Greenegin Logo"
                                    className="h-full w-full dark:hidden"
                                />
                                <img
                                    src="/images/admin-logo-dark.png"
                                    alt="Karate Greenegin Logo"
                                    className="h-full w-full hidden dark:block"
                                />
                            </Link>
                        </div>

                        {/* Desktop Navigation - Icons only with Tooltips */}
                        <nav className="hidden md:flex md:space-x-1 md:items-center"> {/* Reduced space */}
                            {adminNavItems.map((item) => (
                                <AdminNavLink key={item.to} to={item.to} label={item.label}>
                                    <item.icon className="h-5 w-5"/>
                                    {/* Slightly larger icon, no margin */}
                                </AdminNavLink>
                            ))}
                            {/* Classes & Programs Dropdown */}
                            <AdminClassDropdown/>
                            {/* Discount Dropdown */}
                            <AdminDiscountDropdown/>
                            {/* Store Dropdown */}
                            <AdminStoreDropdown/>
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
                                    <Menu className="h-5 w-5"/>
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
                                            className="w-[300px] sm:w-[400px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-0 flex flex-col max-h-screen"
                                        >
                                            <div className="flex-1 overflow-y-auto py-4">
                                                <SheetTitle className="px-4 mb-2">Admin Navigation</SheetTitle>
                                                <div className="flex flex-col space-y-2">
                                                    <div className="px-4">
                                                        {adminNavItems.map((item) => (
                                                            <AdminMobileNavLink key={item.to} to={item.to}
                                                                                onClick={() => setIsOpen(false)}>
                                                                <item.icon className="h-5 w-5 mr-2 inline-block"/>
                                                                {item.label}
                                                            </AdminMobileNavLink>
                                                        ))}
                                                    </div>
                                                    
                                                    {/* Classes & Programs Mobile Links */}
                                                    <div className="border-t border-gray-200 dark:border-gray-700 my-2 mx-4"></div>
                                                    <div className="px-4 py-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setIsClassMobileOpen(!isClassMobileOpen);
                                                            }}
                                                            className="flex items-center w-full text-base text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400"
                                                        >
                                                            <GraduationCap className="h-5 w-5 mr-2"/>
                                                            <span className="font-medium">Classes & Programs</span>
                                                            <span className="ml-auto">
                                                                {isClassMobileOpen ?
                                                                    <ChevronDown className="h-4 w-4"/> :
                                                                    <ChevronRight className="h-4 w-4"/>
                                                                }
                                                            </span>
                                                        </button>
                                                    </div>
                                                    {isClassMobileOpen && (
                                                        <div className="pl-6 space-y-1 mb-2">
                                                            {classNavItems.map((item) => (
                                                                <AdminMobileNavLink key={item.to} to={item.to}
                                                                                    onClick={() => setIsOpen(false)}>
                                                                    <item.icon className="h-5 w-5 mr-2 inline-block"/>
                                                                    {item.label}
                                                                </AdminMobileNavLink>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Discount Mobile Links */}
                                                    <React.Fragment>
                                                        <div className="border-t border-gray-200 dark:border-gray-700 my-2 mx-4"></div>
                                                        <div className="px-4 py-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setIsDiscountMobileOpen(!isDiscountMobileOpen);
                                                                }}
                                                                className="flex items-center w-full text-base text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400"
                                                            >
                                                                <Tag className="h-5 w-5 mr-2"/>
                                                                <span className="font-medium">Discounts</span>
                                                                <span className="ml-auto">
                                                                    {isDiscountMobileOpen ? (
                                                                        <ChevronDown className="h-4 w-4"/>
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4"/>
                                                                    )}
                                                                </span>
                                                            </button>
                                                        </div>
                                                        {isDiscountMobileOpen && (
                                                            <div className="pl-6 space-y-1 mb-2">
                                                                {discountNavItems.map((item) => (
                                                                    <AdminMobileNavLink key={item.to} to={item.to}
                                                                                        onClick={() => setIsOpen(false)}>
                                                                        <item.icon className="h-5 w-5 mr-2 inline-block"/>
                                                                        {item.label}
                                                                    </AdminMobileNavLink>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </React.Fragment>
                                                    
                                                    {/* Store Mobile Links */}
                                                    <React.Fragment>
                                                        <div className="border-t border-gray-200 dark:border-gray-700 my-2 mx-4"></div>
                                                        <div className="px-4 py-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setIsStoreMobileOpen(!isStoreMobileOpen);
                                                                }}
                                                                className="flex items-center w-full text-base text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400"
                                                            >
                                                                <ShoppingBag className="h-5 w-5 mr-2"/>
                                                                <span className="font-medium">Store</span>
                                                                <span className="ml-auto">
                                                                    {isStoreMobileOpen ? (
                                                                        <ChevronDown className="h-4 w-4"/>
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4"/>
                                                                    )}
                                                                </span>
                                                            </button>
                                                        </div>
                                                        {isStoreMobileOpen && (
                                                            <div className="pl-6 space-y-1 mb-2">
                                                                {storeNavItems.map((item) => (
                                                                    <AdminMobileNavLink key={item.to} to={item.to}
                                                                                        onClick={() => setIsOpen(false)}>
                                                                        <item.icon className="h-5 w-5 mr-2 inline-block"/>
                                                                        {item.label}
                                                                    </AdminMobileNavLink>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </React.Fragment>

                                                    {/* Mobile Logout */}
                                                    <Form action="/logout" method="post"
                                                          className="mt-auto pt-4 px-4"> {/* Use mt-auto to push logout down */}
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
                                            </div>
                                        </SheetContent>
                                    </Sheet>
                                )}
                            </ClientOnly>
                        </div>
                    </div>
                    {/* Closes flex justify-between h-16 */}
                </div>
            </header>
        </TooltipProvider>
    );
}

// Define props type for AdminNavLink
type AdminNavLinkProps = {
    to: string;
    label: string;
    children: React.ReactNode;
};

// Reusable NavLink component for Admin Desktop (Icon + Tooltip)
function AdminNavLink({to, label, children}: AdminNavLinkProps) {
    const location = useLocation();
    const isActive = location.pathname === to || (to !== '/admin' && location.pathname.startsWith(to)); // Basic active check

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link
                    to={to}
                    className={cn(
                        "text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 p-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700", // Adjusted padding for icon
                        isActive && "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30" // Active style
                    )}
                    aria-label={label} // Add aria-label for accessibility
                >
                    {children} {/* Should be just the icon */}
                </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    );
}

// Classes & Programs Dropdown Component for Desktop (Icon Trigger + Tooltip)
function AdminClassDropdown() {
    const location = useLocation();
    const isClassActive = location.pathname.startsWith('/admin/programs') || location.pathname.startsWith('/admin/classes') || location.pathname.startsWith('/admin/enrollments');
    const [isOpen, setIsOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [canShowTooltip, setCanShowTooltip] = useState(true);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            setShowTooltip(false);
            setCanShowTooltip(false);
        } else {
            // Delay allowing tooltip to show again after dropdown closes
            setTimeout(() => setCanShowTooltip(true), 300);
        }
    };

    return (
        <div className="relative">
            <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 rounded-md transition-colors flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:ring-0 focus-visible:ring-offset-0",
                            isClassActive && "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
                        )}
                        aria-label="Classes & Programs Management"
                        onMouseEnter={() => {
                            if (!isOpen && canShowTooltip) {
                                setShowTooltip(true);
                            }
                        }}
                        onMouseLeave={() => {
                            setShowTooltip(false);
                        }}
                        onFocus={() => {
                            if (!isOpen && canShowTooltip) {
                                setShowTooltip(true);
                            }
                        }}
                        onBlur={() => {
                            setShowTooltip(false);
                        }}
                        onClick={() => {
                            setShowTooltip(false);
                        }}
                    >
                        <GraduationCap className="h-5 w-5"/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="mt-1 max-h-[calc(100vh-80px)] overflow-y-auto">
                    {classNavItems.map((item) => (
                        <DropdownMenuItem key={item.to} className="p-0">
                            <Link
                                to={item.to}
                                onClick={() => setIsOpen(false)}
                                className="flex items-center cursor-pointer w-full px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 rounded-sm"
                            >
                                <item.icon className="h-4 w-4 mr-2"/>
                                {item.label}
                            </Link>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            {showTooltip && !isOpen && canShowTooltip && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1.5 text-xs text-primary-foreground bg-primary rounded-md whitespace-nowrap z-50 animate-in fade-in-0 zoom-in-95">
                    Classes & Programs
                </div>
            )}
        </div>
    );
}

// Discount Dropdown Component for Desktop (Icon Trigger + Tooltip)
function AdminDiscountDropdown() {
    const location = useLocation();
    const isDiscountActive = location.pathname.startsWith('/admin/discount');
    const [isOpen, setIsOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [canShowTooltip, setCanShowTooltip] = useState(true);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            setShowTooltip(false);
            setCanShowTooltip(false);
        } else {
            // Delay allowing tooltip to show again after dropdown closes
            setTimeout(() => setCanShowTooltip(true), 300);
        }
    };

    return (
        <div className="relative">
            <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 rounded-md transition-colors flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:ring-0 focus-visible:ring-offset-0",
                            isDiscountActive && "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
                        )}
                        aria-label="Discount Management"
                        onMouseEnter={() => {
                            if (!isOpen && canShowTooltip) {
                                setShowTooltip(true);
                            }
                        }}
                        onMouseLeave={() => {
                            setShowTooltip(false);
                        }}
                        onFocus={() => {
                            if (!isOpen && canShowTooltip) {
                                setShowTooltip(true);
                            }
                        }}
                        onBlur={() => {
                            setShowTooltip(false);
                        }}
                        onClick={() => {
                            setShowTooltip(false);
                        }}
                    >
                        <Tag className="h-5 w-5"/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="mt-1 max-h-[calc(100vh-80px)] overflow-y-auto">
                    {discountNavItems.map((item) => (
                        <DropdownMenuItem key={item.to} className="p-0">
                            <Link
                                to={item.to}
                                onClick={() => setIsOpen(false)}
                                className="flex items-center cursor-pointer w-full px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 rounded-sm"
                            >
                                <item.icon className="h-4 w-4 mr-2"/>
                                {item.label}
                            </Link>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            {showTooltip && !isOpen && canShowTooltip && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1.5 text-xs text-primary-foreground bg-primary rounded-md whitespace-nowrap z-50 animate-in fade-in-0 zoom-in-95">
                    Discounts
                </div>
            )}
        </div>
    );
}

// Store Dropdown Component for Desktop (Icon Trigger + Tooltip)
function AdminStoreDropdown() {
    const location = useLocation();
    const isStoreActive = location.pathname.startsWith('/admin/store');
    const [isOpen, setIsOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [canShowTooltip, setCanShowTooltip] = useState(true);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            setShowTooltip(false);
            setCanShowTooltip(false);
        } else {
            // Delay allowing tooltip to show again after dropdown closes
            setTimeout(() => setCanShowTooltip(true), 300);
        }
    };

    return (
        <div className="relative">
            <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost" // Use ghost variant for icon button look
                        size="icon" // Use icon size
                        className={cn(
                            "text-gray-500 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 rounded-md transition-colors flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:ring-0 focus-visible:ring-offset-0", // Adjusted padding/hover for icon
                            isStoreActive && "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30" // Active style on trigger
                        )}
                        aria-label="Store Management" // Add aria-label
                        onMouseEnter={() => {
                            if (!isOpen && canShowTooltip) {
                                setShowTooltip(true);
                            }
                        }}
                        onMouseLeave={() => {
                            setShowTooltip(false);
                        }}
                        onFocus={() => {
                            if (!isOpen && canShowTooltip) {
                                setShowTooltip(true);
                            }
                        }}
                        onBlur={() => {
                            setShowTooltip(false);
                        }}
                        onClick={() => {
                            setShowTooltip(false);
                        }}
                    >
                        <ShoppingBag className="h-5 w-5"/> {/* Slightly larger icon */}
                        {/* Removed "Store" text */}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start"
                                     className="mt-1 max-h-[calc(100vh-80px)] overflow-y-auto"> {/* Added height constraint and scrolling */}
                    {/* <DropdownMenuLabel>Store Management</DropdownMenuLabel> */}
                    {/* <DropdownMenuSeparator /> */}
                    {storeNavItems.map((item) => (
                        // Removed asChild as a test for the React.Children.only error
                        <DropdownMenuItem key={item.to} className="p-0"> {/* Remove padding from item */}
                            {/* Apply styling directly to Link */}
                            <Link
                                to={item.to}
                                onClick={() => setIsOpen(false)}
                                className="flex items-center cursor-pointer w-full px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 rounded-sm"
                            >
                                <item.icon className="h-4 w-4 mr-2"/>
                                {item.label}
                            </Link>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            {showTooltip && !isOpen && canShowTooltip && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1.5 text-xs text-primary-foreground bg-primary rounded-md whitespace-nowrap z-50 animate-in fade-in-0 zoom-in-95">
                    Store
                </div>
            )}
        </div>
    );
}

// Reusable NavLink component for Admin Mobile
function AdminMobileNavLink({to, children, onClick}: {
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