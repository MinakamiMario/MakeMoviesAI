/**
 * Core domain types for MakeMoviesAI
 * These types reflect the actual shape of Supabase query responses
 */

/** Embedded profile data from joins */
export type ProfileRef = {
  username: string;
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
};

/** Fork origin info for UI display */
export type ForkOrigin = {
  forked_from_project_id: string;
  parent_project: { title: string } | null;
};
