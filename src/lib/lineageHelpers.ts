import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get fork count label with capped query for performance.
 * Returns exact count for 0-100 forks, "100+" for more.
 * 
 * This is more efficient than COUNT(*) at scale:
 * - LIMIT 101 stops early (doesn't scan all rows)
 * - Provides informative label without exact count overhead
 */
export async function getForkCountLabelCapped(
  supabase: SupabaseClient,
  parentProjectId: string
): Promise<string> {
  // Fetch at most 101 rows; if we get 101, label becomes "100+"
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('forked_from_project_id', parentProjectId)
    .limit(101);

  if (error) {
    console.error('getForkCountLabelCapped error:', error);
    return '';
  }

  const n = data?.length ?? 0;
  
  if (n === 0) return '';
  if (n >= 101) return '100+';
  return String(n);
}

/**
 * Get fork depth from main timeline.
 * Uses RPC function with cycle detection and max depth cap.
 */
export async function getForkDepth(
  supabase: SupabaseClient,
  projectId: string
): Promise<number | null> {
  const { data, error } = await supabase.rpc('get_fork_depth', {
    p_project_id: projectId,
    p_max_depth: 20,
  });

  if (error) {
    console.error('getForkDepth error:', error);
    return null;
  }

  return data as number | null;
}

/**
 * Format fork point label (e.g., "Scene 3/47")
 */
export function formatForkPoint(
  forkSceneOrder: number | null,
  totalScenes: number
): string | null {
  if (!forkSceneOrder) return null;
  return `Scene ${forkSceneOrder}/${totalScenes}`;
}

/**
 * Format relative time (e.g., "2 months ago")
 */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
