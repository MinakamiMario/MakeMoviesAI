-- ============================================================
-- P1-1: Comment body validation + rate-limited post_comment RPC
-- ============================================================

-- Add CHECK constraint on comments.body (1-2000 chars)
ALTER TABLE public.comments
  ADD CONSTRAINT chk_comment_body_length
  CHECK (char_length(TRIM(body)) >= 1 AND char_length(body) <= 2000);

-- Rate-limited comment posting RPC
CREATE OR REPLACE FUNCTION public.post_comment(p_project_id uuid, p_body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_comment_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Rate limit: 10 comments per 5 minutes
  IF NOT public.check_rate_limit(v_user_id, 'comment', 10, 5) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before posting more comments.';
  END IF;

  -- Validate body
  IF char_length(TRIM(p_body)) = 0 OR char_length(p_body) > 2000 THEN
    RAISE EXCEPTION 'Comment body must be 1-2000 characters';
  END IF;

  INSERT INTO public.comments (project_id, author_id, body)
  VALUES (p_project_id, v_user_id, TRIM(p_body))
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$$;
