# MakeMoviesAI - Security Model

## Overview

MakeMoviesAI uses Supabase's Row Level Security (RLS) as the primary access control mechanism. All database access goes through authenticated Supabase clients, and RLS policies enforce authorization at the database level.

## Authentication

- **Provider**: Supabase Auth (email/password)
- **Session**: JWT tokens stored client-side
- **Roles**: `anon` (unauthenticated), `authenticated` (logged in)

## Authorization Model

### Roles & Capabilities

| Entity | Anon | Authenticated | Director | Contributor |
|--------|------|---------------|----------|-------------|
| View projects | ✅ | ✅ | ✅ | ✅ |
| Create project | ❌ | ✅ | ✅ | ✅ |
| Edit project | ❌ | ❌ | ✅ (own) | ❌ |
| Delete project | ❌ | ❌ | ✅ (own) | ❌ |
| View scenes | ✅ | ✅ | ✅ | ✅ |
| Add scene | ❌ | ❌ | ✅ (own project) | ❌ |
| Submit contribution | ❌ | ✅ | ✅ | ✅ |
| Accept contribution | ❌ | ❌ | ✅ (own project) | ❌ |
| Fork contribution | ❌ | ❌ | ✅ (own project) | ❌ |
| Upload media | ❌ | ✅ | ✅ | ✅ |
| Delete media | ❌ | ✅ (own) | ✅ (own) | ✅ (own) |

### Director vs Contributor

- **Director**: Owner of a project (`projects.director_id = auth.uid()`)
- **Contributor**: Any authenticated user submitting to someone else's project

When a contribution is forked, the contributor becomes the director of the new project.

## RLS Policy Summary

### Public Tables (SELECT for all)
- `profiles` - Username/avatar visible to everyone
- `projects` - All projects are discoverable
- `scenes` - Scene content is public
- `contributions` - Pending work is visible

### Protected Operations

| Table | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|
| projects | owner = auth.uid() | director only | director only |
| scenes | director of project | director of project | director of project |
| branches | director of project | director of project | director of project |
| scene_edges | director of project | director of project | director of project |
| contributions | contributor = auth.uid() | contributor (pending) or director | - |
| cuts | director of project | director of project | director of project |
| media_assets | uploader = auth.uid() | - | uploader only |
| decision_events | actor = auth.uid() | - | - |

## SECURITY DEFINER Functions

These functions run with elevated privileges (owner's permissions):

### `handle_new_user()`
- **Trigger**: `AFTER INSERT ON auth.users`
- **Purpose**: Auto-create profile on signup
- **Guardrails**: 
  - `SET search_path TO 'public'` (prevents schema injection)
  - Idempotency check (won't overwrite existing profile)
  - Fallback username on collision

### `fork_contribution()`
- **Purpose**: Atomic fork operation (create project + copy scenes + update status)
- **Guardrails**:
  - `SET search_path TO 'public'`
  - `FOR UPDATE` lock on contribution (prevents race conditions)
  - Auth check: only director can fork
  - Status check: only pending contributions

## SECURITY INVOKER Functions

### `get_fork_depth()`
- **Purpose**: Calculate fork depth from main timeline
- **Guardrails**:
  - `SET statement_timeout TO '100ms'` (DoS prevention)
  - `SET search_path TO 'public'`
  - Respects RLS (user can only see depth of visible projects)
  - Cycle detection (prevents infinite loops)
  - Hard cap at 20 iterations

## Storage Security

### Bucket Architecture (Dual Bucket - CRITICAL)

MakeMoviesAI uses **two separate storage buckets** with different access policies:

#### 1. `media-public` (Public Bucket)
- **Visibility**: Public (anyone can read via URL)
- **Contents**: Only processed, validated assets
  - `/mezzanine/{project_id}/{asset_id}/normalized.mp4`
  - `/hls/{project_id}/{asset_id}/...` (segments + manifests)
  - `/fast_480p/{project_id}/{asset_id}/fallback.mp4`
  - `/manifests/{project_id}/{branch_id}/...` (project playlists)
  - `/exports/{cut_hash}/export.mp4` (cached exports)
- **Write Access**: Only via service role (processing workers)
- **Rationale**: These URLs are embedded in scenes for playback. Public access simplifies CDN serving.

#### 2. `media-originals` (Private Bucket)
- **Visibility**: Private (service role only)
- **Contents**: Raw user uploads (immutable)
  - `/originals/{project_id}/{asset_id}/{filename}`
- **Access**: Only processing workers via service role
- **User Upload Flow**: 
  1. User uploads to `media-originals` via signed URL (time-limited)
  2. Worker processes and writes to `media-public`
  3. Original kept for re-processing/archival

**Critical Policy**: Raw originals are NEVER served to end users. All playback goes through processed assets in `media-public`.

**Rationale for separation**:
- Raw uploads may contain unvalidated content
- EXIF/metadata the user didn't intend to share
- Potentially incompatible or malformed formats
- Separation ensures "never expose raw uploads" is architecturally enforced

### Abuse Mitigation
### Abuse Mitigation
1. Uploads require authentication (signed URL generation)
2. File ownership tracked in `media_assets` table
3. Rate limiting table (`rate_limits`) tracks upload frequency
4. File size limits enforced at upload (configurable per plan)
5. Only processed content served publicly

## Known Limitations

1. **No rate limiting**: Users can create unlimited projects/forks
   - Mitigation: Add DB-level quota function (P1)

2. **No content moderation**: Uploaded media is not scanned
   - Mitigation: Add reporting flow + manual review (P1)

3. **No audit logging**: Only `decision_events` tracked
   - Mitigation: Add audit table for sensitive operations (P2)

## Incident Response

### Compromised User Account
1. Disable user in Supabase Auth Dashboard
2. Revoke all sessions
3. Review `decision_events` for unauthorized actions
4. Contact user for password reset

### Malicious Content
1. Identify `media_assets.id` and `storage_path`
2. Delete from Storage bucket
3. Delete `media_assets` record
4. Consider disabling uploader account

### Data Breach Suspected
1. Rotate Supabase API keys immediately
2. Check Supabase logs for unusual access patterns
3. Review RLS policy effectiveness
4. Notify affected users if PII exposed
