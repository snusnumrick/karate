import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireUserId } from '~/utils/auth.server';
import { createClient } from '~/utils/supabase.server';
import type { Database } from '~/types/database.types';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const userId = await requireUserId(request);
    const { endpoint, keys } = await request.json();

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    // Create Supabase admin client for database operations
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Push Subscribe] Missing Supabase credentials');
      return json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Store the subscription in the database
    // Use upsert to handle duplicate endpoints (same device re-subscribing)
    const { data, error } = await supabase
      .from('push_subscriptions' as any)
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

    console.log('Push subscription saved successfully:', {
      userId,
      endpoint: endpoint.substring(0, 50) + '...', // Log truncated endpoint for privacy
      subscriptionId: (data as any)?.[0]?.id
    });

    return json({ 
      success: true, 
      message: 'Subscription saved successfully',
      subscriptionId: (data as any)?.[0]?.id 
    });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}