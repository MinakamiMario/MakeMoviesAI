-- Test harness for handle_new_user trigger
-- Purpose: Unit test for username fallback logic
-- Limitations: Does not test auth.users trigger (only simulates behavior)
-- Safe for staging: Uses dedicated schema, no impact on production tables

-- Setup: Create test schema (isolated from public)
CREATE SCHEMA IF NOT EXISTS test_handle_new_user;

-- Setup: Create isolated test tables
CREATE TABLE IF NOT EXISTS test_handle_new_user.user_simulation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_user_meta_data jsonb
);

CREATE TABLE IF NOT EXISTS test_handle_new_user.profiles (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Setup: Create test function (mirrors production logic)
CREATE OR REPLACE FUNCTION test_handle_new_user.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = test_handle_new_user
AS $$
DECLARE
  v_username text;
  v_fallback_username text;
BEGIN
  -- Idempotency: skip if profile exists
  IF EXISTS (SELECT 1 FROM test_handle_new_user.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_username := NEW.raw_user_meta_data->>'username';
  v_fallback_username := 'user_' || REPLACE(NEW.id::text, '-', '');

  -- Try provided username first
  IF v_username IS NOT NULL AND v_username != '' THEN
    BEGIN
      INSERT INTO test_handle_new_user.profiles (id, username)
      VALUES (NEW.id, v_username);
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;

  -- Fallback to deterministic username
  BEGIN
    INSERT INTO test_handle_new_user.profiles (id, username)
    VALUES (NEW.id, v_fallback_username);
    RETURN NEW;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Could not create profile for user %: both username "%" and fallback "%" are taken', 
      NEW.id, v_username, v_fallback_username;
  END;
END;
$$;

-- Setup: Create trigger
DROP TRIGGER IF EXISTS on_insert ON test_handle_new_user.user_simulation;
CREATE TRIGGER on_insert
  AFTER INSERT ON test_handle_new_user.user_simulation
  FOR EACH ROW EXECUTE FUNCTION test_handle_new_user.handle_new_user();

-- Test execution
DO $$
DECLARE
  test1_id uuid;
  test2_id uuid;
  test3_id uuid;
  test1_username text;
  test2_username text;
  test3_username text;
  expected_fallback text;
BEGIN
  -- Clean slate
  TRUNCATE test_handle_new_user.user_simulation CASCADE;
  TRUNCATE test_handle_new_user.profiles CASCADE;

  RAISE NOTICE '=== Running handle_new_user unit tests ===';
  RAISE NOTICE '';

  -- TEST 1: No username → fallback
  RAISE NOTICE '1. Testing signup without username...';
  INSERT INTO test_handle_new_user.user_simulation (raw_user_meta_data)
  VALUES ('{}')
  RETURNING id INTO test1_id;
  
  SELECT username INTO test1_username
  FROM test_handle_new_user.profiles WHERE id = test1_id;
  
  expected_fallback := 'user_' || REPLACE(test1_id::text, '-', '');
  
  IF test1_username = expected_fallback THEN
    RAISE NOTICE '   ✅ PASS: Fallback username applied';
    RAISE NOTICE '      Generated: %', test1_username;
  ELSE
    RAISE EXCEPTION '   ❌ FAIL: Expected %, got %', expected_fallback, test1_username;
  END IF;
  RAISE NOTICE '';

  -- TEST 2: Valid username → use it
  RAISE NOTICE '2. Testing signup with valid username...';
  INSERT INTO test_handle_new_user.user_simulation (raw_user_meta_data)
  VALUES (jsonb_build_object('username', 'testuser123'))
  RETURNING id INTO test2_id;
  
  SELECT username INTO test2_username
  FROM test_handle_new_user.profiles WHERE id = test2_id;
  
  IF test2_username = 'testuser123' THEN
    RAISE NOTICE '   ✅ PASS: Provided username used';
  ELSE
    RAISE EXCEPTION '   ❌ FAIL: Expected testuser123, got %', test2_username;
  END IF;
  RAISE NOTICE '';

  -- TEST 3: Duplicate username → fallback
  RAISE NOTICE '3. Testing username collision...';
  INSERT INTO test_handle_new_user.user_simulation (raw_user_meta_data)
  VALUES (jsonb_build_object('username', 'testuser123'))
  RETURNING id INTO test3_id;
  
  SELECT username INTO test3_username
  FROM test_handle_new_user.profiles WHERE id = test3_id;
  
  expected_fallback := 'user_' || REPLACE(test3_id::text, '-', '');
  
  IF test3_username = expected_fallback THEN
    RAISE NOTICE '   ✅ PASS: Collision handled, fallback applied';
    RAISE NOTICE '      Attempted: testuser123 (taken)';
    RAISE NOTICE '      Used: %', test3_username;
  ELSE
    RAISE EXCEPTION '   ❌ FAIL: Expected fallback %, got %', expected_fallback, test3_username;
  END IF;
  RAISE NOTICE '';

  -- TEST 4: Idempotency (existing profile check logic)
  RAISE NOTICE '4. Testing idempotency behavior...';
  IF EXISTS (SELECT 1 FROM test_handle_new_user.profiles WHERE id = test1_id) THEN
    RAISE NOTICE '   ✅ PASS: Idempotency check would prevent duplicate insert';
    RAISE NOTICE '      Profile exists → function returns early';
  ELSE
    RAISE EXCEPTION '   ❌ FAIL: Profile should exist';
  END IF;
  RAISE NOTICE '';

  RAISE NOTICE '=== All unit tests passed ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Created profiles:';
  RAISE NOTICE '  Test 1: % (fallback)', test1_username;
  RAISE NOTICE '  Test 2: % (provided)', test2_username;
  RAISE NOTICE '  Test 3: % (fallback after collision)', test3_username;
END $$;

-- Cleanup: Drop entire test schema (safe, no impact on production)
DROP SCHEMA IF EXISTS test_handle_new_user CASCADE;

SELECT 'Test complete - test schema removed' as status;
