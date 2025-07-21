import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireUserId } from '~/utils/auth.server';
import { getSupabaseServerClient } from '~/utils/supabase.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const userId = await requireUserId(request);
    const { endpoint } = await request.json();

    if (!endpoint) {
      return json({ error: 'Endpoint is required' }, { status: 400 });
    }

    const { supabaseServer } = getSupabaseServerClient(request);

    // Remove the subscription from the database
    const { error, count } = await supabaseServer
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing push subscription:', error);
      return json({ error: 'Failed to remove subscription from database' }, { status: 500 });
    }

    console.log('Push subscription removed successfully:', {
      userId,
      endpoint: endpoint.substring(0, 50) + '...',
      removedCount: count
    });

    return json({ 
      success: true, 
      message: 'Subscription removed successfully',
      removedCount: count || 0
    });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    return json({ error: 'Failed to remove subscription' }, { status: 500 });
  }
}