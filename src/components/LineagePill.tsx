'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './LineagePill.module.css';

type Props = {
  isFork: boolean;
  // For fork
  originProjectId?: string | null;
  originTitle?: string | null;

  // Depth (0 for main; null if unknown / not visible)
  forkDepth?: number | null;

  // Fork count display for main (exact 0-100, or 100+)
  forkCountLabel?: string | null;

  // Optional details for disclosure (keep minimal)
  forkPointLabel?: string | null; // e.g. "Scene 3/47"
  forkedByLabel?: string | null;  // e.g. "@oussama"
  forkedAtLabel?: string | null;  // e.g. "2 months ago"

  // Optional: open full tree
  onOpenTree?: () => void;
};

function depthDots(depth: number): string {
  // 0 dots for main, else min 5 dots to avoid silly long strings
  const d = Math.max(0, depth);
  const capped = Math.min(d, 5);
  return capped === 0 ? '' : '•'.repeat(capped);
}

export default function LineagePill(props: Props) {
  const {
    isFork,
    originProjectId,
    originTitle,
    forkDepth,
    forkCountLabel,
    forkPointLabel,
    forkedByLabel,
    forkedAtLabel,
    onOpenTree,
  } = props;

  const [expanded, setExpanded] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    // Enable hover-only expansion on pointer-fine devices
    try {
      const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
      const update = () => setCanHover(!!mq.matches);
      update();
      mq.addEventListener?.('change', update);
      return () => mq.removeEventListener?.('change', update);
    } catch {
      setCanHover(false);
    }
  }, []);

  useEffect(() => {
    if (!expanded) return;

    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setExpanded(false);
    };

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [expanded]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded((v) => !v);
    } else if (e.key === 'Escape') {
      setExpanded(false);
    }
  };

  const label = useMemo(() => {
    if (!isFork) return 'MAIN';
    if (typeof forkDepth === 'number') {
      const d = Math.max(0, forkDepth);
      // Show L20+ if capped/unknown-high; your RPC caps, but UI can still express "20+"
      return d >= 20 ? 'FORK · L20+' : `FORK · L${d}`;
    }
    return 'FORK';
  }, [isFork, forkDepth]);

  const compactRight = useMemo(() => {
    if (isFork) {
      const title = originTitle || 'Origin';
      const dots = typeof forkDepth === 'number' ? depthDots(forkDepth) : '';
      return dots ? `${dots} ${title}` : title;
    }
    return forkCountLabel ? `· ${forkCountLabel} forks` : '';
  }, [isFork, originTitle, forkDepth, forkCountLabel]);

  const onMouseEnter = () => {
    if (canHover) setExpanded(true);
  };
  const onMouseLeave = () => {
    if (canHover) setExpanded(false);
  };

  return (
    <div
      ref={ref}
      className={styles.pill}
      data-type={isFork ? 'fork' : 'main'}
      tabIndex={0}
      role="button"
      aria-expanded={expanded}
      aria-describedby={expanded ? tooltipId : undefined}
      aria-label={isFork ? `Fork lineage` : 'Main timeline'}
      onClick={() => setExpanded((v) => !v)}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className={styles.badge}>{label}</span>

      <span className={styles.compact}>
        {isFork ? (
          originProjectId ? (
            <>
              <span className={styles.sep}>·</span>
              <Link
                href={`/projects/${originProjectId}`}
                className={styles.originLink}
                onClick={(e) => e.stopPropagation()}
              >
                {compactRight}
              </Link>
            </>
          ) : (
            <>
              <span className={styles.sep}>·</span>
              <span className={styles.originText}>{compactRight}</span>
            </>
          )
        ) : (
          <span className={styles.originText}>{compactRight}</span>
        )}
      </span>

      {expanded && (
        <div
          id={tooltipId}
          className={styles.details}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
        >
          {isFork ? (
            <>
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Origin</span>
                {originProjectId ? (
                  <Link href={`/projects/${originProjectId}`} className={styles.detailLink}>
                    {originTitle || 'Unknown'}
                  </Link>
                ) : (
                  <span className={styles.detailVal}>{originTitle || 'Unknown'}</span>
                )}
              </div>

              {forkPointLabel && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Fork point</span>
                  <span className={styles.detailVal}>{forkPointLabel}</span>
                </div>
              )}

              {forkedByLabel && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>By</span>
                  <span className={styles.detailVal}>{forkedByLabel}</span>
                </div>
              )}

              {forkedAtLabel && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>When</span>
                  <span className={styles.detailVal}>{forkedAtLabel}</span>
                </div>
              )}

              {typeof forkDepth === 'number' && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Depth</span>
                  <span className={styles.detailVal}>
                    {forkDepth >= 20 ? '20+ levels from main' : `${forkDepth} levels from main`}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Timeline</span>
                <span className={styles.detailVal}>Main (canon)</span>
              </div>
              {forkCountLabel && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Forks</span>
                  <span className={styles.detailVal}>{forkCountLabel}</span>
                </div>
              )}
            </>
          )}

          {onOpenTree && (
            <button className={styles.treeBtn} onClick={onOpenTree} type="button">
              View full tree
            </button>
          )}
        </div>
      )}
    </div>
  );
}
