'use client';

import { useEffect, useRef } from 'react';
import { Contribution, Scene } from '@/types';
import styles from './ContributionReview.module.css';

type Props = {
  contribution: Contribution;
  parentScene: Scene | null;
  onAccept: () => void;
  onFork: () => void;
  onClose: () => void;
  isDirector: boolean;
  /** Display order of parent scene (1-indexed) */
  parentSceneOrder?: number;
};

export default function ContributionReview({
  contribution,
  parentScene,
  onAccept,
  onFork,
  onClose,
  isDirector,
  parentSceneOrder,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const renderMedia = (url: string | null, alt: string) => {
    if (!url) return <div className={styles.noMedia}>No media</div>;

    const isVideo = url.match(/\.(mp4|webm|mov)$/i);
    if (isVideo) {
      return <video src={url} controls className={styles.media} />;
    }
    return <img src={url} alt={alt} className={styles.media} />;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const displayOrder = parentSceneOrder ?? parentScene?.scene_order ?? 0;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        className={styles.modal}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
      >
        <header className={styles.header}>
          <h2 id="review-title">Review Contribution</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </header>

        <div className={styles.content}>
          {parentScene ? (
            <section className={styles.section}>
              <div className={styles.sectionLabel}>
                <span className={styles.labelIcon}>◀</span>
                Parent Scene (Scene {displayOrder})
              </div>
              <div className={styles.sceneCard}>
                {renderMedia(parentScene.media_url, parentScene.title)}
                <div className={styles.sceneInfo}>
                  <h3>{parentScene.title}</h3>
                  {parentScene.description && (
                    <p className={styles.description}>{parentScene.description}</p>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section className={styles.section}>
              <div className={styles.sectionLabel}>
                <span className={styles.labelIcon}>◀</span>
                Parent Scene
              </div>
              <div className={styles.noParent}>
                This contribution proposes a new opening scene
              </div>
            </section>
          )}

          <div className={styles.flowArrow}>
            <span>↓</span>
            <span className={styles.flowLabel}>leads to</span>
          </div>

          <section className={styles.section}>
            <div className={styles.sectionLabel}>
              <span className={styles.labelIcon}>★</span>
              Proposed Contribution
            </div>
            <div className={styles.sceneCard}>
              {renderMedia(contribution.media_url, contribution.title)}
              <div className={styles.sceneInfo}>
                <h3>{contribution.title}</h3>
                {contribution.description && (
                  <p className={styles.description}>{contribution.description}</p>
                )}
                <div className={styles.contributorMeta}>
                  <span>by @{contribution.profiles?.username}</span>
                  <span className={styles.separator}>·</span>
                  <span>{formatDate(contribution.created_at)}</span>
                </div>
              </div>
            </div>
          </section>

          {isDirector && (
            <section className={styles.impactSection}>
              <h4>Decision Impact</h4>
              <div className={styles.impactOptions}>
                <div className={styles.impactOption}>
                  <strong>Accept</strong>
                  <p>This becomes the next canonical scene in your timeline.</p>
                </div>
                <div className={styles.impactOption}>
                  <strong>Fork</strong>
                  <p>A parallel project is created. The contributor becomes its director.</p>
                </div>
              </div>
            </section>
          )}
        </div>

        {isDirector && (
          <footer className={styles.footer}>
            <button className={styles.forkButton} onClick={onFork}>
              Fork
            </button>
            <button className={styles.acceptButton} onClick={onAccept}>
              Accept
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
