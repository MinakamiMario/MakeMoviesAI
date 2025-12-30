'use client';

import Link from 'next/link';
import { Project, ForkOrigin } from '@/types';
import styles from './ProjectHeader.module.css';

type Props = {
  project: Project;
  forkedFrom: ForkOrigin | null;
  forkCount: number;
};

export default function ProjectHeader({ project, forkedFrom, forkCount }: Props) {
  return (
    <div className={styles.projectHeader}>
      <span className={styles.label}>Project</span>
      <h1>{project.title}</h1>
      <p className={styles.director}>
        Directed by <span>@{project.profiles?.username}</span>
      </p>
      {forkedFrom && (
        <p className={styles.forkedFrom}>
          Forked from{' '}
          <Link href={`/projects/${forkedFrom.forked_from_project_id}`}>
            {forkedFrom.parent_project?.title || 'Unknown'}
          </Link>
        </p>
      )}
      {forkCount > 0 && (
        <span className={styles.forkBadge}>
          {forkCount} fork{forkCount !== 1 ? 's' : ''}
        </span>
      )}
      {project.description && (
        <p className={styles.description}>{project.description}</p>
      )}
    </div>
  );
}
