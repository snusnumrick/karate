// Server-side push notification utilities
// This file provides functions to send push notifications from the server

import webpush from 'web-push';

// Configure VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  type: 'message' | 'payment' | 'attendance' | 'announcement' | 'test';
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    conversationId?: string;
    messageId?: string;
    userId?: string;
    timestamp?: number;
    [key: string]: any;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  renotify?: boolean;
  tag?: string;
}

/**
 * Send a push notification to a single subscription
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: NotificationPayload
): Promise<{ success: boolean; error?: string; isExpired?: boolean }> {
  try {
    // Check if VAPID keys are configured
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
      console.warn('VAPID keys not configured, skipping push notification');
      return { success: false, error: 'VAPID keys not configured' };
    }

    const result = await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: 'normal'
      }
    );

    return { success: true };
  } catch (error: any) {
    // Check if this is an expired subscription error
    if (error.statusCode === 410) {
      console.log('Push subscription expired or unsubscribed:', subscription.endpoint);
      return { 
        success: false, 
        error: 'Subscription expired or unsubscribed',
        isExpired: true
      };
    }
    
    // Check for other common FCM errors
    if (error.statusCode === 400) {
      console.warn('Invalid push subscription format:', subscription.endpoint);
      return { 
        success: false, 
        error: 'Invalid subscription format',
        isExpired: true // Treat invalid subscriptions as expired for cleanup
      };
    }

    console.error('Failed to send push notification:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Send push notifications to multiple subscriptions
 */
export async function sendPushNotificationToMultiple(
  subscriptions: PushSubscription[],
  payload: NotificationPayload
): Promise<{
  successCount: number;
  failureCount: number;
  expiredCount: number;
  results: Array<{ subscription: PushSubscription; success: boolean; error?: string; isExpired?: boolean }>;
}> {
  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      const result = await sendPushNotification(subscription, payload);
      return {
        subscription,
        success: result.success,
        error: result.error,
        isExpired: result.isExpired
      };
    })
  );

  const successCount = results.filter(r => r.success).length;
  const expiredCount = results.filter(r => r.isExpired).length;
  const failureCount = results.length - successCount;

  return {
    successCount,
    failureCount,
    expiredCount,
    results
  };
}

/**
 * Clean up expired push subscriptions from the database
 */
export async function cleanupExpiredSubscriptions(
  expiredEndpoints: string[],
  supabaseServer: any
): Promise<{ success: boolean; cleanedCount: number; error?: string }> {
  try {
    if (expiredEndpoints.length === 0) {
      return { success: true, cleanedCount: 0 };
    }

    const { error, count } = await supabaseServer
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints);

    if (error) {
      console.error('Error cleaning up expired subscriptions:', error);
      return { success: false, cleanedCount: 0, error: error.message };
    }

    console.log(`Cleaned up ${count || expiredEndpoints.length} expired push subscriptions`);
    return { success: true, cleanedCount: count || expiredEndpoints.length };
  } catch (error) {
    console.error('Error cleaning up expired subscriptions:', error);
    return { 
      success: false, 
      cleanedCount: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Send push notification to a user by their user ID
 * Gets all push subscriptions for the user and sends the notification to all devices
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: NotificationPayload,
  supabaseServer: any
): Promise<{ success: boolean; error?: string; successCount?: number; expiredCount?: number }> {
  try {
    // Get push subscriptions for the user
    const { data: pushSubscriptions, error } = await supabaseServer
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching push subscriptions:', error);
      return { success: false, error: 'Failed to fetch push subscriptions' };
    }

    if (!pushSubscriptions || pushSubscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return { success: true, successCount: 0, expiredCount: 0 };
    }

    // Convert to PushSubscription format
    const subscriptions = pushSubscriptions.map((sub: { endpoint: string; p256dh: string; auth: string }) => ({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    }));

    // Send notifications to all user's devices
    const result = await sendPushNotificationToMultiple(subscriptions, payload);
    
    // Clean up expired subscriptions
    if (result.expiredCount > 0) {
      const expiredEndpoints = result.results
        .filter(r => r.isExpired)
        .map(r => r.subscription.endpoint);
      
      const cleanupResult = await cleanupExpiredSubscriptions(expiredEndpoints, supabaseServer);
      if (cleanupResult.success) {
        console.log(`Cleaned up ${cleanupResult.cleanedCount} expired subscriptions for user ${userId}`);
      }
    }
    
    return { 
      success: true, 
      successCount: result.successCount,
      expiredCount: result.expiredCount
    };
  } catch (error) {
    console.error('Error sending push notification to user:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Create a notification payload for a new message
 */
export function createMessageNotificationPayload(
  senderName: string,
  messageText: string,
  conversationId: string,
  messageId: string,
  customUrl?: string
): NotificationPayload {
  const url = customUrl || `/conversations/${conversationId}`;
  
  return {
    type: 'message',
    title: `New message from ${senderName}`,
    body: messageText.length > 100 ? `${messageText.substring(0, 100)}...` : messageText,
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: {
      url,
      conversationId,
      messageId,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View Message',
        icon: '/icon.svg'
      },
      {
        action: 'reply',
        title: 'Quick Reply',
        icon: '/icon.svg'
      }
    ],
    requireInteraction: true,
    vibrate: [200, 100, 200],
    tag: `message-${conversationId}`
  };
}

/**
 * Create a notification payload for payment notifications
 */
export function createPaymentNotificationPayload(
  amount: string,
  description: string,
  paymentId: string
): NotificationPayload {
  return {
    type: 'payment',
    title: 'Payment Received',
    body: `You received ${amount} - ${description}`,
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: {
      url: `/payments/${paymentId}`,
      paymentId,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View Details',
        icon: '/icon.svg'
      }
    ],
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    tag: `payment-${paymentId}`
  };
}

/**
 * Create a notification payload for attendance notifications
 */
export function createAttendanceNotificationPayload(
  className: string,
  time: string,
  classId: string
): NotificationPayload {
  return {
    type: 'attendance',
    title: 'Class Reminder',
    body: `${className} starts at ${time}`,
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: {
      url: `/classes/${classId}`,
      classId,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View Class',
        icon: '/icon.svg'
      }
    ],
    requireInteraction: false,
    vibrate: [100, 50, 100],
    tag: `attendance-${classId}`
  };
}

/**
 * Create a notification payload for announcements
 */
export function createAnnouncementNotificationPayload(
  title: string,
  message: string,
  announcementId: string
): NotificationPayload {
  return {
    type: 'announcement',
    title,
    body: message,
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: {
      url: `/announcements/${announcementId}`,
      announcementId,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View Details',
        icon: '/icon.svg'
      }
    ],
    requireInteraction: false,
    vibrate: [200],
    tag: `announcement-${announcementId}`
  };
}

/**
 * Validate a push subscription object
 */
export function validatePushSubscription(subscription: any): subscription is PushSubscription {
  return (
    subscription &&
    typeof subscription.endpoint === 'string' &&
    subscription.keys &&
    typeof subscription.keys.p256dh === 'string' &&
    typeof subscription.keys.auth === 'string'
  );
}

/**
 * Generate VAPID keys (for initial setup)
 * Note: In production, generate these once and store them securely
 */
export function generateVAPIDKeys(): { publicKey: string; privateKey: string } {
  // TODO: Implement VAPID key generation
  console.log('VAPID key generation not implemented. Use web-push library:');
  console.log('const webpush = require("web-push");');
  console.log('const vapidKeys = webpush.generateVAPIDKeys();');
  
  return {
    publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9f8HtLlVLVWjSrWrTlYhk3ByL1kKSBdHKVxaahvAKd-dQQvfYSAY',
    privateKey: 'placeholder-private-key'
  };
}