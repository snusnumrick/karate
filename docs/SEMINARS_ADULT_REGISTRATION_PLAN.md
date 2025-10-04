# Seminars & Adult Registration Implementation Plan

## Purpose
Define how to extend the current programs/events architecture to support multi-session seminars and adult self-registration while reusing existing tables, services, and UI patterns.

## Current Landscape
- **Programs / Classes / Sessions**: Ongoing engagements for youth members tied to families and students. Relies on `programs`, `classes`, `class_sessions`, enrollments, and tuition billing.
- **Events**: One-off or date-bound engagements surfaced via `events` and `event_registrations`, with optional payments but lighter roster management.
- **Participants**: Students belong to families; guardians authenticate. Adult participation today requires shoehorning into student constructs, which is awkward for external instructors or standalone adults.

## Goals
1. Introduce a “seminar” engagement modeled on programs (shared description, structured series, fixed number of sessions) without new top-level tables.
2. Enable adult/self registrants to sign waivers, pay, and attend without belonging to a child-focused household.
3. Keep implementation aligned with existing services, minimizing schema churn and duplication.
4. Provide a unified UX that groups Programs, Seminars, and Events under a single curriculum entry point.

## Data Model Strategy
- **Programs Table**
  - Introduce `engagement_type` enum (`'program' | 'seminar'`) default `'program'` to distinguish ongoing programs from seminar templates.
  - Add marketing/eligibility helpers surfaced in the curriculum sheet:
    - `ability_category` enum (`'able' | 'adaptive'`),
    - `delivery_format` enum (`'group' | 'private' | 'competition_individual' | 'competition_team' | 'introductory'`),
    - `audience_scope` enum (`'youth' | 'adults' | 'mixed'`).
  - Extend pricing columns so all displayed amounts have a home: `single_purchase_price`, `subscription_monthly_price`, `subscription_yearly_price`, all stored as Money/cents.
  - Keep existing min/max age and belt columns; expose `min_capacity` as an optional program-level default for downstream classes/series.
- **Classes Table (Programs & Seminar Series)**
  - Continue to represent both recurring class sections and seminar “series”. Add nullable seminar-specific fields: `series_label`, `series_start_on`, `series_end_on`, `sessions_per_week_override`, `session_duration_minutes`, `series_session_quota`, and `allow_self_enrollment`.
  - Persist the spreadsheet’s roster bounds via `min_capacity`/`max_capacity` and reuse the new program delivery metadata for filtering badges.
- **Class Sessions**
  - Add `sequence_number` for ordered seminar/session timelines and support multiple explicit date/time slots (`starts_at`, `ends_at`).
  - Retain the ability to mark on-demand sessions by flagging the parent class (`on_demand = true`) and skipping sequence enforcement.
- **Families Table**
  - Add `family_type` enum (`'household' | 'self' | 'organization'`) default `'household'` so adult/self registrants can exist without youth context.
- **Students Table**
  - Add `is_adult boolean` default `false` and nullable `profile_id` reference when the “student” is actually the authenticated adult.
  - Relax youth-only attributes (school, grade, immunizations) to nullable so self registrants can be stored without filler data.
- **Event Tables**
  - Extend `events` with `min_capacity`, multi-slot scheduling (`slot_one_start`, `slot_one_end`, `slot_two_start`, `slot_two_end`), and retain registration/payment fields (`registration_fee`, `registration_deadline`).
  - Allow events to opt into adult/self flows with `allow_self_participants` mirroring seminars.
- **Event Registrations**
  - Add nullable `participant_profile_id` alongside the existing `student_id` to capture adult registrants, plus `waiver_status` so self families can track required paperwork.

## Backend & Service Updates
1. **ProgramService / ClassService**
   - Filter by `engagement_type`, `ability_category`, and `delivery_format` so curriculum filters match the spreadsheet groupings.
   - Introduce helper to fetch seminar templates with their series + ordered sessions (joining `programs`, `classes`, `class_sessions`).
   - Ensure Money helpers hydrate the new pricing columns before serialising to the UI.
2. **Enrollment Workflows**
   - Extend enrollment creation to detect `allow_self_enrollment` and `family_type`. If the authenticated profile lacks a family or chooses self registration, auto-provision:
     - Create `families` row with `family_type = 'self'`.
     - Create matching `students` row with `is_adult = true`, linking `profile_id`.
   - Reuse existing payment + waiver flows; skip youth-only validations for adult flagged students.
3. **Eligibility Checks**
   - Update payment and attendance eligibility services to accept `is_adult` participants and respect `audience_scope` on seminars/events.
4. **Event Service**
   - Support `allow_self_participants` flag mirroring seminar behavior, using `participant_profile_id` when no student is present and exposing multi-slot schedule fields.
5. **Authentication Redirects**
   - Expand redirect utilities to preserve `intendedEngagement` meta (`program|seminar|event` + id) so adult flows resume post-login.
6. **Admin Tooling**
   - Reuse admin program CRUD with an `engagement_type` selector.
   - For seminar series, allow editing the extra series fields and bulk-managing the fixed sessions timeline.

## UI Plan
### Curriculum Grouping
- Rename the primary navigation entry to **Curriculum**.
- Under Curriculum, provide segmented tabs or a three-column layout for **Programs**, **Seminars**, and **Events**.
  - **Programs**: cards show ability (Able/Adaptive), delivery format (Group/Private/etc.), ages, capacity range, session cadence, and the three price points (single, monthly, yearly).
  - **Seminars**: cards show the seminar template description, ability/delivery badges, upcoming series chips (e.g., “Fall 2025 Series”), session count, series price, and total duration.
  - **Events**: highlight the event type (Competition/Belt Exam/etc.), visibility, registration deadline, and indicate one or two date/time slots.
- Visually differentiate engagement types and ability categories with Tailwind theme tokens, ensuring dark-mode parity.

### Landing Pages
- `/curriculum` route consolidates marketing copy, with anchor sections for each engagement type plus filters for ability/delivery.
- Dedicated detail pages reuse existing layouts:
  - Programs stay on current `classes` routes but surface the expanded pricing table and cadence data.
  - Seminars get `/curriculum/seminars/:slug` using program detail template plus ordered series timeline, session roster size, and “Register as adult” CTA when applicable.
  - Events remain under `/events/:id`; when `allow_self_participants`, surface adult CTA beside family registration button and render both schedule slots when provided.

### Registration Flows
- **Authenticated Family**
  - Select seminar series → choose student(s) or “Add adult participant” option if enabled.
- **Unauthenticated Visitor**
  - Start from Curriculum card → redirected to login with contextual copy (“Sign in to register for Fall Instructor Seminar”).
  - Post-auth redirect returns to the seminar/event registration screen with state restored.
- **Adult Self Signup**
  - If no family exists, display short intake form (contact, waiver acknowledgement). On submit, create `family_type='self'`, `student.is_adult=true`, then proceed to payment.
  - If adult already registered, list their prior seminar enrollments in dashboard.

### Dashboard Integrations
- Family portal gains **Curriculum** tab showing:
  - Active program enrollments.
  - Upcoming seminar series cards with session schedule.
  - Registered events.
- For `family_type='self'`, tailor language (“Your seminars”) and hide irrelevant family actions (add student, guardians).

### Admin UX
- Update admin sidebar to group “Curriculum” with subsections for Programs, Seminars, Events.
- Seminar detail page offers series timeline editor with drag-to-reorder sessions (using existing session management components).
- Adult registrant list view surfaces self families with contact info and waiver status.

## Admin Navigation Hierarchy
- **Dashboard**
- **Curriculum**
  - Programs
    - Overview (existing programs list/detail)
    - Classes
    - Sessions
  - Seminars
    - Seminar Templates (program-level settings)
    - Seminar Series (class/series management)
    - Sessions (timeline editor)
  - Events
    - Overview
    - Upcoming / Draft
    - Registrations
- **Families & Participants**
  - Households
  - Self Registrants (adults)
  - Students
- **Finance**
  - Payments
  - Invoices
  - Discount Codes & Templates
- **Store** (existing e-commerce entries)
- **Communications** (messages, notifications)
- **Settings / Admin Tools** (waivers, tax rates, etc.)

## Adult Registration Flow
1. Visitor selects a seminar series or event with self registration enabled from the Curriculum page.
2. If not authenticated, redirect to login with contextual copy (“Sign in to register for the Fall Instructor Seminar”).
3. After authentication:
   - If the profile belongs to a household family, display existing students plus “Register yourself” CTA when audience allows adults.
   - If the profile lacks a family, prompt for a short intake form (contact details, emergency contact optional, waiver acknowledgement).
4. Backend provisions `families.family_type = 'self'` and a `students` record flagged `is_adult = true`, linked to the profile.
5. Registration summary confirms participant details, surfaces required waivers (seminar creator selects appropriate waivers), and proceeds to payment.
6. Payment completes via Square/Stripe checkout; send receipt (no invoice unless future enhancement enabled).
7. Confirmation screen provides calendar add/download links and reiterates waiver status; dashboard reflects the upcoming seminar under the Curriculum tab.

## Migration & Rollout Steps
1. Write SQL migration covering schema adjustments and enum additions.
2. Regenerate Supabase TypeScript types (`npm run typecheck` to validate).
3. Update server utilities and loaders per sections above; add unit tests for self family provisioning.
4. Adjust seeding scripts to flag at least one seminar example.
5. Update docs (`MULTI_CLASS_SYSTEM_DESIGN.md`, `DEPLOYMENT.md`, onboarding manuals) with new engagement flows and required environment variables.
6. QA scenarios:
   - Youth family enrolls in seminar series.
   - New adult registers via seminar link.
   - Event with adult opt-in shows both flows.
   - Access control ensures adults see only their data.

## Decisions & Follow-Ups
- **Tiered Pricing**: Leverage existing automatic discount engine (e.g., early-bird promo codes/conditions) instead of bespoke seminar pricing tiers.
- **Receipts vs Invoices**: Send checkout receipts only; keep architecture open to bolt-on invoice generation later if required.
- **Waiver Selection**: Seminar/event creators choose the waiver template during setup, mirroring current event behavior to support adult-specific agreements.
- **Branding/Terminology**: Use “Curriculum” consistently across public and admin surfaces.
