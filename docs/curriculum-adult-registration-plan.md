# Curriculum & Adult Registration Plan (Revised)

## Summary
Implement curriculum and adult self-registration by selectively reusing `seminars` branch work while preserving the current branch's hardened service and test architecture.

## Locked Decisions
1. Use selective porting from `seminars`; do not merge branch wholesale.
2. Keep migration numbering/history on current branch; add migration `042+` only.
3. Use full waiver-signature enforcement for adult flows where required; do not rely on checkbox-only waiver acknowledgement.
4. Reuse existing payment/tax checkout flows; do not add a new pricing engine in this phase.
5. Keep belt/eligibility enforcement for adult self-enrollment through the existing enrollment eligibility path.
6. Unrelated `seminars` deltas are `Essential Only`: port only waiver signer fallback.

## `seminars` Reuse / Exclusion Strategy
### Reused
- Curriculum route surface and seminar browse/detail/register route scaffolding.
- Self-registration service scaffolding (`self-registration.server.ts`) adapted to current service conventions.
- Adult registration UI behavior merged into canonical event registration flow.
- Essential waiver signer fallback for `family_type='self'`.

### Explicitly Excluded
- `seminars` migrations `025`, `026`, `027`.
- `seminars` cleanup-only changes in calendar/payment/misc/schedule/offline-cache, unless needed to keep lint/typecheck/tests/build green.

## Implementation Workstreams
1. **Database and Type Baseline**
- Add `supabase/migrations/042_add_curriculum_adult_registration_indexes.sql` for curriculum/adult query paths.
- Keep existing enum/column model as source of truth.
- Regenerate `app/types/database.types.ts` only if migration demands it.

2. **Program/Class Service Surface**
- Extend `app/services/program.server.ts` with `engagement_type` + `audience_scope` filtering and `getAdultPrograms(...)`.
- Keep seminar helper coverage (`getSeminars`, `getProgramBySlug`, `getSeminarWithSeries`) aligned with current code standards.
- Extend `app/services/class.server.ts` with `allow_self_enrollment` filtering and `getSelfEnrollableClasses(...)`.

3. **Self-Registrant Provisioning**
- Port/adapt `app/services/self-registration.server.ts`.
- Ensure idempotent self-family + self-student provisioning for repeated registrations.

4. **Enrollment/Event Adult Flow**
- Add `selfEnrollAdult(...)` in `app/services/enrollment.server.ts` using existing validation/error contracts.
- Add `registerAdultForEvent(...)` in `app/services/event.server.ts` with `participant_profile_id` and duplicate protection.
- Port self-registration route/form behavior into canonical:
  - `app/routes/_layout.events.$eventId_.register.tsx`
  - `app/components/EventRegistrationForm.tsx`

5. **Curriculum Routes**
- Add/port:
  - `app/routes/_layout.curriculum._index.tsx`
  - `app/routes/_layout.curriculum.seminars.$slug._index.tsx`
  - `app/routes/_layout.curriculum.seminars.$slug.register.tsx`
- Enforce adult/mixed inclusion and youth-only exclusion in loaders.

6. **Family and Waiver Compatibility**
- Add seminar enrollments card + self-family branch in `app/routes/_layout.family._index.tsx`.
- Port essential signer fallback for self registrants in `app/routes/_layout.family.waivers.$id.sign.tsx`.

7. **Navigation**
- Add curriculum link in `app/components/PublicNavbar.tsx`.
- Add rollout-scoped curriculum/seminar admin links in `app/components/AdminNavbar.tsx`.

## Public Interface Changes
1. `ProgramFilters` in `app/types/multi-class.ts`:
- `engagement_type?: 'program' | 'seminar'`
- `audience_scope?: 'youth' | 'adults' | 'mixed'`

2. `ClassFilters` in `app/types/multi-class.ts`:
- `allow_self_enrollment?: boolean`
- `engagement_type?: 'program' | 'seminar'`

3. New service functions:
- `getAdultPrograms(...)`
- `getSelfEnrollableClasses(...)`
- `selfEnrollAdult(...)`
- `registerAdultForEvent(...)`

4. Event registration payload/UI extensions:
- `registerSelf`
- `selfParticipant`
- `selfParticipantStudentId`

## Required Tests (Definition of Done)
1. **Unit tests**
- `app/services/__tests__/self-registration.server.test.ts`
- Program/class curriculum filter tests in `app/services/__tests__/`.
- `selfEnrollAdult` behavior tests in `app/services/__tests__/`.
- Event self-participant duplicate-protection tests in `app/services/__tests__/`.
- Waiver signer fallback loader/action tests in `app/routes/__tests__/`.

2. **Integration/route tests**
- Event registration action path in `_layout.events.$eventId_.register.tsx` for household and self flows.
- Curriculum loader tests for adults/mixed inclusion and youth-only exclusion.

3. **E2E**
- `tests/e2e/curriculum-adult-registration.spec.ts`:
  - Anonymous curriculum browse + login redirect checks.
  - Self-family seminar registration route coverage.
  - Self participant event registration route coverage.
  - Household event registration non-regression coverage.

4. **Required command gate**
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npx playwright test tests/e2e/curriculum-adult-registration.spec.ts`
- `npm run build`

## Required Documentation Updates
1. `docs/curriculum-adult-registration-plan.md` (this document):
- Locked decisions and `seminars` reuse/exclusion strategy.

2. `docs/TESTING_PLAN.md`:
- Curriculum/adult regression scope, ownership, and command gate.

3. `docs/MULTI_CLASS_SYSTEM_DESIGN.md`:
- Curriculum/adult model extensions and self-family/self-participant flow mapping.

4. `docs/WAIVER_SYSTEM_GUIDE.md`:
- Signer resolution fallback for `family_type='self'`.

5. `docs/ARCHITECTURE.md`:
- Curriculum route map and adult registration data flow.

6. `docs/DEPLOYMENT.md`:
- Migration `042` rollout and post-deploy verification checklist.

7. `CHANGELOG.md`:
- User-facing summary for curriculum + adult self-registration release.

## Acceptance Criteria
1. Adult/mixed programs and seminars appear on curriculum pages; youth-only content is excluded.
2. Self-family users can complete class/event self-registration where enabled.
3. Self event registrations set `participant_profile_id` correctly.
4. Waiver signing works for users without guardian rows.
5. Required tests and command gate pass.
6. Required docs and changelog are updated with the feature.
