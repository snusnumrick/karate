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

## Third-Party Services

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