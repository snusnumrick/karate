# Development Guide

This guide covers the complete development setup and workflow for the karate school management system.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Third-Party Services](#third-party-services)
- [Development Workflow](#development-workflow)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting development, ensure you have the following installed:

- **Node.js**: Version 22-24 (see `engines` in package.json)
- **npm**: Latest version (comes with Node.js)
- **Git**: For version control
- **Supabase CLI**: For database management and type generation
- **Stripe CLI**: For webhook testing (optional)

### Installing Prerequisites

```bash
# Install Node.js (using nvm recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22

# Install Supabase CLI
npm install -g supabase

# Install Stripe CLI (optional, for webhook testing)
brew install stripe/stripe-cli/stripe
```

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

## Environment Configuration

Edit the `.env` file with your configuration values:

### Core Configuration

```env
# Site URL (Used in email links, meta tags, sitemap, etc.)
VITE_SITE_URL=http://localhost:5173

# Session secret used for cookie signing and CSRF protection
SESSION_SECRET=change-me-to-a-long-random-string
```

Generate a strong secret (at least 32 characters) before running the app in any shared environment:

```bash
openssl rand -hex 32
```

### Supabase Configuration

Get these values from your Supabase project dashboard (Project Settings → API):

```env
# Supabase
SUPABASE_URL=https://yourprojectref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Database Connection (Required for Admin DB Chat)

Get these from Supabase Dashboard → Database → Connection info:

```env
# Direct Database Connection (Required for Admin DB Chat feature)
DB_USER=postgres.yourprojectref
DB_HOST=aws-0-region.pooler.supabase.com
DB_NAME=postgres
DB_PASSWORD=your-db-password
```

### Stripe Configuration (Optional for Local Development)

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_ENVIRONMENT=test
```

### Square Configuration (Optional)

If you plan to test the Square provider locally, add the following values. All keys can be generated from the Square developer dashboard.

```env
# Square Configuration
SQUARE_ACCESS_TOKEN=EAAAExxxxxxxxxxxxxxxxxxxxxxxx  # Sandbox access token
SQUARE_LOCATION_ID=LRxxxxxxxxxxxxxxx              # Sandbox location ID
SQUARE_APPLICATION_ID=sandbox-sq0idb-xxxxxxxxxx   # Sandbox application ID
SQUARE_ENVIRONMENT=sandbox                        # Must be "sandbox" for development
```

**Currency Configuration:**
Currency is automatically configured from `app/config/site.ts` → `localization.currency` (currently set to `CAD`). Ensure your Square merchant account supports CAD payments.

**Getting Square Credentials:**
1. Create a Square Developer account at https://developer.squareup.com/
2. Create a new application in the Square Developer Dashboard
3. Navigate to your application → Credentials
4. Copy the **Sandbox** Application ID and Access Token
5. Find your **Sandbox** Location ID in the Locations section

**Important Notes:**
- Always use **sandbox** credentials for development
- Production credentials (`sq0idp-*` Application IDs) should only be used in production
- Switch the active provider by updating `siteConfig.payments.provider` in `app/config/site.ts`

**Validate Configuration:**
```bash
npm run validate:square
```

### Email Configuration (Optional for Local Development)

```env
# Resend Email Configuration
RESEND_API_KEY=your-resend-api-key
FROM_EMAIL="Your Name <you@yourdomain.com>"
```

### AI Configuration (Required for Admin DB Chat)

```env
# Google Gemini API Key (for Admin DB Chat)
GEMINI_API_KEY=your-gemini-api-key
```

### Push Notifications Configuration

Generate VAPID keys for push notifications:

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys
```

Add the generated keys to your `.env`:

```env
# Push Notifications (VAPID Keys)
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:your-email@example.com
```

## Database Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be fully provisioned
3. Note your project URL and API keys

### 2. Configure Authentication

1. Navigate to **Authentication → Providers**
2. Enable the "Email" provider
3. Navigate to **Authentication → Settings**
4. **Disable "Confirm email"** for easier local testing (enable for production)

### 3. Run Database Setup Script

1. Navigate to **Database → SQL Editor**
2. Create a new query
3. Copy and paste the entire contents of `app/db/supabase-setup.sql`
4. Execute the script

This script creates:
- All necessary tables and types
- Row Level Security (RLS) policies
- Database functions
- Triggers for automated functionality

### 4. Create Storage Bucket

1. Navigate to **Storage**
2. Click "Create bucket"
3. Name: `product-images`
4. Make it **Public** for easier image display
5. Configure upload policies if needed

### 5. Enable Realtime (For Messaging)

1. Navigate to **Database → Replication**
2. Under "Source", click the number link next to `supabase_realtime`
3. Find `conversations` and `messages` tables
4. Enable the "Realtime" toggle for both tables

### 6. Generate TypeScript Types

```bash
# Login to Supabase CLI
npx supabase login

# Link your project
npx supabase link --project-ref YOUR_PROJECT_ID

# Generate types
npx supabase gen types typescript --linked --schema public > supabase/functions/_shared/database.types.ts

# Copy types for frontend use
cp supabase/functions/_shared/database.types.ts app/types/database.types.ts
```

**⚠️ Important**: After generating types, ensure that auto-calculated invoice fields are marked as `readonly` in your custom TypeScript types. The following invoice fields are automatically updated by database triggers and should not be directly modified by application code:

- `subtotal` / `subtotal_cents`
- `tax_amount` / `tax_amount_cents` 
- `discount_amount` / `discount_amount_cents`
- `total_amount` / `total_amount_cents`
- `amount_paid` / `amount_paid_cents`
- `amount_due` / `amount_due_cents`

The canonical invoice types live in <mcfile name="invoice.ts" path="app/types/invoice.ts"></mcfile>, which includes examples of correctly typed readonly fields managed by database triggers.

## Third-Party Services

### Square Setup (Optional)

1. Create a Square developer account and create an application.
2. Generate a Sandbox Access Token and Webhook Signature Key.
3. Create or locate a Sandbox Location and copy its ID.
4. **Important**: If using OAuth, ensure the access token is generated for the specific location you plan to use (OAuth tokens are location-specific).
5. Update the `.env` file with the values listed in the [Square Configuration](#square-configuration-optional) section.
6. Register a webhook endpoint (e.g., `https://your-domain.com/api/webhooks/square`) in the Square developer dashboard so payment confirmations reach the app.
7. Set `siteConfig.payments.provider` to `'square'` when you want the app to use Square.

### Stripe Setup (Optional for Local Development)

1. Create account at [stripe.com](https://stripe.com)
2. Get your test API keys from the dashboard
3. For webhook testing:
   ```bash
   # Login to Stripe CLI
   stripe login
   
   # Forward webhooks to local server
   stripe listen --forward-to localhost:5173/api/webhooks/stripe --events payment_intent.succeeded,payment_intent.payment_failed
   ```

### Resend Setup (Optional for Local Development)

1. Create account at [resend.com](https://resend.com)
2. Get your API key
3. Verify your sending domain (for production)
4. Set `FROM_EMAIL` to a verified email address

### Google Gemini API Setup (Required for Admin DB Chat)

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Add it to your `.env` as `GEMINI_API_KEY`

## Development Workflow

### Starting Development Server

```bash
# Standard development mode
npm run dev

# Strict CSP development mode (for testing security policies)
npm run dev:strict
```

The development server will start at `http://localhost:5173`

### Development Features

- **Hot Module Replacement (HMR)**: Automatic page refresh on code changes
- **TypeScript**: Full TypeScript support with type checking
- **Tailwind CSS**: Utility-first CSS framework with JIT compilation
- **ESLint**: Code linting and formatting
- **Vite**: Fast build tool and development server

### Code Quality

```bash
# Run linting
npm run lint

# Run TypeScript type checking
npm run typecheck

# Check Supabase function types
npm run typecheck:deno
```

### SEO & Structured Data (JSON‑LD)

- Use the `JsonLd` utility to render structured data with CSP nonce automatically.
- Example:

```tsx
import { JsonLd } from "~/components/JsonLd";

export default function Page() {
    const data = { "@context": "https://schema.org", "@type": "Organization", name: "GREENEGIN KARATE" };
    return <JsonLd data={data} />; // Nonce is taken from NonceProvider
}
```

- If needed, override nonce: `<JsonLd data={data} nonce={myNonce} />`.

## Available Scripts

### Development Scripts

```bash
# Start development server
npm run dev

# Start with strict CSP (Content Security Policy)
npm run dev:strict

# Run linting
npm run lint

# Type checking
npm run typecheck

# Type check Supabase functions
npm run typecheck:deno

# Validate Square Web Payments SDK configuration
npm run validate:square
```

### Build Scripts

```bash
# Build for production
npm run build

# Start production server locally
npm run start
```

### Documentation Scripts

```bash
# Generate Mermaid diagrams from README
npm run render-mermaid
```

## Project Structure

```
karate/
├── app/                          # Main application code
│   ├── components/              # Reusable React components
│   │   ├── ui/                 # Shadcn UI components
│   │   ├── PWAInstallPrompt.tsx # PWA installation prompts
│   │   ├── ServiceWorkerRegistration.tsx # SW management
│   │   └── NotificationSettings.tsx # Notification preferences
│   ├── config/                 # Configuration files
│   │   └── site.ts            # Main site configuration
│   ├── db/                    # Database setup and migrations
│   │   └── supabase-setup.sql # Database schema and setup
│   ├── routes/                # Remix route modules
│   │   ├── admin.*.tsx       # Admin dashboard routes
│   │   ├── family.*.tsx      # Family portal routes
│   │   ├── api.*.tsx         # API endpoints
│   │   └── _layout.*.tsx     # Layout routes
│   ├── services/             # Server-side business logic
│   │   ├── program.server.ts # Program management
│   │   ├── class.server.ts   # Class management
│   │   └── enrollment.server.ts # Enrollment logic
│   ├── types/                # TypeScript type definitions
│   │   ├── database.types.ts # Generated Supabase types
│   │   └── multi-class.ts    # Multi-class system types
│   └── utils/                # Utility functions
│       ├── supabase.server.ts # Server-side Supabase client
│       ├── push-notifications.client.ts # Client push notifications
│       └── push-notifications.server.ts # Server push notifications
├── docs/                        # Documentation
│   ├── API.md                  # API documentation
│   ├── ARCHITECTURE.md         # Technical architecture
│   ├── CUSTOMIZATION.md        # Customization guide
│   ├── DEPLOYMENT.md           # Deployment instructions
│   └── DEVELOPMENT.md          # This file
├── public/                      # Static assets
│   ├── icons/                  # PWA icons
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker
├── scripts/                     # Build and deployment scripts
│   └── deploy-supabase.sh      # Supabase deployment script
├── supabase/                    # Supabase configuration
│   ├── functions/              # Edge functions
│   │   ├── payment-reminder/   # Payment reminder function
│   │   ├── missing-waiver-reminder/ # Waiver reminder function
│   │   └── sync-pending-payments/ # Payment sync function
│   └── email_templates/        # Email template sources
└── tailwind.config.js          # Tailwind CSS configuration
```

### Key Directories

- **`app/routes/`**: Contains all page routes and API endpoints
- **`app/components/`**: Reusable UI components
- **`app/services/`**: Server-side business logic and data access
- **`app/utils/`**: Utility functions and helpers
- **`supabase/functions/`**: Serverless edge functions
- **`public/`**: Static assets and PWA files

## Testing

### Manual Testing

1. **Authentication Flow**:
    - Sign up new users
    - Login/logout functionality
    - Password reset

2. **Family Portal**:
    - Student registration
    - Payment processing
    - Waiver submission
    - Messaging system

3. **Admin Dashboard**:
    - Student management
    - Class scheduling
    - Payment tracking
    - Messaging

4. **PWA Features**:
    - Installation prompts
    - Offline functionality
    - Push notifications

### Automated Testing

The project includes Playwright for end-to-end testing:

```bash
# Install Playwright browsers
npx playwright install

# Run tests (when test files are created)
npx playwright test
```

## Troubleshooting

### Common Issues

#### 1. Supabase Connection Issues

**Problem**: Cannot connect to Supabase
**Solution**:
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Check if Supabase project is fully provisioned
- Ensure no trailing slashes in URLs

#### 2. Database Schema Issues

**Problem**: Tables or functions missing
**Solution**:
- Re-run the `app/db/supabase-setup.sql` script
- Check Supabase logs for SQL errors
- Verify RLS policies are properly configured

#### 3. Type Generation Issues

**Problem**: TypeScript types are outdated
**Solution**:
```bash
# Regenerate types
npx supabase gen types typescript --linked --schema public > app/types/database.types.ts
```

#### 4. Push Notification Issues

**Problem**: Push notifications not working
**Solution**:
- Verify VAPID keys are correctly generated and set
- Check browser permissions for notifications
- Ensure HTTPS in production (required for push notifications)
- Verify service worker registration

#### 5. CSP (Content Security Policy) Issues

**Problem**: Scripts blocked by CSP
**Solution**:
- Check browser console for CSP violations
- Verify nonce generation and propagation
- Use `npm run dev:strict` to test CSP in development

#### 6. Email Sending Issues

**Problem**: Emails not being sent
**Solution**:
- Verify Resend API key and FROM_EMAIL
- Check domain verification in Resend
- Review Supabase Edge Function logs

#### 7. Square Payment Issues

**Problem**: Square Web SDK not loading or payments failing
**Solution**:
```bash
# Validate Square configuration
npm run validate:square
```
- Verify all environment variables are set correctly
- Ensure using sandbox credentials for development
- Check browser console for CSP violations
- Verify HTTPS is used (required for Square Web SDK)
- Test with Square test card: 4111 1111 1111 1111

**Problem**: Square configuration validation errors
**Solution**:
- Sandbox Application ID must start with `sandbox-`
- Production Application ID must start with `sq0idp-`
- Access tokens should start with `EAAAE`
- Environment must be exactly `sandbox` or `production`

**Problem**: `InvalidApplicationIdError: The Payment 'applicationId' option is not in the correct format`
**Solution**:
- This is a known issue with newer Square Web SDK versions (2.1.0+)
- **Downgrade Square API version**: Use `2025-02-20` or earlier in package.json
- Check application ID type mismatch:
  - Backend API calls: `sandbox-sq0idb-...` (server-side)
  - Web Payments SDK: `sandbox-sq0idp-...` (client-side)
- You may need separate application IDs for different Square services

**Problem**: Multiple card input elements appearing
**Solution**:
- This can occur after fixing application ID issues
- Refresh the page to clear duplicate elements
- Check for React component re-rendering issues

**Problem**: `Not authorized to take payments with location_id=...`
**Solution**:
- **OAuth Access Tokens are Location-Specific**: Square OAuth generates different access tokens for different locations
- Access token and location ID are from different Square applications
- **Check Square OAuth Flow**: If using OAuth, ensure the access token was generated for the specific location you're trying to use
- Verify all credentials (Application ID, Access Token, Location ID) are from the **same Square application**
- Ensure all credentials are from the same environment (sandbox vs production)
- **Generate location-specific credentials**: Each location may require its own access token when using OAuth

**Problem**: Payment redirects to home page instead of success page
**Solution**:
- Check payment provider success URL configuration
- For Stripe: Ensure `return_url` includes `payment_intent={PAYMENT_INTENT_ID}` parameter
- For Square: Verify payment completion redirects to appropriate success route
- **Smart Payment Success Routing**: The system uses dual routing for success pages:
  - `/payment/success` - General success page for non-family users (event registrations, etc.)
  - `/family/payment/success/{paymentId}` - Family-specific success page with enhanced UX
  - The general route automatically redirects family payments to the family route for better experience

#### 8. Payment Success Page Routing

The application implements a smart payment success routing system to handle both family and non-family payment flows:

**Route Structure**:
- **General Route**: `/payment/success?payment_intent=pi_xxx`
  - Used for non-family payments (public event registrations, guest purchases)
  - Automatically detects if payment belongs to a family
  - Redirects family payments to family-specific route for better UX

- **Family Route**: `/family/payment/success/{paymentId}?payment_intent=pi_xxx`
  - Enhanced family-specific success page
  - Shows family context and additional family-related information
  - Direct route for family-initiated payments

**Implementation Logic**:
```typescript
// In _layout.payment.success.tsx
if (payment.family_id) {
  // Redirect family payments to family-specific success page
  throw redirect(`/family/payment/success/${payment.id}?payment_intent=${paymentIntentId}`);
}
// Otherwise, show general success page for non-family users
```

**When to Use Each Route**:
- **Family Route**: Family store purchases, family event registrations, family membership payments
- **General Route**: Public event registrations, guest purchases, non-family transactions

**Provider Configuration**:
- **Stripe**: Configure `return_url` to point to `/payment/success?payment_intent={PAYMENT_INTENT_ID}`
- **Square**: Configure success redirect to `/family/payment/success/{payment.id}` for family payments
- Both providers support the smart routing system through the general route
- Check that the location is active and configured for payment processing

### Development Tips

1. **Use Browser DevTools**: Essential for debugging React components and network requests
2. **Check Supabase Logs**: Monitor real-time logs in Supabase dashboard
3. **Monitor Network Tab**: Watch API calls and responses
4. **Use React DevTools**: Install browser extension for React debugging
5. **Enable Verbose Logging**: Set appropriate log levels for debugging

### Environment-Specific Issues

#### Development Environment
- Hot reloading may cause state issues - refresh if needed
- CSP is more permissive - test with `dev:strict` for production-like behavior
- Database changes require type regeneration

#### Production Environment
- Ensure all environment variables are set
- Verify domain configurations (Resend, Stripe)
- Check HTTPS requirements for PWA and push notifications
- Monitor function timeouts and memory usage

### Getting Help

1. **Check Documentation**: Review other docs in the `/docs` folder
2. **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
3. **Remix Docs**: [remix.run/docs](https://remix.run/docs)
4. **Stripe Docs**: [stripe.com/docs](https://stripe.com/docs)
5. **Tailwind Docs**: [tailwindcss.com/docs](https://tailwindcss.com/docs)

### Performance Considerations

- **Database Queries**: Use proper indexing and avoid N+1 queries
- **Image Optimization**: Compress images before upload
- **Bundle Size**: Monitor JavaScript bundle size
- **Caching**: Leverage browser and CDN caching
- **PWA**: Implement proper caching strategies

### Security Best Practices

- **Environment Variables**: Never commit secrets to version control
- **RLS Policies**: Ensure proper Row Level Security in Supabase
- **Input Validation**: Validate all user inputs
- **CSP**: Maintain strict Content Security Policy
- **HTTPS**: Always use HTTPS in production
- **API Keys**: Rotate keys regularly and use least privilege principle

#### CSRF Protection Implementation

The application implements comprehensive CSRF protection. Here's how to work with it:

**Server-side Setup** (`app/utils/csrf.server.ts`):
```typescript
import { CSRF } from "remix-utils/csrf/server";
import { createCookie } from "@remix-run/node";

// CSRF instance is already configured with secure cookies
export const csrf = new CSRF({
    cookie: csrfCookie, // HTTP-only, secure, SameSite=lax
});
```

**Adding CSRF to Forms**:
1. Import the AuthenticityTokenInput component:
```typescript
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
```

2. Add the token input to your form:
```tsx
<form method="post">
    <AuthenticityTokenInput />
    {/* Your form fields */}
</form>
```

**Validating CSRF in Actions**:
```typescript
import { csrf } from "~/utils/csrf.server";

export async function action({ request }: ActionFunctionArgs) {
    try {
        // Validate CSRF token first
        await csrf.validate(request);
    } catch (error) {
        console.error('CSRF validation failed:', error);
        throw new Response("Invalid CSRF token", { status: 403 });
    }

    // Process your form data
    const formData = await request.formData();
    // ... rest of your action logic
}
```

**Providing CSRF Tokens in Loaders** (when needed):
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
    const [csrfToken, csrfCookieHeader] = await csrf.commitToken(request);

    return json(
        { data: yourData, csrfToken },
        { headers: csrfCookieHeader ? { "Set-Cookie": csrfCookieHeader } : {} }
    );
}
```

**JavaScript Form Submissions**:
For dynamic form submissions, include the CSRF token:
```typescript
const { csrfToken } = useLoaderData<typeof loader>();

const handleSubmit = async (formData: FormData) => {
    // Add CSRF token to form data
    const tokenValue = Array.isArray(csrfToken) ? csrfToken[1] : csrfToken;
    formData.append("csrf", tokenValue);

    // Submit form
    submit(formData, { method: "post" });
};
```

**Testing CSRF Protection**:
- All forms should include `<AuthenticityTokenInput />`
- All actions should call `await csrf.validate(request)`
- Test with browser dev tools by removing/modifying CSRF tokens
- Verify 403 responses for invalid tokens
