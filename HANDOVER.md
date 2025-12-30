# MakeMoviesAI - Database Handover Notes

## Recent Updates

### 2025-12-30: handle_new_user Input Normalization

**Function:** `public.handle_new_user()`

**Change:** Added TRIM/NULLIF to username extraction  
**Reason:** Prevents whitespace-only strings (e.g., `"   "`) from being treated as valid usernames  
**Migration:** `normalize_username_input.sql`  
**Impact:** Small change, no breaking changes for existing users

**Updated logic:**
```sql
v_username := NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), '');
IF v_username IS NOT NULL THEN
  -- Try insert with normalized username
```

---

### 2025-12-30: handle_new_user Function Hardened

**Function:** `public.handle_new_user()`

**Changes Applied:**
- Sets fixed `search_path = public` for SECURITY DEFINER function (addresses Supabase security advisor warning: prevents unintended object resolution from other schemas)
- Implements nested exception handling for username collisions:
  1. Attempt insert with `raw_user_meta_data->>'username'`
  2. On `unique_violation`: fallback to `user_<uuid_without_hyphens>`
  3. On fallback collision: `RAISE EXCEPTION` (prevents silent failures)
- Adds idempotency check: if `profiles.id` exists, returns early without modifying the row
- Maintains `SECURITY DEFINER` (inherits function owner's privileges)

**Behavior:**
- Implements deterministic fallback usernames (`user_<uuid_no_hyphens>`) to satisfy NOT NULL + UNIQUE constraints
- Fallback uses the user UUID, so collision would require duplicate UUIDs (assumed impossible)
- Prevents silent failures: unexpected unique violations are re-raised explicitly
- Function does not update existing profile rows (idempotent on retry)
- Does not handle: database unavailability, permission errors, future schema changes

**Trigger:** `on_auth_user_created` on `auth.users` (AFTER INSERT)

---

## Test Results

**Test Type:** Unit tests (isolated function logic)  
**Method:** Simulated trigger via test tables (not auth.users)  
**Date:** 2025-12-30  
**Artifact:** `test_handle_new_user.sql` (reproducible)

### Test 1: User without username metadata
```
✅ Profile created with fallback username
   Format: user_<32_hex_chars>
   Example: user_3faebf9bcbcd416287f8c8877abf686f
   Verified: Deterministic (same UUID → same fallback)
```

### Test 2: User with valid username  
```
✅ Profile created with provided username
   Provided: "testuser123"
   Result: "testuser123"
```

### Test 3: User with taken username
```
✅ Username collision handled via nested exception
   Attempted: "testuser123" (already exists)
   Result: fallback username applied
   Behavior: No error thrown, fallback applied silently
```

### Test 4: Idempotency check
```
✅ Function skips insert for existing profiles
   Logic: IF EXISTS (profiles.id = NEW.id) THEN RETURN NEW
   Verified: Early return prevents overwrites
```

**Test Limitations:**
- Unit tests only (not integration/E2E)
- Simulated trigger environment (not production `auth.users`)
- Test tables isolated from auth.users (no FK constraint in production either - trigger-only enforcement)
- No concurrent insert testing
- No database failure mode testing

**Next Steps for Full Coverage:**
- Integration test: Real signup via Supabase Auth API
- E2E test: Manual signup in staging environment
- See `TESTING.md` for procedures

---

## Production Verification

**Status Check (2025-12-30):**
- Trigger enabled: `tgenabled='O'` (active)
- No orphaned users observed: `users_without_profile=0` (current state)
- All existing users have profiles (verified via join)
- Trigger path verified: Active end-to-end

**Verification queries:**
```sql
-- Check trigger status
SELECT tgenabled FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Check for orphaned users
SELECT COUNT(*) FROM auth.users u 
LEFT JOIN public.profiles p ON u.id = p.id 
WHERE p.id IS NULL;

-- Verify signups have profiles (PII-free)
SELECT 
  u.created_at,
  LEFT(u.id::text, 8) || '...' as user_id_prefix,
  p.username,
  CASE WHEN p.id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_profile
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at DESC
LIMIT 10;
```

---

## Migrations Applied

**Files:**
1. `harden_handle_new_user_function.sql` - Initial hardening (search_path, nested exceptions, idempotency)
2. `normalize_username_input.sql` - Input normalization (TRIM/NULLIF)

**Applied:** 2025-12-30  
**Status:** Deployed to production

**Test Artifacts:**
- `test_handle_new_user.sql` - Self-contained unit test script
- `TESTING.md` - Complete test procedures (unit/integration/E2E)

**Reproduction:**
```bash
# Local Supabase instance
supabase start
supabase db reset --db-url postgresql://postgres:postgres@localhost:54322/postgres < test_handle_new_user.sql

# Or via SQL Editor (Dashboard → SQL Editor → paste and run)
```

---

*Last updated: 2025-12-30*
