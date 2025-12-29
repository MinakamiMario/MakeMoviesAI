/**
 * Graph-related types for branching architecture
 */

/** Branch entity */
export type BranchData = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_archived: boolean;
  forked_from_branch_id: string | null;
  fork_point_scene_id: string | null;
  created_by: string;
  created_at: string;
};

/** Scene edge for graph traversal */
export type EdgeData = {
  id: string;
  project_id: string;
  branch_id: string;
  from_scene_id: string | null;
  to_scene_id: string;
  created_by: string;
  created_at: string;
};
