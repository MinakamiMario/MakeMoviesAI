# MakeMoviesAI - Setup Guide

Get the project running locally in under 10 minutes.

## Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Supabase account (free tier works)

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/MinakamiMario/MakeMoviesAI.git
cd MakeMoviesAI
pnpm install  # or: npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a name and region (eu-west-1 recommended for EU)
3. Save your database password securely

### 3. Apply Database Schema

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to SQL Editor in your Supabase Dashboard
2. Copy contents of `supabase/migrations/00000000000000_initial_schema.sql`
3. Run the query

**Option B: Via Supabase CLI**
```bash
# Install CLI if needed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### 4. Create Storage Buckets

MakeMoviesAI requires **two storage buckets** with different access policies:

1. Go to Storage in Supabase Dashboard

2. Create bucket: `media-originals`
   - Set to **Private** (unchecked "Public bucket")
   - This stores raw user uploads
   - Only accessible via service role

3. Create bucket: `media-public`
   - Set to **Public** bucket
   - This stores processed/validated assets only
   - Used for all playback URLs

4. No file size limit needed for development (add limits in production)

### 5. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL`: Found in Project Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Found in Project Settings → API

### 6. Run Development Server

```bash
pnpm dev  # or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 7. Create Test Users

1. Go to Authentication in Supabase Dashboard
2. Add User → Create new user
3. Or sign up through the app at `/signup`

## Seed Data (Optional)

To populate demo data for testing:

1. Create at least one user first (via signup or dashboard)
2. Run `supabase/seed.sql` in SQL Editor
3. This creates:
   - 1 main project with 5 scenes
   - 1 fork project with 4 scenes  
   - 1 pending contribution

## Project Structure

```
MakeMoviesAI/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── lib/              # Utilities & Supabase clients
│   └── types/            # TypeScript type definitions
├── supabase/
│   ├── migrations/       # Database schema
│   └── seed.sql          # Demo data
├── docs/                 # Additional documentation
└── public/               # Static assets
```

## Common Issues

### "Invalid API key"
- Check `.env.local` has correct `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Ensure no extra whitespace in the key

### "Permission denied" on database
- Verify RLS policies were created (check `initial_schema.sql` applied fully)
- Check user is authenticated for protected operations

### Storage upload fails
- Ensure both buckets exist:
  - `media-originals` (Private) - for raw uploads
  - `media-public` (Public) - for processed assets
- Check storage policies are applied (see migration files)
- Verify signed URL generation for uploads to private bucket

## Next Steps

- Read [HANDOVER.md](./HANDOVER.md) for architecture details
- See [docs/SECURITY.md](./docs/SECURITY.md) for security model
- Check [TESTING.md](./TESTING.md) for test procedures
