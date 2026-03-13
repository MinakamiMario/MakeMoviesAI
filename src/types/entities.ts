/**
 * Core domain types for MakeMoviesAI
 * These types reflect the actual shape of Supabase query responses
 */

/** Embedded profile data from joins */
export type ProfileRef = {
  username: string;
  reputation_score?: number;
};

/** Project entity */
export type Project = {
  id: string;
  title: string;
  description: string | null;
  director_id: string;
  created_at: string;
  // Fork lineage
  forked_from_project_id: string | null;
  forked_at_branch_id: string | null;
  forked_at_scene_id: string | null;
  forked_from_contribution_id: string | null;
  forked_by: string | null;
  // Joined data
  profiles?: ProfileRef | null;
};

/** Scene entity */
export type Scene = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  media_url: string | null;
  scene_order: number;
  contributor_id: string | null;
  created_at: string;
  // Joined data
  profiles?: ProfileRef | null;
  // Media asset status (optional, populated when available)
  media_asset_id?: string | null;
  media_asset_status?: MediaAssetStatus | null;
  media_asset_error?: string | null;
};

/** Contribution entity */
export type Contribution = {
  id: string;
  project_id: string;
  parent_scene_id: string | null;
  title: string;
  description: string | null;
  media_url: string | null;
  status: 'pending' | 'accepted' | 'forked';
  contributor_id: string;
  created_at: string;
  // Joined data
  profiles?: ProfileRef | null;
  // Media asset status (optional, populated when available)
  media_asset_id?: string | null;
  media_asset_status?: MediaAssetStatus | null;
  media_asset_error?: string | null;
};

/** Fork origin info for UI display */
export type ForkOrigin = {
  forked_from_project_id: string;
  parent_project: { title: string } | null;
};

/** Media asset status */
export type MediaAssetStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

/** Media asset entity */
export type MediaAsset = {
  id: string;
  project_id: string;
  scene_id: string | null;
  contribution_id: string | null;
  phase_id: string | null;
  storage_path: string;
  file_type: string;
  file_size: number | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  status: MediaAssetStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  uploaded_by: string;
  created_at: string;
};

/** Notification type */
export type NotificationType = 'contribution_accepted' | 'contribution_forked' | 'new_comment';

/** Notification entity */
export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  reference_id: string | null;
  project_id: string | null;
  title: string;
  body: string | null;
  read: boolean;
  emailed: boolean;
  created_at: string;
};

/** Processing job entity */
export type ProcessingJob = {
  id: string;
  media_asset_id: string;
  job_type: 'validate' | 'metadata' | 'fast_preview' | 'normalize' | 'hls_segment';
  status: 'queued' | 'running' | 'completed' | 'failed';
  result: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};
