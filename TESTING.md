# Testing Documentation - handle_new_user

## Test Levels

### 1. Unit Tests
**What:** Function logic in isolation  
**Artifact:** `test_handle_new_user.sql` (self-contained)

**How to run:**

**Option A: Local development**
```bash
# Start local Supabase stack
supabase start

# Run test script
supabase db reset --db-url postgresql://postgres:postgres@localhost:54322/postgres < test_handle_new_user.sql

# Or connect and paste
supabase db connect
# Then paste contents of test_handle_new_user.sql
```

**Option B: Staging/Production**
```bash
# Via SQL Editor in Dashboard (recommended):
# 1. Copy contents of test_handle_new_user.sql
# 2. Dashboard → SQL Editor → paste and execute

# Or via CLI (requires connection string from Dashboard):
# 1. Dashboard → Project Settings → Database → Connection string
# 2. Copy the connection string
# 3. Run: psql "<your-connection-string>" -f test_handle_new_user.sql
```

**Last run:**
- Date: 2025-12-30
- Environment: Local development (supabase start)
- Executor: Repository maintainer (local dev environment)
- Result: ✅ All 4 tests passed
- Cleanup: Verified schema dropped successfully

**Results:**
```
Test 1: ✅ No username → fallback user_<uuid_no_hyphens>
Test 2: ✅ Valid username → used as-is
Test 3: ✅ Duplicate username → fallback applied
Test 4: ✅ Idempotency check logic verified
```

**Limitations:**
- Simulated trigger (not auth.users)
- Test tables isolated from auth.users (mirrors production: no FK constraint, trigger-only enforcement)
- No concurrent insert testing
- No load/stress testing

---

### 2. Integration Tests
**What:** Actual trigger on auth.users → profiles  
**Status:** Not currently automated

**Why separate from unit tests:**
- Tests real `auth.users` table (not simulated)
- Validates profiles are created when users are added to auth.users
- Confirms trigger is properly attached to auth.users
- **Note:** profiles.id does not have an FK constraint to auth.users.id (relationship is enforced by trigger only)

**How to run manually:**

**Option A: Via Supabase Dashboard**
1. Go to Authentication → Users
2. Click "Add user"
3. Test without metadata:
   - Email: `test+nousername@example.com`
   - Password: (secure password)
   - Expected: Profile with `user_<uuid>` username
4. Test with username:
   - Email: `test+withname@example.com`
   - User Metadata: `{"username": "testuser456"}`
   - Expected: Profile with `testuser456` username
5. Test collision:
   - Email: `test+collision@example.com`
   - User Metadata: `{"username": "testuser456"}` (duplicate)
   - Expected: Profile with `user_<uuid>` fallback

**Option B: Via Auth API** (see code examples in original section)

**Last run:**
- Date: Not yet performed
- Recommendation: Run before major releases
- Expected duration: ~5 minutes (manual)
```javascript
// Test 1: No username
const { data: user1 } = await supabase.auth.signUp({
  email: 'test1@example.com',
  password: 'secure_password_123'
});

// Verify profile
const { data: profile1 } = await supabase
  .from('profiles')
  .select('username')
  .eq('id', user1.user.id)
  .single();

console.assert(profile1.username.startsWith('user_'));

// Test 2: With username
const { data: user2 } = await supabase.auth.signUp({
  email: 'test2@example.com',
  password: 'secure_password_123',
  options: {
    data: { username: 'myusername' }
  }
});

const { data: profile2 } = await supabase
  .from('profiles')
  .select('username')
  .eq('id', user2.user.id)
  .single();

console.assert(profile2.username === 'myusername');
```

**Expected Results:**
- Profile row created for each user
- Username follows fallback logic when needed
- No duplicate key errors on signup

---

### 3. E2E Tests
**What:** Complete user signup flow in staging/production  
**When:** Before major releases, after migration changes, or schema modifications

**Procedure:**
1. Use disposable email (e.g., `test+timestamp@yourdomain.com`)
2. Complete full signup flow via application UI
3. Verify profile creation:
   ```sql
   SELECT id, username, created_at 
   FROM profiles 
   WHERE id = '<user_id>';
   ```
4. Check for errors:
   - Dashboard → Functions → Logs
   - Dashboard → Database → Advisors
5. Clean up test user:
   ```sql
   -- Via Dashboard: Authentication → Users → Delete
   ```

**Success Criteria:**
- User completes signup without errors
- Profile row exists with expected username
- No warnings in Database Advisors (Security/Performance)
- No exception logs in Functions

**Last run:**
- Date: Not yet performed  
- Recommendation: Perform in staging before next production deployment
- Suggested test cases:
  1. Signup without username metadata
  2. Signup with valid username
  3. Signup with duplicate username (after creating first user)
  
**Note:** Integration tests (manual Auth user creation) can substitute for full E2E in non-critical releases.

---

## Test Artifacts

### Files
- `test_handle_new_user.sql` - Unit test harness (self-contained)
- `TESTING.md` - This file

### Reproduction Steps
```bash
# 1. Run unit tests locally
supabase start
psql postgresql://postgres:postgres@localhost:54322/postgres -f test_handle_new_user.sql

# Or via SQL Editor in Dashboard
# Copy/paste contents of test_handle_new_user.sql and execute

# 2. Verify test schema cleanup
# Query should return no rows:
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name = 'test_handle_new_user';

# 3. Run integration/E2E tests
# See procedures in sections above (2. Integration Tests, 3. E2E Tests)
```

**Safety Notes:**
- Test script uses isolated schema `test_handle_new_user`
- No interaction with `public` schema or production tables
- **Prerequisites:**
  - Requires CREATE SCHEMA privileges
  - Requires DROP SCHEMA privileges for cleanup
- **Overhead:**
  - Creates DDL audit log entries
  - Minor lock overhead during schema operations
- **Cleanup verification:**
  - Script includes `DROP SCHEMA ... CASCADE` at end
  - Verify cleanup: `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'test_handle_new_user';` should return 0 rows
  - If cleanup fails, manually run: `DROP SCHEMA IF EXISTS test_handle_new_user CASCADE;`

---

## Known Limitations

### What This Tests
- ✅ Username fallback logic
- ✅ Collision handling (unique constraint)
- ✅ Idempotency (duplicate trigger)
- ✅ Deterministic fallback format

### What This Does NOT Test
- ❌ Concurrent signups (race conditions)
- ❌ Database unavailability
- ❌ Permission errors (RLS, schema access)
- ❌ High load scenarios
- ❌ Migration rollback behavior

### Assumptions
- UUID collision assumed impossible (standard UUIDv4)
- Relationship between profiles.id and auth.users.id enforced by trigger (no FK constraint present)
- `profiles.username` has UNIQUE constraint
- `profiles.username` is NOT NULL

---

## Failure Modes Not Covered

The function does NOT handle:
1. **Database down** → Signup fails with connection error
2. **Permission issues** → SECURITY DEFINER mitigates this
3. **Schema mismatch** → Would fail at INSERT time
4. **Future constraint changes** → Requires function update

For these scenarios, monitoring/alerting is required at the application level.

---

*Last updated: 2025-12-30*
