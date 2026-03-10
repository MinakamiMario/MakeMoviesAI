# MakeMoviesAI - Unit Economics

## Overview

This document provides cost projections for operating MakeMoviesAI at scale. All estimates are based on typical usage patterns and current cloud pricing (January 2025).

## Assumptions

| Metric | Value | Notes |
|--------|-------|-------|
| Average scene duration | 60 seconds | Based on short-form content |
| Average scenes per project | 5 | |
| Average project duration | 5 minutes | |
| Average file size (original) | 100 MB/minute | 1080p H.264 |
| Average file size (normalized) | 60 MB/minute | After compression |
| HLS segments overhead | +40% | Multiple bitrate variants |
| Views per project per month | 50 | Mix of creator + audience |

## Storage Costs

### Per-Project Storage Breakdown

| Asset Type | Size | Calculation |
|------------|------|-------------|
| Original uploads | 500 MB | 5 min × 100 MB/min |
| Normalized mezzanine | 300 MB | 5 min × 60 MB/min |
| HLS segments (3 variants) | 420 MB | 300 MB × 1.4 |
| **Total per project** | **1.22 GB** | |

### Storage Cost at Scale

| Provider | Cost/GB/month | 10K projects | 100K projects | 1M projects |
|----------|---------------|--------------|---------------|-------------|
| Supabase Storage | $0.021 | $256/mo | $2,560/mo | $25,600/mo |
| Cloudflare R2 | $0.015 | $183/mo | $1,830/mo | $18,300/mo |
| AWS S3 | $0.023 | $281/mo | $2,810/mo | $28,100/mo |

**Recommendation**: Start with Supabase Storage, migrate to R2 at 50K+ projects for cost savings.

## Egress (Bandwidth) Costs

### Per-View Bandwidth

| Scenario | Data transferred | Notes |
|----------|------------------|-------|
| Full project view (HLS 1080p) | 300 MB | 5 min × 60 MB/min |
| Partial view (average) | 150 MB | 50% watch-through |
| Thumbnail/preview | 5 MB | Low-res preview |

### Egress Cost at Scale

| Monthly Active Projects | Views/project | Total egress | Supabase ($0.09/GB) | R2 (free egress) |
|------------------------|---------------|--------------|---------------------|-------------------|
| 10,000 | 50 | 75 TB | $6,750/mo | $0 |
| 100,000 | 50 | 750 TB | $67,500/mo | $0 |
| 1,000,000 | 50 | 7.5 PB | $675,000/mo | $0 |

**Critical Insight**: Egress is the dominant cost. Cloudflare R2's free egress is a game-changer at scale.

### CDN Strategy

| Tier | Monthly egress | Strategy | Est. cost |
|------|----------------|----------|-----------|
| < 1 TB | Supabase direct | Simple, no CDN needed | ~$90/mo |
| 1-10 TB | Cloudflare (free tier) | Free 100 TB/mo egress | $0 |
| 10-100 TB | Cloudflare Pro + R2 | $20/mo + free egress | $20/mo |
| > 100 TB | Cloudflare Enterprise | Negotiate | Custom |

## Compute Costs (Processing)

### Normalization (per minute of video)

| Provider | Config | Time to process 1 min | Cost per minute |
|----------|--------|----------------------|-----------------|
| Cloud Run | 2 vCPU, 4 GB | ~30 seconds | $0.0015 |
| Modal | 2 vCPU, 4 GB | ~30 seconds | $0.0012 |
| Replicate | ffmpeg model | ~45 seconds | $0.002 |

### HLS Segmentation (per minute of video)

| Provider | Config | Time to process 1 min | Cost per minute |
|----------|--------|----------------------|-----------------|
| Cloud Run | 4 vCPU, 8 GB | ~60 seconds (3 variants) | $0.004 |

### Export Rendering (per minute of output)

| Scenario | Processing time | Cost |
|----------|-----------------|------|
| Hard-cut concat (no re-encode) | ~5 sec/min | $0.0003/min |
| Re-encode (transitions) | ~90 sec/min | $0.006/min |

### Processing Cost at Scale

| Monthly uploads | Minutes uploaded | Normalize cost | HLS cost | Total |
|----------------|------------------|----------------|----------|-------|
| 1,000 projects | 5,000 min | $7.50 | $20 | $27.50/mo |
| 10,000 projects | 50,000 min | $75 | $200 | $275/mo |
| 100,000 projects | 500,000 min | $750 | $2,000 | $2,750/mo |

## Export Cost Analysis

### With Caching

| Cache hit rate | Exports/month | Compute cost | Notes |
|----------------|---------------|--------------|-------|
| 0% (no cache) | 10,000 | $30/mo | Every export re-renders |
| 50% | 10,000 | $15/mo | Half served from cache |
| 90% | 10,000 | $3/mo | Most cuts already rendered |

**Key Insight**: Deterministic cut hashing is critical. Same cut = same hash = serve from cache.

### Storage for Exports

| Strategy | Storage per project | Cost at 100K projects |
|----------|--------------------|-----------------------|
| Keep all exports | 300 MB | $630/mo |
| LRU cache (last 30 days) | 100 MB avg | $210/mo |
| On-demand only | 0 (re-render) | $0 storage, higher compute |

**Recommendation**: LRU cache with 30-day retention. Re-render rarely-accessed exports on demand.

## Total Cost Projections

### Small Scale (1,000 active projects/month)

| Category | Cost |
|----------|------|
| Storage | $26/mo |
| Egress (via R2) | $0 |
| Processing | $28/mo |
| Supabase (Pro) | $25/mo |
| Vercel (Pro) | $20/mo |
| **Total** | **~$100/mo** |

### Medium Scale (10,000 active projects/month)

| Category | Cost |
|----------|------|
| Storage (R2) | $183/mo |
| Egress (via R2) | $0 |
| Processing | $275/mo |
| Supabase (Pro) | $25/mo |
| Vercel (Pro) | $20/mo |
| Cloudflare (Pro) | $20/mo |
| **Total** | **~$525/mo** |

### Large Scale (100,000 active projects/month)

| Category | Cost |
|----------|------|
| Storage (R2) | $1,830/mo |
| Egress (via R2) | $0 |
| Processing | $2,750/mo |
| Supabase (Team) | $599/mo |
| Vercel (Team) | $150/mo |
| Cloudflare (Pro) | $20/mo |
| Monitoring (Sentry) | $80/mo |
| **Total** | **~$5,400/mo** |

## Revenue Implications

### Break-Even Analysis

| Pricing Model | Price | Users needed to break even |
|---------------|-------|---------------------------|
| Freemium + Pro ($10/mo) | $10/mo | 54 paid users @ medium scale |
| Per-project ($1/project) | $1/project | 525 projects @ medium scale |
| Storage-based ($0.10/GB) | $0.10/GB | 5,250 GB stored @ medium scale |

### Margin at Scale

| Scale | Monthly cost | Revenue @ 5% conversion, $10/mo | Margin |
|-------|--------------|--------------------------------|--------|
| 10K projects | $525 | $5,000 (500 paid users) | 89% |
| 100K projects | $5,400 | $50,000 (5,000 paid users) | 89% |
| 1M projects | ~$50,000 | $500,000 (50,000 paid users) | 90% |

## Key Insights for Acquirers

1. **Egress is the cost killer** - Moving to R2 eliminates the largest variable cost
2. **Processing scales linearly** - No hidden exponential costs
3. **Caching is leverage** - Export cache dramatically reduces compute spend
4. **Margins improve at scale** - Fixed costs (Supabase, Vercel) become negligible

## Infrastructure Recommendations by Scale

| Scale | Storage | CDN | Processing | Database |
|-------|---------|-----|------------|----------|
| MVP (<1K) | Supabase | None | Cloud Run | Supabase Free |
| Growth (1-10K) | Supabase | Cloudflare | Cloud Run | Supabase Pro |
| Scale (10-100K) | R2 | Cloudflare | Cloud Run + Queue | Supabase Pro |
| Enterprise (>100K) | R2 + S3 | Cloudflare Enterprise | Dedicated workers | Supabase Team / Self-host |

## Appendix: Pricing Sources

- Supabase: https://supabase.com/pricing (January 2025)
- Cloudflare R2: https://developers.cloudflare.com/r2/pricing/
- Cloud Run: https://cloud.google.com/run/pricing
- Vercel: https://vercel.com/pricing
