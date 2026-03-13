-- ============================================================
-- P1-3: User profile data single RPC (replaces 6+ sequential queries)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_profile_data(p_username text, p_page_size integer DEFAULT 12)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile record;
  v_project_count int;
  v_contrib_count int;
  v_projects jsonb;
  v_contributions jsonb;
  v_activity jsonb;
BEGIN
  -- Get profile
  SELECT id, username, avatar_url, created_at, reputation_score,
         comment_count, contribution_count, accepted_count, bio, referral_count
  INTO v_profile
  FROM public.profiles
  WHERE username = p_username;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Counts
  SELECT COUNT(*) INTO v_project_count FROM public.projects WHERE director_id = v_profile.id;
  SELECT COUNT(*) INTO v_contrib_count FROM public.contributions WHERE contributor_id = v_profile.id;

  -- First page of projects
  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_projects
  FROM (
    SELECT id, title, description, created_at
    FROM public.projects
    WHERE director_id = v_profile.id
    ORDER BY created_at DESC
    LIMIT p_page_size
  ) p;

  -- First page of contributions with project info
  SELECT COALESCE(jsonb_agg(row_data ORDER BY c_created DESC), '[]'::jsonb)
  INTO v_contributions
  FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'title', c.title, 'status', c.status, 'created_at', c.created_at,
      'projects', CASE WHEN pr.id IS NOT NULL
        THEN jsonb_build_object('id', pr.id, 'title', pr.title)
        ELSE NULL END
    ) AS row_data, c.created_at AS c_created
    FROM public.contributions c
    LEFT JOIN public.projects pr ON pr.id = c.project_id
    WHERE c.contributor_id = v_profile.id
    ORDER BY c.created_at DESC
    LIMIT p_page_size
  ) sub;

  -- Recent activity (5 projects + 10 contributions, merged)
  SELECT COALESCE(jsonb_agg(item ORDER BY item_date DESC), '[]'::jsonb)
  INTO v_activity
  FROM (
    (
      SELECT jsonb_build_object(
        'type', 'project', 'title', p.title, 'project_id', p.id, 'date', p.created_at
      ) AS item, p.created_at AS item_date
      FROM public.projects p
      WHERE p.director_id = v_profile.id
      ORDER BY p.created_at DESC LIMIT 5
    )
    UNION ALL
    (
      SELECT jsonb_build_object(
        'type', CASE WHEN c.status = 'accepted' THEN 'accepted' ELSE 'contribution' END,
        'title', c.title,
        'project_title', pr.title,
        'project_id', pr.id,
        'date', c.created_at
      ) AS item, c.created_at AS item_date
      FROM public.contributions c
      LEFT JOIN public.projects pr ON pr.id = c.project_id
      WHERE c.contributor_id = v_profile.id
      ORDER BY c.created_at DESC LIMIT 10
    )
  ) combined
  LIMIT 10;

  RETURN jsonb_build_object(
    'found', true,
    'profile', row_to_json(v_profile)::jsonb,
    'project_count', v_project_count,
    'contribution_count', v_contrib_count,
    'projects', v_projects,
    'contributions', v_contributions,
    'activity', v_activity
  );
END;
$$;
