'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import styles from './LineageTree.module.css';

type ForkInfo = {
  id: string;
  title: string;
  created_at: string;
  profiles: { username: string };
};

type ParentInfo = {
  id: string;
  title: string;
};

type Props = {
  projectId: string;
  projectTitle: string;
};

export default function LineageTree({ projectId, projectTitle }: Props) {
  const [parent, setParent] = useState<ParentInfo | null>(null);
  const [forks, setForks] = useState<ForkInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadLineage();
  }, [projectId]);

  const loadLineage = async () => {
    // Get parent project (if this project was forked)
    const { data: currentProject } = await supabase
      .from('projects')
      .select('forked_from_project_id')
      .eq('id', projectId)
      .single();

    if (currentProject?.forked_from_project_id) {
      const { data: parentProject } = await supabase
        .from('projects')
        .select('id, title')
        .eq('id', currentProject.forked_from_project_id)
        .single();

      if (parentProject) {
        setParent(parentProject);
      }
    }

    // Get all projects forked from this one
    const { data: forksData } = await supabase
      .from('projects')
      .select('id, title, created_at, profiles(username)')
      .eq('forked_from_project_id', projectId)
      .order('created_at', { ascending: true });

    setForks((forksData as unknown as ForkInfo[]) || []);
    setLoading(false);
  };

  if (loading) return null;
  if (!parent && forks.length === 0) return null;

  return (
    <div className={styles.container}>
      <h2>Lineage</h2>
      <div className={styles.tree}>
        {parent && (
          <div className={styles.node}>
            <span className={styles.connector}>↑</span>
            <Link href={`/projects/${parent.id}`} className={styles.link}>
              {parent.title}
            </Link>
            <span className={styles.label}>origin</span>
          </div>
        )}

        <div className={`${styles.node} ${styles.current}`}>
          <span className={styles.dot} />
          <span className={styles.title}>{projectTitle}</span>
          <span className={styles.label}>current</span>
        </div>

        {forks.map((fork) => (
          <div key={fork.id} className={styles.node}>
            <span className={styles.connector}>↓</span>
            <Link href={`/projects/${fork.id}`} className={styles.link}>
              {fork.title}
            </Link>
            <span className={styles.meta}>
              by @{fork.profiles?.username}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
