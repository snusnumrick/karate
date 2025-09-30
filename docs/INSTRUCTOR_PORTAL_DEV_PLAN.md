# Instructor Portal & Role Enumeration Development Plan

## Overview
This plan covers two parallel initiatives:

1. Replace the free-form `role` column in `profiles` with a well-defined enum that reflects the supported access tiers (`user`, `instructor`, `admin`).
2. Deliver an instructor-focused portal that streamlines daily teaching tasks, including an iPad-friendly attendance capture flow that automatically flags late arrivals.

The work is broken into phases so we can stage the migration safely, introduce the instructor experience iteratively, and keep parity across web and Supabase Edge environments.

---

## Phase 1 — Role Enumeration Foundation

- **Schema migration**
  - Add a Postgres enum `profile_role` with values `user`, `instructor`, `admin`.
  - Migrate existing `profiles.role` values into the new enum, defaulting blank entries to `user`.
  - Update Supabase type definitions (`app/types/database.types.ts`, Edge functions) and regenerate any generated client types.
  - Enforce the enum at the database level (`ALTER TABLE profiles ALTER COLUMN role TYPE profile_role USING role::profile_role;`), keeping a rollback script handy.
- **Application typing**
  - Define a shared TypeScript union (e.g., `type UserRole = 'user' | 'instructor' | 'admin'`) sourced from the database enum so server and client code stay in sync.
  - Refine auth helpers, redirect guards, and loaders to consume the union instead of raw strings; add exhaustive `switch` handling where appropriate.
- **Access control sweep**
  - Audit feature gates to ensure instructor-only and admin-only areas respond correctly once enum values are enforced.
  - Add automated coverage for the guard helpers (unit tests + integration checks for critical routes).

---

## Phase 2 — Instructor Portal MVP

- **Information architecture**
  - Add an "Instructor" root to the authenticated navigation (parallel to Family / Admin). Only users with `role='instructor'` or `admin` should see it.
  - Ensure admins retain access by surfacing the Instructor entry in the global nav when their role is `admin`, allowing quick switching for oversight or subbing.
  - Provide quick links for today’s classes, upcoming sessions, attendance capture, eligibility snapshots, and student lookups.
- **Dashboard**
  - Landing view summarising:
    - Today’s teaching schedule (sessions grouped by location/time) with indicators for roster readiness and outstanding eligibility checks.
    - Attendance status at-a-glance (counts of present/late/absent once recorded).
    - Quick access to class materials already stored in programs (curriculum summaries, key drills) so instructors can review at a glance.
- **Class Session Detail**
  - Condensed roster (student name, belt rank, eligibility status, parent contact in a drawer modal). Use existing student initials as avatar badges until photos land in the data model.
  - Quick actions: mark attendance, add session notes, flag students who require follow-up.
- **Integration points**
  - Reuse existing schedule/services data loaders; expose instructor-safe APIs (read-only except attendance & notes).
  - Ensure caching and authorization middleware consider `instructor` as privileged where necessary.
- **Training & docs**
  - Add portal overview to docs (`docs/InstructorPortalGuide.md`) describing permissions, key workflows, and troubleshooting.

---

## Phase 3 — iPad Attendance Experience

- **Page design**
  - Route: `/instructor/attendance` with optional query params for `class_session_id` or auto-detect current session by time/location.
  - Large tap targets, high-contrast palette, responsive grid that adapts to landscape tablet usage.
  - Present roster cards with initials badge, name, belt, eligibility chip, default status "Unmarked".
- **Interaction flow**
  - Single tap cycles `Unmarked → Present → Late → Absent`; long press opens notes.
  - Timestamp each mark. If recorded >15 minutes after scheduled start, automatically set status `Late` (allow manual override to Absent if needed).
  - Show a running tally (Present/Late/Absent) for coaching awareness.
- **Offline resilience**
  - Queue attendance mutations using background sync (Service Worker) or local storage fallback; display pending indicator until Supabase confirms save.
- **Accessibility**
  - Support keyboard shortcuts (optional) and audible feedback via subtle haptics/audio cues for accessibility.

## Phase 4 — Supporting Features for Instructors

- **Student lookup & notes**
  - Searchable roster filtered by belt/program with quick view of recent attendance streak, eligibility justification, and existing notes.
- **Eligibility insights**
  - Highlight students who are close to falling out of compliance (e.g., attendance streak breaks) using data already tracked in class services.
- **Resource hub**
  - Surface curriculum docs, lesson plans, and quick links to existing reference materials so instructors keep context without leaving the portal.

---

## Future Development Ideas

- **Incident + test workflows**
  - Add reporting widgets for incident follow-up and belt test reviews once those datasets exist.
- **Notifications**
  - Optional push/email alerts when session assignments change or attendance falls behind.

---

## Engineering Considerations

- **Authorization**: centralize instructor capability checks in `requireRole` helpers; introduce middleware to share between Remix routes and edge functions.
- **Data model**: attendance records already store timestamps—extend with a `marked_by` field referencing the instructor profile for auditing, and ensure eligibility data is exposed alongside roster payloads.
- **Caching**: ensure instructor pages leverage existing data caches but bust appropriately when attendance is submitted.
- **Testing**:
  - Unit tests for enum helpers, role guards, attendance late logic, and roster transforms.
  - Integration tests for instructor routes (authenticated vs unauthorized access).
  - E2E (Playwright) scenario for tablet attendance marking, including late threshold handling.
- **Rollout**:
  - Deploy enum migration first; confirm current portals unaffected.
  - Release instructor portal behind feature flag/role assignments to a pilot group.
  - Gather feedback, iterate on UX, then broaden access.

---

## Deliverables Checklist

- [ ] Migration scripts and updated Supabase types for `profile_role` enum.
- [ ] TypeScript union + guard updates across Remix app and edge functions.
- [ ] Instructor navigation entry with dashboard, schedule, roster, and eligibility views.
- [ ] Attendance capture page optimized for iPad, with late detection and eligibility surfacing.
- [ ] Supporting instructor utilities (student lookup, curriculum summaries) based on existing datasets.
- [ ] Documentation updates (dev setup, instructor guide) and test coverage.

---

## Success Metrics

- All `profiles.role` values validated against the enum with zero runtime coercions.
- Instructor portal loads in <2s on iPad over Wi-Fi (cold cache) and key interactions stay sub-100ms.
- Attendance recorded within the portal matches existing admin records, including correct late attribution.
- Positive instructor feedback (qualitative) and reduced reliance on admin dashboard for daily tasks.
