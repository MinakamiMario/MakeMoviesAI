import { SupabaseClient } from '@supabase/supabase-js';
import {
  Project,
  Scene,
  Contribution,
  ForkOrigin,
  BranchData,
} from '@/types';
import {
  getDefaultBranch,
  getBranchEdges,
  buildSceneOrder,
} from '@/lib/graph';

export type ProjectPageData = {
  project: Project;
  scenes: Scene[];
  contributions: Contribution[];
  branch: BranchData | null;
  forkedFrom: ForkOrigin | null;
  forkCount: number;
  isDirector: boolean;
};

export async function loadProjectData(
  supabase: SupabaseClient,
  projectId: string,
  userId: string | null
): Promise<ProjectPageData | null> {
  const { data: projectData } = await supabase
    .from('projects')
    .select('*, profiles!director_id(username)')
    .eq('id', projectId)
    .single();

  if (!projectData) {
    return null;
  }

  const project = projectData as Project;
  const isDirector = userId === project.director_id;

  // Load fork origin if applicable
  let forkedFrom: ForkOrigin | null = null;
  if (project.forked_from_project_id) {
    const { data: parentProject } = await supabase
      .from('projects')
      .select('title')
      .eq('id', project.forked_from_project_id)
      .single();

    forkedFrom = {
      forked_from_project_id: project.forked_from_project_id,
      parent_project: parentProject,
    };
  }

  // Load branch and scenes
  const branch = await getDefaultBranch(supabase, projectId);
  let scenes: Scene[] = [];

  if (branch) {
    const edges = await getBranchEdges(supabase, branch.id);
    const orderedSceneIds = buildSceneOrder(edges);

    if (orderedSceneIds.length > 0) {
      const { data: scenesData } = await supabase
        .from('scenes')
        .select('*, profiles!contributor_id(username)')
        .in('id', orderedSceneIds);

      const sceneMap = new Map((scenesData || []).map(s => [s.id, s]));
      scenes = orderedSceneIds
        .map(id => sceneMap.get(id))
        .filter(Boolean) as Scene[];
    }
  }

  // Load contributions
  let contributionsQuery = supabase
    .from('contributions')
    .select('*, profiles!contributor_id(username)')
    .eq('project_id', projectId)
    .eq('status', 'pending');

  if (!isDirector && userId) {
    contributionsQuery = contributionsQuery.eq('contributor_id', userId);
  }

  const { data: contributionsData } = await contributionsQuery;
  const contributions = (contributionsData as Contribution[]) || [];

  // Load fork count
  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('forked_from_project_id', projectId);

  return {
    project,
    scenes,
    contributions,
    branch,
    forkedFrom,
    forkCount: count || 0,
    isDirector,
  };
}
