'use client';

import Link from 'next/link';
import styles from './ContributorCard.module.css';

export type ContributorData = {
  id: string;
  username: string;
  bio: string | null;
  reputation_score: number;
  accepted_count: number;
  contribution_count: number;
  project_count: number;
  contributions_period: number;
  accepted_period: number;
  comment_count: number;
  created_at: string;
};

type Props = {
  contributor: ContributorData;
  rank: number;
  variant?: 'card' | 'row';
};

export default function ContributorCard({ contributor, rank, variant = 'card' }: Props) {
  const initial = contributor.username.charAt(0).toUpperCase();

  return (
    <Link
      href={`/users/${contributor.username}`}
      className={`${styles.card} ${variant === 'row' ? styles.cardRow : ''}`}
    >
      <div className={styles.rankBadge} data-rank={rank}>
        {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
      </div>

      <div className={styles.avatar}>
        <span>{initial}</span>
      </div>

      <div className={styles.info}>
        <span className={styles.username}>@{contributor.username}</span>
        <span className={styles.reputation}>{contributor.reputation_score} rep</span>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{contributor.accepted_period || contributor.accepted_count}</span>
          <span className={styles.statLabel}>accepted</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{contributor.contributions_period || contributor.contribution_count}</span>
          <span className={styles.statLabel}>contribs</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{contributor.project_count}</span>
          <span className={styles.statLabel}>projects</span>
        </div>
      </div>
    </Link>
  );
}
