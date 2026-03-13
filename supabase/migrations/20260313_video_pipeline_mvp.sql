-- Video Pipeline MVP: status tracking, metadata, processing_jobs
-- Idempotent: safe to re-run

-- ============================================================
-- 1. Add columns to media_assets
-- ============================================================
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Add check constraint for status (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_assets_status_check'
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_status_check
      CHECK (status IN ('uploaded', 'processing', 'ready', 'failed'));
  END IF;
END $$;

-- ============================================================
-- 2. Create processing_jobs table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  media_asset_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('validate', 'metadata', 'fast_preview', 'normalize', 'hls_segment')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  result jsonb DEFAULT '{}',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_processing_jobs_asset
  ON public.processing_jobs(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_pending
  ON public.processing_jobs(status) WHERE status IN ('queued', 'running');

-- ============================================================
-- 3. RLS for processing_jobs
-- ============================================================
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

-- Anyone can view processing jobs for assets they can see
CREATE POLICY "Users can view processing jobs for their assets"
  ON public.processing_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.media_assets ma
      WHERE ma.id = processing_jobs.media_asset_id
      AND (
        ma.uploaded_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = ma.project_id AND p.director_id = auth.uid()
        )
      )
    )
  );

-- Only service role can insert/update (workers)
-- No INSERT/UPDATE/DELETE policies = only service role can mutate

-- ============================================================
-- 4. Auto-queue trigger on media_assets insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.queue_processing_on_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only queue for video files
  IF NEW.file_type LIKE 'video/%' THEN
    INSERT INTO public.processing_jobs (media_asset_id, job_type)
    VALUES (NEW.id, 'validate');
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate triggers
DROP TRIGGER IF EXISTS on_media_upload_queue_processing ON public.media_assets;
CREATE TRIGGER on_media_upload_queue_processing
  AFTER INSERT ON public.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_processing_on_upload();

-- ============================================================
-- 5. Enable realtime for media_assets status changes
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_assets;

-- ============================================================
-- 6. Update existing assets to 'ready' (backwards compat)
-- ============================================================
UPDATE public.media_assets SET status = 'ready' WHERE status = 'uploaded';
