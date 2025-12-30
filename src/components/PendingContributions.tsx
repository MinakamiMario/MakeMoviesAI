'use client';

import { Contribution } from '@/types';
import ContributionCard from './ContributionCard';
import styles from './PendingContributions.module.css';

type Props = {
  contributions: Contribution[];
  onSelect: (contribution: Contribution) => void;
  isDirector: boolean;
  currentUserId: string | null;
};

export default function PendingContributions({
  contributions,
  onSelect,
  isDirector,
  currentUserId,
}: Props) {
  if (contributions.length === 0) {
    return null;
  }

  return (
    <div className={styles.contributions}>
      <h2>{isDirector ? 'Pending Contributions' : 'Your Submissions'}</h2>
      <div className={styles.contributionsList}>
        {contributions.map((contribution) => (
          <ContributionCard
            key={contribution.id}
            contribution={contribution}
            onSelect={onSelect}
            isOwnSubmission={contribution.contributor_id === currentUserId}
          />
        ))}
      </div>
    </div>
  );
}
