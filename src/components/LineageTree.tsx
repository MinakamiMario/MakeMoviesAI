'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import styles from './LineageTree.module.css';

type ForkInfo = {
  id: string;
  new_project_id: string;
  created_at: string;
  projects: { title: string }[];
  profiles: { username: string }[];
};

type ParentInfo = {
  original_project_id: string;
  projects: { title: string }[];
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
    const { data: parentData } = await supabase
      .from('forks')
      .select('original_project_id, projects!forks_original_project_id_fkey(title)')
      .eq('new_project_id', projectId)
      .single();

    if (parentData?.projects) {
      setParent(parentData as unknown as ParentInfo);
    }

    const { data: forksData } = await supabase
      .from('forks')
      .select(`
        id,
        new_project_id,
        created_at,
        projects!forks_new_project_id_fkey(title),
        profiles!forks_forked_by_fkey(username)
      `)
      .eq('original_project_id', projectId)
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
            <Link href={`/projects/${parent.original_project_id}`} className={styles.link}>
              {parent.projects?.[0]?.title || 'Parent project'}
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
            <Link href={`/projects/${fork.new_project_id}`} className={styles.link}>
              {fork.projects?.[0]?.title || 'Fork'}
            </Link>
            <span className={styles.meta}>
              by @{fork.profiles?.[0]?.username}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
