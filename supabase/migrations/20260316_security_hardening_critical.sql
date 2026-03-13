-- ============================================================
-- Critical Security Hardening Migration
-- Fixes: SEC-03, SEC-04, SEC-05, SEC-06, SEC-07
-- ============================================================

-- SEC-03: Fix search_path on queue_processing_on_upload
CREATE OR REPLACE FUNCTION public.queue_processing_on_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.file_type LIKE 'video/%' THEN
    INSERT INTO public.processing_jobs (media_asset_id, job_type)
    VALUES (NEW.id, 'validate');
  END IF;
  RETURN NEW;
END;
$$;

-- SEC-04: Lock down project_views INSERT — only allow through RPC
-- Drop the overly permissive INSERT policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'project_views' AND policyname = 'Anyone can insert views'
  ) THEN
    DROP POLICY "Anyone can insert views" ON public.project_views;
  END IF;
END $$;

-- SEC-05: Lock down waitlist INSERT — only allow through RPC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'waitlist' AND policyname = 'Anyone can join waitlist'
  ) THEN
    DROP POLICY "Anyone can join waitlist" ON public.waitlist;
  END IF;
END $$;

-- SEC-06: Lock down conversation_participants INSERT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversation_participants' AND policyname = 'Users can insert participants'
  ) THEN
    DROP POLICY "Users can insert participants" ON public.conversation_participants;
  END IF;
END $$;

-- SEC-07: Lock down conversations INSERT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversations' AND policyname = 'Authenticated users can create conversations'
  ) THEN
    DROP POLICY "Authenticated users can create conversations" ON public.conversations;
  END IF;
END $$;

-- Add composite index for view dedup performance (SCALE-06)
CREATE INDEX IF NOT EXISTS idx_project_views_dedup
  ON public.project_views(project_id, session_fingerprint, viewed_at DESC);
