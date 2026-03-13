'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { BrowseProject } from '@/types';
import styles from './ProjectCard.module.css';

type Props = {
  project: BrowseProject;
  variant?: 'grid' | 'list' | 'row';
};

const getStarCount = (score: number) => {
  if (score >= 500) return 5;
  if (score >= 200) return 4;
  if (score >= 100) return 3;
  if (score >= 50) return 2;
  if (score >= 10) return 1;
  return 0;
};

export default function ProjectCard({ project, variant = 'grid' }: Props) {
  const [previewActive, setPreviewActive] = useState(false);
  const [imgError, setImgError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();

  const thumbnailSrc = project.thumbnail_url || project.first_scene_media_url;
  const isVideo = thumbnailSrc?.match(/\.(mp4|webm|mov|m3u8)$/i);
  const isForked = !!project.forked_from_project_id;
  const stars = getStarCount(project.director_reputation);

  const handleMouseEnter = () => {
    if (isVideo && thumbnailSrc) {
      hoverTimer.current = setTimeout(() => setPreviewActive(true), 500);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setPreviewActive(false);
  };

  useEffect(() => {
    if (previewActive && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, [previewActive]);

  const cardClass = `${styles.card} ${styles[variant]}`;

  return (
    <Link
      href={`/projects/${project.id}`}
      className={cardClass}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail */}
      <div className={styles.thumbnail}>
        {thumbnailSrc && !imgError ? (
          isVideo && !previewActive ? (
            <video
              src={`${thumbnailSrc}#t=1`}
              className={styles.thumbnailMedia}
              muted
              preload="metadata"
              playsInline
            />
          ) : isVideo && previewActive ? (
            <video
              ref={videoRef}
              src={thumbnailSrc}
              className={styles.thumbnailMedia}
              muted
              autoPlay
              loop
              playsInline
            />
          ) : (
            <img
              src={thumbnailSrc}
              alt={project.title}
              className={styles.thumbnailMedia}
              loading="lazy"
              onError={() => setImgError(true)}
            />
          )
        ) : (
          <div className={styles.placeholder}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
              <rect x="2" y="2" width="20" height="20" rx="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
              <line x1="17" y1="17" x2="22" y2="17" />
            </svg>
            <span className={styles.placeholderTitle}>{project.title}</span>
          </div>
        )}

        {/* Title overlay */}
        <div className={styles.overlay}>
          <div className={styles.overlayTop}>
            {!isForked && <span className={styles.genesisBadge}>Genesis</span>}
            {project.view_count_7d > 0 && (
              <span className={styles.viewsBadge}>
                {project.view_count_7d} views
              </span>
            )}
          </div>
          <div className={styles.overlayBottom}>
            <h3 className={styles.title}>{project.title}</h3>
            <span className={styles.director}>
              @{project.director_username}
              {stars > 0 && <span className={styles.stars}>{' '}{'★'.repeat(stars)}</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Info below thumbnail */}
      <div className={styles.info}>
        <div className={styles.stats}>
          <span>{project.scene_count} scene{project.scene_count !== 1 ? 's' : ''}</span>
          <span className={styles.dot}>&middot;</span>
          <span>{project.contribution_count} contrib{project.contribution_count !== 1 ? 's' : ''}</span>
          {project.fork_count > 0 && (
            <>
              <span className={styles.dot}>&middot;</span>
              <span>{project.fork_count} fork{project.fork_count !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
        {project.tags.length > 0 && (
          <div className={styles.tags}>
            {project.tags.slice(0, 3).map((tag) => (
              <span key={tag.slug} className={styles.tag}>{tag.name}</span>
            ))}
            {project.tags.length > 3 && (
              <span className={styles.tagMore}>+{project.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
