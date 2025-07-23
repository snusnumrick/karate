import { ActionFunctionArgs, json } from '@remix-run/node';
import { createClient } from '~/utils/supabase.server';
import type { Database } from '~/types/database.types';

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);
    
    let requestData;
    try {
      requestData = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request JSON:', parseError);
      return json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { conversationId, message, userId } = requestData;
    console.log('api/push/reply received:', { conversationId, message: message?.substring(0, 50) + '...', userId });

    // Validate required fields
    if (!conversationId || !message || !userId) {
      console.error('Missing required fields:', { conversationId: !!conversationId, message: !!message, userId: !!userId });
      return json({ error: 'Missing required fields: conversationId, message, and userId are required' }, { status: 400 });
    }

    // Validate message length
    if (typeof message !== 'string' || message.trim().length === 0) {
      console.error('Invalid message:', typeof message, message?.length);
      return json({ error: 'Message must be a non-empty string' }, { status: 400 });
    }

    if (message.length > 1000) {
      console.error('Message too long:', message.length);
      return json({ error: 'Message too long (max 1000 characters)' }, { status: 400 });
    }

    // Insert the message into the database
    const { data, error } = await supabaseAdmin.from('messages').insert([
      {
        conversation_id: conversationId,
        sender_id: userId,
        content: message.trim(),
        created_at: new Date().toISOString(),
      },
    ]).select('id, created_at');

    if (error) {
      console.error('Database error inserting message:', error);
      return json({ 
        error: 'Failed to save reply', 
        details: error.message 
      }, { status: 500 });
    }

    console.log('Quick reply saved successfully:', data?.[0]?.id);
    return json({ 
      success: true, 
      messageId: data?.[0]?.id,
      timestamp: data?.[0]?.created_at 
    });

  } catch (error) {
    console.error('Unexpected error in push reply API:', error);
    return json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
};
