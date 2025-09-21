# Repository Guidelines

## Project Structure & Module Organization
- `app/` — Remix app source: `routes/` (file‑based routing), `components/`, `services/`, `utils/`, `types/`, `entry.client.tsx`, `entry.server.tsx`, `root.tsx`.
- `public/` — Static assets served as‑is.
- `tests/e2e/` — Playwright end‑to‑end tests (e.g., `jsonld-nonce.spec.ts`).
- `scripts//` — Node scripts and utilities.
- `supabase/` — Edge functions and config (Deno; excluded from TS build).
- `server.js` — Express/Vite server entry.
- `docs/` — Architecture, development, deployment docs.

## Build, Test, and Development Commands
- `npm run dev` — Start Vite dev server (Remix app).
- `npm run dev:strict` — Dev with strict CSP (`CSP_STRICT_DEV=1`).
- `npm run build` — Client and SSR builds via Vite.
- `npm start` — Run production server (`NODE_ENV=production`).
- `npm run lint` — ESLint across repo (TS/React, a11y, imports).
- `npm run typecheck` — TypeScript project check.
- `npm run typecheck:deno` — Type check Supabase functions.
- `npx playwright test` — Run E2E tests (uses `playwright.config.ts`).

Node version: `>=22 <=24` (see `package.json` engines). Copy `.env.example` to `.env` for local config.

## Coding Style & Naming Conventions
- Language: TypeScript + React (Remix). Indentation 2 spaces.
- Path alias: import from `~/*` for `app/*` (see `tsconfig.json`).
- Server‑only code: prefer `*.server.ts(x)`; browser‑only `*.client.ts(x)`.
- Linting: ESLint with `@typescript-eslint`, `react`, `jsx-a11y`, `import`. Fix issues before PRs.
- UI styles: Tailwind; see `docs/Style Guide.md` for class patterns.

## Testing Guidelines
- E2E: Place specs under `tests/e2e/*.spec.ts`; run with `npx playwright test`.
- Unit tests: Vitest is available; prefer `*.test.ts(x)` colocated near code or under `__tests__/`.
- Aim for meaningful coverage of routes, loaders/actions, and critical services. Keep tests deterministic.

## Commit & Pull Request Guidelines
- Commits: Short imperative title, followed by concise context. Group logical changes; keep noise out of diffs.
- Changelog: Project follows Keep a Changelog and semver; update when user‑facing changes warrant.
- PRs must include: problem statement, summary of changes, testing notes (commands run), screenshots for UI, and any migration/config steps.
- Checks required before review: `npm run lint`, `npm run typecheck`, `npm run build`, and E2E on critical flows.

## Security & Configuration Tips
- Keep secrets in `.env` (never commit). Review CSP behavior; use `dev:strict` to validate nonces and inline‑script usage.
- Supabase functions are Deno‑based; validate with `npm run typecheck:deno` before pushing.
