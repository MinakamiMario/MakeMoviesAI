-- SEC-02: Replace hardcoded Edge Function URL with centralized config
-- Single place to change if project migrates or URL changes
-- Applied to production via Supabase MCP on 2026-03-16

-- Config table for app-level settings
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app config"
  ON public.app_config FOR SELECT
  USING (true);

INSERT INTO public.app_config (key, value) VALUES
  ('edge_function_base_url', 'https://dicdmlcrhnunhgltiabg.supabase.co/functions/v1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Helper: get Edge Function URL by name
CREATE OR REPLACE FUNCTION public.edge_function_url(p_function_name text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT value || '/' || p_function_name
  FROM public.app_config
  WHERE key = 'edge_function_base_url';
$$;

-- Recreate notify_contribution_decision with dynamic URL
CREATE OR REPLACE FUNCTION public.notify_contribution_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_username text;
  v_project_title text;
  v_notification_type text;
  v_title text;
  v_payload jsonb;
  v_url text;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('accepted', 'forked') THEN RETURN NEW; END IF;

  v_notification_type := CASE WHEN NEW.status = 'accepted'
    THEN 'contribution_accepted' ELSE 'contribution_forked' END;

  SELECT au.email, p.username INTO v_email, v_username
  FROM auth.users au JOIN profiles p ON p.id = au.id
  WHERE au.id = NEW.contributor_id;

  IF v_email IS NULL THEN RETURN NEW; END IF;

  SELECT title INTO v_project_title FROM projects WHERE id = NEW.project_id;

  v_title := CASE WHEN NEW.status = 'accepted'
    THEN 'Your scene was accepted in "' || COALESCE(v_project_title, 'Untitled') || '"'
    ELSE 'Your contribution to "' || COALESCE(v_project_title, 'Untitled') || '" was forked'
  END;

  INSERT INTO notifications (user_id, type, reference_id, project_id, title)
  VALUES (NEW.contributor_id, v_notification_type, NEW.id, NEW.project_id, v_title);

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

  v_url := edge_function_url('send-notification');

  BEGIN
    PERFORM extensions.http((
      'POST',
      v_url,
      ARRAY[extensions.http_header('Content-Type', 'application/json'), extensions.http_header('Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true))],
      'application/json',
      v_payload::text
    )::extensions.http_request);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Email send failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Notification trigger error: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Recreate notify_new_comment with dynamic URL
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_director_id uuid;
  v_director_email text;
  v_director_username text;
  v_project_title text;
  v_author_username text;
  v_payload jsonb;
  v_url text;
BEGIN
  SELECT p.director_id, p.title INTO v_director_id, v_project_title
  FROM projects p WHERE p.id = NEW.project_id;

  IF v_director_id = NEW.author_id OR v_director_id IS NULL THEN RETURN NEW; END IF;

  SELECT au.email, p.username INTO v_director_email, v_director_username
  FROM auth.users au JOIN profiles p ON p.id = au.id
  WHERE au.id = v_director_id;

  IF v_director_email IS NULL THEN RETURN NEW; END IF;

  SELECT username INTO v_author_username FROM profiles WHERE id = NEW.author_id;

  INSERT INTO notifications (user_id, type, reference_id, project_id, title, body)
  VALUES (
    v_director_id, 'new_comment', NEW.id, NEW.project_id,
    '@' || COALESCE(v_author_username, 'someone') || ' commented on "' || COALESCE(v_project_title, 'Untitled') || '"',
    LEFT(NEW.body, 200)
  );

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

  v_url := edge_function_url('send-notification');

  BEGIN
    PERFORM extensions.http((
      'POST',
      v_url,
      ARRAY[extensions.http_header('Content-Type', 'application/json'), extensions.http_header('Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true))],
      'application/json',
      v_payload::text
    )::extensions.http_request);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Email send failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Comment notification error: %', SQLERRM;
  RETURN NEW;
END;
$function$;
