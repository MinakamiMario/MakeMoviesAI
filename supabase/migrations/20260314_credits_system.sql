-- Credits system: auto-generated credits roll per project
-- Returns director + scene contributors + accepted contribution contributors

-- =============================================================
-- RPC: get_project_credits
-- =============================================================
CREATE OR REPLACE FUNCTION get_project_credits(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH
  -- Director
  director AS (
    SELECT
      p.id AS user_id,
      p.username,
      'Director' AS role,
      proj.title AS detail,
      0 AS sort_order
    FROM projects proj
    JOIN profiles p ON p.id = proj.director_id
    WHERE proj.id = p_project_id
  ),
  -- Scene contributors (ordered by scene position)
  scene_contributors AS (
    SELECT DISTINCT ON (p.id)
      p.id AS user_id,
      p.username,
      'Scene' AS role,
      s.title AS detail,
      s.scene_order AS sort_order
    FROM scenes s
    JOIN profiles p ON p.id = s.contributor_id
    WHERE s.project_id = p_project_id
      AND s.contributor_id IS NOT NULL
    ORDER BY p.id, s.scene_order ASC
  ),
  -- Accepted contribution contributors (not already scene contributors)
  contribution_contributors AS (
    SELECT DISTINCT ON (p.id)
      p.id AS user_id,
      p.username,
      'Contributor' AS role,
      c.title AS detail,
      1000 + ROW_NUMBER() OVER (ORDER BY c.created_at ASC) AS sort_order
    FROM contributions c
    JOIN profiles p ON p.id = c.contributor_id
    WHERE c.project_id = p_project_id
      AND c.status = 'accepted'
    ORDER BY p.id, c.created_at ASC
  ),
  -- Combine all, deduplicate (director > scene > contributor priority)
  all_credits AS (
    SELECT * FROM director
    UNION ALL
    SELECT * FROM scene_contributors sc
      WHERE sc.user_id NOT IN (SELECT user_id FROM director)
    UNION ALL
    SELECT * FROM contribution_contributors cc
      WHERE cc.user_id NOT IN (SELECT user_id FROM director)
        AND cc.user_id NOT IN (SELECT user_id FROM scene_contributors)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id', user_id,
        'username', username,
        'role', role,
        'detail', detail
      )
      ORDER BY sort_order ASC
    ),
    '[]'::jsonb
  ) INTO v_result
  FROM all_credits;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_project_credits(uuid) TO anon, authenticated;
