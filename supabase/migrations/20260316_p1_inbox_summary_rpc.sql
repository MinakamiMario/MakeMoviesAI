-- ============================================================
-- P1-2: Inbox summary single RPC (replaces 3 sequential queries)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_inbox_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY updated_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'conversation_id', cp.conversation_id,
      'updated_at', c.updated_at,
      'last_read_at', cp.last_read_at,
      'other_user_id', other_p.id,
      'other_username', other_p.username,
      'last_message_body', lm.body,
      'last_message_at', lm.created_at,
      'last_message_sender_id', lm.sender_id,
      'unread_count', (
        SELECT COUNT(*)
        FROM public.messages m2
        WHERE m2.conversation_id = cp.conversation_id
          AND m2.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
          AND m2.sender_id != v_user_id
      )
    ) AS row_data,
    c.updated_at
    FROM public.conversation_participants cp
    JOIN public.conversations c ON c.id = cp.conversation_id
    JOIN public.conversation_participants other_cp
      ON other_cp.conversation_id = cp.conversation_id
      AND other_cp.user_id != v_user_id
    JOIN public.profiles other_p ON other_p.id = other_cp.user_id
    LEFT JOIN LATERAL (
      SELECT body, created_at, sender_id
      FROM public.messages
      WHERE conversation_id = cp.conversation_id
      ORDER BY created_at DESC
      LIMIT 1
    ) lm ON true
    WHERE cp.user_id = v_user_id
    ORDER BY c.updated_at DESC
  ) sub;

  RETURN v_result;
END;
$$;
