# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- **Email Automation:** Invoice delivery and payment reminder automation
- **Enhanced Reporting:** Advanced analytics and reporting for invoice management
- **Family Portal Integration:** Invoice viewing and payment history in family portal

## [3.0.0] - 2025-07-22

### Added
- **Complete Invoice System Implementation:**
  - **Invoice Entity Management:**
    - Comprehensive CRUD interface for managing third-party payers (schools, government agencies, corporate programs)
    - Advanced search and filtering capabilities with real-time results
    - `InvoiceEntitySelector` component for seamless entity linking during invoice creation
    - Dedicated admin interface at `/admin/invoice-entities` with full management capabilities
  - **Invoice Creation & Management:**
    - Dynamic invoice creation interface with real-time calculations and validation
    - `InvoiceLineItemBuilder` component for flexible line item management with add/remove functionality
    - `InvoicePreview` component providing real-time invoice preview with professional formatting
    - Invoice templates system for standardized billing with customizable line items
    - Comprehensive invoice list page with advanced filtering by status, entity, date range, and amount
    - Invoice detail view with complete information display and action buttons
    - Invoice status management with automated status tracking and history
    - Invoice editing capabilities with validation and conflict detection
    - Invoice duplication functionality for recurring billing scenarios
    - Professional invoice export functionality with PDF generation
  - **Payment Recording System:**
    - `RecordPaymentForm` component with comprehensive payment method support
    - `PaymentMethodSelector` for multiple payment types (cash, check, credit card, bank transfer, other)
    - Dedicated payment recording route with validation and error handling
    - `InvoicePaymentHistory` component displaying complete payment timeline
    - Partial payment support with automatic balance calculations
    - Payment status tracking with automated invoice status updates
  - **PDF Generation System:**
    - Integration with `@react-pdf/renderer` for professional PDF generation
    - `InvoiceTemplate` component with customizable layouts and branding
    - `pdf-generator` utility with robust error handling and validation
    - Secure PDF generation API endpoint at `/api/invoices/$id/pdf`
    - Professional invoice formatting with company branding and detailed line items
  - **Database Schema:**
    - `invoice_entities` table for third-party payer management
    - `invoices` table with comprehensive invoice tracking
    - `invoice_line_items` table for flexible billing line items
    - `invoice_payments` table for payment recording and tracking
    - `invoice_status_history` table for audit trail and status tracking
    - `invoice_templates` table for standardized invoice templates
    - `invoice_template_line_items` table for template line item management
  - **Service Layer:**
    - `InvoiceService` class with comprehensive business logic
    - `InvoiceTemplateService` for template management and operations
    - `InvoiceEntityService` for entity management and validation
    - Invoice number generation with configurable formatting
    - Automated invoice calculations with tax and discount support
  - **Admin Interface:**
    - New admin routes: `/admin/invoice-entities`, `/admin/invoice-templates`, `/admin/invoices`
    - Comprehensive navigation integration with admin navbar
    - Role-based access control and permission management
    - Bulk operations support for efficient invoice management
  - **Technical Infrastructure:**
    - Complete TypeScript type definitions for all invoice-related entities
    - Zod validation schemas for form validation and data integrity
    - Real-time calculations with optimistic UI updates
    - Dark mode compatibility across all invoice components
    - Responsive design for mobile and desktop usage
    - Comprehensive error handling with user-friendly messages
    - Authentication and authorization integration
    - Database migrations for seamless deployment

### Changed
- **Documentation:** Updated system documentation with comprehensive invoice system specifications
- **Navigation:** Enhanced admin navigation with invoice management sections
- **Database:** Extended database schema with 7 new tables for invoice functionality
- **Type System:** Enhanced TypeScript definitions with comprehensive invoice types
- **Validation:** Implemented robust validation using Zod schemas throughout invoice system

### Technical Details
- **Scale:** 50+ files modified/added, 7 new database tables, 3000+ lines of new code
- **Components:** 15+ new React components for invoice management
- **Services:** 3 new service classes with comprehensive business logic
- **Routes:** 10+ new admin routes for invoice functionality
- **Integration:** Seamless integration with existing payment and user management systems

## [2.4.0] - 2025-07-21

### Added
- **Progressive Web App (PWA):**
    - Complete PWA implementation with offline support and installable experience on mobile and desktop devices
    - Service worker for intelligent caching and offline functionality
    - Custom app icons, splash screens, and native app-like experience
    - PWA status indicators, installation prompts, and installation buttons for capable devices
- **Push Notification System:**
    - Browser-based push notifications for messaging with real-time delivery
    - Basic notification preferences with enable/disable toggle
    - VAPID key management and subscription handling
    - Real-time notifications for new messages
    - Push notifications work even when app is closed or in background
    - Infrastructure ready for class reminders (notification payloads and delivery system implemented)
    - Foundation for future enhancements (frequency control, quiet hours, sound customization, announcement management)
- **Comprehensive Breadcrumb Navigation System:**
    - New `AppBreadcrumb` component with consistent navigation patterns across admin and family portals
    - Centralized breadcrumb patterns in `breadcrumbPatterns` for maintainable navigation structure
    - Support for clickable breadcrumb items with custom onClick handlers
    - Breadcrumb navigation implemented across all major admin pages (students, families, classes, sessions, store, waivers, etc.)
    - Enhanced user experience with clear navigation context and "Back to" link replacements
- **Admin Session Management:**
    - New comprehensive session management route (`/admin/sessions`) with filtering, creation, and bulk deletion capabilities
    - Session filtering by class, status, and date range for efficient session organization
    - Makeup session creation functionality with proper validation and conflict detection
    - Bulk session deletion with confirmation dialogs for administrative efficiency
    - Visual session status indicators and enhanced session detail views
- **Enhanced Payment Processing System:**
    - Improved Stripe payment integration with enhanced payment intent creation and processing
    - Enhanced payment status tracking with webhook support for real-time updates
    - Expanded support for multiple payment types (monthly, yearly, individual session)
    - Improved payment method handling and receipt URL management
    - Enhanced payment forms with upgraded Stripe Elements integration
- **Attendance Tracking System:**
    - Session-based attendance recording with manual entry interface
    - Four-state attendance status tracking (present, absent, excused, late)
    - Attendance statistics and reporting capabilities
    - Multi-class support with proper session association
    - Enhanced attendance service with validation and filtering
- **Multi-Class Enrollment System:**
    - Comprehensive enrollment validation with eligibility checking
    - Automated waitlist management with priority processing
    - Belt rank requirements validation and age verification
    - Prerequisite program checking and capacity management
    - Enhanced enrollment workflow with conflict detection
- **Enhanced Waiver Management:**
    - New waiver creation page (`/admin/waivers/new`) with comprehensive form validation
    - Improved waiver detail pages with auto-focus behavior and enhanced user experience
    - Email notifications for waiver creation and updates
    - Better breadcrumb navigation for waiver management workflows
- **Improved Admin Navigation:**
    - Organized admin navbar items into logical dropdown groups for better usability
    - Enhanced mobile navigation with improved scrolling and accessibility
    - Consistent navbar design with unified Karate branding across admin and family portals
- **Territory Acknowledgement:**
    - Added Territory Acknowledgement section to About page with configurable site content
    - Enhanced site configuration to support community acknowledgements

### Changed
- **Navigation Experience:** Replaced "Back to" links with comprehensive breadcrumb navigation across admin and family pages for improved user orientation
- **Session Display:** Fixed timezone issues causing sessions to display on incorrect days with proper date handling
- **Calendar Events:** Added visual status indicators to calendar events for better event recognition
- **Logo Consistency:** Updated navbar logos to use unified Karate branding across all portal types
- **Password Recovery:** Enhanced password recovery event handling in layout routes for better user experience
- **Database Alignment:** Aligned `supabase-setup.sql` with migrations and normalized attendance data structure
- **Student Management:** Enhanced admin student creation with improved form validation and Supabase integration
- **Payment Logic:** Refined payment options display to show only for students with active or trial enrollments
- **Re-enrollment Handling:** Improved re-enrollment process by updating dropped/completed enrollments, validating conflicts, and processing waitlist
- **UI Text Clarity:** Updated "Back to Class" link text to "Back to Classes" for improved clarity in admin sessions UI
- **Form Validation:** Enhanced form validation across registration, admin, and contact pages with better error handling
- **Attendance Service:** Enhanced attendance service with session date retrieval and filtering to valid class sessions only

### Fixed
- **Timezone Issues:** Resolved critical timezone problems causing incorrect session date displays
- **TypeScript Compliance:** Addressed TypeScript errors and improved type safety across the application
- **User Experience:** Multiple UX improvements including better focus management and form interactions
- **Code Organization:** Cleaned up code organization and removed unnecessary comments for better maintainability
- **Calendar Utilities:** Improved calendar date parsing functions for more reliable date handling
- **Attendance Tracking:** Enhanced attendance record filtering to ensure only valid class sessions are processed

### Technical Improvements
- **Enhanced Attendance Service:** Improved session date retrieval and validation logic
- **Form Optimization:** Better form handling with improved validation and user feedback
- **Code Quality:** Removed redundant code and improved overall code organization
- **Component Architecture:** Enhanced component reusability with better prop handling and state management

### Future Enhancements
- **QR Code Attendance:** Planned implementation of QR code generation and camera-based scanning for streamlined check-in/check-out
- **Automated Class Reminders:** Implementation of scheduled class reminder notifications with configurable timing (e.g., 1 hour before class) and automated delivery to enrolled students
- **Automated Recurring Billing:** Development of true subscription management with automatic payment scheduling and billing cycles
- **Advanced Notification Customization:** Enhanced notification settings including frequency control, quiet hours, and custom sound options
- **Enhanced Payment Automation:** Automatic payment reminders, failed payment retry logic, and subscription lifecycle management
- **Announcement System:** Complete announcement management with admin creation interface, family viewing portal, and targeted delivery options


## [2.3.0] - 2025-01-10

### Added
- **Comprehensive Automatic Discount System:**
    - New automatic discount engine with rule-based assignment capabilities
    - Advanced discount templates with flexible configuration options
    - Automatic discount assignments with utilities for bulk management
    - Enhanced admin interface for managing discount rules and templates
    - Database schema updates to support complex discount logic
    - Event-driven discount processing with server-side automation
- **Three-Tier Navigation System:**
    - Role-based navigation that adapts to user authentication state and permissions
    - PublicNavbar component for homepage and public pages
    - FamilyNavbar component with pictorial menu for family portal
    - Dynamic navbar rendering based on route and user status
    - Consistent logo placement across all navigation types
    - Admin homepage access while maintaining admin privileges
- **Password Reset Functionality:**
    - Complete forgot password flow with Supabase integration
    - Secure email-based reset using `resetPasswordForEmail()` and `verifyOtp()`
    - New dedicated pages for password reset request and confirmation (`_layout.forgot-password.tsx`, `_layout.reset-password.tsx`)
    - Enhanced login page with proper forgot password navigation
    - Robust error handling for invalid/expired reset links
    - Server-side session validation for secure password reset process

### Changed
- **Navigation System:** Navigation now adapts dynamically to user authentication state and role (Breaking change)
- **Admin Interface:** Improved delete functionality for automatic discount rules with consistent UI
- **UI Components:** Replaced custom modals with Shadcn AlertDialog for UI consistency
- **State Management:** Implemented proper state management with useSubmit and deleteConfirmId
- **Dark Mode:** Added dark mode compatibility for all confirmation dialogs
- **User Experience:** Enhanced confirmation messages with specific rule names for better clarity
- **Code Organization:** Modernized admin UI with new component patterns and improved maintainability

### Fixed
- **Database:** Corrected database field names in discount assignments queries
- **Data Consistency:** Improved data consistency across discount-related operations
- **Error Handling:** Enhanced error handling for database operations and authentication flows
- **Performance:** Optimized query performance for discount rule processing
- **Security:** Improved authentication flows with proper session validation
- **Accessibility:** Better ARIA labels and focus management throughout the application

## [1.4.3] - 2025-05-10

### Added
- *(No specific "Added" items were noted for this version.)*

### Changed
- **Navbar:** "Messages" icon now only visible to authenticated users.
- **Utilities:** Consolidated date/time formatting into a single `formatDate` function in `app/utils/misc.ts`. Updated numerous routes and components (Family, Admin, Messages) to use this centralized utility for consistent date and date-time display. (Commits `d85a707`, `83545a6`, `def8240`, `bb0a43c`, `57b1a3d`, `fcd11bb`, `e8096e7`, `af5e223`, `5384834`, `429d289`, `6b59916`)
- **Utilities:** Centralized `formatCurrency` usage in Admin DB Chat page (`app/routes/admin.db-chat.tsx`). (Commit `ef66e0a`)
- **Configuration:** Centralized default locale string (`en-CA`) in `app/config/site.ts` and updated utility functions in `app/utils/misc.ts` to use it. (Commit `b63bda4`)

### Fixed
- **Date Display:** Improved robustness and consistency of date parsing and display across numerous admin and family-facing pages (including student details, payments, attendance, messages, orders, and receipts) by consistently using `date-fns` (e.g., `parseISO`, `parse`) for various date fields. This addresses potential timezone issues and ensures accurate date representation. (Commits `3b1d1f4`, `1052191`, `692b94d`, `ae98d6a`, `06f8f2f`, `c5a340e`, `0f7408c`, `f3bc800`, `e417222`, `39699ab`, `8cd3920`, `04ee18b`, `9c34619`, `109348e`, `0b18219`, `38b8de7`, `d46c825`, `89706b9`, `0d0f011`, `58acc6d`, `e66ab55`, `40b07f8`, `958bbfb`)
- **Auth:** Resolved RLS errors and profile creation issues during new user registration by refactoring database operations into a `SECURITY DEFINER` PostgreSQL function (`complete_new_user_registration`).
- **Auth:** Corrected SQL definition for `complete_new_user_registration` function to ensure proper parameter defaults, resolving type errors and PostgreSQL errors.

## [1.4.2] - 2025-05-10

### Added
- **SEO & Content:**
    - Added `FAQPage` JSON-LD schema to the site's root for improved search engine understanding.
    - Enhanced `Organization` JSON-LD schema in the site's root to include `SportsActivityLocation` details, dynamically populating class times and location information.
    - Added a helper function (`parseClassTimesForSchema`) to `app/root.tsx` to structure class schedule data for schema markup.
    - Incorporated inline Q&A-style content blocks on the "About" (`app/routes/_layout.about.tsx`) and "Contact" (`app/routes/_layout.contact.tsx`) pages for quick user information.
    - Improved image `alt` text for logos in the main Navbar (`app/components/Navbar.tsx`) and on the 404 page (`app/routes/$.tsx`) to be more descriptive and SEO-friendly.
- **Documentation:**
    - Updated `README.md` to include future development plans for a blog/news section with an admin interface.
    - Updated `README.md` to include future development plans for implementing reviews/testimonials display and associated schema markup.
    - Documented SEO strategy in `README.md`, emphasizing embedded JSON-LD over separate public JSON APIs for AI search discovery.

### Changed
- *(No specific "Changed" items were noted for this version.)*

### Fixed
- *(No specific "Fixed" items were noted for this version.)*

## [1.4.1] - 2025-04-27

### Added
- Added SQL function `execute_explain_query` to allow safe validation of generated SQL syntax.
- Added logic to retry with a backup model if the primary model hits token limits or fails with rate-limiting errors.
 
### Changed
- **Admin Navbar:** Improved mobile menu by making Store section a collapsible submenu with Products, Inventory, and Orders.
- **Navbar:** Fixed hamburger menu on mobile to properly scroll when content exceeds screen height.
- **DB Chat** Split prompt into systemInstruction and user content

### Fixed
- **Accessibility:** Added SheetTitle components to mobile menu sheets in both main and admin navigation to improve screen reader accessibility.
- **Navbar:** Fixed HTML structure issues in the Navbar component that were causing build errors.
- **DB Chat** Schema filtering and UI improvements

## [1.4.0] - 2025-04-26

### Added
  - **Admin DB Chat Interface:** Added a new admin route that provides a natural language interface for querying the database
  - Created a new `/admin/db-chat` route with a chat-like UI
  - Integrated Google Gemini API (`@google/generative-ai`) to convert natural language questions into SQL queries, replacing the previous pattern-matching approach. Requires `GEMINI_API_KEY` environment variable.
  - Added support for common admin queries (sales tax, revenue, students, products) via the LLM.
  - Implemented visual results display tailored to different query types
  - Created secure database function `execute_admin_query` to safely run admin SQL queries generated by the LLM.
  - Added a new Database icon in the admin navigation menu
- Added SQL function in Supabase to securely execute read-only admin queries with timeout limits.

### Changed
- **Admin DB Chat:** Improved LLM prompt instructions for generating PostgreSQL date calculations (e.g., "this month", "last month") to enhance accuracy.
- **Admin DB Chat:** Implemented SQL syntax validation using `EXPLAIN` before execution. If validation fails, the LLM is asked to correct the query based on the error message (with one retry attempt).
- **Admin DB Chat:** Refactored SQL syntax validation to occur directly within the Remix action function instead of using a separate Supabase Edge Function, simplifying the architecture.
- **Dependencies:** Updated several dependencies to their latest versions, including `@supabase/supabase-js` and `typescript`.
- **Dependencies:** Added new dependencies: `dotenv`, `pg`, `ts-node`, and `@types/node` to support additional functionality and tooling.
- **Docs:** Updated Project Overview in `README.md` to mention the messaging feature.
- **Refactor:** Consolidated admin layout structure and loader into the pathless layout route (`admin.tsx`) for better Remix convention adherence.
- **Refactor:** Simplified admin dashboard loader (`admin._index.tsx`) by removing redundant header handling.
- **Refactor:** Aligned Supabase client initialization and Realtime subscription logic in Family Messages (`/family/messages`) with the Admin Messages pattern to prevent potential recursion errors related to token refreshes.
- **Refactor:** Renamed admin messages routes (`admin.messages...`) to `_admin.messages...` to correctly nest them under the admin layout, ensuring the Admin Navbar and Footer are displayed.
- **Database:** Added trigger to update conversation's last_message_at timestamp; improved fallback when aggregating names for display.

### Fixed
- **Messaging:** Messages received via real-time while actively viewing a conversation (`/family/messages/:id` and `/admin/messages/:id`) are now immediately marked as read for the viewing user, preventing an incorrect unread badge/highlight from appearing when navigating back to the respective conversation list.
- **Auth:** Resolved excessive Supabase token refresh requests by implementing a client-side `onAuthStateChange` listener in the main layout (`_layout.tsx`) using `@supabase/auth-helpers-remix`.
- Removed unused `FamilyManager.tsx` component.
- Removed unused `supabase.client.ts` utility file (replaced by direct use of `@supabase/auth-helpers-remix`).
- Removed redundant `_admin.tsx` pathless layout route (functionality consolidated into `admin.tsx`).

## [1.3.3] - 2025-04-25

### Added
- **Messaging:** Added ability for Admins/Instructors to initiate new conversations with specific families via the Admin Messages interface (`/admin/messages/new`).

## [1.3.2] - 2025-04-24

### Added
- **Messaging:** Created separate `AdminConversationList` component for the admin message view (`/admin/messages`).
- **Messaging:** Implemented logic to mark conversations as read when viewed (`/family/messages/:conversationId`, `/admin/messages/:conversationId`).

### Changed
- **Messaging:** Modified admin message list (`/admin/messages`) to use a visual highlight (background/border) for conversations with unread messages instead of a numeric badge, reflecting that it shows *status* (any admin unread) rather than a *count*.
- **Messaging:** Updated `get_admin_conversation_summaries` SQL function to return a boolean flag (`is_unread_by_admin`) indicating if any admin/instructor participant has unread messages, instead of returning 0 or 1.
- **Messaging:** Automatically focus the "Subject" field on the New Message page (`/family/messages/new`) for improved usability.
- **Messaging:** Automatically focus the message input field when entering a conversation view (`/family/messages/:id`, `/admin/messages/:id`) using an accessible, programmatic approach.

### Fixed
- **Messaging:** Improved reliability and accessibility of auto-focus on message input in conversation views (`/family/messages/:id`, `/admin/messages/:id`) by using `useEffect` and `ref` instead of the `autoFocus` prop.

## [1.3.1] - 2025-04-21

### Changed
- **Messaging:** Display participant names (e.g., "Staff, Instructor" or "Family Name") in conversation list and conversation view header instead of just the subject line where applicable.
- **Performance:** Optimized Admin Messages list (`/admin/messages`) loading by replacing multiple database queries with a single SQL function call (RPC), reducing database round trips.
- **Performance:** Optimized Family Messages list (`/family/messages`) loading by replacing multiple database queries with a single SQL function call (RPC), reducing database round trips.

## [1.3.0] - 2025-04-21

### Added
- **In-App Messaging (Phase 1 & 2 - Foundation & Basic UI):**
    - Added database tables (`conversations`, `conversation_participants`, `messages`) and RLS policies.
    - Added trigger to update conversation timestamps when new messages are added.
    - Created basic family-facing routes (`/family/messages`, `/family/messages/:conversationId`) to list conversations and view/send messages.
    - Implemented basic Supabase Realtime subscription for new messages in the conversation view.
    - Added basic UI components (`ConversationList`, `MessageView`, `MessageInput`).
    - Added "Messages" link to main Navbar (for logged-in users) and Admin Navbar.
    - Implemented admin messaging interface (`/admin/messages`, `/admin/messages/:conversationId`) with enhanced real-time updates (listening for both new messages and conversation updates).
- **In-App Messaging (New Conversation):**
    - Added "New Message" button to family message list.
    - Created `/family/messages/new` route for composing new messages. Families no longer select a specific recipient; messages are sent to a conversation including the sender and all 'admin'/'instructor' users.
    - Implemented action to create conversation, participants, initial message, and redirect (using updated `create_new_conversation` SQL function).
- **Database:**
    - Added `first_name` and `last_name` columns to the `profiles` table to store user names separate from guardian/student records.
    - Set `messages.sender_id` and `conversation_participants.user_id` foreign keys to reference `profiles(id)` for improved relationship handling.
- **Messaging UI/UX:**
    - Implemented real-time message display to include sender details immediately.

### Changed
- **Navbar:** Added tooltips to the Theme Toggle and Messages icon buttons.
- **Admin Navbar:** Changed desktop navigation links (excluding Logout) to be icon-only with tooltips to reduce crowding on smaller screens. Mobile navigation remains unchanged (icon + text).
- Removed redundant "Home" link from desktop and mobile navigation menus (logo already links home).
- Replaced the desktop "Messages" navigation link with an icon-only button next to the theme toggle, always visible but only active for logged-in users.

## [1.2.2] - 2025-04-18

### Changed
- Replaced static emojis with theme-aware, colored `lucide-react` icons on the homepage (`/`) for improved visual appeal and consistency across light/dark modes.
- Replaced static emojis in the Footer's "Contact Us" section with theme-aware `lucide-react` icons, styled for visibility on the green background.
- Made the address text on the homepage and in the footer a hyperlink to Google Maps.
- Replaced static emojis in the Contact page's "Contact Information" section with theme-aware, colored `lucide-react` icons and made details clickable links.
- Updated the Contact page's "Class Schedule" section to dynamically display information from `siteConfig`.

### Fixed
- Improved visibility of the "Personal Trainer Certified" icon (Dumbbell) in both light (against green background) and dark modes on the homepage by adjusting its text color.
- Standardized font size for contact information text in the Footer to 14px (`text-sm`) to match surrounding text.
- Adjusted vertical spacing in the Footer's "Quick Links" section to visually align better with the "Contact Us" section.

## [1.2.1] - 2025-04-16

### Fixed
- Fixed duplicate tax display on payment summaries by grouping taxes.
- Resolved TypeScript errors in Family Orders page (`/family/orders`) by syncing app database types (`app/types/database.types.ts`) with the Supabase schema.
- Removed usage of non-existent `color` property for product variants in Family Orders page (`/family/orders`).
- Corrected `Badge` component variant usage for order statuses in Family Orders page (`/family/orders`) to align with available variants.

### Changed
- Improved login error message (`/login`) to distinguish between invalid credentials and rate limiting (HTTP 429).
- Disabled the login button (`/login`) during submission to prevent accidental multiple attempts and potential rate limiting.
- Streamlined tax calculation logic for better maintainability.
- Refined button styles and various UI elements across admin and family dashboards for improved consistency and usability.
- Refactored Family Orders page (`/family/orders`) to use Shadcn `Table` components instead of standard HTML table elements for consistency.

## [1.2.0] - 2025-04-15

### Added
- Added display of last 'Gi' purchase date on the Admin Students page (`/admin/students`).
- **Store Feature:**
    - Added database schema (`products`, `product_variants`, `orders`, `order_items` tables, `order_status` enum, `store_purchase` payment type, `decrement_variant_stock` function) and related RLS/triggers.
    - Added `order_id` foreign key to `payments` table.
    - Implemented family-facing purchase flow (`/family/store/purchase/:studentId`) for selecting and paying for store items (e.g., Gi).
    - Updated payment intent creation and webhook handler to manage store orders, link payments, update order status, and decrement stock.
    - Added basic admin product management pages (list, add, edit) under `/admin/store/products`.
    - Implemented image upload functionality for products using Supabase Storage (requires public `product-images` bucket).
    - Added admin product variant management pages (list, add, edit) under `/admin/store/products/:productId/variants/...`.
    - Added admin order management pages (list with filtering, detail view with status update) under `/admin/store/orders/...`.
    - Added admin inventory management page (`/admin/store/inventory`) for bulk stock updates.
    - Added admin deletion functionality (with confirmation dialogs) for products and variants, including checks for dependencies (variants must be deleted before product, variants in orders cannot be deleted).
    - Added "Store" section with "Products", "Inventory", and "Orders" links to Admin Navbar.
- Implemented Family Order History page (`/family/orders`) to display past store purchases.
- Added Supabase Storage bucket creation instructions to `README.md`.
- Added utility functions for currency and date/time formatting (`app/utils/misc.ts`).

### Fixed
- Resolved foreign key dependency error in `supabase-setup.sql` that could prevent successful database setup.
- Fixed an issue preventing the family store purchase page (`/family/store/purchase/:studentId`) from loading (404 error).
- Corrected logic for handling product/variant updates and deletions in the admin panel.
- Fixed data loading issue in the admin order details page.

### Changed
- Updated Admin Students page (`/admin/students`) to correctly consider completed store orders when determining the last 'Gi' purchase date.

## [1.1.2] - 2025-04-14

### Changed
- Updated product deletion logic (`/admin/store/products/:productId/edit`) to automatically delete associated variants *unless* those variants are linked to existing order items. If variants are linked to orders, product deletion is blocked.

## [1.1.1] - 2025-04-14

### Changed
- Changed payment receipts to display the tax description (e.g., "Goods and Services Tax") instead of the short name (e.g., "GST"), with fallback to the name if description is missing.

## [1.1.0] - 2025-04-13

### Added
- Implemented dynamic, multi-tax support based on configurable rates in the database (`tax_rates` table).
- Implemented custom, self-hosted payment receipts (`/family/receipt/:paymentId`) with tax breakdown and print-friendly styling.
- Added display of last 4 card digits on payment receipts.
- Added receipt link to the "Recent Payment" section on the Family Portal.

### Changed
- Payment processing now uses dynamic server-side tax calculation based on `tax_rates`, replacing the previous manual calculation method.

### Fixed
- Numerous fixes related to payment processing, data fetching, type safety, and UI consistency introduced during the implementation of the above features.

### Removed
- *No significant removals in this section.*

## [1.0.1] - 2025-04-11

### Changed

-   Applied consistent `.input-custom-styles` class to `Input` and `Textarea` components in the Contact form (`/contact`).
-   Ensured consistent application of `.input-custom-styles` in the Registration form (`/register`), removing redundant styles from `Textarea` and `SelectTrigger` components.
-   Ensured consistent application of `.input-custom-styles` in the Add Student form (`/family/add-student`), removing redundant styles from `SelectTrigger` components.
-   Ensured consistent application of `.input-custom-styles` in the Admin Attendance Report form (`/admin/attendance/report`), removing redundant styles from date `Input` components.
-   Ensured consistent application of `.input-custom-styles` in the Admin Attendance Record form (`/admin/attendance/record`), removing redundant styles from date `Input` and applying to `Textarea`.
-   Ensured consistent application of `.input-custom-styles` in the Admin Attendance History filter form (`/admin/attendance`), removing redundant styles from date `Input` and `SelectTrigger` components.
-   Ensured consistent application of `.input-custom-styles` in the `FamilyManager` component (`app/components/FamilyManager.tsx`) for all `Input` and `SelectTrigger` elements.
-   Standardized page header styling on the Contact page (`/contact`) to match the About page (`/about`).
-   Applied `.input-custom-styles` to the Province `SelectTrigger` in the Family Account Settings form (`/family/account`) for consistent styling.
-   Applied `.input-custom-styles` to the Relationship `SelectTrigger` in the Admin Edit Guardians form (`/admin/families/:familyId/guardians/edit`) for consistent styling.
-   Applied `.input-custom-styles` to the Relationship `SelectTrigger` in the Family Guardian Edit form (`/family/guardian/:guardianId`) for consistent styling.
-   Applied `.input-custom-styles` to the Relationship `SelectTrigger` in the Family Add Guardian form (`/family/add-guardian`) for consistent styling.
-   Ensured consistent application of `.input-custom-styles` in the Admin Edit Family form (`/admin/families/:familyId/edit`) for all `Input` components.
-   Changed Province field in Admin Edit Family form (`/admin/families/:familyId/edit`) from `Input` to `Select` for consistency.
-   Wrapped Province `Select` in Admin Edit Family form (`/admin/families/:familyId/edit`) with `ClientOnly` and added hidden input, mirroring Family Account page pattern.
-   Changed Referral Source field in Admin Edit Family form (`/admin/families/:familyId/edit`) from `Input` to `Select` for consistency, wrapped in `ClientOnly`.
-   Centralized the list of Canadian provinces/territories in `app/config/site.ts` and updated relevant forms (`Admin Edit Family`, `Family Account`, `Register`, `Admin New Family`) to use this central list.
-   Standardized page header styling on the Admin Family Detail page (`/admin/families/:familyId`) to match other site pages.
-   Applied consistent container padding/width and link styling to Admin Family Detail page (`/admin/families/:familyId`) to match Payments page.
-   Applied consistent Card background colors (`bg-white dark:bg-gray-800`) on Admin Family Detail page (including Students card) to match Payments page table container.
-   Applied consistent container, header, and card background styling to Admin Attendance Report page (`/admin/attendance/report`).
-   Updated "Record Today's Attendance" button on Admin Attendance Report page to use default variant for consistency.
-   Renamed "Generate Report" button to "Update Report" on Admin Attendance Report page for clarity.

### Fixed

-   Fixed Supabase query parse error in `getFamilyDetails` service by removing comments from the `select` string.
-   Fixed build error (`Unexpected "{"`) in Admin Edit Family form (`/admin/families/:familyId/edit`) by correcting a missing closing brace in the `ActionData` type definition.
-   Fixed ESLint errors (unused import `MetaFunction`, extra semicolon) in Admin Edit Family form (`/admin/families/:familyId/edit`).

## [1.0.0] - 2025-04-10

### Added

-   Added dedicated guardian detail/edit page (`/family/guardian/:guardianId`).
-   Added dedicated "Add Guardian" page (`/family/add-guardian.tsx`) for family portal users.
-   Added guardian service (`app/services/guardian.server.ts`).
-   Added dedicated Guardian API endpoints:
    -   `GET /api/v1/families/{familyId}/guardians` (List guardians for family)
    -   `POST /api/v1/families/{familyId}/guardians` (Create guardian for family)
    -   `GET /api/v1/guardians/{guardianId}` (Get specific guardian)
    -   `PUT /api/v1/guardians/{guardianId}` (Update specific guardian)
    -   `DELETE /api/v1/guardians/{guardianId}` (Delete specific guardian)
-   Added server-side validation for required fields in web registration and student edit forms.
-   Added dedicated `tsconfig.json` for `mcp_server` build.

### Changed

-   **Refactored Registration:** Simplified web registration (`/register`) to a single page, removing Guardian #2 and student entry sections.
-   **Refactored API Registration:** Removed `guardian2` and `students` arguments from the `/api/v1/auth/register` endpoint and the corresponding MCP server tool.
-   **Refactored Guardian Management:**
    -   Removed guardian editing from the family account settings page (`/family/account`).
    -   Removed automatic fetching of guardians from family detail service and API endpoints (`/family/me`, `/api/v1/families/:familyId`). Clients must now use dedicated guardian endpoints.
-   Updated labels on registration page for clarity (Primary Guardian, Emergency Contact).
-   Made Emergency Contact field optional on registration page.
-   Applied consistent `.input-custom-styles` class to `Input` and `Textarea` components across various forms.

### Fixed

-   Resolved numerous TypeScript errors related to unused variables/imports, duplicate declarations, property access on potentially non-existent objects, and Supabase query typing.
-   Fixed `process is not defined` errors in `mcp_server` build output by importing `process` in source files.
-   Fixed `__importDefault is not defined` error in `mcp_server` build output by adding a dedicated `tsconfig.json`.
-   Fixed invalid JSON error in `mcp_server/tsconfig.json`.
-   Fixed incorrect property access (`responseBody.error`) in `mcp_server/src/apiClient.ts`.
-   Removed invalid `email_redirect_to` option from Supabase admin `createUser` call.
-   Fixed guardian deletion not persisting by using explicit admin client and ensuring correct redirect behavior.
-   Fixed validation error for `relationship` field in guardian forms by using `<Select>` component and ensuring value submission.
-   Fixed `useLayoutEffect` server-side warning in admin guardian edit form by wrapping content in `<ClientOnly>`.
-   Fixed RLS errors during guardian creation/deletion by using explicit admin client.
-   Fixed duplicate variable declarations (`guardian`, `actionData`) in guardian detail page.
-   Replaced browser confirm dialog with Shadcn `AlertDialog` for student deletion confirmation (`/family/student/:studentId`).
-   Fixed student deletion not persisting by using explicit admin client (`/family/student/:studentId`).

### Removed

-   Multi-step logic and UI from the web registration form.
-   Guardian #2 section and related logic from web registration form, API, and MCP server.
-   Student section and related logic from web registration form, API, and MCP server.
-   Guardian editing forms and logic from the family account settings page.
-   Unused imports/variables in guardian-related routes.
