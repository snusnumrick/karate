## Full Implementation Plan (Commit-Based) for `CODE_REVIEW_BACKLOG.md`

### Summary
Execute all BL-1 through BL-13 via sequential commits, starting by persisting this plan to a repo document, then implementing correctness, auth/error consistency, and maintainability items.

### Commit Plan
1. `Add backlog execution plan document`
2. Create [CODE_REVIEW_BACKLOG_EXECUTION_PLAN.md](/Users/antont/WebstormProjects/karate/CODE_REVIEW_BACKLOG_EXECUTION_PLAN.md) with this exact plan.
3. `Fix auto-discount Supabase client lifetime` (BL-1) in [auto-discount.server.ts](/Users/antont/WebstormProjects/karate/app/services/auto-discount.server.ts).
4. `Add shared server cache utility` (foundation for BL-2/BL-13).
5. `Migrate family waiver cache to shared cache with invalidation` (BL-2) in [_layout.family._index.tsx](/Users/antont/WebstormProjects/karate/app/routes/_layout.family._index.tsx), [admin.waivers.new.tsx](/Users/antont/WebstormProjects/karate/app/routes/admin.waivers.new.tsx), [admin.waivers.$waiverId.tsx](/Users/antont/WebstormProjects/karate/app/routes/admin.waivers.$waiverId.tsx), [waiver.server.ts](/Users/antont/WebstormProjects/karate/app/services/waiver.server.ts).
6. `Migrate admin db-chat schema cache to shared cache` (BL-13) in [admin.db-chat.tsx](/Users/antont/WebstormProjects/karate/app/routes/admin.db-chat.tsx).
7. `Standardize enrollment validation to typed throw contract` (BL-3) in [enrollment.server.ts](/Users/antont/WebstormProjects/karate/app/services/enrollment.server.ts).
8. `Add ServiceError base + route mapping helpers` (BL-7 foundation).
9. `Convert invoice/family/student service errors to ServiceError` (BL-7 part 1).
10. `Convert class/enrollment/discount service errors to ServiceError` (BL-7 part 2).
11. `Add auth wrappers for loader/action guards` (BL-4 foundation).
12. `Migrate admin routes + admin APIs to wrappers` (BL-4 admin phase).
13. `Migrate family routes to wrappers` (BL-4 family phase).
14. `Migrate instructor routes + protected user APIs to wrappers` (BL-4 instructor/API phase).
15. `Unify schedule summary pipeline` (BL-8) in [class.server.ts](/Users/antont/WebstormProjects/karate/app/services/class.server.ts), [_layout._index.tsx](/Users/antont/WebstormProjects/karate/app/routes/_layout._index.tsx), [_layout.classes.tsx](/Users/antont/WebstormProjects/karate/app/routes/_layout.classes.tsx).
16. `Extract class session mapper and shared select fragments` (BL-9, BL-10).
17. `Deduplicate payment_students eligibility query` (BL-11) in [supabase.server.ts](/Users/antont/WebstormProjects/karate/app/utils/supabase.server.ts).
18. `Complete money utility consolidation` (BL-12) in [database-money.ts](/Users/antont/WebstormProjects/karate/app/utils/database-money.ts), [db-money.ts](/Users/antont/WebstormProjects/karate/app/utils/db-money.ts), [money-rules.ts](/Users/antont/WebstormProjects/karate/app/utils/money-rules.ts).
19. `Enable global no-console warning and migrate high-impact logs` (BL-5) in [.eslintrc.cjs](/Users/antont/WebstormProjects/karate/.eslintrc.cjs) plus top server files.
20. `Narrow select(*) in high-traffic services` (BL-6 pass A).
21. `Eliminate remaining select(*) in services` (BL-6 pass B).
22. `Update backlog/changelog completion state` in [CODE_REVIEW_BACKLOG.md](/Users/antont/WebstormProjects/karate/CODE_REVIEW_BACKLOG.md) and [CHANGELOG.md](/Users/antont/WebstormProjects/karate/CHANGELOG.md).

### Public API / Interface / Type Changes
1. New `ServiceError` hierarchy for service-layer throws.
2. Enrollment typed error contract for invalid enrollments.
3. New auth wrapper APIs (`withAdminLoader`, `withFamilyLoader`, `withInstructorLoader`, and action variants).
4. Shared server cache utility with explicit invalidation APIs.
5. Canonical schedule summary builder contract shared across homepage/classes flows.

### Test Cases and Scenarios
1. Waiver cache invalidates immediately after admin waiver create/update.
2. DB-chat schema cache refresh path invalidates and reloads.
3. Enrollment invalid path throws typed error; waitlist logic remains correct.
4. Services no longer throw `Response`; routes still return same HTTP status semantics.
5. Auth wrappers preserve redirect/role behavior for admin/family/instructor/API routes.
6. Schedule summary output stays consistent between homepage and classes.
7. Eligibility behavior unchanged with reduced duplicate queries.
8. Money utility behavior unchanged across legacy cents/dollars handling.
9. `select('*')` removal introduces no loader/action regressions.

### Acceptance Gates
1. Per commit group: `npm run lint`, `npm run typecheck`, `npm run test:unit`.
2. Before completion: `npm run build`.
3. Final: targeted `npx playwright test` for family payment/waivers/enrollment and admin invoice/auth flows.

### Assumptions and Defaults
1. Family role is `user` (`profile_role` enum).
2. Existing redirect targets remain unless explicitly standardized by wrapper options.
3. Admin/instructor layout guards remain; wrappers standardize child-route auth checks.
4. BL-5 enforcement is warning globally, error in webhook/payment critical files.
5. BL-6 success criterion is zero `select('*')` in `app/services`.
