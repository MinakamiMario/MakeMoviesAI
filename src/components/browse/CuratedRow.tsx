'use client';

import { useRef, useState, useEffect } from 'react';
import { BrowseProject } from '@/types';
import ProjectCard from './ProjectCard';
import ProjectCardSkeleton from './ProjectCardSkeleton';
import styles from './CuratedRow.module.css';

type Props = {
  title: string;
  projects: BrowseProject[];
  seeAllHref?: string;
  loading?: boolean;
};

export default function CuratedRow({ title, projects, seeAllHref, loading }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [projects]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  if (!loading && projects.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {seeAllHref && (
          <a href={seeAllHref} className={styles.seeAll}>
            See all &rarr;
          </a>
        )}
      </div>

      <div className={styles.rowWrapper}>
        {canScrollLeft && (
          <button
            className={`${styles.arrow} ${styles.arrowLeft}`}
            onClick={() => scroll('left')}
            aria-label="Scroll left"
          >
            &#8249;
          </button>
        )}

        <div ref={scrollRef} className={styles.row}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <ProjectCardSkeleton key={i} variant="row" />
              ))
            : projects.map((project) => (
                <ProjectCard key={project.id} project={project} variant="row" />
              ))}
        </div>

        {canScrollRight && (
          <button
            className={`${styles.arrow} ${styles.arrowRight}`}
            onClick={() => scroll('right')}
            aria-label="Scroll right"
          >
            &#8250;
          </button>
        )}
      </div>
    </section>
  );
}
