import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import { createMessageNotificationPayload, sendPushNotificationToMultiple } from '~/utils/push-notifications.server';

export async function action({ request }: ActionFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);

  try {
    // Get the first push subscription for testing
    const { data: pushSubscriptions, error } = await supabaseServer
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .limit(1);

    if (error) {
      console.error('Error fetching push subscriptions:', error);
      return json({ error: error.message }, { status: 500 });
    }

    if (!pushSubscriptions || pushSubscriptions.length === 0) {
      return json({ error: 'No push subscriptions found' }, { status: 404 });
    }

    const subscription = pushSubscriptions[0];
    console.log('--- Test Push Notification Debug ---');
    console.log('Using subscription for user:', subscription.user_id);
    console.log('Subscription endpoint:', subscription.endpoint?.substring(0, 50) + '...');

    // Create a test notification payload
    const payload = createMessageNotificationPayload(
      'Test Sender',
      'This is a test message for debugging quick reply',
      '3bb4031c-83dd-4a81-83db-8a0d5dd65957', // Use the conversation ID from your error
      'test-message-id',
      undefined,
      subscription.user_id // This should be the user ID
    );

    console.log('Test payload created:', JSON.stringify(payload, null, 2));

    // Send the notification
    const subscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    };

    const result = await sendPushNotificationToMultiple([subscriptionData], payload);
    console.log('Test notification result:', result);
    console.log('--- End Test Push Notification Debug ---');

    return json({
      success: true,
      result,
      payload: {
        ...payload,
        // Don't include the full subscription data in the response
        subscription: {
          user_id: subscription.user_id,
          endpoint: subscription.endpoint?.substring(0, 50) + '...'
        }
      }
    });
  } catch (error) {
    console.error('Error in test push notification:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}