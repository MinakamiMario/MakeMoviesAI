'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './ProjectAnalytics.module.css';

type Analytics = {
  total_views: number;
  unique_viewers: number;
  views_today: number;
  views_week: number;
  scene_count: number;
  contribution_count: number;
  fork_count: number;
};

type Props = {
  projectId: string;
};

export default function ProjectAnalytics({ projectId }: Props) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      const { data } = await supabase.rpc('get_project_analytics', {
        p_project_id: projectId,
      });

      if (data && !data.error) {
        setAnalytics(data as Analytics);
      }
    };

    load();
  }, [open, projectId]);

  return (
    <div className={styles.container}>
      <button
        className={styles.toggle}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className={styles.toggleIcon}>{open ? '\u25BC' : '\u25B6'}</span>
        <span className={styles.toggleLabel}>Analytics</span>
        <span className={styles.directorBadge}>Director only</span>
      </button>

      {open && (
        <div className={styles.panel}>
          {!analytics ? (
            <div className={styles.loading}>Loading analytics...</div>
          ) : (
            <div className={styles.grid}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{analytics.total_views}</span>
                <span className={styles.statLabel}>Total views</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{analytics.unique_viewers}</span>
                <span className={styles.statLabel}>Unique viewers</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{analytics.views_today}</span>
                <span className={styles.statLabel}>Views today</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{analytics.views_week}</span>
                <span className={styles.statLabel}>This week</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{analytics.scene_count}</span>
                <span className={styles.statLabel}>Scenes</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{analytics.contribution_count}</span>
                <span className={styles.statLabel}>Contributions</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{analytics.fork_count}</span>
                <span className={styles.statLabel}>Forks</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
