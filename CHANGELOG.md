# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2025-04-06

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

### Changed

-   **BREAKING:** Replaced Stripe Checkout redirection flow with embedded Stripe Elements flow.
-   Renamed `/api/create-checkout-session.ts` to `/api/create-payment-intent.ts`.
-   Updated Stripe webhook handler (`/api/webhooks/stripe`) to process `payment_intent.succeeded` and `payment_intent.payment_failed` events.
-   Updated webhook handler to retrieve Payment Intent via Stripe API to reliably get `receipt_url`.
-   Updated `updatePaymentStatus` utility function to accept `supabasePaymentId` and handle `individual_session` recording.
-   Updated `/family/payment` route to create a `pending` payment record before navigating to the payment form.
-   Updated `/payment/success` loader to query by `payment_intent` and fetch necessary details.
-   Updated `README.md` to reflect the new payment flow, technology stack, setup instructions, and project structure.
-   Refactored code to consistently use `type` instead of `payment_type` for the corresponding database column.
-   Made `app/db/supabase-setup.sql` script more idempotent (added `IF NOT EXISTS` for tables and indexes, corrected enum creation).

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

### Removed

-   Stripe Checkout session creation logic and redirection.
-   Redundant `ALTER TYPE ... RENAME VALUE` statement from `supabase-setup.sql`.
