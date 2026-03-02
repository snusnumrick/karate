# Code Review Backlog

> Created: 2026-02-28
> Source: `CODE_REVIEW.md` findings not included in `CODE_REVIEW_EXECUTION_PLAN.md` (R1–R4)
> Status at creation: Refactor branch is 98% complete (55/56 plan items done)

This document captures the work that was identified in the code review but explicitly deferred from the refactor, was intentionally scoped down, or was never added to the execution plan. Items are ordered by risk.

---

## Priority 1 — Correctness Risk

These items have a real (if low-probability) failure mode in production.

### BL-1 Module-level Supabase singleton in `auto-discount.server.ts`

**Review ref:** §5.1
**File:** `app/services/auto-discount.server.ts` lines 9–16
**Risk:** The module-level client caches auth tokens. If those tokens expire mid-session, subsequent requests from this service silently fail with auth errors — with no retry or error surface.

Every other admin service creates fresh clients per-call or accepts them as parameters. This is the only exception. Now that `getSupabaseAdminClient()` is a proper singleton (P1 / `c049549`), the per-call pattern is cheap. The anomalous module-level pattern here should be removed.

**Effort:** 30 min

---

### BL-2 Module-level waiver cache has no invalidation path

**Review ref:** §5.2
**File:** `app/routes/_layout.family._index.tsx` line 64
**Risk:** `requiredWaiversCache` is module-level mutable state that persists across all requests in the same server process. It has a TTL but no invalidation — so if an admin updates a waiver, family users see stale data for up to the TTL window. No size bound either.

**Effort:** 2h (move to dedicated cache module with explicit invalidation, or pull from Supabase with short TTL on the query)

---

### BL-3 `validateEnrollment` returns, `enrollStudent` throws — same file

**Review ref:** §8.4
**File:** `app/services/enrollment.server.ts`
**Risk:** Within the same service file, `validateEnrollment` returns `{ is_valid, errors, warnings }` while `enrollStudent` throws. Callers need to know which pattern each function uses, and any future caller who assumes consistency will get it wrong.

**Fix:** Pick one pattern for the whole file. Recommended: both throw, validation errors become typed `EnrollmentError` instances with an `errors` array.

**Effort:** 1h

---

## Priority 2 — Maintainability Debt

These won't cause incidents but will slow down future development.

### BL-4 Auth middleware / `withLoader` wrapper (D11 — deferred)

**Review ref:** §10 D11, §12
**Files:** All 50+ route files (including new `_layout.events._index.tsx` added 2026-03-02)
**Why deferred:** High blast radius — touching every route at once is risky mid-refactor.

Every route currently duplicates its own `requireUser()` / `requireAdmin()` call. If auth logic changes (2FA, session rotation, rate limiting), it must be updated in 50+ places.

**Recommended approach:** Implement incrementally — start with admin routes only, then family routes, then instructor routes. Do not attempt a single-PR sweep.

**Effort:** 4–6h in stages

---

### BL-5 Structured logger — full codebase rollout (H3 — scoped down)

**Review ref:** §6.7
**Files:** All — 2,031+ `console.*` calls remain outside webhook/payment paths

The structured logger (`app/utils/logger.ts`) was introduced in `aff1543` and the ESLint `no-console` guard was added for webhook/payment files. The rest of the codebase still uses raw `console.log`.

**Recommended approach:** Enable the ESLint rule globally with a warning (not error) initially. Fix violations file-by-file, starting with services then routes.

**Effort:** 4–8h (can be spread across multiple PRs)

---

### BL-6 `select('*')` — 86 over-fetching queries

**Review ref:** §4 (general finding)
**Files:** Throughout `app/services/`
**Impact:** Every `select('*')` fetches all columns from the database, including columns no route uses. This inflates query response payloads, wastes bandwidth, and makes TypeScript types broader than necessary (every field is potentially present even when unused).

**Recommended approach:** Address service-by-service, starting with the most-queried tables (`families`, `students`, `enrollments`).

**Effort:** 6–10h total (can be spread across sprints)

---

### BL-7 Service error pattern not globally standardized

**Review ref:** §6.1
**Files:** `class.server.ts`, `enrollment.server.ts`, `discount.server.ts`, `invoice.server.ts`, `family.server.ts`, `student.server.ts`
**Status:** Webhook paths now use the app error envelope (`D10` / `9a2a0fb`). Service layer broadly still mixes `throw new Error()` (26+ in class.server.ts alone) and `throw new Response()` (20+ in invoice.server.ts).

Route loaders cannot reliably catch service errors without knowing which pattern each service uses.

**Fix:** Standardize on `throw new Error()` (or a typed `ServiceError`) in all services. Routes convert to HTTP responses. The error envelope from `9a2a0fb` can serve as the model.

**Effort:** 4h

---

### BL-8 Dual schedule summary implementations

**Review ref:** §8.3
**File:** `app/services/class.server.ts`
**Risk:** `getMainPageScheduleData` calls an RPC, and `buildScheduleSummaryFromClasses` is a complete JavaScript reimplementation of the same logic as a fallback. Two implementations of the same algorithm diverge over time.

**Fix:** If the RPC is reliable, remove the JS fallback. If the fallback is genuinely needed, add a comment explaining why and add tests for both paths.

**Effort:** 1h (decision + removal or documentation)

---

## Priority 3 — Small DRY Cleanups

These are low-effort, zero-risk cleanups that can be done opportunistically when touching the relevant files.

### BL-9 Session status casting repeated 4 times in `class.server.ts`

**Review ref:** §3.6
**File:** `app/services/class.server.ts` lines 514–518, 553–558, 728–733, 816–822

```typescript
status: data.status as 'scheduled' | 'completed' | 'cancelled',
notes: data.notes ?? undefined,
instructor_id: data.instructor_id ?? undefined,
```

**Fix:** Extract a `mapSessionStatus(data)` mapper. One line to add, four call sites to update.

**Effort:** 15 min

---

### BL-10 Class session nested select query duplicated

**Review ref:** §3.7
**File:** `app/services/class.server.ts` lines 686–716 and 746–778

The same large nested select string appears identically in two functions.

**Fix:**
```typescript
const CLASS_SESSION_SELECT = `id, name, ..., class:classes(id, name, ..., program:programs(...))`;
```

**Effort:** 15 min

---

### BL-11 `payment_students` query duplicated 3 times in `supabase.server.ts`

**Review ref:** §3.8
**File:** `app/utils/supabase.server.ts`

`checkStudentEligibility` queries `payment_students` separately in both the eligible and expired branches, fetching the same data twice in some paths.

**Effort:** 30 min

---

### BL-12 Money utility files — partial consolidation remaining

**Review ref:** §8.1
**Status:** `centsFromRow`/`moneyFromRow` duplication was resolved in D8 (`9b1ba7f`). The broader 4-file structure was not merged.

| File | Lines | Could merge into |
|------|-------|-----------------|
| `utils/db-money.ts` | 33 | `utils/database-money.ts` |
| `utils/money-rules.ts` | 27 | `utils/database-money.ts` |

`utils/money.ts` (401 lines, core dinero wrapper) stays as-is.

**Effort:** 30 min

---

### BL-13 Module-level schema cache in `admin.db-chat.tsx`

**Review ref:** §5.3
**File:** `app/routes/admin.db-chat.tsx` lines 34–35
**Risk:** Low — admin-only route, 1h TTL, schema rarely changes. But in multi-worker deployments each worker holds its own copy.

**Effort:** 1h (extract to shared cache module or accept as-is with a comment)

---

## Summary

| ID | Item | Risk | Effort | Priority |
|----|------|------|--------|----------|
| BL-1 | Auto-discount Supabase singleton | Auth token expiry silently breaks discounts | 30 min | P1 |
| BL-2 | Waiver cache — no invalidation | Stale waivers shown after admin updates | 2h | P1 |
| BL-3 | validateEnrollment vs enrollStudent error pattern | Caller confusion, future bug surface | 1h | P1 |
| BL-4 | Auth middleware / `withLoader` (D11) | Auth changes require 50+ file edits | 4–6h | P2 |
| BL-5 | Structured logger full rollout (H3) | Production logs are unstructured noise | 4–8h | P2 |
| BL-6 | `select('*')` column narrowing | Over-fetching, broad types | 6–10h | P2 |
| BL-7 | Service error pattern standardization | Inconsistent error handling across services | 4h | P2 |
| BL-8 | Dual schedule summary implementations | Algorithm divergence risk | 1h | P2 |
| BL-9 | Session status cast duplication | DRY | 15 min | P3 |
| BL-10 | Class session select query duplication | DRY | 15 min | P3 |
| BL-11 | `payment_students` query duplication | DRY | 30 min | P3 |
| BL-12 | Money utility file consolidation | Minor DRY | 30 min | P3 |
| BL-13 | Schema cache in db-chat | Low-risk per-worker duplication | 1h | P3 |

**Total estimated effort:** ~26–36h spread across future sprints
