-- Notification system: in-app notifications + email via Resend Edge Function
-- Triggers on: contribution accepted/forked, new comment

-- =============================================================
-- Enable pg_net for async HTTP calls from triggers
-- =============================================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- =============================================================
-- Notifications table
-- =============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'contribution_accepted',
    'contribution_forked',
    'new_comment'
  )),
  reference_id uuid,      -- contribution_id or comment_id
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  read boolean DEFAULT false,
  emailed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_all
  ON notifications(user_id, created_at DESC);

-- =============================================================
-- RLS: users can only see/update their own notifications
-- =============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can mark own notifications as read"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No direct INSERT for users — only via SECURITY DEFINER triggers

-- =============================================================
-- Enable realtime for live notification badge updates
-- =============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =============================================================
-- RPC: get unread notification count
-- =============================================================
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM notifications
  WHERE user_id = auth.uid()
    AND read = false;
$$;

-- =============================================================
-- RPC: mark notifications as read
-- =============================================================
CREATE OR REPLACE FUNCTION mark_notifications_read(p_notification_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
  SET read = true
  WHERE id = ANY(p_notification_ids)
    AND user_id = auth.uid();
END;
$$;

-- =============================================================
-- Trigger: contribution decision → notify contributor
-- =============================================================
CREATE OR REPLACE FUNCTION notify_contribution_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_username text;
  v_project_title text;
  v_notification_type text;
  v_title text;
  v_payload jsonb;
  v_edge_url text;
  v_service_key text;
BEGIN
  -- Only fire on status change to accepted/forked
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('accepted', 'forked') THEN RETURN NEW; END IF;

  -- Determine notification type
  v_notification_type := CASE
    WHEN NEW.status = 'accepted' THEN 'contribution_accepted'
    ELSE 'contribution_forked'
  END;

  -- Get contributor email + username
  SELECT au.email, p.username INTO v_email, v_username
  FROM auth.users au
  JOIN profiles p ON p.id = au.id
  WHERE au.id = NEW.contributor_id;

  IF v_email IS NULL THEN RETURN NEW; END IF;

  -- Get project title
  SELECT title INTO v_project_title
  FROM projects WHERE id = NEW.project_id;

  -- Build notification title
  v_title := CASE
    WHEN NEW.status = 'accepted'
    THEN 'Your scene was accepted in "' || COALESCE(v_project_title, 'Untitled') || '"'
    ELSE 'Your contribution to "' || COALESCE(v_project_title, 'Untitled') || '" was forked'
  END;

  -- Insert in-app notification
  INSERT INTO notifications (user_id, type, reference_id, project_id, title)
  VALUES (NEW.contributor_id, v_notification_type, NEW.id, NEW.project_id, v_title);

  -- Send email via Edge Function (async, non-blocking)
  v_payload := jsonb_build_object(
    'type', v_notification_type,
    'payload', jsonb_build_object(
      'recipient_email', v_email,
      'recipient_name', v_username,
      'project_title', COALESCE(v_project_title, 'Untitled'),
      'project_id', NEW.project_id,
      'contribution_title', NEW.title
    )
  );

  -- Use pg_net for async HTTP call to Edge Function
  PERFORM extensions.http_post(
    'https://dicdmlcrhnunhgltiabg.supabase.co/functions/v1/send-notification'::text,
    v_payload::text,
    'application/json'::text
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never let email failure block the contribution decision
    RAISE WARNING 'Notification trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_contribution_decision_notify
  AFTER UPDATE OF status ON contributions
  FOR EACH ROW
  EXECUTE FUNCTION notify_contribution_decision();

-- =============================================================
-- Trigger: new comment → notify project director
-- =============================================================
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_director_id uuid;
  v_director_email text;
  v_director_username text;
  v_project_title text;
  v_author_username text;
  v_payload jsonb;
BEGIN
  -- Get project director
  SELECT p.director_id, p.title INTO v_director_id, v_project_title
  FROM projects p WHERE p.id = NEW.project_id;

  -- Don't notify director about their own comments
  IF v_director_id = NEW.author_id THEN RETURN NEW; END IF;
  IF v_director_id IS NULL THEN RETURN NEW; END IF;

  -- Get director email
  SELECT au.email, p.username INTO v_director_email, v_director_username
  FROM auth.users au
  JOIN profiles p ON p.id = au.id
  WHERE au.id = v_director_id;

  IF v_director_email IS NULL THEN RETURN NEW; END IF;

  -- Get comment author username
  SELECT username INTO v_author_username
  FROM profiles WHERE id = NEW.author_id;

  -- Insert in-app notification
  INSERT INTO notifications (user_id, type, reference_id, project_id, title, body)
  VALUES (
    v_director_id,
    'new_comment',
    NEW.id,
    NEW.project_id,
    '@' || COALESCE(v_author_username, 'someone') || ' commented on "' || COALESCE(v_project_title, 'Untitled') || '"',
    LEFT(NEW.body, 200)
  );

  -- Send email via Edge Function
  v_payload := jsonb_build_object(
    'type', 'new_comment',
    'payload', jsonb_build_object(
      'recipient_email', v_director_email,
      'recipient_name', v_director_username,
      'project_title', COALESCE(v_project_title, 'Untitled'),
      'project_id', NEW.project_id,
      'comment_body', LEFT(NEW.body, 200),
      'comment_author', COALESCE(v_author_username, 'someone')
    )
  );

  PERFORM extensions.http_post(
    'https://dicdmlcrhnunhgltiabg.supabase.co/functions/v1/send-notification'::text,
    v_payload::text,
    'application/json'::text
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Comment notification error: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_comment_notify
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_comment();
