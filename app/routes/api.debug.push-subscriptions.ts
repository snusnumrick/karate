import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { getSupabaseServerClient } from '~/utils/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);

  try {
    // Fetch all push subscriptions to debug the user_id field
    const { data: pushSubscriptions, error } = await supabaseServer
      .from('push_subscriptions')
      .select('id, user_id, endpoint, created_at');

    if (error) {
      console.error('Error fetching push subscriptions:', error);
      return json({ error: error.message }, { status: 500 });
    }

    console.log('--- Push Subscriptions Debug ---');
    console.log('Total subscriptions:', pushSubscriptions?.length || 0);
    pushSubscriptions?.forEach((sub: any, index: number) => {
      console.log(`Subscription ${index + 1}:`, {
        id: sub.id,
        user_id: sub.user_id,
        user_id_type: typeof sub.user_id,
        endpoint: sub.endpoint?.substring(0, 50) + '...',
        created_at: sub.created_at
      });
    });
    console.log('--- End Push Subscriptions Debug ---');

    return json({
      subscriptions: pushSubscriptions?.map((sub: any) => ({
        id: sub.id,
        user_id: sub.user_id,
        user_id_type: typeof sub.user_id,
        endpoint: sub.endpoint?.substring(0, 50) + '...',
        created_at: sub.created_at
      })) || []
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}