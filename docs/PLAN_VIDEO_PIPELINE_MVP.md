# Video Pipeline MVP — Implementation Plan

## Current State
- Videos upload to Supabase Storage "media" bucket as raw MP4
- HTML5 `<video>` player shows raw file directly
- No transcoding, no validation, no HLS
- Tables exist: `media_assets` (11 columns)
- NOT yet created: `processing_jobs`, `export_cache`, `project_manifests`

## MVP Scope (What we build NOW)

### Phase 1: Upload Validation + Processing Status
**DB migration needed:**
```sql
-- Add status tracking to media_assets
ALTER TABLE media_assets ADD COLUMN status text DEFAULT 'uploaded'
  CHECK (status IN ('uploaded','validating','processing','ready','failed'));
ALTER TABLE media_assets ADD COLUMN error_message text;
ALTER TABLE media_assets ADD COLUMN metadata jsonb; -- ffprobe output

-- Processing jobs queue
CREATE TABLE processing_jobs (
  id uuid PK,
  media_asset_id uuid FK → media_assets,
  job_type text CHECK (IN ('validate','fast_preview','normalize')),
  status text CHECK (IN ('queued','running','completed','failed')),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);
```

**Client-side validation (MediaUpload.tsx):**
- Max file size: 500MB
- Allowed types: mp4, mov, webm
- Max duration: 30 min (read via browser MediaElement)
- Show upload progress bar

### Phase 2: Server-side Processing (Next.js API Route)
**Route: `/api/process-video`** (POST, authenticated)
- Triggered after upload completes
- Steps:
  1. FFprobe validation (codec, duration, resolution → store in metadata jsonb)
  2. Fast 480p preview (FFmpeg: `-vf scale=-2:480 -preset ultrafast`)
  3. Update media_assets.status → 'ready'

**Requirements:**
- FFmpeg + FFprobe must be available on server
- For Vercel: use `@ffmpeg/ffmpeg` (WASM) or deploy to a VPS/Cloud Run
- For MVP: assume local dev or VPS where FFmpeg is installed

### Phase 3: Playback Fallback Chain
**Update VideoPlayer component:**
```
1. Check media_assets.status
2. If 'ready' → play normalized/480p file
3. If 'processing' → show "Processing your video..." with spinner
4. If 'failed' → show error message
5. If 'uploaded' (legacy) → play raw file as-is (backwards compat)
```

### Phase 4: HLS (Post-MVP, needs infrastructure)
- HLS segmentation after normalize step
- Multi-bitrate: 480p, 720p, 1080p
- Project-level m3u8 manifest stitching all scenes
- CDN: Cloudflare R2 + Workers for edge delivery
- This needs Cloud Run / Modal worker, NOT Next.js API routes

## What's NOT in MVP
- HLS segmentation (needs dedicated worker)
- Multi-bitrate encoding (needs GPU/compute)
- Project-level manifest stitching
- Export pipeline (render full film as single MP4)
- Dual bucket architecture (keep single "media" bucket for now)
- Cloudflare R2 CDN

## Implementation Order
1. DB migration (status + processing_jobs) — 1 hour
2. Client-side validation in MediaUpload — 2 hours
3. `/api/process-video` route with FFprobe — 3 hours
4. Fast 480p generation — 2 hours
5. VideoPlayer status-aware playback — 2 hours
6. End-to-end test — 2 hours

**Total MVP: ~12 hours of implementation**

## Decision: FFmpeg Strategy
For MVP, two options:
- **Option A: WASM FFmpeg** (`@ffmpeg/ffmpeg`) — runs in-browser or serverless, but slow and limited to ~100MB files
- **Option B: Server-side FFmpeg** — requires VPS or Cloud Run, fast, handles large files

**Recommendation**: Option B (server-side). Deploy a simple Cloud Run service or use a VPS where FFmpeg is installed. The API route just proxies the request.

## Files to Create/Modify
- `supabase/migrations/20260312_video_pipeline.sql` — new migration
- `src/components/MediaUpload.tsx` — add validation + progress
- `src/app/api/process-video/route.ts` — new API route
- `src/components/VideoPlayer.tsx` — status-aware playback
- `src/types/entities.ts` — add status types
