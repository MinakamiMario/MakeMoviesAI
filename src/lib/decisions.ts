import { SupabaseClient } from '@supabase/supabase-js';
import {
  Project,
  Scene,
  Contribution,
  BranchData,
} from '@/types';
import {
  getBranchEdges,
  findLastSceneId,
  createEdge,
} from '@/lib/graph';

export type AcceptResult = {
  success: boolean;
  sceneId?: string;
  error?: string;
};

export type ForkResult = {
  success: boolean;
  newProjectId?: string;
  error?: string;
};

export async function acceptContribution(
  supabase: SupabaseClient,
  projectId: string,
  branch: BranchData,
  contribution: Contribution,
  currentScenes: Scene[],
  actorId: string
): Promise<AcceptResult> {
  const edges = await getBranchEdges(supabase, branch.id);
  const lastSceneId = findLastSceneId(edges);

  const { data: newScene, error: sceneError } = await supabase
    .from('scenes')
    .insert({
      project_id: projectId,
      title: contribution.title,
      description: contribution.description,
      media_url: contribution.media_url,
      scene_order: currentScenes.length + 1,
      contributor_id: contribution.contributor_id,
    })
    .select()
    .single();

  if (sceneError || !newScene) {
    return { success: false, error: sceneError?.message || 'Failed to create scene' };
  }

  const edgeResult = await createEdge(
    supabase,
    projectId,
    branch.id,
    lastSceneId,
    newScene.id,
    actorId
  );

  if (!edgeResult.success) {
    return { success: false, error: edgeResult.error || 'Failed to create edge' };
  }

  const { error: updateError } = await supabase
    .from('contributions')
    .update({ status: 'accepted' })
    .eq('id', contribution.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  await supabase.from('decision_events').insert({
    project_id: projectId,
    actor_id: actorId,
    event_type: 'accept_contribution',
    contribution_id: contribution.id,
    result_scene_id: newScene.id,
    metadata: { branch_id: branch.id },
  });

  return { success: true, sceneId: newScene.id };
}

/**
 * Fork a contribution into a new project using server-side RPC.
 * The contributor becomes the director of the forked project.
 * All operations are atomic - full rollback on any failure.
 */
export async function forkContribution(
  supabase: SupabaseClient,
  contribution: Contribution
): Promise<ForkResult> {
  const { data, error } = await supabase
    .rpc('fork_contribution', {
      p_contribution_id: contribution.id,
    });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
    newProjectId: data as string,
  };
}
