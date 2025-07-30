import { Link } from "@remix-run/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
  onClick?: () => void; // Add onClick handler for custom actions
}

interface AppBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function AppBreadcrumb({ items, className }: AppBreadcrumbProps) {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {items.map((item, index) => (
          <div key={index} className="flex items-center">
            <BreadcrumbItem>
              {item.current || (!item.href && !item.onClick) ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : item.onClick ? (
                <BreadcrumbLink asChild>
                  <button 
                    onClick={item.onClick}
                    className="hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit text-inherit"
                  >
                    {item.label}
                  </button>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={item.href!}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {index < items.length - 1 && <BreadcrumbSeparator />}
          </div>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

// Utility function to generate common breadcrumb patterns
export const breadcrumbPatterns = {
  // Family portal breadcrumbs
  familyAccount: () => [
    { label: "Family Portal", href: "/family" },
    { label: "Account Settings", current: true },
  ],
  
  familyStudent: (studentName: string) => [
    { label: "Family Portal", href: "/family" },
    { label: `${studentName}`, current: true },
  ],
  
  familyGuardian: (guardianName: string) => [
    { label: "Family Portal", href: "/family" },
    { label: `${guardianName}`, current: true },
  ],
  
  familyMessages: () => [
    { label: "Family Portal", href: "/family" },
    { label: "Messages", current: true },
  ],
  
  familyMessageConversation: (conversationTitle?: string) => [
    { label: "Family Portal", href: "/family" },
    { label: "Messages", href: "/family/messages" },
    { label: conversationTitle || "Conversation", current: true },
  ],
  
  familyPayment: () => [
    { label: "Family Portal", href: "/family" },
    { label: "Payment", current: true },
  ],
  
  familyPaymentHistory: () => [
    { label: "Family Portal", href: "/family" },
    { label: "Payment History", current: true },
  ],
  
  familyCalendar: () => [
    { label: "Family Portal", href: "/family" },
    { label: "Calendar", current: true },
  ],
  
  familyAttendance: () => [
    { label: "Family Portal", href: "/family" },
    { label: "Attendance", current: true },
  ],
  
  familyOrders: () => [
    { label: "Family Portal", href: "/family" },
    { label: "Orders", current: true },
  ],
  
  familyAddStudent: () => [
    { label: "Family Portal", href: "/family" },
    { label: "Add Student", current: true },
  ],
  
  familyAddGuardian: () => [
    { label: "Family Portal", href: "/family" },
    { label: "Add Guardian", current: true },
  ],
  
  familyStorePurchase: (firstName: string, lastName: string, studentId: string) => [
    { label: "Family Portal", href: "/family" },
    { label: `${firstName} ${lastName}`, href: `/family/student/${studentId}` },
    { label: "Purchase Uniform", current: true },
  ],
  
  familyStudentDetail: (firstName: string, lastName: string) => [
    { label: "Family Portal", href: "/family" },
    { label: `${firstName} ${lastName}`, current: true },
  ],
  
  familyStudentEdit: (firstName: string, lastName: string, studentId: string) => [
    { label: "Family Portal", href: "/family" },
    { label: `${firstName} ${lastName}`, href: `/family/student/${studentId}` },
    { label: "Edit", current: true },
  ],
  
  familyStudentAttendance: (firstName: string, lastName: string, studentId: string) => [
    { label: "Family Portal", href: "/family" },
    { label: `${firstName} ${lastName}`, href: `/family/student/${studentId}` },
    { label: "Attendance", current: true },
  ],
  
  // Admin breadcrumbs
  adminStudents: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Students", current: true },
  ],
  
  adminStudentDetail: (firstName: string, lastName: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Students", href: "/admin/students" },
    { label: `${firstName} ${lastName}`, current: true },
  ],
  
  adminFamilies: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Families", current: true },
  ],
  
  adminFamilyDetail: (familyName: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Families", href: "/admin/families" },
    { label: familyName, current: true },
  ],
  
  adminClasses: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Classes", current: true },
  ],
  
  adminClassDetail: (className: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Classes", href: "/admin/classes" },
    { label: className, current: true },
  ],
  
  adminClassSessions: (className: string, classId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Classes", href: "/admin/classes" },
    { label: className, href: `/admin/classes/${classId}/edit` },
    { label: "Sessions", current: true },
  ],
  
  adminMessages: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Messages", current: true },
  ],
  
  adminMessageConversation: (conversationTitle?: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Messages", href: "/admin/messages" },
    { label: conversationTitle || "Conversation", current: true },
  ],
  
  adminPayments: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Payments", current: true },
  ],
  
  adminPaymentsPending: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Payments", href: "/admin/payments" },
    { label: "Pending Payments", current: true },
  ],
  
  adminPaymentDetail: (paymentId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Payments", href: "/admin/payments" },
    { label: `Payment ${paymentId}`, current: true },
  ],
  
  adminStore: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Store", current: true },
  ],
  
  adminStoreProducts: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Store", href: "/admin/store" },
    { label: "Products", current: true },
  ],
  
  adminStoreProductDetail: (productName: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Store", href: "/admin/store" },
    { label: "Products", href: "/admin/store/products" },
    { label: productName, current: true },
  ],
  
  adminStoreProductVariants: (productName: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Store", href: "/admin/store" },
    { label: "Products", href: "/admin/store/products" },
    { label: productName, href: `/admin/store/products/${productName.toLowerCase()}` },
    { label: "Variants", current: true },
  ],
  
  adminStoreOrders: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Store", href: "/admin/store" },
    { label: "Orders", current: true },
  ],
  
  adminStoreOrderDetail: (orderId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Store", href: "/admin/store" },
    { label: "Orders", href: "/admin/store/orders" },
    { label: `Order ${orderId}`, current: true },
  ],
  
  adminStoreInventory: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Store", href: "/admin/store" },
    { label: "Inventory", current: true },
  ],
  
  adminDiscountCodes: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Discount Codes", current: true },
  ],
  
  adminDiscountCodeEdit: (codeName: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Discount Codes", href: "/admin/discount-codes" },
    { label: `Edit ${codeName}`, current: true },
  ],
  
  adminDiscountTemplates: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Discount Templates", current: true },
  ],
  
  adminAttendance: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Attendance", current: true },
  ],
  
  adminAttendanceRecord: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Attendance", href: "/admin/attendance" },
    { label: "Record Attendance", current: true },
  ],
  
  adminAttendanceReport: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Attendance", href: "/admin/attendance" },
    { label: "Attendance Report", current: true },
  ],
  
  adminWaivers: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Waivers", current: true },
  ],
  
  adminWaiverDetail: (waiverTitle: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Waivers", href: "/admin/waivers" },
    { label: waiverTitle, current: true },
  ],
  
  adminWaiversMissing: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Waivers", href: "/admin/waivers" },
    { label: "Missing Waivers", current: true },
  ],
  
  adminPrograms: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Programs", current: true },
  ],
  
  adminProgramEdit: (programName: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Programs", href: "/admin/programs" },
    { label: `Edit ${programName}`, current: true },
  ],
  
  adminSessions: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Session Management", current: true },
  ],
  
  adminDbChat: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Database Assistant", current: true },
  ],
  
  adminCalendar: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Calendar", current: true },
  ],
  
  adminEnrollments: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Enrollments", current: true },
  ],
  
  adminAutomaticDiscounts: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Automatic Discounts", current: true },
  ],
  
  adminAutomaticDiscountRule: (ruleName: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Automatic Discounts", href: "/admin/automatic-discounts" },
    { label: ruleName, current: true },
  ],
  
  adminAutomaticDiscountAssignments: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Automatic Discounts", href: "/admin/automatic-discounts" },
    { label: "Assignments", current: true },
  ],
  
  adminAutomaticDiscountUtilities: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Automatic Discounts", href: "/admin/automatic-discounts" },
    { label: "Utilities", current: true },
  ],
  
  adminStudentBelts: (studentId: string, studentName: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Students", href: "/admin/students" },
    { label: studentName, href: `/admin/students/${studentId}` },
    { label: "Belt Awards", current: true },
  ],
  
  adminStudentBeltEdit: (studentName: string, beltLevel: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Students", href: "/admin/students" },
    { label: studentName, href: `/admin/students/${studentName.toLowerCase()}` },
    { label: "Belt Awards", href: `/admin/student-belts/${studentName.toLowerCase()}` },
    { label: `Edit ${beltLevel}`, current: true },
  ],

  // Additional admin breadcrumb patterns
  adminProgramNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Programs", href: "/admin/programs" },
    { label: "New Program", current: true },
  ],

  adminClassNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Classes", href: "/admin/classes" },
    { label: "New Class", current: true },
  ],

  adminClassEdit: (className: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Classes", href: "/admin/classes" },
    { label: `Edit ${className}`, current: true },
  ],

  adminDiscountCodeNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Discount Codes", href: "/admin/discount-codes" },
    { label: "New Discount Code", current: true },
  ],

  adminDiscountTemplateNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Discount Templates", href: "/admin/discount-templates" },
    { label: "New Template", current: true },
  ],

  adminDiscountTemplateEdit: (templateName: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Discount Templates", href: "/admin/discount-templates" },
    { label: `Edit ${templateName}`, current: true },
  ],

  adminEnrollmentNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Enrollments", href: "/admin/enrollments" },
    { label: "New Enrollment", current: true },
  ],

  adminFamilyNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Families", href: "/admin/families" },
    { label: "New Family", current: true },
  ],

  adminFamilyEdit: (familyName: string, familyId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Families", href: "/admin/families" },
    { label: familyName, href: `/admin/families/${familyId}` },
    { label: "Edit", current: true },
  ],

  adminFamilyGuardianEdit: (familyName: string, familyId: string, guardianName: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Families", href: "/admin/families" },
    { label: familyName, href: `/admin/families/${familyId}` },
    { label: `Edit ${guardianName}`, current: true },
  ],

  adminFamilyStudentNew: (familyName: string, familyId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Families", href: "/admin/families" },
    { label: familyName, href: `/admin/families/${familyId}` },
    { label: "Add Student", current: true },
  ],

  adminStudentNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Students", href: "/admin/students" },
    { label: "New Student", current: true },
  ],

  adminStudentBeltNew: (studentName: string, studentId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Students", href: "/admin/students" },
    { label: studentName, href: `/admin/students/${studentId}` },
    { label: "Belt Awards", href: `/admin/student-belts/${studentId}` },
    { label: "New Belt Award", current: true },
  ],

  adminStoreProductNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Store", href: "/admin/store" },
    { label: "Products", href: "/admin/store/products" },
    { label: "New Product", current: true },
  ],

  adminStoreProductEdit: (productName: string, productId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Store", href: "/admin/store" },
    { label: "Products", href: "/admin/store/products" },
    { label: productName, href: `/admin/store/products/${productId}` },
    { label: "Edit", current: true },
  ],

  adminStoreProductVariantNew: (productName: string, productId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Store", href: "/admin/store" },
    { label: "Products", href: "/admin/store/products" },
    { label: productName, href: `/admin/store/products/${productId}` },
    { label: "Variants", href: `/admin/store/products/${productId}/variants` },
    { label: "New Variant", current: true },
  ],

  adminStoreProductVariantEdit: (productName: string, productId: string, variantName: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Store", href: "/admin/store" },
    { label: "Products", href: "/admin/store/products" },
    { label: productName, href: `/admin/store/products/${productId}` },
    { label: "Variants", href: `/admin/store/products/${productId}/variants` },
    { label: `Edit ${variantName}`, current: true },
  ],

  adminMessageNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Messages", href: "/admin/messages" },
    { label: "New Message", current: true },
  ],

  adminPaymentNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Payments", href: "/admin/payments" },
    { label: "Record New Payment", current: true },
  ],

  adminAutomaticDiscountNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Automatic Discounts", href: "/admin/automatic-discounts" },
    { label: "New Rule", current: true },
  ],

  adminWaiverNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Waivers", href: "/admin/waivers" },
    { label: "New Waiver", current: true },
  ],

  adminEvents: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Events", current: true },
  ],

  adminEventsNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Events", href: "/admin/events" },
    { label: "New Event", current: true },
  ],

  // Invoice breadcrumb patterns
  adminInvoices: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoices", current: true },
  ],

  adminInvoiceNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoices", href: "/admin/invoices" },
    { label: "New Invoice", current: true },
  ],

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  adminInvoiceDetail: (invoiceNumber: string, _invoiceId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoices", href: "/admin/invoices" },
    { label: `Invoice #${invoiceNumber}`, current: true },
  ],

  adminInvoiceEdit: (invoiceNumber: string, invoiceId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoices", href: "/admin/invoices" },
    { label: `Invoice #${invoiceNumber}`, href: `/admin/invoices/${invoiceId}` },
    { label: "Edit", current: true },
  ],

  adminInvoiceRecordPayment: (invoiceNumber: string, invoiceId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoices", href: "/admin/invoices" },
    { label: `Invoice #${invoiceNumber}`, href: `/admin/invoices/${invoiceId}` },
    { label: "Record Payment", current: true },
  ],

  // Invoice entity breadcrumb patterns
  adminInvoiceEntities: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoice Entities", current: true },
  ],

  adminInvoiceEntityNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoice Entities", href: "/admin/invoice-entities" },
    { label: "New Entity", current: true },
  ],

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  adminInvoiceEntityDetail: (entityName: string, _entityId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoice Entities", href: "/admin/invoice-entities" },
    { label: entityName, current: true },
  ],

  adminInvoiceEntityEdit: (entityName: string, entityId: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoice Entities", href: "/admin/invoice-entities" },
    { label: entityName, href: `/admin/invoice-entities/${entityId}` },
    { label: "Edit", current: true },
  ],

  // Invoice template breadcrumb patterns
  adminInvoiceTemplates: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoice Templates", current: true },
  ],

  adminInvoiceTemplatesNew: () => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoice Templates", href: "/admin/invoice-templates" },
    { label: "New Template", current: true },
  ],

  adminInvoiceTemplatesEdit: (templateId: string, templateName: string) => [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoice Templates", href: "/admin/invoice-templates" },
    { label: `Edit ${templateName}`, current: true },
  ],

  // Family portal breadcrumb patterns for pages with back links
  familyMessageNew: () => [
    { label: "Family Portal", href: "/family" },
    { label: "Messages", href: "/family/messages" },
    { label: "New Message", current: true },
  ],

  // Family waiver pages
  familyWaivers: () => [
    { label: "Family Portal", href: "/family" },
    { label: "Waivers & Agreements", current: true },
  ],
  
  familyWaiverDetail: (waiverTitle: string) => [
    { label: "Family Portal", href: "/family" },
    { label: "Waivers & Agreements", href: "/family/waivers" },
    { label: waiverTitle, current: true },
  ],
  
  familyWaiverSign: (waiverTitle: string, waiverId: string) => [
    { label: "Family Portal", href: "/family" },
    { label: "Waivers & Agreements", href: "/family/waivers" },
    { label: waiverTitle, href: `/family/waivers/${waiverId}` },
    { label: "Sign", current: true },
  ],

  // Public waiver pages (for non-authenticated users)
  waivers: () => [
    { label: "Home", href: "/" },
    { label: "Waivers & Agreements", current: true },
  ],
  
  waiverDetail: (waiverTitle: string) => [
    { label: "Home", href: "/" },
    { label: "Waivers & Agreements", href: "/waivers" },
    { label: waiverTitle, current: true },
  ],
  
  waiverSign: (waiverTitle: string, waiverId: string) => [
    { label: "Home", href: "/" },
    { label: "Waivers & Agreements", href: "/waivers" },
    { label: waiverTitle, href: `/waivers/${waiverId}` },
    { label: "Sign", current: true },
  ],
};