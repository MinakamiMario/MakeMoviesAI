# MakeMoviesAI - Acquisition Readiness Checklist

This document defines the quality gates that must pass before the platform is considered acquisition-ready. Each item has explicit acceptance criteria that can be verified by a technical due diligence team.

---

## 1. Reproducibility

### 1.1 Database Reproducibility
- [ ] **Fresh database setup works**
  - Clone repo → Create Supabase project → Run `initial_schema.sql` → App functions
  - Acceptance: Zero manual steps beyond running migrations
  - Verification: `supabase db reset` produces working state

- [ ] **All schema in version control**
  - Tables, indexes, constraints, triggers, functions, RLS policies
  - No dashboard-only configurations
  - Verification: `git log -- supabase/migrations/` shows all schema changes

- [ ] **Migrations are idempotent**
  - Running migrations twice doesn't error
  - Verification: `supabase db reset && supabase db reset` succeeds

### 1.2 Application Reproducibility
- [ ] **10-minute local setup**
  - `git clone && pnpm install && pnpm dev` works
  - Acceptance: New developer productive in <10 minutes
  - Verification: Timed test with fresh machine

- [ ] **Environment documented**
  - `.env.example` contains all required variables
  - Each variable has comment explaining purpose and where to find value
  - Verification: `cp .env.example .env.local` + fill in = working app

- [ ] **CI pipeline passes**
  - Typecheck, lint, build all green
  - Verification: GitHub Actions badge is green

---

## 2. Security

### 2.1 RLS Policy Coverage
- [ ] **All tables have RLS enabled**
  - Verification: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity`
  - Acceptance: Returns zero rows

- [ ] **Policy tests pass**
  - 7+ tests covering critical paths
  - Verification: Run `supabase/tests/rls_policies.sql`
  - Acceptance: All tests show ✅ PASS

- [ ] **Security model documented**
  - `docs/SECURITY.md` explains all policies
  - Threat model identifies known risks
  - Verification: Document exists and is current

### 2.2 Function Security
- [ ] **SECURITY DEFINER functions are safe**
  - All have `SET search_path TO 'public'`
  - Input validation present
  - Verification: Review function definitions

- [ ] **No service_role key exposed**
  - Only anon key in client code
  - Verification: `grep -r "service_role" src/` returns nothing

### 2.3 Rate Limiting
- [ ] **Rate limiting implemented**
  - `check_rate_limit()` function exists
  - Applied to abuse-prone operations (fork, upload, export)
  - Verification: Test exceeding rate limit returns error

---

## 3. Video Pipeline

### 3.1 Media Contract
- [ ] **Metadata extraction complete**
  - All media_assets have: duration_ms, width, height, fps, video_codec
  - Acceptance: `SELECT COUNT(*) FROM media_assets WHERE duration_ms IS NULL` = 0
  - Verification: Query against production database

- [ ] **Normalization pipeline works**
  - Upload → Processing job created → Normalized file produced
  - Output matches mezzanine contract (H.264/AAC/MP4)
  - Verification: Upload test file, verify normalized output

- [ ] **HLS segmentation works**
  - Normalized files are segmented into HLS
  - Master playlist generated per project
  - Verification: Project manifest contains valid HLS paths

### 3.2 Playback Quality
- [ ] **Single continuous experience**
  - "Play Full Movie" plays all scenes without user interaction
  - Acceptance: HLS gap ≤50ms p95, Progressive gap ≤200ms p95
  - Verification: Boundary marker logging + analytics dashboard

- [ ] **Scene scrubbing works**
  - Click scene in timeline → player jumps to correct position
  - Acceptance: Seek latency ≤500ms p95
  - Verification: Timestamp logging on seek events

- [ ] **Progress bar spans full project**
  - Single progress bar showing total duration
  - Current position reflects actual playback time
  - Verification: Visual inspection + timeupdate event accuracy

### 3.3 Export Quality
- [ ] **Export produces valid output**
  - Request export → Job completes → Downloadable MP4
  - Acceptance: FFprobe reports no errors, duration matches sum of scenes
  - Verification: Automated QC pipeline

- [ ] **Export caching works**
  - Same cut_hash → Cached result served (after initial render)
  - Acceptance: 100% cache hit for repeated identical cut_hash
  - Verification: Request same export twice, verify cache hit in logs

- [ ] **Export determinism**
  - Same cut_hash → byte-identical output (modulo unavoidable timestamp variance)
  - Acceptance: `-fflags +bitexact -map_metadata -1` in FFmpeg
  - Verification: Compare checksums of repeated exports

- [ ] **Quality gates pass**
  - Export quality report shows all checks passed
  - Verification: Check `quality_report` JSON in export_cache table

---

## 4. Scalability

### 4.1 Database Performance
- [ ] **Indexes cover common queries**
  - Project listing, scene ordering, contribution lookup
  - Verification: `EXPLAIN ANALYZE` on critical queries shows index usage

- [ ] **Fork depth query is bounded**
  - `get_fork_depth()` has timeout (100ms) and max depth (20)
  - Verification: Review function definition

### 4.2 Processing Scalability
- [ ] **Job queue handles concurrency**
  - Multiple jobs can process simultaneously
  - Failed jobs retry with backoff
  - Verification: Load test with 10 concurrent uploads

- [ ] **CDN caching configured**
  - HLS segments cached at edge
  - Cache headers set correctly
  - Verification: Check response headers for cache-control

### 4.3 Cost Model
- [ ] **Unit economics documented**
  - `docs/UNIT_ECONOMICS.md` covers storage, egress, compute
  - Projections at 1K, 10K, 100K, 1M scale
  - Verification: Document exists with current pricing

---

## 5. Operations

### 5.1 Observability
- [ ] **Error tracking configured**
  - Sentry (or equivalent) captures frontend + backend errors
  - Verification: Trigger test error, verify it appears in dashboard

- [ ] **Critical operations logged**
  - Fork, export, upload events tracked
  - Verification: Check logs for recent operations

### 5.2 Backup & Recovery
- [ ] **Backup procedure documented**
  - Where backups are stored
  - How to restore
  - RPO/RTO defined (even if rough)
  - Verification: `docs/` contains backup documentation

- [ ] **Key rotation procedure documented**
  - Supabase keys, service accounts
  - Verification: Procedure exists in documentation

---

## 6. Legal & Compliance

### 6.1 Ownership Model
- [ ] **LEGAL.md exists**
  - Explains content ownership
  - Explains fork/derivative rights
  - Verification: Document exists

### 6.2 Privacy
- [ ] **Data retention policy defined**
  - What data is stored
  - How long it's retained
  - Verification: Policy documented

- [ ] **Account deletion supported**
  - User can request deletion
  - Process documented
  - Verification: Test deletion flow

---

## Summary Scorecard

| Category | Items | Required to Pass |
|----------|-------|------------------|
| Reproducibility | 6 | All |
| Security | 7 | All |
| Video Pipeline | 9 | All |
| Scalability | 5 | All |
| Operations | 4 | All |
| Legal | 3 | All |
| **Total** | **34** | **All** |

---

## Verification Process

1. **Automated checks**: Run CI pipeline, RLS tests, query validations
2. **Manual verification**: Timed setup test, playback quality test, export test
3. **Documentation review**: All referenced docs exist and are current
4. **Load testing**: 10 concurrent uploads, 100 concurrent playback sessions

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | | | |
| Security Review | | | |
| Product Owner | | | |
