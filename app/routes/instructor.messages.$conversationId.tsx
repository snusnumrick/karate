import { useEffect, useRef } from 'react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@vercel/remix';
import { Link, useFetcher, useLoaderData, useOutletContext, useRevalidator } from '@remix-run/react';
import { getSupabaseServerClient } from '~/utils/supabase.server';
import { resolveInstructorPortalContext } from '~/services/instructor.server';
import { AppBreadcrumb, breadcrumbPatterns } from '~/components/AppBreadcrumb';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { Tables } from '~/types/database.types';
import type { InstructorOutletContext } from '~/routes/instructor';
import MessageView, { type MessageWithSender, type SenderProfile } from '~/components/MessageView';
import MessageInput from '~/components/MessageInput';

interface LoaderData {
  conversation: Tables<'conversations'> & { participantNames: string | null };
  messages: MessageWithSender[];
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
}

interface ActionResponse {
  success?: boolean;
  error?: string;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const conversationId = params.conversationId;
  if (!conversationId) {
    throw redirect('/instructor/messages');
  }

  const { supabaseAdmin, headers, userId, role } = await resolveInstructorPortalContext(request);
  if (!['admin', 'instructor'].includes(role)) {
    throw redirect('/', { headers });
  }

  const { supabaseServer } = getSupabaseServerClient(request);
  const { data: { session } } = await supabaseServer.auth.getSession();
  const accessToken = session?.access_token ?? null;
  const refreshToken = session?.refresh_token ?? null;

  const participation = await supabaseAdmin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (participation.error || !participation.data) {
    throw json({ message: 'You do not have access to this conversation.' }, { status: 403, headers });
  }

  const conversationQuery = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (conversationQuery.error || !conversationQuery.data) {
    throw json({ message: 'Conversation not found.' }, { status: 404, headers });
  }

  const participantRows = await supabaseAdmin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId);

  const rawMessages = await supabaseAdmin
    .from('messages')
    .select('id, conversation_id, content, created_at, sender_id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  const participantIds = (participantRows.data ?? []).map((row) => row.user_id).filter((id): id is string => !!id);
  const senderIds = Array.from(new Set((rawMessages.data ?? []).map((message) => message.sender_id).filter(Boolean))) as string[];
  const profileIds = Array.from(new Set([...participantIds, ...senderIds]));

  type ProfileRow = SenderProfile & { role: string | null };
  let profileRows: ProfileRow[] = [];

  if (profileIds.length > 0) {
    const profilesResult = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .in('id', profileIds);

    profileRows = (profilesResult.data ?? []).map((row) => ({
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      role: row.role,
    }));
  }

  const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]));

  const participantNames = participantIds
    .map((id) => profileMap.get(id))
    .filter((profile): profile is ProfileRow => !!profile && profile.role !== 'admin' && profile.role !== 'instructor')
    .map((profile) => {
      if (profile.first_name || profile.last_name) {
        return `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
      }
      return profile.email;
    })
    .filter(Boolean)
    .join(', ') || null;

  const messages = ((rawMessages.data ?? []).map((message) => {
    const entry = profileMap.get(message.sender_id ?? '');
    const senderProfile: SenderProfile | null = entry
      ? {
          id: entry.id,
          first_name: entry.first_name,
          last_name: entry.last_name,
          email: entry.email,
        }
      : null;
    return { ...message, senderProfile } as MessageWithSender;
  })) as MessageWithSender[];

  const { error: markReadError } = await supabaseAdmin.rpc('mark_conversation_as_read', {
    p_conversation_id: conversationId,
    p_user_id: userId,
  });

  if (markReadError) {
    const message = (markReadError as { message?: string }).message ?? String(markReadError);
    console.error('Instructor conversation: failed to mark read', message);
  }

  const conversationWithNames = { ...conversationQuery.data, participantNames } as LoaderData['conversation'];

  return json<LoaderData>({
    conversation: conversationWithNames,
    messages,
    userId,
    accessToken,
    refreshToken,
  }, { headers });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const conversationId = params.conversationId;
  if (!conversationId) {
    return json({ error: 'Invalid conversation.' }, { status: 400 });
  }

  const { supabaseAdmin, userId, role } = await resolveInstructorPortalContext(request);
  if (!['admin', 'instructor'].includes(role)) {
    return json({ error: 'Permission denied.' }, { status: 403 });
  }
  const formData = await request.formData();
  const content = (formData.get('content') as string | null)?.trim();

  if (!content) {
    return json({ error: 'Message cannot be empty.' }, { status: 400 });
  }

  const { error: participantError } = await supabaseAdmin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (participantError) {
    return json({ error: 'Permission denied.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      content,
    });

  if (error) {
    console.error('Failed to send instructor message:', error.message);
    return json({ error: 'Failed to send message.' }, { status: 500 });
  }

  return json({ success: true });
}

export default function InstructorConversationPage() {
  const { conversation, messages, userId, accessToken, refreshToken } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionResponse>();
  const revalidator = useRevalidator();
  const { supabase, role } = useOutletContext<InstructorOutletContext>();
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      revalidator.revalidate();
      messageInputRef.current?.focus();
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  useEffect(() => {
    messageInputRef.current?.focus();
  }, [messages.length]);

  useEffect(() => {
    if (!supabase || !accessToken || !refreshToken) return;
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Instructor conversation: failed to set Supabase session', message);
    });
  }, [supabase, accessToken, refreshToken]);

  useEffect(() => {
    if (!supabase || !conversation.id) return;
    const channel = supabase
      .channel(`instructor-conversation-${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, () => {
        revalidator.revalidate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Instructor conversation: failed to remove channel', message);
      });
    };
  }, [supabase, conversation.id, revalidator]);

  const title = conversation.subject || conversation.participantNames || 'Conversation';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <AppBreadcrumb items={breadcrumbPatterns.instructorMessageConversation(title)} />

      <div className="rounded-xl border border-border bg-card p-6 shadow">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {conversation.participantNames && (
              <p className="text-sm text-muted-foreground">Participants: {conversation.participantNames}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {role === 'admin' && (
              <Button variant="outline" asChild>
                <Link to="/admin/messages/new">New Message</Link>
              </Button>
            )}
            <Button variant="secondary" asChild>
              <Link to="/instructor/messages">Back to messages</Link>
            </Button>
          </div>
        </div>

        {messages.length === 0 ? (
          <Alert variant="default" className="mb-6">
            <AlertTitle>No messages yet</AlertTitle>
            <AlertDescription>Start the conversation below.</AlertDescription>
          </Alert>
        ) : (
          <MessageView messages={messages} currentUserId={userId} />
        )}

        <div className="mt-6">
          <MessageInput fetcher={fetcher} ref={messageInputRef} />
          {fetcher.data?.error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Failed to send message</AlertTitle>
              <AlertDescription>{fetcher.data.error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
