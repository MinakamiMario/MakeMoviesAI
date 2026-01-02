-- Returns fork depth from the current project up to main (0 = main).
-- Guards:
-- - Respects RLS (SECURITY INVOKER)
-- - Caps recursion via p_max_depth
-- - Cycle detection via path array
-- - statement_timeout safety belt
CREATE OR REPLACE FUNCTION public.get_fork_depth(p_project_id uuid, p_max_depth integer DEFAULT 20)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
SET statement_timeout = '100ms'
AS $$
DECLARE
  v_depth integer;
  v_exists boolean;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Exists check respects RLS: if not visible, treat as not found
  SELECT EXISTS(SELECT 1 FROM public.projects WHERE id = p_project_id)
    INTO v_exists;

  IF NOT v_exists THEN
    RETURN NULL;
  END IF;

  WITH RECURSIVE fc AS (
    SELECT
      p.id,
      p.forked_from_project_id,
      0 as depth,
      ARRAY[p.id]::uuid[] as path
    FROM public.projects p
    WHERE p.id = p_project_id

    UNION ALL

    SELECT
      parent.id,
      parent.forked_from_project_id,
      fc.depth + 1,
      fc.path || parent.id
    FROM public.projects parent
    JOIN fc ON parent.id = fc.forked_from_project_id
    WHERE fc.depth < GREATEST(p_max_depth, 0)
      AND fc.forked_from_project_id IS NOT NULL
      -- cycle guard
      AND NOT (parent.id = ANY(fc.path))
      -- self-loop guard (extra)
      AND parent.forked_from_project_id IS DISTINCT FROM parent.id
  )
  SELECT COALESCE(MAX(depth), 0) INTO v_depth FROM fc;

  RETURN v_depth;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fork_depth(uuid, integer) TO authenticated;
