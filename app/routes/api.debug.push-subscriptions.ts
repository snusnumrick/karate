import { json } from '@remix-run/node';
import { createClient } from '~/utils/supabase.server';
import type { Database } from '~/types/database.types';

export async function loader() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables required for debug endpoint.');
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
    
    const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id, endpoint, created_at');
    
    console.log('Push subscriptions:', subscriptions);
    
    return json({ subscriptions });
}