# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Fixed
- **Date Display:** Updated Family Attendance page (`app/routes/_layout.family.attendance.tsx`) to use `parse` from `date-fns` for `class_date`, ensuring consistent and robust date handling. (Commit `0b18219`)
- **Date Display:** Updated Message View component (`app/components/MessageView.tsx`) to use `parseISO` from `date-fns` for parsing `created_at` timestamp, ensuring consistent and robust date handling. (Commit `38b8de7`)
- **Date Display:** Updated Family Conversation List (`app/components/ConversationList.tsx`) to use `parseISO` from `date-fns` for parsing `last_message_at` timestamp, ensuring consistent and robust date handling. (Commit `d46c825`)
- **Date Display:** Updated Admin Conversation List (`app/components/AdminConversationList.tsx`) to use `parseISO` from `date-fns` for parsing `last_message_at` timestamp, ensuring consistent and robust date handling. (Commit `89706b9`)
- **Date Display:** Corrected `payment_date` display on the family payment history page (`/family/payment-history`) to use `date-fns` for robust parsing and formatting, ensuring accurate date representation across timezones. (Commit `0d0f011`)
- **Date Display:** Corrected `lastPaymentDate` (student eligibility) and `payment_date` (recent payment) display on the family portal page (`/family`) to use `date-fns` for robust parsing and formatting, ensuring accurate date representation across timezones. (Commit `58acc6d`)
- **Date Display:** Corrected `awarded_date` for belt awards on the student detail page (`/family/student/:studentId`) and `signed_at` date on the waivers index page (`/waivers`) to use `date-fns` for parsing and formatting, ensuring accurate date representation across timezones. (Commit `e66ab55`)
- **Date Display:** Corrected `payment_date` display on the family receipt page (`/family/receipt/:paymentId`) to accurately reflect the stored date, using `date-fns` for parsing and formatting to avoid timezone issues. (Commit `40b07f8`)
- **Student Display:** Corrected student birth date display on the student detail page (`/family/student/:studentId`) to accurately reflect the stored date, resolving potential timezone-related off-by-one day errors by using `date-fns` for parsing and formatting. (Commit `958bbfb`)
- **Auth:** Resolved RLS error during new user registration by refactoring family, profile, and guardian creation into a `SECURITY DEFINER` PostgreSQL function (`complete_new_user_registration`). This ensures database operations have sufficient privileges while being invoked by the newly authenticated user, addressing issues where the client session might not be immediately recognized as `authenticated` for direct table inserts.
- **Auth:** Corrected an issue in the registration process where an attempt was made to `INSERT` a new profile record instead of `UPDATE`ing the existing one created by the `on_auth_user_created` trigger. This logic is now handled within the `complete_new_user_registration` RPC.
- **Auth:** Updated `complete_new_user_registration` SQL function parameters (e.g., `p_referral_source`, `p_health_info`) to include `DEFAULT NULL`. This helps the Supabase type generator correctly infer these parameters as nullable (e.g., `string | null`) in TypeScript, resolving type errors when calling the RPC from `app/routes/_layout.register.tsx`.
- **Auth:** Corrected SQL definition for `complete_new_user_registration` function to ensure all parameters following one with a `DEFAULT` value also have `DEFAULT` values, resolving PostgreSQL error `42P13`. (Note: Requires regenerating Supabase TypeScript types after applying these SQL changes.)

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
