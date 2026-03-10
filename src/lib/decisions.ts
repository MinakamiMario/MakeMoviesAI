import { SupabaseClient } from '@supabase/supabase-js';
import {
  Contribution,
  BranchData,
} from '@/types';

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

/**
 * Accept a contribution using server-side RPC.
 * All operations are atomic — full rollback on any failure.
 */
export async function acceptContribution(
  supabase: SupabaseClient,
  projectId: string,
  branch: BranchData,
  contribution: Contribution
): Promise<AcceptResult> {
  const { data, error } = await supabase
    .rpc('accept_contribution', {
      p_contribution_id: contribution.id,
      p_project_id: projectId,
      p_branch_id: branch.id,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, sceneId: data as string };
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
