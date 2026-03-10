-- MakeMoviesAI RLS Policy Tests
-- Run these tests to verify security policies work correctly
-- Execute via Supabase SQL Editor or psql

-- ============================================================================
-- TEST SETUP
-- ============================================================================

-- Create test schema to avoid polluting public
CREATE SCHEMA IF NOT EXISTS test_rls;

-- Helper function to run test as specific user
CREATE OR REPLACE FUNCTION test_rls.run_as_user(user_id uuid, query text)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Set the JWT claim to simulate the user
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id)::text, true);
  RETURN QUERY EXECUTE query;
END;
$$;

-- Test result tracking
CREATE TABLE IF NOT EXISTS test_rls.results (
  id SERIAL PRIMARY KEY,
  test_name TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  details TEXT,
  run_at TIMESTAMPTZ DEFAULT now()
);

-- Clear previous results
TRUNCATE test_rls.results;

-- ============================================================================
-- TEST DATA SETUP
-- ============================================================================

DO $$
DECLARE
  v_director_id UUID := '11111111-1111-1111-1111-111111111111';
  v_contributor_id UUID := '22222222-2222-2222-2222-222222222222';
  v_outsider_id UUID := '33333333-3333-3333-3333-333333333333';
  v_project_id UUID;
  v_scene_id UUID;
  v_contribution_id UUID;
BEGIN
  -- Clean up any existing test data
  DELETE FROM public.contributions WHERE project_id IN (SELECT id FROM public.projects WHERE title LIKE 'TEST_%');
  DELETE FROM public.scene_edges WHERE project_id IN (SELECT id FROM public.projects WHERE title LIKE 'TEST_%');
  DELETE FROM public.scenes WHERE project_id IN (SELECT id FROM public.projects WHERE title LIKE 'TEST_%');
  DELETE FROM public.branches WHERE project_id IN (SELECT id FROM public.projects WHERE title LIKE 'TEST_%');
  DELETE FROM public.cuts WHERE project_id IN (SELECT id FROM public.projects WHERE title LIKE 'TEST_%');
  DELETE FROM public.projects WHERE title LIKE 'TEST_%';
  DELETE FROM public.profiles WHERE id IN (v_director_id, v_contributor_id, v_outsider_id);

  -- Create test users (bypassing auth.users for testing)
  INSERT INTO public.profiles (id, username) VALUES
    (v_director_id, 'test_director'),
    (v_contributor_id, 'test_contributor'),
    (v_outsider_id, 'test_outsider');

  -- Create test project (owned by director)
  INSERT INTO public.projects (id, title, description, director_id)
  VALUES (gen_random_uuid(), 'TEST_Project', 'Test project for RLS', v_director_id)
  RETURNING id INTO v_project_id;

  -- Create branch
  INSERT INTO public.branches (project_id, name, is_default, created_by)
  VALUES (v_project_id, 'Main', true, v_director_id);

  -- Create scene
  INSERT INTO public.scenes (id, project_id, title, scene_order, contributor_id)
  VALUES (gen_random_uuid(), v_project_id, 'TEST_Scene', 1, v_director_id)
  RETURNING id INTO v_scene_id;

  -- Create contribution (from contributor)
  INSERT INTO public.contributions (id, project_id, parent_scene_id, title, contributor_id, status)
  VALUES (gen_random_uuid(), v_project_id, v_scene_id, 'TEST_Contribution', v_contributor_id, 'pending')
  RETURNING id INTO v_contribution_id;

  -- Store IDs for tests
  PERFORM set_config('test.project_id', v_project_id::text, false);
  PERFORM set_config('test.scene_id', v_scene_id::text, false);
  PERFORM set_config('test.contribution_id', v_contribution_id::text, false);
  PERFORM set_config('test.director_id', v_director_id::text, false);
  PERFORM set_config('test.contributor_id', v_contributor_id::text, false);
  PERFORM set_config('test.outsider_id', v_outsider_id::text, false);
END $$;

-- ============================================================================
-- TEST 1: Anon cannot create projects
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Try to insert as anon (no auth.uid())
  BEGIN
    INSERT INTO public.projects (title, director_id)
    VALUES ('UNAUTHORIZED', '00000000-0000-0000-0000-000000000000');
    
    -- If we get here, the test failed
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Anon cannot create projects', false, 'Insert succeeded when it should have failed');
  EXCEPTION WHEN OTHERS THEN
    -- Expected: RLS violation
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Anon cannot create projects', true, 'Insert blocked as expected: ' || SQLERRM);
  END;
END $$;

-- ============================================================================
-- TEST 2: User can only update own projects
-- ============================================================================
DO $$
DECLARE
  v_project_id UUID := current_setting('test.project_id')::uuid;
  v_outsider_id UUID := current_setting('test.outsider_id')::uuid;
  v_updated INTEGER;
BEGIN
  -- Simulate outsider trying to update director's project
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_outsider_id)::text, true);
  
  UPDATE public.projects 
  SET title = 'HACKED' 
  WHERE id = v_project_id;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  IF v_updated = 0 THEN
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('User can only update own projects', true, 'Update blocked for non-owner');
  ELSE
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('User can only update own projects', false, 'Outsider was able to update project');
  END IF;
  
  -- Reset
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ============================================================================
-- TEST 3: Director can accept contributions (status update)
-- ============================================================================
DO $$
DECLARE
  v_contribution_id UUID := current_setting('test.contribution_id')::uuid;
  v_director_id UUID := current_setting('test.director_id')::uuid;
  v_updated INTEGER;
BEGIN
  -- Simulate director updating contribution
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_director_id)::text, true);
  
  UPDATE public.contributions 
  SET status = 'accepted' 
  WHERE id = v_contribution_id;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  IF v_updated = 1 THEN
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Director can accept contributions', true, 'Status update succeeded');
  ELSE
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Director can accept contributions', false, 'Director could not update contribution');
  END IF;
  
  -- Reset status for next test
  UPDATE public.contributions SET status = 'pending' WHERE id = v_contribution_id;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ============================================================================
-- TEST 4: Non-director cannot accept contributions
-- ============================================================================
DO $$
DECLARE
  v_contribution_id UUID := current_setting('test.contribution_id')::uuid;
  v_outsider_id UUID := current_setting('test.outsider_id')::uuid;
  v_updated INTEGER;
BEGIN
  -- Simulate outsider trying to accept
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_outsider_id)::text, true);
  
  UPDATE public.contributions 
  SET status = 'accepted' 
  WHERE id = v_contribution_id;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  IF v_updated = 0 THEN
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Non-director cannot accept contributions', true, 'Update blocked for non-director');
  ELSE
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Non-director cannot accept contributions', false, 'Outsider was able to accept contribution');
  END IF;
  
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ============================================================================
-- TEST 5: Fork creates correct ownership
-- ============================================================================
DO $$
DECLARE
  v_contribution_id UUID := current_setting('test.contribution_id')::uuid;
  v_director_id UUID := current_setting('test.director_id')::uuid;
  v_contributor_id UUID := current_setting('test.contributor_id')::uuid;
  v_new_project_id UUID;
  v_new_director_id UUID;
BEGIN
  -- Simulate director forking (requires auth context)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_director_id)::text, true);
  
  -- Call fork function
  SELECT public.fork_contribution(v_contribution_id) INTO v_new_project_id;
  
  -- Check the new project's director is the contributor
  SELECT director_id INTO v_new_director_id
  FROM public.projects
  WHERE id = v_new_project_id;
  
  IF v_new_director_id = v_contributor_id THEN
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Fork creates correct ownership', true, 'New project director is the original contributor');
  ELSE
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Fork creates correct ownership', false, 'Director mismatch: expected ' || v_contributor_id || ', got ' || v_new_director_id);
  END IF;
  
  -- Cleanup forked project
  DELETE FROM public.scene_edges WHERE project_id = v_new_project_id;
  DELETE FROM public.scenes WHERE project_id = v_new_project_id;
  DELETE FROM public.branches WHERE project_id = v_new_project_id;
  DELETE FROM public.cuts WHERE project_id = v_new_project_id;
  DELETE FROM public.projects WHERE id = v_new_project_id;
  
  PERFORM set_config('request.jwt.claims', '', true);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_rls.results (test_name, passed, details)
  VALUES ('Fork creates correct ownership', false, 'Fork failed: ' || SQLERRM);
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ============================================================================
-- TEST 6: User cannot fork projects they cannot read (RLS on fork_depth)
-- ============================================================================
-- Note: Since projects are public, this test verifies the function respects RLS
DO $$
DECLARE
  v_depth INTEGER;
BEGIN
  -- get_fork_depth should return NULL for non-existent projects
  SELECT public.get_fork_depth('99999999-9999-9999-9999-999999999999') INTO v_depth;
  
  IF v_depth IS NULL THEN
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('get_fork_depth returns NULL for non-existent project', true, 'Returns NULL as expected');
  ELSE
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('get_fork_depth returns NULL for non-existent project', false, 'Returned ' || v_depth);
  END IF;
END $$;

-- ============================================================================
-- TEST 7: Contributor can update own pending contribution
-- ============================================================================
DO $$
DECLARE
  v_contribution_id UUID;
  v_project_id UUID := current_setting('test.project_id')::uuid;
  v_contributor_id UUID := current_setting('test.contributor_id')::uuid;
  v_scene_id UUID := current_setting('test.scene_id')::uuid;
  v_updated INTEGER;
BEGIN
  -- Create a fresh contribution for this test
  INSERT INTO public.contributions (project_id, parent_scene_id, title, contributor_id, status)
  VALUES (v_project_id, v_scene_id, 'TEST_Editable', v_contributor_id, 'pending')
  RETURNING id INTO v_contribution_id;
  
  -- Simulate contributor updating their own contribution
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_contributor_id)::text, true);
  
  UPDATE public.contributions 
  SET title = 'TEST_Edited' 
  WHERE id = v_contribution_id;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  IF v_updated = 1 THEN
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Contributor can update own pending contribution', true, 'Update succeeded');
  ELSE
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Contributor can update own pending contribution', false, 'Update blocked');
  END IF;
  
  -- Cleanup
  DELETE FROM public.contributions WHERE id = v_contribution_id;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ============================================================================
-- TEST RESULTS
-- ============================================================================
SELECT 
  test_name,
  CASE WHEN passed THEN '✅ PASS' ELSE '❌ FAIL' END as status,
  details
FROM test_rls.results
ORDER BY id;

-- Summary
SELECT 
  COUNT(*) FILTER (WHERE passed) as passed,
  COUNT(*) FILTER (WHERE NOT passed) as failed,
  COUNT(*) as total
FROM test_rls.results;

-- ============================================================================
-- CLEANUP
-- ============================================================================
-- Uncomment to clean up test data:
-- DELETE FROM public.contributions WHERE project_id IN (SELECT id FROM public.projects WHERE title LIKE 'TEST_%');
-- DELETE FROM public.scene_edges WHERE project_id IN (SELECT id FROM public.projects WHERE title LIKE 'TEST_%');
-- DELETE FROM public.scenes WHERE project_id IN (SELECT id FROM public.projects WHERE title LIKE 'TEST_%');
-- DELETE FROM public.branches WHERE project_id IN (SELECT id FROM public.projects WHERE title LIKE 'TEST_%');
-- DELETE FROM public.cuts WHERE project_id IN (SELECT id FROM public.projects WHERE title LIKE 'TEST_%');
-- DELETE FROM public.projects WHERE title LIKE 'TEST_%';
-- DELETE FROM public.profiles WHERE username LIKE 'test_%';
-- DROP SCHEMA test_rls CASCADE;

-- ============================================================================
-- CROSS-PROJECT UPLOAD INJECTION TESTS (P1 Security Fix)
-- ============================================================================

DO $$
DECLARE
  v_director_a UUID := '11111111-1111-1111-1111-111111111111';
  v_director_b UUID := '44444444-4444-4444-4444-444444444444';
  v_project_a UUID;
  v_project_b UUID;
  v_result JSONB;
BEGIN
  -- Setup: Create two directors with their own projects
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (v_director_b, 'director_b', 'Director B')
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.projects (title, director_id)
  VALUES ('Project A', v_director_a)
  RETURNING id INTO v_project_a;
  
  INSERT INTO public.projects (title, director_id)
  VALUES ('Project B', v_director_b)
  RETURNING id INTO v_project_b;
  
  -- TEST: Director A can upload to Project A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_director_a)::text, true);
  BEGIN
    SELECT public.generate_upload_url(v_project_a, 'test.mp4', 'video/mp4') INTO v_result;
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Director can upload to own project', TRUE, v_result::text);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Director can upload to own project', FALSE, SQLERRM);
  END;
  
  -- TEST: Director A CANNOT upload to Project B (owned by Director B)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_director_a)::text, true);
  BEGIN
    SELECT public.generate_upload_url(v_project_b, 'malicious.mp4', 'video/mp4') INTO v_result;
    -- If we get here, the test FAILED (should have raised exception)
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Director CANNOT upload to other project', FALSE, 'Expected exception but got: ' || v_result::text);
  EXCEPTION WHEN OTHERS THEN
    -- Expected to fail - test PASSED
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Director CANNOT upload to other project', TRUE, 'Correctly rejected: ' || SQLERRM);
  END;
  
  -- TEST: Unauthenticated user cannot upload
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    SELECT public.generate_upload_url(v_project_a, 'anon.mp4', 'video/mp4') INTO v_result;
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Unauthenticated CANNOT upload', FALSE, 'Expected exception but got: ' || v_result::text);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_rls.results (test_name, passed, details)
    VALUES ('Unauthenticated CANNOT upload', TRUE, 'Correctly rejected: ' || SQLERRM);
  END;
  
  -- Cleanup
  DELETE FROM public.projects WHERE id IN (v_project_a, v_project_b);
  DELETE FROM public.profiles WHERE id = v_director_b;
END;
$$;

-- ============================================================================
-- SHOW ALL TEST RESULTS
-- ============================================================================

SELECT 
  test_name,
  CASE WHEN passed THEN '✅ PASS' ELSE '❌ FAIL' END AS status,
  details
FROM test_rls.results
ORDER BY id;

-- Summary
SELECT 
  COUNT(*) FILTER (WHERE passed) AS passed,
  COUNT(*) FILTER (WHERE NOT passed) AS failed,
  COUNT(*) AS total
FROM test_rls.results;
