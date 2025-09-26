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
- `SESSION_SECRET`: Long random string (≥32 characters) for session cookies and CSRF tokens

### Payment Integration

**Stripe Configuration:**
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret

**Square Configuration (if using Square):**
- `SQUARE_APPLICATION_ID`: Square application ID (sandbox: `sandbox-*`, production: `sq0idp-*`)
- `SQUARE_ACCESS_TOKEN`: Square access token (required)
- `SQUARE_LOCATION_ID`: Square location ID
- `SQUARE_ENVIRONMENT`: Square environment (`sandbox` or `production`, defaults to `sandbox`)

**Note**: Currency is automatically configured from `app/config/site.ts` → `localization.currency` (currently CAD). Ensure your Square merchant account supports this currency.

**Square Production Requirements:**
- ✅ **HTTPS Required**: Square Web SDK only works in secure contexts
- ✅ **CSP Configuration**: Domains automatically added via provider abstraction in `entry.server.tsx`
- ✅ **Browser Support**: No IE11, Chrome extensions not supported
- ✅ **Token Security**: Payment tokens expire after 24 hours, single-use only

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

4. **Configure Payment Provider Secrets for Edge Functions:**

   Store only the credentials you plan to use. The sync job will automatically detect which provider issued each intent and call the matching API when the corresponding secrets are present.

   ```bash
   # Stripe (required for Stripe intent sync + webhook enrichment)
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...

   # Square (required for Square intent sync)
   supabase secrets set SQUARE_ACCESS_TOKEN=EAAAE...
   supabase secrets set SQUARE_ENVIRONMENT=production
   ```

   The Square Web Payments SDK still needs `SQUARE_APPLICATION_ID` and `SQUARE_LOCATION_ID` in your hosting environment (Vercel, etc.), but the sync function only requires the access token and environment.

5. **Schedule Functions using pg_cron:**
   
   Set up automated scheduling for reminder and sync functions:
   ```sql
   -- Schedule sync-pending-payments to run every 15 minutes
   SELECT cron.schedule(
     'sync-pending-payments',
     '*/15 * * * *',
     'SELECT net.http_post(url:=''https://your-project-ref.supabase.co/functions/v1/sync-pending-payments'', headers:=''{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.jwt_secret') || '"}''::jsonb) as request_id;'
   );
   
   -- Schedule payment reminders (daily at 9 AM)
   SELECT cron.schedule(
     'payment-reminder',
     '0 9 * * *',
     'SELECT net.http_post(url:=''https://your-project-ref.supabase.co/functions/v1/payment-reminder'', headers:=''{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.jwt_secret') || '"}''::jsonb) as request_id;'
   );
   ```

6. **Authentication Settings:**
   - Ensure "Confirm email" is **enabled** for production
   - Set up database backups

### Payment Provider Webhook Configuration

#### Stripe Webhooks

1. Get your production URL after deployment
2. In Stripe Dashboard, go to Developers → Webhooks
3. Add endpoint:
   - URL: `https://<your-domain>/api/webhooks/stripe`
   - Select events:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
   - Use the `STRIPE_WEBHOOK_SECRET` from your environment variables

#### Square Webhooks

1. In Square Developer Dashboard, go to your application
2. Configure webhooks:
   - URL: `https://<your-domain>/api/webhooks/square`
   - Select events:
     - `payment.created`
     - `payment.updated`
   - Copy the webhook signature key and add it to your environment variables as `SQUARE_WEBHOOK_SIGNATURE_KEY`
   - Configure signature verification using Square webhook signatures

### Payment Sync Function Details

The `sync-pending-payments` Edge Function is provider-agnostic and will:

1. **Detect Provider:** Infers Stripe vs Square from the stored intent ID and available secrets (supports mixed providers without extra config)
2. **Query Database:** Finds pending payments older than 15 minutes with payment intent IDs
3. **Provider Integration:** 
   - **Stripe:** Uses Stripe API to check payment intent status
   - **Square:** Uses Square Payments API and normalizes metadata (requires `SQUARE_ACCESS_TOKEN`)
4. **Update Status:** Automatically updates database based on provider response
5. **Logging:** Provides detailed provider-specific logging for monitoring

**Database Field Mapping:**
- All providers: Uses generic `payment_intent_id` field
- Legacy `stripe_payment_intent_id` field migrated to `payment_intent_id`

**Status Mapping:**
- Stripe: `succeeded` → `succeeded`, `requires_payment_method`/`canceled` → `failed`
- Square: `approved`/`completed` → `succeeded`, `failed`/`canceled` → `failed`

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

### Square Production Deployment

#### Pre-Deployment Validation

Run the Square configuration validator before deployment:

```bash
npm run validate:square
```

This validates:
- ✅ All required environment variables are present
- ✅ Application ID format matches environment (production: `sq0idp-*`, sandbox: `sandbox-*`)
- ✅ Environment setting is valid (`sandbox` or `production`)
- ✅ CSP domain requirements

#### Square Production Checklist

- [ ] **Environment Variables**: All Square credentials stored as environment variables
- [ ] **HTTPS Enabled**: Production environment uses HTTPS only
- [ ] **CSP Headers**: Content Security Policy configured to allow Square domains
- [ ] **Sandbox Testing**: Complete payment flow tested with sandbox credentials
- [ ] **Test Cards**: Verified with Square test cards (4111 1111 1111 1111)
- [ ] **SCA Testing**: Strong Customer Authentication tested for EU customers
- [ ] **Error Handling**: Production error logging and monitoring configured

#### Square CSP Domains

The following domains are automatically added to CSP headers when using Square:

**Connect Sources:**
- `https://connect.squareup.com`
- `https://web.squarecdn.com`
- `https://pci-connect.squareup.com` (production)
- `https://pci-connect.squareupsandbox.com` (sandbox)

**Script/Frame Sources:**
- `https://js.squareup.com`
- `https://web.squarecdn.com`
- `https://sandbox.web.squarecdn.com`
- `https://production.web.squarecdn.com`

#### Common Square Production Issues

**1. Payment Token Expiration**
- **Problem**: Payment tokens expire after 24 hours
- **Solution**: Process payment tokens immediately after generation

**2. Strong Customer Authentication (SCA)**
- **Problem**: EU customers require additional authentication
- **Solution**: Provide comprehensive billing information to improve success rates

**3. CSP Violations**
- **Problem**: Square resources blocked by Content Security Policy
- **Solution**: Verify all Square domains are included in CSP headers (automatically handled)

**4. HTTPS Requirements**
- **Problem**: Square Web SDK fails to load over HTTP
- **Solution**: Ensure production environment uses HTTPS only

**5. Application ID Format Errors**
- **Problem**: `InvalidApplicationIdError: The Payment 'applicationId' option is not in the correct format`
- **Solution**: Known issue with Square Web SDK versions 2.1.0+
  - Use Square API version `2025-02-20` or earlier
  - Verify application ID type: `sq0idp-` for Web SDK, `sq0idb-` for backend API
  - May require separate application IDs for different Square services

**6. OAuth Location Authorization Errors**
- **Problem**: `Not authorized to take payments with location_id=...`
- **Solution**: Square OAuth access tokens are location-specific
  - **Critical**: Each Square location requires its own OAuth access token
  - Verify the access token was generated for the specific location being used
  - Re-run OAuth flow for each location that needs payment processing
  - Cannot use a single access token across multiple locations

### Monitoring

- Monitor Vercel function logs for errors
- Check Supabase logs for database and function issues
- Use Stripe/Square dashboard for payment monitoring
- Monitor Resend dashboard for email delivery status
- Track payment success rates and error patterns
