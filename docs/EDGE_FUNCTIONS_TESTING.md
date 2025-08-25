# Testing Deployed Supabase Edge Functions

This guide covers how to test your deployed Supabase Edge Functions in the karate management system.

## Available Edge Functions

Your project has three Supabase Edge Functions:
- `payment-reminder` - Sends payment reminders to families with expired student eligibility
- `missing-waiver-reminder` - Sends reminders to families missing required waiver signatures
- `sync-pending-payments` - Synchronizes pending payment data

## 1. Direct HTTP Testing with curl

Test your deployed edge functions using curl commands:

```bash
# Test payment-reminder function
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-reminder \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Test missing-waiver-reminder function
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/missing-waiver-reminder \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Test sync-pending-payments function
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-pending-payments \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Replace the following:**
- `YOUR_PROJECT_REF` with your actual Supabase project reference
- `YOUR_ANON_KEY` with your Supabase anon key

## 2. Using Supabase CLI for Testing

### Local Testing
```bash
# Test functions locally first
supabase functions serve

# Then test against local instance
curl -X POST http://localhost:54321/functions/v1/payment-reminder \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Remote Testing
```bash
# Test deployed functions
supabase functions invoke payment-reminder --project-ref YOUR_PROJECT_REF
supabase functions invoke missing-waiver-reminder --project-ref YOUR_PROJECT_REF
supabase functions invoke sync-pending-payments --project-ref YOUR_PROJECT_REF
```

## 3. Browser Testing

Test functions directly in the browser console:

```javascript
// Test payment-reminder function
fetch('https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-reminder', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ANON_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
})
.then(response => response.text())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));

// Test missing-waiver-reminder function
fetch('https://YOUR_PROJECT_REF.supabase.co/functions/v1/missing-waiver-reminder', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ANON_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
})
.then(response => response.text())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));

// Test sync-pending-payments function
fetch('https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-pending-payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ANON_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
})
.then(response => response.text())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

## 4. Monitoring and Logs

### View Function Logs in Dashboard
1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → Select your function → **Logs**
3. Monitor real-time execution and errors

### Using Supabase CLI for Logs
```bash
# View logs for specific function
supabase functions logs payment-reminder --project-ref YOUR_PROJECT_REF
supabase functions logs missing-waiver-reminder --project-ref YOUR_PROJECT_REF
supabase functions logs sync-pending-payments --project-ref YOUR_PROJECT_REF

# Follow logs in real-time
supabase functions logs payment-reminder --project-ref YOUR_PROJECT_REF --follow
```

## 5. Scheduled Function Testing

Since your functions are scheduled with `pg_cron`, you can:

### Check Scheduled Jobs
```sql
-- In Supabase SQL Editor
SELECT * FROM cron.job;
```

### Manually Trigger Scheduled Functions
```sql
-- Manually run the payment reminder
SELECT cron.schedule('manual-payment-reminder', '* * * * *', 
  'SELECT net.http_post(
    url:=''https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-reminder'',
    headers:=''{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}''
  );'
);

-- Remove the manual job after testing
SELECT cron.unschedule('manual-payment-reminder');
```

```sql
-- Manually run the missing waiver reminder
SELECT cron.schedule('manual-waiver-reminder', '* * * * *', 
  'SELECT net.http_post(
    url:=''https://YOUR_PROJECT_REF.supabase.co/functions/v1/missing-waiver-reminder'',
    headers:=''{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}''
  );'
);

-- Remove the manual job after testing
SELECT cron.unschedule('manual-waiver-reminder');
```

## 6. Environment Variables Testing

Ensure your functions have the required secrets set:

```bash
# Check current secrets
supabase secrets list --project-ref YOUR_PROJECT_REF

# Set missing secrets
supabase secrets set VITE_SITE_URL=https://your-domain.com --project-ref YOUR_PROJECT_REF
supabase secrets set RESEND_API_KEY=your_resend_key --project-ref YOUR_PROJECT_REF
supabase secrets set FROM_EMAIL="Your Name <you@yourdomain.com>" --project-ref YOUR_PROJECT_REF
supabase secrets set STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key --project-ref YOUR_PROJECT_REF
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co --project-ref YOUR_PROJECT_REF
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key --project-ref YOUR_PROJECT_REF
```

## 7. Integration Testing Script

Create a comprehensive test script:

```javascript
// test-edge-functions.js
async function testEdgeFunctions() {
  const baseUrl = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1';
  const headers = {
    'Authorization': 'Bearer YOUR_ANON_KEY',
    'Content-Type': 'application/json'
  };

  const functions = ['payment-reminder', 'missing-waiver-reminder', 'sync-pending-payments'];
  
  console.log('🧪 Testing Edge Functions...');
  console.log('================================');
  
  for (const func of functions) {
    try {
      console.log(`\n📡 Testing ${func}...`);
      const startTime = Date.now();
      
      const response = await fetch(`${baseUrl}/${func}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ ${func}: ${response.status} ${response.statusText} (${duration}ms)`);
      
      const text = await response.text();
      if (text) {
        console.log(`📄 Response: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
      }
      
      if (!response.ok) {
        console.log(`❌ Function ${func} returned error status: ${response.status}`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${func}:`, error.message);
    }
  }
  
  console.log('\n🏁 Testing completed!');
}

// Run the tests
testEdgeFunctions();
```

Save this as `test-edge-functions.js` and run with:
```bash
node test-edge-functions.js
```

## 8. Quick Test Commands

Replace the placeholders and run these commands to quickly test your functions:

```bash
# Get your project details (if linked locally)
echo "Project URL: $(supabase status | grep 'API URL' | awk '{print $3}')"
echo "Anon Key: $(supabase status | grep 'anon key' | awk '{print $3}')"

# Test all functions in sequence
for func in payment-reminder missing-waiver-reminder sync-pending-payments; do
  echo "\n🧪 Testing $func..."
  curl -s -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/$func" \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{}' | head -c 200
  echo "\n---"
done
```

## 9. Production Considerations

### Authentication
- Your functions should validate the request source (especially for scheduled functions)
- Consider implementing function-specific authentication tokens
- Monitor for unauthorized access attempts

### Rate Limiting
- Monitor function invocation frequency
- Set up alerts for unusual activity
- Consider implementing rate limiting if functions are publicly accessible

### Error Handling
- Check function logs regularly for runtime errors
- Set up monitoring alerts for function failures
- Implement proper error responses and logging

### Email Delivery
- Verify emails are being sent through your Resend integration
- Monitor email delivery rates and bounces
- Test email templates and formatting

## 10. Troubleshooting Common Issues

### Function Not Responding
1. Check function deployment status in Supabase Dashboard
2. Verify environment variables are set correctly
3. Check function logs for startup errors
4. Ensure database connections are working

### Email Not Sending
1. Verify `RESEND_API_KEY` is set correctly
2. Check Resend dashboard for delivery status
3. Verify `VITE_SITE_URL` is set for email links
4. Check email template generation

### Database Connection Issues
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
2. Check database permissions for the service role
3. Verify Row Level Security (RLS) policies allow function access
4. Check network connectivity from function to database

### Scheduled Functions Not Running
1. Verify `pg_cron` jobs are created correctly
2. Check cron job logs in Supabase Dashboard
3. Ensure function URLs are correct in cron jobs
4. Verify service role key has necessary permissions

## 11. Performance Testing

### Load Testing
```bash
# Simple load test with multiple concurrent requests
for i in {1..10}; do
  curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-reminder" \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{}' &
done
wait
echo "Load test completed"
```

### Response Time Monitoring
```bash
# Test response times
for func in payment-reminder missing-waiver-reminder sync-pending-payments; do
  echo "Testing $func response time..."
  time curl -s -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/$func" \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{}' > /dev/null
done
```

---

## Getting Your Credentials

### Project Reference
Find your project reference in:
- Supabase Dashboard → Project Settings → General → Reference ID
- Or from your project URL: `https://supabase.com/dashboard/project/[PROJECT_REF]`

### API Keys
Find your API keys in:
- Supabase Dashboard → Project Settings → API
- `anon public` key for testing
- `service_role` key for administrative functions

### Access Tokens
Generate access tokens at:
- https://supabase.com/dashboard/account/tokens
- Required for deployment and management operations

Remember to keep your credentials secure and never commit them to version control!