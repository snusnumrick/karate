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
