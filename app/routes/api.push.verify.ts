import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireUserId } from '~/utils/auth.server';
import { getSupabaseAdminClient } from '~/utils/supabase.server';
import type { Database } from '~/types/database.types';

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

    // Create Supabase admin client for database operations
    const supabase = getSupabaseAdminClient();

    // Check if the subscription exists in the database for this user
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, user_id, created_at, updated_at')
      .eq('endpoint', endpoint)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No subscription found - this is expected for invalid subscriptions
        return json({ valid: false, message: 'Subscription not found' }, { status: 404 });
      }
      console.error('Database error verifying push subscription:', error);
      return json({ error: 'Failed to verify subscription' }, { status: 500 });
    }

    // Subscription exists and belongs to the user
    return json({ 
      valid: true, 
      message: 'Subscription is valid',
      subscriptionId: data.id
    });

  } catch (error) {
    console.error('Error verifying push subscription:', error);
    return json({ error: 'Failed to verify subscription' }, { status: 500 });
  }
}