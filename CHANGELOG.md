# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- *Nothing yet*

### Changed
- *Nothing yet*

### Fixed
- *Nothing yet*

### Removed
- *Nothing yet*

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

---

*Previous entries moved below*

## [2025-04-06]

### Added

-   Implemented embedded payment form using Stripe Elements (`/pay/:paymentId`).
-   Created API endpoint (`/api/create-payment-intent`) to generate Stripe Payment Intents.
-   Added client-side navigation from payment initiation (`/family/payment`) to the payment form page.
-   Added auto-refresh mechanism using `useRevalidator` on the payment success page (`/payment/success`) to handle pending webhook updates.
-   Added display of purchased quantity for individual sessions on the payment success page.
-   Added Stripe receipt link display on the payment success page.
-   Added user-friendly product descriptions on the payment page.
-   Added `stripe_payment_intent_id`, `created_at`, `updated_at` columns to `payments` table schema.
-   Added `one_on_one_sessions` and `one_on_one_session_usage` tables and related logic for tracking individual session purchases and usage.
-   Added `ClientOnly` wrappers in `Navbar` to mitigate hydration issues.
-   Added custom 404 page using a splat route (`app/routes/$.tsx`).
-   Added `useFetcher` pattern for payment initiation form submission to improve reliability.
-   Added "Retry Payment" / "Complete Payment" link to Payment History page for `failed` / `pending` payments.
-   Added `warning` variant to `Alert` component.
-   Added `sync-pending-payments` Supabase Edge Function to reconcile old pending payments via Stripe API check.
-   Added pre-selection of payment option on `/family/payment` page via URL query parameter (`?option=individual`).

### Changed

-   **BREAKING:** Replaced Stripe Checkout redirection flow with embedded Stripe Elements flow.
-   Renamed `/api/create-checkout-session.ts` to `/api/create-payment-intent.ts`.
-   Updated Stripe webhook handler (`/api/webhooks/stripe`) to process `payment_intent.succeeded` and `payment_intent.payment_failed` events.
-   Updated webhook handler to retrieve Payment Intent via Stripe API to reliably get `receipt_url`.
-   Updated `updatePaymentStatus` utility function to accept `supabasePaymentId` and handle `individual_session` recording.
-   Updated `/family/payment` route to create a `pending` payment record before navigating to the payment form.
-   Updated `/payment/success` loader to query by `payment_intent` and fetch necessary details.
-   Updated `README.md` to reflect the new payment flow, technology stack, setup instructions, project structure, and SQL-based function scheduling.
-   Refactored code to consistently use `type` instead of `payment_type` for the corresponding database column.
-   Made `app/db/supabase-setup.sql` script more idempotent (added `IF NOT EXISTS` for tables and indexes, corrected enum creation).
-   Refactored Family Portal (`/family`) layout for better visual balance on wider screens.
-   Modified `/pay/:paymentId` loader to check Stripe status for `pending` payments to prevent double charges and redirect if already succeeded.
-   Modified `updatePaymentStatus` to set `payment_date` for `failed` payments.
-   Improved Payment History sorting to prioritize `created_at`.
-   Improved Payment Success page display logic for `pending` status and when loader initially fails to find the record.

### Fixed

-   Resolved numerous TypeScript errors related to missing properties, type mismatches, and Supabase query parsing.
-   Fixed various JSX syntax errors and tag nesting issues in `Navbar.tsx`.
-   Resolved ESLint Rules of Hooks violations for `useMemo` and `useEffect`.
-   Fixed Stripe Elements `options.clientSecret` prop change warning by memoizing the `options` object.
-   Resolved issue where payment initiation page (`/family/payment`) refreshed instead of performing client-side navigation.
-   Fixed cancel link destination on payment page (`/pay/:paymentId`) to point to `/family`.
-   Improved Stripe Card Element text visibility in dark mode.
-   Removed duplicate code blocks (e.g., `catch` block, CSS `color` property).
-   Corrected Supabase query parsing errors caused by comments within `select` statements.
-   Handled potential `null` or missing `payment.type` property in `/pay/:paymentId` component.
-   Prevented duplicate payment record creation by ensuring payment initiation action only runs once per attempt.
-   Fixed `React.Children.only` error on Family Portal page (related to Button `asChild`).
-   Fixed typo in Payment History loader query (`.from.from`).
-   Made `/payment/success` loader query more robust (`maybeSingle`).
-   Prevented double API calls for creating payment intents from `/pay/:paymentId` page.
-   Corrected `/pay/:paymentId` loader logic to avoid incorrectly marking payments as `failed`.
-   Fixed dark mode visibility for `destructive` Alert variant text.

### Removed

-   Stripe Checkout session creation logic and redirection.
-   Redundant `ALTER TYPE ... RENAME VALUE` statement from `supabase-setup.sql`.
-   Local mutation of `payment` object in `/pay/:paymentId` loader.
