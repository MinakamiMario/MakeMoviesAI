-- Project discovery: enhanced browse with stats and sorting
-- Returns projects with scene_count, contribution_count, fork_count

CREATE OR REPLACE FUNCTION get_projects_with_stats(
  p_search text DEFAULT '',
  p_sort text DEFAULT 'newest',
  p_limit int DEFAULT 12,
  p_offset int DEFAULT 0,
  p_genesis_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_total int;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM projects p
  WHERE (p_search = '' OR p.title ILIKE '%' || p_search || '%' OR p.description ILIKE '%' || p_search || '%')
    AND (NOT p_genesis_only OR p.forked_from_project_id IS NULL);

  -- Get projects with stats
  WITH project_stats AS (
    SELECT
      p.id,
      p.title,
      p.description,
      p.director_id,
      p.created_at,
      p.forked_from_project_id,
      pr.username AS director_username,
      pr.reputation_score AS director_reputation,
      COALESCE(sc.scene_count, 0)::int AS scene_count,
      COALESCE(cc.contribution_count, 0)::int AS contribution_count,
      COALESCE(fc.fork_count, 0)::int AS fork_count
    FROM projects p
    JOIN profiles pr ON pr.id = p.director_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS scene_count
      FROM scenes s WHERE s.project_id = p.id
    ) sc ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS contribution_count
      FROM contributions c WHERE c.project_id = p.id
    ) cc ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS fork_count
      FROM projects fp WHERE fp.forked_from_project_id = p.id
    ) fc ON true
    WHERE (p_search = '' OR p.title ILIKE '%' || p_search || '%' OR p.description ILIKE '%' || p_search || '%')
      AND (NOT p_genesis_only OR p.forked_from_project_id IS NULL)
    ORDER BY
      CASE WHEN p_sort = 'newest' THEN extract(epoch FROM p.created_at) END DESC NULLS LAST,
      CASE WHEN p_sort = 'oldest' THEN extract(epoch FROM p.created_at) END ASC NULLS LAST,
      CASE WHEN p_sort = 'title' THEN p.title END ASC NULLS LAST,
      CASE WHEN p_sort = 'most_active' THEN COALESCE(cc.contribution_count, 0) END DESC NULLS LAST,
      CASE WHEN p_sort = 'most_forked' THEN COALESCE(fc.fork_count, 0) END DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'projects', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', ps.id,
        'title', ps.title,
        'description', ps.description,
        'director_id', ps.director_id,
        'created_at', ps.created_at,
        'forked_from_project_id', ps.forked_from_project_id,
        'director_username', ps.director_username,
        'director_reputation', ps.director_reputation,
        'scene_count', ps.scene_count,
        'contribution_count', ps.contribution_count,
        'fork_count', ps.fork_count
      )
    ), '[]'::jsonb),
    'total', v_total
  ) INTO v_result
  FROM project_stats ps;

  RETURN COALESCE(v_result, jsonb_build_object('projects', '[]'::jsonb, 'total', 0));
END;
$$;

GRANT EXECUTE ON FUNCTION get_projects_with_stats(text, text, int, int, boolean) TO anon, authenticated;
