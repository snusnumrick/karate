# Test Development Plan

## Goal
Establish a practical, maintainable test suite (unit, integration, e2e) that prevents regressions across critical user and admin flows in this Remix + Vite + TypeScript app.

## Tooling & Conventions
- Runner: Vitest (unit/integration) and Playwright (e2e).
- Naming: `*.test.ts(x)` near sources or `__tests__/`; e2e in `tests/e2e/*.spec.ts`.
- Aliases: use `~/*` (tsconfig) for app imports.
- Keep tests deterministic; avoid network/real APIs.

## Current Status
- [x] Vitest configured (`vite.config.ts`) with setup file (`tests/setupTests.ts`).
- [x] NPM scripts added: `test`, `test:unit`, `test:watch`, `coverage`, `test:e2e`.
- [x] Baseline unit tests: money, nonce, meta helpers.
- [x] CI workflow added for lint, typecheck, unit tests.
- [x] JsonLd helper added and unit‑tested.
- [ ] Route smoke tests for public pages.
- [ ] Loaders/actions integration tests.
- [ ] Server header assertions via Supertest.
- [ ] E2E expansion (auth/admin non‑destructive flows).

## Phases
1) Foundation
- Add scripts: `test:unit` (Vitest), `test:e2e` (Playwright), `test` (aggregate), optional `coverage`.
- Vitest config: jsdom, `setupTests.ts`, alias for `~/*`, coverage thresholds (start 60%).
- Install @testing-library/react & user-event; create minimal render helper.

2) Smoke & Routing (UI)
- Smoke tests for `/`, `/about`, `/classes`, `/contact`:
  - Render, key CTAs, error boundaries, head tags.
- Co-locate as `app/routes/**/__tests__/*.test.tsx` or beside route files.

3) Services & Utils (Unit)
- Target pure logic in `app/services` and `app/utils`:
  - Money/price calc, date handling, formatters, validators.
- Use `vi.mock` for Supabase/Stripe; cover edge cases and failures.

4) Loaders/Actions (Integration)
- Test Remix loaders/actions with request/response shims:
  - Auth redirects, CSRF checks, validation errors, happy paths.
- Mock Supabase client and Stripe server calls.

5) Server Headers
- Supertest against `server.js`:
  - Assert CSP with nonce, cache headers, security headers on key routes.

6) End‑to‑End (Playwright)
- Expand `tests/e2e/`:
  - Public pages smoke.
  - Auth (login/logout), dashboard visibility.
  - Non‑destructive admin flow (create/edit entity with rollback).
- Prefer seeded data or mocked backends; add `scripts/seed-test.ts` and `npm run seed:test`.

7) CI & Quality Gates
- GitHub Actions: run `lint`, `typecheck`, `test:unit`, and a small `test:e2e` smoke job.
- Coverage ratchet: start 60% lines/branches; +5% monthly until stable.
- Require tests for bug fixes and new features.

## Deliverables Checklist
- Vitest config + `setupTests.ts` and helpers.
- Initial unit tests (utils/services) and route smoke tests.
- Supertest header checks for `server.js`.
- Playwright e2e smoke suite (reuses `playwright.config.ts`).
- CI workflow and coverage reporting.

---

## Seminars & Adult Registration Testing (New Feature)

### Priority Tests to Implement

#### Phase 1: Critical Unit Tests (Implement First)
**File**: `app/services/__tests__/self-registration.server.test.ts`

- [ ] **createSelfRegistrant()** - Core self-registration logic
  - Creates family with type='self'
  - Creates adult student with is_adult=true
  - Links profile_id to student
  - Returns existing if already registered
  - Validates required fields
  - Rolls back on failures

- [ ] **getSelfRegistrantByProfileId()** - Retrieval logic
  - Returns data for valid profile
  - Returns null for non-existent/non-self-registrants
  - Includes family data

**File**: `app/schemas/__tests__/seminar.test.ts`

- [ ] **Seminar Schema Validation**
  - createSeminarSchema validates required fields
  - Validates slug format (lowercase, hyphens only)
  - Validates age range (max >= min)
  - Rejects negative pricing
  - createSeminarSeriesSchema validates date ranges
  - selfRegistrantIntakeSchema validates email/phone/waiver

#### Phase 2: Integration Tests
**File**: `app/routes/__tests__/seminar-registration.test.tsx`

- [ ] **Adult Self-Registration Flow**
  - Loader redirects unauthenticated users to login
  - Action creates self-registrant family + student
  - Action creates enrollment and payment
  - Validates waiver acknowledgement required
  - Handles free vs paid seminars correctly

- [ ] **Family Student Registration Flow**
  - Allows family to register existing student
  - Prevents duplicate registrations
  - Links to correct family_id

**File**: `app/routes/__tests__/family-dashboard.test.tsx`

- [ ] **Dashboard Seminar Display**
  - Loader fetches seminar enrollments
  - Filters by engagement_type='seminar'
  - SeminarEnrollmentsCard displays when enrollments exist
  - Adaptive language for self-registrants vs families

#### Phase 3: E2E Tests
**File**: `tests/e2e/seminar-registration.spec.ts`

- [ ] **Complete Registration Flow (Adult)**
  - Browse seminars at /curriculum
  - View seminar detail page
  - Complete self-registration form
  - Acknowledge waiver
  - Verify enrollment on dashboard

- [ ] **Browse & Filter Seminars**
  - Tab navigation works (Programs/Seminars/Events)
  - Seminar cards display correctly
  - Series information shows
  - Registration CTAs visible for active series

### Manual Testing Checklist

#### Pre-Deployment
- [ ] Migration 025 applies successfully
- [ ] TypeScript types regenerated (no errors)
- [ ] Can create seminar via admin form
- [ ] Can filter programs vs seminars
- [ ] Adult can self-register for seminar
- [ ] Family can register student for seminar
- [ ] Seminar enrollments appear on dashboard
- [ ] Payment processing works for paid seminars
- [ ] Free seminars complete without payment

#### Regression Testing
- [ ] Regular programs still work
- [ ] Regular enrollments unaffected
- [ ] Event registration unaffected
- [ ] Family dashboard loads correctly
- [ ] Admin forms still functional

#### Edge Cases
- [ ] Cannot register without waiver acknowledgement
- [ ] Cannot duplicate registrations
- [ ] Handles payment failures gracefully
- [ ] Shows appropriate error messages
- [ ] Invalid slug format rejected

### Test Data Requirements

For testing seminars features, seed database with:
- At least 2 seminar templates (1 free, 1 paid)
- At least 2 series per seminar with sessions
- Test adult user account (for self-registration)
- Test family account with students
- Active waiver templates
- Payment provider sandbox credentials

### Coverage Goals for Seminars

- **Self-registration service**: 90%+ (critical business logic)
- **Program service seminar functions**: 80%+
- **Seminar schemas**: 100% (validation is critical)
- **Registration routes**: 70%+ (loaders/actions)
- **Dashboard integration**: 60%+

### Known Gaps (Low Priority)

- [ ] Performance tests for large series (50+ sessions)
- [ ] Load tests for concurrent registrations
- [ ] Event self-registration (when implemented)
- [ ] Series capacity enforcement tests
- [ ] Waiver expiration handling
- [ ] Payment webhook handling for seminars

### Test Implementation Priority

**Week 1:**
1. Self-registration service unit tests
2. Seminar schema validation tests

**Week 2:**
3. Seminar registration integration tests
4. Dashboard integration tests

**Week 3:**
5. E2E registration flow test
6. Regression testing suite

**Later:**
7. Performance & load tests
8. Additional edge case coverage
