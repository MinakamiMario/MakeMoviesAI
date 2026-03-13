-- ============================================================
-- P0-7: Fix search_path on all SECURITY DEFINER functions
-- Changes SET search_path TO 'public' → SET search_path = ''
-- All table references use explicit public. prefix
-- ============================================================

-- 1. apply_referral
CREATE OR REPLACE FUNCTION public.apply_referral(p_referral_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_referrer_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND referred_by IS NOT NULL) THEN
    RETURN jsonb_build_object('error', 'Already referred');
  END IF;

  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = LOWER(TRIM(p_referral_code))
    AND id != v_user_id;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid referral code');
  END IF;

  UPDATE public.profiles SET referred_by = v_referrer_id WHERE id = v_user_id;
  UPDATE public.profiles SET referral_count = referral_count + 1 WHERE id = v_referrer_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. find_or_create_conversation
CREATE OR REPLACE FUNCTION public.find_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conversation_id uuid;
  v_current_user_id uuid := auth.uid();
BEGIN
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_current_user_id = other_user_id THEN
    RAISE EXCEPTION 'Cannot message yourself';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT cp1.conversation_id INTO v_conversation_id
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = v_current_user_id
    AND cp2.user_id = other_user_id
    AND (SELECT count(*) FROM public.conversation_participants
         WHERE conversation_id = cp1.conversation_id) = 2
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_current_user_id), (v_conversation_id, other_user_id);

  RETURN v_conversation_id;
END;
$$;

-- 3. fork_contribution
CREATE OR REPLACE FUNCTION public.fork_contribution(p_contribution_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contribution RECORD;
  v_source_project RECORD;
  v_source_branch RECORD;
  v_caller_id UUID;
  v_new_project_id UUID;
  v_new_branch_id UUID;
  v_new_cut_id UUID;
  v_scene_map JSONB := '{}';
  v_old_scene RECORD;
  v_new_scene_id UUID;
  v_old_edge RECORD;
  v_last_scene_id UUID;
  v_contribution_scene_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_contribution
  FROM public.contributions
  WHERE id = p_contribution_id
  FOR UPDATE;

  IF v_contribution IS NULL THEN
    RAISE EXCEPTION 'Contribution not found';
  END IF;

  IF v_contribution.status != 'pending' THEN
    RAISE EXCEPTION 'Contribution already decided (status: %)', v_contribution.status;
  END IF;

  SELECT * INTO v_source_project
  FROM public.projects
  WHERE id = v_contribution.project_id;

  IF v_source_project IS NULL THEN
    RAISE EXCEPTION 'Source project not found';
  END IF;

  IF v_source_project.director_id != v_caller_id THEN
    RAISE EXCEPTION 'Only the director can fork contributions';
  END IF;

  SELECT * INTO v_source_branch
  FROM public.branches
  WHERE project_id = v_source_project.id AND is_default = true;

  IF v_source_branch IS NULL THEN
    RAISE EXCEPTION 'Source project has no default branch';
  END IF;

  INSERT INTO public.projects (
    title, description, director_id,
    forked_from_project_id, forked_at_branch_id, forked_at_scene_id,
    forked_from_contribution_id, forked_by
  ) VALUES (
    v_source_project.title || ' (Fork)',
    'Forked from "' || v_source_project.title || '" — ' || v_contribution.title,
    v_contribution.contributor_id,
    v_source_project.id, v_source_branch.id, v_contribution.parent_scene_id,
    v_contribution.id, v_contribution.contributor_id
  )
  RETURNING id INTO v_new_project_id;

  INSERT INTO public.branches (project_id, name, is_default, created_by)
  VALUES (v_new_project_id, 'Main', true, v_contribution.contributor_id)
  RETURNING id INTO v_new_branch_id;

  INSERT INTO public.cuts (project_id, name, is_default, created_by)
  VALUES (v_new_project_id, 'Default', true, v_contribution.contributor_id)
  RETURNING id INTO v_new_cut_id;

  FOR v_old_scene IN
    SELECT s.*
    FROM public.scenes s
    JOIN public.scene_edges se ON se.to_scene_id = s.id
    WHERE se.branch_id = v_source_branch.id
    ORDER BY s.scene_order
  LOOP
    INSERT INTO public.scenes (project_id, title, description, media_url, scene_order, contributor_id)
    VALUES (v_new_project_id, v_old_scene.title, v_old_scene.description, v_old_scene.media_url,
            v_old_scene.scene_order, v_old_scene.contributor_id)
    RETURNING id INTO v_new_scene_id;
    v_scene_map := v_scene_map || jsonb_build_object(v_old_scene.id::text, v_new_scene_id::text);
  END LOOP;

  FOR v_old_edge IN
    SELECT * FROM public.scene_edges
    WHERE branch_id = v_source_branch.id
    ORDER BY created_at
  LOOP
    INSERT INTO public.scene_edges (project_id, branch_id, from_scene_id, to_scene_id, created_by)
    VALUES (
      v_new_project_id, v_new_branch_id,
      CASE WHEN v_old_edge.from_scene_id IS NULL THEN NULL
           ELSE (v_scene_map ->> v_old_edge.from_scene_id::text)::UUID END,
      (v_scene_map ->> v_old_edge.to_scene_id::text)::UUID,
      v_contribution.contributor_id
    );
  END LOOP;

  SELECT se.to_scene_id INTO v_last_scene_id
  FROM public.scene_edges se
  WHERE se.branch_id = v_new_branch_id
    AND NOT EXISTS (
      SELECT 1 FROM public.scene_edges se2
      WHERE se2.branch_id = v_new_branch_id AND se2.from_scene_id = se.to_scene_id
    );

  INSERT INTO public.scenes (project_id, title, description, media_url, scene_order, contributor_id)
  VALUES (
    v_new_project_id, v_contribution.title, v_contribution.description, v_contribution.media_url,
    (SELECT COALESCE(MAX(scene_order), 0) + 1 FROM public.scenes WHERE project_id = v_new_project_id),
    v_contribution.contributor_id
  )
  RETURNING id INTO v_contribution_scene_id;

  INSERT INTO public.scene_edges (project_id, branch_id, from_scene_id, to_scene_id, created_by)
  VALUES (v_new_project_id, v_new_branch_id, v_last_scene_id, v_contribution_scene_id, v_contribution.contributor_id);

  UPDATE public.contributions SET status = 'forked' WHERE id = p_contribution_id;

  INSERT INTO public.decision_events (project_id, actor_id, event_type, contribution_id, result_new_project_id, metadata)
  VALUES (
    v_source_project.id, v_caller_id, 'fork_contribution', p_contribution_id, v_new_project_id,
    jsonb_build_object('forked_at_scene_id', v_contribution.parent_scene_id, 'forked_at_branch_id', v_source_branch.id)
  );

  RETURN v_new_project_id;
END;
$$;

-- 4. generate_referral_code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := LOWER(SUBSTR(MD5(NEW.id::text || NOW()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

-- 5. get_unread_count
CREATE OR REPLACE FUNCTION public.get_unread_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(sub.cnt)::integer, 0)
  FROM (
    SELECT count(*) AS cnt
    FROM public.conversation_participants cp
    JOIN public.messages m
      ON m.conversation_id = cp.conversation_id
      AND m.created_at > cp.last_read_at
      AND m.sender_id != cp.user_id
    WHERE cp.user_id = auth.uid()
    GROUP BY cp.conversation_id
  ) sub;
$$;

-- 6. get_waitlist_count
CREATE OR REPLACE FUNCTION public.get_waitlist_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COUNT(*)::integer FROM public.waitlist;
$$;

-- 7. handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_username text;
  v_fallback_username text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_username := NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), '');
  v_fallback_username := 'user_' || REPLACE(NEW.id::text, '-', '');

  IF v_username IS NOT NULL THEN
    BEGIN
      INSERT INTO public.profiles (id, username) VALUES (NEW.id, v_username);
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, username) VALUES (NEW.id, v_fallback_username);
    RETURN NEW;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Could not create profile for user %: both username "%" and fallback "%" are taken',
      NEW.id, v_username, v_fallback_username;
  END;
END;
$$;

-- 8. increment_referral_count
CREATE OR REPLACE FUNCTION public.increment_referral_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    UPDATE public.waitlist
    SET referral_count = referral_count + 1
    WHERE id = NEW.referred_by;
  END IF;
  RETURN NEW;
END;
$$;

-- 9. join_waitlist
CREATE OR REPLACE FUNCTION public.join_waitlist(p_email text, p_referral_code text, p_referred_by_code text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referred_by uuid;
  v_position integer;
  v_id uuid;
  v_existing record;
BEGIN
  p_email := LOWER(TRIM(p_email));

  IF p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  SELECT id, position, referral_code INTO v_existing
  FROM public.waitlist WHERE email = p_email;

  IF v_existing.id IS NOT NULL THEN
    RETURN json_build_object(
      'id', v_existing.id,
      'position', v_existing.position,
      'referral_code', v_existing.referral_code,
      'total', (SELECT COUNT(*) FROM public.waitlist),
      'already_exists', true
    );
  END IF;

  IF p_referred_by_code IS NOT NULL AND p_referred_by_code != '' THEN
    SELECT id INTO v_referred_by
    FROM public.waitlist
    WHERE referral_code = p_referred_by_code;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('waitlist_position'));
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position FROM public.waitlist;

  INSERT INTO public.waitlist (email, referral_code, referred_by, position)
  VALUES (p_email, p_referral_code, v_referred_by, v_position)
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'id', v_id,
    'position', v_position,
    'referral_code', p_referral_code,
    'total', v_position,
    'already_exists', false
  );
END;
$$;

-- 10. notify_contribution_decision (already patched for edge_function_url)
CREATE OR REPLACE FUNCTION public.notify_contribution_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
  FROM auth.users au JOIN public.profiles p ON p.id = au.id
  WHERE au.id = NEW.contributor_id;

  IF v_email IS NULL THEN RETURN NEW; END IF;

  SELECT title INTO v_project_title FROM public.projects WHERE id = NEW.project_id;

  v_title := CASE WHEN NEW.status = 'accepted'
    THEN 'Your scene was accepted in "' || COALESCE(v_project_title, 'Untitled') || '"'
    ELSE 'Your contribution to "' || COALESCE(v_project_title, 'Untitled') || '" was forked'
  END;

  INSERT INTO public.notifications (user_id, type, reference_id, project_id, title)
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

  v_url := public.edge_function_url('send-notification');

  BEGIN
    PERFORM extensions.http((
      'POST', v_url,
      ARRAY[extensions.http_header('Content-Type', 'application/json'),
            extensions.http_header('Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true))],
      'application/json', v_payload::text
    )::extensions.http_request);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Email send failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Notification trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 11. notify_new_comment
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
  FROM public.projects p WHERE p.id = NEW.project_id;

  IF v_director_id = NEW.author_id OR v_director_id IS NULL THEN RETURN NEW; END IF;

  SELECT au.email, p.username INTO v_director_email, v_director_username
  FROM auth.users au JOIN public.profiles p ON p.id = au.id
  WHERE au.id = v_director_id;

  IF v_director_email IS NULL THEN RETURN NEW; END IF;

  SELECT username INTO v_author_username FROM public.profiles WHERE id = NEW.author_id;

  INSERT INTO public.notifications (user_id, type, reference_id, project_id, title, body)
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

  v_url := public.edge_function_url('send-notification');

  BEGIN
    PERFORM extensions.http((
      'POST', v_url,
      ARRAY[extensions.http_header('Content-Type', 'application/json'),
            extensions.http_header('Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true))],
      'application/json', v_payload::text
    )::extensions.http_request);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Email send failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Comment notification error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 12. recalc_reputation
CREATE OR REPLACE FUNCTION public.recalc_reputation(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_comments integer;
  v_contributions integer;
  v_accepted integer;
  v_score integer;
BEGIN
  SELECT count(*) INTO v_comments
    FROM public.comments WHERE author_id = p_user_id;

  SELECT count(*) INTO v_contributions
    FROM public.contributions WHERE contributor_id = p_user_id;

  SELECT count(*) INTO v_accepted
    FROM public.contributions
    WHERE contributor_id = p_user_id AND status = 'accepted';

  v_score := v_comments + (v_contributions * 5) + (v_accepted * 20);

  UPDATE public.profiles
  SET comment_count = v_comments,
      contribution_count = v_contributions,
      accepted_count = v_accepted,
      reputation_score = v_score
  WHERE id = p_user_id;
END;
$$;

-- 13. trg_comment_reputation
CREATE OR REPLACE FUNCTION public.trg_comment_reputation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_reputation(NEW.author_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_reputation(OLD.author_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 14. trg_contribution_reputation
CREATE OR REPLACE FUNCTION public.trg_contribution_reputation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_reputation(NEW.contributor_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.recalc_reputation(NEW.contributor_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_reputation(OLD.contributor_id);
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
