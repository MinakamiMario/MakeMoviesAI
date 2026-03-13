'use client';

import { useEffect, useState } from 'react';
import styles from './ViewToggle.module.css';

export type ViewMode = 'grid' | 'list';

type Props = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
};

const STORAGE_KEY = 'browse_view_mode';

export function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>('grid');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'list' || stored === 'grid') setMode(stored);
  }, []);

  const set = (m: ViewMode) => {
    setMode(m);
    localStorage.setItem(STORAGE_KEY, m);
  };

  return [mode, set];
}

export default function ViewToggle({ value, onChange }: Props) {
  return (
    <div className={styles.toggle}>
      <button
        className={`${styles.btn} ${value === 'grid' ? styles.active : ''}`}
        onClick={() => onChange('grid')}
        aria-label="Grid view"
        title="Grid view"
      >
        {/* 2x2 grid icon */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" />
          <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" />
          <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" />
          <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
        </svg>
      </button>
      <button
        className={`${styles.btn} ${value === 'list' ? styles.active : ''}`}
        onClick={() => onChange('list')}
        aria-label="List view"
        title="List view"
      >
        {/* List icon */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2" width="14" height="3" rx="1" fill="currentColor" />
          <rect x="1" y="7" width="14" height="3" rx="1" fill="currentColor" />
          <rect x="1" y="12" width="14" height="3" rx="1" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
