-- ============================================================
-- P0-4: Database-Level Rate Limiting
-- Prevents abuse on comments, contributions, messages, exports
-- ============================================================

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup index
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.rate_limits(user_id, action, created_at DESC);

-- Auto-cleanup: delete entries older than 24h (run via pg_cron or app)
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup
  ON public.rate_limits(created_at);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct access — only via SECURITY DEFINER functions
-- (no RLS policies = blocked for all roles via RLS)

-- Rate limit checker function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max_count integer,
  p_window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Count actions in window
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at > now() - (p_window_minutes || ' minutes')::interval;

  IF v_count >= p_max_count THEN
    RETURN false;  -- Rate limited
  END IF;

  -- Record this action
  INSERT INTO public.rate_limits (user_id, action)
  VALUES (p_user_id, p_action);

  RETURN true;  -- Allowed
END;
$$;

-- Cleanup function (call periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.rate_limits WHERE created_at < now() - interval '24 hours';
$$;

-- ============================================================
-- Add rate limit checks to critical RPCs
-- ============================================================

-- Patch send_message: 30 messages per 5 min
CREATE OR REPLACE FUNCTION public.send_message(p_conversation_id uuid, p_body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_message_id uuid;
  v_current_user_id uuid := auth.uid();
BEGIN
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Rate limit: 30 messages per 5 minutes
  IF NOT public.check_rate_limit(v_current_user_id, 'send_message', 30, 5) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before sending more messages.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = v_current_user_id
  ) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  IF char_length(TRIM(p_body)) = 0 OR char_length(p_body) > 5000 THEN
    RAISE EXCEPTION 'Message body must be 1-5000 characters';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES (p_conversation_id, v_current_user_id, TRIM(p_body))
  RETURNING id INTO v_message_id;

  UPDATE public.conversations SET updated_at = now()
  WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;

-- Patch request_project_export: 3 exports per 60 min
CREATE OR REPLACE FUNCTION public.request_project_export(p_project_id uuid, p_resolution text DEFAULT '720p')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_scene_count int;
  v_existing uuid;
  v_request_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Rate limit: 3 exports per hour
  IF NOT public.check_rate_limit(v_user_id, 'export', 3, 60) THEN
    RETURN jsonb_build_object('error', 'Too many export requests. Please wait before trying again.');
  END IF;

  SELECT COUNT(*) INTO v_scene_count
  FROM public.scenes WHERE project_id = p_project_id;

  IF v_scene_count = 0 THEN
    RETURN jsonb_build_object('error', 'No scenes to export');
  END IF;

  SELECT id INTO v_existing
  FROM public.export_requests
  WHERE project_id = p_project_id
    AND requested_by = v_user_id
    AND status IN ('queued', 'processing')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Export already in progress', 'request_id', v_existing);
  END IF;

  INSERT INTO public.export_requests (project_id, requested_by, resolution, scene_count)
  VALUES (p_project_id, v_user_id, p_resolution, v_scene_count)
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

-- Patch track_project_view: already has 1hr dedup, add 100/5min limit for abuse
CREATE OR REPLACE FUNCTION public.track_project_view(p_project_id uuid, p_viewer_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fingerprint text;
  v_recent_view boolean;
BEGIN
  v_fingerprint := COALESCE(p_viewer_id::text, 'anon');

  -- Existing 1-hour dedup
  SELECT EXISTS(
    SELECT 1 FROM public.project_views
    WHERE project_id = p_project_id
      AND session_fingerprint = v_fingerprint
      AND viewed_at > now() - interval '1 hour'
  ) INTO v_recent_view;

  IF NOT v_recent_view THEN
    -- Rate limit for authenticated users: 100 views per 5 min
    IF p_viewer_id IS NOT NULL THEN
      IF NOT public.check_rate_limit(p_viewer_id, 'view', 100, 5) THEN
        RETURN;  -- Silently drop
      END IF;
    END IF;

    INSERT INTO public.project_views (project_id, viewer_id, session_fingerprint)
    VALUES (p_project_id, p_viewer_id, v_fingerprint);
  END IF;
END;
$$;
