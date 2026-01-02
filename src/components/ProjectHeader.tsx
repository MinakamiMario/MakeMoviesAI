// This is the UPDATED src/components/ProjectHeader.tsx
// This REPLACES your existing file

'use client';

import { Project, ForkOrigin } from '@/types';
import LineagePill from './LineagePill';
import styles from './ProjectHeader.module.css';

type Props = {
  project: Project;
  forkedFrom: ForkOrigin | null;
  forkCount: number;
  // NEW props from projectLoader
  forkDepth?: number | null;
  forkCountLabel?: string | null;
  forkPointLabel?: string | null;
  forkedByLabel?: string | null;
  forkedAtLabel?: string | null;
};

export default function ProjectHeader({ 
  project, 
  forkedFrom, 
  forkCount,
  forkDepth,
  forkCountLabel,
  forkPointLabel,
  forkedByLabel,
  forkedAtLabel,
}: Props) {
  return (
    <div className={styles.projectHeader}>
      {/* NEW: LineagePill replaces old fork text */}
      <LineagePill
        isFork={!!project.forked_from_project_id}
        originProjectId={forkedFrom?.forked_from_project_id ?? null}
        originTitle={forkedFrom?.parent_project?.title ?? null}
        forkDepth={forkDepth ?? null}
        forkCountLabel={forkCountLabel ?? null}
        forkPointLabel={forkPointLabel ?? null}
        forkedByLabel={forkedByLabel ?? null}
        forkedAtLabel={forkedAtLabel ?? null}
        onOpenTree={() => {
          // Scroll to LineageTree section
          document.getElementById('lineage')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
      
      <span className={styles.label}>Project</span>
      <h1>{project.title}</h1>
      <p className={styles.director}>
        Directed by <span>@{project.profiles?.username}</span>
      </p>
      
      {/* REMOVED: Old fork text - now handled by LineagePill
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
      */}
      
      {project.description && (
        <p className={styles.description}>{project.description}</p>
      )}
    </div>
  );
}
