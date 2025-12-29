import { SupabaseClient } from '@supabase/supabase-js';
import { BranchData, EdgeData } from '@/types';

/**
 * Get the default branch for a project
 */
export async function getDefaultBranch(
  supabase: SupabaseClient,
  projectId: string
): Promise<BranchData | null> {
  const { data } = await supabase
    .from('branches')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_default', true)
    .single();

  return data;
}

/**
 * Get all edges for a branch
 */
export async function getBranchEdges(
  supabase: SupabaseClient,
  branchId: string
): Promise<EdgeData[]> {
  const { data } = await supabase
    .from('scene_edges')
    .select('*')
    .eq('branch_id', branchId);

  return data || [];
}

/**
 * Build ordered scene IDs from edges (traverses the linked list)
 */
export function buildSceneOrder(edges: EdgeData[]): string[] {
  if (edges.length === 0) return [];

  const startEdge = edges.find(e => e.from_scene_id === null);
  if (!startEdge) return [];

  const edgeMap = new Map<string | null, EdgeData>();
  for (const edge of edges) {
    edgeMap.set(edge.from_scene_id, edge);
  }

  const orderedIds: string[] = [];
  let currentEdge: EdgeData | undefined = startEdge;

  while (currentEdge) {
    orderedIds.push(currentEdge.to_scene_id);
    currentEdge = edgeMap.get(currentEdge.to_scene_id);
  }

  return orderedIds;
}

/**
 * Find the last scene in a branch (no outgoing edge)
 */
export function findLastSceneId(edges: EdgeData[]): string | null {
  if (edges.length === 0) return null;

  const toSceneIds = new Set(edges.map(e => e.to_scene_id));
  const fromSceneIds = new Set(edges.map(e => e.from_scene_id).filter(Boolean));

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
