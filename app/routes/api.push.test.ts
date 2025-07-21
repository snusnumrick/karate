import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireUserId } from '~/utils/auth.server';
import { sendPushNotificationToUser } from '~/utils/push-notifications.server';
import { getSupabaseServerClient } from '~/utils/supabase.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const userId = await requireUserId(request);
    const { supabaseServer } = getSupabaseServerClient(request);

    console.log('Test push notification requested for user:', userId);

    // Send a test notification using our push notification service
    const result = await sendPushNotificationToUser(userId, {
      type: 'test',
      title: 'Test Notification',
      body: 'This is a test push notification from your Karate app! 🥋',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: {
        url: '/admin/account',
        timestamp: Date.now(),
        userId: userId,
        conversationId: 'test-conversation'
      },
      actions: [
          {
            action: 'view',
            title: 'View Details',
            icon: '/icon.svg'
          },
          {
            action: 'reply',
            title: 'Quick Reply',
            type: 'text',
            icon: '/icon.svg',
            placeholder: 'Type your reply...'
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: '/icon.svg'
          }
        ]
    }, supabaseServer);

    if (result.success) {
      let message = result.successCount === 0 
        ? 'No push subscriptions found for your account' 
        : `Test notification sent to ${result.successCount} device(s)`;

      if (result.expiredCount && result.expiredCount > 0) {
        message += ` (cleaned up ${result.expiredCount} expired subscription(s))`;
      }

      return json({
        success: true,
        message,
      });
    } else {
      return json({
        success: false,
        message: `Failed to send test notification: ${result.error}`,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error sending test push notification:', error);
    return json({ error: 'Failed to send test notification' }, { status: 500 });
  }
}
