import { SupabaseClient } from '@supabase/supabase-js';

export type BranchData = {
  id: string;
  project_id: string;
  name: string;
  is_default: boolean;
  created_by: string;
};

export type EdgeData = {
  id: string;
  branch_id: string;
  from_scene_id: string | null;
  to_scene_id: string;
};

/**
 * Get the default branch for a project
 */
export async function getDefaultBranch(
  supabase: SupabaseClient,
  projectId: string
): Promise<BranchData | null> {
  const { data } = await supabase
    .from('branches')
    .select('id, project_id, name, is_default, created_by')
    .eq('project_id', projectId)
    .eq('is_default', true)
    .single();

  return data;
}

/**
 * Get all edges for a branch, ordered for traversal
 */
export async function getBranchEdges(
  supabase: SupabaseClient,
  branchId: string
): Promise<EdgeData[]> {
  const { data } = await supabase
    .from('scene_edges')
    .select('id, branch_id, from_scene_id, to_scene_id')
    .eq('branch_id', branchId);

  return data || [];
}

/**
 * Build ordered scene IDs from edges (traverses the linked list)
 */
export function buildSceneOrder(edges: EdgeData[]): string[] {
  if (edges.length === 0) return [];

  // Find the start edge (from_scene_id is null)
  const startEdge = edges.find(e => e.from_scene_id === null);
  if (!startEdge) return [];

  // Build a map: from_scene_id -> edge
  const edgeMap = new Map<string | null, EdgeData>();
  for (const edge of edges) {
    edgeMap.set(edge.from_scene_id, edge);
  }

  // Traverse the chain
  const orderedIds: string[] = [];
  let currentEdge: EdgeData | undefined = startEdge;

  while (currentEdge) {
    orderedIds.push(currentEdge.to_scene_id);
    currentEdge = edgeMap.get(currentEdge.to_scene_id);
  }

  return orderedIds;
}

/**
 * Find the last scene in a branch (the one with no outgoing edge)
 */
export function findLastSceneId(edges: EdgeData[]): string | null {
  if (edges.length === 0) return null;

  // Get all to_scene_ids (scenes that have incoming edges)
  const toSceneIds = new Set(edges.map(e => e.to_scene_id));

  // Get all from_scene_ids (scenes that have outgoing edges)
  const fromSceneIds = new Set(edges.map(e => e.from_scene_id).filter(Boolean));

  // Last scene = has incoming edge but no outgoing edge
  for (const sceneId of Array.from(toSceneIds)) {
    if (!fromSceneIds.has(sceneId)) {
      return sceneId;
    }
  }

  return null;
}

/**
 * Create an edge in a branch
 */
export async function createEdge(
  supabase: SupabaseClient,
  projectId: string,
  branchId: string,
  fromSceneId: string | null,
  toSceneId: string,
  createdBy: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('scene_edges').insert({
    project_id: projectId,
    branch_id: branchId,
    from_scene_id: fromSceneId,
    to_scene_id: toSceneId,
    created_by: createdBy,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Create a default branch for a new project
 */
export async function createDefaultBranch(
  supabase: SupabaseClient,
  projectId: string,
  createdBy: string
): Promise<BranchData | null> {
  const { data } = await supabase
    .from('branches')
    .insert({
      project_id: projectId,
      name: 'Main',
      is_default: true,
      created_by: createdBy,
    })
    .select()
    .single();

  return data;
}

/**
 * Create a default cut for a new project
 */
export async function createDefaultCut(
  supabase: SupabaseClient,
  projectId: string,
  createdBy: string
): Promise<void> {
  await supabase.from('cuts').insert({
    project_id: projectId,
    name: 'Default',
    is_default: true,
    created_by: createdBy,
  });
}
