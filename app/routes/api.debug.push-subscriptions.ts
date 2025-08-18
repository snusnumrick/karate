import { json } from '@remix-run/node';
import { getSupabaseAdminClient } from '~/utils/supabase.server';
import type { Database } from '~/types/database.types';

export async function loader() {
    const supabase = getSupabaseAdminClient();
    
    const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id, endpoint, created_at');
    
    console.log('Push subscriptions:', subscriptions);
    
    return json({ subscriptions });
}