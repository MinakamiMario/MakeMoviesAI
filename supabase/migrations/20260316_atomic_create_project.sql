-- Atomic project creation: project + tags + branch + cut in one transaction
-- Applied to production via Supabase MCP on 2026-03-16

CREATE OR REPLACE FUNCTION public.create_project_atomic(
  p_title text,
  p_description text DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid;
  v_project_id uuid;
  v_branch_id uuid;
  v_cut_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate title
  IF TRIM(p_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Title is required');
  END IF;

  -- Validate tags (1-5)
  IF array_length(p_tag_ids, 1) IS NULL OR array_length(p_tag_ids, 1) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least one tag is required');
  END IF;
  IF array_length(p_tag_ids, 1) > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum 5 tags allowed');
  END IF;

  -- 1. Create project
  INSERT INTO public.projects (title, description, director_id)
  VALUES (TRIM(p_title), NULLIF(TRIM(COALESCE(p_description, '')), ''), v_user_id)
  RETURNING id INTO v_project_id;

  -- 2. Insert tags
  INSERT INTO public.project_tags (project_id, tag_id)
  SELECT v_project_id, unnest(p_tag_ids);

  -- 3. Create default branch
  INSERT INTO public.branches (project_id, name, created_by, is_default)
  VALUES (v_project_id, 'main', v_user_id, true)
  RETURNING id INTO v_branch_id;

  -- 4. Create default cut
  INSERT INTO public.cuts (project_id, branch_id, title, created_by)
  VALUES (v_project_id, v_branch_id, 'Director''s Cut', v_user_id)
  RETURNING id INTO v_cut_id;

  RETURN jsonb_build_object(
    'success', true,
    'project_id', v_project_id,
    'branch_id', v_branch_id,
    'cut_id', v_cut_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
