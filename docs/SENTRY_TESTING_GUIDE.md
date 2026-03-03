# Sentry Integration Testing Guide

## Quick Test (2 Minutes)

### Step 1: Start Your Development Server

```bash
npm run dev
```

### Step 2: Visit the Test Page

Open in your browser:
```
http://localhost:3000/test/sentry
```

### Step 3: Run a Test

Click any test button on the page. We recommend starting with:
- **"Test Server console.error()"** - Simplest test

### Step 4: Check Sentry Dashboard

1. Wait 1-2 minutes for Sentry to process
2. Go to https://sentry.io and log in
3. Select your project
4. Look for the test error in the "Issues" tab

**Search for test errors:**
```
tags.test:*
```

### Expected Result

You should see an error in Sentry with:
- ✅ Error message containing "[Sentry Test]"
- ✅ Stack trace showing the file and line number
- ✅ Timestamp of when it occurred
- ✅ Environment (development)

---

## Detailed Testing Checklist

### 1. Console Integration (Automatic Capture)

**What it tests:** Automatic capture of `console.error()` calls

**Server-side test:**
```
1. Click "Test Server console.error()"
2. Check terminal/console for the log message
3. Wait 1-2 minutes
4. Check Sentry dashboard
```

**Client-side test:**
```
1. Click "Test Client console.error()"
2. Check browser DevTools Console tab
3. Wait 1-2 minutes
4. Check Sentry dashboard
```

**What to look for in Sentry:**
- Error appears with the console message
- No need for explicit `Sentry.captureException()` call
- Automatic stack trace included

---

### 2. Explicit Exception Capture (Custom Context)

**What it tests:** `Sentry.captureException()` with custom tags and context

**Server-side test:**
```
1. Click "Test Server Explicit Capture"
2. Page should reload with success message
3. Check Sentry dashboard
```

**Client-side test:**
```
1. Click "Test Client Explicit Capture"
2. Alert popup should appear
3. Check Sentry dashboard
```

**What to look for in Sentry:**
- Custom tag: `test:server-explicit` or `test:client-explicit`
- Custom context with timestamp
- Severity level (error or warning)
- Additional context fields we set

**How to find it:**
Search in Sentry: `tags.test:server-explicit`

---

### 3. ErrorBoundary (Unhandled Exceptions)

**What it tests:** React ErrorBoundary catching thrown errors

**Server-side test:**
```
1. Click "Test Server Thrown Error"
2. Should show error page or ErrorBoundary fallback
3. Check Sentry dashboard
```

**Client-side test:**
```
1. Click "Test Client Thrown Error"
2. Should show ErrorBoundary fallback UI
3. Check Sentry dashboard
```

**What to look for in Sentry:**
- Full stack trace
- Shows exact line where error was thrown
- Component stack (for client-side errors)

---

## Testing Real Payment Errors

After basic tests work, test with actual payment flow:

### Test 1: Payment Page Error (Console Integration)

```bash
# In terminal, watch server logs
npm run dev

# In browser
1. Go to any payment page
2. Open browser DevTools Console
3. The page should load normally
4. Check Sentry - should have NO errors (page works)
```

### Test 2: Trigger a Real Error

**Option A: Use an invalid payment ID**
```
Visit: http://localhost:3000/pay/invalid-payment-id

Expected:
- Should show user-friendly error message
- Should log error to console
- Should appear in Sentry with payment context
```

**Option B: Create payment with missing data**

Use the diagnostic SQL to find a problematic payment, then visit its page.

**What to look for in Sentry:**
- Tag: `paymentId`
- Tag: `familyId`
- Context: payment type, status, etc.
- Custom tags we added in our implementation

---

## Verifying Each Integration Pattern

### Pattern 1: Console Integration (Client-Side Only)

**Location:** `app/entry.client.tsx`

**Implementation:** Using `Sentry.captureConsoleIntegration({ levels: ['error'] })`

**Test:**
```javascript
// In browser console or client-side component
console.error("Test console integration");
```

**Verification:**
- ✅ Client-side console.error() appears in Sentry within 2 minutes
- ❌ Server-side console.error() does NOT appear (this is expected)
- No explicit `Sentry.captureException()` needed for client-side

**Note:** Server-side console integration doesn't work in Remix. Use explicit `Sentry.captureException()` for server errors instead.

---

### Pattern 2: Explicit Capture (Server-Side)

**Location:** Payment loader errors in `app/routes/_layout.pay.$paymentId.tsx`

**Test:**
```
1. Find a payment with individual session type
2. Temporarily modify getFamilyPaymentOptions to throw error
3. Visit payment page
4. Check Sentry for error with custom tags
```

**Verification:**
- Error has custom tags (paymentId, familyId, etc.)
- Has severity level (warning or error)
- Has custom context

---

### Pattern 3: Payment Provider Errors

**Location:** Provider API calls in payment loader

**Test:**
```
1. Temporarily use invalid Square/Stripe API key
2. Try to load a pending payment
3. Check Sentry for provider API error
```

**Verification:**
- Tag: `provider:square` or `provider:stripe`
- Tag: `paymentIntentId`
- Level: error (critical)

---

## Troubleshooting

### Issue: No Errors Appearing in Sentry

**Check 1: Is SENTRY_DSN set?**
```bash
grep SENTRY_DSN .env
```
Should show your DSN URL.

**Check 2: Is Sentry initialized?**

Check browser console (DevTools):
```
Sentry should NOT show:
- "Sentry DSN not configured"
- Any Sentry initialization errors
```

Check server logs:
```
Should NOT show:
- Sentry initialization errors
- "SENTRY_DSN is not set"
```

**Check 3: Network requests**

In browser DevTools → Network tab:
- Look for requests to `ingest.sentry.io`
- Status should be 200 OK
- If blocked: Check firewall/ad-blocker

**Check 4: Environment variable exposure**

Visit any page, open DevTools Console, type:
```javascript
window.ENV.SENTRY_DSN
```
Should show your DSN (client-side).

---

### Issue: Errors Only Show in Development

**Cause:** Production environment variable not set

**Fix:**
1. Check production environment variables
2. Ensure `SENTRY_DSN` is set in Vercel/production
3. Redeploy

---

### Issue: Too Many Test Errors

**How to clean up Sentry:**

1. Go to Sentry dashboard
2. Filter by: `tags.test:*`
3. Select all test errors
4. Click "Resolve" or "Delete"

---

### Issue: Sensitive Data Appearing

**Shouldn't happen** - we configured `beforeSend` to strip it.

**Check:**
1. Look at error details in Sentry
2. Should NOT see:
   - Customer names
   - Email addresses
   - Payment amounts
   - Credit card info

**If you see sensitive data:**
1. Check `beforeSend` in `entry.client.tsx` and `entry.server.tsx`
2. Ensure privacy filters are working
3. Delete the error from Sentry

---

## Expected Sentry Dashboard Views

### Issues Page

```
┌─────────────────────────────────────────────────┐
│ Issues                                          │
├─────────────────────────────────────────────────┤
│ 🔴 Test Server Error (NEW)              [1]   │
│ 🟡 Test Explicit Capture - Client       [1]   │
│ 🔴 Test Client Error                    [1]   │
└─────────────────────────────────────────────────┘
```

### Issue Detail Page

```
┌─────────────────────────────────────────────────┐
│ Test Server Error - This should appear...      │
├─────────────────────────────────────────────────┤
│ FIRST SEEN: 2 minutes ago                      │
│ LAST SEEN: 2 minutes ago                       │
│ EVENTS: 1                                       │
│ USERS: 1                                        │
│                                                 │
│ TAGS                                            │
│ test: server-explicit                          │
│ location: test-page                            │
│                                                 │
│ BREADCRUMBS                                     │
│ > Console                                       │
│   [Sentry Test] Explicit server-side capture   │
│                                                 │
│ STACK TRACE                                     │
│ Error: Test Server Error                       │
│   at loader (test.sentry.tsx:14)              │
│   at ...                                        │
└─────────────────────────────────────────────────┘
```

---

## Testing Payment-Specific Features

### Test Payment Error Tags

**What to verify:**
```
1. Create/find a problematic payment
2. Visit its payment page
3. Check Sentry error has:
   - tags.paymentId: [the payment ID]
   - tags.familyId: [the family ID]
   - tags.paymentType: [the payment type]
```

**Search in Sentry:**
```
tags.paymentId:abc123
```

---

### Test Error Levels

**Warning (Yellow):**
- Individual session pricing failures
- Student lookup errors
- Non-critical issues with fallbacks

**Error (Red):**
- Payment provider API failures
- Missing required data
- Critical database errors

**Verify:**
```
1. Trigger both warning and error level issues
2. Check Sentry dashboard
3. Errors should be color-coded correctly
4. Can filter by: level:error or level:warning
```

---

## Performance Check

### Expected Overhead

**Development:**
- Minimal impact (errors sent asynchronously)
- <50ms per error

**Production:**
- Negligible impact on normal operation
- Only overhead when errors occur

### What NOT to Worry About

- ❌ Sentry slowing down your site
- ❌ Sentry blocking page loads
- ❌ Sentry consuming too much bandwidth

Sentry sends errors in the background and doesn't block your application.

---

## Next Steps After Successful Testing

### 1. Set Up Alerts

Go to Sentry → Settings → Alerts:

**Recommended alerts:**
- Email when NEW error type appears
- Email if error rate >10 per hour
- Email for any `level:error` in production

### 2. Clean Up Test Page

**Option A: Delete test page**
```bash
rm app/routes/test.sentry.tsx
```

**Option B: Make it admin-only**
```typescript
// In test.sentry.tsx loader
export async function loader({ request }: LoaderFunctionArgs) {
  // Add authentication check
  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    throw redirect("/login");
  }

  // Check if admin
  const { data: profile } = await supabaseServer
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Response("Forbidden", { status: 403 });
  }

  // ... rest of test code
}
```

### 3. Mark Test Errors as Resolved

In Sentry dashboard:
1. Filter: `tags.test:*`
2. Select all
3. Click "Resolve"

### 4. Monitor Real Errors

Start watching for real production errors:
- Check dashboard daily
- Respond to email alerts
- Use search queries to find specific issues

---

## Common Search Queries

**All payment errors:**
```
tags.paymentId:*
```

**Errors for specific payment:**
```
tags.paymentId:abc123
```

**Square provider errors:**
```
tags.provider:square level:error
```

**Recent errors (last hour):**
```
age:-1h
```

**Errors affecting multiple users:**
```
event.count:>5
```

---

## Performance Monitoring

In addition to error tracking, Sentry also captures performance data:

**What to Check:**
1. Go to Sentry dashboard → "Performance" tab
2. You should see transactions for your routes
3. Look for slow requests (payment page loads, API calls)

**What Gets Tracked:**
- Request duration for all routes
- Database query performance
- Payment provider API latency
- Slow loaders (>1 second will be highlighted)

**Finding Performance Issues:**
```
Search: transaction:/pay/$paymentId
Filter: Duration >1s
```

This helps identify slow payment page loads before they timeout.

---

## Summary Checklist

Test these in order:

- [ ] Verify SENTRY_DSN is set in `.env`
- [ ] Start dev server: `npm run dev`
- [ ] Visit test page: `/test/sentry`
- [ ] Test client console integration (server console won't work - expected)
- [ ] Test explicit exception capture
- [ ] Test ErrorBoundary (thrown errors)
- [ ] Wait 2 minutes, check Sentry dashboard
- [ ] Verify errors appear with correct tags
- [ ] Test search functionality
- [ ] Check Performance tab for transaction data
- [ ] Clean up test errors in Sentry
- [ ] Set up alerts (optional)
- [ ] Delete or secure test page

**Success Criteria:**
✅ 4 out of 6 test errors appear in Sentry
✅ Client-side tests all work (console, explicit, thrown)
✅ Server explicit capture works
✅ Server tests that don't work are expected (console integration and handleError both have issues)
✅ Custom tags are present
✅ No sensitive data in error reports
✅ Search/filter works in dashboard
✅ Errors appear within 2 minutes
✅ Performance data appears in Performance tab

**Expected Results:**
- ✅ Test Client console.error() - **WORKS**
- ✅ Test Client Explicit Capture - **WORKS**
- ✅ Test Client Thrown Error - **WORKS**
- ✅ Test Server Explicit Capture - **WORKS**
- ❌ Test Server Thrown Error - **Won't appear (handleError causes infinite loops, removed)**
- ❌ Test Server console.error() - **Won't appear (expected - console integration doesn't work server-side)**

---

**Need Help?**

If tests aren't working:
1. Check browser DevTools Console for errors
2. Check server terminal for Sentry errors
3. Verify network requests to `ingest.sentry.io`
4. Check Sentry project settings (DSN is correct)
5. Try incognito/private browsing (disable ad-blockers)

**Still stuck?**
- Check Sentry documentation: https://docs.sentry.io/platforms/javascript/guides/remix/
- Verify environment variables are loaded correctly
- Check if firewall is blocking Sentry requests
