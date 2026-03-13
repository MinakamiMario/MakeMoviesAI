-- ============================================================
-- Admin Dashboard: audit_log, reports, admin RPCs
-- ============================================================

-- ==================== TABLES ====================

-- Audit log: immutable record of all admin actions
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES public.profiles(id),
  action      text NOT NULL,
  target_type text,
  target_id   uuid,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON public.audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON public.audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
  ON public.audit_log FOR SELECT
  USING (public.is_admin());

-- User-submitted content reports
CREATE TABLE IF NOT EXISTS public.reports (
  id          uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id),
  target_type text NOT NULL CHECK (target_type IN ('comment', 'contribution', 'project', 'user', 'message')),
  target_id   uuid NOT NULL,
  reason      text NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate_content', 'copyright', 'other')),
  description text CHECK (char_length(description) <= 500),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  admin_notes text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can report content"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can see own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can see all reports"
  ON public.reports FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update reports"
  ON public.reports FOR UPDATE
  USING (public.is_admin());

-- ==================== USER-FACING RPC ====================

-- Submit a report (rate limited, deduplicated)
CREATE OR REPLACE FUNCTION public.submit_report(
  p_target_type text,
  p_target_id   uuid,
  p_reason      text,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_report_id uuid;
  v_recent boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_target_type NOT IN ('comment', 'contribution', 'project', 'user', 'message') THEN
    RETURN jsonb_build_object('error', 'Invalid target type');
  END IF;

  IF p_reason NOT IN ('spam', 'harassment', 'inappropriate_content', 'copyright', 'other') THEN
    RETURN jsonb_build_object('error', 'Invalid reason');
  END IF;

  IF p_target_type = 'user' AND p_target_id = v_user_id THEN
    RETURN jsonb_build_object('error', 'Cannot report yourself');
  END IF;

  -- Rate limit: 10 reports per 60 min
  IF NOT public.check_rate_limit(v_user_id, 'report', 10, 60) THEN
    RETURN jsonb_build_object('error', 'Too many reports. Please wait.');
  END IF;

  -- Dedup: one report per user per target per 24h
  SELECT EXISTS(
    SELECT 1 FROM public.reports
    WHERE reporter_id = v_user_id
      AND target_type = p_target_type
      AND target_id = p_target_id
      AND created_at > now() - interval '24 hours'
  ) INTO v_recent;

  IF v_recent THEN
    RETURN jsonb_build_object('error', 'Already reported recently');
  END IF;

  INSERT INTO public.reports (reporter_id, target_type, target_id, reason, description)
  VALUES (v_user_id, p_target_type, p_target_id, p_reason, p_description)
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object('success', true, 'report_id', v_report_id);
END;
$$;

-- ==================== ADMIN RPCs ====================

-- Dashboard stats (single RPC)
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_users      bigint;
  v_total_projects   bigint;
  v_total_comments   bigint;
  v_total_contributions bigint;
  v_total_views      bigint;
  v_pending_reports  bigint;
  v_signups_7d       bigint;
  v_signups_30d      bigint;
  v_projects_7d      bigint;
  v_contributions_7d bigint;
  v_active_users_7d  bigint;
  v_suspended_count  bigint;
  v_storage_files    bigint;
  v_waitlist_count   bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  SELECT COUNT(*) INTO v_total_users FROM public.profiles;
  SELECT COUNT(*) INTO v_total_projects FROM public.projects;
  SELECT COUNT(*) INTO v_total_comments FROM public.comments;
  SELECT COUNT(*) INTO v_total_contributions FROM public.contributions;
  SELECT COUNT(*) INTO v_total_views FROM public.project_views;
  SELECT COUNT(*) INTO v_pending_reports FROM public.reports WHERE status = 'pending';
  SELECT COUNT(*) INTO v_waitlist_count FROM public.waitlist WHERE status = 'waiting';
  SELECT COUNT(*) INTO v_suspended_count FROM public.profiles WHERE role = 'suspended';
  SELECT COUNT(*) INTO v_storage_files FROM public.media_assets;

  SELECT COUNT(*) INTO v_signups_7d
  FROM public.profiles WHERE created_at >= now() - interval '7 days';

  SELECT COUNT(*) INTO v_signups_30d
  FROM public.profiles WHERE created_at >= now() - interval '30 days';

  SELECT COUNT(*) INTO v_projects_7d
  FROM public.projects WHERE created_at >= now() - interval '7 days';

  SELECT COUNT(*) INTO v_contributions_7d
  FROM public.contributions WHERE created_at >= now() - interval '7 days';

  SELECT COUNT(DISTINCT user_id) INTO v_active_users_7d
  FROM (
    SELECT author_id AS user_id FROM public.comments WHERE created_at >= now() - interval '7 days'
    UNION
    SELECT contributor_id FROM public.contributions WHERE created_at >= now() - interval '7 days'
    UNION
    SELECT director_id FROM public.projects WHERE created_at >= now() - interval '7 days'
  ) active;

  RETURN jsonb_build_object(
    'users', jsonb_build_object(
      'total', v_total_users, 'signups_7d', v_signups_7d, 'signups_30d', v_signups_30d,
      'active_7d', v_active_users_7d, 'suspended', v_suspended_count
    ),
    'content', jsonb_build_object(
      'projects', v_total_projects, 'projects_7d', v_projects_7d,
      'comments', v_total_comments, 'contributions', v_total_contributions,
      'contributions_7d', v_contributions_7d, 'views', v_total_views
    ),
    'moderation', jsonb_build_object('pending_reports', v_pending_reports),
    'infrastructure', jsonb_build_object(
      'media_files', v_storage_files, 'waitlist_pending', v_waitlist_count
    )
  );
END;
$$;

-- Signup chart for sparklines
CREATE OR REPLACE FUNCTION public.admin_get_signup_chart(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('date', d.day::date, 'count', COALESCE(s.cnt, 0))
      ORDER BY d.day
    ), '[]'::jsonb)
    FROM generate_series(
      (now() - (p_days || ' days')::interval)::date,
      now()::date,
      '1 day'::interval
    ) AS d(day)
    LEFT JOIN (
      SELECT created_at::date AS day, COUNT(*) AS cnt
      FROM public.profiles
      WHERE created_at >= now() - (p_days || ' days')::interval
      GROUP BY created_at::date
    ) s ON s.day = d.day::date
  );
END;
$$;

-- User management: list with search, filter, pagination
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search    text DEFAULT NULL,
  p_role      text DEFAULT NULL,
  p_sort      text DEFAULT 'newest',
  p_page      integer DEFAULT 1,
  p_page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total bigint;
  v_users jsonb;
  v_offset integer := (p_page - 1) * p_page_size;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.profiles p
  WHERE (p_search IS NULL OR p.username ILIKE '%' || p_search || '%')
    AND (p_role IS NULL OR p.role = p_role);

  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
  INTO v_users
  FROM (
    SELECT jsonb_build_object(
      'id', p.id, 'username', p.username, 'role', p.role,
      'reputation_score', p.reputation_score,
      'comment_count', p.comment_count, 'contribution_count', p.contribution_count,
      'accepted_count', p.accepted_count, 'referral_count', p.referral_count,
      'created_at', p.created_at,
      'project_count', (SELECT COUNT(*) FROM public.projects WHERE director_id = p.id)
    ) AS row_data
    FROM public.profiles p
    WHERE (p_search IS NULL OR p.username ILIKE '%' || p_search || '%')
      AND (p_role IS NULL OR p.role = p_role)
    ORDER BY
      CASE WHEN p_sort = 'newest' THEN p.created_at END DESC,
      CASE WHEN p_sort = 'oldest' THEN p.created_at END ASC,
      CASE WHEN p_sort = 'most_contributions' THEN p.contribution_count END DESC,
      CASE WHEN p_sort = 'most_reputation' THEN p.reputation_score END DESC,
      p.created_at DESC
    LIMIT p_page_size OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'users', v_users, 'total', v_total,
    'page', p_page, 'total_pages', CEIL(v_total::numeric / p_page_size)
  );
END;
$$;

-- User detail deep-dive
CREATE OR REPLACE FUNCTION public.admin_get_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile jsonb;
  v_projects jsonb;
  v_contributions jsonb;
  v_comments jsonb;
  v_reports_about jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  SELECT jsonb_build_object(
    'id', p.id, 'username', p.username, 'role', p.role, 'bio', p.bio,
    'reputation_score', p.reputation_score, 'comment_count', p.comment_count,
    'contribution_count', p.contribution_count, 'accepted_count', p.accepted_count,
    'referral_count', p.referral_count, 'referral_code', p.referral_code,
    'created_at', p.created_at
  ) INTO v_profile
  FROM public.profiles p WHERE p.id = p_user_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pr.id, 'title', pr.title, 'created_at', pr.created_at
  ) ORDER BY pr.created_at DESC), '[]'::jsonb)
  INTO v_projects
  FROM (SELECT * FROM public.projects WHERE director_id = p_user_id ORDER BY created_at DESC LIMIT 10) pr;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', c.title, 'status', c.status, 'project_id', c.project_id, 'created_at', c.created_at
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_contributions
  FROM (SELECT * FROM public.contributions WHERE contributor_id = p_user_id ORDER BY created_at DESC LIMIT 10) c;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cm.id, 'body', LEFT(cm.body, 100), 'project_id', cm.project_id, 'created_at', cm.created_at
  ) ORDER BY cm.created_at DESC), '[]'::jsonb)
  INTO v_comments
  FROM (SELECT * FROM public.comments WHERE author_id = p_user_id ORDER BY created_at DESC LIMIT 10) cm;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'reason', r.reason, 'status', r.status, 'target_type', r.target_type, 'created_at', r.created_at
  ) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO v_reports_about
  FROM public.reports r
  WHERE (r.target_type = 'user' AND r.target_id = p_user_id);

  RETURN jsonb_build_object(
    'profile', v_profile, 'projects', v_projects,
    'contributions', v_contributions, 'comments', v_comments,
    'reports_about', v_reports_about
  );
END;
$$;

-- Change user role (replaces admin_suspend_user, with audit)
CREATE OR REPLACE FUNCTION public.admin_change_user_role(p_user_id uuid, p_new_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_old_role text;
  v_username text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  IF p_new_role NOT IN ('user', 'admin', 'moderator', 'suspended') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  IF p_user_id = v_admin_id THEN
    RETURN jsonb_build_object('error', 'Cannot change own role');
  END IF;

  SELECT role, username INTO v_old_role, v_username
  FROM public.profiles WHERE id = p_user_id;

  IF v_old_role IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  IF v_old_role = p_new_role THEN
    RETURN jsonb_build_object('error', 'Role unchanged');
  END IF;

  UPDATE public.profiles SET role = p_new_role WHERE id = p_user_id;

  INSERT INTO public.audit_log (admin_id, action, target_type, target_id, metadata)
  VALUES (v_admin_id, 'change_role', 'user', p_user_id,
    jsonb_build_object('old_role', v_old_role, 'new_role', p_new_role, 'username', v_username));

  RETURN jsonb_build_object('success', true, 'old_role', v_old_role, 'new_role', p_new_role);
END;
$$;

-- Reports queue with inline target preview
CREATE OR REPLACE FUNCTION public.admin_get_reports(
  p_status    text DEFAULT 'pending',
  p_page      integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total bigint;
  v_reports jsonb;
  v_offset integer := (p_page - 1) * p_page_size;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.reports WHERE (p_status IS NULL OR status = p_status);

  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at_sort DESC), '[]'::jsonb)
  INTO v_reports
  FROM (
    SELECT jsonb_build_object(
      'id', r.id, 'target_type', r.target_type, 'target_id', r.target_id,
      'reason', r.reason, 'description', r.description, 'status', r.status,
      'created_at', r.created_at,
      'reporter', jsonb_build_object('id', rp.id, 'username', rp.username),
      'target_preview', CASE r.target_type
        WHEN 'comment' THEN (
          SELECT jsonb_build_object('body', LEFT(c.body, 150), 'author', p2.username, 'project_id', c.project_id)
          FROM public.comments c LEFT JOIN public.profiles p2 ON p2.id = c.author_id WHERE c.id = r.target_id
        )
        WHEN 'contribution' THEN (
          SELECT jsonb_build_object('title', co.title, 'contributor', p3.username, 'project_id', co.project_id)
          FROM public.contributions co LEFT JOIN public.profiles p3 ON p3.id = co.contributor_id WHERE co.id = r.target_id
        )
        WHEN 'user' THEN (
          SELECT jsonb_build_object('username', pu.username, 'role', pu.role)
          FROM public.profiles pu WHERE pu.id = r.target_id
        )
        WHEN 'project' THEN (
          SELECT jsonb_build_object('title', pp.title, 'director', pd.username)
          FROM public.projects pp LEFT JOIN public.profiles pd ON pd.id = pp.director_id WHERE pp.id = r.target_id
        )
        ELSE NULL
      END
    ) AS row_data, r.created_at AS created_at_sort
    FROM public.reports r
    JOIN public.profiles rp ON rp.id = r.reporter_id
    WHERE (p_status IS NULL OR r.status = p_status)
    ORDER BY r.created_at DESC
    LIMIT p_page_size OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'reports', v_reports, 'total', v_total,
    'page', p_page, 'total_pages', CEIL(v_total::numeric / p_page_size)
  );
END;
$$;

-- Resolve a report (with optional auto-action)
CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  p_report_id   uuid,
  p_resolution  text,
  p_admin_notes text DEFAULT NULL,
  p_auto_action text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_report   record;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  IF p_resolution NOT IN ('dismissed', 'actioned') THEN
    RETURN jsonb_build_object('error', 'Invalid resolution');
  END IF;

  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
  IF v_report IS NULL THEN
    RETURN jsonb_build_object('error', 'Report not found');
  END IF;

  UPDATE public.reports
  SET status = p_resolution, reviewed_by = v_admin_id, reviewed_at = now(), admin_notes = p_admin_notes
  WHERE id = p_report_id;

  -- Optional auto-action
  IF p_resolution = 'actioned' AND p_auto_action IS NOT NULL THEN
    IF p_auto_action = 'remove_content' THEN
      IF v_report.target_type = 'comment' THEN
        DELETE FROM public.comments WHERE id = v_report.target_id;
      ELSIF v_report.target_type = 'contribution' THEN
        DELETE FROM public.contributions WHERE id = v_report.target_id;
      END IF;
    ELSIF p_auto_action = 'suspend_user' AND v_report.target_type = 'user' THEN
      UPDATE public.profiles SET role = 'suspended' WHERE id = v_report.target_id;
    END IF;
  END IF;

  INSERT INTO public.audit_log (admin_id, action, target_type, target_id, metadata)
  VALUES (v_admin_id, 'resolve_report', 'report', p_report_id,
    jsonb_build_object('resolution', p_resolution, 'auto_action', p_auto_action,
      'original_target_type', v_report.target_type, 'original_target_id', v_report.target_id,
      'admin_notes', p_admin_notes));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Recent activity feed (union all entity types)
CREATE OR REPLACE FUNCTION public.admin_get_recent_activity(p_limit integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_data ORDER BY event_time DESC), '[]'::jsonb)
    FROM (
      (SELECT jsonb_build_object('type', 'signup', 'username', p.username, 'user_id', p.id, 'time', p.created_at
      ) AS row_data, p.created_at AS event_time
      FROM public.profiles p ORDER BY p.created_at DESC LIMIT p_limit)
      UNION ALL
      (SELECT jsonb_build_object('type', 'project', 'title', pr.title, 'project_id', pr.id,
        'username', pf.username, 'time', pr.created_at
      ), pr.created_at
      FROM public.projects pr JOIN public.profiles pf ON pf.id = pr.director_id
      ORDER BY pr.created_at DESC LIMIT p_limit)
      UNION ALL
      (SELECT jsonb_build_object('type', 'contribution', 'title', c.title, 'status', c.status,
        'project_id', c.project_id, 'username', pf.username, 'time', c.created_at
      ), c.created_at
      FROM public.contributions c JOIN public.profiles pf ON pf.id = c.contributor_id
      ORDER BY c.created_at DESC LIMIT p_limit)
      UNION ALL
      (SELECT jsonb_build_object('type', 'comment', 'body', LEFT(cm.body, 80),
        'project_id', cm.project_id, 'username', pf.username, 'time', cm.created_at
      ), cm.created_at
      FROM public.comments cm JOIN public.profiles pf ON pf.id = cm.author_id
      ORDER BY cm.created_at DESC LIMIT p_limit)
    ) combined
    ORDER BY event_time DESC
    LIMIT p_limit
  );
END;
$$;

-- Audit log viewer
CREATE OR REPLACE FUNCTION public.admin_get_audit_log(
  p_page      integer DEFAULT 1,
  p_page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total bigint;
  v_entries jsonb;
  v_offset integer := (p_page - 1) * p_page_size;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.audit_log;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'action', a.action, 'target_type', a.target_type,
    'target_id', a.target_id, 'metadata', a.metadata, 'created_at', a.created_at,
    'admin_username', p.username
  ) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_entries
  FROM (SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT p_page_size OFFSET v_offset) a
  JOIN public.profiles p ON p.id = a.admin_id;

  RETURN jsonb_build_object(
    'entries', v_entries, 'total', v_total,
    'page', p_page, 'total_pages', CEIL(v_total::numeric / p_page_size)
  );
END;
$$;

-- ==================== PATCH EXISTING RPCs (add audit logging) ====================

-- Patched: admin_remove_comment with snapshot
CREATE OR REPLACE FUNCTION public.admin_remove_comment(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_snapshot jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  SELECT jsonb_build_object('body', c.body, 'author_id', c.author_id, 'project_id', c.project_id, 'created_at', c.created_at)
  INTO v_snapshot
  FROM public.comments c WHERE c.id = p_comment_id;

  IF v_snapshot IS NULL THEN
    RETURN jsonb_build_object('error', 'Comment not found');
  END IF;

  DELETE FROM public.comments WHERE id = p_comment_id;

  INSERT INTO public.audit_log (admin_id, action, target_type, target_id, metadata)
  VALUES (v_admin_id, 'remove_comment', 'comment', p_comment_id, v_snapshot);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Patched: admin_remove_contribution with snapshot
CREATE OR REPLACE FUNCTION public.admin_remove_contribution(p_contribution_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_snapshot jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  SELECT jsonb_build_object('title', c.title, 'contributor_id', c.contributor_id, 'project_id', c.project_id, 'status', c.status, 'created_at', c.created_at)
  INTO v_snapshot
  FROM public.contributions c WHERE c.id = p_contribution_id;

  IF v_snapshot IS NULL THEN
    RETURN jsonb_build_object('error', 'Contribution not found');
  END IF;

  DELETE FROM public.contributions WHERE id = p_contribution_id;

  INSERT INTO public.audit_log (admin_id, action, target_type, target_id, metadata)
  VALUES (v_admin_id, 'remove_contribution', 'contribution', p_contribution_id, v_snapshot);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Patched: admin_suspend_user with audit (kept for backwards compat, delegates to admin_change_user_role logic)
CREATE OR REPLACE FUNCTION public.admin_suspend_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_old_role text;
  v_username text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  SELECT role, username INTO v_old_role, v_username
  FROM public.profiles WHERE id = p_user_id;

  IF v_old_role IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  UPDATE public.profiles SET role = 'suspended' WHERE id = p_user_id;

  INSERT INTO public.audit_log (admin_id, action, target_type, target_id, metadata)
  VALUES (v_admin_id, 'suspend_user', 'user', p_user_id,
    jsonb_build_object('old_role', v_old_role, 'username', v_username));

  RETURN jsonb_build_object('success', true);
END;
$$;
