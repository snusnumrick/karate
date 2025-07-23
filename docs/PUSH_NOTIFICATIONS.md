# Push Notification Implementation Guide

This document outlines the push notification system implementation for the Karate application.

## Overview

The push notification system allows the application to send notifications to users even when the app is closed or not in focus. This is particularly useful for:

- New message notifications
- Payment confirmations
- Class reminders
- Important announcements

## Architecture

### Client-Side Components

1. **Service Worker** (`public/sw.js`)
   - Handles incoming push notifications
   - Displays notifications with custom actions
   - Manages notification clicks and user interactions

2. **Push Notification Client** (`app/utils/push-notifications.client.ts`)
   - Manages subscription lifecycle
   - Handles VAPID key conversion
   - Communicates with service worker

3. **Notification Settings UI** (`app/components/NotificationSettings.tsx`)
   - User interface for managing notification preferences
   - Push notification subscription controls
   - Status indicators and testing functionality

4. **Notification Utilities** (`app/utils/notifications.client.ts`)
   - Browser notification management
   - Integration with push notification system
   - Permission handling

### Server-Side Components

1. **API Routes**
   - `/api/push/subscribe` - Handle push subscription registration
   - `/api/push/unsubscribe` - Handle push subscription removal
   - `/api/push/test` - Send test notifications

2. **Push Notification Server Utils** (`app/utils/push-notifications.server.ts`)
   - Server-side notification sending
   - Payload creation utilities
   - Subscription validation

## Setup Instructions

### 1. Install Dependencies

```bash
npm install web-push
npm install --save-dev @types/web-push
```

### 2. Generate VAPID Keys

```javascript
const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();

console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
```

### 3. Environment Variables

Add to your `.env` file:

```env
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:your-email@example.com
```

### 4. Database Schema

Add push subscription storage to your database:

```sql
-- Example schema for push subscriptions
CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for efficient user lookups
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
```

### 5. Update Server Implementation

Update the API routes to use actual database operations and web-push library:

```typescript
// app/routes/api.push.subscribe.ts
import webpush from 'web-push';
import { db } from '~/utils/db.server';

// Configure VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function action({ request }: ActionFunctionArgs) {
  // ... existing code ...
  
  // Store subscription in database
  await db.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      updatedAt: new Date()
    },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth
    }
  });
}
```

## Usage Examples

### Sending a Message Notification

```typescript
import { 
  sendPushNotificationToMultiple, 
  createMessageNotificationPayload 
} from '~/utils/push-notifications.server';

// Get user's push subscriptions from database
const subscriptions = await db.pushSubscription.findMany({
  where: { userId: recipientId }
});

// Create notification payload
const payload = createMessageNotificationPayload(
  senderName,
  messageText,
  conversationId,
  messageId
);

// Send to all user's devices
const result = await sendPushNotificationToMultiple(subscriptions, payload);
console.log(`Sent to ${result.successCount} devices`);
```

### Sending a Payment Notification

```typescript
const payload = createPaymentNotificationPayload(
  '$50.00',
  'Monthly membership fee',
  paymentId
);

await sendPushNotificationToMultiple(userSubscriptions, payload);
```

### Sending a Class Reminder

```typescript
const payload = createAttendanceNotificationPayload(
  'Advanced Karate',
  '6:00 PM',
  classId
);

await sendPushNotificationToMultiple(userSubscriptions, payload);
```

## Notification Types

The system supports four types of notifications:

1. **Message** - New chat messages
   - Actions: View Message, Quick Reply
   - Requires interaction
   - Custom vibration pattern

2. **Payment** - Payment confirmations
   - Actions: View Details
   - Requires interaction
   - Distinctive vibration

3. **Attendance** - Class reminders
   - Actions: View Class
   - No interaction required
   - Gentle vibration

4. **Announcement** - General announcements
   - Actions: View Details
   - No interaction required
   - Simple vibration

## Security Considerations

1. **VAPID Keys**: Store securely and never expose private keys
2. **Subscription Validation**: Always validate subscription data
3. **User Consent**: Only send notifications to users who opted in
4. **Rate Limiting**: Implement rate limiting for notification sending
5. **Data Privacy**: Don't include sensitive data in notification payloads

## Testing

### Manual Testing

1. Open the app and go to notification settings
2. Enable notifications and push notifications
3. Use the "Test Push" button to send a test notification
4. Close the app and verify notifications still work

### Automated Testing

```typescript
// Example test for push notification API
describe('Push Notification API', () => {
  it('should subscribe user to push notifications', async () => {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'test-endpoint',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
      })
    });
    
    expect(response.ok).toBe(true);
  });
});
```

## Troubleshooting

### Common Issues

1. **Notifications not appearing**
   - Check browser notification permissions
   - Verify service worker registration
   - Check console for errors

2. **Push subscription fails**
   - Verify VAPID keys are correct
   - Check network connectivity
   - Ensure HTTPS is used

3. **Service worker not updating**
   - Clear browser cache
   - Check service worker update logic
   - Verify file changes are deployed

### Debug Tools

1. **Browser DevTools**
   - Application tab → Service Workers
   - Application tab → Storage → IndexedDB
   - Console for error messages

2. **Push Testing Tools**
   - Chrome DevTools → Application → Push Messaging
   - Web Push Testing tools online

## Browser Support

- **Chrome**: Full support
- **Firefox**: Full support
- **Safari**: iOS 16.4+ and macOS 13+
- **Edge**: Full support

## Performance Considerations

1. **Payload Size**: Keep notification payloads small (< 4KB)
2. **Subscription Cleanup**: Remove invalid subscriptions regularly
3. **Batch Sending**: Send notifications in batches for large user bases
4. **TTL Settings**: Set appropriate Time-To-Live for notifications

## Future Enhancements

1. **Rich Notifications**: Add images and more interactive elements
2. **Notification Scheduling**: Schedule notifications for specific times
3. **User Preferences**: More granular notification settings
4. **Analytics**: Track notification delivery and engagement
5. **A/B Testing**: Test different notification formats

## Resources

- [Web Push Protocol](https://tools.ietf.org/html/rfc8030)
- [Push API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [web-push Library](https://github.com/web-push-libs/web-push)