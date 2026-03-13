'use client';

import styles from './ProjectCardSkeleton.module.css';

type Props = {
  variant?: 'grid' | 'row' | 'list';
};

export default function ProjectCardSkeleton({ variant = 'grid' }: Props) {
  return (
    <div className={`${styles.card} ${styles[variant]}`}>
      <div className={styles.thumbnail}>
        <div className={styles.shimmer} />
      </div>
      <div className={styles.info}>
        <div className={`${styles.shimmerLine} ${styles.titleLine}`} />
        <div className={`${styles.shimmerLine} ${styles.statsLine}`} />
        {variant !== 'row' && (
          <div className={styles.tags}>
            <div className={styles.shimmerPill} />
            <div className={styles.shimmerPill} />
          </div>
        )}
      </div>
    </div>
  );
}
