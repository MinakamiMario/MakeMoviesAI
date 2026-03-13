-- ============================================================
-- P1-5: Admin moderation system (role column + admin RPCs)
-- ============================================================

-- Add role column to profiles (user/admin/moderator/suspended)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'moderator', 'suspended'));

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Admin: remove a comment
CREATE OR REPLACE FUNCTION public.admin_remove_comment(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  DELETE FROM public.comments WHERE id = p_comment_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Admin: remove a contribution
CREATE OR REPLACE FUNCTION public.admin_remove_contribution(p_contribution_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  DELETE FROM public.contributions WHERE id = p_contribution_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Admin: suspend a user
CREATE OR REPLACE FUNCTION public.admin_suspend_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;

  UPDATE public.profiles SET role = 'suspended' WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
