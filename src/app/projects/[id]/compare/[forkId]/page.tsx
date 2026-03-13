'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import VideoPlayer from '@/components/VideoPlayer';
import { Skeleton } from '@/components/ui';
import styles from './page.module.css';

type CompareScene = {
  id: string;
  title: string;
  description: string | null;
  media_url: string | null;
  scene_order: number;
  contributor_username: string | null;
};

type CompareProject = {
  id: string;
  title: string;
  description: string | null;
  director_username: string | null;
};

type ComparisonData = {
  original: CompareProject;
  fork: CompareProject;
  original_scenes: CompareScene[];
  fork_scenes: CompareScene[];
};

export default function ComparePage({
  params,
}: {
  params: { id: string; forkId: string };
}) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const loadComparison = async () => {
      const { data: result, error: rpcError } = await supabase.rpc(
        'get_fork_comparison',
        {
          p_original_id: params.id,
          p_fork_id: params.forkId,
        }
      );

      if (rpcError || result?.error) {
        setError(rpcError?.message || result?.error || 'Failed to load comparison');
        setLoading(false);
        return;
      }

      setData(result as ComparisonData);
      setLoading(false);
    };

    loadComparison();
  }, [params.id, params.forkId]);

  // Build matched scene pairs
  const buildPairs = () => {
    if (!data) return [];

    const originalScenes = data.original_scenes || [];
    const forkScenes = data.fork_scenes || [];
    const maxLen = Math.max(originalScenes.length, forkScenes.length);

    const pairs: { original: CompareScene | null; fork: CompareScene | null; status: 'same' | 'modified' | 'added' | 'removed' }[] = [];

    for (let i = 0; i < maxLen; i++) {
      const orig = originalScenes[i] || null;
      const fork = forkScenes[i] || null;

      let status: 'same' | 'modified' | 'added' | 'removed';
      if (orig && fork) {
        status = orig.title === fork.title && orig.media_url === fork.media_url ? 'same' : 'modified';
      } else if (orig && !fork) {
        status = 'removed';
      } else {
        status = 'added';
      }

      pairs.push({ original: orig, fork: fork, status });
    }

    return pairs;
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <Navbar />
        <div className={styles.content}>
          <Skeleton width="60%" height="2rem" />
          <div className={styles.compareGrid} style={{ marginTop: 'var(--space-xl)' }}>
            <Skeleton width="100%" height="200px" />
            <Skeleton width="100%" height="200px" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className={styles.main}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.errorState}>
            <p>{error || 'Could not load comparison'}</p>
            <Link href={`/projects/${params.id}`}>Back to project</Link>
          </div>
        </div>
      </main>
    );
  }

  const pairs = buildPairs();
  const addedCount = pairs.filter(p => p.status === 'added').length;
  const removedCount = pairs.filter(p => p.status === 'removed').length;
  const modifiedCount = pairs.filter(p => p.status === 'modified').length;

  return (
    <main className={styles.main}>
      <Navbar />

      <div className={styles.content}>
        <Link href={`/projects/${params.id}`} className={styles.backLink}>
          &larr; Back to project
        </Link>

        <h1 className={styles.title}>Fork Comparison</h1>

        {/* Summary stats */}
        <div className={styles.summary}>
          {modifiedCount > 0 && (
            <span className={styles.statModified}>{modifiedCount} modified</span>
          )}
          {addedCount > 0 && (
            <span className={styles.statAdded}>{addedCount} added</span>
          )}
          {removedCount > 0 && (
            <span className={styles.statRemoved}>{removedCount} removed</span>
          )}
          {modifiedCount === 0 && addedCount === 0 && removedCount === 0 && (
            <span className={styles.statSame}>Identical timelines</span>
          )}
        </div>

        {/* Column headers */}
        <div className={styles.compareGrid}>
          <div className={styles.columnHeader}>
            <span className={styles.columnLabel}>Original</span>
            <Link href={`/projects/${data.original.id}`} className={styles.projectLink}>
              {data.original.title}
            </Link>
            {data.original.director_username && (
              <span className={styles.directorLabel}>by @{data.original.director_username}</span>
            )}
          </div>
          <div className={styles.columnHeader}>
            <span className={`${styles.columnLabel} ${styles.forkLabel}`}>Fork</span>
            <Link href={`/projects/${data.fork.id}`} className={styles.projectLink}>
              {data.fork.title}
            </Link>
            {data.fork.director_username && (
              <span className={styles.directorLabel}>by @{data.fork.director_username}</span>
            )}
          </div>
        </div>

        {/* Scene pairs */}
        {pairs.map((pair, i) => (
          <div key={i} className={`${styles.compareGrid} ${styles.scenePair}`}>
            {/* Original side */}
            <div className={`${styles.sceneCard} ${pair.status === 'removed' ? styles.removedCard : ''} ${!pair.original ? styles.emptyCard : ''}`}>
              {pair.original ? (
                <>
                  <span className={styles.sceneNumber}>
                    {String(pair.original.scene_order).padStart(2, '0')}
                  </span>
                  {pair.original.media_url && (
                    <div className={styles.sceneMedia}>
                      {pair.original.media_url.match(/\.(mp4|webm|mov|m3u8)$/i) ? (
                        <VideoPlayer src={pair.original.media_url} alt={pair.original.title} />
                      ) : (
                        <img src={pair.original.media_url} alt={pair.original.title} />
                      )}
                    </div>
                  )}
                  <h3>{pair.original.title}</h3>
                  {pair.original.contributor_username && (
                    <span className={styles.contributor}>by @{pair.original.contributor_username}</span>
                  )}
                </>
              ) : (
                <div className={styles.emptyScene}>
                  <span>No scene</span>
                </div>
              )}
            </div>

            {/* Status indicator */}
            <div className={styles.statusDivider}>
              {pair.status === 'same' && <span className={styles.statusDot} title="Identical">=</span>}
              {pair.status === 'modified' && <span className={`${styles.statusDot} ${styles.modifiedDot}`} title="Modified">~</span>}
              {pair.status === 'added' && <span className={`${styles.statusDot} ${styles.addedDot}`} title="Added">+</span>}
              {pair.status === 'removed' && <span className={`${styles.statusDot} ${styles.removedDot}`} title="Removed">&minus;</span>}
            </div>

            {/* Fork side */}
            <div className={`${styles.sceneCard} ${pair.status === 'added' ? styles.addedCard : ''} ${!pair.fork ? styles.emptyCard : ''}`}>
              {pair.fork ? (
                <>
                  <span className={styles.sceneNumber}>
                    {String(pair.fork.scene_order).padStart(2, '0')}
                  </span>
                  {pair.fork.media_url && (
                    <div className={styles.sceneMedia}>
                      {pair.fork.media_url.match(/\.(mp4|webm|mov|m3u8)$/i) ? (
                        <VideoPlayer src={pair.fork.media_url} alt={pair.fork.title} />
                      ) : (
                        <img src={pair.fork.media_url} alt={pair.fork.title} />
                      )}
                    </div>
                  )}
                  <h3>{pair.fork.title}</h3>
                  {pair.fork.contributor_username && (
                    <span className={styles.contributor}>by @{pair.fork.contributor_username}</span>
                  )}
                </>
              ) : (
                <div className={styles.emptyScene}>
                  <span>No scene</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {pairs.length === 0 && (
          <div className={styles.emptyComparison}>
            <p>Both projects have empty timelines.</p>
          </div>
        )}
      </div>
    </main>
  );
}
