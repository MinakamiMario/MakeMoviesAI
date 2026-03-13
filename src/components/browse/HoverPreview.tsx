'use client';

import { useRef, useState, useEffect } from 'react';
import { BrowseProject } from '@/types';
import ProjectCard from './ProjectCard';
import styles from './HoverPreview.module.css';

type Props = {
  project: BrowseProject;
  variant?: 'grid' | 'list' | 'row';
};

/**
 * Wraps ProjectCard with IntersectionObserver-based visibility tracking.
 * Only renders the card when it's near the viewport (lazy loading).
 * On desktop, the hover video preview in ProjectCard is activated
 * only for visible cards to save bandwidth.
 */
export default function HoverPreview({ project, variant = 'grid' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={styles.wrapper}>
      {isVisible ? (
        <ProjectCard project={project} variant={variant} />
      ) : (
        <div
          className={styles.placeholder}
          style={{ paddingTop: variant === 'list' ? '0' : '56.25%' }}
        />
      )}
    </div>
  );
}
