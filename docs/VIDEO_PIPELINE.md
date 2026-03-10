# Video Pipeline Technical Specification

## Overview

This document specifies the video handling architecture for MakeMoviesAI, covering upload, normalization, playback, and export. The architecture is designed for **scale-first**: supporting millions of projects with predictable costs and zero-gap playback.

## Architecture Principles

1. **Deterministic**: Same input → same output, always
2. **CDN-native**: All playback via HLS, cacheable at edge
3. **Cost-efficient**: Egress via R2 (free), compute via serverless
4. **Quality-gated**: No asset reaches playback without validation

## Pipeline Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   UPLOAD    │────▶│  NORMALIZE   │────▶│   SEGMENT   │────▶│     CDN      │
│  (any fmt)  │     │  (mezzanine) │     │    (HLS)    │     │   (R2/CF)    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
       │                   │                    │                    │
       ▼                   ▼                    ▼                    ▼
   Validate           Extract              Generate            Cache at
   + Store           Metadata             Manifest              Edge
```

## 1. Upload Pipeline

### Validation (Client-side)
```typescript
const UPLOAD_CONSTRAINTS = {
  maxFileSize: 500 * 1024 * 1024,  // 500 MB
  allowedTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'],
  maxDuration: 30 * 60 * 1000,     // 30 minutes
};
```

### Storage Structure (Dual Bucket)

```
# PRIVATE BUCKET: media-originals (service role only)
/originals/{project_id}/{asset_id}/{filename}     # Raw uploads (immutable)

# PUBLIC BUCKET: media-public (CDN-served)
/mezzanine/{project_id}/{asset_id}/normalized.mp4    # After normalization
/fast_480p/{project_id}/{asset_id}/fallback.mp4      # Emergency fallback
/hls/{project_id}/{asset_id}/
│   ├── master.m3u8                                   # Variant playlist
│   ├── 1080p/
│   │   ├── init.mp4
│   │   ├── playlist.m3u8
│   │   └── segment_{000-N}.m4s
│   ├── 720p/
│   └── 480p/
/manifests/{project_id}/{branch_id}/v{hash}/master.m3u8  # Project-level
/exports/{cut_hash}/export.mp4                        # Cached exports
```

**Critical**: Raw originals are NEVER in the public bucket. All playback URLs point to `media-public` only.

### Processing Trigger
Upload completion triggers automatic job creation:
```sql
-- Trigger in 00000000000001_scale_ready_media.sql
CREATE TRIGGER on_media_upload_queue_normalization
  AFTER INSERT ON public.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_normalization_job();
```

## 2. Mezzanine Contract

All assets are normalized to a canonical format before any playback or export.

| Property | Specification | Rationale |
|----------|---------------|-----------|
| Container | MP4 (ISO Base Media) | Universal, streamable |
| Video Codec | H.264 Main Profile @ L4.0 | 99%+ device support |
| Audio Codec | AAC-LC, 48kHz, stereo | Standard web audio |
| Resolution | ≤1920×1080, preserve aspect | Balance quality/bandwidth |
| Frame Rate | CFR, preserve original (24/25/30) | Avoid temporal artifacts |
| Bitrate | CRF 23 (~5-8 Mbps @ 1080p) | Perceptually lossless |
| Faststart | moov atom at beginning | Instant playback start |
| GOP | Aligned to segment duration (4s) | Clean seeks |
| Audio Track | Required (inject silent if missing) | Continuous playback |

### FFmpeg Command (Full Re-encode)

**GOP Strategy:** Force keyframes at segment boundaries (every 4s), but allow scene-cut keyframes within those bounds for quality.

```bash
ffmpeg -i input.mov \
  -c:v libx264 -preset medium -crf 23 -profile:v main -level 4.0 \
  -g 120 \                                    # Max GOP = 5s (slightly > segment)
  -keyint_min 24 \                            # Min GOP = 1s (allow scene cuts)
  -force_key_frames "expr:gte(t,n_forced*4)" \ # Force keyframe every 4s
  -c:a aac -b:a 128k -ar 48000 -ac 2 \
  -movflags +faststart \
  -fflags +bitexact \                         # Reproducible output
  -map_metadata -1 \                          # Strip variable metadata
  -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2" \
  -y output.mp4
```

**Why this approach:**
- `-force_key_frames` guarantees keyframes at 0s, 4s, 8s... (segment boundaries)
- `-g 120 -keyint_min 24` allows x264 to add scene-cut keyframes for quality
- `-fflags +bitexact -map_metadata -1` ensures deterministic output for cache validity

### Passthrough Detection (Cost Optimization)

Before re-encoding, probe the input to check if it already conforms:

```typescript
function getTranscodeStrategy(probe: MediaProbe): 'reencode' | 'remux' | 'faststart_only' {
  const videoOk = probe.video_codec === 'h264' && 
                  ['main', 'high'].includes(probe.video_profile);
  const audioOk = probe.audio_codec === 'aac' && 
                  probe.audio_sample_rate === 48000;
  const timingOk = probe.fps_mode === 'cfr';
  const moovOk = probe.moov_position === 'start';
  
  if (videoOk && audioOk && timingOk && moovOk) return 'remux';
  if (videoOk && audioOk && timingOk && !moovOk) return 'faststart_only';
  return 'reencode';
}
```

**Savings**: Passthrough/remux is ~15x faster than full re-encode.

### Silent Audio Injection

If input has no audio track, inject silent audio for continuous playback:

```bash
ffmpeg -i video_only.mp4 \
  -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 \
  -c:v copy -c:a aac -shortest \
  output_with_audio.mp4
```

### Metadata Extraction
Extract via FFprobe and store in `media_assets`:
```json
{
  "duration_ms": 45230,
  "width": 1920,
  "height": 1080,
  "fps": 24.0,
  "video_codec": "h264",
  "audio_codec": "aac",
  "bitrate_kbps": 6500,
  "has_audio": true
}
```

## 3. HLS Segmentation

### Segment Configuration

| Property | Value | Rationale |
|----------|-------|-----------|
| Segment Duration | 4 seconds | Balance seek speed vs request overhead |
| GOP Size | fps × 4 (e.g., 96 for 24fps) | Aligned with segment boundaries |
| Segment Format | fMP4 (.m4s) | Better caching than .ts |
| Init Segment | Per-variant init.mp4 | Required for fMP4 |

### Variant Encoding

**GOP aligned to 4s segments, but scene cuts allowed within bounds.**

```bash
# 1080p variant
ffmpeg -i normalized.mp4 \
  -c:v libx264 -preset fast -crf 23 \
  -g 120 -keyint_min 24 \
  -force_key_frames "expr:gte(t,n_forced*4)" \
  -c:a aac -b:a 128k \
  -f hls -hls_time 4 -hls_playlist_type vod \
  -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename 'segment_%03d.m4s' \
  1080p/playlist.m3u8

# 720p variant
ffmpeg -i normalized.mp4 \
  -c:v libx264 -preset fast -crf 24 \
  -g 90 -keyint_min 24 \
  -force_key_frames "expr:gte(t,n_forced*4)" \
  -vf scale=1280:720 \
  -c:a aac -b:a 96k \
  -f hls -hls_time 4 -hls_playlist_type vod \
  -hls_segment_type fmp4 \
  720p/playlist.m3u8

# 480p variant
ffmpeg -i normalized.mp4 \
  -c:v libx264 -preset fast -crf 25 \
  -g 90 -keyint_min 24 \
  -force_key_frames "expr:gte(t,n_forced*4)" \
  -vf scale=854:480 \
  -c:a aac -b:a 64k \
  -f hls -hls_time 4 -hls_playlist_type vod \
  -hls_segment_type fmp4 \
  480p/playlist.m3u8
```

### Master Playlist (per asset)
```m3u8
#EXTM3U
#EXT-X-VERSION:7

#EXT-X-STREAM-INF:BANDWIDTH=6500000,RESOLUTION=1920x1080,CODECS="avc1.4d4028,mp4a.40.2"
1080p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=3500000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"
720p/playlist.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480,CODECS="avc1.4d401e,mp4a.40.2"
480p/playlist.m3u8
```

## 4. Project-Level Manifest

When scenes change, regenerate the project manifest that stitches all scenes together.

### Manifest Structure
```typescript
interface ProjectManifest {
  projectId: string;
  branchId: string;
  versionHash: string;           // SHA256(scene_ids + order + asset_versions)
  totalDurationMs: number;
  scenes: {
    sceneId: string;
    assetId: string;
    startOffsetMs: number;
    durationMs: number;
    hlsBasePath: string;         // /hls/{project_id}/{asset_id}/
  }[];
  generatedAt: string;
}
```

### Combined Master Playlist (Project-Level)

The player loads a single m3u8 that references all scene segments in order.

**Critical for Safari/iOS**: Scene boundaries require `#EXT-X-DISCONTINUITY` and `#EXT-X-MAP` tags.

```m3u8
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:4
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-INDEPENDENT-SEGMENTS

# Scene 1
#EXT-X-PROGRAM-DATE-TIME:2025-01-03T12:00:00.000Z
#EXT-X-MAP:URI="/hls/proj_123/asset_001/1080p/init.mp4"
#EXTINF:4.000,
/hls/proj_123/asset_001/1080p/segment_000.m4s
#EXTINF:4.000,
/hls/proj_123/asset_001/1080p/segment_001.m4s
#EXTINF:2.500,
/hls/proj_123/asset_001/1080p/segment_002.m4s

# Scene 2 (different asset = discontinuity + new init)
#EXT-X-DISCONTINUITY
#EXT-X-PROGRAM-DATE-TIME:2025-01-03T12:00:10.500Z
#EXT-X-MAP:URI="/hls/proj_123/asset_002/1080p/init.mp4"
#EXTINF:4.000,
/hls/proj_123/asset_002/1080p/segment_000.m4s
#EXTINF:4.000,
/hls/proj_123/asset_002/1080p/segment_001.m4s

# Scene 3 (another asset = another discontinuity)
#EXT-X-DISCONTINUITY
#EXT-X-PROGRAM-DATE-TIME:2025-01-03T12:00:18.500Z
#EXT-X-MAP:URI="/hls/proj_123/asset_003/1080p/init.mp4"
#EXTINF:4.000,
/hls/proj_123/asset_003/1080p/segment_000.m4s

#EXT-X-ENDLIST
```

**Tag explanations:**
- `#EXT-X-INDEPENDENT-SEGMENTS`: Each segment can be decoded independently (required for fMP4)
- `#EXT-X-PROGRAM-DATE-TIME`: Wall-clock timestamp for debugging/telemetry
- `#EXT-X-TARGETDURATION`: Must be ≥ longest segment (ceil to integer)

**When to emit new EXT-X-MAP:**
- Always immediately AFTER `#EXT-X-DISCONTINUITY`
- Each scene = different asset = different init segment

**Audio continuity policy:**
- All assets MUST have audio track (silent injection if missing)
- Prevents audio dropout between scenes

### Cache Invalidation
- Scene add/remove/reorder → New manifest version hash
- Manifest URL includes version: `/manifests/{project_id}/{branch_id}/v{hash}/master.m3u8`
- Old manifests remain valid (immutable segments)

## 5. Playback Architecture

### Fallback Chain (Priority Order)

```
1. HLS (any variant ready)     → Best quality, adaptive
2. Normalized progressive      → Good quality, no ABR
3. Fast 480p fallback         → Degraded but consistent
4. Processing screen          → "Video wordt verwerkt..."
```

**Never serve original uploads directly** — they may have incompatible codecs, VFR timing, or missing faststart.

### Playback URL Resolution

```typescript
function getPlaybackUrl(asset: MediaAsset): PlaybackResult {
  // Priority 1: HLS (any variant ready)
  if (asset.hls_path && hasAnyVariantReady(asset.hls_variants_ready)) {
    return { 
      url: `${CDN}/${asset.hls_path}/master.m3u8`, 
      type: 'hls',
      degraded: false 
    };
  }
  
  // Priority 2: Normalized progressive
  if (asset.normalized_path) {
    return { 
      url: `${CDN}/${asset.normalized_path}`, 
      type: 'progressive',
      degraded: false 
    };
  }
  
  // Priority 3: Fast 480p fallback (generated first in pipeline)
  if (asset.fast_480p_path) {
    return { 
      url: `${CDN}/${asset.fast_480p_path}`, 
      type: 'progressive',
      degraded: true,
      warning: 'Kwaliteit wordt verbeterd...'
    };
  }
  
  // Priority 4: Not ready
  return { 
    type: 'processing',
    status: asset.processing_status 
  };
}
```

### Player Implementation
```typescript
import Hls from 'hls.js';

function createPlayer(manifestUrl: string, videoElement: HTMLVideoElement) {
  if (Hls.isSupported()) {
    const hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
    });
    hls.loadSource(manifestUrl);
    hls.attachMedia(videoElement);
  } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    videoElement.src = manifestUrl;
  }
}
```

### Scene Navigation
```typescript
interface SceneOffset {
  sceneId: string;
  startMs: number;
  endMs: number;
}

function seekToScene(offsets: SceneOffset[], sceneId: string, player: HTMLVideoElement) {
  const scene = offsets.find(s => s.sceneId === sceneId);
  if (scene) {
    player.currentTime = scene.startMs / 1000;
  }
}

function getCurrentScene(offsets: SceneOffset[], currentTimeMs: number): string | null {
  return offsets.find(s => currentTimeMs >= s.startMs && currentTimeMs < s.endMs)?.sceneId ?? null;
}
```

### Acceptance Criteria

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| HLS scene gap | ≤50ms p95 | Boundary markers + timeupdate events, log p50/p95/p99 per browser |
| Progressive scene gap | ≤200ms p95 | Same method, higher tolerance for non-HLS |
| Time to first frame | <2s p95 on 4G | Lighthouse / WebPageTest |
| Seek to scene | <500ms p95 | Timestamp logging on seek events |
| Adaptive quality switch | <1s p95 | HLS.js quality change events |
| Safari compatibility | No glitches at scene boundaries | iOS 15+ / macOS Safari test matrix |

**Measurement Implementation:**
```typescript
// Log scene transitions for gap analysis
player.addEventListener('timeupdate', () => {
  const currentMs = player.currentTime * 1000;
  const currentScene = getCurrentScene(offsets, currentMs);
  
  if (currentScene !== lastScene && lastScene !== null) {
    const expectedBoundary = offsets.find(s => s.sceneId === currentScene)?.startMs;
    const gap = Math.abs(currentMs - expectedBoundary);
    
    analytics.log('scene_transition', {
      gap_ms: gap,
      from_scene: lastScene,
      to_scene: currentScene,
      browser: navigator.userAgent,
      playback_type: isHLS ? 'hls' : 'progressive'
    });
  }
  lastScene = currentScene;
});
```

### Safari/iOS Test Matrix

| Device | OS Version | Test Result |
|--------|------------|-------------|
| iPhone 12+ | iOS 15+ | Required ✅ |
| iPhone SE | iOS 15+ | Required ✅ |
| iPad | iPadOS 15+ | Required ✅ |
| MacBook Safari | macOS 12+ | Required ✅ |
| Apple TV | tvOS 15+ | Nice to have |

## 6. Fork Playback Modes

### Default: Current Cut
Play only scenes belonging to the current project/branch.

### Merged Cut (Optional)
Compose main project scenes up to fork point + fork scenes after:

```typescript
function buildMergedCut(fork: Project, main: Project): SceneList {
  const forkPointSceneId = fork.forked_at_scene_id;
  
  // Get main scenes up to fork point
  const mainScenes = main.scenes
    .filter(s => s.scene_order <= getSceneOrder(forkPointSceneId));
  
  // Get fork scenes (all scenes in fork project)
  const forkScenes = fork.scenes;
  
  return [...mainScenes, ...forkScenes];
}
```

**Key Principle**: This is a **view composition**, not data mutation. Canon remains canon.

### 4. Export Pipeline

#### v1: Simple Concatenation (MVP)

```
Request Export → Queue Job → FFmpeg Concat → Upload Result → Notify User
```

**Implementation** (Cloud Run + Cloud Tasks):
1. User clicks "Export Film"
2. API creates export job record
3. Cloud Task triggers Cloud Run worker
4. Worker:
   - Downloads all normalized scenes
   - Concatenates with FFmpeg
   - Uploads to `exports/{project_id}/{timestamp}.mp4`
   - Updates job status
5. User gets download link (email or poll)

**FFmpeg Concat** (same-codec files):
```bash
# Create file list
for f in scene_*.mp4; do echo "file '$f'" >> list.txt; done

# Concatenate (no re-encode if specs match)
ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4
```

#### v2: Transitions (Future)

Add crossfades, titles, etc. Requires re-encoding:
```bash
ffmpeg -i scene1.mp4 -i scene2.mp4 \
  -filter_complex "[0][1]xfade=transition=fade:duration=0.5:offset=9.5" \
  output.mp4
```

### 5. Cost Model

| Operation | Cost Estimate | Notes |
|-----------|---------------|-------|
| Storage (Supabase) | $0.021/GB/month | Original + normalized |
| Egress (Supabase) | $0.09/GB | Per view/download |
| Normalization (Cloud Run) | ~$0.02/minute video | 2 vCPU, 4GB RAM |
| Export (Cloud Run) | ~$0.01/minute video | Concat is fast |

**Example**: 10-minute film, 5 viewers/day
- Storage: ~1GB = $0.02/month
- Egress: 5 views × 1GB × 30 days = 150GB = $13.50/month
- Normalization: 10 min = $0.20 (one-time)

**Optimization**: Use Cloudflare R2 or CDN for egress savings at scale.

## Implementation Phases

### Phase 1: Metadata (Week 2, Day 1-2)
- [ ] Add duration/codec columns to media_assets
- [ ] Create Edge Function for FFprobe extraction
- [ ] Backfill existing assets

### Phase 2: Playback (Week 2, Day 3-5)
- [ ] Build TimelineMap utility
- [ ] Create VideoPlayer component (dual-buffer)
- [ ] Add scene scrubbing
- [ ] "Play Full Movie" button

### Phase 3: Export (Week 3)
- [ ] Cloud Run worker for FFmpeg
- [ ] Export job table + API
- [ ] Basic UI for export request
- [ ] Download link delivery

### Phase 4: Normalization (Week 4)
- [ ] Async normalization pipeline
- [ ] Store normalized variants
- [ ] Switch playback to normalized files

## Open Questions

1. **HLS vs Direct MP4**: At what scale do we need HLS?
   - Recommendation: Start with direct MP4, add HLS when >1000 concurrent views

2. **Client-side duration extraction**: Fallback if server extraction fails?
   - Recommendation: Yes, use `video.duration` as fallback

3. **Export queue priority**: FIFO or by project size?
   - Recommendation: FIFO initially, add priority later

4. **Storage cleanup**: Delete original after normalization?
   - Recommendation: Keep originals for 30 days, then archive to cold storage
