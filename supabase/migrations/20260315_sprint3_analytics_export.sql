-- ============================================================
-- Sprint 3: Project Views + Export Requests + Fork Comparison
-- ============================================================

-- 1. Project Views table (analytics basis)
CREATE TABLE IF NOT EXISTS project_views (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  session_fingerprint text
);

CREATE INDEX IF NOT EXISTS idx_project_views_project ON project_views(project_id);
CREATE INDEX IF NOT EXISTS idx_project_views_viewer ON project_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_project_views_time ON project_views(project_id, viewed_at DESC);

ALTER TABLE project_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can track a view"
  ON project_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Directors can read their project views"
  ON project_views FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE director_id = auth.uid()
    )
  );

-- 2. Export Requests table (queue for future worker)
CREATE TABLE IF NOT EXISTS export_requests (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  resolution text NOT NULL DEFAULT '720p' CHECK (resolution IN ('480p', '720p', '1080p')),
  output_url text,
  error_message text,
  scene_count int,
  total_duration numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_export_requests_project ON export_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_export_requests_user ON export_requests(requested_by);

ALTER TABLE export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can request exports"
  ON export_requests FOR INSERT
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Users can see own export requests"
  ON export_requests FOR SELECT
  USING (auth.uid() = requested_by);

CREATE POLICY "Directors can see project exports"
  ON export_requests FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE director_id = auth.uid()
    )
  );

-- 3. RPC: Track project view (deduplicates within 1 hour per user)
CREATE OR REPLACE FUNCTION track_project_view(
  p_project_id uuid,
  p_viewer_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fingerprint text;
  v_recent_view boolean;
BEGIN
  v_fingerprint := COALESCE(p_viewer_id::text, 'anon');

  SELECT EXISTS(
    SELECT 1 FROM project_views
    WHERE project_id = p_project_id
      AND session_fingerprint = v_fingerprint
      AND viewed_at > now() - interval '1 hour'
  ) INTO v_recent_view;

  IF NOT v_recent_view THEN
    INSERT INTO project_views (project_id, viewer_id, session_fingerprint)
    VALUES (p_project_id, p_viewer_id, v_fingerprint);
  END IF;
END;
$$;

-- 4. RPC: Get project analytics (for directors)
CREATE OR REPLACE FUNCTION get_project_analytics(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_total_views bigint;
  v_unique_viewers bigint;
  v_views_today bigint;
  v_views_week bigint;
  v_scene_count bigint;
  v_contribution_count bigint;
  v_fork_count bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND director_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT COUNT(*) INTO v_total_views
  FROM project_views WHERE project_id = p_project_id;

  SELECT COUNT(DISTINCT COALESCE(viewer_id::text, session_fingerprint)) INTO v_unique_viewers
  FROM project_views WHERE project_id = p_project_id;

  SELECT COUNT(*) INTO v_views_today
  FROM project_views
  WHERE project_id = p_project_id AND viewed_at >= CURRENT_DATE;

  SELECT COUNT(*) INTO v_views_week
  FROM project_views
  WHERE project_id = p_project_id AND viewed_at >= CURRENT_DATE - interval '7 days';

  SELECT COUNT(*) INTO v_scene_count
  FROM scenes WHERE project_id = p_project_id;

  SELECT COUNT(*) INTO v_contribution_count
  FROM contributions WHERE project_id = p_project_id;

  SELECT COUNT(*) INTO v_fork_count
  FROM projects WHERE forked_from_project_id = p_project_id;

  v_result := jsonb_build_object(
    'total_views', v_total_views,
    'unique_viewers', v_unique_viewers,
    'views_today', v_views_today,
    'views_week', v_views_week,
    'scene_count', v_scene_count,
    'contribution_count', v_contribution_count,
    'fork_count', v_fork_count
  );

  RETURN v_result;
END;
$$;

-- 5. RPC: Get fork comparison data
CREATE OR REPLACE FUNCTION get_fork_comparison(
  p_original_id uuid,
  p_fork_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_original jsonb;
  v_fork jsonb;
  v_original_scenes jsonb;
  v_fork_scenes jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'description', p.description,
    'director_username', pr.username
  ) INTO v_original
  FROM projects p
  LEFT JOIN profiles pr ON pr.id = p.director_id
  WHERE p.id = p_original_id;

  SELECT jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'description', p.description,
    'director_username', pr.username
  ) INTO v_fork
  FROM projects p
  LEFT JOIN profiles pr ON pr.id = p.director_id
  WHERE p.id = p_fork_id;

  IF v_original IS NULL OR v_fork IS NULL THEN
    RETURN jsonb_build_object('error', 'Project not found');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'description', s.description,
      'media_url', s.media_url,
      'scene_order', s.scene_order,
      'contributor_username', pr.username
    ) ORDER BY s.scene_order
  ), '[]'::jsonb) INTO v_original_scenes
  FROM scenes s
  LEFT JOIN profiles pr ON pr.id = s.contributor_id
  WHERE s.project_id = p_original_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'description', s.description,
      'media_url', s.media_url,
      'scene_order', s.scene_order,
      'contributor_username', pr.username
    ) ORDER BY s.scene_order
  ), '[]'::jsonb) INTO v_fork_scenes
  FROM scenes s
  LEFT JOIN profiles pr ON pr.id = s.contributor_id
  WHERE s.project_id = p_fork_id;

  RETURN jsonb_build_object(
    'original', v_original,
    'fork', v_fork,
    'original_scenes', v_original_scenes,
    'fork_scenes', v_fork_scenes
  );
END;
$$;

-- 6. RPC: Request export (queue for worker)
CREATE OR REPLACE FUNCTION request_project_export(
  p_project_id uuid,
  p_resolution text DEFAULT '720p'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_scene_count int;
  v_existing uuid;
  v_request_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT COUNT(*) INTO v_scene_count
  FROM scenes WHERE project_id = p_project_id;

  IF v_scene_count = 0 THEN
    RETURN jsonb_build_object('error', 'No scenes to export');
  END IF;

  SELECT id INTO v_existing
  FROM export_requests
  WHERE project_id = p_project_id
    AND requested_by = v_user_id
    AND status IN ('queued', 'processing')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Export already in progress', 'request_id', v_existing);
  END IF;

  INSERT INTO export_requests (project_id, requested_by, resolution, scene_count)
  VALUES (p_project_id, v_user_id, p_resolution, v_scene_count)
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;
