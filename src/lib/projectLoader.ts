import { SupabaseClient } from '@supabase/supabase-js';
import {
  Project,
  Scene,
  Contribution,
  ForkOrigin,
  BranchData,
} from '@/types';
import {
  formatForkPoint,
  formatRelativeTime,
} from './lineageHelpers';

export type ProjectPageData = {
  project: Project;
  scenes: Scene[];
  contributions: Contribution[];
  branch: BranchData | null;
  forkedFrom: ForkOrigin | null;
  forkCount: number;
  forkDepth: number | null;
  forkCountLabel: string | null;
  forkPointLabel: string | null;
  forkedByLabel: string | null;
  forkedAtLabel: string | null;
  isDirector: boolean;
};

/**
 * Load all project page data in a single RPC call.
 * Replaces 7+ sequential queries with one Postgres function.
 * The RPC handles: project fetch, director profile, parent title,
 * branch lookup, scene ordering (recursive CTE), contributions
 * (role-aware), fork count, and fork depth.
 */
export async function loadProjectData(
  supabase: SupabaseClient,
  projectId: string,
  _userId: string | null
): Promise<ProjectPageData | null> {
  const { data: result, error } = await supabase.rpc('get_project_page_data', {
    p_project_id: projectId,
  });

  if (error || !result || !result.found) {
    return null;
  }

  // Map RPC response to Project type
  const projectRaw = result.project;
  const project: Project = {
    ...projectRaw,
    profiles: {
      username: result.director_username,
      reputation_score: result.director_reputation || 0,
    },
  };

  const isDirector: boolean = result.is_director || false;

  // Map scenes from JSONB array
  const scenes: Scene[] = (result.scenes || []).map((s: Record<string, unknown>) => ({
    ...s,
    profiles: s.profiles || null,
  })) as Scene[];

  // Map contributions from JSONB array
  const contributions: Contribution[] = (result.contributions || []).map(
    (c: Record<string, unknown>) => ({
      ...c,
      profiles: c.profiles || null,
    })
  ) as Contribution[];

  // Map branch (RPC returns id + name; fill remaining fields with defaults)
  const branch: BranchData | null = result.branch
    ? {
        id: result.branch.id,
        name: result.branch.name,
        project_id: projectId,
        description: null,
        is_default: true,
        is_archived: false,
        forked_from_branch_id: null,
        fork_point_scene_id: null,
        created_by: project.director_id,
        created_at: project.created_at,
      }
    : null;

  // Map fork origin
  let forkedFrom: ForkOrigin | null = null;
  if (project.forked_from_project_id) {
    forkedFrom = {
      forked_from_project_id: project.forked_from_project_id,
      parent_project: result.parent_title
        ? { title: result.parent_title }
        : null,
    };
  }

  const forkCount: number = result.fork_count || 0;
  const forkDepth: number | null = result.fork_depth ?? null;

  // Derive UI labels client-side (cheap string ops)
  const forkCountLabel = forkCount > 0 ? (forkCount > 100 ? '100+' : String(forkCount)) : '';

  let forkPointLabel: string | null = null;
  if (project.forked_at_scene_id && scenes.length > 0) {
    const forkScene = scenes.find(s => s.id === project.forked_at_scene_id);
    if (forkScene) {
      forkPointLabel = formatForkPoint(forkScene.scene_order, scenes.length);
    }
  }

  const forkedByLabel = project.forked_by && project.profiles
    ? `@${project.profiles.username}`
    : null;

  const forkedAtLabel = project.created_at
    ? formatRelativeTime(project.created_at)
    : null;

  return {
    project,
    scenes,
    contributions,
    branch,
    forkedFrom,
    forkCount,
    forkDepth,
    forkCountLabel,
    forkPointLabel,
    forkedByLabel,
    forkedAtLabel,
    isDirector,
  };
}
