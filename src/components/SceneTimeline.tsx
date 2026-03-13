'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Scene } from '@/types';
import VideoPlayer from './VideoPlayer';
import HorizontalTimeline from './HorizontalTimeline';
import styles from './SceneTimeline.module.css';

type Props = {
  scenes: Scene[];
  isDirector: boolean;
  projectId: string;
  showContributeButton: boolean;
  onCinemaOpen?: (startIndex: number) => void;
};

export default function SceneTimeline({
  scenes,
  isDirector,
  projectId,
  showContributeButton,
  onCinemaOpen,
}: Props) {
  const [view, setView] = useState<'vertical' | 'horizontal'>('vertical');

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineHeader}>
        <h2>Timeline</h2>
        <div className={styles.headerActions}>
          {/* View toggle */}
          {scenes.length > 0 && (
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${view === 'vertical' ? styles.viewBtnActive : ''}`}
                onClick={() => setView('vertical')}
                aria-label="Vertical view"
                title="Vertical view"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="1" width="12" height="3" rx="0.5" />
                  <rect x="2" y="6" width="12" height="3" rx="0.5" />
                  <rect x="2" y="11" width="12" height="3" rx="0.5" />
                </svg>
              </button>
              <button
                className={`${styles.viewBtn} ${view === 'horizontal' ? styles.viewBtnActive : ''}`}
                onClick={() => setView('horizontal')}
                aria-label="Horizontal view"
                title="Horizontal timeline"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="2" width="3" height="12" rx="0.5" />
                  <rect x="6" y="2" width="3" height="12" rx="0.5" />
                  <rect x="11" y="2" width="3" height="12" rx="0.5" />
                </svg>
              </button>
            </div>
          )}

          {isDirector && (
            <Link href={`/projects/${projectId}/add-scene`} className={styles.addBtn}>
              + Add scene
            </Link>
          )}
        </div>
      </div>

      {scenes.length === 0 ? (
        <p className={styles.empty}>No scenes yet.</p>
      ) : view === 'horizontal' ? (
        <HorizontalTimeline
          scenes={scenes}
          onSceneClick={(index) => onCinemaOpen?.(index)}
        />
      ) : (
        <div className={styles.scenes}>
          {scenes.map((scene, index) => (
            <div key={scene.id} className={styles.scene}>
              <span className={styles.sceneNumber}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className={styles.sceneContent}>
                {scene.media_url && (
                  <div className={styles.sceneMedia}>
                    {scene.media_url.match(/\.(mp4|webm|mov|m3u8)$/i) ? (
                      <VideoPlayer
                        src={scene.media_url}
                        alt={scene.title}
                        assetStatus={scene.media_asset_status ?? undefined}
                        assetError={scene.media_asset_error}
                      />
                    ) : (
                      <img src={scene.media_url} alt={scene.title} />
                    )}
                  </div>
                )}
                <div className={styles.sceneMeta}>
                  <h3>{scene.title}</h3>
                  {scene.duration && (
                    <span className={styles.sceneDurLabel}>
                      {Math.floor(scene.duration / 60)}:{String(Math.floor(scene.duration % 60)).padStart(2, '0')}
                    </span>
                  )}
                </div>
                {scene.description && <p>{scene.description}</p>}
                {scene.profiles && (
                  <span className={styles.contributor}>
                    by @{scene.profiles.username}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showContributeButton && (
        <Link
          href={`/projects/${projectId}/contribute`}
          className={styles.contributeBtn}
        >
          + Submit a contribution
        </Link>
      )}
    </div>
  );
}
