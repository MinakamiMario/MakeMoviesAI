-- Waitlist with referral queue for pre-launch signups
-- Each signup gets a position + unique referral code
-- Sharing the referral link increments referral_count on the referrer

-- =============================================================
-- Table
-- =============================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  email text UNIQUE NOT NULL,
  referral_code text UNIQUE NOT NULL,
  referred_by uuid REFERENCES waitlist(id),
  referral_count integer DEFAULT 0,
  position integer NOT NULL,
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'invited', 'joined')),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_position ON waitlist(position);

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Public insert (anon can join)
CREATE POLICY "Anyone can join waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

-- No public reads — only via RPC
-- (We don't want people scraping the waitlist)

-- =============================================================
-- Trigger: increment referral_count on referrer
-- =============================================================
CREATE OR REPLACE FUNCTION increment_referral_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    UPDATE waitlist
    SET referral_count = referral_count + 1
    WHERE id = NEW.referred_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_waitlist_signup
  AFTER INSERT ON waitlist
  FOR EACH ROW EXECUTE FUNCTION increment_referral_count();

-- =============================================================
-- RPC: Atomic waitlist signup
-- =============================================================
-- Returns { id, position, referral_code, total }
-- Handles: position calculation, referral lookup, duplicate guard
CREATE OR REPLACE FUNCTION join_waitlist(
  p_email text,
  p_referral_code text,
  p_referred_by_code text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referred_by uuid;
  v_position integer;
  v_id uuid;
  v_existing record;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));

  -- Basic email validation
  IF p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  -- Check if already on waitlist
  SELECT id, position, referral_code INTO v_existing
  FROM waitlist WHERE email = p_email;

  IF v_existing.id IS NOT NULL THEN
    -- Return existing entry (idempotent)
    RETURN json_build_object(
      'id', v_existing.id,
      'position', v_existing.position,
      'referral_code', v_existing.referral_code,
      'total', (SELECT COUNT(*) FROM waitlist),
      'already_exists', true
    );
  END IF;

  -- Lookup referrer by code
  IF p_referred_by_code IS NOT NULL AND p_referred_by_code != '' THEN
    SELECT id INTO v_referred_by
    FROM waitlist
    WHERE referral_code = p_referred_by_code;
    -- Silently ignore invalid referral codes
  END IF;

  -- Atomic position: advisory lock prevents race conditions
  PERFORM pg_advisory_xact_lock(hashtext('waitlist_position'));
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position FROM waitlist;

  -- Insert
  INSERT INTO waitlist (email, referral_code, referred_by, position)
  VALUES (p_email, p_referral_code, v_referred_by, v_position)
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'id', v_id,
    'position', v_position,
    'referral_code', p_referral_code,
    'total', v_position,
    'already_exists', false
  );
END;
$$;

-- =============================================================
-- RPC: Get waitlist count (public, for "X creators waiting")
-- =============================================================
CREATE OR REPLACE FUNCTION get_waitlist_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::integer FROM waitlist;
$$;
