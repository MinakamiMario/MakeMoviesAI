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
  createDefaultBranch,
  createDefaultCut,
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

export async function forkContribution(
  supabase: SupabaseClient,
  project: Project,
  branch: BranchData,
  contribution: Contribution,
  currentScenes: Scene[],
  actorId: string
): Promise<ForkResult> {
  const { data: newProject, error: projectError } = await supabase
    .from('projects')
    .insert({
      title: `${project.title} (Fork)`,
      description: `Forked from "${project.title}" — ${contribution.title}`,
      director_id: contribution.contributor_id,
      forked_from_project_id: project.id,
      forked_at_scene_id: contribution.parent_scene_id,
      forked_from_contribution_id: contribution.id,
      forked_by: contribution.contributor_id,
    })
    .select()
    .single();

  if (projectError || !newProject) {
    return { success: false, error: projectError?.message || 'Failed to create project' };
  }

  const newBranch = await createDefaultBranch(
    supabase,
    newProject.id,
    contribution.contributor_id
  );

  if (!newBranch) {
    return { success: false, error: 'Failed to create default branch' };
  }

  await createDefaultCut(supabase, newProject.id, contribution.contributor_id);

  // Copy existing scenes with edges
  let prevSceneId: string | null = null;
  for (const scene of currentScenes) {
    const { data: copiedScene } = await supabase
      .from('scenes')
      .insert({
        project_id: newProject.id,
        title: scene.title,
        description: scene.description,
        media_url: scene.media_url,
        scene_order: scene.scene_order,
        contributor_id: scene.contributor_id,
      })
      .select()
      .single();

    if (copiedScene) {
      await createEdge(
        supabase,
        newProject.id,
        newBranch.id,
        prevSceneId,
        copiedScene.id,
        contribution.contributor_id
      );
      prevSceneId = copiedScene.id;
    }
  }

  // Add contribution as final scene
  const { data: finalScene } = await supabase
    .from('scenes')
    .insert({
      project_id: newProject.id,
      title: contribution.title,
      description: contribution.description,
      media_url: contribution.media_url,
      scene_order: currentScenes.length + 1,
      contributor_id: contribution.contributor_id,
    })
    .select()
    .single();

  if (finalScene) {
    await createEdge(
      supabase,
      newProject.id,
      newBranch.id,
      prevSceneId,
      finalScene.id,
      contribution.contributor_id
    );
  }

  const { error: updateError } = await supabase
    .from('contributions')
    .update({ status: 'forked' })
    .eq('id', contribution.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  await supabase.from('decision_events').insert({
    project_id: project.id,
    actor_id: actorId,
    event_type: 'fork_contribution',
    contribution_id: contribution.id,
    result_new_project_id: newProject.id,
    metadata: { forked_at_scene_id: contribution.parent_scene_id },
  });

  return { success: true, newProjectId: newProject.id };
}
