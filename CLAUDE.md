# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server
- `npm run dev:strict` - Start development server with strict CSP mode
- `npm run build` - Build production bundle (client + SSR)
- `npm run start` - Start production server
- `npm run lint` - Run ESLint with caching
- `npm run typecheck` - Run TypeScript type checking
- `npm run typecheck:deno` - Type check Supabase Edge Functions
- `npm run validate:square` - Validate Square Web Payments SDK configuration for deployment

## Architecture Overview

### Framework Stack
- **Framework**: Remix (full-stack React framework)
- **Database**: Supabase (PostgreSQL with real-time features)
- **Payment Processing**: Stripe + Square Web SDK integration
- **Styling**: Tailwind CSS + Shadcn/UI components
- **Type Safety**: TypeScript with strict configuration
- **Email**: Resend with custom templates
- **AI Integration**: Google Gemini API for database chat

### Monetary System
**Critical**: All monetary values are stored as **INT4 cents** (not decimals) for precision. Use the `money.ts` utilities for all monetary calculations. The system uses dinero.js for type-safe money operations.

### Key Directories
- `app/services/` - Server-side business logic and database operations
- `app/utils/` - Shared utilities (client/server indicated by `.client.ts`/`.server.ts`)
- `app/components/` - React components (using Shadcn/UI patterns)
- `app/routes/` - Remix file-based routing with nested layouts
- `app/types/` - TypeScript type definitions (auto-generated database types)
- `supabase/migrations/` - Database schema migrations

### Security Architecture
- **CSRF Protection**: All forms require CSRF tokens via `remix-utils/csrf`
- **CSP Nonces**: All inline scripts use nonces for Content Security Policy
- **Row Level Security**: Database access controlled via Supabase RLS policies
- **Authentication**: Supabase Auth with JWT tokens and refresh handling

### Data Layer Patterns
- **Services**: Business logic in `app/services/*.server.ts` files
- **Database Types**: Auto-generated from Supabase in `app/types/database.types.ts`
- **Validation**: Zod schemas in `app/schemas/` for form validation
- **Real-time**: Supabase subscriptions for live updates

### Route Structure
- `_layout.*` - Routes with shared navigation layout
- `admin.*` - Admin-only routes with role-based access
- `api.*` - API endpoints for webhooks and external integrations
- File-based routing follows Remix conventions with nested layouts

### Event Registration Flow
Event registration with required waivers follows a three-step process:
1. **Student Selection** (`_layout.events.$eventId.register_.students.tsx`)
   - Family selects which students to register
   - Validates students belong to family
   - Passes studentIds via URL query parameter
2. **Waiver Signing** (`_layout.events.$eventId.register_.waivers.tsx`)
   - Displays required waivers for the event
   - Links to signing page with studentIds parameter
   - Validates all students are covered before proceeding
3. **Registration** (`_layout.events.$eventId_.register.tsx`)
   - Validates waiver coverage for all selected students
   - Completes registration with payment (if applicable)
   - Redirects to confirmation page

### Component Patterns
- Components use Shadcn/UI patterns with `cn()` utility for class merging
- Form components integrate with `react-hook-form` and Zod validation
- Server components for data fetching, client components for interactivity
- PDF generation using `@react-pdf/renderer` for invoices and receipts

### Configuration
- Site configuration centralized in `app/config/site.ts`
- Environment variables prefixed with `VITE_` for client-side access
- Feature flags available in site config for toggling functionality

### Payment Provider Configuration

#### Square Web Payments SDK
**Required Environment Variables:**
- `SQUARE_APPLICATION_ID` - Square application ID (sandbox: `sandbox-*`, production: `sq0idp-*`)
- `SQUARE_ACCESS_TOKEN` - Square access token (sandbox: `EAAAE*`, production: `EAAAE*`)
- `SQUARE_LOCATION_ID` - Square location ID 
- `SQUARE_ENVIRONMENT` - Environment setting (`sandbox` or `production`)

**Currency Configuration:**
Currency is automatically configured from `app/config/site.ts` → `localization.currency` (currently set to `CAD`). Ensure your Square merchant account supports the configured currency.

**Production Deployment Requirements:**
- ✅ **HTTPS Required**: Square Web SDK only works in secure contexts
- ✅ **CSP Configuration**: Domains automatically added via provider abstraction in `entry.server.tsx`
- ✅ **Browser Support**: No IE11, Chrome extensions not supported
- ✅ **Token Security**: Payment tokens expire after 24 hours, single-use only

**Production Checklist:**
1. Verify all environment variables are set in production
2. Ensure HTTPS is enabled
3. Test payment flow with real test cards in sandbox
4. Validate CSP headers include Square domains
5. Monitor payment success/failure rates
6. Set up webhook handling for payment confirmations (if needed)

**Common Issues:**
- Payment tokens must be processed server-side immediately
- Strong Customer Authentication (SCA) required for EU transactions
- Comprehensive billing information improves authentication success

#### Stripe Integration
**Required Environment Variables:**
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook endpoint secret

### Waiver System
**Database Requirements:**
- Supabase Storage bucket named `waivers` (created via dashboard, not migration)
- RLS policies for waiver PDF access control
- Migrations 029 and 030 applied (student_ids, pdf_storage_path columns)

**Features:**
- PDF generation with @react-pdf/renderer
- Automatic email delivery of signed waivers via Resend
- Student coverage tracking for legal compliance
- Event registration flow: Student Selection → Waiver → Registration
- Admin signature tracking with student coverage details

**Storage Setup:**
1. Create `waivers` bucket in Supabase Dashboard (Storage section)
2. Set bucket to private (public: false)
3. Apply RLS policies from migration 030
4. Verify access by testing waiver signing

### Testing Notes
- Playwright tests available for E2E testing
- Vitest configured for unit testing
- Test database connection script available as `test-db-connection.js`