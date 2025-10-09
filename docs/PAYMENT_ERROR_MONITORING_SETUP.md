# Payment Error Monitoring & Diagnostics

## Overview

This document explains the error monitoring and diagnostic improvements implemented to help identify and resolve payment page errors.

## What Was Implemented

### 1. Enhanced Error Logging ✅

**Files Modified:**
- `app/routes/_layout.pay.$paymentId.tsx`
- `app/routes/_layout.pay.tsx`

**Improvements:**
- Comprehensive logging at every stage of the payment loader
- Detailed error context including payment ID, family ID, and payment type
- Validation warnings for missing or invalid data
- Stack trace logging for all errors
- Payment ID displayed in ErrorBoundary for support tickets

**Example Log Output:**
```
[Payment Loader] Starting loader for payment ID: abc123
[Payment Loader] Payment abc123 loaded: { type: 'individual_session', familyId: 'xyz789', ... }
[Payment Loader] Processing individual session pricing for payment abc123, family xyz789
```

### 2. Database Diagnostic Query ✅

**File Created:**
- `docs/PAYMENT_DIAGNOSTIC_QUERY.sql`

**Purpose:**
Run this SQL query in Supabase to identify data integrity issues:
- Payments with missing family records
- Orphaned payment_students references
- Missing student enrollments
- Broken enrollment foreign keys
- NULL or invalid amount values
- Missing tax rate references
- Payments without pricing information
- Stuck pending payments

**How to Use:**
1. Open Supabase SQL Editor
2. Paste the contents of `PAYMENT_DIAGNOSTIC_QUERY.sql`
3. Run the query
4. Review the results to identify problematic payment records

### 3. Sentry Error Monitoring ✅

**Files Modified:**
- `app/entry.server.tsx` - Server-side Sentry initialization
- `app/entry.client.tsx` - Client-side Sentry initialization
- `app/root.tsx` - Environment variable exposure
- `.env.example` - Sentry DSN documentation
- `package.json` - @sentry/remix dependency added

**Features:**
- Automatic error capture on both client and server
- **Console Integration**: Automatically captures all `console.error()` calls
- **Explicit Exception Capture**: Critical payment errors tracked with full context
- Error grouping and deduplication
- Stack trace with source maps
- Custom tags for filtering (payment ID, family ID, provider)
- Severity levels (error vs warning)
- Privacy-focused: strips sensitive payment data, emails, and PII
- Optional: Only enabled when SENTRY_DSN is set
- Free tier: 5,000 errors/month

**Privacy Safeguards:**
The implementation automatically redacts:
- User emails and IP addresses
- Cookie and authorization headers
- Payment amounts (total, subtotal, tax)
- Customer names, phone numbers, addresses

**Setup Instructions:**

1. **Create Sentry Account (Optional)**
   - Go to https://sentry.io and sign up (free tier available)
   - Create a new "Remix" project
   - Copy your DSN (looks like: `https://[key]@o[org-id].ingest.sentry.io/[project-id]`)

2. **Configure Environment Variable**
   ```bash
   # Add to your .env file
   SENTRY_DSN=your_sentry_dsn_here
   ```

3. **Deploy**
   - Make sure SENTRY_DSN is set in your production environment variables
   - Deploy your application
   - Sentry will automatically capture errors

4. **View Errors**
   - Log into Sentry dashboard
   - View errors grouped by type
   - See stack traces, user context, and frequency
   - Set up email/Slack alerts for new error types

**If You Don't Want Sentry:**
- Simply don't set the `SENTRY_DSN` environment variable
- The app will work normally without error monitoring
- You'll still have console logs for debugging

### Sentry Integration Patterns

The implementation uses three Sentry patterns for comprehensive error tracking:

#### 1. Console Integration (Automatic)
All `console.error()` calls are automatically captured and sent to Sentry. This means the detailed logging we added flows directly into your error monitoring dashboard.

```typescript
// In entry.client.tsx and entry.server.tsx
Sentry.consoleIntegration({ levels: ['error'] })
```

**Benefits:**
- Zero code changes required
- All existing error logs captured
- Preserves original logging for local development

#### 2. Explicit Exception Capture (Critical Paths)
Important try/catch blocks use `Sentry.captureException()` with custom context:

**Location: Payment Loader - Individual Session Pricing**
```typescript
try {
  await getFamilyPaymentOptions(payment.family_id, supabaseAdmin);
} catch (pricingError) {
  console.error('[Payment Loader] Error deriving individual session pricing...');

  Sentry.captureException(pricingError, {
    tags: { paymentId, familyId, paymentType },
    level: 'warning', // Not critical - page still loads
    contexts: {
      payment: {
        type: payment.type,
        studentCount: payment.payment_students?.length ?? 0
      }
    }
  });
}
```

**Location: Payment Loader - Provider API Failures**
```typescript
try {
  await paymentProvider.retrievePaymentIntent(paymentIntentId);
} catch (providerError) {
  console.error('[Loader] Error retrieving payment intent...');

  Sentry.captureException(providerError, {
    tags: { paymentId, paymentIntentId, provider },
    level: 'error', // More critical
    contexts: {
      payment: { status, type }
    }
  });
}
```

**Location: Student Payment Options - Data Integrity Issues**
```typescript
try {
  return await getStudentPaymentOptions(student.id, supabaseClient);
} catch (error) {
  Sentry.captureException(error, {
    tags: { familyId, studentId },
    level: 'warning',
    contexts: {
      studentLookup: {
        familyId,
        studentId,
        totalStudentsInFamily: students.length
      }
    }
  });
  // Return partial data instead of failing
}
```

**Benefits:**
- Custom tags for filtering in Sentry dashboard
- Severity levels (error vs warning)
- Additional context specific to the error
- Track non-fatal errors that don't crash the app

#### 3. ErrorBoundary Integration (Unhandled Errors)
React ErrorBoundaries automatically catch unhandled component errors. Our implementation logs them with full context including payment IDs from the URL.

**Where This Helps:**
- Catches React render errors
- Catches unhandled promise rejections
- Provides fallback UI to users
- Logs payment ID for correlation

### 4. Resilient Error Handling ✅

**Files Modified:**
- `app/services/enrollment-payment.server.ts`

**Improvements:**
- `getFamilyPaymentOptions` now continues even if individual students fail
- Validates enrollment data structure before processing
- Filters out enrollments with broken class/program references
- Returns partial results instead of failing entirely
- Comprehensive logging at each step

**Example Resilience:**
```typescript
// Before: If ONE student had a data issue, ENTIRE family would fail
// After:  Family payment options load with valid students, logs errors for problematic ones
```

## Using Sentry for Error Investigation

### Filtering Errors in Sentry Dashboard

With the custom tags, you can easily filter errors:

**By Payment ID:**
```
tags.paymentId:abc123
```

**By Family:**
```
tags.familyId:xyz789
```

**By Payment Provider:**
```
tags.provider:square
```

**By Severity:**
```
level:error  # Critical errors only
level:warning  # Non-critical issues
```

**Common Queries:**
- All payment pricing errors: `tags.paymentType:individual_session level:warning`
- Provider API failures: `tags.provider:* level:error`
- Student data issues: `tags.studentId:*`

### Understanding Error Levels

**Error (Red):** Critical issues that may block payment completion
- Provider API failures
- Database connection errors
- Missing required data

**Warning (Yellow):** Non-critical issues with fallback handling
- Individual session pricing lookup failures (page still loads)
- Student enrollment data issues (other students load)
- Missing optional data (defaults used)

### Setting Up Alerts

In your Sentry dashboard, you can configure alerts for:
1. **New Error Types:** Get notified when a new kind of error appears
2. **Error Frequency:** Alert when error rate exceeds threshold
3. **Critical Errors:** Immediate notification for `level:error`

## Diagnosing the Current Customer Issue

### Step 1: Check Server Logs

With the new logging in place, when the customer tries to load the payment page again, you should see detailed logs like:

```
[Payment Loader] Starting loader for payment ID: [payment-id]
[Payment Loader] Payment [payment-id] loaded: { ... }
[Payment Loader] Processing individual session pricing for payment [payment-id], family [family-id]
[Payment Loader] Payment students for [payment-id]: ["student-id-1", "student-id-2"]
```

Look for error messages that indicate what failed.

### Step 2: Run Database Diagnostic Query

1. Open `docs/PAYMENT_DIAGNOSTIC_QUERY.sql`
2. Copy the entire query
3. Run it in Supabase SQL Editor
4. Look for the problematic payment ID in the results

Common issues the query will find:
- Missing family record
- Orphaned student IDs
- Enrollments without class or program
- Missing individual session pricing

### Step 3: Check Sentry (If Enabled)

1. Log into Sentry dashboard
2. Look for recent errors related to payment pages
3. Click on the error to see:
   - Full stack trace
   - Payment ID (if captured)
   - Breadcrumb of user actions
   - Frequency and affected users

### Step 4: Fix Data Issues

Once you've identified the issue (e.g., missing enrollment, broken FK), you can:

1. Fix the data in Supabase directly
2. Or update the student's enrollment information through the admin panel
3. Ask the customer to try again

## Common Issues and Solutions

### Issue: "Payment data is incomplete (missing type)"
**Cause:** Payment record has NULL payment type
**Solution:** Update payment record to set correct type

### Issue: "Configuration error: Cannot determine individual session quantity"
**Cause:** No individual session fee set for student's program
**Solution:** Set individual_session_fee_cents in the program

### Issue: "Failed to fetch family students"
**Cause:** Database connection issue or RLS policy problem
**Solution:** Check Supabase logs and RLS policies

### Issue: Customer sees generic error page
**Cause:** Unhandled exception in loader or component
**Solution:**
1. Check server logs for stack trace
2. Check Sentry for error details (if enabled)
3. Use diagnostic SQL to find data issues

## Testing

### Verify Logging Works:
1. Visit any payment page
2. Check server console for `[Payment Loader]` messages
3. Should see payment ID and detailed progress logs

### Verify Error Handling Works:
1. Create a test payment with invalid data
2. Try to load payment page
3. Should see specific error message (not generic)
4. Error should be logged with full context

### Verify Sentry Works (If Enabled):
1. Trigger an error on payment page
2. Check Sentry dashboard within 1 minute
3. Should see error appear with sanitized data

## Performance Impact

- **Logging:** Minimal (console.log is lightweight)
- **Sentry:** ~50ms per error (only when errors occur)
- **Diagnostic Query:** Run manually, no runtime impact
- **Resilient Error Handling:** Slight improvement (fewer failed lookups)

## Security & Privacy

All implementations follow best practices:
- ✅ No sensitive data in error reports
- ✅ Emails and PII redacted
- ✅ Payment amounts stripped
- ✅ Stack traces sanitized
- ✅ HTTPS required for Sentry
- ✅ CSP headers updated for Sentry domains

## Next Steps (Optional)

If you want even more comprehensive error monitoring, you could:

1. **Add Custom Error Alerts**
   - Create `/api/log-payment-error` endpoint
   - Send email to admin when payment page errors occur
   - Include payment ID and error type (no customer data)

2. **Add Error Reporting UI**
   - Update ErrorBoundary to POST error details to server
   - Server logs error and optionally sends alert

3. **Set Up Sentry Alerts**
   - Configure Sentry to email/Slack when new error types appear
   - Set thresholds for error frequency

4. **Create Admin Dashboard**
   - Show recent payment errors
   - Link to diagnostic tools
   - Quick access to customer payment history

## Support

If you encounter issues with the error monitoring system:

1. Check that environment variables are set correctly
2. Verify Supabase connection is working
3. Review server startup logs for initialization errors
4. Test with a known-good payment record first

---

**Generated:** 2025-10-09
**Version:** 1.0
