# Curriculum & Adult Self-Registration Feature Plan

**Date:** 2026-03-03
**Status:** Planning
**Priority:** Medium
**Estimated effort:** ~3–4 days development

---

## Overview

Add a public-facing **Curriculum** section to the application that exposes adult-oriented
programs, seminars, and events. Adults (with a `self`-type family account) should be able
to browse offerings and self-register into classes and events without requiring admin
intervention, mirroring the existing youth enrollment flow.

### What already exists in the database

The schema already has all the discriminating fields — nothing new needs to be created:

| Table | Field | Values | Purpose |
|---|---|---|---|
| `programs` | `audience_scope` | `youth / adults / mixed` | Discriminates adult vs youth programs |
| `programs` | `engagement_type` | `program / seminar` | Separates seminars from ongoing programs |
| `classes` | `allow_self_enrollment` | boolean | Bypasses admin approval for adults |
| `events` | `allow_self_participants` | boolean | Allows adult self-registration (not as a student) |
| `event_registrations` | `participant_profile_id` | uuid FK → profiles | Stores the adult registrant (not student_id) |
| `students` | `is_adult` | boolean | Whether a student record represents an adult |
| `families` | `family_type` | `household / self / organization` | `self` = solo adult member |

---

## Tasks

### Task 1 — Database Migration (migration 042)

**Scope:** Likely no schema changes needed. The migration will:

1. Add a composite index on `programs(audience_scope, is_active)` for efficient Curriculum queries
2. Add a composite index on `classes(program_id, allow_self_enrollment, is_active)` for self-enrollment filtering
3. Optionally add a `slug` to `programs` if not already populated (for SEO-friendly URLs)
4. Verify the `event_registrations.participant_profile_id` FK is indexed

**File:** `supabase/migrations/042_add_curriculum_indexes.sql`

```sql
-- Efficient filtering of adult programs for Curriculum page
CREATE INDEX IF NOT EXISTS idx_programs_audience_scope_active
    ON programs(audience_scope, is_active)
    WHERE is_active = true;

-- Efficient filtering of self-enrollable classes
CREATE INDEX IF NOT EXISTS idx_classes_self_enrollment
    ON classes(program_id, allow_self_enrollment, is_active)
    WHERE allow_self_enrollment = true AND is_active = true;

-- Index for adult event self-registration lookups
CREATE INDEX IF NOT EXISTS idx_event_registrations_participant_profile
    ON event_registrations(participant_profile_id)
    WHERE participant_profile_id IS NOT NULL;
```

---

### Task 2 — Regenerate TypeScript Types

After applying migration 042, run:

```bash
npx supabase gen types typescript --local > app/types/database.types.ts
```

Or if using remote:
```bash
npx supabase gen types typescript --project-id <project-id> > app/types/database.types.ts
```

**Note:** `audience_scope`, `is_adult`, `allow_self_participants` etc. already exist in the
DB and should already be in `database.types.ts`. Verify before doing unnecessary regen.

---

### Task 3 — Update ProgramService with Adult Filters

**File:** `app/services/program.server.ts`

Add `audience_scope` and `engagement_type` filters to `getPrograms()`:

```typescript
// Add to ProgramFilters interface (app/types/multi-class.ts or inline)
export interface ProgramFilters {
  audience?: 'youth' | 'adults' | 'mixed';
  engagement_type?: 'program' | 'seminar';
  is_active?: boolean;
  // ... existing filters
}

// In getPrograms():
if (filters?.audience) {
  query = query.or(
    `audience_scope.eq.${filters.audience},audience_scope.eq.mixed`
  );
}
if (filters?.engagement_type) {
  query = query.eq('engagement_type', filters.engagement_type);
}
```

Add a dedicated helper used by the Curriculum route:

```typescript
export async function getAdultPrograms(
  supabase: SupabaseClient,
  engagement_type?: 'program' | 'seminar'
) {
  return getPrograms(supabase, {
    audience: 'adults',
    engagement_type,
    is_active: true,
  });
}
```

---

### Task 4 — Update ClassService with Self-Enrollment Filter

**File:** `app/services/class.server.ts`

Add `allow_self_enrollment` filter to `getClasses()`:

```typescript
if (filters?.allow_self_enrollment !== undefined) {
  query = query.eq('allow_self_enrollment', filters.allow_self_enrollment);
}
```

Add helper for Curriculum:

```typescript
export async function getSelfEnrollableClasses(
  supabase: SupabaseClient,
  programId?: string
) {
  return getClasses(supabase, {
    program_id: programId,
    allow_self_enrollment: true,
    is_active: true,
    registration_status: 'open',
  });
}
```

---

### Task 5 — Extend Enrollment Workflows for Adult Self-Registration

**File:** `app/services/enrollment.server.ts`

Current flow: parent selects a child `student_id` → admin approves (unless auto).
Adult flow: the adult IS the student (`students.is_adult = true`).

Changes needed:

1. In `validateEnrollment()`: skip guardian/parent checks if `student.is_adult = true`
2. In `enrollStudent()`: check `class.allow_self_enrollment` — if true, set status to
   `active` directly (skip `pending_waivers` intermediary if waiver not required)
3. Expose a new RPC-backed function `selfEnrollAdult(classId, profileId)` that:
   - Finds the adult student record linked to `profileId`
   - Calls `enrollStudent()` with that `student_id`
   - Returns enrollment confirmation

---

### Task 6 — Update EventService for Adult Participants

**File:** `app/services/event.server.ts`

Extend `canUserRegister()` to support adult self-participation:

```typescript
// Currently checks family-based registration
// Add: if event.allow_self_participants, allow profile-level registration
if (event.allow_self_participants && session?.user?.id) {
  return { canRegister: true, reason: 'adult_self_participant' };
}
```

Add new function for creating adult event registrations:

```typescript
export async function registerAdultForEvent(
  supabase: SupabaseClient,
  eventId: string,
  profileId: string,
  options?: { paymentAmountCents?: number }
) {
  return supabase.from('event_registrations').insert({
    event_id: eventId,
    participant_profile_id: profileId,
    family_id: null,        // No family for self-registered adults
    student_id: null,       // No student — adult registers as themselves
    registration_status: 'registered',
    payment_amount_cents: options?.paymentAmountCents ?? 0,
  });
}
```

---

### Task 7 — Create Curriculum Route

**File:** `app/routes/_layout.curriculum.tsx` (new file)

A public-facing browsing page with three tabs:

```
/curriculum              → Programs tab (adult ongoing programs)
/curriculum?tab=seminars → Seminars tab (adult workshops/clinics)
/curriculum?tab=events   → Events tab (adult-open events)
```

**Loader:**
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const { supabase } = await createServerClient(request);
  const url = new URL(request.url);
  const tab = url.searchParams.get('tab') ?? 'programs';

  const [programs, seminars, events] = await Promise.all([
    getAdultPrograms(supabase, 'program'),
    getAdultPrograms(supabase, 'seminar'),
    EventService.getAllUpcomingEvents(supabase, { allowSelfParticipants: true }),
  ]);

  return json({ programs, seminars, events, tab });
}
```

**UI Structure:**
- Tabs: Programs | Seminars | Events
- Each program card shows: name, description, schedule (sessions/week), price, belt requirements
- "Enroll" CTA links to self-enrollment flow (or `/login` if unauthenticated)
- Events tab reuses existing event card components but shows "Register as Participant" instead of student-based flow

**Route file pattern:** follows `_layout` prefix so it gets the site header/nav.

---

### Task 8 — Build Adult Self-Enrollment Flow UI

**Files to create/modify:**

#### `app/routes/_layout.classes.$id.self-enroll.tsx` (new)

Simplified enrollment flow for adults:
1. Show class details + schedule
2. Show applicable waivers if any (reuse waiver signing components)
3. Show pricing and payment if required
4. Submit → calls `selfEnrollAdult()` server action
5. Redirect to `/family` dashboard with success toast

No student selection step needed — the adult is the participant.

#### Modify `app/routes/_layout.events.$eventId_.register.tsx`

Add a branch: if `event.allow_self_participants` AND user has `family_type = 'self'`:
- Skip student selection step entirely
- Show "Register as yourself" CTA
- On submit, call `registerAdultForEvent()` instead of standard family registration

---

### Task 9 — Update Admin Navigation

**File:** `app/components/AdminNavbar.tsx`

The current `programsClassesNavItems` dropdown contains Programs, Classes, Sessions.
Add "Curriculum" as either:

**Option A — Add to existing dropdown:**
```typescript
{ label: 'Curriculum', href: '/admin/curriculum', icon: BookOpen }
```

**Option B — New top-level "Curriculum" section:**
```typescript
const curriculumNavItems = [
  { label: 'Programs', href: '/admin/programs' },
  { label: 'Classes', href: '/admin/classes' },
  { label: 'Sessions', href: '/admin/sessions' },
  { label: 'Public Curriculum', href: '/curriculum', external: true },
];
```

Recommendation: **Option B** — rename existing "Programs & Classes" dropdown to "Curriculum"
and add a link to the public `/curriculum` page for quick preview.

---

### Task 10 — Update Family Dashboard

**File:** `app/routes/_layout.family._index.tsx`

For families with `family_type = 'self'` (solo adult members), the dashboard currently
shows student cards which won't apply. Add a conditional section:

```typescript
{family.family_type === 'self' && (
  <AdultMemberSection
    enrollments={enrollments}
    upcomingEvents={upcomingEvents}
    curriculumLink="/curriculum"
  />
)}
```

`AdultMemberSection` shows:
- Current class enrollments for the adult
- Upcoming registered events
- CTA to browse `/curriculum`

---

## Implementation Order

Given dependencies, implement in this sequence:

```
1 (migration) → 2 (types) → 3+4 (services) → 5+6 (enrollment/event logic)
                                                    ↓
                                              7 (curriculum route)
                                                    ↓
                                              8 (self-enroll UI)
                                                    ↓
                                              9+10 (nav + dashboard)
```

Tasks 3 and 4 can be done in parallel.
Tasks 5 and 6 can be done in parallel.
Tasks 9 and 10 can be done in parallel after 7 is complete.

---

## Testing Checklist

- [ ] Adult program with `audience_scope = adults` appears in `/curriculum`
- [ ] Youth-only program does NOT appear in `/curriculum`
- [ ] Mixed program appears in `/curriculum`
- [ ] Seminar appears under Seminars tab
- [ ] Adult event with `allow_self_participants = true` appears under Events tab
- [ ] Unauthenticated user sees Curriculum but "Enroll" redirects to `/login`
- [ ] Adult with `family_type = self` can self-enroll in class with `allow_self_enrollment = true`
- [ ] Standard youth family CANNOT use self-enrollment route (redirect or 403)
- [ ] Adult event registration creates `event_registrations` row with `participant_profile_id` set, `student_id = null`
- [ ] Family dashboard for `self` type shows adult section
- [ ] Admin nav updated with Curriculum link

---

## Open Questions

1. **Waiver flow for adults**: Should adults go through the same 3-step waiver flow? Or a simplified inline waiver signing on the enrollment page?
2. **Payment for adult classes**: Is the existing Square/Stripe flow reused, or is a new pricing model needed (drop-ins, punch cards)?
3. **Belt rank requirements on adult programs**: The `min_belt_rank` / `max_belt_rank` fields exist — do adult self-enrolled classes still enforce these, or is it honor-system?
4. **Email notifications**: Should self-enrollment trigger the same confirmation emails as admin-approved enrollment?
