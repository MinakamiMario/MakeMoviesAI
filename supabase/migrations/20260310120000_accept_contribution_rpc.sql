-- Atomic accept_contribution RPC
-- Replaces the non-atomic 4-step client-side acceptContribution flow.
-- All operations succeed or fail together within a single transaction.
--
-- SECURITY INVOKER: RLS policies are enforced using the caller's role.
-- Only the project director should be able to call this successfully
-- because the scenes/scene_edges/contributions INSERT/UPDATE policies
-- require director ownership.

CREATE OR REPLACE FUNCTION public.accept_contribution(
  p_contribution_id UUID,
  p_project_id UUID,
  p_branch_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET statement_timeout = '5s'
AS $$
DECLARE
  v_actor_id UUID;
  v_contribution RECORD;
  v_last_scene_id UUID;
  v_scene_count INT;
  v_new_scene_id UUID;
BEGIN
  -- Get the calling user
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch and validate the contribution
  SELECT id, title, description, media_url, contributor_id, status, project_id
    INTO v_contribution
    FROM public.contributions
   WHERE id = p_contribution_id
     AND project_id = p_project_id
     AND status = 'pending'
     FOR UPDATE;  -- Lock the row to prevent concurrent accepts/forks

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contribution not found or not pending';
  END IF;

  -- Verify caller is the project director
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
     WHERE id = p_project_id
       AND director_id = v_actor_id
  ) THEN
    RAISE EXCEPTION 'Only the project director can accept contributions';
  END IF;

  -- Find the last scene in the branch (no outgoing edge)
  SELECT e.to_scene_id INTO v_last_scene_id
    FROM public.scene_edges e
   WHERE e.branch_id = p_branch_id
     AND NOT EXISTS (
       SELECT 1 FROM public.scene_edges e2
        WHERE e2.branch_id = p_branch_id
          AND e2.from_scene_id = e.to_scene_id
     );
  -- v_last_scene_id may be NULL if branch is empty (first scene)

  -- Count existing scenes for scene_order
  SELECT COUNT(*) INTO v_scene_count
    FROM public.scenes
   WHERE project_id = p_project_id;

  -- 1. Insert the new scene
  INSERT INTO public.scenes (
    project_id, title, description, media_url,
    scene_order, contributor_id
  )
  VALUES (
    p_project_id,
    v_contribution.title,
    v_contribution.description,
    v_contribution.media_url,
    v_scene_count + 1,
    v_contribution.contributor_id
  )
  RETURNING id INTO v_new_scene_id;

  -- 2. Create the edge linking last scene → new scene
  INSERT INTO public.scene_edges (
    project_id, branch_id, from_scene_id, to_scene_id, created_by
  )
  VALUES (
    p_project_id, p_branch_id, v_last_scene_id, v_new_scene_id, v_actor_id
  );

  -- 3. Mark contribution as accepted
  UPDATE public.contributions
     SET status = 'accepted'
   WHERE id = p_contribution_id;

  -- 4. Log the decision event
  INSERT INTO public.decision_events (
    project_id, actor_id, event_type,
    contribution_id, result_scene_id, metadata
  )
  VALUES (
    p_project_id, v_actor_id, 'accept_contribution',
    p_contribution_id, v_new_scene_id,
    jsonb_build_object('branch_id', p_branch_id)
  );

  RETURN v_new_scene_id;
END;
$$;

-- Grant execute to authenticated users (RLS enforces director check)
GRANT EXECUTE ON FUNCTION public.accept_contribution(UUID, UUID, UUID) TO authenticated;
