'use client';

import { Tag } from '@/types';
import styles from './TagFilterBar.module.css';

type Props = {
  tags: Tag[];
  selectedSlugs: string[];
  onToggle: (slug: string) => void;
  onClear: () => void;
};

const categoryOrder: Record<string, number> = { genre: 0, style: 1, format: 2 };

export default function TagFilterBar({ tags, selectedSlugs, onToggle, onClear }: Props) {
  const sorted = [...tags].sort(
    (a, b) => (categoryOrder[a.category] ?? 9) - (categoryOrder[b.category] ?? 9)
  );

  const hasSelection = selectedSlugs.length > 0;

  return (
    <div className={styles.bar}>
      <button
        className={`${styles.pill} ${!hasSelection ? styles.pillActive : ''}`}
        onClick={onClear}
      >
        All
      </button>

      <div className={styles.divider} />

      {sorted.map((tag) => {
        const active = selectedSlugs.includes(tag.slug);
        return (
          <button
            key={tag.id}
            className={`${styles.pill} ${active ? styles.pillActive : ''} ${styles[`cat_${tag.category}`] || ''}`}
            onClick={() => onToggle(tag.slug)}
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
