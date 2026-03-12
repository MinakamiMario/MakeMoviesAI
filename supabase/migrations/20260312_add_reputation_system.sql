-- Add reputation fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reputation_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contribution_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_count integer NOT NULL DEFAULT 0;

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_profiles_reputation ON public.profiles(reputation_score DESC);

-- Function to recalculate reputation for a user
CREATE OR REPLACE FUNCTION public.recalc_reputation(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comments integer;
  v_contributions integer;
  v_accepted integer;
  v_score integer;
BEGIN
  SELECT count(*) INTO v_comments
    FROM public.comments WHERE author_id = p_user_id;

  SELECT count(*) INTO v_contributions
    FROM public.contributions WHERE contributor_id = p_user_id;

  SELECT count(*) INTO v_accepted
    FROM public.contributions
    WHERE contributor_id = p_user_id AND status = 'accepted';

  -- Score formula: 1 pt per comment, 5 pts per contribution, 20 pts per accepted
  v_score := v_comments + (v_contributions * 5) + (v_accepted * 20);

  UPDATE public.profiles
  SET comment_count = v_comments,
      contribution_count = v_contributions,
      accepted_count = v_accepted,
      reputation_score = v_score
  WHERE id = p_user_id;
END;
$$;

-- Trigger: update reputation on comment insert/delete
CREATE OR REPLACE FUNCTION public.trg_comment_reputation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_reputation(NEW.author_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_reputation(OLD.author_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_change ON public.comments;
CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_comment_reputation();

-- Trigger: update reputation on contribution status change
CREATE OR REPLACE FUNCTION public.trg_contribution_reputation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_reputation(NEW.contributor_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.recalc_reputation(NEW.contributor_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_reputation(OLD.contributor_id);
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_contribution_change ON public.contributions;
CREATE TRIGGER on_contribution_change
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_contribution_reputation();

-- Backfill existing users
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.recalc_reputation(r.id);
  END LOOP;
END;
$$;
