# Karate Class Website

## Project Overview

Develop a comprehensive and user-friendly karate class management website for
Sensei Negin's classes (details managed in `app/config/site.ts`),
incorporating efficient family-oriented registration,
achievement tracking, attendance monitoring, payment integration, waiver management,
an integrated store for purchasing items like uniforms, and a built-in messaging system
for communication between families and administrators.

## Features

### Core User Experience

- **Public Pages:**
    - Home Page: Introduction, class schedule, location (`app/config/site.ts`).
    - Instructor Profile (`/about`): Bio for Sensei Negin.
    - Contact Page (`/contact`).
- **Introductory Program Landing Pages:**
    - **Templated Landing Pages:** Three specialized landing pages for introductory karate programs targeting different
      audiences:
        - **Elementary Schools** (`/intro/elementary`): Designed for school administrators and teachers looking to offer
          karate programs.
        - **Adaptive Programs** (`/intro/adaptive`): Tailored for special needs programs and adaptive sports
          coordinators.
        - **Day Care Centers** (`/intro/daycare`): Focused on day care directors and early childhood educators.
    - **Dynamic Content System:** All landing pages support URL parameters for customization:
        - `sept`: September series start dates
        - `feb`: February series start dates
        - `price`: Program pricing (automatically adds "+ PST")
        - `sessions`: Number of sessions per series
        - `duration`: Duration of each session
        - `frequency`: Frequency of sessions (e.g., "weekly", "twice weekly")
    - **URL Builder Interface** (`/intro/builder`): Administrative tool for generating custom URLs:
        - **Configuration Panel:** Set dates, pricing, and program details with real-time preview
        - **Automatic URL Generation:** Creates custom URLs for all three audience types
        - **One-Click Copy:** Easy copying of generated URLs for sharing
        - **Live Preview:** Shows exactly how settings will appear on landing pages
    - **Professional Design:** Each landing page features:
        - SEO-optimized meta tags and structured data
        - Responsive design consistent with main site branding
        - Audience-specific content and messaging
        - Clear call-to-action sections for enrollment and contact
        - Professional layout with program benefits and details
    - **Marketing Benefits:**
        - **Replace PDF Files:** Send direct URLs instead of static PDF documents
        - **Always Current:** No outdated files - content updates instantly
        - **Better Tracking:** Monitor which URLs get the most engagement
        - **Easy Customization:** Quickly adjust dates and pricing for different campaigns
        - **Professional Appearance:** Branded web pages that reflect your school's quality
- **Authentication:** Secure user registration, login, email confirmation, and password management.
- **Family Portal (`/family`):** Central dashboard for logged-in users.
    - View associated family details.
    - List registered students with links to individual pages.
    - View remaining Individual Session balance.
    - Manage family/guardian information and change password (`/family/account`).
    - View student attendance history (`/family/attendance`).
    - Track required waiver signature status.
    - Browse and purchase items (e.g., Gi) from the online store (`/family/store/purchase/:studentId`).
    - View past store order history (`/family/orders`).
    - **Multi-Class Program Features:**
        - Browse available training programs with detailed descriptions and requirements.
        - View program schedules, pricing, and instructor information.
        - Enroll students in multiple programs with eligibility validation.
        - Manage enrollment status and waitlist positions.
        - View family class calendar with all enrolled programs.
        - Track enrollment history and program progress.
        - Automatic family discount calculations for multiple enrollments.
    - **In-App Messaging:**
        - View conversations with Admins/Instructors (`/family/messages`).
        - Read and reply to messages within a conversation (`/family/messages/:conversationId`).
        - Initiate new conversations with Admins/Instructors (`/family/messages/new`).
        - Receive class-specific announcements and program updates.
        - Receive real-time updates for new messages.
        - **Push Notifications:** Browser-based push notifications for new messages with customizable settings
          including:
            - Enable/disable push notifications
            - Configure notification frequency (immediate, hourly digest, daily digest)
            - Set quiet hours to avoid notifications during specific times
            - Customize notification sound preferences
        - **Notification Settings:** Configure notification preferences in account settings (`/family/account`).
- **Student Management (Family View):**
    - View detailed student information (`/family/student/:studentId`).
    - Edit student details.
    - Add new students (`/family/add-student`).
    - Purchase store items (e.g., Gi) for the student (`/family/store/purchase/:studentId`).
    - *Note: Student deletion might be restricted to Admins.*
- **Waiver Management:** Digitally sign required waivers (Liability, Code of Conduct, Photo/Video, Payment/Dress Code).
- **Payments:**
    - Secure, embedded payment form using Stripe Elements (`/pay/:paymentId`).
    - Multiple payment options initiated from Family Portal (`/family/payment`): Monthly Group, Yearly Group, Individual
      Sessions, Program Enrollments.
    - **Program-Based Payments:** Dedicated payment workflows for multi-class program enrollments with automatic pricing
      calculation.
    - **Family Discount System:** Automatic discount calculations for families with multiple program enrollments.
    - **Discount Code Support:** Apply discount codes during payment with real-time validation and calculation.
    - View payment history, including payment type and applied discounts (`/family/payment-history`).
    - Flat monthly rate for all students with automatic discounts applied for new students and other qualifying events.
      Prices shown are before tax.
    - Applicable sales taxes (e.g., GST, PST) are calculated based on active rates defined in the `tax_rates` database
      table and the `applicableTaxNames` setting in `app/config/site.ts`. The breakdown (including tax name,
      description, rate, and amount) is stored in the `payment_taxes` table, and the total amount (subtotal + all taxes)
      is stored in the `payments` table and sent to Stripe.
    - Custom, print-friendly payment receipts including tax breakdown (displaying tax description) and discount details
      are generated and accessible via the Family Portal (`/family/receipt/:paymentId`) instead of using Stripe's
      default receipts. The URL is stored in the `payments.receipt_url` field. Requires `VITE_SITE_URL` environment
      variable to be set correctly.
    - Student eligibility status ("Trial", "Paid - Monthly", "Paid - Yearly", "Program Enrolled", "Expired") based on
      payment history and program enrollments (`app/utils/supabase.server.ts`).

### Administrative Panel (`/admin`)

- **Dashboard:** Comprehensive overview with statistics cards showing:
    - Total Families, Students, and Payments with quick access links
    - Multi-class system metrics: Active Programs, Active Classes, Total Enrollments, and Capacity Utilization
    - Additional statistics for Attendance and Waivers
    - Quick action buttons for creating new programs and classes
    - Consistent green color scheme for improved visual coherence
- **Family Management:**
    - View all families (`/admin/families`).
    - Register new families (`/admin/families/new`).
    - View/Edit family details, guardians, associated students, and Individual Session balance (
      `/admin/families/:familyId`).
    - Edit guardian details (`/admin/families/:familyId/guardians/edit`).
    - Add new students to a family (`/admin/families/:familyId/students/new`).
- **Student Management:**
    - View all students (`/admin/students`).
    - View/Edit individual student details (`/admin/students/:studentId`).
    - View family's Individual Session balance and record usage of a session for the student (
      `/admin/students/:studentId`).
    - Manage student belt awards (promotions) (`/admin/student-belts/:studentId`).
    - Delete students (available on family detail page `/admin/families/:familyId`).
- **Multi-Class Program Management:**
    - Create and manage training programs with structured curricula (`/admin/programs`).
    - Define program details: name, description, age groups, belt requirements, pricing structure.
    - Set eligibility rules based on age, belt rank, and prerequisites.
    - Configure program capacity limits and enrollment restrictions.
    - Track program statistics and enrollment metrics.
- **Class Management:**
    - Create classes from program templates (`/admin/classes`).
    - Schedule recurring class sessions with flexible timing options.
    - Assign instructors and manage class capacity.
    - Auto-generate class sessions based on program schedules.
    - Track class attendance and session management.
    - Integration with existing attendance tracking system.
- **Enrollment System:**
    - Comprehensive enrollment management with status tracking (`/admin/enrollments`).
    - Automated waitlist management with priority processing.
    - Enrollment validation against program eligibility rules.
    - Capacity management with automatic enrollment from waitlists.
    - Family discount calculations for multiple enrollments.
    - Enrollment history and audit trail.
- **Attendance Tracking:**
    - Record daily attendance (`/admin/attendance/record`).
    - View attendance history with filtering (`/admin/attendance`).
    - View attendance reports with rates (`/admin/attendance/report`).
    - Integration with class-based attendance for multi-class programs.
- **Waiver Management:**
    - View/Edit waiver documents (`/admin/waivers`, `/admin/waivers/:waiverId`).
    - Mark waivers as required, triggering notifications.
    - View report of families/students with missing required waivers (`/admin/waivers/missing`).
- **Payment Management:**
    - Record manual payments, specifying type (Monthly, Yearly, Individual Session, Program Enrollment, Other) (
      `/admin/payments/new`).
    - Program-based payment processing with automatic pricing calculation.
    - View payment history including payment type (`/admin/payments`).
    - View pending payments (e.g., from failed online transactions) (`/admin/payments/pending`).
    - Integration with enrollment payment workflows.
- **Store Management:**
    - Manage products (add, edit, delete with image uploads) (`/admin/store/products`).
    - Manage product variants (add, edit, delete) (`/admin/store/products/:productId/variants`).
    - Manage inventory stock levels (`/admin/store/inventory`).
    - View and manage customer orders (view details, update status) (`/admin/store/orders`).
- **Database Chat Interface:**
    - Ask questions about the database in natural language (e.g., "How much sales tax collected in Q1?") (
      `/admin/db-chat`).
    - Uses Google Gemini API to translate questions into SQL queries and generate summaries of the results. Requires
      `GEMINI_API_KEY`.
- **Messaging Management:**
    - View conversations initiated by families, with visual indicators for unread messages (`/admin/messages`).
    - Reply to family messages within a conversation (`/admin/messages/:conversationId`).
    - Initiate new conversations with specific families (`/admin/messages/new`).
    - Class-based messaging system for program announcements.
    - Bulk messaging capabilities for class and program communications.
    - Receive real-time updates for new messages and conversation changes.
    - **Push Notifications:** Browser-based push notifications for new messages from families with customizable settings
      including:
        - Enable/disable push notifications
        - Configure notification frequency (immediate, hourly digest, daily digest)
        - Set quiet hours to avoid notifications during specific times
        - Customize notification sound preferences
    - **Notification Settings:** Configure notification preferences in admin account settings (`/admin/account`).
- **Discount Code Management:**
  - Create and manage discount codes with flexible rules (`/admin/discount-codes`).
  - Support for fixed amount and percentage discounts.
  - Configure applicability (training, store, or both) and scope (per-student or per-family).
  - Set usage restrictions (one-time or ongoing) and validity periods.
  - Track discount code usage and view statistics (`/admin/discount-codes`).
  - Create new discount codes with comprehensive options (`/admin/discount-codes/new`).
  - Automatic discount code generation for programmatic use cases.
  - **Discount Templates:** Create and manage reusable templates (`/admin/discount-templates`) to streamline discount
  code creation with pre-configured settings for consistent pricing structures.
    - **Automatic Discount Assignment:**
        - Event-driven automatic discount assignment system (`/admin/automatic-discounts`).
        - Create automation rules linking events to discount templates (`/admin/automatic-discounts/new`).
        - Support for student enrollment, payment milestones, attendance tracking, and belt promotion events.
        - Flexible rule conditions based on age, belt rank, attendance count, and payment history.
        - View and manage discount assignments with comprehensive filtering (`/admin/automatic-discounts/assignments`).
        - Monitor recent events and rule processing (`/admin/automatic-discounts/events`).
        - Batch processing tools for applying rules to historical data (`/admin/automatic-discounts/utilities`).
        - Duplicate prevention and usage limit enforcement.
        - Complete audit trail for all automatic assignments.

### Automated Notifications

- **Student Absence:** Email to family when student marked absent.
- **Newly Required Waiver:** Email to families needing to sign a newly required waiver.
- **Payment Reminder (Scheduled):** Supabase Edge Function (`payment-reminder`) emails families with 'Expired' student
  eligibility.
- **Missing Waiver Reminder (Scheduled):** Supabase Edge Function (`missing-waiver-reminder`) emails families missing
  required signatures.

### Multi-Class System

- **Structured Program Management:** Create and manage comprehensive training programs with detailed curricula, age
  groups, and belt requirements.
- **Flexible Class Scheduling:** Generate recurring class sessions with customizable timing and instructor assignments.
- **Intelligent Enrollment System:** Automated enrollment processing with eligibility validation, capacity management,
  and waitlist handling.
- **Family-Centric Approach:** Support for multiple program enrollments per family with automatic discount calculations.
- **Calendar Integration:** Unified class calendar showing all enrolled programs and sessions.
- **Progress Tracking:** Monitor student progress across multiple programs with comprehensive reporting.
- **Seamless Payment Integration:** Program-specific payment workflows with automatic pricing and family discounts.

### Automated Discount Assignment

- **Event-Driven Processing:** Automatic discount assignment triggered by student enrollment, payment milestones,
  attendance achievements, and belt promotions.
- **Real-Time Rule Evaluation:** Immediate processing of automation rules when qualifying events occur.
- **Program Filtering:** Target discounts to specific programs (e.g., competition team, age groups) for precise discount
  application.
- **Smart Duplicate Prevention:** Prevents multiple assignments of the same discount to ensure fair usage.
- **Flexible Conditions:** Support for age ranges, belt rank requirements, attendance thresholds, and payment history
  criteria.

### Invoice System

- **Comprehensive Invoice Management:** Full-featured invoicing system for managing billing across all school operations
  including enrollments, fees, products, and custom services.
- **Invoice Entities:** Support for multiple billing entities (e.g., main school, satellite locations) with customizable
  business information, logos, and contact details.
- **Dynamic Invoice Templates:** Database-driven template system for creating reusable invoice structures:
    - **System Templates:** 10 pre-configured templates for common scenarios (monthly enrollment, registration packages,
      belt testing, tournaments, equipment, private lessons, family discounts, makeup classes, summer camps, annual
      memberships)
    - **Custom Templates:** User-created templates for organization-specific billing needs
    - **Template Categories:** Organized by enrollment, fees, products, and custom scenarios
    - **Line Item Management:** Predefined line items with descriptions, quantities, pricing, tax rates, and discounts
- **Flexible Invoice Creation:** Create invoices from templates or build custom invoices with:
    - Multiple line items with individual pricing and tax settings
    - Automatic tax calculations based on configurable tax rates
    - Discount code integration with real-time validation
    - Custom terms, notes, and footer text
    - Due date management and payment terms
- **Invoice Status Tracking:** Complete lifecycle management with statuses:
    - Draft, Sent, Viewed, Paid, Overdue, Cancelled
    - Automatic status updates based on payment activity
    - Status history tracking with timestamps
- **Payment Integration:** Seamless integration with the existing payment system:
    - Direct payment links for online payments via Stripe
    - Manual payment recording for cash/check transactions
    - Payment history tracking with detailed records
    - Automatic invoice status updates upon payment
- **Professional Invoice Generation:**
    - PDF generation with customizable layouts and branding
    - Print-friendly formatting with proper page breaks
    - Tax breakdown display with applicable rates
    - Discount details and calculations
    - Payment instructions and terms
- **Administrative Interface:** Comprehensive admin tools for invoice management:
    - Invoice list with filtering by status, date, entity, and amount
    - Bulk operations for common tasks
    - Invoice preview and editing capabilities
    - Payment recording and status management
    - Template management with CRUD operations
- **Family Portal Integration:** Family-facing invoice features:
    - View outstanding and paid invoices
    - Online payment processing with secure Stripe integration
    - Invoice history and receipt access
    - Automatic email notifications for new invoices
- **Reporting and Analytics:** Invoice system reporting capabilities:
    - Revenue tracking by period, entity, and category
    - Outstanding balance monitoring
    - Payment collection analytics
    - Tax reporting with detailed breakdowns
- **Database Architecture:** Robust database design with:
    - `invoice_entities`: Business entity information and branding
    - `invoices`: Core invoice data with status and payment tracking
    - `invoice_line_items`: Detailed line item information with pricing
    - `invoice_payments`: Payment history and transaction records
    - `invoice_status_history`: Complete audit trail of status changes
    - `invoice_templates`: Reusable template definitions
    - `invoice_template_line_items`: Template line item configurations
- **Migration Support:** Seamless transition from static template data to database storage with full backward
  compatibility.

### Events System

- **Comprehensive Event Management:** Full-featured events system for managing one-off events like competitions,
  seminars, tournaments, workshops, and social events that extend beyond regular class schedules.
- **Event Types and Status Management:** Support for multiple event types (competition, seminar, testing, tournament,
  workshop, social_event, fundraiser, other) with comprehensive status tracking (draft, published, registration_open,
  registration_closed, in_progress, completed, cancelled).
- **Flexible Event Configuration:**
    - **Date and Time Management:** Support for single-day and multi-day events with customizable start/end times and
      timezone handling
    - **Location Information:** Venue details including location name and full address
    - **Capacity Management:** Maximum participant limits with automatic registration cutoffs
    - **Registration Deadlines:** Configurable registration deadlines with automatic enforcement
    - **Age and Belt Rank Requirements:** Flexible eligibility criteria based on minimum/maximum age and belt rank
      restrictions
- **Registration and Payment Processing:**
    - **Student Registration System:** Family-based registration allowing parents to register their children for events
    - **Payment Integration:** Seamless integration with existing payment system including registration fees and late
      registration penalties
    - **Registration Status Tracking:** Comprehensive status management (pending, confirmed, cancelled, waitlist) with
      automatic status updates
    - **Waitlist Management:** Automatic waitlist handling when events reach capacity
- **Waiver Integration:**
    - **Event-Specific Waivers:** Link specific waivers to events with required/optional designation
    - **Waiver Enforcement:** Automatic validation ensuring required waivers are signed before registration completion
    - **Flexible Waiver Requirements:** Support for multiple waivers per event with individual requirement settings
- **Administrative Interface:**
    - **Events Dashboard:** Comprehensive overview with event statistics, upcoming events, and registration summaries (
      `/admin/events`)
    - **Event Creation:** Intuitive event creation form with all configuration options (`/admin/events/new`)
    - **Registration Management:** View and manage all event registrations with filtering and status updates
    - **Reporting and Analytics:** Event performance metrics including registration counts, revenue tracking, and
      attendance statistics
- **Eligibility Validation:**
    - **Automated Eligibility Checking:** Built-in function to validate student eligibility based on age, belt rank,
      capacity, and registration deadlines
    - **Real-Time Validation:** Immediate feedback during registration process with clear eligibility messaging
    - **Duplicate Prevention:** Automatic prevention of duplicate registrations for the same student
- **Calendar Integration:** Events seamlessly integrate with existing calendar systems showing alongside regular classes
  and programs.
- **Database Architecture:** Robust three-table design:
    - `events`: Core event information with comprehensive metadata
    - `event_registrations`: Student registration tracking with payment and status management
    - `event_waivers`: Junction table linking events to required waivers
- **Security and Permissions:** Complete Row Level Security (RLS) implementation with role-based access control for
  admins, instructors, and families.

### Technical & SEO

- Built with Remix for SSR and performance.
- Uses Supabase for backend (database, auth, edge functions).
- UI components from Shadcn.
- Mobile-optimized responsive design.
- Production-ready security headers (CSP, HSTS).
- SEO enhancements: Meta tags, `robots.txt`, dynamic `sitemap.xml`, JSON-LD structured data, canonical URLs.
- **Progressive Web App (PWA):** Full PWA implementation with offline support, installable on mobile and desktop
  devices, service worker for caching, custom app icons and splash screens, and app-like experience. Includes PWA status
  indicators, installation prompts, and comprehensive push notification support for messaging with customizable
  notification settings.

## Technology Stack

- **Frontend**: Remix framework for optimal user experience, server-side rendering, and modern web practices.
- **Backend**: Supabase for scalable database solutions, authentication, and real-time functionalities.
- **UI Library**: Shadcn for clean, modern, and consistent UI components ensuring high usability.
- **Payments**: Stripe integration using Payment Intents and Stripe Elements (`@stripe/react-stripe-js`,
  `@stripe/stripe-js`).
- **Deployment**: Cloud-based deployment solutions (e.g., Vercel or Netlify).

## Customization Guide

- **Site Configuration:** Basic site details (name, instructor info, class schedule, location, pricing tiers) are
  managed in `app/config/site.ts`.
- **Styling:** Uses Tailwind CSS and Shadcn UI components. Customize Tailwind configuration in `tailwind.config.ts` and
  component styles within `app/components/ui/`.
- **Pricing Logic:** Payment tier calculation logic is within the payment initiation route (`/family/payment`). Payment
  completion happens on `/pay/:paymentId`. Pricing values (before tax) are in `app/config/site.ts`.
- **Tax Logic:** Taxes are defined in the `tax_rates` database table (including name, description, rate). Which taxes
  apply is determined by `siteConfig.applicableTaxNames`. Calculation occurs server-side (in
  `app/routes/api.create-payment-intent.ts`, `app/routes/admin.payments.new.tsx`) based on the subtotal. The breakdown (
  including snapshots of name, description, rate, and calculated amount) is stored in `payment_taxes`. Receipts display
  the `tax_description_snapshot`.
- **Eligibility Logic:** Student eligibility (Trial, Paid, Expired) based on payment history is handled in
  `app/utils/supabase.server.ts`.
- **Email Templates:** Email content is generally defined within the server-side code that sends the email (e.g.,
  routes, Supabase functions). Check `app/utils/email.server.ts` and `supabase/functions/`. For Supabase authentication
  email templates, see the **Supabase Email Templates** section below.

## Supabase Email Templates

The project includes customized email templates for Supabase authentication flows. These templates are located in
`supabase/email_templates/` and provide a consistent, branded experience for all authentication-related emails.

### Available Templates

- **Confirm signup** (`supabase-signup-email-template.html`) - Welcome email for new user registrations
- **Invite user** (`supabase-invite-email-template.html`) - Invitation email for new users
- **Magic Link** (`supabase-magiclink-email-template.html`) - Passwordless login email
- **Change email address** (`supabase-changeemail-email-template.html`) - Email change confirmation
- **Reset password** (`supabase-resetpassword-email-template.html`) - Password reset email
- **Reauthentication** (`supabase-reauth-email-template.html`) - Reauthentication token email

### Template Generation

Email templates are generated from internal templates (`.internal.html` files) that contain placeholders for site
configuration:

```bash
cd scripts

# Generate all templates
./deploy-supabase.sh --only-templates --dry-run

# Generate and deploy all templates
./deploy-supabase.sh --only-templates

# Generate and deploy a specific template
./deploy-supabase.sh --template signup
./deploy-supabase.sh --template invite
./deploy-supabase.sh --template magiclink
./deploy-supabase.sh --template changeemail
./deploy-supabase.sh --template resetpassword
./deploy-supabase.sh --template reauth
```

The generation script reads configuration from `app/config/site.ts` and replaces placeholders like `{{SITE_NAME}}`,
`{{PRIMARY_COLOR}}`, `{{SITE_URL}}`, and `{{LOGO_URL}}`.

### Deployment

#### Unified Deployment Script (Recommended)

Use the unified deployment script to deploy both email templates and Supabase functions:

```bash
cd scripts

# Setup environment (first time only)
cp .env.example .env.production
# Edit .env.production with your Supabase credentials:
# - SUPABASE_ACCESS_TOKEN: Get from https://supabase.com/dashboard/account/tokens
# - SUPABASE_PROJECT_REF: Find in your project URL

# Deploy everything (templates + functions)
./deploy-supabase.sh --env .env.production

# Deploy only email templates
./deploy-supabase.sh --env .env.production --templates-only

# Deploy only functions
./deploy-supabase.sh --env .env.production --functions-only

# Deploy specific components
./deploy-supabase.sh --env .env.production --template signup
./deploy-supabase.sh --env .env.production --function payment-reminder

# Dry run (generate templates without deploying)
./deploy-supabase.sh --env .env.production --dry-run
```

#### GitHub Actions (Automated)

For automated deployments, use the included GitHub Actions workflow:

**Setup:**
1. Go to your GitHub repository → Settings → Secrets and variables → Actions
2. Add the following repository secrets:
   - `SUPABASE_ACCESS_TOKEN`: Your Supabase access token
   - `SUPABASE_PROJECT_REF`: Your project reference ID
   - `SUPABASE_URL`: Your project URL (optional)
   - `SUPABASE_ANON_KEY`: Your anon key (optional)

**Automatic Deployment:**
- Pushes to `main` or `production` branches automatically deploy when:
  - Email template files change (`supabase/email_templates/**`)
  - Function files change (`supabase/functions/**`)
  - Site configuration changes (`app/config/site.ts`)

**Manual Deployment:**
- Go to Actions → "Deploy Supabase" → "Run workflow"
- Choose what to deploy: `all`, `templates`, or `functions`
- Select environment: `production` or `staging`

```

**Prerequisites:**
- `curl`, `jq`, and `supabase` CLI must be installed
- Valid Supabase access token with project permissions
- Supabase project linked (script will attempt to link automatically)

#### Individual Component Deployment

Alternatively, deploy components individually:

**Email Templates:**
```bash
cd scripts
./deploy-supabase.sh --only-templates --env .env.production
```

**Supabase Functions:**
```bash
supabase functions deploy  # Deploy all functions
supabase functions deploy payment-reminder  # Deploy specific function
```

#### Manual Dashboard Setup

For email templates only, you can manually copy contents to your Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. For each template type, paste the corresponding generated HTML:
    - `supabase-signup-email-template.html` → **Confirm signup**
    - `supabase-invite-email-template.html` → **Invite user**
    - `supabase-magiclink-email-template.html` → **Magic Link**
    - `supabase-changeemail-email-template.html` → **Change email address**
    - `supabase-resetpassword-email-template.html` → **Reset password**
    - `supabase-reauth-email-template.html` → **Reauthentication**

### Customization

To customize the email templates:

1. **Site Configuration:** Update `app/config/site.ts` with your site details (name, colors, URLs)
2. **Template Content:** Modify the `.internal.html` files in `supabase/email_templates/`
3. **Regenerate and Deploy:** Run `cd scripts && ./deploy-supabase.sh --only-templates` to generate and deploy updated templates

**Note:** Always edit the `.internal.html` files, not the generated `.html` files, as the latter are overwritten during
generation.

## Local Development Setup

1. **Clone Repository:**
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Environment Variables:**
    - Copy `.env.example` to `.env`.
    - Fill in the required values for Supabase, Stripe (optional for local testing, required for payments), Resend (for
      email sending), Google Gemini API (`GEMINI_API_KEY` - required for Admin DB Chat), and push notifications.
    - **Supabase Variables:** Get these from your Supabase project dashboard (Project Settings -> API):
        - `SUPABASE_URL`: Your project URL (e.g., `https://yourprojectref.supabase.co`)
        - `SUPABASE_ANON_KEY`: Your project's anon/public key
        - `SUPABASE_SERVICE_ROLE_KEY`: Your project's service role key (keep this secret)
    - **Push Notification Variables (Required for push notifications):**
        - `VAPID_PUBLIC_KEY`: VAPID public key for push notifications
        - `VAPID_PRIVATE_KEY`: VAPID private key for push notifications
        - `VAPID_SUBJECT`: Contact email or URL for VAPID (e.g., `mailto:admin@yourdomain.com`)
        - **Setup Steps:**
            1. Install the web-push package: `npm install web-push`
            2. Generate VAPID keys: `npx web-push generate-vapid-keys`
            3. Copy the generated keys to your `.env` file
            4. Set `VAPID_SUBJECT` to your contact email (e.g., `mailto:admin@yourdomain.com`)
        - **Note:** For detailed push notification setup and configuration, see `PUSH_NOTIFICATIONS.md`
    - **Direct Database Connection Variables:** The Admin DB Chat feature (`/admin/db-chat`) requires direct PostgreSQL
      connection to fetch the database schema. Get these from your Supabase project dashboard:
        1. Click the **"Connect"** button at the top of your Supabase dashboard
        2. In the connection dialog, look for the **Session pooler** connection string (it will look like:
           `postgres://postgres.yourproject:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres`)
        3. From this connection string, extract the following values:
            - `DB_USER`: The username part before the colon (e.g., `postgres.brvtvtkjgqmnebehzuny`)
            - `DB_HOST`: The host part after the @ symbol (e.g., `aws-0-us-west-1.pooler.supabase.com`)
            - `DB_NAME`: The database name at the end (usually `postgres`)
            - `DB_PASSWORD`: Your database password (found in Project Settings → Database → Database password)
            - `DB_URL`: The complete connection string in JDBC format: `jdbc:postgresql://[DB_HOST]:5432/[DB_NAME]`
            - `DB_URL`: The complete connection string in JDBC format: `jdbc:postgresql://[DB_HOST]:5432/[DB_NAME]`
    - **Note:** If you don't plan to use the Admin DB Chat feature, you can skip the DB_ variables.
4. **Supabase Setup:**
    - Create a Supabase project at [supabase.com](https://supabase.com).
    - In your Supabase project dashboard:
        - Navigate to Authentication -> Providers (under the "Sign In Methods" section). Enable the "Email" provider.
        - Navigate to Authentication -> Settings (under the "Configuration" section). Disable "Confirm email" if you
          want easier local testing, but **ensure it's enabled for production**.
        - Navigate to the SQL Editor (Database -> SQL Editor) and run the entire contents of the
          `app/db/supabase-setup.sql` file. This script creates all necessary tables, types, functions, and policies.
        - **Create Storage Bucket (for Product Images):**
            1. Go to your Supabase project dashboard.
            2. Navigate to Storage.
            3. Click "Create bucket".
            4. Name the bucket `product-images`.
            5. **Crucially**, make it a **Public bucket** so the images can be displayed on the website without
               requiring authentication tokens. If you prefer private, the URL generation and display logic will be more
               complex. For simplicity, we'll assume a public bucket for now.
            6. Configure bucket policies if needed (e.g., restrict uploads to specific file types/sizes via policies if
               desired, though we'll also add server-side checks).
        - **Enable Realtime (for Messaging):**
            1. Go to your Supabase project dashboard.
            2. Navigate to Database -> Replication.
            3. Under "Source", click on the number link next to `supabase_realtime`.
            4. Find the `conversations` and `messages` tables in the list.
            5. For **both** the `conversations` and `messages` tables, click the corresponding toggle switch in the "
               Realtime" column to enable realtime updates.
        - **Push Notification Setup:** The database setup script (`app/db/supabase-setup.sql`) includes tables for push
          notification subscriptions (`push_subscriptions`) and user notification preferences (
          `user_notification_preferences`). These are automatically created when you run the setup script. After setting
          up the database, make sure to configure your
          VAPID keys in the `.env` file (see Environment Variables section above).
    - Obtain your Supabase Project URL, Anon Key, and Service Role Key (Project Settings -> API) and add them to your
      `.env` file (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).
5. **Stripe Setup (Optional for Local):**
    - Create a Stripe account at [stripe.com](https://stripe.com).
    - Obtain your Publishable Key and Secret Key and add them to `.env`.
    - For webhook testing locally,
        - install the Stripe CLI (`brew install stripe/stripe-cli/stripe`)
        - login to stripe (`stripe login`)
        - create a webhook endpoint in your Stripe dashboard (pointing to a tool like `ngrok` or using the Stripe CLI's
          forwarding)
        - obtain the Webhook Signing Secret and add it as `STRIPE_WEBHOOK_SECRET` in your `.env` file
        - use
          `stripe listen --forward-to localhost:<PORT>/api/webhooks/stripe --events payment_intent.succeeded,payment_intent.payment_failed` (
          replace `<PORT>` with your dev server port, e.g., 3000) to forward only the necessary events from Stripe to
          your local server.
6. **Resend Setup (Optional for Local):**
    - Create a Resend account at [resend.com](https://resend.com).
    - Obtain an API Key and add it to `.env`.
    - Set the `FROM_EMAIL` in `.env` (e.g., `"Your Name <you@yourdomain.com>"`). You may need to verify your domain with
      Resend.
7. **Generate Supabase Types:**
   ```bash
   npx supabase login # If not already logged in
   npx supabase link --project-ref YOUR_PROJECT_ID
   npx supabase gen types typescript --linked --schema public > supabase/functions/_shared/database.types.ts
   # Also recommended to copy to app/types for frontend use:
   cp supabase/functions/_shared/database.types.ts app/types/database.types.ts
   ```
   *(Replace `YOUR_PROJECT_ID` with your actual Supabase project ID)*
8. **Run Development Server:**
   ```bash
   npm run dev
   ```

## Deployment Guide (Vercel Example)

1. **Push to Git:** Ensure your code is pushed to a Git repository (GitHub, GitLab, Bitbucket).
2. **Import Project:** In Vercel, import the project from your Git repository.
3. **Configure Build Settings:** Vercel should automatically detect Remix. Default settings are usually sufficient.
4. **Environment Variables:** Add the following environment variables in the Vercel project settings:
    - `SUPABASE_URL`
    - `SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `STRIPE_SECRET_KEY`
    - `STRIPE_PUBLISHABLE_KEY`
    - `STRIPE_WEBHOOK_SECRET`
    - `RESEND_API_KEY`
    - `FROM_EMAIL`
    - `GEMINI_API_KEY` (Required for Admin DB Chat feature)
    - `VITE_SITE_URL` (Your production website URL, e.g., `https://www.yourdomain.com` - **Required** for generating
      correct absolute receipt URLs and for frontend config)
    - **Push Notification Variables (Required for push notifications):**
        - `VAPID_PUBLIC_KEY` (VAPID public key for push notifications)
        - `VAPID_PRIVATE_KEY` (VAPID private key for push notifications)
        - `VAPID_SUBJECT` (Contact email or URL for VAPID, e.g., `mailto:admin@yourdomain.com`)

### VAPID Keys Setup for Push Notifications

Push notifications require VAPID (Voluntary Application Server Identification) keys for secure communication between
your server and browser push services. Follow these steps to set up VAPID keys for your deployment:

#### Option 1: Using the Built-in Script (Recommended)

1. **Generate VAPID Keys:**
   ```bash
   node scripts/generate-vapid-keys.js
   ```

2. **Copy the Generated Keys:**
   The script will output three environment variables. Copy these values to your deployment environment:
   ```
   VAPID_PUBLIC_KEY=BG7rWXf8xI9...
   VAPID_PRIVATE_KEY=4f8Kz2nM1pL...
   VAPID_SUBJECT=mailto:your-email@example.com
   ```

3. **Update VAPID_SUBJECT:**
   Replace `your-email@example.com` with your actual contact email address.

#### Option 2: Using web-push CLI

1. **Install web-push globally:**
   ```bash
   npm install -g web-push
   ```

2. **Generate VAPID Keys:**
   ```bash
   web-push generate-vapid-keys
   ```

3. **Add to Environment Variables:**
   Copy the generated public and private keys to your deployment environment variables, along with your contact email
   for `VAPID_SUBJECT`.

#### Option 3: Using npx (No Global Installation)

```bash
npx web-push generate-vapid-keys
```

#### Important Notes for Production Deployment:

- **Security:** Keep your `VAPID_PRIVATE_KEY` secret and never expose it in client-side code
- **Consistency:** Use the same VAPID keys across all environments (staging, production) to maintain push subscription
  compatibility
- **Contact Information:** The `VAPID_SUBJECT` should be a valid email address or URL where you can be contacted about
  push notification issues
- **Key Regeneration:** If you regenerate VAPID keys, all existing push subscriptions will become invalid and users will
  need to re-subscribe
- **Backup:** Store your VAPID keys securely as losing them will require all users to re-subscribe to push notifications

#### Verifying Push Notification Setup:

After deployment, you can verify push notifications are working by:

1. **Admin Test:** Visit `/admin/account` and test push notifications using the built-in test feature
2. **Family Test:** Have a family member enable push notifications in `/family/account` and send them a test message
3. **Browser Console:** Check for any VAPID-related errors in the browser developer console
4. **Server Logs:** Monitor your deployment logs for push notification delivery confirmations
5. **Tax Configuration:** Ensure the `tax_rates` table in your production Supabase database contains the correct tax
   rates (e.g., GST, PST_BC) and that they are marked `is_active = true`. Verify `applicableTaxNames` in
   `app/config/site.ts` matches the desired active taxes for your site. Stripe Tax configuration in the dashboard is *
   *not** used for calculation.
6. **Deploy:** Trigger a deployment in Vercel.
7. **Vercel Configuration:**
    - After deployment, go to **Project Settings** > **Functions** > **Function Max Duration**
    - Increase the Function Max Duration to **60 seconds** to prevent timeout issues with the `/admin/db-chat` feature
8. **Stripe Webhook:**
    - Once deployed, get your production URL.
    - In your Stripe Dashboard, go to Developers -> Webhooks.
    - Add an endpoint:
        - URL: `https://<your-vercel-domain>/api/webhooks/stripe`
        - Select the specific events your application needs to listen for. Click "+ Select events" and choose:
            - `payment_intent.succeeded`
            - `payment_intent.payment_failed`
        - Use the `STRIPE_WEBHOOK_SECRET` from your environment variables.
7. **Supabase Production Setup:**
    - Ensure "Confirm email" is **enabled** in Supabase Auth settings for production.
    - Set up database backups in Supabase.
    - **Enable Realtime (for Messaging):** Follow the same steps as in the Local Development Setup (Section 4, Supabase
      Setup) to enable Realtime for the `conversations` and `messages` tables in your *production* Supabase project.
8. **Resend Domain Verification:** Ensure your sending domain is verified in Resend for reliable email delivery.
9. **Supabase Edge Functions:**
    - **Set Secrets:** Edge Functions need their own environment variables (secrets). Set them using the Supabase CLI (
      recommended) or the Dashboard (Edge Functions -> Select Function -> Secrets). You need to set `VITE_SITE_URL`,
      `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`, and `STRIPE_SECRET_KEY`.
        ```bash
        # Example using Supabase CLI (run for each secret)
        supabase secrets set VITE_SITE_URL=https://your-production-domain.com
        supabase secrets set RESEND_API_KEY=your_resend_api_key
        supabase secrets set FROM_EMAIL="Your Name <you@yourdomain.com>"
        supabase secrets set STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
        supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
        supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
        ```
    - **Deploy Functions:** Deploy the functions to your *linked* Supabase project:
   ```bash
   # Ensure you are linked to the correct Supabase project
   npx supabase functions deploy payment-reminder --no-verify-jwt
   npx supabase functions deploy missing-waiver-reminder --no-verify-jwt
   npx supabase functions deploy sync-pending-payments --no-verify-jwt
   ```                                                                                                                                                                                                               
    - **Schedule Functions:** Use the SQL Editor in your Supabase Dashboard to schedule the functions using `pg_cron`.
        - Go to SQL Editor -> + New query.
        - Run the following commands, **replacing placeholders** with your actual values:
            - `<YOUR_PROJECT_REF>`: Found in Project Settings -> General.
            - `YOUR_SUPABASE_SERVICE_ROLE_KEY`: Found in Project Settings -> API -> Project API keys.
        ```sql                                                                                                                                                                                                        
        -- Schedule payment reminder (e.g., daily at 9 AM UTC)                                                                                                                                                        
        SELECT cron.schedule(                                                                                                                                                                                         
            'payment-reminder-job',                                                                                                                                                                                   
            '0 9 * * *', -- Adjust schedule as needed                                                                                                                                                                 
            $$                                                                                                                                                                                                        
            SELECT net.http_post(                                                                                                                                                                                     
                url:='https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/payment-reminder',                                                                                                                          
                headers:='{"Authorization": "Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY"}'::jsonb,                                                                                                                         
                body:='{}'::jsonb                                                                                                                                                                                     
            );                                                                                                                                                                                                        
            $$                                                                                                                                                                                                        
        );                                                                                                                                                                                                            
                                                                                                                                                                                                                      
        -- Schedule missing waiver reminder (e.g., daily at 9:05 AM UTC)                                                                                                                                              
        SELECT cron.schedule(                                                                                                                                                                                         
            'missing-waiver-reminder-job',                                                                                                                                                                            
            '5 9 * * *', -- Adjust schedule as needed                                                                                                                                                                 
            $$                                                                                                                                                                                                        
            SELECT net.http_post(                                                                                                                                                                                     
                url:='https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/missing-waiver-reminder',                                                                                                                   
                headers:='{"Authorization": "Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY"}'::jsonb,                                                                                                                         
                body:='{}'::jsonb                                                                                                                                                                                     
            );                                                                                                                                                                                                        
            $$                                                                                                                                                                                                        
        );                                                                                                                                                                                                            
                                                                                                                                                                                                                      
        -- Schedule pending payment sync (e.g., every 15 minutes)                                                                                                                                                     
        SELECT cron.schedule(                                                                                                                                                                                         
            'sync-pending-payments-job',                                                                                                                                                                              
            '*/15 * * * *', -- Adjust schedule as needed                                                                                                                                                              
            $$                                                                                                                                                                                                        
            SELECT net.http_post(                                                                                                                                                                                     
                url:='https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/sync-pending-payments',                                                                                                                     
                headers:='{"Authorization": "Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY"}'::jsonb,                                                                                                                         
                body:='{}'::jsonb                                                                                                                                                                                     
            );                                                                                                                                                                                                        
            $$                                                                                                                                                                                                        
        );                                                                                                                                                                                                            
                                                                                                                                                                                                                      
        -- Optional: To unschedule later                                                                                                                                                                              
        -- SELECT cron.unschedule('job-name');                                                                                                                                                                        
        ```                                                                                                                                                                                                           

## Developer Information

- **Project Structure:**
    - `app/routes/`: Contains all Remix route modules (UI and server logic). Includes `$.tsx` for 404 handling.
        - `app/routes/admin.tsx`: Admin dashboard route (path `/admin`, uses `admin.tsx` layout).
        - `app/routes/admin.account.tsx`: Admin account settings page with notification preferences.
        - `app/routes/admin.programs.tsx`: Admin program management interface.
        - `app/routes/admin.classes.tsx`: Admin class management interface.
        - `app/routes/admin.enrollments.tsx`: Admin enrollment management interface.
        - **Intro Template Routes:** Introductory program landing pages and URL builder:
            - `app/routes/_layout.intro.elementary.tsx`: Elementary school landing page with dynamic URL parameters
            - `app/routes/_layout.intro.adaptive.tsx`: Adaptive programs landing page with dynamic URL parameters
            - `app/routes/_layout.intro.daycare.tsx`: Day care centers landing page with dynamic URL parameters
            - `app/routes/_layout.intro.builder.tsx`: URL builder interface for generating custom landing page URLs
    - `app/components/`: Shared React components (UI elements, layout parts).
        - **PWA Components:** `ServiceWorkerRegistration.tsx` (service worker management), `PWAInstallPrompt.tsx` (
          installation prompts), `PWAStatus.tsx` (PWA status indicators and installation button).
        - **Notification Components:** `NotificationSettings.tsx` (notification preferences management with customizable
          settings for frequency, quiet hours, and sound preferences).
    - `app/utils/`: Utility functions (database interactions, email sending, helpers).
        - **Push Notification Utilities:** `push-notifications.client.ts` (client-side push notification management),
          `push-notifications.server.ts` (server-side push notification sending), `notifications.client.ts` (
          notification permission and subscription management).
    - `app/config/`: Site-wide configuration.
    - `app/types/`: TypeScript type definitions (including `database.types.ts`, `multi-class.ts`).
    - `app/services/`: Server-side business logic and data access layer.
        - `app/services/program.server.ts`: Program management logic (CRUD, eligibility, statistics).
        - `app/services/class.server.ts`: Class management logic (scheduling, sessions, capacity).
        - `app/services/enrollment.server.ts`: Enrollment processing logic (validation, waitlists, status tracking).
    - `app/routes/api.create-payment-intent.ts`: Backend endpoint for Stripe Payment Intent creation (handles regular
      payments, store purchases, and program enrollments).
    - `app/routes/api.webhooks.stripe.ts`: Handles incoming Stripe webhook events (updates payment status, order status,
      stock levels).
    - **Push Notification API Routes:** `api.push.subscribe.ts` (push subscription management),
      `api.push.unsubscribe.ts` (push unsubscription), `api.push.test.ts` (push notification testing).
    - `app/routes/_layout.family.store...`: Family-facing store routes.
    - `app/routes/admin.store...`: Admin-facing store management routes.
    - `app/routes/_layout.family.messages...`: Family-facing messaging routes.
    - `app/routes/_admin.messages...`: Admin-facing messaging routes (nested under admin layout).
    - `app/components/ConversationList.tsx`, `app/components/AdminConversationList.tsx`,
      `app/components/MessageView.tsx`, `app/components/MessageInput.tsx`: Core UI components for messaging.
    - `app/routes/admin.discount-codes...`: Admin-facing discount code management routes.
    - `app/routes/admin.automatic-discounts...`: Admin-facing automatic discount management routes.
    - `app/routes/admin.invoice-entities...`: Admin-facing invoice entity management routes.
    - `app/routes/admin.invoice-templates...`: Admin-facing invoice template management routes.
    - `app/routes/admin.invoices...`: Admin-facing invoice management routes.
    - `app/routes/api.discount-codes.validate.tsx`, `app/routes/api.available-discounts.$familyId.tsx`: API endpoints
      for discount code validation and retrieval.
    - `app/routes/api.invoices.$id.pdf.ts`: API endpoint for generating invoice PDFs.
    - `app/services/discount.server.ts`: Server-side discount code logic (validation, application, usage tracking).
    - `app/services/auto-discount.server.ts`: Server-side automatic discount logic (event processing, rule evaluation,
      assignment).
    - `app/services/invoice-template.server.ts`: Server-side invoice template logic (CRUD operations, template
      management).
    - `app/utils/auto-discount-events.server.ts`: Event integration utilities for automatic discount triggers.
    - `app/components/DiscountCodeSelector.tsx`: User-facing component for discount code input and validation.
    - `app/components/InvoiceEntitySelector.tsx`: Component for selecting invoice entities.
    - `app/components/InvoiceForm.tsx`: Main invoice creation and editing form.
    - `app/components/InvoiceLineItemBuilder.tsx`: Component for managing invoice line items.
    - `app/components/InvoicePaymentHistory.tsx`: Component for displaying payment history.
    - `app/components/InvoicePreview.tsx`: Component for previewing invoices before generation.
    - `app/components/InvoiceTemplates.tsx`: Component for template selection and management.
    - `app/types/discount.ts`, `app/types/multi-class.ts`, `app/types/supabase-extensions.d.ts`: TypeScript definitions
      for discount system, multi-class system, and extended Supabase types.
    - **Note:** While dedicated API routes exist for specific tasks, much of the core backend logic (data fetching,
      mutations) is handled within the `loader` and `action` functions of the standard Remix routes (`app/routes/`),
      serving as endpoints for the web UI itself rather than standalone APIs.
    - `supabase/functions/`: Serverless edge functions (e.g., for scheduled tasks).
        - `supabase/functions/_shared/`: Code shared between edge functions (like database types, email client).
    - **PWA Assets:** `public/manifest.json` (web app manifest), `public/sw.js` (service worker),
      `public/offline.html` (offline fallback page), `public/browserconfig.xml` (Windows tile configuration), and
      various app icons in `public/` directory.
- **UI:** Built with [Shadcn](https://ui.shadcn.com/) on top of Tailwind CSS. Use `npx shadcn@latest add <component>` to
  add new components consistently.
- **Database:** Supabase PostgreSQL. Schema definitions can be inferred from `app/types/database.types.ts` or Supabase
  Studio. See `app/db/supabase-setup.sql` for idempotent setup script (includes tables like `products`,
  `product_variants`, `orders`, `order_items`, `discount_codes`, `discount_code_usage`, `discount_events`,
  `discount_automation_rules`, `discount_assignments`, `programs`, `classes`, `class_sessions`, `enrollments`,
  `enrollment_history`, `push_subscriptions`, `user_notification_preferences`, `invoice_entities`, `invoices`,
  `invoice_line_items`, `invoice_payments`, `invoice_status_history`, `invoice_templates`,
  `invoice_template_line_items`).
    - **Hybrid JSONB + Explicit Columns Architecture:** The system uses a performance-optimized hybrid approach
      combining explicit columns for commonly used fields with JSONB for additional/custom data. Migration
      `002_add_explicit_columns.sql` added explicit pricing columns (`monthly_fee`, `registration_fee`,
      `payment_frequency`, `family_discount`) and eligibility columns (`min_age`, `max_age`, `gender_restriction`,
      `special_needs_support`) to `programs` table, plus schedule columns (`days_of_week[]`, `start_time`, `end_time`,
      `timezone`) to `classes` table. This provides better performance through targeted indexing while maintaining
      flexibility.
    - **Multi-Class System:** Comprehensive program and class management with tables for `programs` (training program
      definitions with curricula and requirements), `classes` (specific class instances with scheduling and capacity),
      `class_sessions` (individual session occurrences), `enrollments` (student program registrations with status
      tracking), and `enrollment_history` (audit trail of enrollment changes). Includes automated session generation,
      capacity management, waitlist handling, and family discount calculations.
    - **Discount System:** Comprehensive discount code system with tables for `discount_codes` (code definitions, rules,
      validity) and `discount_code_usage` (usage tracking, audit trail). Supports fixed amount and percentage discounts
      with flexible applicability rules (training, store, both) and scope (per-student, per-family). Includes usage
      restrictions (one-time, ongoing) and automatic discount generation capabilities.
    - **Automatic Discount System:** Event-driven automatic discount assignment with tables for `discount_events` (
      student/family events), `discount_automation_rules` (rule definitions linking events to discount templates), and
      `discount_assignments` (tracking of automatically assigned discounts). Supports complex rule conditions, duplicate
      prevention, and comprehensive audit trails.
    - **Invoice System:** Comprehensive invoicing system with tables for `invoice_entities` (business entity information
      and branding), `invoices` (core invoice data with status tracking), `invoice_line_items` (detailed line item
      information), `invoice_payments` (payment history and transaction records), `invoice_status_history` (complete
      audit trail of status changes), `invoice_templates` (reusable template definitions), and
      `invoice_template_line_items` (template line item configurations). Supports multiple billing entities, dynamic
      templates, flexible invoice creation, status tracking, payment integration, and professional PDF generation.
    - **Push Notification System:** Comprehensive push notification system with tables for `push_subscriptions` (device
      subscription management) and `user_notification_preferences` (user-specific notification settings including
      frequency, quiet hours, and sound preferences). Supports browser-based push notifications with customizable
      delivery options.
- **Types:** Database types are generated using the Supabase CLI (see Setup). Ensure
  `supabase/functions/_shared/database.types.ts` and `app/types/database.types.ts` are kept in sync.
- **Environment Variables:** Managed via `.env` locally and platform environment variables in production (see
  Deployment). Use `.env.example` as a template.
- **Email:** Uses Resend for transactional emails. See `app/utils/email.server.ts` and function-specific email logic.

### External API (v1)

A versioned API is available for external consumption (e.g., by an AI server or other applications).

- **Base Path:** `/api/v1`
- **Authentication:** All API endpoints require a valid Supabase JWT passed in the `Authorization` header as a Bearer
  token (`Authorization: Bearer <YOUR_SUPABASE_JWT>`). Clients must first authenticate with Supabase (e.g., using
  email/password) to obtain a token.
- **Authorization:** Most endpoints currently require the authenticated user to have an 'admin' role (defined in
  Supabase user metadata). This may be adjusted per endpoint in the future.
- **Format:** Requests and responses use JSON.
- **Error Handling:** Errors are returned as JSON objects with an `error` key and appropriate HTTP status codes (e.g.,
  400, 401, 403, 404, 500).

**Available Endpoints:**

* **`GET /api/v1/families/{familyId}`**
    * **Description:** Retrieves detailed information for a specific family, including students and their 1:1 session
      balance. Guardians should be fetched separately using the `/api/v1/families/{familyId}/guardians` endpoint.
    * **Authorization:** Requires `admin` role.
    * **Example Request:**
      ```bash
      curl -X GET "https://<your-domain>/api/v1/families/YOUR_FAMILY_ID" \
           -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
      ```
    * **Example Success Response (200 OK):**
      ```json
      {
        "id": "uuid-for-family",
        "created_at": "2023-10-26T10:00:00.000Z",
        "updated_at": "2023-10-27T11:30:00.000Z",
        "name": "Smith Family",
        "email": "smith.family@example.com",
        "primary_phone": "555-123-4567",
        "address": "123 Main St",
        "city": "Anytown",
        "province": "ON",
        "postal_code": "A1B 2C3",
        "emergency_contact": "Jane Doe 555-987-6543",
        "health_info": null,
        "notes": "Likes morning classes.",
        "referral_source": "Website",
        "referral_name": null,
        // "guardians" array removed - fetch separately
        "students": [
          {
            "id": "uuid-for-student-1",
            "created_at": "2023-10-26T10:05:00.000Z",
            "updated_at": "2023-10-28T09:15:00.000Z",
            "family_id": "uuid-for-family",
            "first_name": "Alice",
            "last_name": "Smith",
            "gender": "Female",
            "birth_date": "2015-03-10",
            "cell_phone": null,
            "email": null,
            "t_shirt_size": "YM",
            "school": "Anytown Elementary",
            "grade_level": "3",
            "special_needs": null,
            "allergies": "Peanuts",
            "medications": null,
            "immunizations_up_to_date": "true",
            "immunization_notes": null
          }
        ],
        "oneOnOneBalance": 5
      }
      ```
    * **Example Error Responses:**
        * `401 Unauthorized`: `{"error": "Unauthorized: Missing or invalid Bearer token"}`
        * `403 Forbidden`: `{"error": "Forbidden: Requires 'admin' role."}` or
          `{"error": "Forbidden: User not found for token"}`
        * `404 Not Found`: `{"error": "Family not found"}`
        * `500 Internal Server Error`: `{"error": "Database error: <details>"}` or
          `{"error": "An unknown server error occurred."}`

* **`GET /api/v1/students/{studentId}`**
    * **Description:** Retrieves detailed information for a specific student, including family info, belt rank, and 1:1
      session details.
    * **Authorization:** Requires `admin` role.
    * *(Details like example request/response can be added here)*

* **`GET /api/v1/family/me`**
    * **Description:** Retrieves detailed information for the *currently authenticated user's* family, including
      students and 1:1 session balance. Guardians should be fetched separately using the
      `/api/v1/families/{familyId}/guardians` endpoint (where `familyId` is obtained from this response or the user's
      profile).
    * **Authorization:** Requires standard user authentication (Bearer token). No specific role needed.
    * **Example Request:**
      ```bash
      curl -X GET "https://<your-domain>/api/v1/family/me" \
           -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
      ```
    * **Example Success Response (200 OK):**
      *(Same structure as `GET /api/v1/families/{familyId}`)*
      ```json
      {
        "id": "uuid-for-user-family",
        "created_at": "...",
        "updated_at": "...",
        "name": "User Family Name",
        "email": "user.family@example.com",
        // ... other family fields
        // "guardians" array removed - fetch separately
        "students": [ ... ],
        "oneOnOneBalance": 2
      }
      ```
    * **Example Error Responses:**
        * `401 Unauthorized`: `{"error": "Unauthorized: Missing or invalid Bearer token"}`
        * `403 Forbidden`: `{"error": "Forbidden: User not found for token"}`
        * `404 Not Found`: `{"error": "User is not associated with a family."}` or
          `{"error": "Family details not found for the associated family ID."}`
        * `500 Internal Server Error`: `{"error": "Failed to retrieve user profile information."}` or
          `{"error": "Database error: <details>"}`

* **`POST /api/v1/auth/register`**
    * **Description:** Registers a new user account, creates associated family and the *first* guardian record. Requires
      email confirmation (must be enabled in Supabase). Additional guardians must be added via the dedicated guardian
      endpoints.
    * **Authorization:** None required (public endpoint).
    * **Request Body (JSON):**
      ```json
      {
        "email": "new.user@example.com",
        "password": "yourSecurePassword",
        "familyName": "New Family Name",
        "guardianFirstName": "GuardianFirst",
        "guardianLastName": "GuardianLast",
        "guardianRelationship": "Parent/Guardian", // Optional, defaults to 'Parent/Guardian'
        "guardianPhone": "555-123-9999" // Optional
      }
      ```
    * **Example Success Response (201 Created):**
      ```json
      {
        "userId": "uuid-of-new-supabase-user",
        "familyId": "uuid-of-new-family-record",
        "message": "Registration successful. Please check your email to confirm your account."
      }
      ```
    * **Example Error Responses:**
        * `400 Bad Request`: `{"error": "Missing required fields: ..."}` or `{"error": "Invalid JSON body"}` or
          `{"error": "Password must be at least 6 characters long"}`
        * `409 Conflict`: `{"error": "Email address is already registered."}`
        * `500 Internal Server Error`: `{"error": "User creation failed: <details>"}` or
          `{"error": "Database error: Failed to create family record. <details>"}` or
          `{"error": "Server configuration error"}`

* **`GET /api/v1/families/{familyId}/guardians`**
    * **Description:** Retrieves a list of all guardians associated with a specific family.
    * **Authorization:** Requires standard user authentication. User must be an admin or belong to the specified family.
    * **Example Request:**
      ```bash
      curl -X GET "https://<your-domain>/api/v1/families/YOUR_FAMILY_ID/guardians" \
           -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
      ```
    * **Example Success Response (200 OK):**
      ```json
      [
        {
          "id": "uuid-for-guardian-1",
          "created_at": "...",
          "updated_at": "...",
          "family_id": "YOUR_FAMILY_ID",
          "first_name": "John",
          "last_name": "Smith",
          "relationship": "Father",
          "email": "john.smith@example.com",
          "cell_phone": "555-111-2222",
          "home_phone": "555-123-4567",
          "work_phone": null,
          "employer": null,
          "employer_phone": null,
          "employer_notes": null
        },
        { ... } // Other guardians
      ]
      ```
    * **Example Error Responses:**
        * `401 Unauthorized`
        * `403 Forbidden`: `{"error": "Forbidden: You do not have permission to view guardians for this family."}` or
          `{"error": "Forbidden: User not found for token"}`
        * `500 Internal Server Error`

* **`POST /api/v1/families/{familyId}/guardians`**
    * **Description:** Creates a new guardian associated with a specific family.
    * **Authorization:** Requires standard user authentication. User must be an admin or belong to the specified family.
    * **Request Body (JSON):**
      ```json
      {
        "first_name": "Jane",
        "last_name": "Doe",
        "relationship": "Mother",
        "email": "jane.doe@example.com",
        "home_phone": "555-123-4567",
        "cell_phone": "555-333-4444",
        "work_phone": null,
        "employer": "Example Corp",
        "employer_phone": null,
        "employer_notes": null
      }
      ```
    * **Example Success Response (201 Created):**
      ```json
      {
        "id": "uuid-for-new-guardian",
        "created_at": "...",
        "updated_at": "...",
        "family_id": "YOUR_FAMILY_ID",
        "first_name": "Jane"
        // ... other fields
      }
      ```
    * **Example Error Responses:**
        * `400 Bad Request`: `{"error": "Invalid JSON body"}` or `{"error": "Missing required guardian fields (...)"}`
        * `401 Unauthorized`
        * `403 Forbidden`: `{"error": "Forbidden: You do not have permission to add a guardian to this family."}`
        * `409 Conflict`: `{"error": "Guardian creation failed: Duplicate entry."}` (If email or other unique constraint
          exists)
        * `500 Internal Server Error`

* **`GET /api/v1/guardians/{guardianId}`**
    * **Description:** Retrieves detailed information for a specific guardian.
    * **Authorization:** Requires standard user authentication. User must be an admin or belong to the guardian's
      family.
    * **Example Request:**
      ```bash
      curl -X GET "https://<your-domain>/api/v1/guardians/GUARDIAN_UUID" \
           -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
      ```
    * **Example Success Response (200 OK):**
      ```json
      {
        "id": "GUARDIAN_UUID",
        "created_at": "...",
        "updated_at": "...",
        "family_id": "uuid-for-family",
        "first_name": "John",
        "last_name": "Smith"
        // ... other fields
      }
      ```
    * **Example Error Responses:**
        * `401 Unauthorized`
        * `403 Forbidden`: `{"error": "Forbidden: You do not have permission to view this guardian."}`
        * `404 Not Found`: `{"error": "Guardian not found"}`
        * `500 Internal Server Error`

* **`PUT /api/v1/guardians/{guardianId}`**
    * **Description:** Updates information for a specific guardian.
    * **Authorization:** Requires standard user authentication. User must be an admin or belong to the guardian's
      family.
    * **Request Body (JSON - include only fields to update):**
      ```json
      {
        "cell_phone": "555-555-5555",
        "employer": "New Employer Inc."
      }
      ```
    * **Example Success Response (200 OK):**
      ```json
      {
        "id": "GUARDIAN_UUID",
        "created_at": "...",
        "updated_at": "...", // Should reflect update time
        "family_id": "uuid-for-family",
        "first_name": "John",
        "last_name": "Smith",
        "cell_phone": "555-555-5555", // Updated field
        "employer": "New Employer Inc." // Updated field
        // ... other fields
      }
      ```
    * **Example Error Responses:**
        * `400 Bad Request`: `{"error": "Invalid JSON body for update"}` or
          `{"error": "Invalid or empty JSON body provided for update."}`
        * `401 Unauthorized`
        * `403 Forbidden`: `{"error": "Forbidden: You do not have permission to update this guardian."}`
        * `404 Not Found`: `{"error": "Guardian not found"}`
        * `500 Internal Server Error`

* **`DELETE /api/v1/guardians/{guardianId}`**
    * **Description:** Deletes a specific guardian.
    * **Authorization:** Requires standard user authentication. User must be an admin or belong to the guardian's
      family.
    * **Example Request:**
      ```bash
      curl -X DELETE "https://<your-domain>/api/v1/guardians/GUARDIAN_UUID" \
           -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
      ```
    * **Example Success Response (200 OK):**
      ```json
      {
        "message": "Guardian deleted successfully"
      }
      ```
      *(Alternatively, could return 204 No Content with an empty body)*
    * **Example Error Responses:**
        * `401 Unauthorized`
        * `403 Forbidden`: `{"error": "Forbidden: You do not have permission to delete this guardian."}`
        * `404 Not Found`: `{"error": "Guardian not found"}`
        * `500 Internal Server Error`

* **`POST /api/discount-codes/validate`**
    * **Description:** Validates a discount code and calculates the discount amount for a specific family and context.
    * **Authorization:** Requires standard user authentication.
    * **Request Body (JSON):**
      ```json
      {
        "code": "SAVE20",
        "familyId": "uuid-for-family",
        "studentId": "uuid-for-student", // Optional, for student-specific discounts
        "applicableTo": "training", // "training", "store", or "both"
        "amount": 5000 // Amount in cents to apply discount to
      }
      ```
    * **Example Success Response (200 OK):**
      ```json
      {
        "valid": true,
        "discountAmount": 1000, // Amount in cents
        "discountCode": {
          "id": "uuid-for-discount-code",
          "code": "SAVE20",
          "name": "20% Off Training",
          "discount_type": "percentage",
          "discount_value": 20
        }
      }
      ```
    * **Example Error Responses:**
        * `400 Bad Request`: `{"error": "Invalid or expired discount code"}`
        * `401 Unauthorized`
        * `500 Internal Server Error`

* **`GET /api/available-discounts/{familyId}`**
    * **Description:** Retrieves available discount codes for a specific family, filtered by applicability and usage
      restrictions.
    * **Authorization:** Requires standard user authentication. User must be an admin or belong to the specified family.
    * **Query Parameters:**
        * `applicableTo` (optional): Filter by applicability ("training", "store", "both")
        * `studentId` (optional): Include student-specific discounts
    * **Example Request:**
      ```bash
      curl -X GET "https://<your-domain>/api/available-discounts/YOUR_FAMILY_ID?applicableTo=training" \
           -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
      ```
    * **Example Success Response (200 OK):**
      ```json
      [
        {
          "id": "uuid-for-discount-code-1",
          "code": "WELCOME10",
          "name": "Welcome Discount",
          "description": "10% off first month",
          "discount_type": "percentage",
          "discount_value": 10,
          "applicable_to": "training",
          "scope": "per_family",
          "usage_type": "one_time",
          "valid_until": "2024-12-31T23:59:59.000Z"
        }
      ]
      ```
    * **Example Error Responses:**
        * `401 Unauthorized`
        * `403 Forbidden`: `{"error": "Forbidden: You do not have permission to view discounts for this family."}`
        * `500 Internal Server Error`

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

- **Content Quality:** Ensure public-facing page content is informative, engaging, and naturally incorporates relevant
  keywords.
- **Image Alt Text:** Conduct a site-wide review to ensure all meaningful images have descriptive `alt` attributes for
  SEO and accessibility.
- **Performance (Core Web Vitals):** Analyze and optimize page load speed and responsiveness using tools like Google
  PageSpeed Insights.
- **Accessibility (A11y):** Perform comprehensive accessibility checks (keyboard navigation, color contrast, ARIA
  attributes).
- **SEO & AI Discovery Strategy:**
    - Continue enhancing embedded JSON-LD structured data (Schema.org) on all relevant public pages. This is the primary
      method for communicating structured information to search engines and AI-powered discovery tools.
    - Focus on creating high-quality, crawlable HTML content.
    - Ensure `sitemap.xml` is comprehensive and `robots.txt` is correctly configured.
    - *Note: Dedicated public JSON APIs for general AI search discovery are not planned, as embedded JSON-LD in HTML is
      the preferred and standard approach.*
- **Payment Reporting:** Enhance admin reporting for payments.
- **Error Monitoring:** Implement more robust error logging/monitoring.
- **Reviews / Testimonials:**
    - Implement a system for displaying customer reviews/testimonials (e.g., as a carousel or static quotes on relevant
      pages).
    - Add `AggregateRating` and individual `Review` schema markup to enhance search engine visibility (rich snippets).
    - **Benefits:**
        - Provide social proof and increase user trust.
        - Potentially improve click-through rates from search results.
        - Add fresh, user-generated content to the site.
    - **Note:** This should be implemented once a sufficient number of genuine reviews are available.
- **Blog / News Section:**
    - Develop a public-facing blog or news section to share insights, articles (e.g., "Benefits of Martial Arts," "
      Karate Belt System Explained"), and updates.
    - Implement an admin interface for creating, editing, and managing blog posts.
    - **Benefits:**
        - Provide fresh, relevant content for SEO.
        - Target a wider range of keywords.
        - Establish topical authority.
        - Create internal linking opportunities.
        - Generate shareable content.
        - Proactively answer user questions.
- **In-App Messaging Enhancements (Potential Future Work):**
    - Implement file attachments for messages.
    - Add in-app notifications (e.g., toast messages) for new messages.
    - Implement search functionality for conversations/messages.
