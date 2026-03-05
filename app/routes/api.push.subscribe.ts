import { json, type ActionFunctionArgs } from '@remix-run/node';
import { withUserAction } from '~/utils/auth.server';
import { getSupabaseAdminClient } from '~/utils/supabase.server';
import type { PushSubscription } from '~/types/models';

async function actionImpl({ request, userId }: ActionFunctionArgs & { userId: string }) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { endpoint, keys } = await request.json();

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    // Create Supabase admin client for database operations
    const supabase = getSupabaseAdminClient();

    // Store the subscription in the database
    // Use upsert to handle duplicate endpoints (same device re-subscribing)
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'endpoint',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('Database error saving push subscription:', error);
      return json({ error: 'Failed to save subscription to database' }, { status: 500 });
    }

    const subscription = data?.[0] as PushSubscription;

    console.log('Push subscription saved successfully:', {
      userId,
      endpoint: endpoint.substring(0, 50) + '...',
      subscriptionId: subscription?.id
    });

    return json({ 
      success: true, 
      message: 'Subscription saved successfully',
      subscriptionId: subscription?.id 
    });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

export const action = withUserAction(actionImpl);
