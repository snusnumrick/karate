import {createClient} from '@supabase/supabase-js';
import type {Database} from '~/types/supabase';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

export async function getCurrentUser() {
    const {data: {user}} = await supabaseClient.auth.getUser();
    return user;
}

export async function signOut() {
    return supabaseClient.auth.signOut();
}
