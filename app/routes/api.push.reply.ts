import { ActionFunctionArgs, json } from '@remix-run/node';
import { createClient } from '~/utils/supabase.server';
import type { Database } from '~/types/database.types';

export const action = async ({ request }: ActionFunctionArgs) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: 'Server configuration error' }, { status: 500 });
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);
  const { conversationId, message, userId } = await request.json();

  if (!conversationId || !message || !userId) {
    return json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Assuming you have a 'messages' table
  const { error } = await supabaseAdmin.from('messages').insert([
    {
      conversation_id: conversationId,
      sender_id: userId,
      content: message,
    },
  ]);

  if (error) {
    console.error('Error inserting message:', error);
    return json({ error: 'Failed to save reply' }, { status: 500 });
  }

  return json({ success: true });
};
