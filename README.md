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
    - View remaining Individual Session balance.
    - Manage family/guardian information and change password (`/family/account`).
    - View student attendance history (`/family/attendance`).
    - Track required waiver signature status.
- **Student Management (Family View):**
    - View detailed student information (`/family/student/:studentId`).
    - Edit student details.
    - *Note: Student deletion might be restricted to Admins.*
- **Waiver Management:** Digitally sign required waivers (Liability, Code of Conduct, Photo/Video, Payment/Dress Code).
- **Payments:**
    - Secure payment processing via Stripe.
    - Multiple payment options: Monthly Group, Yearly Group, Individual Sessions (purchased in quantities).
    - View payment history, including payment type (`/family/payment-history`).
    - Dynamic pricing tiers based on student payment history (1st Month, 2nd Month, Ongoing Monthly).
    - Student eligibility status ("Trial", "Paid - Monthly", "Paid - Yearly", "Expired") based on payment history (`app/utils/supabase.server.ts`).

### Administrative Panel (`/admin`)
- **Dashboard:** Overview statistics (Families, Students, Payments, Attendance, Waivers).
- **Family Management:**
    - View all families (`/admin/families`).
    - Register new families (`/admin/families/new`).
    - View/Edit family details, guardians, associated students, and Individual Session balance (`/admin/families/:familyId`).
    - Edit guardian details (`/admin/families/:familyId/guardians/edit`).
    - Add new students to a family (`/admin/families/:familyId/students/new`).
- **Student Management:**
    - View all students (`/admin/students`).
    - View/Edit individual student details (`/admin/students/:studentId`).
    - View family's Individual Session balance and record usage of a session for the student (`/admin/students/:studentId`).
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
    - Record manual payments, specifying type (Monthly, Yearly, Individual Session, Other) and quantity for Individual Sessions (`/admin/payments/new`).
    - View payment history including payment type (`/admin/payments`).
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

## Customization Guide

- **Site Configuration:** Basic site details (name, instructor info, class schedule, location, pricing tiers) are managed in `app/config/site.ts`.
- **Styling:** Uses Tailwind CSS and Shadcn UI components. Customize Tailwind configuration in `tailwind.config.ts` and component styles within `app/components/ui/`.
- **Pricing Logic:** Payment tier calculation logic is within the payment route (`/family/payment` - *route needs confirmation*). Pricing values are in `app/config/site.ts`. Eligibility logic (handling monthly/yearly)
  is in `app/utils/supabase.server.ts`.
- **Email Templates:** Email content is generally defined within the server-side code that sends the email (e.g., routes, Supabase functions). Check `app/utils/email.server.ts` and `supabase/functions/`.

## Local Development Setup

1.  **Clone Repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Environment Variables:**
    - Copy `.env.example` to `.env`.
    - Fill in the required values for Supabase, Stripe (optional for local testing, required for payments), and Resend (for email sending).
4.  **Supabase Setup:**
    - Create a Supabase project at [supabase.com](https://supabase.com).
    - In your Supabase project dashboard:
        - Navigate to Authentication -> Providers and enable the "Email" provider. Disable "Confirm email" if you want easier local testing, but **ensure it's enabled for production**.
        - Navigate to the SQL Editor and run the SQL commands necessary to create the database schema (refer to `app/types/supabase.ts` or existing migrations if available).
    - Obtain your Supabase Project URL, Anon Key, and Service Role Key and add them to your `.env` file.
5.  **Stripe Setup (Optional for Local):**
    - Create a Stripe account at [stripe.com](https://stripe.com).
    - Obtain your Publishable Key and Secret Key and add them to `.env`.
    - For webhook testing locally, you might need the Stripe CLI. Set a webhook secret in `.env`.
6.  **Resend Setup (Optional for Local):**
    - Create a Resend account at [resend.com](https://resend.com).
    - Obtain an API Key and add it to `.env`.
    - Set the `FROM_EMAIL` in `.env` (e.g., `"Your Name <you@yourdomain.com>"`). You may need to verify your domain with Resend.
7.  **Generate Supabase Types:**
    ```bash
    npx supabase login # If not already logged in
    npx supabase link --project-ref YOUR_PROJECT_ID
    npx supabase gen types typescript --linked --schema public > supabase/functions/_shared/database.types.ts
    # Also recommended to copy to app/types for frontend use:
    cp supabase/functions/_shared/database.types.ts app/types/database.types.ts
    ```
    *(Replace `YOUR_PROJECT_ID` with your actual Supabase project ID)*
8.  **Run Development Server:**
    ```bash
    npm run dev
    ```

## Deployment Guide (Vercel Example)

1.  **Push to Git:** Ensure your code is pushed to a Git repository (GitHub, GitLab, Bitbucket).
2.  **Import Project:** In Vercel, import the project from your Git repository.
3.  **Configure Build Settings:** Vercel should automatically detect Remix. Default settings are usually sufficient.
4.  **Environment Variables:** Add the following environment variables in the Vercel project settings:
    - `SUPABASE_URL`
    - `SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `STRIPE_SECRET_KEY`
    - `STRIPE_PUBLISHABLE_KEY`
    - `STRIPE_WEBHOOK_SECRET`
    - `RESEND_API_KEY`
    - `FROM_EMAIL`
    - `VITE_SITE_URL` (Your production website URL, e.g., `https://www.yourdomain.com`)
5.  **Deploy:** Trigger a deployment in Vercel.
6.  **Stripe Webhook:**
    - Once deployed, get your production URL.
    - In your Stripe Dashboard, go to Developers -> Webhooks.
    - Add an endpoint:
        - URL: `https://<your-vercel-domain>/api/stripe/webhook` (*Confirm this is the correct webhook route*)
        - Select the events your application listens for (e.g., `checkout.session.completed`, `payment_intent.succeeded`, etc.).
        - Use the `STRIPE_WEBHOOK_SECRET` from your environment variables.
7.  **Supabase Production Setup:**
    - Ensure "Confirm email" is **enabled** in Supabase Auth settings for production.
    - Set up database backups in Supabase.
8.  **Resend Domain Verification:** Ensure your sending domain is verified in Resend for reliable email delivery.
9.  **Supabase Edge Functions:** Deploy the functions to your *linked* Supabase project:
    ```bash
    # Ensure you are linked to the correct Supabase project
    npx supabase functions deploy payment-reminder --no-verify-jwt
    npx supabase functions deploy missing-waiver-reminder --no-verify-jwt
    ```
    - **Schedule Functions:** In the Supabase Dashboard (Database -> Edge Functions), set up Cron Jobs to trigger `payment-reminder` and `missing-waiver-reminder` periodically (e.g., daily).

## Developer Information

- **Project Structure:**
    - `app/routes/`: Contains all Remix route modules (UI and server logic).
    - `app/components/`: Shared React components (UI elements, layout parts).
    - `app/utils/`: Utility functions (database interactions, email sending, helpers).
    - `app/config/`: Site-wide configuration.
    - `app/types/`: TypeScript type definitions (including `database.types.ts`).
    - `supabase/functions/`: Serverless edge functions (e.g., for scheduled tasks).
        - `supabase/functions/_shared/`: Code shared between edge functions (like database types, email client).
- **UI:** Built with [Shadcn UI](https://ui.shadcn.com/) on top of Tailwind CSS. Use `npx shadcn-ui@latest add <component>` to add new components consistently.
- **Database:** Supabase PostgreSQL. Schema definitions can be inferred from `app/types/database.types.ts` or Supabase Studio.
- **Types:** Database types are generated using the Supabase CLI (see Setup). Ensure `supabase/functions/_shared/database.types.ts` and `app/types/database.types.ts` are kept in sync.
- **Environment Variables:** Managed via `.env` locally and platform environment variables in production (see Deployment). Use `.env.example` as a template.
- **Email:** Uses Resend for transactional emails. See `app/utils/email.server.ts` and function-specific email logic.

### Technical Health
```json
{
  "Security": {
    "CSP": "active",
    "HSTS": "enabled",
    "Auth": "Supabase Auth (JWT)"
  },
  "Monitoring": {
    "ErrorLogging": "Basic Remix ErrorBoundary",
    "PaymentTracking": "Via Stripe Dashboard / DB records"
  }
}
```
## Current Status & Future Work

The application includes the core features listed above. All major planned functionalities are implemented.

Potential areas for future enhancement or review include:
- **Content Quality:** Ensure public-facing page content is informative, engaging, and naturally incorporates relevant keywords.
- **Image Alt Text:** Conduct a site-wide review to ensure all meaningful images have descriptive `alt` attributes for SEO and accessibility.
- **Performance (Core Web Vitals):** Analyze and optimize page load speed and responsiveness using tools like Google PageSpeed Insights.
- **Accessibility (A11y):** Perform comprehensive accessibility checks (keyboard navigation, color contrast, ARIA attributes).
- **Payment Reporting:** Enhance admin reporting for payments.
- **Error Monitoring:** Implement more robust error logging/monitoring.
