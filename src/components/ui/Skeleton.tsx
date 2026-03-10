import styles from './Skeleton.module.css';

type Props = {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
};

export default function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius,
  className,
}: Props) {
  return (
    <div
      className={`${styles.skeleton} ${className || ''}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  );
}

/** Pre-composed skeleton for a card in the dashboard grid */
export function CardSkeleton() {
  return (
    <div className={styles.card}>
      <Skeleton height="1.25rem" width="70%" />
      <Skeleton height="0.875rem" width="100%" />
      <Skeleton height="0.875rem" width="40%" />
    </div>
  );
}

/** Pre-composed skeleton for a scene in the timeline */
export function SceneSkeleton() {
  return (
    <div className={styles.scene}>
      <Skeleton width="2rem" height="2rem" borderRadius="50%" />
      <div className={styles.sceneContent}>
        <Skeleton height="160px" borderRadius="var(--radius-lg)" />
        <Skeleton height="1.125rem" width="60%" />
        <Skeleton height="0.875rem" width="30%" />
      </div>
    </div>
  );
}

/** Pre-composed skeleton for a contribution card */
export function ContributionSkeleton() {
  return (
    <div className={styles.contribution}>
      <Skeleton width="64px" height="64px" borderRadius="var(--radius-md)" />
      <div className={styles.contributionContent}>
        <Skeleton height="1rem" width="60%" />
        <Skeleton height="0.75rem" width="40%" />
      </div>
    </div>
  );
}
