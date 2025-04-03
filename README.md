# Karate Class Website

## Project Overview

Develop a comprehensive and user-friendly karate class management website for 
Sensei Negin's classes (details managed in `app/config/site.ts`), 
incorporating efficient family-oriented registration, 
achievement tracking, attendance monitoring, payment integration, and waiver management.

## Features

### Core User Experience
- **Public Pages:**
    - Home Page: Introduction, class schedule, location (`app/config/site.ts`).
    - Instructor Profile (`/about`): Bio for Sensei Negin.
    - Contact Page (`/contact`).
- **Authentication:** Secure user registration, login, email confirmation, and password management.
- **Family Portal (`/family`):** Central dashboard for logged-in users.
    - View associated family details.
    - List registered students with links to individual pages.
    - Manage family/guardian information and change password (`/family/account`).
    - View student attendance history (`/family/attendance`).
    - Track required waiver signature status.
- **Student Management (Family View):**
    - View detailed student information (`/family/student/:studentId`).
    - Edit student details.
    - *Note: Student deletion might be restricted to Admins.*
- **Waiver Management:** Digitally sign required waivers (Liability, Code of Conduct, Photo/Video, Payment/Dress Code).
- **Payments:**
    - Secure payment processing (Stripe integration planned/configured).
    - View payment history (Placeholder).
    - Dynamic pricing tiers based on student payment history (1st Month, 2nd Month, Ongoing).
    - Student eligibility status ("Trial", "Active", "Expired") based on payment history (`app/utils/supabase.server.ts`).

### Administrative Panel (`/admin`)
- **Dashboard:** Overview statistics (Families, Students, Payments, Attendance, Waivers).
- **Family Management:**
    - View all families (`/admin/families`).
    - Register new families (`/admin/families/new`).
    - View/Edit family details, guardians, and associated students (`/admin/families/:familyId`).
    - Edit guardian details (`/admin/families/:familyId/guardians/edit`).
    - Add new students to a family (`/admin/families/:familyId/students/new`).
- **Student Management:**
    - View all students (`/admin/students`).
    - View/Edit individual student details (`/admin/students/:studentId`).
    - Manage student belt awards (promotions) (`/admin/student-belts/:studentId`).
    - Delete students (available on family detail page `/admin/families/:familyId`).
- **Attendance Tracking:**
    - Record daily attendance (`/admin/attendance/record`).
    - View attendance history with filtering (`/admin/attendance`).
    - View attendance reports with rates (`/admin/attendance/report`).
- **Waiver Management:**
    - View/Edit waiver documents (`/admin/waivers`, `/admin/waivers/:waiverId`).
    - Mark waivers as required, triggering notifications.
    - View report of families/students with missing required waivers (`/admin/waivers/missing`).
- **Payment Management:**
    - Record manual payments (`/admin/payments/new`).
    - View pending payments (e.g., from failed online transactions) (`/admin/payments/pending`).
    - *Note: Full payment history/reporting might be a future enhancement.*

### Automated Notifications
- **Student Absence:** Email to family when student marked absent.
- **Newly Required Waiver:** Email to families needing to sign a newly required waiver.
- **Payment Reminder (Scheduled):** Supabase Edge Function (`payment-reminder`) emails families with 'Expired' student eligibility.
- **Missing Waiver Reminder (Scheduled):** Supabase Edge Function (`missing-waiver-reminder`) emails families missing required signatures.

### Technical & SEO
- Built with Remix for SSR and performance.
- Uses Supabase for backend (database, auth, edge functions).
- UI components from Shadcn.
- Mobile-optimized responsive design.
- Production-ready security headers (CSP, HSTS).
- SEO enhancements: Meta tags, `robots.txt`, dynamic `sitemap.xml`, JSON-LD structured data, canonical URLs.

## Technology Stack

- **Frontend**: Remix framework for optimal user experience, server-side rendering, and modern web practices.
- **Backend**: Supabase for scalable database solutions, authentication, and real-time functionalities.
- **UI Library**: Shadcn for clean, modern, and consistent UI components ensuring high usability.
- **Payments**: Stripe or PayPal integration for robust payment processing.
- **Deployment**: Cloud-based deployment solutions (e.g., Vercel or Netlify).

## Setup Instructions

### Supabase Configuration

#### Local Development:
1. Create a Supabase project at https://supabase.com
2. Enable Email auth provider in Authentication settings
3. Create tables following the database schema from the code
4. Get credentials:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

#### Vercel Deployment:
1. Add environment variables in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` 
   - `SUPABASE_SERVICE_ROLE_KEY`

### Stripe Configuration

#### Local Development:
1. Create Stripe account at https://stripe.com
2. Get API keys:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
3. Set webhook secret in `.env`:
   - `STRIPE_WEBHOOK_SECRET`

#### Vercel Deployment:
1. Add Stripe environment variables:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
2. Configure webhook endpoint in Stripe Dashboard to point to your Vercel domain

### Resend Configuration

#### Local Development:
1. Create account at https://resend.com
2. Get API key:
   - `RESEND_API_KEY`
3. Set from email in `.env`:
   - `FROM_EMAIL` (format: "Name <email@domain.com>")

#### Vercel Deployment:
1. Add Resend environment variables:
   - `RESEND_API_KEY`
   - `FROM_EMAIL`
2. Verify sending domain in Resend dashboard

### General Setup

1. Clone repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in values
4. Generate Supabase types:
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public > supabase/functions/_shared/database.types.ts
   ```
5. Deploy Supabase functions:
   ```bash
   npx supabase functions deploy payment-reminder --no-verify-jwt
   npx supabase functions deploy missing-waiver-reminder --no-verify-jwt
## Current Status & Future Work

The application includes the core features listed above. All major planned functionalities are implemented.

Potential areas for future enhancement or review include:
- **Content Quality:** Ensure public-facing page content is informative, engaging, and naturally incorporates relevant keywords.
- **Image Alt Text:** Conduct a site-wide review to ensure all meaningful images have descriptive `alt` attributes for SEO and accessibility.
- **Performance (Core Web Vitals):** Analyze and optimize page load speed and responsiveness using tools like Google PageSpeed Insights.
- **Accessibility (A11y):** Perform comprehensive accessibility checks (keyboard navigation, color contrast, ARIA attributes).
- **Payment Reporting:** Enhance admin reporting for payments.
- **Error Monitoring:** Implement more robust error logging/monitoring.
