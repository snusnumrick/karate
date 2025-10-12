# Monthly Revenue Report Function

## Overview

The `monthly-revenue-report` Supabase Edge Function automatically calculates and emails monthly revenue reports for session-based payments. It provides detailed breakdowns by payment type and excludes store, event, seminar, and invoice revenue.

## Features

- **Automated Monthly Reports**: Calculates total revenue from the last calendar month
- **Session-Only Revenue**: Includes only `monthly_group`, `yearly_group`, and `individual_session` payment types
- **Payment Type Breakdown**: Detailed analysis by payment type with counts and amounts
- **Custom Period Support**: Optional query parameter to generate reports for specific months
- **Multiple Recipients**: Configurable email distribution list
- **Professional Email Template**: HTML email with formatted tables and currency values

## Revenue Calculation

The function calculates revenue using the following criteria:

### Included Payments
- **Status**: Only `succeeded` payments
- **Payment Types**:
  - `monthly_group` - Monthly training sessions
  - `yearly_group` - Annual training sessions
  - `individual_session` - Single session payments
- **Date Range**: Within the specified calendar month

### Excluded Payments
- Store purchases (has `order_id`)
- Event registrations
- Seminar payments
- Invoice payments
- Failed or pending payments

## Configuration

### Required Environment Variables

Set these in your Supabase Edge Function secrets:

```bash
# Email configuration (required for all functions)
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL="Your School Name <noreply@yourdomain.com>"
VITE_SITE_URL=https://your-domain.com

# Database connection (required for all functions)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Revenue report recipients (required for this function)
REVENUE_REPORT_RECIPIENTS="admin@example.com,finance@example.com,owner@example.com"
```

### Setting Secrets

```bash
supabase secrets set REVENUE_REPORT_RECIPIENTS="admin@example.com,finance@example.com"
```

## Deployment

### Deploy the Function

```bash
supabase functions deploy monthly-revenue-report
```

### Schedule with pg_cron

Run automatically on the 1st of each month at 8 AM:

```sql
SELECT cron.schedule(
  'monthly-revenue-report',
  '0 8 1 * *',
  'SELECT net.http_post(
    url:=''https://your-project-ref.supabase.co/functions/v1/monthly-revenue-report'',
    headers:=''{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}''::jsonb
  ) as request_id;'
);
```

## Usage

### Manual Trigger (Last Calendar Month)

```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/monthly-revenue-report \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Custom Period (Specific Month)

```bash
curl -X POST \
  "https://YOUR_PROJECT_REF.supabase.co/functions/v1/monthly-revenue-report?period=2025-09" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Using Supabase CLI

```bash
# Deploy to production
supabase functions deploy monthly-revenue-report --project-ref YOUR_PROJECT_REF

# Test the deployed function
supabase functions invoke monthly-revenue-report --project-ref YOUR_PROJECT_REF

# View logs
supabase functions logs monthly-revenue-report --project-ref YOUR_PROJECT_REF --follow
```

## Response Format

The function returns a JSON response with detailed information:

```json
{
  "success": true,
  "period": "October 2025",
  "dateRange": {
    "start": "2025-10-01",
    "end": "2025-10-31"
  },
  "totalRevenue": 125000,
  "totalRevenueFormatted": "$1250.00",
  "totalPayments": 45,
  "breakdown": [
    {
      "type": "monthly_group",
      "count": 30,
      "amount": 90000
    },
    {
      "type": "yearly_group",
      "count": 10,
      "amount": 30000
    },
    {
      "type": "individual_session",
      "count": 5,
      "amount": 5000
    }
  ],
  "emailsSent": 2,
  "emailsFailed": 0,
  "recipients": ["admin@example.com", "finance@example.com"]
}
```

## Email Template

The email includes:

- **Report Header**: Month and year
- **Total Revenue Highlight**: Large, prominent display with payment count
- **Breakdown Table**:
  - Payment type
  - Number of payments
  - Total amount per type
- **Summary Footer**: Explanation of included revenue types
- **CTA Button**: Link to admin dashboard

### Sample Email Content

```
Revenue Report
Period: October 2025

Total Revenue
$1,250.00
45 successful payments

Breakdown by Payment Type
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Payment Type          Count    Amount
Monthly Group          30      $900.00
Yearly Group           10      $300.00
Individual Session      5       $50.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total                  45    $1,250.00

This report includes revenue from session payments only (monthly, yearly, and individual sessions).
Store purchases, events, seminars, and invoices are excluded.
```

## Testing

### Local Testing

```bash
# Serve functions locally
supabase functions serve

# Test locally
curl -X POST http://localhost:54321/functions/v1/monthly-revenue-report \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Production Testing

See [EDGE_FUNCTIONS_TESTING.md](./EDGE_FUNCTIONS_TESTING.md) for comprehensive testing instructions.

## Troubleshooting

### Email Not Sending

1. Verify `RESEND_API_KEY` is set correctly
2. Check `REVENUE_REPORT_RECIPIENTS` contains valid email addresses
3. Verify Resend dashboard for delivery status
4. Check function logs: `supabase functions logs monthly-revenue-report`

### No Payments Found

1. Verify date range is correct
2. Check that payments exist with `status = 'succeeded'`
3. Ensure payments have correct `type` values
4. Confirm payments don't have `order_id` (which excludes store purchases)

### Database Connection Issues

1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. Check service role has database access permissions
3. Review function logs for specific error messages

### Custom Period Format

Period must be in `YYYY-MM` format:
- ✅ Correct: `2025-09`, `2025-10`
- ❌ Incorrect: `09-2025`, `2025/09`, `September 2025`

## Monitoring

### View Function Logs

```bash
# Real-time logs
supabase functions logs monthly-revenue-report --project-ref YOUR_PROJECT_REF --follow

# Recent logs
supabase functions logs monthly-revenue-report --project-ref YOUR_PROJECT_REF
```

### Check Scheduled Job Status

```sql
-- View all cron jobs
SELECT * FROM cron.job WHERE jobname = 'monthly-revenue-report';

-- View job execution history
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'monthly-revenue-report')
ORDER BY start_time DESC
LIMIT 10;
```

## Customization

### Modify Recipients

Update the environment variable:

```bash
supabase secrets set REVENUE_REPORT_RECIPIENTS="new@example.com,another@example.com"
```

### Change Email Template

Edit `supabase/functions/_shared/email-templates.ts`:
- Modify the `createMonthlyRevenueReportEmail` function
- Customize HTML, styling, or content
- Redeploy the function

### Adjust Revenue Criteria

Edit `supabase/functions/monthly-revenue-report/index.ts`:
- Modify the payment type filters in the query
- Add additional exclusion criteria
- Change the status filter
- Redeploy the function

## Related Documentation

- [EDGE_FUNCTIONS_TESTING.md](./EDGE_FUNCTIONS_TESTING.md) - Comprehensive testing guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment instructions and environment variables
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [MONETARY_STORAGE.md](./MONETARY_STORAGE.md) - Currency and monetary value handling

## Technical Details

### File Locations

- **Function**: `supabase/functions/monthly-revenue-report/index.ts`
- **Email Template**: `supabase/functions/_shared/email-templates.ts`
- **Shared Utilities**: `supabase/functions/_shared/`

### Dependencies

- Deno standard library (`http/server`)
- Supabase client (`@supabase/supabase-js`)
- Resend email service
- Shared email template system

### Monetary Values

All amounts are stored as **INT4 cents** in the database:
- Database: `125000` (cents)
- Display: `$1,250.00` (dollars)
- Conversion handled automatically in email template
