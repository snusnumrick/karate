import { json } from '@remix-run/node';
import { createServiceRoleClient } from '~/utils/supabase.server';

export async function loader() {
    const supabase = createServiceRoleClient();
    
    const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id, endpoint, created_at');
    
    console.log('Push subscriptions:', subscriptions);
    
    return json({ subscriptions });
}