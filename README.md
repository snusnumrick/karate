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
    - Secure, embedded payment form using Stripe Elements (`/pay/:paymentId`).
    - Multiple payment options initiated from Family Portal (`/family/payment`): Monthly Group, Yearly Group, Individual Sessions (purchased in quantities).
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
- **Payments**: Stripe integration using Payment Intents and Stripe Elements (`@stripe/react-stripe-js`, `@stripe/stripe-js`).
- **Deployment**: Cloud-based deployment solutions (e.g., Vercel or Netlify).

## Customization Guide

- **Site Configuration:** Basic site details (name, instructor info, class schedule, location, pricing tiers) are managed in `app/config/site.ts`.
- **Styling:** Uses Tailwind CSS and Shadcn UI components. Customize Tailwind configuration in `tailwind.config.ts` and component styles within `app/components/ui/`.
- **Pricing Logic:** Payment tier calculation logic is within the payment initiation route (`/family/payment`). Payment completion happens on `/pay/:paymentId`. Pricing values are in `app/config/site.ts`. Eligibility logic (handling monthly/yearly) is in `app/utils/supabase.server.ts`.
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
    - For webhook testing locally, install the Stripe CLI (`brew install stripe/stripe-cli/stripe`). Set a webhook secret in `.env`. Use `stripe listen --forward-to localhost:<PORT>/api/webhooks/stripe` to forward events.
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
        - URL: `https://<your-vercel-domain>/api/webhooks/stripe` (*Confirm this is the correct webhook route*)
        - Select the events your application listens for (primarily `payment_intent.succeeded`, `payment_intent.payment_failed`).
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
    - `app/components/`: Shared React components (UI elements, layout parts).
    - `app/utils/`: Utility functions (database interactions, email sending, helpers).
    - `app/config/`: Site-wide configuration.
    - `app/types/`: TypeScript type definitions (including `database.types.ts`).
    - `app/routes/api.create-payment-intent.ts`: Backend endpoint for Stripe Payment Intent creation.
    - `app/routes/api.webhooks.stripe.ts`: Handles incoming Stripe webhook events.
    - **Note:** While dedicated API routes exist for specific tasks, much of the core backend logic (data fetching, mutations) is handled within the `loader` and `action` functions of the standard Remix routes (`app/routes/`), serving as endpoints for the web UI itself rather than standalone APIs.
    - `supabase/functions/`: Serverless edge functions (e.g., for scheduled tasks).
        - `supabase/functions/_shared/`: Code shared between edge functions (like database types, email client).
- **UI:** Built with [Shadcn UI](https://ui.shadcn.com/) on top of Tailwind CSS. Use `npx shadcn-ui@latest add <component>` to add new components consistently.
- **Database:** Supabase PostgreSQL. Schema definitions can be inferred from `app/types/database.types.ts` or Supabase Studio. See `app/db/supabase-setup.sql` for idempotent setup script.
- **Types:** Database types are generated using the Supabase CLI (see Setup). Ensure `supabase/functions/_shared/database.types.ts` and `app/types/database.types.ts` are kept in sync.
- **Environment Variables:** Managed via `.env` locally and platform environment variables in production (see Deployment). Use `.env.example` as a template.
- **Email:** Uses Resend for transactional emails. See `app/utils/email.server.ts` and function-specific email logic.

### External API (v1)

A versioned API is available for external consumption (e.g., by an AI server or other applications).

- **Base Path:** `/api/v1`
- **Authentication:** All API endpoints require a valid Supabase JWT passed in the `Authorization` header as a Bearer token (`Authorization: Bearer <YOUR_SUPABASE_JWT>`). Clients must first authenticate with Supabase (e.g., using email/password) to obtain a token.
- **Authorization:** Most endpoints currently require the authenticated user to have an 'admin' role (defined in Supabase user metadata). This may be adjusted per endpoint in the future.
- **Format:** Requests and responses use JSON.
- **Error Handling:** Errors are returned as JSON objects with an `error` key and appropriate HTTP status codes (e.g., 400, 401, 403, 404, 500).

**Available Endpoints:**

*   **`GET /api/v1/families/{familyId}`**
    *   **Description:** Retrieves detailed information for a specific family, including students and their 1:1 session balance. Guardians should be fetched separately using the `/api/v1/families/{familyId}/guardians` endpoint.
    *   **Authorization:** Requires `admin` role.
    *   **Example Request:**
        ```bash
        curl -X GET "https://<your-domain>/api/v1/families/YOUR_FAMILY_ID" \
             -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
        ```
    *   **Example Success Response (200 OK):**
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
    *   **Example Error Responses:**
        *   `401 Unauthorized`: `{"error": "Unauthorized: Missing or invalid Bearer token"}`
        *   `403 Forbidden`: `{"error": "Forbidden: Requires 'admin' role."}` or `{"error": "Forbidden: User not found for token"}`
        *   `404 Not Found`: `{"error": "Family not found"}`
        *   `500 Internal Server Error`: `{"error": "Database error: <details>"}` or `{"error": "An unknown server error occurred."}`

*   **`GET /api/v1/students/{studentId}`**
    *   **Description:** Retrieves detailed information for a specific student, including family info, belt rank, and 1:1 session details.
    *   **Authorization:** Requires `admin` role.
    *   *(Details like example request/response can be added here)*

*   **`GET /api/v1/family/me`**
    *   **Description:** Retrieves detailed information for the *currently authenticated user's* family, including students and 1:1 session balance. Guardians should be fetched separately using the `/api/v1/families/{familyId}/guardians` endpoint (where `familyId` is obtained from this response or the user's profile).
    *   **Authorization:** Requires standard user authentication (Bearer token). No specific role needed.
    *   **Example Request:**
        ```bash
        curl -X GET "https://<your-domain>/api/v1/family/me" \
             -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
        ```
    *   **Example Success Response (200 OK):**
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
    *   **Example Error Responses:**
        *   `401 Unauthorized`: `{"error": "Unauthorized: Missing or invalid Bearer token"}`
        *   `403 Forbidden`: `{"error": "Forbidden: User not found for token"}`
        *   `404 Not Found`: `{"error": "User is not associated with a family."}` or `{"error": "Family details not found for the associated family ID."}`
        *   `500 Internal Server Error`: `{"error": "Failed to retrieve user profile information."}` or `{"error": "Database error: <details>"}`

*   **`POST /api/v1/auth/register`**
    *   **Description:** Registers a new user account, creates associated family and the *first* guardian record. Requires email confirmation (must be enabled in Supabase). Additional guardians must be added via the dedicated guardian endpoints.
    *   **Authorization:** None required (public endpoint).
    *   **Request Body (JSON):**
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
    *   **Example Success Response (201 Created):**
        ```json
        {
          "userId": "uuid-of-new-supabase-user",
          "familyId": "uuid-of-new-family-record",
          "message": "Registration successful. Please check your email to confirm your account."
        }
        ```
    *   **Example Error Responses:**
        *   `400 Bad Request`: `{"error": "Missing required fields: ..."}` or `{"error": "Invalid JSON body"}` or `{"error": "Password must be at least 6 characters long"}`
        *   `409 Conflict`: `{"error": "Email address is already registered."}`
        *   `500 Internal Server Error`: `{"error": "User creation failed: <details>"}` or `{"error": "Database error: Failed to create family record. <details>"}` or `{"error": "Server configuration error"}`

*   **`GET /api/v1/families/{familyId}/guardians`**
    *   **Description:** Retrieves a list of all guardians associated with a specific family.
    *   **Authorization:** Requires standard user authentication. User must be an admin or belong to the specified family.
    *   **Example Request:**
        ```bash
        curl -X GET "https://<your-domain>/api/v1/families/YOUR_FAMILY_ID/guardians" \
             -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
        ```
    *   **Example Success Response (200 OK):**
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
    *   **Example Error Responses:**
        *   `401 Unauthorized`
        *   `403 Forbidden`: `{"error": "Forbidden: You do not have permission to view guardians for this family."}` or `{"error": "Forbidden: User not found for token"}`
        *   `500 Internal Server Error`

*   **`POST /api/v1/families/{familyId}/guardians`**
    *   **Description:** Creates a new guardian associated with a specific family.
    *   **Authorization:** Requires standard user authentication. User must be an admin or belong to the specified family.
    *   **Request Body (JSON):**
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
    *   **Example Success Response (201 Created):**
        ```json
        {
          "id": "uuid-for-new-guardian",
          "created_at": "...",
          "updated_at": "...",
          "family_id": "YOUR_FAMILY_ID",
          "first_name": "Jane",
          // ... other fields
        }
        ```
    *   **Example Error Responses:**
        *   `400 Bad Request`: `{"error": "Invalid JSON body"}` or `{"error": "Missing required guardian fields (...)"}`
        *   `401 Unauthorized`
        *   `403 Forbidden`: `{"error": "Forbidden: You do not have permission to add a guardian to this family."}`
        *   `409 Conflict`: `{"error": "Guardian creation failed: Duplicate entry."}` (If email or other unique constraint exists)
        *   `500 Internal Server Error`

*   **`GET /api/v1/guardians/{guardianId}`**
    *   **Description:** Retrieves detailed information for a specific guardian.
    *   **Authorization:** Requires standard user authentication. User must be an admin or belong to the guardian's family.
    *   **Example Request:**
        ```bash
        curl -X GET "https://<your-domain>/api/v1/guardians/GUARDIAN_UUID" \
             -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
        ```
    *   **Example Success Response (200 OK):**
        ```json
        {
          "id": "GUARDIAN_UUID",
          "created_at": "...",
          "updated_at": "...",
          "family_id": "uuid-for-family",
          "first_name": "John",
          "last_name": "Smith",
          // ... other fields
        }
        ```
    *   **Example Error Responses:**
        *   `401 Unauthorized`
        *   `403 Forbidden`: `{"error": "Forbidden: You do not have permission to view this guardian."}`
        *   `404 Not Found`: `{"error": "Guardian not found"}`
        *   `500 Internal Server Error`

*   **`PUT /api/v1/guardians/{guardianId}`**
    *   **Description:** Updates information for a specific guardian.
    *   **Authorization:** Requires standard user authentication. User must be an admin or belong to the guardian's family.
    *   **Request Body (JSON - include only fields to update):**
        ```json
        {
          "cell_phone": "555-555-5555",
          "employer": "New Employer Inc."
        }
        ```
    *   **Example Success Response (200 OK):**
        ```json
        {
          "id": "GUARDIAN_UUID",
          "created_at": "...",
          "updated_at": "...", // Should reflect update time
          "family_id": "uuid-for-family",
          "first_name": "John",
          "last_name": "Smith",
          "cell_phone": "555-555-5555", // Updated field
          "employer": "New Employer Inc.", // Updated field
          // ... other fields
        }
        ```
    *   **Example Error Responses:**
        *   `400 Bad Request`: `{"error": "Invalid JSON body for update"}` or `{"error": "Invalid or empty JSON body provided for update."}`
        *   `401 Unauthorized`
        *   `403 Forbidden`: `{"error": "Forbidden: You do not have permission to update this guardian."}`
        *   `404 Not Found`: `{"error": "Guardian not found"}`
        *   `500 Internal Server Error`

*   **`DELETE /api/v1/guardians/{guardianId}`**
    *   **Description:** Deletes a specific guardian.
    *   **Authorization:** Requires standard user authentication. User must be an admin or belong to the guardian's family.
    *   **Example Request:**
        ```bash
        curl -X DELETE "https://<your-domain>/api/v1/guardians/GUARDIAN_UUID" \
             -H "Authorization: Bearer <YOUR_SUPABASE_JWT>"
        ```
    *   **Example Success Response (200 OK):**
        ```json
        {
          "message": "Guardian deleted successfully"
        }
        ```
        *(Alternatively, could return 204 No Content with an empty body)*
    *   **Example Error Responses:**
        *   `401 Unauthorized`
        *   `403 Forbidden`: `{"error": "Forbidden: You do not have permission to delete this guardian."}`
        *   `404 Not Found`: `{"error": "Guardian not found"}`
        *   `500 Internal Server Error`


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
