# Repository Guidelines

## Project Structure & Module Organization
The Remix source lives in `app/`, split into `routes/` for file-based routing, `components/`, `services/`, `utils/`, and shared types. Assets in `public/` are served verbatim. Playwright end-to-end specs such as `jsonld-nonce.spec.ts` reside in `tests/e2e/`. automation and maintenance scripts belong in `scripts/`, while Supabase edge functions live under `supabase/`. Reference design, deployment, and architectural notes are in `docs/`.

## Build, Test, and Development Commands
- `npm run dev` — Launch the Vite-powered Remix dev server with HMR.
- `npm run dev:strict` — Start dev with CSP nonces enforced (`CSP_STRICT_DEV=1`).
- `npm run build` — Produce the SSR and client bundles; output feeds `npm start`.
- `npm start` — Run the production Express/Vite server from the built artifacts.
- `npm run lint` — Execute ESLint (TypeScript/React/a11y/import rules).
- `npm run typecheck` / `npm run typecheck:deno` — Validate TypeScript surface and Supabase edge functions.
- `npx playwright test` — Execute browser regression coverage defined in `playwright.config.ts`.

## Coding Style & Naming Conventions
Use TypeScript with 2-space indentation and functional React patterns. UI styling runs through Tailwind utility classes; consult `docs/Style Guide.md` for approved palettes. Import internals via the `~/*` alias instead of relative paths. Scope browser-only logic to `*.client.ts(x)` files and keep server-only code in `*.server.ts(x)`. Keep reusable UI in `app/components/` and favor descriptive file names like `profile-card.tsx`.

## Testing Guidelines
Author unit or integration tests with Vitest colocated as `*.test.ts(x)` next to the code under test. Browser flows must stay deterministic and run via Playwright specs in `tests/e2e/`. Ensure critical loaders/actions have coverage, mock network boundaries, and run `npx playwright test` before proposing UI regressions. Capture failing scenarios in `playwright-report/` for review.

## Commit & Pull Request Guidelines
Write commits in the imperative mood (e.g., `Add billing webhook handler`) and group related changes tightly. Keep the changelog up to date whenever user-facing behavior shifts. Pull requests must outline the problem, summarize the solution, list verification commands, and attach screenshots or videos for visual updates. Merge gating requires `npm run lint`, `npm run typecheck`, `npm run build`, and Playwright on critical journeys to pass.

## Security & Configuration Tips
Copy `.env.example` to `.env` and keep secrets out of version control. Audit CSP compatibility by running `npm run dev:strict` regularly. Supabase edge code deploys independently—lint with Deno type checking before shipping. Rotate credentials promptly and review any third-party embeds against CSP and dependency policies.
