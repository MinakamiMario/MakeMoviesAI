-- MakeMoviesAI Seed Data
-- Run this after initial_schema.sql to populate demo data
-- This creates a complete scenario: 1 main project + 1 fork + scenes + contributions

-- ============================================================================
-- DEMO USERS (requires manual signup or service_role key)
-- ============================================================================
-- These users must be created via Supabase Auth first.
-- After signup, their profiles are auto-created by the handle_new_user trigger.
-- 
-- For local development, create users via:
--   supabase auth admin createUser --email=director@demo.com --password=demo1234 --email-confirm
--   supabase auth admin createUser --email=contributor@demo.com --password=demo1234 --email-confirm

-- ============================================================================
-- SEED DATA (run after users exist)
-- ============================================================================
-- This script uses placeholders. Replace UUIDs with actual user IDs after signup.

DO $$
DECLARE
  v_director_id UUID;
  v_contributor_id UUID;
  v_main_project_id UUID;
  v_fork_project_id UUID;
  v_main_branch_id UUID;
  v_fork_branch_id UUID;
  v_scene1_id UUID;
  v_scene2_id UUID;
  v_scene3_id UUID;
  v_scene4_id UUID;
  v_scene5_id UUID;
  v_contribution_id UUID;
BEGIN
  -- Get first two users (assumes they exist)
  SELECT id INTO v_director_id FROM public.profiles ORDER BY created_at LIMIT 1;
  SELECT id INTO v_contributor_id FROM public.profiles ORDER BY created_at OFFSET 1 LIMIT 1;
  
  IF v_director_id IS NULL THEN
    RAISE NOTICE 'No users found. Create users first via Supabase Auth.';
    RETURN;
  END IF;
  
  -- Use director as contributor if only one user exists
  IF v_contributor_id IS NULL THEN
    v_contributor_id := v_director_id;
  END IF;

  -- ============================================================================
  -- MAIN PROJECT: "The Journey"
  -- ============================================================================
  INSERT INTO public.projects (title, description, director_id)
  VALUES ('The Journey', 'A short film about self-discovery through travel.', v_director_id)
  RETURNING id INTO v_main_project_id;

  -- Create default branch
  INSERT INTO public.branches (project_id, name, is_default, created_by)
  VALUES (v_main_project_id, 'Main', true, v_director_id)
  RETURNING id INTO v_main_branch_id;

  -- Create default cut
  INSERT INTO public.cuts (project_id, name, is_default, created_by)
  VALUES (v_main_project_id, 'Default', true, v_director_id);

  -- Create 5 scenes
  INSERT INTO public.scenes (project_id, title, description, scene_order, contributor_id)
  VALUES (v_main_project_id, 'Opening', 'Character wakes up in an unfamiliar city.', 1, v_director_id)
  RETURNING id INTO v_scene1_id;

  INSERT INTO public.scenes (project_id, title, description, scene_order, contributor_id)
  VALUES (v_main_project_id, 'The Map', 'Finds an old map with mysterious markings.', 2, v_director_id)
  RETURNING id INTO v_scene2_id;

  INSERT INTO public.scenes (project_id, title, description, scene_order, contributor_id)
  VALUES (v_main_project_id, 'First Clue', 'Discovers the first location marked on the map.', 3, v_director_id)
  RETURNING id INTO v_scene3_id;

  INSERT INTO public.scenes (project_id, title, description, scene_order, contributor_id)
  VALUES (v_main_project_id, 'The Mentor', 'Meets an old woman who knows the map''s secret.', 4, v_director_id)
  RETURNING id INTO v_scene4_id;

  INSERT INTO public.scenes (project_id, title, description, scene_order, contributor_id)
  VALUES (v_main_project_id, 'Revelation', 'Realizes the journey was about finding themselves.', 5, v_director_id)
  RETURNING id INTO v_scene5_id;

  -- Create scene edges (timeline graph)
  INSERT INTO public.scene_edges (project_id, branch_id, from_scene_id, to_scene_id, created_by)
  VALUES 
    (v_main_project_id, v_main_branch_id, NULL, v_scene1_id, v_director_id),
    (v_main_project_id, v_main_branch_id, v_scene1_id, v_scene2_id, v_director_id),
    (v_main_project_id, v_main_branch_id, v_scene2_id, v_scene3_id, v_director_id),
    (v_main_project_id, v_main_branch_id, v_scene3_id, v_scene4_id, v_director_id),
    (v_main_project_id, v_main_branch_id, v_scene4_id, v_scene5_id, v_director_id);

  -- ============================================================================
  -- PENDING CONTRIBUTION
  -- ============================================================================
  INSERT INTO public.contributions (project_id, parent_scene_id, title, description, contributor_id, status)
  VALUES (
    v_main_project_id,
    v_scene3_id, -- After "First Clue"
    'Alternative Path',
    'Instead of meeting the mentor, the character takes a wrong turn and ends up at the sea.',
    v_contributor_id,
    'pending'
  )
  RETURNING id INTO v_contribution_id;

  -- ============================================================================
  -- FORK PROJECT: "The Journey (Fork)"
  -- ============================================================================
  -- This simulates what happens when a contribution is forked
  INSERT INTO public.projects (
    title, description, director_id,
    forked_from_project_id, forked_at_scene_id, forked_by
  )
  VALUES (
    'The Journey (Alternative Ending)',
    'A darker take on the original story.',
    v_contributor_id,
    v_main_project_id,
    v_scene3_id,
    v_contributor_id
  )
  RETURNING id INTO v_fork_project_id;

  -- Create default branch for fork
  INSERT INTO public.branches (project_id, name, is_default, created_by)
  VALUES (v_fork_project_id, 'Main', true, v_contributor_id)
  RETURNING id INTO v_fork_branch_id;

  -- Create default cut for fork
  INSERT INTO public.cuts (project_id, name, is_default, created_by)
  VALUES (v_fork_project_id, 'Default', true, v_contributor_id);

  -- Copy scenes 1-3 to fork (simulating fork_contribution behavior)
  DECLARE
    v_fork_scene1_id UUID;
    v_fork_scene2_id UUID;
    v_fork_scene3_id UUID;
    v_fork_scene4_id UUID;
  BEGIN
    INSERT INTO public.scenes (project_id, title, description, scene_order, contributor_id)
    VALUES (v_fork_project_id, 'Opening', 'Character wakes up in an unfamiliar city.', 1, v_director_id)
    RETURNING id INTO v_fork_scene1_id;

    INSERT INTO public.scenes (project_id, title, description, scene_order, contributor_id)
    VALUES (v_fork_project_id, 'The Map', 'Finds an old map with mysterious markings.', 2, v_director_id)
    RETURNING id INTO v_fork_scene2_id;

    INSERT INTO public.scenes (project_id, title, description, scene_order, contributor_id)
    VALUES (v_fork_project_id, 'First Clue', 'Discovers the first location marked on the map.', 3, v_director_id)
    RETURNING id INTO v_fork_scene3_id;

    -- Fork's unique scene
    INSERT INTO public.scenes (project_id, title, description, scene_order, contributor_id)
    VALUES (v_fork_project_id, 'The Storm', 'A sudden storm forces a different path.', 4, v_contributor_id)
    RETURNING id INTO v_fork_scene4_id;

    -- Create edges for fork
    INSERT INTO public.scene_edges (project_id, branch_id, from_scene_id, to_scene_id, created_by)
    VALUES 
      (v_fork_project_id, v_fork_branch_id, NULL, v_fork_scene1_id, v_contributor_id),
      (v_fork_project_id, v_fork_branch_id, v_fork_scene1_id, v_fork_scene2_id, v_contributor_id),
      (v_fork_project_id, v_fork_branch_id, v_fork_scene2_id, v_fork_scene3_id, v_contributor_id),
      (v_fork_project_id, v_fork_branch_id, v_fork_scene3_id, v_fork_scene4_id, v_contributor_id);
  END;

  RAISE NOTICE 'Seed data created successfully!';
  RAISE NOTICE 'Main project: %', v_main_project_id;
  RAISE NOTICE 'Fork project: %', v_fork_project_id;
  RAISE NOTICE 'Pending contribution: %', v_contribution_id;
END $$;
