import React, {useState} from 'react';
import {Form, Link, useLocation} from "@remix-run/react"; // Import useLocation
import {ModeToggle} from "./mode-toggle";
import {Sheet, SheetContent, SheetTitle, SheetTrigger} from "./ui/sheet";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "./ui/tooltip"; // Import Tooltip components
// Note: MessageSquare was already added in the provided file content, no change needed here.
import {
    Calendar,
    CalendarCheck,
    ChevronDown,
    ChevronRight,
    CreditCard,
    Database,
    FileText,
    ClipboardPaste,
    GraduationCap,
    LayoutDashboard,
    ListOrdered,
    LogOut,
    Menu,
    MessageSquare,
    BookOpen,
    Package,
    Boxes,
    Receipt,
    Settings,
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
    {to: "/instructor", label: "Instructor Portal", icon: BookOpen},
    {to: "/admin/waivers", label: "Waivers", icon: FileText},
    {to: "/admin/messages", label: "Messages", icon: MessageSquare},
    {to: "/admin/db-chat", label: "DB Chat", icon: Database},
    // Calendar, Attendance, Families, Students, Enrollments, Programs, Classes, Sessions will be handled by dropdowns
    // Discount items will be handled by the Dropdown below
    // Store items will be handled by the Dropdown below
    // Billing items (Payments, Invoices, Invoice Entities) will be handled by the Billing dropdown
];

// Define Billing navigation items (Payments, Invoices, Invoice Entities, Invoice Templates)
const billingNavItems = [
    {to: "/admin/payments", label: "Payments", icon: CreditCard},
    {to: "/admin/invoices", label: "Invoices", icon: FileText},
    {to: "/admin/invoice-entities", label: "Invoice Entities", icon: Receipt},
    {to: "/admin/invoice-templates", label: "Invoice Templates", icon: ClipboardPaste},
];

// Define Calendar & Attendance navigation items
const calendarAttendanceNavItems = [
    {to: "/admin/calendar", label: "Calendar", icon: Calendar},
    {to: "/admin/attendance", label: "Attendance", icon: CalendarCheck},
];

// Define People Management navigation items (Families, Students, Enrollments)
const peopleNavItems = [
    {to: "/admin/families", label: "Families", icon: Users},
    {to: "/admin/students", label: "Students", icon: User},
    {to: "/admin/enrollments", label: "Enrollments", icon: ListOrdered},
];

// Define Curriculum navigation sections (Programs, Seminars, Events)
const curriculumNavSections = [
    {
        heading: "Programs",
        icon: GraduationCap,
        items: [
            {to: "/admin/programs", label: "Programs", icon: GraduationCap},
            {to: "/admin/classes", label: "Classes", icon: CalendarCheck},
            {to: "/admin/sessions", label: "Sessions", icon: Calendar},
        ],
    },
    {
        heading: "Seminars",
        icon: BookOpen,
        items: [
            {to: "/admin/programs?filter=seminar", label: "Seminar Templates", icon: BookOpen},
            {to: "/admin/classes?engagement=seminar", label: "Seminar Series", icon: CalendarCheck},
        ],
    },
    {
        heading: "Events",
        icon: Calendar,
        items: [
            {to: "/admin/events", label: "Events", icon: Calendar},
        ],
    },
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
    const [isBillingMobileOpen, setIsBillingMobileOpen] = useState(false);
    const [isDiscountMobileOpen, setIsDiscountMobileOpen] = useState(false);
    const [isProgramsClassesMobileOpen, setIsProgramsClassesMobileOpen] = useState(false);
    const [isCalendarAttendanceMobileOpen, setIsCalendarAttendanceMobileOpen] = useState(false);
    const [isPeopleMobileOpen, setIsPeopleMobileOpen] = useState(false);
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
                            <Link to="/" className="relative h-10 w-53 mr-4">
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
                            {/* Calendar & Attendance Dropdown */}
                            <AdminCalendarAttendanceDropdown/>
                            {/* People Management Dropdown (Families, Students, Enrollments) */}
                            <AdminPeopleDropdown/>
                            {/* Programs & Classes Dropdown */}
                            <AdminProgramsClassesDropdown/>
                            {/* Discount Dropdown */}
                            <AdminDiscountDropdown/>
                            {/* Store Dropdown */}
                            <AdminStoreDropdown/>
                            {/* Billing Dropdown */}
                            <AdminBillingDropdown/>
                        </nav>

                        <div className="flex items-center space-x-4">
                            {/* Account Settings Link */}
                            <AdminNavLink to="/admin/account" label="Account Settings">
                                <Settings className="h-5 w-5"/>
                            </AdminNavLink>
                            
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
                                                    
                                                    {/* Calendar & Attendance Mobile Links */}
                                                    <div className="border-t border-gray-200 dark:border-gray-700 my-2 mx-4"></div>
                                                    <div className="px-4 py-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setIsCalendarAttendanceMobileOpen(!isCalendarAttendanceMobileOpen);
                                                            }}
                                                            className="flex items-center w-full text-base text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400"
                                                        >
                                                            <Calendar className="h-5 w-5 mr-2"/>
                                                            <span className="font-medium">Calendar & Attendance</span>
                                                            <span className="ml-auto">
                                                                {isCalendarAttendanceMobileOpen ?
                                                                    <ChevronDown className="h-4 w-4"/> :
                                                                    <ChevronRight className="h-4 w-4"/>
                                                                }
                                                            </span>
                                                        </button>
                                                    </div>
                                                    {isCalendarAttendanceMobileOpen && (
                                                        <div className="pl-6 space-y-1 mb-2">
                                                            {calendarAttendanceNavItems.map((item) => (
                                                                <AdminMobileNavLink key={item.to} to={item.to}
                                                                                    onClick={() => setIsOpen(false)}>
                                                                    <item.icon className="h-5 w-5 mr-2 inline-block"/>
                                                                    {item.label}
                                                                </AdminMobileNavLink>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {/* People Management Mobile Links */}
                                                    <div className="border-t border-gray-200 dark:border-gray-700 my-2 mx-4"></div>
                                                    <div className="px-4 py-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setIsPeopleMobileOpen(!isPeopleMobileOpen);
                                                            }}
                                                            className="flex items-center w-full text-base text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400"
                                                        >
                                                            <Users className="h-5 w-5 mr-2"/>
                                                            <span className="font-medium">Family Management</span>
                                                            <span className="ml-auto">
                                                                {isPeopleMobileOpen ?
                                                                    <ChevronDown className="h-4 w-4"/> :
                                                                    <ChevronRight className="h-4 w-4"/>
                                                                }
                                                            </span>
                                                        </button>
                                                    </div>
                                                    {isPeopleMobileOpen && (
                                                        <div className="pl-6 space-y-1 mb-2">
                                                            {peopleNavItems.map((item) => (
                                                                <AdminMobileNavLink key={item.to} to={item.to}
                                                                                    onClick={() => setIsOpen(false)}>
                                                                    <item.icon className="h-5 w-5 mr-2 inline-block"/>
                                                                    {item.label}
                                                                </AdminMobileNavLink>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Programs & Classes Mobile Links */}
                                                    <div className="border-t border-gray-200 dark:border-gray-700 my-2 mx-4"></div>
                                                    <div className="px-4 py-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setIsProgramsClassesMobileOpen(!isProgramsClassesMobileOpen);
                                                            }}
                                                            className="flex items-center w-full text-base text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400"
                                                        >
                                                            <GraduationCap className="h-5 w-5 mr-2"/>
                                                            <span className="font-medium">Curriculum</span>
                                                            <span className="ml-auto">
                                                                {isProgramsClassesMobileOpen ?
                                                                    <ChevronDown className="h-4 w-4"/> :
                                                                    <ChevronRight className="h-4 w-4"/>
                                                                }
                                                            </span>
                                                        </button>
                                                    </div>
                                                    {isProgramsClassesMobileOpen && (
                                                        <div className="pl-6 space-y-4 mb-2">
                                                            {curriculumNavSections.map((section) => (
                                                                <div key={section.heading}>
                                                                    <div className="flex items-center text-xs font-semibold uppercase text-muted-foreground mb-1">
                                                                        <section.icon className="h-4 w-4 mr-2"/>
                                                                        {section.heading}
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        {section.items.map((item) => (
                                                                            <AdminMobileNavLink key={item.to} to={item.to}
                                                                                                onClick={() => setIsOpen(false)}>
                                                                                <item.icon className="h-5 w-5 mr-2 inline-block"/>
                                                                                {item.label}
                                                                            </AdminMobileNavLink>
                                                                        ))}
                                                                    </div>
                                                                </div>
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
                                                    
                                                    {/* Billing Mobile Links */}
                                                    <React.Fragment>
                                                        <div className="border-t border-gray-200 dark:border-gray-700 my-2 mx-4"></div>
                                                        <div className="px-4 py-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setIsBillingMobileOpen(!isBillingMobileOpen);
                                                                }}
                                                                className="flex items-center w-full text-base text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400"
                                                            >
                                                                <CreditCard className="h-5 w-5 mr-2"/>
                                                                <span className="font-medium">Billing & Finance</span>
                                                                <span className="ml-auto">
                                                                    {isBillingMobileOpen ? (
                                                                        <ChevronDown className="h-4 w-4"/>
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4"/>
                                                                    )}
                                                                </span>
                                                            </button>
                                                        </div>
                                                        {isBillingMobileOpen && (
                                                            <div className="pl-6 space-y-1 mb-2">
                                                                {billingNavItems.map((item) => (
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
                                                    <div className="border-t border-gray-200 dark:border-gray-700 my-2 mx-4"></div>
                                                    <div className="px-4 mb-4">
                                                        <AdminMobileNavLink to="/admin/account" onClick={() => setIsOpen(false)}>
                                                            <Settings className="h-5 w-5 mr-2 inline-block"/>
                                                            Account Settings
                                                        </AdminMobileNavLink>
                                                    </div>
                                                    
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

// Calendar & Attendance Dropdown Component for Desktop (Icon Trigger + Tooltip)
function AdminCalendarAttendanceDropdown() {
    const location = useLocation();
    const isCalendarAttendanceActive = location.pathname.startsWith('/admin/calendar') || location.pathname.startsWith('/admin/attendance');
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
                            isCalendarAttendanceActive && "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
                        )}
                        aria-label="Calendar & Attendance Management"
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
                        <Calendar className="h-5 w-5"/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="mt-1 max-h-[calc(100vh-80px)] overflow-y-auto">
                    {calendarAttendanceNavItems.map((item) => (
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
                    Calendar & Attendance
                </div>
            )}
        </div>
    );
}

// People Management Dropdown Component for Desktop (Icon Trigger + Tooltip)
function AdminPeopleDropdown() {
    const location = useLocation();
    const isPeopleActive = location.pathname.startsWith('/admin/families') || location.pathname.startsWith('/admin/students') || location.pathname.startsWith('/admin/enrollments');
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
                            isPeopleActive && "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
                        )}
                        aria-label="People Management"
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
                        <Users className="h-5 w-5"/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="mt-1 max-h-[calc(100vh-80px)] overflow-y-auto">
                    {peopleNavItems.map((item) => (
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
                    People Management
                </div>
            )}
        </div>
    );
}

// Programs & Classes Dropdown Component for Desktop (Icon Trigger + Tooltip)
function AdminProgramsClassesDropdown() {
    const location = useLocation();
    const isProgramsClassesActive =
        location.pathname.startsWith('/admin/programs') ||
        location.pathname.startsWith('/admin/classes') ||
        location.pathname.startsWith('/admin/sessions') ||
        location.pathname.startsWith('/admin/events');
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
                            isProgramsClassesActive && "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
                        )}
                        aria-label="Programs & Classes Management"
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
                    {curriculumNavSections.map((section, index) => (
                        <div key={section.heading}>
                            <div className="px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                                <section.icon className="h-3.5 w-3.5"/>
                                {section.heading}
                            </div>
                            {section.items.map((item) => (
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
                            {index < curriculumNavSections.length - 1 && (
                                <div className="my-1 border-b border-border"/>
                            )}
                        </div>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            {showTooltip && !isOpen && canShowTooltip && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1.5 text-xs text-primary-foreground bg-primary rounded-md whitespace-nowrap z-50 animate-in fade-in-0 zoom-in-95">
                    Curriculum
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

// Billing Dropdown Component for Desktop (Icon Trigger + Tooltip)
function AdminBillingDropdown() {
    const location = useLocation();
    const isBillingActive = location.pathname.startsWith('/admin/payment') || 
                           location.pathname.startsWith('/admin/invoice') || 
                           location.pathname.startsWith('/admin/billing');
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
                            isBillingActive && "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
                        )}
                        aria-label="Billing & Finance Management"
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
                        <CreditCard className="h-5 w-5"/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="mt-1 max-h-[calc(100vh-80px)] overflow-y-auto">
                    {billingNavItems.map((item) => (
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
                    Billing & Finance
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
