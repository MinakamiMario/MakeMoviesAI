'use client';

import { KeyboardEvent } from 'react';
import Link from 'next/link';
import { Contribution } from '@/types';
import styles from './ContributionCard.module.css';

type Props = {
  contribution: Contribution;
  onSelect: (contribution: Contribution) => void;
  isOwnSubmission?: boolean;
};

export default function ContributionCard({
  contribution,
  onSelect,
  isOwnSubmission = false,
}: Props) {
  const handleClick = () => {
    onSelect(contribution);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(contribution);
    }
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getThumbnail = () => {
    if (!contribution.media_url) return null;

    const isVideo = contribution.media_url.match(/\.(mp4|webm|mov)$/i);
    if (isVideo) {
      return (
        <video
          src={contribution.media_url}
          className={styles.thumbnail}
          muted
          preload="metadata"
        />
      );
    }

    return (
      <img
        src={contribution.media_url}
        alt={contribution.title}
        className={styles.thumbnail}
      />
    );
  };

  return (
    <div
      className={`${styles.card} ${isOwnSubmission ? styles.ownSubmission : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Review contribution: ${contribution.title}`}
    >
      <div className={styles.thumbnailContainer}>
        {getThumbnail() || <div className={styles.noThumbnail} />}
      </div>

      <div className={styles.content}>
        <h4 className={styles.title}>{contribution.title}</h4>
        <div className={styles.meta}>
          {contribution.profiles?.username ? (
            <Link
              href={`/users/${contribution.profiles.username}`}
              className={styles.contributor}
              onClick={(e) => e.stopPropagation()}
            >
              @{contribution.profiles.username}
              {(contribution.profiles.reputation_score || 0) >= 10 && (
                <span className={styles.miniStars} title={`${contribution.profiles.reputation_score} pts`}>
                  {'★'.repeat(
                    (contribution.profiles.reputation_score || 0) >= 500 ? 5 :
                    (contribution.profiles.reputation_score || 0) >= 200 ? 4 :
                    (contribution.profiles.reputation_score || 0) >= 100 ? 3 :
                    (contribution.profiles.reputation_score || 0) >= 50 ? 2 : 1
                  )}
                </span>
              )}
            </Link>
          ) : (
            <span className={styles.contributor}>@unknown</span>
          )}
          <span className={styles.separator}>·</span>
          <span className={styles.date}>{formatDate(contribution.created_at)}</span>
        </div>
        {isOwnSubmission && (
          <span className={styles.badge}>Your submission</span>
        )}
      </div>

      <div className={styles.arrow}>→</div>
    </div>
  );
}
