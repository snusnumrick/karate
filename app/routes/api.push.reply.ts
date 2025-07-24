import { ActionFunctionArgs, json } from '@remix-run/node';
import { getSupabaseServerClient } from '~/utils/supabase.server';

export async function action({ request }: ActionFunctionArgs) {
  console.log(`Received quick reply request... ${request.method}`);
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { supabaseServer } = getSupabaseServerClient(request);
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
      return json({ error: 'User not authenticated' }, { status: 401 });
    }

    console.log(user);

    const { conversationId, message, userId } = await request.json();

    console.log('Quick reply received:', { conversationId, message, userId });

    const userIdCorrected  = userId || user.id;

    // Validate required fields
    if (!conversationId || !message || !userIdCorrected) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(conversationId) || !uuidRegex.test(userIdCorrected)) {
      return json({ error: 'Invalid UUID format' }, { status: 400 });
    }

    // Verify the user is a participant in the conversation
    const { data: participant, error: participantError } = await supabaseServer
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userIdCorrected)
      .single();

    if (participantError || !participant) {
      console.error('User not authorized for conversation:', participantError);
      return json({ error: 'Not authorized for this conversation' }, { status: 403 });
    }

    // Insert the reply message
    const { data: newMessage, error: insertError } = await supabaseServer
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userIdCorrected,
        content: message.trim()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting quick reply:', insertError);
      return json({ error: 'Failed to send reply' }, { status: 500 });
    }

    console.log('Quick reply sent successfully:', newMessage);
    return json({ success: true, messageId: newMessage.id });

  } catch (error) {
    console.error('Error processing quick reply:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
