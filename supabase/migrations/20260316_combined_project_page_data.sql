-- Combined project page data RPC: replaces 7+ sequential queries with 1 call
-- Uses recursive CTE for scene ordering, lateral join for durations,
-- role-aware contribution filtering, fork depth via get_fork_depth()
-- Applied to production via Supabase MCP on 2026-03-16

CREATE OR REPLACE FUNCTION public.get_project_page_data(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $function$
DECLARE
  v_project jsonb;
  v_director_username text;
  v_director_reputation integer;
  v_parent_title text;
  v_branch_id uuid;
  v_branch_name text;
  v_scenes jsonb;
  v_contributions jsonb;
  v_fork_count integer;
  v_fork_depth integer;
  v_user_id uuid;
  v_is_director boolean;
BEGIN
  v_user_id := auth.uid();

  -- 1. Get project + director info
  SELECT jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'description', p.description,
    'director_id', p.director_id,
    'created_at', p.created_at,
    'forked_from_project_id', p.forked_from_project_id,
    'forked_at_branch_id', p.forked_at_branch_id,
    'forked_at_scene_id', p.forked_at_scene_id,
    'forked_from_contribution_id', p.forked_from_contribution_id,
    'forked_by', p.forked_by
  ),
  pr.username,
  COALESCE(pr.reputation_score, 0)
  INTO v_project, v_director_username, v_director_reputation
  FROM public.projects p
  JOIN public.profiles pr ON pr.id = p.director_id
  WHERE p.id = p_project_id;

  IF v_project IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_is_director := (v_user_id = (v_project->>'director_id')::uuid);

  -- 2. Get parent project title (if fork)
  IF v_project->>'forked_from_project_id' IS NOT NULL THEN
    SELECT title INTO v_parent_title
    FROM public.projects
    WHERE id = (v_project->>'forked_from_project_id')::uuid;
  END IF;

  -- 3. Get default branch
  SELECT id, name INTO v_branch_id, v_branch_name
  FROM public.branches
  WHERE project_id = p_project_id AND is_default = true
  LIMIT 1;

  -- 4. Get ordered scenes with durations (via edges + lateral join)
  IF v_branch_id IS NOT NULL THEN
    WITH RECURSIVE scene_chain AS (
      -- Find the head: a from_scene_id that's not any to_scene_id
      SELECT se.to_scene_id AS scene_id, 1 AS pos
      FROM public.scene_edges se
      WHERE se.branch_id = v_branch_id
        AND se.from_scene_id IS NULL

      UNION ALL

      SELECT se.to_scene_id, sc.pos + 1
      FROM scene_chain sc
      JOIN public.scene_edges se ON se.from_scene_id = sc.scene_id
        AND se.branch_id = v_branch_id
      WHERE sc.pos < 500  -- safety limit
    )
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'project_id', s.project_id,
        'title', s.title,
        'description', s.description,
        'media_url', s.media_url,
        'scene_order', s.scene_order,
        'contributor_id', s.contributor_id,
        'created_at', s.created_at,
        'duration', ma.duration,
        'profiles', CASE WHEN pr.username IS NOT NULL
          THEN jsonb_build_object('username', pr.username, 'reputation_score', pr.reputation_score)
          ELSE NULL END
      ) ORDER BY sc.pos
    ), '[]'::jsonb)
    INTO v_scenes
    FROM scene_chain sc
    JOIN public.scenes s ON s.id = sc.scene_id
    LEFT JOIN public.profiles pr ON pr.id = s.contributor_id
    LEFT JOIN LATERAL (
      SELECT duration FROM public.media_assets
      WHERE scene_id = s.id AND duration IS NOT NULL
      LIMIT 1
    ) ma ON true;
  ELSE
    v_scenes := '[]'::jsonb;
  END IF;

  -- 5. Get pending contributions (role-aware)
  IF v_is_director THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'project_id', c.project_id,
        'parent_scene_id', c.parent_scene_id,
        'title', c.title,
        'description', c.description,
        'media_url', c.media_url,
        'status', c.status,
        'contributor_id', c.contributor_id,
        'created_at', c.created_at,
        'profiles', CASE WHEN pr.username IS NOT NULL
          THEN jsonb_build_object('username', pr.username, 'reputation_score', pr.reputation_score)
          ELSE NULL END
      ) ORDER BY c.created_at DESC
    ), '[]'::jsonb)
    INTO v_contributions
    FROM public.contributions c
    LEFT JOIN public.profiles pr ON pr.id = c.contributor_id
    WHERE c.project_id = p_project_id AND c.status = 'pending';
  ELSIF v_user_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'project_id', c.project_id,
        'parent_scene_id', c.parent_scene_id,
        'title', c.title,
        'description', c.description,
        'media_url', c.media_url,
        'status', c.status,
        'contributor_id', c.contributor_id,
        'created_at', c.created_at,
        'profiles', CASE WHEN pr.username IS NOT NULL
          THEN jsonb_build_object('username', pr.username, 'reputation_score', pr.reputation_score)
          ELSE NULL END
      ) ORDER BY c.created_at DESC
    ), '[]'::jsonb)
    INTO v_contributions
    FROM public.contributions c
    LEFT JOIN public.profiles pr ON pr.id = c.contributor_id
    WHERE c.project_id = p_project_id AND c.status = 'pending' AND c.contributor_id = v_user_id;
  ELSE
    v_contributions := '[]'::jsonb;
  END IF;

  -- 6. Fork count
  SELECT COUNT(*)::integer INTO v_fork_count
  FROM public.projects
  WHERE forked_from_project_id = p_project_id;

  -- 7. Fork depth (if fork)
  IF v_project->>'forked_from_project_id' IS NOT NULL THEN
    SELECT COALESCE(depth, 0) INTO v_fork_depth
    FROM public.get_fork_depth(p_project_id) AS depth;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'project', v_project,
    'director_username', v_director_username,
    'director_reputation', v_director_reputation,
    'parent_title', v_parent_title,
    'branch', CASE WHEN v_branch_id IS NOT NULL
      THEN jsonb_build_object('id', v_branch_id, 'name', v_branch_name)
      ELSE NULL END,
    'scenes', v_scenes,
    'contributions', v_contributions,
    'fork_count', COALESCE(v_fork_count, 0),
    'fork_depth', v_fork_depth,
    'is_director', v_is_director
  );
END;
$function$;
