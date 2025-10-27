-- Fix get_family_conversation_summaries function to properly handle profile_role enum
-- The issue is that initcap() needs an explicit text cast for the enum type

DROP FUNCTION IF EXISTS get_family_conversation_summaries(UUID);

CREATE OR REPLACE FUNCTION get_family_conversation_summaries(p_user_id UUID)
    RETURNS TABLE
            (
                id                        UUID,
                subject                   TEXT,
                last_message_at           TIMESTAMPTZ,
                participant_display_names TEXT,
                unread_count              BIGINT
            )
    LANGUAGE sql
    SECURITY INVOKER -- Run as the calling user, respecting their RLS
AS
$$
WITH UserConversations AS (
    -- Find conversations the specific user is part of
    SELECT cp.conversation_id, cp.last_read_at
    FROM public.conversation_participants cp
    WHERE cp.user_id = p_user_id),
     ConversationParticipants AS (
         -- Get all participants for those conversations, excluding the calling user
         SELECT cp.conversation_id,
                cp.user_id
         FROM public.conversation_participants cp
                  JOIN UserConversations uc ON cp.conversation_id = uc.conversation_id
         WHERE cp.user_id <> p_user_id -- Exclude the calling user themselves
     ),
     ParticipantDetails AS (
         -- Get profile details for the *other* participants
         SELECT cp.conversation_id,
                p.id AS user_id,
                p.first_name,
                p.last_name,
                p.role,
                p.email -- Include email as fallback
         FROM ConversationParticipants cp
                  JOIN public.profiles p ON cp.user_id = p.id
     ),
     AggregatedNames AS (
         -- Aggregate names for display
         SELECT conversation_id,
                -- Use COALESCE to pick the first non-null name representation
                COALESCE(
                    -- Full name if first and last name exist
                        CASE
                            WHEN pd.first_name IS NOT NULL AND pd.last_name IS NOT NULL
                                THEN pd.first_name || ' ' || pd.last_name
                            ELSE NULL
                            END,
                    -- First name if only first name exists
                        pd.first_name,
                    -- Last name if only last name exists
                        pd.last_name,
                    -- Role if admin/instructor and name missing (fixed cast)
                        CASE
                            WHEN pd.role IN ('admin'::profile_role, 'instructor'::profile_role)
                                THEN initcap(CAST(pd.role AS TEXT))  -- Explicit CAST function instead of ::
                            ELSE NULL
                            END,
                    -- Email prefix as fallback
                        split_part(pd.email, '@', 1),
                    -- User ID prefix as last resort
                        'User ' || substr(pd.user_id::text, 1, 6)
                ) AS display_name
         FROM ParticipantDetails pd),
     FinalParticipantNames AS (
         -- Aggregate unique display names per conversation
         SELECT conversation_id,
                string_agg(DISTINCT display_name, ', ') AS names
         FROM AggregatedNames
         GROUP BY conversation_id),
     UnreadCounts AS (
         -- Calculate unread messages for each conversation for the calling user
         SELECT uc.conversation_id,
                COUNT(m.id) AS count
         FROM UserConversations uc
                  LEFT JOIN public.messages m ON uc.conversation_id = m.conversation_id
             -- Count messages created after the user's last read time for this conversation
             AND m.created_at > COALESCE(uc.last_read_at, '-infinity'::timestamptz)
             -- Exclude messages sent by the user themselves from the unread count
             AND m.sender_id <> p_user_id
         GROUP BY uc.conversation_id)
-- Final selection joining conversations with aggregated names and unread counts
SELECT c.id,
       COALESCE(c.subject, 'Conversation with ' || COALESCE(fpn.names, 'Staff')),
       c.last_message_at,
       COALESCE(fpn.names, 'Staff', 'Conversation ' || substr(c.id::text, 1, 6) || '...') AS participant_display_names,
       COALESCE(unc.count, 0) AS unread_count
FROM public.conversations c
         JOIN UserConversations uc ON c.id = uc.conversation_id
         LEFT JOIN FinalParticipantNames fpn ON c.id = fpn.conversation_id
         LEFT JOIN UnreadCounts unc ON c.id = unc.conversation_id
ORDER BY c.last_message_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_family_conversation_summaries(UUID) TO authenticated;
