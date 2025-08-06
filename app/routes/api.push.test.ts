import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireUserId } from '~/utils/auth.server';
import { sendPushNotificationToUser } from '~/utils/push-notifications.server';
import { getSupabaseServerClient, isUserAdmin } from '~/utils/supabase.server';

export async function action({ request }: ActionFunctionArgs) {
  console.log(`Test push notification action called ${request}`);

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const userId = await requireUserId(request);
    const { supabaseServer } = getSupabaseServerClient(request);

    console.log('Test push notification requested for user:', userId);

    // Determine the appropriate URL based on user role
    const userIsAdmin = await isUserAdmin(userId);
    
    // Generate a dynamic conversation ID for testing
    const testConversationId = `test-conversation-${Date.now()}`;
    
    // Determine the correct URL based on user role
    const testUrl = userIsAdmin 
      ? `/admin/messages/${testConversationId}`
      : `/family/messages/${testConversationId}`;
    
    console.log('🧪 Test notification details:');
    console.log('   - Generated conversation ID:', testConversationId);
    console.log('   - User is admin:', userIsAdmin);
    console.log('   - Generated test URL:', testUrl);

    // Send a test notification using our push notification service
    const result = await sendPushNotificationToUser(userId, {
      type: 'test',
      title: 'Test Notification',
      body: 'This is a test push notification from your Karate app! 🥋 Click "View Message" to test navigation.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: {
        url: testUrl,
        timestamp: Date.now(),
        userId: userId,
        conversationId: testConversationId
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
