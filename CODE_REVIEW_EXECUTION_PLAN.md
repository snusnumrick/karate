# Execution Plan: CODE_REVIEW.md Remediation (Decision-Complete)

## Summary
This plan executes the review in four releases with strict gates: `security first`, then `correctness`, then `reliability`, then `performance/maintainability`.
Baseline on **2026-02-27** is green (`lint`, `typecheck`, `build`, targeted webhook unit tests), so we can implement incrementally with zero pre-existing gate failures.

## Execution Progress
Last updated: **2026-02-27**

| Task ID | Status | Notes |
|---|---|---|
| R1-T1 | ✅ Completed | Removed 6 unauthenticated test/debug files. Commit: `1c81d54` |
| R1-T2 | ✅ Completed | Added production-only route guard (`404`) in loader/action for `admin.test-email.tsx`. Commit: `cc2607d` |
| R1-T3 | ✅ Completed | Role checks now query `profiles.role`; auth errors normalized to `401`; API routes updated to `await requireApiRole`. Commit: `ad80f4a` |
| R1-T4 | ✅ Completed | Added provider-level `eventId` to parsed webhook contract and provider parsers. Commit: `0fa03b4` |
| R1-T5 | ✅ Completed | Webhook handler now uses insert-first idempotency keyed by provider `eventId` (no select-then-insert race gate). Commit: `0fa03b4` |
| R1-T6 | ✅ Completed | Route logging now prioritizes `x-square-hmacsha256-signature` and records header source. Commit: `0fa03b4` |
| R2-T1 | ✅ Completed | Square `confirmPaymentIntent` now throws on hard failures instead of returning synthetic failed intents. Commit: `8f98d71` |
| R2-T2 | ✅ Completed | `getInvoiceByNumber` no longer performs double fetch; overdue pagination/count now filtered in DB query. Commit: `8f98d71` |
| R2-T3 | ✅ Completed | Removed registration-payment linking race by updating just-created registration IDs (no `setTimeout` workaround). Commit: `8f98d71` |
| R2-T4 | ✅ Completed | Added atomic RPC `record_individual_session_usage` and updated service to use it. Commit: `8f98d71` |
| R2-T5 | ✅ Completed | `useBackgroundRefresh` now uses callback ref to prevent re-render polling loops. Commit: `8f98d71` |
| R3-T1 | ✅ Completed | Added `ErrorBoundary` exports to six high-risk routes to prevent full-page crashes on unhandled route errors. Commit: `909a38e` |
| R3-T2 | ✅ Completed | Added graceful CSRF failure handling (`403` + session-expired message) and user-facing recovery actions in payment setup UI. |
| R3-T3 | ✅ Completed | Added `SIGNED_OUT` auth-state redirects to `/login` for protected/admin route contexts. Commit: `098f583` |
| R3-T4 | ✅ Completed | Added idempotent push message listener setup/cleanup, restricted-context notification guards, and realtime reconnect scheduling for family/admin message channels. Commit: `10a4890` |
| R3-T5 | ✅ Completed | Added defensive root `action` that throws `405 Method Not Allowed` with `Allow: GET`. Commit: `3c8d64f` |
| R4-T1 | ✅ Completed | Cached admin Supabase client in `getSupabaseAdminClient()` with config-aware singleton reuse to avoid repeated client creation overhead. |
| R4-T2 | ⏸ Not Started | Parallelize and batch high-cost loader/service paths (enrollment, payment eligibility, discounts, admin payments). |
| R4-T3 | ⏸ Not Started | DRY refactors (shared mappers, webhook handler extraction, consistent service error model). |
| R4-T4 | ⏸ Not Started | Hygiene backlog (dead code/log cleanup, naming consistency, `updatePaymentStatus` parameter object refactor). |

## Schedule
| Release | Window | Goal | Exit Gate |
|---|---:|---|---|
| R0 | Day 0 | Baseline + task board + migration prep | `lint` + `typecheck` + `build` pass; task IDs created |
| R1 | Days 1-2 | Close P0 security + webhook idempotency correctness | All R1 tests pass; no unauth test/debug routes in prod |
| R2 | Days 3-7 | Close P1 critical bugs | All R2 tests pass; no `setTimeout` race paths |
| R3 | Week 2 | Close top Sentry reliability issues (SE-1..SE-11) | Sentry error rate down on targeted issues for 72h |
| R4 | Weeks 3-4 | Performance + DRY + hygiene backlog from review phases 3-5 | Query reductions verified; regression suite green |

## Public API / Interface Changes
| Change | New Contract | Files |
|---|---|---|
| API role guard becomes async and DB-backed | `requireApiRole(user, requiredRole): Promise<void>` querying `profiles.role`; `401` for unauthenticated, `403` for unauthorized | `app/utils/api-auth.server.ts` and API route call sites |
| Webhook parse model includes provider event id | `ParsedWebhookEvent` gains required `eventId: string` (separate from payment intent id) | `app/services/payments/types.server.ts`, Stripe/Square providers, webhook handler |
| Atomic DB API added for session usage | New RPC: `record_individual_session_usage(...)` | `supabase/migrations/039_add_atomic_session_usage_rpc.sql`, `app/services/student.server.ts` |
| Root POST behavior normalized | `action` on root returns `405 Method Not Allowed` | `app/root.tsx` |

## Detailed Execution

### R0 — Baseline and Tracking
1. Create execution tracker with IDs mapped 1:1 to review items (`S*`, `B*`, `P*`, `D*`, `H*`, `SE-*`).
2. Freeze gates and commands for every PR:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
   - `npx vitest run`
3. Prepare migration numbers for new RPC functions in `supabase/migrations` (next sequential IDs).

### R1 — Security + Webhook Integrity (P0 + dedupe correctness)
1. Remove unauthenticated test/debug routes and dead debug utility:
   - `app/routes/test.events.tsx`
   - `app/routes/test.sentry.tsx`
   - `app/routes/api.test.push-notification.ts`
   - `app/routes/_layout.debug-notifications.tsx`
   - `app/routes/_layout.notification-test.tsx`
   - `app/utils/notification-debug.client.ts`
2. Keep but hard-guard admin test email route in production:
   - `app/routes/admin.test-email.tsx`
3. Fix API role authorization source (`profiles.role`, not `user_metadata.roles`) and update all callers to `await`:
   - `app/utils/api-auth.server.ts`
   - `app/routes/api.admin.discount-codes.tsx`
   - `app/routes/api/v1/students.$studentId.ts`
   - `app/routes/api/v1/families.$familyId.ts`
4. Webhook event identity fix:
   - Add `eventId` to parsed webhook contract.
   - Parse Stripe `event.id` and Square `event.event_id`.
   - Use `eventId` (not payment intent id) for idempotency and audit records.
   - Files: `app/services/payments/types.server.ts`, `app/services/payments/stripe.server.ts`, `app/services/payments/square.server.ts`, `app/services/payments/webhook.server.ts`, `app/services/payments/webhook-events.server.ts`
5. Make idempotency atomic in handler flow:
   - Remove select-then-insert processing gate.
   - Insert first; treat `23505` as duplicate acknowledge.
6. Normalize Square webhook header usage in route logging/diagnostics:
   - `app/routes/api.webhooks.square.ts`

### R2 — Critical Bug Fixes (P1)
1. Square failure propagation:
   - Make provider throw on hard payment confirmation failures.
   - Keep explicit decline states as non-throw handled results.
   - Files: `app/services/payments/square.server.ts`, `app/routes/_layout.pay.$paymentId.tsx`
2. Invoice query correctness:
   - `getInvoiceByNumber` first query selects only `id`.
   - Overdue filtering/pagination moved fully into DB query with correct count.
   - File: `app/services/invoice.server.ts`
3. Event registration race removal:
   - Add RPC migration `create_event_registrations_with_payment(...)`.
   - Replace insert + `setTimeout(100)` + update sequence with single atomic RPC call.
   - File: `app/routes/_layout.events.$eventId_.register.tsx`
4. Session usage rollback race removal:
   - Add RPC migration `record_individual_session_usage(...)`.
   - Replace decrement + insert + manual rollback with single DB transaction function.
   - File: `app/services/student.server.ts`
5. Hook rerender loop fix:
   - `useBackgroundRefresh` stores callback in ref and removes unstable callback dependency.
   - File: `app/hooks/useBackgroundRefresh.ts`

### R3 — Reliability + Sentry Remediation
1. Add `ErrorBoundary` to six high-risk routes:
   - `app/routes/_layout.family._index.tsx`
   - `app/routes/instructor.attendance.tsx`
   - `app/routes/admin.db-chat.tsx`
   - `app/routes/admin.messages.$conversationId.tsx`
   - `app/routes/_layout.events.$eventId_.register.tsx`
   - `app/routes/_layout.family.store.purchase.$studentId.tsx`
2. CSRF resilience and UX on family payment flow:
   - Keep hidden token path, add user-facing handling for CSRF failures.
   - Files: `app/routes/_layout.family.payment.tsx`, `app/components/PaymentSetupForm.tsx`
3. Auth-expiry redirect behavior:
   - In auth listeners, redirect to `/login` on `SIGNED_OUT`/invalid session transitions.
   - Files: `app/routes/_layout.tsx`, `app/routes/admin.tsx`
4. Push/realtime hardening:
   - Remove diagnostic `postMessage` traffic in production paths.
   - Add listener dedupe/cleanup and capability guards.
   - Add realtime reconnect handling for closed channels.
   - Files: `app/utils/push-notifications.client.ts`, `app/utils/notifications.client.ts`, message routes
5. Add root 405 action:
   - `app/root.tsx`

### R4 — Performance / DRY / Hygiene (Review Phases 3-5)
1. Performance first:
   - Cache admin Supabase client once in `app/utils/supabase.server.ts`
   - Parallelize/batch high-cost paths in enrollment, payment eligibility, discount, admin payments loader.
2. DRY refactors second:
   - Consolidate repeated mappers and shared webhook handler extraction.
   - Standardize Supabase client injection and service error patterns.
3. Hygiene last:
   - Remove dead test utilities, reduce console noise, static-import cleanup, naming consistency, parameter object refactor for `updatePaymentStatus`.

## Test Cases and Scenarios

### Unit/Service
1. Webhook idempotency uses provider event id, not payment id.
2. Duplicate webhook concurrent insert returns duplicate ack without double processing.
3. API role check returns `403` for wrong role and `401` for unauthenticated.
4. `getInvoices` overdue pagination returns correct rows and `total` across pages.
5. `useBackgroundRefresh` does not re-trigger endlessly with inline callback props.

### Integration
1. Removed test/debug routes are inaccessible in production mode.
2. Event registration paid flow has no sleep and no orphan payment/registration split.
3. Session usage decrement+log is atomic under forced insert failure.
4. Root `POST /` returns `405`.

### E2E
1. Family payment flow submits with CSRF token and surfaces friendly retry UI on token failure.
2. Event registration with payment creates valid pending payment and linked registrations.
3. Admin/family messaging survives realtime reconnect scenarios.

### Mandatory Gate Per Release
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npx vitest run`
- `npx playwright test` for touched critical journeys

## Rollout Order
1. Deploy DB migrations (RPCs) first.
2. Deploy app changes referencing new RPCs.
3. Run smoke tests in production-like env.
4. Monitor targeted Sentry issue IDs for 72 hours.
5. Only then continue to next release.

## Assumptions and Defaults
1. This plan assumes one primary engineer + one reviewer; if staffing increases, keep release order unchanged and parallelize only within a release.
2. `admin.test-email` is retained for non-production only; other unauthenticated test routes are deleted.
3. Existing `UNIQUE (provider, event_id)` on `webhook_events` is preserved and used as the atomic dedupe gate.
4. RPCs are the default mechanism for cross-table atomicity in race-prone payment/registration/session paths.
5. Large-scale logging overhaul is deferred to R4 to avoid blocking security/correctness delivery.
