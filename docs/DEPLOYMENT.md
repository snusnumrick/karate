# Deployment Guide

This guide covers deploying the karate class management system to production environments.

## Table of Contents

- [Supabase Deployment](#supabase-deployment)
- [Vercel Deployment](#vercel-deployment)
- [Environment Variables](#environment-variables)
- [Push Notifications Setup](#push-notifications-setup)
- [Production Configuration](#production-configuration)

## Supabase Deployment

### Automated Script Deployment

Use the included deployment script for easy Supabase component deployment:

```bash
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

**Prerequisites:**
- `curl`, `jq`, and `supabase` CLI must be installed
- Valid Supabase access token with project permissions
- Supabase project linked (script will attempt to link automatically)

### GitHub Actions (Automated)

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

### Individual Component Deployment

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

### Manual Dashboard Setup

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

## Vercel Deployment

### Basic Setup

1. **Push to Git:** Ensure your code is pushed to a Git repository (GitHub, GitLab, Bitbucket)
2. **Import Project:** In Vercel, import the project from your Git repository
3. **Configure Build Settings:** Vercel should automatically detect Remix. Default settings are usually sufficient
4. **Deploy:** Trigger a deployment in Vercel

### Vercel Configuration

After deployment:
- Go to **Project Settings** > **Functions** > **Function Max Duration**
- Increase the Function Max Duration to **60 seconds** to prevent timeout issues with the `/admin/db-chat` feature

## Environment Variables

Add the following environment variables in your deployment platform:

### Required Variables

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your project's anon/public key
- `SUPABASE_SERVICE_ROLE_KEY`: Your project's service role key (keep secret)
- `VITE_SITE_URL`: Your production website URL (e.g., `https://www.yourdomain.com`)

### Payment Integration

- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret

### Email Service

- `RESEND_API_KEY`: Resend API key for transactional emails
- `FROM_EMAIL`: Sender email address (e.g., `"Your Name <you@yourdomain.com>"`)

### AI Features

- `GEMINI_API_KEY`: Required for Admin DB Chat feature

### Database Connection (Optional)

For Admin DB Chat feature:
- `DB_USER`: Database username
- `DB_HOST`: Database host
- `DB_NAME`: Database name (usually `postgres`)
- `DB_PASSWORD`: Database password
- `DB_URL`: Complete JDBC connection string

## Push Notifications Setup

Push notifications require VAPID (Voluntary Application Server Identification) keys:

### Environment Variables

- `VAPID_PUBLIC_KEY`: VAPID public key
- `VAPID_PRIVATE_KEY`: VAPID private key (keep secret)
- `VAPID_SUBJECT`: Contact email (e.g., `mailto:admin@yourdomain.com`)

### Generating VAPID Keys

#### Option 1: Using the Built-in Script (Recommended)

```bash
node scripts/generate-vapid-keys.js
```

#### Option 2: Using web-push CLI

```bash
npm install -g web-push
web-push generate-vapid-keys
```

#### Option 3: Using npx

```bash
npx web-push generate-vapid-keys
```

### Important Notes

- **Security:** Keep your `VAPID_PRIVATE_KEY` secret
- **Consistency:** Use the same VAPID keys across all environments
- **Key Regeneration:** Regenerating keys invalidates all existing subscriptions
- **Backup:** Store keys securely as losing them requires user re-subscription

### Verifying Push Notifications

1. **Admin Test:** Visit `/admin/account` and test push notifications
2. **Family Test:** Have a family member enable notifications in `/family/account`
3. **Browser Console:** Check for VAPID-related errors
4. **Server Logs:** Monitor deployment logs for delivery confirmations

## Production Configuration

### Supabase Production Setup

1. **Enable Realtime (for Messaging):**
   - Go to Database → Replication
   - Enable realtime for `conversations` and `messages` tables

2. **Resend Domain Verification:**
   - Verify your domain with Resend for email delivery

3. **Deploy Supabase Edge Functions:**
   ```bash
   supabase functions deploy payment-reminder
   supabase functions deploy missing-waiver-reminder
   supabase functions deploy sync-pending-payments
   ```

4. **Schedule Functions using pg_cron:**
   - Set up automated scheduling for reminder functions
   - Configure payment synchronization schedules

5. **Authentication Settings:**
   - Ensure "Confirm email" is **enabled** for production
   - Set up database backups

### Stripe Webhook Configuration

1. Get your production URL after deployment
2. In Stripe Dashboard, go to Developers → Webhooks
3. Add endpoint:
   - URL: `https://<your-domain>/api/webhooks/stripe`
   - Select events:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
   - Use the `STRIPE_WEBHOOK_SECRET` from your environment variables

### Tax Configuration

1. Ensure the `tax_rates` table contains correct tax rates (GST, PST_BC)
2. Mark appropriate rates as `is_active = true`
3. Verify `applicableTaxNames` in `app/config/site.ts` matches active taxes
4. Note: Stripe Tax configuration in dashboard is **not** used for calculation

## Troubleshooting

### Common Issues

- **Function Timeouts:** Increase Vercel function duration to 60 seconds
- **Push Notification Failures:** Verify VAPID keys and subject configuration
- **Email Delivery Issues:** Check Resend domain verification and API key
- **Database Connection Errors:** Verify Supabase connection strings and permissions

### Monitoring

- Monitor Vercel function logs for errors
- Check Supabase logs for database and function issues
- Use Stripe dashboard for payment monitoring
- Monitor Resend dashboard for email delivery status