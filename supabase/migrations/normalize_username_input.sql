-- Normalize username input: TRIM whitespace + NULLIF empty strings
-- Prevents whitespace-only strings from being treated as valid username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_username text;
  v_fallback_username text;
BEGIN
  -- Idempotency check
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Extract and normalize username
  v_username := NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), '');
  v_fallback_username := 'user_' || REPLACE(NEW.id::text, '-', '');

  -- Try provided username
  IF v_username IS NOT NULL THEN
    BEGIN
      INSERT INTO public.profiles (id, username)
      VALUES (NEW.id, v_username);
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      -- Username already taken; fall back to deterministic username
      NULL;
    END;
  END IF;

  -- Fallback
  BEGIN
    INSERT INTO public.profiles (id, username)
    VALUES (NEW.id, v_fallback_username);
    RETURN NEW;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION
      'Could not create profile for user %: both username "%" and fallback "%" are taken',
      NEW.id, v_username, v_fallback_username;
  END;
END;
$$;
