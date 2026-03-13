-- ============================================================
-- Sprint 4: Referral System Enhancement
-- ============================================================

-- 1. Add referral_code to profiles (for logged-in users to share)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count int NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;

-- Generate referral codes for existing profiles
UPDATE profiles
SET referral_code = LOWER(SUBSTR(MD5(id::text || created_at::text), 1, 8))
WHERE referral_code IS NULL;

-- 2. Trigger: auto-generate referral code on new profile
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := LOWER(SUBSTR(MD5(NEW.id::text || NOW()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON profiles;
CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code();

-- 3. RPC: Get referral stats for current user
CREATE OR REPLACE FUNCTION get_my_referral_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text;
  v_count int;
  v_referrals jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT referral_code, referral_count
  INTO v_code, v_count
  FROM profiles
  WHERE id = v_user_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'username', p.username,
      'joined_at', p.created_at,
      'reputation_score', p.reputation_score
    ) ORDER BY p.created_at DESC
  ), '[]'::jsonb) INTO v_referrals
  FROM profiles p
  WHERE p.referred_by = v_user_id
  LIMIT 20;

  RETURN jsonb_build_object(
    'referral_code', v_code,
    'referral_count', v_count,
    'referrals', v_referrals
  );
END;
$$;

-- 4. RPC: Apply referral on signup (called after auth)
CREATE OR REPLACE FUNCTION apply_referral(p_referral_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_referrer_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND referred_by IS NOT NULL) THEN
    RETURN jsonb_build_object('error', 'Already referred');
  END IF;

  SELECT id INTO v_referrer_id
  FROM profiles
  WHERE referral_code = LOWER(TRIM(p_referral_code))
    AND id != v_user_id;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid referral code');
  END IF;

  UPDATE profiles SET referred_by = v_referrer_id WHERE id = v_user_id;
  UPDATE profiles SET referral_count = referral_count + 1 WHERE id = v_referrer_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
